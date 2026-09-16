// src/lib/stripe-capture.ts
// Bloque 2.5 — Captura al cierre.
// close_group (SQL) decide el reparto; AQUÍ se mueve el dinero en Stripe,
// porque son llamadas a la API que no pueden vivir en Postgres.
//
// Sobre el estado que dejó close_group:
//   · 'instructed' (adjudicado, con final_price) → CAPTURAR final_price×qty.
//        La captura es PARCIAL: final_price ≤ guaranteed_price (lo retenido),
//        así que Stripe cobra el final y libera la diferencia automáticamente.
//        → payment_status='paid', captured_amount.
//   · 'cancelled' (gropo sin ejecución / sin puja) → LIBERAR el hold → 'released'.
//   · 'authorized' excedente → SIN TOCAR (lo resuelve el admin, 2ª puja).
//
// IDEMPOTENTE: opera por estado en BD (re-correr el cierre no recaptura), y si
// el PI ya estaba capturado/cancelado en Stripe pero la BD no se actualizó,
// lo reconcilia en vez de fallar.

import { stripe } from './stripe';
import { supabaseAdmin } from './supabase-admin';

export interface CaptureSummary {
  captured: number;
  released: number;
  failed: { memberId: string; paymentIntentId: string | null; error: string; finalPrice: number | null }[];
}

export async function captureGroupPayments(groupId: string): Promise<CaptureSummary> {
  const { data: members, error } = await supabaseAdmin
    .from('group_members')
    .select('id, quantity, final_price, payment_status, stripe_payment_intent_id')
    .eq('group_id', groupId);

  if (error) throw new Error(`captureGroupPayments: ${error.message}`);

  const summary: CaptureSummary = { captured: 0, released: 0, failed: [] };

  for (const m of members ?? []) {
    const pi: string | null = m.stripe_payment_intent_id;
    if (!pi) continue; // miembro legado (V0 sin Stripe): nada que mover

    try {
      // ADJUDICADO → capturar el precio final × cantidad
      if (m.payment_status === 'instructed' && m.final_price != null) {
        const captured = Number(m.final_price) * m.quantity;
        await captureIdempotent(pi, Math.round(captured * 100));
        await supabaseAdmin
          .from('group_members')
          .update({ payment_status: 'paid', captured_amount: captured })
          .eq('id', m.id);
        summary.captured++;
      }
      // GROPO CANCELADA → liberar el hold, cero cargo
      else if (m.payment_status === 'cancelled') {
        await cancelIdempotent(pi);
        await supabaseAdmin
          .from('group_members')
          .update({ payment_status: 'released' })
          .eq('id', m.id);
        summary.released++;
      }
    } catch (e: any) {
      console.error(`[capture] miembro ${m.id} PI ${pi}:`, e?.message);
      // Sistema de comunicaciones · Sección G (fallo de retención): el cobro tras
      // el cierre ha fallado (tarjeta rechazada, SCA, hold caducado...). Antes
      // este miembro se quedaba en 'instructed' para siempre, sin ningún aviso.
      // Se marca 'auth_failed' —valor ya reservado en el enum— para que quede
      // reflejado en BD y el llamador (closeGroup) pueda avisar al comprador.
      try {
        await supabaseAdmin
          .from('group_members')
          .update({ payment_status: 'auth_failed' })
          .eq('id', m.id)
          .eq('payment_status', 'instructed'); // guarda: no tocar si ya cambió
      } catch (dbErr: any) {
        console.error(`[capture] no se pudo marcar auth_failed para ${m.id}:`, dbErr?.message);
      }
      summary.failed.push({
        memberId: m.id,
        paymentIntentId: pi,
        error: e?.message ?? 'error',
        finalPrice: m.final_price != null ? Number(m.final_price) : null,
      });
    }
  }

  return summary;
}

// Captura tolerante: si el PI ya estaba capturado (succeeded), lo damos por bueno.
async function captureIdempotent(pi: string, amountToCapture: number) {
  try {
    await stripe.paymentIntents.capture(pi, { amount_to_capture: amountToCapture });
  } catch (e) {
    const intent = await stripe.paymentIntents.retrieve(pi);
    if (intent.status === 'succeeded') return; // ya cobrado en una corrida previa
    throw e;
  }
}

// Cancelación tolerante: si el PI ya estaba cancelado, lo damos por bueno.
async function cancelIdempotent(pi: string) {
  try {
    await stripe.paymentIntents.cancel(pi);
  } catch (e) {
    const intent = await stripe.paymentIntents.retrieve(pi);
    if (intent.status === 'canceled') return; // ya liberado
    throw e;
  }
}
