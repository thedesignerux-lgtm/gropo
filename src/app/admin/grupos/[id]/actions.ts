'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendClosePaymentEmails } from '@/lib/emails/sendClose'
import { captureGroupPayments } from '@/lib/stripe-capture'
import { sendAdminAlert } from '@/lib/resend'
import { generateShippingLabels, type ShippingResult } from '@/lib/shipping-sendcloud'
import { requireAdmin } from '@/lib/admin-auth'
import { validateCloseWindow, madridCloseAtISO } from '@/lib/closeWindow'

export interface CloseResult {
  result: string
  settlement_price?: number
  total_units?: number
  adjudicated_units?: number
  surplus_units?: number
  min_required?: number
  second_price_at_n?: number
}

export async function closeGroup(
  groupId: string,
): Promise<{ error?: string; data?: CloseResult }> {
  const authError = requireAdmin()
  if (authError) return { error: authError }

  const { data, error } = await supabaseAdmin.rpc('close_group', { p_group_id: groupId })
  if (error) return { error: error.message }

  const result = data as CloseResult

  // CAPTURA AL CIERRE (Bloque 2.5) — BLINDADA: el cierre ya está cometido en la
  // BD; mover el dinero en Stripe va después y por miembro, así que un fallo
  // puntual NO revierte el cierre. Cobra a los adjudicados (final_price×qty) y
  // libera los holds de las vondas canceladas. Idempotente.
  try {
    const cap = await captureGroupPayments(groupId)
    console.log(`[closeGroup] captura ${groupId}:`, JSON.stringify(cap))
    if (cap.failed.length > 0) {
      const detail = cap.failed.map(f => `• miembro ${f.memberId} (PI ${f.paymentIntentId}): ${f.error}`).join('\n')
      try {
        await sendAdminAlert(
          `[Vonda] ${cap.failed.length} cobro(s) fallaron al cerrar la vonda`,
          `Estos holds no se pudieron capturar/liberar al cerrar ${groupId}:\n\n${detail}\n\n` +
            `Siguen pendientes en el panel. Si el motivo es un hold caducado (status canceled/expired), reintentar el cierre NO sirve: el miembro ya ha recibido instrucciones de pago por transferencia. Verifica el PaymentIntent en Stripe y controla que la transferencia llegue dentro del plazo.`,
        )
      } catch (e) {
        console.error('sendAdminAlert (captura) falló:', e)
      }
    }
  } catch (e) {
    console.error('captureGroupPayments falló (cierre OK igualmente):', e)
  }

  // Emails de pago a los adjudicados — BLINDADO
  if (result?.result === 'closed' || result?.result === 'surplus') {
    try {
      await sendClosePaymentEmails(groupId)
    } catch (e) {
      console.error('sendClosePaymentEmails falló (cierre OK igualmente):', e)
    }
  }

  revalidatePath(`/admin/grupos/${groupId}`)
  revalidatePath('/admin')
  return { data: result }
}

export interface UpdateGroupInput {
  product_name: string
  product_spec: string
  product_url: string
  image_url: string
  pvp: string
  closes_date: string
}

