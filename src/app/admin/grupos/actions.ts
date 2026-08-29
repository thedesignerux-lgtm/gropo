'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendPetitionMatched } from '@/lib/resend'
import { requireAdmin } from '@/lib/admin-auth'
import { validateCloseWindow } from '@/lib/closeWindow'

export interface Tier {
  min_units: number
  price: number
}

export interface CreateGroupInput {
  product_name: string
  product_spec: string
  product_url: string
  image_url: string
  pvp: string  // string vacío → null en BD; número → guardado como decimal
  closes_at: string
  seller_name: string
  price_mode: 'fluid' | 'stepped'
  min_execution: number
  max_stock: number
  payment_info: string
  tiers: Tier[]
}

function sellerEmail(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `seller-${slug}@gropo.local`
}

/** Validaciones compartidas entre createGroup y addBidToGroup */
function validateBidFields(
  tiers: Tier[],
  min_execution: number,
  max_stock: number,
): string | null {
  if (tiers.length < 1) return 'Añade al menos un tramo de precio'
  // G5 — Decisión B: min_execution ≤ max_stock
  if (min_execution > max_stock)
    return `La ejecución mínima (${min_execution}) no puede superar el stock máximo (${max_stock})`
  for (let i = 0; i < tiers.length; i++) {
    if (!Number.isFinite(tiers[i].min_units) || tiers[i].min_units < 1)
      return `Tramo ${i + 1}: unidades mínimas deben ser ≥ 1`
    if (!Number.isFinite(tiers[i].price) || tiers[i].price <= 0)
      return `Tramo ${i + 1}: precio debe ser mayor que 0`
    if (i > 0 && tiers[i].min_units <= tiers[i - 1].min_units)
      return `Tramo ${i + 1}: min_units debe ser mayor que el tramo anterior`
    if (i > 0 && tiers[i].price >= tiers[i - 1].price)
      return `Tramo ${i + 1}: precio debe ser menor que el tramo anterior`
    // G5 — Decisión B: cada tramo debe ser alcanzable dentro del stock
    if (tiers[i].min_units > max_stock)
      return `Tramo ${i + 1}: min_units (${tiers[i].min_units}) supera el stock máximo (${max_stock})`
  }
  return null
}

export async function createGroup(input: CreateGroupInput): Promise<{ error?: string }> {
  const authError = requireAdmin()
  if (authError) return { error: authError }

  const { product_name, product_spec, product_url, image_url, pvp, closes_at, seller_name, price_mode, min_execution, max_stock, payment_info, tiers } = input

  // Validations
  if (!product_name.trim()) return { error: 'El nombre del producto es obligatorio' }
  if (!seller_name.trim()) return { error: 'El nombre del vendedor es obligatorio' }
  if (!closes_at) return { error: 'La fecha de cierre es obligatoria' }
  const windowError = validateCloseWindow(closes_at)
  if (windowError) return { error: windowError }

  const bidError = validateBidFields(tiers, min_execution, max_stock)
  if (bidError) return { error: bidError }

  // Upsert seller
  const { data: seller, error: sellerError } = await supabaseAdmin
    .from('users')
    .upsert(
      { email: sellerEmail(seller_name), name: seller_name.trim(), role: 'seller' },
      { onConflict: 'email' }
    )
    .select('id')
    .single()

  if (sellerError || !seller) return { error: sellerError?.message ?? 'Error al crear el vendedor' }

  // Insert group
  const initialPrice = tiers[0].price
  const { data: group, error: groupError } = await supabaseAdmin
    .from('groups')
    .insert({
      product_name: product_name.trim(),
      product_spec: product_spec.trim() || null,
      product_url: product_url.trim() || null,
      image_url: image_url.trim() || null,
      pvp: pvp.trim() ? Number(pvp.trim()) : null,
      closes_at: new Date(closes_at).toISOString(),
      status: 'open',
      total_units: 0,
      current_price: initialPrice,
      next_price: tiers[1]?.price ?? null,
    })
    .select('id')
    .single()

  if (groupError || !group) return { error: groupError?.message ?? 'Error al crear el grupo' }

  // Insert bid
  const { error: bidInsertError } = await supabaseAdmin
    .from('bids')
    .insert({
      group_id: group.id,
      seller_id: seller.id,
      price_mode,
      min_execution,
      max_stock,
      payment_info: payment_info.trim() || null,
      tiers,
      status: 'active',
    })

  if (bidInsertError) {
    await supabaseAdmin.from('groups').delete().eq('id', group.id)
    return { error: bidInsertError.message ?? 'Error al crear la puja' }
  }

  redirect(`/admin/grupos/${group.id}`)
}

export interface AddBidInput {
  tiers: Tier[]
  price_mode: 'fluid' | 'stepped'
  min_execution: number
  max_stock: number
  payment_info: string
  seller_name: string
  closes_at?: string  // UTC ISO con zona explícita (mismo formato que createGroup)
  pvp?: string        // string vacío/ausente → no se toca
}

