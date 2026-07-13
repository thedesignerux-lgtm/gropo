// src/lib/pulse.ts — VONDA PULSE · motor de disparo (G2)
//
// runPulseTrigger(groupId):
//  1. pulse_check_and_lock (SQL, advisory lock) decide si hay masa y marca
//     los pledges elegidos como 'holding'. Idempotente: doble llamada = vacía.
//  2. Para cada elegido crea un PaymentIntent OFF-SESSION con captura manual
//     (hold = tier aceptado × cantidad) usando la tarjeta guardada al aceptar.
//  3. Éxito (requires_capture) → pledge 'converted'. El webhook existente
//     (payment_intent.amount_capturable_updated → confirm_join) crea al miembro
//     como ESPERADOR con target = tier aceptado. CERO lógica de dinero nueva:
//     si el tier no se consolida, close_group libera el hold como siempre.
//  4. Fallo (tarjeta rechazada / SCA) → pledge 'failed' y se reintenta el ciclo
//     por si la masa sigue completa con los demás.
//
// INVARIANTE: esta función NO toca compute_price / close_group / confirm_join.

import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

export interface PulseTriggerResult {
  fired: boolean;
  converted: number;
  failed: number;
}

interface LockedPledge {
  pledge_id: string;
  auth_id: string;
  quantity: number;
  tier_price: number;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  shipping: {
    name?: string; phone?: string; line1?: string; line2?: string | null;
    city?: string; province?: string; postal_code?: string; country?: string;
  } | null;
  fired_price: number;
  fired_min_units: number;
  triggered_at: string;
}

async function markPledge(
  pledgeId: string,
  status: 'converted' | 'failed' | 'accepted',
  paymentIntentId?: string,
) {
  const patch: Record<string, unknown> = { status };
  if (paymentIntentId) patch.stripe_payment_intent_id = paymentIntentId;
  const { error } = await supabaseAdmin.from('pulse_pledges').update(patch).eq('id', pledgeId);
  if (error) console.error(`[pulse] no se pudo marcar pledge ${pledgeId} → ${status}:`, error.message);
}

export async function runPulseTrigger(groupId: string): Promise<PulseTriggerResult> {
  let converted = 0;
  let failed = 0;
  let fired = false;

  // Reintenta el ciclo (máx. 3): si una tarjeta falla puede que la masa
  // siga completa con el resto de aceptados.
  for (let round = 0; round < 3; round++) {
    const { data, error } = await supabaseAdmin.rpc('pulse_check_and_lock', {
      p_group_id: groupId,
    });
    if (error) {
      console.error('[pulse] pulse_check_and_lock error:', error.message);
      break;
    }
    const pledges = (data ?? []) as LockedPledge[];
    if (pledges.length === 0) break;
    fired = true;

    // Nombre del producto para la descripción del cargo
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('product_name, product_spec')
      .eq('id', groupId)
      .single();

    let anyFailedThisRound = false;

    for (const p of pledges) {
      if (!p.stripe_customer_id || !p.stripe_payment_method_id) {
        console.error(`[pulse] pledge ${p.pledge_id} sin tarjeta guardada — failed`);
        await markPledge(p.pledge_id, 'failed');
        failed++; anyFailedThisRound = true;
        continue;
      }

      const amountCents = Math.round(p.tier_price * p.quantity * 100);
      const ship = p.shipping ?? {};

      const params: Stripe.PaymentIntentCreateParams = {
        amount: amountCents,
        currency: 'eur',
        capture_method: 'manual',
        customer: p.stripe_customer_id,
        payment_method: p.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        payment_method_types: ['card'],
        description: `Vonda · ${group?.product_name ?? 'Grupo'}${group?.product_spec ? ` (${group.product_spec})` : ''} x${p.quantity} (Pulse)`,
        shipping: ship.line1
          ? {
              name: ship.name ?? p.buyer_name ?? '',
              phone: ship.phone ?? p.buyer_phone ?? undefined,
              address: {
                line1: ship.line1,
                line2: ship.line2 || undefined,
                city: ship.city,
                state: ship.province || undefined,
                postal_code: ship.postal_code,
                country: ship.country ?? 'ES',
              },
            }
          : undefined,
        // Metadata IDÉNTICA en forma a create-intent: el webhook existente
        // hace confirm_join sin saber que esto nació del Pulse.
        metadata: {
          group_id: groupId,
          quantity: String(p.quantity),
          buyer_name: p.buyer_name ?? '',
          buyer_email: p.buyer_email ?? '',
          buyer_phone: p.buyer_phone ?? '',
          guaranteed_price: String(p.tier_price),
          join_mode: 'esperar',
          target_price: String(p.tier_price),
          pulse_pledge_id: p.pledge_id,
        },
        // Idempotencia extra frente a reintentos del propio motor
      };

      try {
        // Clave única POR INTENTO de disparo (pledge + triggered_at): un reintento
        // tras fallo genera PI nuevo; un doble-submit del MISMO disparo no duplica.
        const attempt = Date.parse(p.triggered_at) || Date.now();
        const pi = await stripe.paymentIntents.create(params, {
          idempotencyKey: `pulse-${p.pledge_id}-${attempt}`,
        });
        if (pi.status === 'requires_capture') {
          await markPledge(p.pledge_id, 'converted', pi.id);
          converted++;
        } else {
          // Estado inesperado en off-session (p. ej. requires_action):
          // liberamos y marcamos failed para que el usuario reintente.
          console.error(`[pulse] PI ${pi.id} en estado ${pi.status} — failed`);
          try { await stripe.paymentIntents.cancel(pi.id); } catch { /* best-effort */ }
          await markPledge(p.pledge_id, 'failed', pi.id);
          failed++; anyFailedThisRound = true;
        }
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string; payment_intent?: { id?: string } };
        console.error(`[pulse] hold falló para pledge ${p.pledge_id}:`, e?.code, e?.message);
        await markPledge(p.pledge_id, 'failed', e?.payment_intent?.id);
        failed++; anyFailedThisRound = true;
      }
    }

    // Si nadie falló, el disparo fue completo: no hay nada más que evaluar.
    if (!anyFailedThisRound) break;
  }

  return { fired, converted, failed };
}

/** Marca como expirados los pledges vivos de grupos que ya no están abiertos. */
export async function expireDeadPledges(): Promise<number> {
  // Dos pasos (supabase-js no soporta subqueries en filtros)
  const { data: openGroups, error: gErr } = await supabaseAdmin
    .from('groups')
    .select('id')
    .eq('status', 'open');
  if (gErr) {
    console.error('[pulse] expireDeadPledges (groups) error:', gErr.message);
    return 0;
  }
  const openIds = (openGroups ?? []).map((g) => g.id);
  let q = supabaseAdmin
    .from('pulse_pledges')
    .update({ status: 'expired' })
    .in('status', ['watching', 'accepted']);
  if (openIds.length > 0) {
    q = q.not('group_id', 'in', `(${openIds.join(',')})`);
  }
  const { data, error } = await q.select('id');
  if (error) {
    console.error('[pulse] expireDeadPledges error:', error.message);
    return 0;
  }
  return data?.length ?? 0;
}
