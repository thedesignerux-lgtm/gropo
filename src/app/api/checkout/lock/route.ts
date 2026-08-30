// src/app/api/checkout/lock/route.ts
// Gate A3.money ⚡ · Bloqueo 1-Click con la tarjeta guardada por defecto.
// Es create-intent (A2) + confirmación server-side con el PaymentMethod por
// defecto del Customer, en UNA llamada. SOLO usuarios autenticados con tarjeta
// y dirección ya guardadas (el resto cae a create-intent + PaymentElement).
//
// Igual que create-intent: el HOLD es manual-capture; el webhook
// (amount_capturable_updated) crea el miembro leyendo la metadata. Mismos campos.
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    // 0) Rate limit por IP (fail-open, igual que create-intent).
    const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
    const { data: allowed, error: rlError } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: `checkout-lock:${ip}`, p_max: 10, p_window_seconds: 600,
    });
    if (!rlError && allowed === false) {
      return NextResponse.json({ error: 'Demasiados intentos. Espera unos minutos.' }, { status: 429 });
    }

    // 1) Sesión obligatoria. Sin usuario → el cliente usa la ruta con PaymentElement.
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

    const body = await req.json();
    const { group_id, quantity, join_mode, target_price } = body ?? {};
    if (!group_id || !quantity) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 });
    }

    // 2) Perfil + Customer + identidad.
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id, name, email, phone, stripe_customer_id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!profile?.stripe_customer_id) {
      // Sin Customer persistido aún → no hay tarjeta guardada; usar PaymentElement.
      return NextResponse.json({ error: 'no_saved_card' }, { status: 400 });
    }
    const customerId = profile.stripe_customer_id;

    // 3) Validación de negocio + precio garantizado (idéntico a create-intent).
    //    Ruta 1-Click = comprar o esperar (ambos modos soportados).
    const { data: prep, error: prepError } = await supabaseAdmin.rpc('prepare_join', {
      p_group_id: group_id,
      p_phone: profile.phone ?? '',
      p_quantity: quantity,
    });
    if (prepError) return NextResponse.json({ error: prepError.message }, { status: 400 });

    let holdPrice = Number(prep.guaranteed_price);
    const normalizedPhone = (prep.phone as string) ?? profile.phone ?? '';

    // Esperar mode: hold at target price (validated against tier ladder)
    if (join_mode === 'esperar') {
      if (target_price == null) {
        return NextResponse.json({ error: 'Falta el precio objetivo' }, { status: 400 });
      }
      const { data: ladder, error: ladderError } = await supabaseAdmin.rpc('tier_demand', {
        p_group_id: group_id,
      });
      if (ladderError || !Array.isArray(ladder) || ladder.length === 0) {
        return NextResponse.json({ error: 'No se pudo validar el precio objetivo' }, { status: 400 });
      }
      const tierPrices = (ladder as any[]).map((t: any) => Number(t.price));
      const target = Number(target_price);
      if (!tierPrices.includes(target)) {
        return NextResponse.json({ error: 'El precio objetivo no es válido' }, { status: 400 });
      }
      holdPrice = target;
    }
    const amountCents = Math.round(holdPrice * quantity * 100);

    // 4) PaymentMethod por defecto del Customer.
    let pmId: string | null = null;
    try {
      const customer = await stripe.customers.retrieve(customerId, {
        expand: ['invoice_settings.default_payment_method'],
      });
      const def =
        typeof customer !== 'string' && !('deleted' in customer)
          ? (customer.invoice_settings?.default_payment_method as any)
          : null;
      if (def && typeof def !== 'string') pmId = def.id;
      if (!pmId) {
        const list = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 });
        pmId = list.data[0]?.id ?? null;
      }
    } catch {
      pmId = null;
    }
    if (!pmId) return NextResponse.json({ error: 'no_saved_card' }, { status: 400 });

    // 5) Último envío conocido (de group_members). Sin dirección → pedirla.
    const { data: lastMember } = await supabaseAdmin
      .from('group_members')
      .select('shipping_name, shipping_phone, shipping_address_line1, shipping_address_line2, shipping_city, shipping_province, shipping_postal_code, shipping_country')
      .eq('user_id', profile.id)
      .not('shipping_address_line1', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastMember?.shipping_address_line1) {
      return NextResponse.json({ error: 'no_shipping' }, { status: 400 });
    }

    // 6) Crear + CONFIRMAR el hold con la tarjeta guardada. on-session (usuario
    //    presente). Manual capture = retención; se captura al cierre del domingo.
    const piParams: Stripe.PaymentIntentCreateParams = {
      amount: amountCents,
      currency: 'eur',
      capture_method: 'manual',
      customer: customerId,
      payment_method: pmId,
      confirm: true,
      off_session: false,
      setup_future_usage: 'on_session',
      payment_method_types: ['card'],
      description: `Gropo · ${prep.product_name} (${prep.product_spec}) x${quantity}`,
      shipping: {
        name: lastMember.shipping_name ?? profile.name ?? '',
        phone: lastMember.shipping_phone ?? normalizedPhone,
        address: {
          line1: lastMember.shipping_address_line1,
          line2: lastMember.shipping_address_line2 || undefined,
          city: lastMember.shipping_city ?? undefined,
          state: lastMember.shipping_province || undefined,
          postal_code: lastMember.shipping_postal_code ?? undefined,
          country: lastMember.shipping_country ?? 'ES',
        },
      },
      // Mismos campos que create-intent → el webhook crea el miembro igual.
      metadata: {
        group_id,
        quantity: String(quantity),
        buyer_name: profile.name ?? lastMember.shipping_name ?? '',
        buyer_email: profile.email ?? user.email ?? '',
        buyer_phone: normalizedPhone,
        guaranteed_price: String(holdPrice),
        join_mode: join_mode || 'comprar',
        ...(target_price != null ? { target_price: String(target_price) } : {}),
      },
    };

    let pi: Stripe.PaymentIntent;
    try {
      pi = await stripe.paymentIntents.create(piParams);
    } catch (err: any) {
      // Tarjeta rechazada / caducada → el cliente reabre el acordeón y pide otra.
      if (err?.type === 'StripeCardError') {
        const msg =
          err.code === 'expired_card'
            ? 'Tu tarjeta ha caducado. Actualízala para asegurar la plaza.'
            : 'Tu banco ha declinado la operación. Prueba con otra tarjeta.';
        return NextResponse.json({ error: msg, code: err.code ?? 'card_error' }, { status: 400 });
      }
      throw err;
    }

    // 7) 3DS: si el banco pide autenticación, devolvemos el client_secret para que
    //    el cliente resuelva el reto con stripe.handleNextAction (sin salir del modal).
    if (pi.status === 'requires_action') {
      return NextResponse.json({ requires_action: true, clientSecret: pi.client_secret, pi_id: pi.id });
    }

    // 8) Hold colocado (manual capture → requires_capture). El webhook hará el resto.
    if (pi.status === 'requires_capture') {
      return NextResponse.json({ status: 'ok', pi_id: pi.id });
    }

    // Estado inesperado.
    return NextResponse.json({ error: 'No se pudo asegurar el pago. Inténtalo de nuevo.' }, { status: 400 });
  } catch (err: any) {
    console.error('[checkout/lock] error', err);
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 });
  }
}