// Añade una puja a un grupo existente (primera o adicional — multi-puja G5).
export async function addBidToGroup(
  groupId: string,
  input: AddBidInput,
): Promise<{ error?: string }> {
  const authError = requireAdmin()
  if (authError) return { error: authError }

  const { tiers, price_mode, min_execution, max_stock, payment_info, seller_name, closes_at, pvp } = input

  // Validaciones
  if (!seller_name.trim()) return { error: 'El nombre del vendedor es obligatorio' }

  const bidError = validateBidFields(tiers, min_execution, max_stock)
  if (bidError) return { error: bidError }

  // Verificar que el grupo está abierto
  const { data: group, error: groupErr } = await supabaseAdmin
    .from('groups')
    .select('status, closes_at')
    .eq('id', groupId)
    .single()
  if (groupErr || !group) return { error: 'Grupo no encontrado' }
  if (group.status !== 'open') return { error: 'Solo se pueden añadir pujas a grupos abiertos' }

  // Regla de ventana de 6,5 días (holds de Stripe)
  if (closes_at) {
    const windowError = validateCloseWindow(closes_at)
    if (windowError) return { error: windowError }
  } else {
    // Sin fecha nueva: validar que la fecha heredada del grupo sea segura
    if (group.closes_at) {
      const windowError = validateCloseWindow(group.closes_at)
      if (windowError) return { error: `La fecha de cierre actual del grupo no es válida — indica una nueva. ${windowError}` }
    }
  }

  // Upsert vendedor placeholder (igual que createGroup)
  const { data: seller, error: sellerError } = await supabaseAdmin
    .from('users')
    .upsert(
      { email: sellerEmail(seller_name), name: seller_name.trim(), role: 'seller' },
      { onConflict: 'email' }
    )
    .select('id')
    .single()
  if (sellerError || !seller) return { error: sellerError?.message ?? 'Error al crear el vendedor' }

  // Insert puja
  const { error: bidInsertError } = await supabaseAdmin
    .from('bids')
    .insert({
      group_id: groupId,
      seller_id: seller.id,
      price_mode,
      min_execution,
      max_stock,
      payment_info: payment_info.trim() || null,
      tiers,
      status: 'active',
    })
  if (bidInsertError) return { error: bidInsertError.message ?? 'Error al crear la puja' }

  // Actualizar precio del grupo con compute_price (la fusión multi-puja lo absorbe)
  const groupUpdate: Record<string, unknown> = {}
  if (closes_at) groupUpdate.closes_at = new Date(closes_at).toISOString()
  if (pvp != null && pvp.trim()) groupUpdate.pvp = Number(pvp.trim())

  const { data: priced } = await supabaseAdmin.rpc('compute_price', { p_group_id: groupId })
  const row = Array.isArray(priced) ? priced[0] : priced
  if (row?.best_price != null) groupUpdate.current_price = Number(row.best_price)
  if (row?.next_price != null) groupUpdate.next_price = Number(row.next_price)
  else groupUpdate.next_price = null

  if (Object.keys(groupUpdate).length > 0) {
    await supabaseAdmin.from('groups').update(groupUpdate).eq('id', groupId)
  }

  // ── EMAIL al peticionario (solo si es la primera puja de una petición) ──
  // Blindado: cualquier fallo se traga; la puja ya está cargada.
  try {
    const { count } = await supabaseAdmin
      .from('bids')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)

    if (count === 1) {
      const { data: grp } = await supabaseAdmin
        .from('groups')
        .select('product_name, created_by')
        .eq('id', groupId)
        .single()

      const { data: petitioner } = grp?.created_by
        ? await supabaseAdmin
            .from('users')
            .select('email, name')
            .eq('id', grp.created_by)
            .single()
        : { data: null }

      if (petitioner?.email) {
        const base =
          process.env.NEXT_PUBLIC_SITE_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

        const { data: sent, error: sendError } = await sendPetitionMatched({
          to: petitioner.email,
          nombre: petitioner.name ?? undefined,
          productName: grp?.product_name ?? 'tu producto',
          groupUrl: `${base}/grupo/${groupId}`,
        })

        if (sendError) {
          console.error(`[addBidToGroup] Resend rechazó el email a ${petitioner.email} (puja cargada igualmente):`, sendError)
        } else {
          console.log(`[addBidToGroup] email de petición enviado a ${petitioner.email} (id: ${sent?.id ?? '—'})`)
        }
      }
    }
  } catch (e) {
    console.error('[addBidToGroup] email de petición falló (puja cargada igualmente):', e)
  }

  revalidatePath(`/admin/grupos/${groupId}`)
  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath(`/grupo/${groupId}`)
  return {}
}
