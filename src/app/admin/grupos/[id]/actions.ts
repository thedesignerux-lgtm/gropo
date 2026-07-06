'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendClosePaymentEmails } from '@/lib/emails/sendClose'
import { captureGroupPayments } from '@/lib/stripe-capture'
import { sendAdminAlert } from '@/lib/resend'
import { generateShippingLabels, type ShippingResult } from '@/lib/shipping-sendcloud'
import { requireAdmin } from '@/lib/admin-auth'

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
      // Captura fallida = dinero atascado: el adjudicado sigue 'instructed' y es
      // visible en el panel. Avisamos al admin (best-effort, no rompe el cierre).
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

  // Emails de pago a los adjudicados — BLINDADO: el cierre ya está cometido en
  // la BD, así que un fallo de email NO debe romper ni revertir el cierre.
  // El dinero es primario; el email, secundario (misma regla que la unión).
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
  pvp: string  // string vacío → null en BD; número → guardado como decimal
  closes_date: string  // YYYY-MM-DD; se guarda como 20:00 UTC (= 22:00 Madrid CEST)
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

  const closes_at = `${closes_date}T20:00:00+00:00`

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
