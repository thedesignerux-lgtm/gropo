// app/api/join/create-intent/route.ts
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe, idempotencyKeyFor } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    // Rate limiting por IP (fail-open: un fallo del limitador nunca bloquea compras)
    const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
    const { data: allowed, error: rlError } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: `create-intent:${ip}`,
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

    const body = await req.json();
    const { group_id, quantity, name, email, phone, shipping, join_mode, target_price } = body ?? {};

    // Validación de forma (la de negocio vive en SQL)
    if (!group_id || !quantity || !name || !email || !phone || !shipping) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 });
    }

    // 1) Validar + obtener precio garantizado (reusa las reglas de join_group)
    const { data: prep, error: prepError } = await supabaseAdmin.rpc('prepare_join', {
      p_group_id: group_id,
      p_phone: phone,
      p_quantity: quantity,
    });
    if (prepError) {
      // Los RAISE EXCEPTION de Postgres llegan como mensaje legible para el usuario
      return NextResponse.json({ error: prepError.message }, { status: 400 });
    }

    const guaranteedPrice = Number(prep.guaranteed_price);
    const normalizedPhone = prep.phone as string;
    // Importe a retener. Por defecto = precio proyectado × qty (comprador "ahora").
    // Para esperadores = target × qty, validando que el target sea un salto REAL
    // de la ESCALERA FUSIONADA (G6: multi-puja — el comprador apunta a la curva
    // pública, no a los tramos de una puja concreta; server-authoritative,
    // nunca confiar en el front).
    let holdPrice = guaranteedPrice;
    if (join_mode === 'esperar') {
      if (target_price == null) {
        return NextResponse.json(
          { error: 'Falta el precio objetivo' },
          { status: 400 },
        );
      }
      const { data: ladder, error: ladderError } = await supabaseAdmin.rpc('tier_demand', {
        p_group_id: group_id,
      });
      if (ladderError || !Array.isArray(ladder) || ladder.length === 0) {
        return NextResponse.json(
          { error: 'No se pudo validar el precio objetivo' },
          { status: 400 },
        );
      }
      const tierPrices = (ladder as any[]).map((t: any) => Number(t.price));
      const target = Number(target_price);
      if (!tierPrices.includes(target)) {
        return NextResponse.json(
          { error: 'El precio objetivo no es válido' },
          { status: 400 },
        );
      }
      holdPrice = target;
    }
    const amountCents = Math.round(holdPrice * quantity * 100);

    // 2) Customer reutilizable para 1-Click (Gate A2) — degradación elegante en
    //    3 capas: ningún fallo de sesión/BD bloquea la compra. Como mucho, esta
    //    transacción cae a un Customer desechable (comportamiento pre-A2).
    let customerId: string | null = null;
    let authUserId: string | null = null;

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        authUserId = user.id;
        const { data: profile } = await supabaseAdmin
          .from('users')
          .select('stripe_customer_id')
          .eq('auth_id', user.id)
          .maybeSingle();
        if (profile?.stripe_customer_id) customerId = profile.stripe_customer_id; // reutilizar
      }
    } catch (err: any) {
      // Capa 1: sesión/BD no disponible → seguimos como invitado, sin bloquear.
      console.error('[create-intent] auth/customer lookup falló, degrado a invitado:', err?.message);
    }

    if (!customerId) {
      // P0-04 · El Customer TAMBIEN debe ser idempotente. Sin esto, un invitado
      // creaba uno nuevo en cada intento, `piParams.customer` cambiaba, y la
      // clave del PaymentIntent chocaba con sus propios parametros.
      const custParams = { name, email, phone: normalizedPhone };
      const customer = await stripe.customers.create(
        custParams,
        { idempotencyKey: idempotencyKeyFor('cust', custParams) },
      );
      customerId = customer.id;
      // Capa 2: persistir best-effort SOLO si autenticado; un fallo aquí no rompe
      // la compra (la tarjeta se guarda igual en el Customer de Stripe).
      if (authUserId) {
        try {
          await supabaseAdmin
            .from('users')
            .update({ stripe_customer_id: customerId })
            .eq('auth_id', authUserId);
        } catch (err: any) {
          console.error('[create-intent] no se pudo guardar stripe_customer_id (no crítico):', err?.message);
        }
      }
    }

    // 3) El HOLD: autorizar (no cobrar) el precio garantizado × cantidad.
    //    capture_method 'manual' = retención; se captura al cierre del domingo.
    //    setup_future_usage 'on_session': guardamos la tarjeta para el próximo
    //    checkout con el usuario presente (1-Click), optimizando SCA. DEBE
    //    coincidir con el valor que inicializa <Elements> en el cliente
    //    (JoinFlow), o Stripe rechaza la confirmación en modo diferido.
    //    La REUTILIZACIÓN 1-Click sigue siendo solo para autenticados: depende
    //    de persistir el Customer (authUserId), no de este flag.
    const piParams: Stripe.PaymentIntentCreateParams = {
      amount: amountCents,
      currency: 'eur',
      capture_method: 'manual',
      customer: customerId,
      setup_future_usage: 'on_session',
      payment_method_types: ['card'],
      description: `Gropo · ${prep.product_name} (${prep.product_spec}) x${quantity}`,
      shipping: {
        name: shipping.name,
        phone: shipping.phone ?? normalizedPhone,
        address: {
          line1: shipping.line1,
          line2: shipping.line2 || undefined,
          city: shipping.city,
          state: shipping.province || undefined,
          postal_code: shipping.postal_code,
          country: 'ES',
        },
      },
      // Todo lo necesario para crear al miembro viaja AQUÍ.
      // El webhook (Fase B) lo lee y recién entonces inserta el miembro.
      metadata: {
        group_id,
        quantity: String(quantity),
        buyer_name: name,
        buyer_email: email,
        buyer_phone: normalizedPhone,
        guaranteed_price: String(guaranteedPrice),
        join_mode: join_mode || 'comprar',
        ...(target_price != null ? { target_price: String(target_price) } : {}),
      },
    };

    // P0-04 · Un doble submit (o un reintento de red) debe devolver el MISMO
    // PaymentIntent, no crear un segundo hold sobre la misma tarjeta.
    // Capa 3: si el Customer reutilizado ya no existe en Stripe (cuenta borrada /
    // token caducado), lo atrapamos y salvamos la compra con uno fresco.
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create(
        piParams,
        { idempotencyKey: idempotencyKeyFor('join', piParams) },
      );
    } catch (err: any) {
      if (err?.code === 'resource_missing' && authUserId) {
        const freshParams = { name, email, phone: normalizedPhone };
        const fresh = await stripe.customers.create(
          freshParams,
          { idempotencyKey: idempotencyKeyFor('cust-fresh', freshParams) },
        );
        try {
          await supabaseAdmin.from('users').update({ stripe_customer_id: fresh.id }).eq('auth_id', authUserId);
        } catch { /* best-effort */ }
        // El customer cambia => el hash cambia solo. No hace falta sufijo manual.
        const retryParams = { ...piParams, customer: fresh.id };
        paymentIntent = await stripe.paymentIntents.create(
          retryParams,
          { idempotencyKey: idempotencyKeyFor('join', retryParams) },
        );
      } else {
        throw err;
      }
    }

    // Solo el clientSecret: la mecánica bancaria (importe retenido / límite de
    // autorización) NUNCA viaja al front. El precio de producto lo calcula el
    // front desde el quote.
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err: any) {
    console.error('[create-intent] error', err);
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 });
  }
}
