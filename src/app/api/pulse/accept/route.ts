// src/app/api/pulse/accept/route.ts — VONDA PULSE (G2)
// POST: inicia la aceptación ("Aceptar este precio").
// Crea un SetupIntent (0 € — SOLO guarda la tarjeta para uso off-session).
// La retención real solo ocurre cuando la masa crítica se alcanza (lib/pulse.ts).

import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    // Rate limiting por IP (mismo patrón fail-open que create-intent)
    const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
    const { data: allowed, error: rlError } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: `pulse-accept:${ip}`,
      p_max: 10,
      p_window_seconds: 600,
    });
    if (rlError) {
      console.error('rate_limit_check_failed', rlError);
    } else if (allowed === false) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.' },
        { status: 429 },
      );
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Inicia sesión para aceptar el precio' }, { status: 401 });
    }

    const body = await req.json();
    const { group_id } = body ?? {};
    if (!group_id) {
      return NextResponse.json({ error: 'Falta group_id' }, { status: 400 });
    }

    // Debe existir un pledge vivo del usuario en este grupo
    const { data: pledge } = await supabaseAdmin
      .from('pulse_pledges')
      .select('id, status')
      .eq('group_id', group_id)
      .eq('auth_id', user.id)
      .in('status', ['watching', 'accepted'])
      .maybeSingle();
    if (!pledge) {
      return NextResponse.json(
        { error: 'Primero elige el precio en el que quieres esperar' },
        { status: 400 },
      );
    }

    // Customer reutilizable (mismo patrón Gate A2 que create-intent)
    let customerId: string | null = null;
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id, email, name, phone')
      .eq('auth_id', user.id)
      .maybeSingle();
    if (profile?.stripe_customer_id) customerId = profile.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? profile?.email ?? undefined,
        name: profile?.name ?? undefined,
        phone: profile?.phone ?? undefined,
      });
      customerId = customer.id;
      try {
        await supabaseAdmin
          .from('users')
          .update({ stripe_customer_id: customerId })
          .eq('auth_id', user.id);
      } catch { /* best-effort */ }
    }

    // SetupIntent: tarjeta guardada para cobro futuro SIN el usuario presente.
    // usage 'off_session' es imprescindible para que el disparo automático funcione.
    let setupIntent;
    const siParams = {
      customer: customerId,
      usage: 'off_session' as const,
      payment_method_types: ['card'],
      metadata: { group_id, auth_id: user.id, pulse_pledge_id: pledge.id },
    };
    try {
      setupIntent = await stripe.setupIntents.create(siParams);
    } catch (err: unknown) {
      const e = err as { code?: string };
      // Customer huérfano en Stripe → uno fresco (capa 3 de create-intent)
      if (e?.code === 'resource_missing') {
        const fresh = await stripe.customers.create({ email: user.email ?? undefined });
        try {
          await supabaseAdmin.from('users').update({ stripe_customer_id: fresh.id }).eq('auth_id', user.id);
        } catch { /* best-effort */ }
        setupIntent = await stripe.setupIntents.create({ ...siParams, customer: fresh.id });
        customerId = fresh.id;
      } else {
        throw err;
      }
    }

    // Persistimos el vínculo ya (el complete lo verificará contra Stripe)
    await supabaseAdmin
      .from('pulse_pledges')
      .update({ stripe_setup_intent_id: setupIntent.id, stripe_customer_id: customerId })
      .eq('id', pledge.id);

    return NextResponse.json({ clientSecret: setupIntent.client_secret });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error('[pulse/accept] error', err);
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 });
  }
}
