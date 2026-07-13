// src/app/api/pulse/accept/complete/route.ts — VONDA PULSE (G2)
// POST: cierra la aceptación tras confirmar el SetupIntent en el cliente.
// Server-authoritative: verifica el SetupIntent CONTRA STRIPE (nunca confía
// en el front), guarda tarjeta + datos de contacto/envío en el pledge y
// dispara la comprobación de masa crítica.

import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/lib/supabase-server';
import { runPulseTrigger } from '@/lib/pulse';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
    }

    const body = await req.json();
    const { group_id, setup_intent_id, name, email, phone, shipping } = body ?? {};
    if (!group_id || !setup_intent_id || !name || !email || !phone || !shipping?.line1) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 });
    }

    // Pledge vivo del usuario
    const { data: pledge } = await supabaseAdmin
      .from('pulse_pledges')
      .select('id, status, stripe_setup_intent_id')
      .eq('group_id', group_id)
      .eq('auth_id', user.id)
      .in('status', ['watching', 'accepted'])
      .maybeSingle();
    if (!pledge) {
      return NextResponse.json({ error: 'No hay ningún compromiso activo' }, { status: 400 });
    }

    // Verificación contra Stripe: el SI debe ser el nuestro, del mismo usuario,
    // y estar realmente completado con una tarjeta guardada.
    const si = await stripe.setupIntents.retrieve(setup_intent_id);
    if (
      si.status !== 'succeeded' ||
      si.metadata?.auth_id !== user.id ||
      si.metadata?.pulse_pledge_id !== pledge.id ||
      !si.payment_method
    ) {
      return NextResponse.json({ error: 'No se pudo verificar la tarjeta' }, { status: 400 });
    }

    const paymentMethodId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method.id;
    const customerId = typeof si.customer === 'string' ? si.customer : si.customer?.id ?? null;

    const { error: upError } = await supabaseAdmin
      .from('pulse_pledges')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        stripe_payment_method_id: paymentMethodId,
        stripe_customer_id: customerId,
        stripe_setup_intent_id: si.id,
        buyer_name: name,
        buyer_email: email,
        buyer_phone: phone,
        shipping: {
          name: shipping.name ?? name,
          phone: shipping.phone ?? phone,
          line1: shipping.line1,
          line2: shipping.line2 ?? null,
          city: shipping.city ?? null,
          province: shipping.province ?? null,
          postal_code: shipping.postal_code ?? null,
          country: shipping.country ?? 'ES',
        },
      })
      .eq('id', pledge.id)
      .in('status', ['watching', 'accepted']);
    if (upError) {
      return NextResponse.json({ error: upError.message }, { status: 500 });
    }

    // ¿Somos ya masa crítica? (el disparo es idempotente y está serializado en SQL)
    const result = await runPulseTrigger(group_id);

    return NextResponse.json({ accepted: true, ...result });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error('[pulse/accept/complete] error', err);
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 });
  }
}
