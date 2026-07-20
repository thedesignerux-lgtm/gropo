// src/app/api/stripe/webhook/route.ts
// Webhook de Stripe (Fase B). Cuando el hold se autoriza, crea el miembro.
//
// Verificado:
//  · Verifica la FIRMA con STRIPE_WEBHOOK_SECRET (rechaza eventos falsos).
//  · Escucha 'payment_intent.amount_capturable_updated' = hold confirmado
//    (captura manual → requires_capture). NO 'payment_intent.succeeded'.
//  · Idempotencia: la maneja confirm_join (mismo PI → no duplica).
//  · Si confirm_join pide needs_release (sin stock / duplicado / cerrado),
//    cancela el PaymentIntent → libera el hold, cero cargo.

import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { Resend } from 'resend';
import { joinConfirmationEmail } from '@/lib/emails/joinConfirmation';
import { runPulseTrigger } from '@/lib/pulse';
import { notifyReachableWatchers } from '@/lib/pulse-notify';

// Instanciación perezosa: NO crear el cliente al importar el módulo (rompe `next build`
// en "collecting page data" si falta la key). Se crea en runtime, al enviar el email.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
const FROM = process.env.RESEND_FROM ?? 'Vonda <no-reply@vonda.es>';

// El SDK de Stripe necesita Node, no Edge.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.text(); // cuerpo CRUDO, imprescindible para la firma
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: 'Falta firma o STRIPE_WEBHOOK_SECRET' }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err: any) {
    console.error('[webhook] firma inválida:', err?.message);
    return NextResponse.json({ error: `Firma inválida: ${err?.message}` }, { status: 400 });
  }

  if (event.type === 'payment_intent.amount_capturable_updated') {
    const pi = event.data.object as any;
    const m = pi.metadata ?? {};
    const ship = pi.shipping ?? {};
    const addr = ship.address ?? {};

    // Guard: solo procesamos PIs nacidos de nuestro checkout (llevan group_id en metadata).
    // Un PI ajeno (creado a mano en el dashboard u otro flujo) se ignora con 200
    // para que Stripe no lo reintente eternamente.
    if (!m.group_id) {
      console.log(`[webhook] PI ${pi.id} sin group_id en metadata — ignorado`);
      return NextResponse.json({ received: true });
    }

    const { data, error } = await supabaseAdmin.rpc('confirm_join', {
      p_payment_intent_id: pi.id,
      p_group_id: m.group_id,
      p_name: m.buyer_name,
      p_email: m.buyer_email,
      p_phone: m.buyer_phone,
      p_quantity: Number(m.quantity),
      p_authorized_amount: pi.amount / 100, // céntimos → EUR
      p_guaranteed_price: Number(m.guaranteed_price),
      p_join_mode: m.join_mode || 'comprar',
      p_target_price: m.target_price != null ? Number(m.target_price) : null,
      p_shipping: {
        name: ship.name ?? m.buyer_name,
        phone: ship.phone ?? m.buyer_phone,
        line1: addr.line1 ?? null,
        line2: addr.line2 ?? null,
        city: addr.city ?? null,
        province: addr.state ?? null,
        postal_code: addr.postal_code ?? null,
        country: addr.country ?? 'ES',
      },
    });

    if (error) {
      // 500 → Stripe reintentará; confirm_join es idempotente, así que es seguro.
      console.error('[webhook] confirm_join error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Carrera perdida (sin stock / duplicado / cerrado) → liberar el hold.
    if (data?.status === 'needs_release') {
      try {
        await stripe.paymentIntents.cancel(pi.id);
        console.log(`[webhook] hold liberado (${data.reason}) PI ${pi.id}`);
      } catch (e: any) {
        // ¿El PI ya estaba cancelado (reintento tardío / hold expirado)? Entonces es éxito.
        let yaLiberado = false;
        try {
          const fresh = await stripe.paymentIntents.retrieve(pi.id);
          yaLiberado = fresh.status === 'canceled';
        } catch {
          // Si ni siquiera podemos consultarlo, tratamos como fallo → 500 abajo.
        }
        if (yaLiberado) {
          console.log(`[webhook] PI ${pi.id} ya estaba cancelado — ok`);
        } else {
          // 500 → Stripe REINTENTARÁ el webhook con backoff durante días.
          // El reintento es seguro: confirm_join es idempotente, volverá a
          // devolver needs_release y se reintentará la cancelación.
          // Sin esto, un fallo puntual dejaría al cliente ~7 días con el
          // dinero retenido y nadie se enteraría.
          console.error('[webhook] no se pudo cancelar el PI:', e?.message);
          return NextResponse.json(
            { error: `No se pudo liberar el hold: ${e?.message}` },
            { status: 500 }
          );
        }
      }
      // VONDA PULSE (no-fatal): si el hold liberado nació de un pledge,
      // reflejar la realidad — el compromiso NO se convirtió.
      if (m.pulse_pledge_id) {
        try {
          await supabaseAdmin
            .from('pulse_pledges')
            .update({ status: 'failed' })
            .eq('id', m.pulse_pledge_id);
          console.log(`[webhook] pledge ${m.pulse_pledge_id} → failed (${data.reason})`);
        } catch (pErr: any) {
          console.error('[webhook] no se pudo marcar pledge failed (no-fatal):', pErr?.message);
        }
      }
    } else if (data?.status === 'confirmed') {
      console.log(`[webhook] confirmed PI ${pi.id}`);

      // Email de confirmación — no-fatal (un fallo de email no revierte la unión).
      try {
        const { data: group } = await supabaseAdmin
          .from('groups')
          .select('product_name, closes_at')
          .eq('id', m.group_id)
          .single();

        if (group) {
          const emailData = joinConfirmationEmail({
            nombre: m.buyer_name,
            productName: group.product_name,
            currentPrice: data.new_price,
            closesAt: group.closes_at,
          });

          await getResend().emails.send({
            from: FROM,
            to: m.buyer_email,
            subject: emailData.subject,
            text: emailData.text,
            html: emailData.html,
          });
          console.log(`[webhook] email de confirmación enviado a ${m.buyer_email}`);
        }
      } catch (emailErr: any) {
        console.error('[webhook] email de confirmación falló (no-fatal):', emailErr?.message);
      }

      // VONDA PULSE (no-fatal): una compra confirmada acerca la masa crítica.
      // Solo re-evalúa si NO es una conversión del propio Pulse (esas ya pasaron
      // por el disparador) — evita recursión webhook→trigger→PI→webhook.
      if (!m.pulse_pledge_id) {
        try {
          await runPulseTrigger(m.group_id);
        } catch (pulseErr: any) {
          console.error('[webhook] pulse trigger falló (no-fatal):', pulseErr?.message);
        }
      }

      // Aviso "ya sois suficientes" (no-fatal): la compra confirmada puede hacer
      // alcanzable un tramo que alguien espera en su Radar.
      try {
        await notifyReachableWatchers(m.group_id);
      } catch (nErr: any) {
        console.error('[webhook] pulse notify falló (no-fatal):', nErr?.message);
      }
    } else {
      console.log(`[webhook] ${data?.status} PI ${pi.id}`);
    }
  }

  // Siempre 200 rápido para los eventos que no procesamos.
  return NextResponse.json({ received: true });
}
