// Envío de emails de instrucciones de pago al cerrar un grupo.
// SOLO servidor. Reutilizable: lo llama el Server Action de cierre manual
// y el endpoint /api/email/close-payment (y el futuro cron).
//
// Regla: miembros 'paid' reciben confirmación de compra; miembros 'instructed'
// reciben instrucciones de pago. Excedente (pending) y cancelados NO reciben nada.

import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendPaymentInstructions, sendPurchaseConfirmation } from '@/lib/resend'

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
    .select('join_order, quantity, final_price, captured_amount, payment_status, users(name, email)')
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
        else sent++
      } else {
        // Adjudicado sin captura → instrucciones de pago por transferencia
        const concepto = `VONDA-${groupPrefix}-${m.join_order}`
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
        else sent++
      }
    } catch (e) {
      failed++
      console.error('close-email throw', email, e)
    }
  }

  return { attempted: members.length, sent, failed }
}
