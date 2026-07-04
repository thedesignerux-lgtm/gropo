'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendPetitionMatched } from '@/lib/resend'
import { requireAdmin } from '@/lib/admin-auth'

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
  return `seller-${slug}@vonda.local`
}

export async function createGroup(input: CreateGroupInput): Promise<{ error?: string }> {
  const authError = requireAdmin()
  if (authError) return { error: authError }

  const { product_name, product_spec, product_url, image_url, pvp, closes_at, seller_name, price_mode, min_execution, max_stock, payment_info, tiers } = input

  // Validations
  if (!product_name.trim()) return { error: 'El nombre del producto es obligatorio' }
  if (!seller_name.trim()) return { error: 'El nombre del vendedor es obligatorio' }
  if (!closes_at) return { error: 'La fecha de cierre es obligatoria' }
  if (tiers.length < 1) return { error: 'Añade al menos un tramo de precio' }

  for (let i = 0; i < tiers.length; i++) {
    if (!Number.isFinite(tiers[i].min_units) || tiers[i].min_units < 1)
      return { error: `Tramo ${i + 1}: unidades mínimas deben ser ≥ 1` }
    if (!Number.isFinite(tiers[i].price) || tiers[i].price <= 0)
      return { error: `Tramo ${i + 1}: precio debe ser mayor que 0` }
    if (i > 0 && tiers[i].min_units <= tiers[i - 1].min_units)
      return { error: `Tramo ${i + 1}: min_units debe ser mayor que el tramo anterior` }
    if (i > 0 && tiers[i].price >= tiers[i - 1].price)
      return { error: `Tramo ${i + 1}: precio debe ser menor que el tramo anterior` }
  }

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
  const { error: bidError } = await supabaseAdmin
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

  if (bidError) {
    await supabaseAdmin.from('groups').delete().eq('id', group.id)
    return { error: bidError.message ?? 'Error al crear la puja' }
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

// Asigna la PRIMERA puja a un grupo que ya existe (una petición sin puja).
// No es para mejorar pujas (eso es futuro): si ya hay una activa, rechaza.
export async function addBidToGroup(
  groupId: string,
  input: AddBidInput,
): Promise<{ error?: string }> {
  const authError = requireAdmin()
  if (authError) return { error: authError }

  const { tiers, price_mode, min_execution, max_stock, payment_info, seller_name, closes_at, pvp } = input

  // Validaciones (mismas reglas que createGroup)
  if (!seller_name.trim()) return { error: 'El nombre del vendedor es obligatorio' }
  if (tiers.length < 1) return { error: 'Añade al menos un tramo de precio' }
  for (let i = 0; i < tiers.length; i++) {
    if (!Number.isFinite(tiers[i].min_units) || tiers[i].min_units < 1)
      return { error: `Tramo ${i + 1}: unidades mínimas deben ser ≥ 1` }
    if (!Number.isFinite(tiers[i].price) || tiers[i].price <= 0)
      return { error: `Tramo ${i + 1}: precio debe ser mayor que 0` }
    if (i > 0 && tiers[i].min_units <= tiers[i - 1].min_units)
      return { error: `Tramo ${i + 1}: min_units debe ser mayor que el tramo anterior` }
    if (i > 0 && tiers[i].price >= tiers[i - 1].price)
      return { error: `Tramo ${i + 1}: precio debe ser menor que el tramo anterior` }
  }

  // GUARD: solo para asignar la PRIMERA puja
  const { data: activeBids, error: activeErr } = await supabaseAdmin
    .from('bids')
    .select('id')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .limit(1)
  if (activeErr) return { error: activeErr.message }
  if (activeBids && activeBids.length > 0) return { error: 'Este grupo ya tiene vendedor asignado' }

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
  const { error: bidError } = await supabaseAdmin
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
  if (bidError) return { error: bidError.message ?? 'Error al crear la puja' }

  // El admin confirma fecha/pvp definitivos al asignar el vendedor.
  // current_price/next_price se recalculan con compute_price (como join_group).
  const groupUpdate: Record<string, unknown> = {}
  if (closes_at) groupUpdate.closes_at = new Date(closes_at).toISOString()
  if (pvp != null && pvp.trim()) groupUpdate.pvp = Number(pvp.trim())

  const { data: priced } = await supabaseAdmin.rpc('compute_price', { p_group_id: groupId })
  const row = Array.isArray(priced) ? priced[0] : priced
  if (row?.best_price != null) groupUpdate.current_price = Number(row.best_price)
  if (row?.next_price != null) groupUpdate.next_price = Number(row.next_price)

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
      const { data: group } = await supabaseAdmin
        .from('groups')
        .select('product_name, created_by')
        .eq('id', groupId)
        .single()

      const { data: petitioner } = group?.created_by
        ? await supabaseAdmin
            .from('users')
            .select('email, name')
            .eq('id', group.created_by)
            .single()
        : { data: null }

      if (petitioner?.email) {
        const base =
          process.env.NEXT_PUBLIC_SITE_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

        // resend.emails.send NO lanza ante errores de API (dominio no
        // verificado, destinatario no permitido en sandbox, etc.): devuelve
        // el error en .error. Hay que inspeccionarlo o el fallo es silencioso.
        const { data: sent, error: sendError } = await sendPetitionMatched({
          to: petitioner.email,
          nombre: petitioner.name ?? undefined,
          productName: group?.product_name ?? 'tu producto',
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
  // El grupo pasa a tener puja → debe aparecer/actualizarse en las páginas públicas.
  revalidatePath('/')
  revalidatePath(`/grupo/${groupId}`)
  return {}
}
