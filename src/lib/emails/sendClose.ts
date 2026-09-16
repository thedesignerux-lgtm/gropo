// Envío de emails de instrucciones de pago al cerrar un grupo.
// SOLO servidor. Reutilizable: lo llama el Server Action de cierre manual
// y el endpoint /api/email/close-payment (y el futuro cron).
//
// Regla: miembros 'paid' reciben confirmación de compra; miembros 'instructed'
// reciben instrucciones de pago. Excedente (pending) y cancelados NO reciben nada.

import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendPaymentInstructions, sendPurchaseConfirmation, sendClosedNotReached, sendAuthorizationFailed } from '@/lib/resend'
import { tryRecordCommunication, markEmailSent } from '@/lib/buyerComms'
import { SITE_URL } from '@/lib/site'

export interface CloseEmailsResult {
  attempted: number
  sent: number
  failed: number
  skipped?: string
}

export async function sendClosePaymentEmails(groupId: string): Promise<CloseEmailsResult> {
  // Producto
  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('product_name')
    .eq('id', groupId)
    .single()

  if (!group) return { attempted: 0, sent: 0, failed: 0, skipped: 'grupo no encontrado' }

  // payment_info de la PUJA GANADORA — sacado del último evento group_closed
  let paymentInfo: string | null = null
  const { data: closeEvent } = await supabaseAdmin
    .from('events')
    .select('payload')
    .eq('group_id', groupId)
    .eq('type', 'group_closed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const winnerBidId = (closeEvent?.payload as any)?.winner_bid_id as string | undefined
  if (winnerBidId) {
    const { data: bid } = await supabaseAdmin
      .from('bids')
      .select('payment_info')
      .eq('id', winnerBidId)
      .single()
    paymentInfo = bid?.payment_info ?? null
  }

  // Adjudicados pendientes de transferencia (instructed) + cobrados por Stripe (paid)
  const { data: members } = await supabaseAdmin
    .from('group_members')
    .select('id, join_order, quantity, final_price, captured_amount, payment_status, users(name, email)')
    .eq('group_id', groupId)
    .in('payment_status', ['instructed', 'paid'])
    .order('join_order')

  if (!members || members.length === 0) {
    return { attempted: 0, sent: 0, failed: 0, skipped: 'sin miembros instructed ni paid' }
  }

  // Plazo: ahora + 48h
  const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  const groupPrefix = groupId.slice(0, 4).toUpperCase()

  let sent = 0
  let failed = 0

  for (const m of members) {
    const u = m.users as any
    const email: string | undefined = u?.email
    if (!email) { failed++; continue }

    const finalPrice = Number(m.final_price)
    const quantity = m.quantity

    // Sistema de comunicaciones · Sección H: una sola comunicación de "cierre
    // con compra" por participación, aunque este envío se dispare más de una
    // vez (cron + botón manual, reintentos, etc.).
    const rec = await tryRecordCommunication({ memberId: m.id, type: 'group_closed_success' })
    if (!rec.isNew) { continue }

    try {
      if (m.payment_status === 'paid') {
        // Cobro capturado por Stripe → confirmación de compra
        const total = m.captured_amount != null ? Number(m.captured_amount) : finalPrice * quantity
        const { error } = await sendPurchaseConfirmation({
          to: email,
          nombre: u?.name ?? undefined,
          productName: group.product_name,
          quantity,
          finalPrice,
          total,
        })
        if (error) { failed++; console.error('close-email error', email, error) }
        else { sent++; await markEmailSent(rec.id) }
      } else {
        // Adjudicado sin captura → instrucciones de pago por transferencia
        const concepto = `GROPO-${groupPrefix}-${m.join_order}`
        const { error } = await sendPaymentInstructions({
          to: email,
          nombre: u?.name ?? undefined,
          productName: group.product_name,
          quantity,
          finalPrice,
          total: finalPrice * quantity,
          paymentInfo,
          concepto,
          deadline,
        })
        if (error) { failed++; console.error('close-email error', email, error) }
        else { sent++; await markEmailSent(rec.id) }
      }
    } catch (e) {
      failed++
      console.error('close-email throw', email, e)
    }
  }

  return { attempted: members.length, sent, failed }
}


// ── Email 04 · Grupo cerrado · precio no alcanzado ──────────────────────────
// Se envía a quien `close_group` canceló por no alcanzar el precio/condición
// que había indicado (join_mode='esperar' con target_price no cubierto, o
// join_mode='comprar' sin ejecución del grupo). No reconstruye el motivo del
// cierre: usa directamente `payment_status='cancelled'` y el precio final que
// `close_group` ya dejó en `groups.final_price`, si lo hubo.
export async function sendClosedNotReachedEmails(groupId: string): Promise<CloseEmailsResult> {
  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('product_name, final_price, status')
    .eq('id', groupId)
    .single()

  if (!group) return { attempted: 0, sent: 0, failed: 0, skipped: 'grupo no encontrado' }

  const { data: members } = await supabaseAdmin
    .from('group_members')
    .select('id, join_mode, target_price, guaranteed_price, users(name, email)')
    .eq('group_id', groupId)
    .eq('payment_status', 'cancelled')

  if (!members || members.length === 0) {
    return { attempted: 0, sent: 0, failed: 0, skipped: 'sin miembros cancelados' }
  }

  const finalPrice = group.status === 'closed' && group.final_price != null ? Number(group.final_price) : null

  let sent = 0
  let failed = 0

  for (const m of members) {
    const u = m.users as any
    const email: string | undefined = u?.email
    if (!email) { failed++; continue }

    const rec = await tryRecordCommunication({ memberId: m.id, type: 'group_closed_not_reached' })
    if (!rec.isNew) continue

    const chosenPrice = m.join_mode === 'esperar' && m.target_price != null ? Number(m.target_price) : null

    try {
      const { error } = await sendClosedNotReached({
        to: email,
        nombre: u?.name ?? undefined,
        productName: group.product_name,
        chosenPrice,
        finalPrice,
      })
      if (error) { failed++; console.error('closed-not-reached error', email, error) }
      else { sent++; await markEmailSent(rec.id) }
    } catch (e) {
      failed++
      console.error('closed-not-reached throw', email, e)
    }
  }

  return { attempted: members.length, sent, failed }
}

// ── Email 05 · No hemos podido realizar la retención ────────────────────────
// Se envía a los miembros que `captureGroupPayments` no pudo cobrar tras el
// cierre (tarjeta rechazada, hold caducado, SCA...). `failedMembers` viene
// directamente del resultado de esa función — no se vuelve a calcular nada.
export async function sendAuthorizationFailedEmails(
  groupId: string,
  failedMembers: { memberId: string; finalPrice: number | null }[],
): Promise<CloseEmailsResult> {
  if (failedMembers.length === 0) return { attempted: 0, sent: 0, failed: 0, skipped: 'sin fallos de cobro' }

  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('product_name')
    .eq('id', groupId)
    .single()
  if (!group) return { attempted: 0, sent: 0, failed: 0, skipped: 'grupo no encontrado' }

  const memberIds = failedMembers.map((f) => f.memberId)
  const { data: members } = await supabaseAdmin
    .from('group_members')
    .select('id, users(name, email)')
    .in('id', memberIds)

  const byId = new Map((members ?? []).map((m: any) => [m.id, m]))
  const groupUrl = `${SITE_URL}/grupo/${groupId}`

  let sent = 0
  let failed = 0

  for (const f of failedMembers) {
    const m = byId.get(f.memberId) as any
    const u = m?.users
    const email: string | undefined = u?.email
    if (!email) { failed++; continue }

    const rec = await tryRecordCommunication({ memberId: f.memberId, type: 'payment_authorization_failed' })
    if (!rec.isNew) continue

    try {
      const { error } = await sendAuthorizationFailed({
        to: email,
        nombre: u?.name ?? undefined,
        productName: group.product_name,
        finalPrice: f.finalPrice ?? 0,
        groupUrl,
      })
      if (error) { failed++; console.error('authorization-failed error', email, error) }
      else { sent++; await markEmailSent(rec.id) }
    } catch (e) {
      failed++
      console.error('authorization-failed throw', email, e)
    }
  }

  return { attempted: failedMembers.length, sent, failed }
}
