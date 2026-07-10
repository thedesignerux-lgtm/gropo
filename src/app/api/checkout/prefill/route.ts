// src/app/api/checkout/prefill/route.ts
// Gate A1 · Prefill READ-ONLY para el FastCheckoutModal ("Confirma tu bloqueo").
// No mueve dinero, no crea nada. Con sesión activa devuelve:
//   · último envío conocido del usuario (de group_members — sin CRUD nuevo)
//   · método de pago por defecto (last4/brand/wallet) desde su Stripe Customer
// El bloque de pago queda null hasta Gate A2 (cuando create-intent persiste y
// reutiliza el Customer con setup_future_usage). El modal debe degradar limpio.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

type PrefillShipping = {
  name: string | null;
  phone: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
};

type PrefillPayment = {
  brand: string | null;   // 'visa', 'mastercard', …
  last4: string | null;
  wallet: string | null;  // 'apple_pay', 'google_pay', 'link', o null
};

export async function GET() {
  // 1) Sesión. Sin usuario autenticado → el modal cae a captura inline (invitado).
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  // 2) Fila pública del usuario (por auth_id) → id interno + stripe_customer_id.
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, name, email, phone, stripe_customer_id')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (!profile) {
    // Autenticado pero sin fila pública todavía (magic link sin compra previa).
    return NextResponse.json({
      authenticated: true,
      shipping: null,
      payment: null,
      contact: {
        name: null,
        email: user.email ?? null,
        phone: null,
      },
    });
  }

  // 3) Último envío conocido — de la compra más reciente del usuario.
  let shipping: PrefillShipping | null = null;
  const { data: lastMember } = await supabaseAdmin
    .from('group_members')
    .select('shipping_name, shipping_phone, shipping_address_line1, shipping_address_line2, shipping_city, shipping_province, shipping_postal_code, shipping_country, created_at')
    .eq('user_id', profile.id)
    .not('shipping_address_line1', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastMember) {
    shipping = {
      name: lastMember.shipping_name ?? profile.name ?? null,
      phone: lastMember.shipping_phone ?? profile.phone ?? null,
      line1: lastMember.shipping_address_line1 ?? null,
      line2: lastMember.shipping_address_line2 ?? null,
      city: lastMember.shipping_city ?? null,
      province: lastMember.shipping_province ?? null,
      postal_code: lastMember.shipping_postal_code ?? null,
      country: lastMember.shipping_country ?? 'ES',
    };
  }

  // 4) Método de pago por defecto desde Stripe (si ya hay Customer persistido).
  //    A1: normalmente null porque aún no persistimos Customer. Nunca romper por esto.
  let payment: PrefillPayment | null = null;
  if (profile.stripe_customer_id) {
    try {
      const customer = await stripe.customers.retrieve(profile.stripe_customer_id, {
        expand: ['invoice_settings.default_payment_method'],
      });

      let pm: any =
        typeof customer !== 'string' && !('deleted' in customer)
          ? (customer.invoice_settings?.default_payment_method as any)
          : null;

      // Fallback: primera tarjeta guardada si no hay default explícito.
      if (!pm || typeof pm === 'string') {
        const list = await stripe.paymentMethods.list({
          customer: profile.stripe_customer_id,
          type: 'card',
          limit: 1,
        });
        pm = list.data[0] ?? null;
      }

      if (pm && pm.card) {
        payment = {
          brand: pm.card.brand ?? null,
          last4: pm.card.last4 ?? null,
          wallet: pm.card.wallet?.type ?? null,
        };
      }
    } catch (err) {
      // Token caducado / customer borrado → tratamos como "sin pago guardado".
      console.error('[prefill] stripe payment lookup failed:', (err as any)?.message);
      payment = null;
    }
  }

  return NextResponse.json({
    authenticated: true,
    shipping,
    payment,
    contact: {
      name: profile.name ?? null,
      email: profile.email ?? user.email ?? null,
      phone: profile.phone ?? null,
    },
  });
}
