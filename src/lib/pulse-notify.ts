// src/lib/pulse-notify.ts — GROPO PULSE · aviso "ya sois suficientes"
//
// notifyReachableWatchers(groupId):
//  1. Lee pulse_state y calcula los tramos ALCANZABLES (no desbloqueados donde
//     comprometidos + aceptados + esperas >= unidades del tramo) — misma regla
//     que gatea el CTA en /api/group/[id]/pulse.
//  2. Busca pledges 'watching' de esos tramos aún no avisados de ESTE precio
//     (dedup por reachable_notified_price: re-anclar a otro tramo re-habilita
//     el aviso; el mismo tramo jamás se avisa dos veces).
//  3. Reclama el aviso ANTES de enviar (update condicional) para que dos
//     disparos concurrentes no dupliquen el email; si el envío falla, se
//     revierte la reclamación (best-effort) para que el cron lo reintente.
//
// Best-effort SIEMPRE: nunca lanza, nunca toca dinero, no interfiere con
// runPulseTrigger ni con el pipeline de cierre.

import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { pulseReachableEmail } from '@/lib/emails/pulseReachable'

const FROM = process.env.RESEND_FROM ?? 'Gropo <no-reply@gropo.es>'
const BASE_URL = 'https://www.vonda.es'

interface PulseStateRow {
  min_units: number
  price: number
  committed: number
  unlocked: boolean
  accepted_units: number
  watching_units: number
}

interface WatchingPledge {
  id: string
  auth_id: string
  tier_price: number
  buyer_name: string | null
  buyer_email: string | null
  reachable_notified_price: number | null
}

export async function notifyReachableWatchers(groupId: string): Promise<number> {
  let sent = 0
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return 0

    // 1. Tramos alcanzables (misma regla que el endpoint público del pulse)
    const { data: stateData, error: stateErr } = await supabaseAdmin.rpc('pulse_state', {
      p_group_id: groupId,
    })
    if (stateErr) return 0
    const rows = (stateData ?? []) as PulseStateRow[]

    // Mismo recorte de relevancia que el endpoint público: un tramo con precio
    // >= al mejor ya desbloqueado es irrelevante (nadie espera un precio peor
    // que el vigente). Sin esto podríamos enviar "¡ya sois suficientes, bloquea
    // a 20 €!" cuando el grupo ya está en 18 €.
    const currentMin = Math.min(
      ...rows.filter((r) => r.unlocked).map((r) => Number(r.price)),
      Infinity,
    )
    const reachablePrices = rows
      .filter(
        (r) =>
          !r.unlocked &&
          Number(r.price) < currentMin &&
          Number(r.committed) + Number(r.accepted_units) + Number(r.watching_units) >= Number(r.min_units),
      )
      .map((r) => Number(r.price))
    if (reachablePrices.length === 0) return 0

    // 2. Watchers de esos tramos pendientes de aviso
    const { data: pledgeData, error: pledgeErr } = await supabaseAdmin
      .from('pulse_pledges')
      .select('id, auth_id, tier_price, buyer_name, buyer_email, reachable_notified_price')
      .eq('group_id', groupId)
      .eq('status', 'watching')
      .in('tier_price', reachablePrices)
    if (pledgeErr) return 0
    const pending = ((pledgeData ?? []) as WatchingPledge[]).filter(
      (p) => Number(p.reachable_notified_price) !== Number(p.tier_price),
    )
    if (pending.length === 0) return 0

    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('product_name, status')
      .eq('id', groupId)
      .single()
    if (!group || group.status !== 'open') return 0

    const resend = new Resend(apiKey)

    // 3a. Resolver destinatarios ANTES de reclamar. Un pledge sin email NO debe
    // quedar marcado como avisado: si se reclamara primero, el `continue` lo
    // dejaría "notificado" sin haber enviado nada y el cron no lo reintentaría
    // nunca. Los `watching` normalmente no tienen buyer_email (aún no han dado
    // datos de compra), así que la resolución va en paralelo: en serie serían
    // N round-trips a auth.admin dentro del POST de /api/pulse/pledge.
    const targets = (
      await Promise.all(
        pending.map(async (p) => {
          let to = p.buyer_email
          let nombre = p.buyer_name ?? undefined
          if (!to) {
            const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(p.auth_id)
            to = userRes?.user?.email ?? null
            nombre = nombre ?? (userRes?.user?.user_metadata?.name as string | undefined)
          }
          if (!to) {
            console.warn(`[pulse-notify] pledge ${p.id} sin email; queda pendiente de reintento`)
            return null
          }
          return { pledge: p, to, nombre }
        }),
      )
    ).filter((t): t is { pledge: WatchingPledge; to: string; nombre: string | undefined } => t !== null)
    if (targets.length === 0) return 0

    // 3b. Reclamar + enviar, en paralelo: la latencia no crece con el número de
    // watchers (relevante porque esto corre dentro del POST del pledge).
    const results = await Promise.allSettled(
      targets.map(async ({ pledge: p, to, nombre }) => {
        // Reclamar el aviso (dedup atómico frente a disparos concurrentes)
        const { data: claimed } = await supabaseAdmin
          .from('pulse_pledges')
          .update({
            reachable_notified_at: new Date().toISOString(),
            reachable_notified_price: p.tier_price,
          })
          .eq('id', p.id)
          .eq('status', 'watching')
          .or(`reachable_notified_price.is.null,reachable_notified_price.neq.${Number(p.tier_price)}`)
          .select('id')
        if (!claimed || claimed.length === 0) return false // otro disparo lo reclamó

        const { subject, text, html } = pulseReachableEmail({
          nombre,
          productName: group.product_name,
          tierPrice: Number(p.tier_price),
          groupUrl: `${BASE_URL}/favoritos`,
        })

        try {
          await resend.emails.send({ from: FROM, to, subject, text, html })
          console.log(`[pulse-notify] aviso enviado a ${to} (grupo ${groupId}, tramo ${p.tier_price})`)
          return true
        } catch (sendErr: unknown) {
          // Revertir la reclamación para que el cron reintente (best-effort)
          console.error('[pulse-notify] envío falló, revirtiendo claim:', (sendErr as Error)?.message)
          await supabaseAdmin
            .from('pulse_pledges')
            .update({ reachable_notified_at: null, reachable_notified_price: null })
            .eq('id', p.id)
          return false
        }
      }),
    )
    sent = results.filter((r) => r.status === 'fulfilled' && r.value === true).length
  } catch (err: unknown) {
    console.error('[pulse-notify] error (no-fatal):', (err as Error)?.message)
  }
  return sent
}
