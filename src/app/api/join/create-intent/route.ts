// app/api/join/create-intent/route.ts
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

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

    // 2) Cliente de Stripe (historial limpio en el dashboard)
    const customer = await stripe.customers.create({
      name,
      email,
      phone: normalizedPhone,
    });

    // 3) El HOLD: autorizar (no cobrar) el precio garantizado × cantidad.
    //    capture_method 'manual' = retención; se captura al cierre del domingo.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'eur',
      capture_method: 'manual',
      customer: customer.id,
      payment_method_types: ['card'],
      description: `Vonda · ${prep.product_name} (${prep.product_spec}) x${quantity}`,
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
    });

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