export async function updateGroup(
  groupId: string,
  input: UpdateGroupInput,
): Promise<{ error?: string }> {
  const authError = requireAdmin()
  if (authError) return { error: authError }

  const { product_name, product_spec, product_url, image_url, pvp, closes_date } = input

  if (!product_name.trim()) return { error: 'El nombre del producto es obligatorio' }
  if (!closes_date) return { error: 'La fecha de cierre es obligatoria' }

  const closes_at = madridCloseAtISO(closes_date)

  const { data: oldestMember } = await supabaseAdmin
    .from('group_members')
    .select('created_at')
    .eq('group_id', groupId)
    .in('payment_status', ['authorized', 'instructed'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const windowError = validateCloseWindow(closes_at, oldestMember?.created_at ?? undefined)
  if (windowError) return { error: windowError }

  const { error } = await supabaseAdmin
    .from('groups')
    .update({
      product_name: product_name.trim(),
      product_spec: product_spec.trim() || null,
      product_url: product_url.trim() || null,
      image_url: image_url.trim() || null,
      pvp: pvp.trim() ? Number(pvp.trim()) : null,
      closes_at: new Date(closes_at).toISOString(),
    })
    .eq('id', groupId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/grupos/${groupId}`)
  return {}
}

export async function generateLabels(
  groupId: string,
): Promise<{ error?: string; data?: ShippingResult }> {
  const authError = requireAdmin()
  if (authError) return { error: authError }

  try {
    const result = await generateShippingLabels(groupId)
    revalidatePath(`/admin/grupos/${groupId}`)
    return { data: result }
  } catch (e: any) {
    return { error: e?.message ?? 'Error generando etiquetas' }
  }
}

// ── G5: Retirar puja (§5.3) ──────────────────────────────────────────────────

export async function withdrawBid(
  bidId: string,
  groupId: string,
): Promise<{ error?: string }> {
  const authError = requireAdmin()
  if (authError) return { error: authError }

  // 1. Verificar que la puja existe y está activa
  const { data: bid, error: bidErr } = await supabaseAdmin
    .from('bids')
    .select('id, status, group_id')
    .eq('id', bidId)
    .single()
  if (bidErr || !bid) return { error: 'Puja no encontrada' }
  if (bid.status !== 'active') return { error: `La puja ya está en estado '${bid.status}'` }
  if (bid.group_id !== groupId) return { error: 'La puja no pertenece a este grupo' }

  // 2. Verificar que el grupo está abierto
  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('status')
    .eq('id', groupId)
    .single()
  if (group?.status !== 'open') return { error: 'Solo se pueden retirar pujas de grupos abiertos' }

  // 3. No se puede retirar la única puja activa
  const { count: activeBidCount } = await supabaseAdmin
    .from('bids')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('status', 'active')
  if ((activeBidCount ?? 0) <= 1) return { error: 'No puedes retirar la única puja activa del grupo' }

  // 4. §5.3 — Marcar como withdrawn TENTATIVAMENTE, recalcular, y verificar
  //    que el nuevo precio no supera ningún guaranteed_price vivo.
  //    Si falla el check, revertimos a 'active' inmediatamente.
  //    (Race window despreciable: solo Benjamin usa el admin.)
  const { error: withdrawErr } = await supabaseAdmin
    .from('bids')
    .update({ status: 'withdrawn' })
    .eq('id', bidId)
  if (withdrawErr) return { error: withdrawErr.message }

  // Recalcular precio sin esta puja
  const { data: priced } = await supabaseAdmin.rpc('compute_price', { p_group_id: groupId })
  const row = Array.isArray(priced) ? priced[0] : priced
  const newPrice = row?.best_price != null ? Number(row.best_price) : null

  // Verificar contra guaranteed_prices de miembros con holds vivos
  const { data: members } = await supabaseAdmin
    .from('group_members')
    .select('guaranteed_price')
    .eq('group_id', groupId)
    .in('payment_status', ['authorized', 'instructed', 'paid'])

  if (members && members.length > 0 && newPrice != null) {
    const minGuaranteed = Math.min(...members.map(m => Number(m.guaranteed_price)))
    if (newPrice > minGuaranteed) {
      // ROLLBACK: restaurar puja a activa
      await supabaseAdmin
        .from('bids')
        .update({ status: 'active' })
        .eq('id', bidId)
      return {
        error: `No se puede retirar: el nuevo precio (${newPrice.toFixed(2)} €) superaría el precio garantizado de algún miembro (${minGuaranteed.toFixed(2)} €). `
          + `Para retirar esta puja, primero deben salir esos miembros o debe haber otra puja que cubra el precio.`,
      }
    }
  }

  // 5. Check OK — actualizar precio del grupo
  if (newPrice != null) {
    await supabaseAdmin
      .from('groups')
      .update({
        current_price: newPrice,
        next_price: row.next_price != null ? Number(row.next_price) : null,
      })
      .eq('id', groupId)
  }

  revalidatePath(`/admin/grupos/${groupId}`)
  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath(`/grupo/${groupId}`)
  return {}
}
