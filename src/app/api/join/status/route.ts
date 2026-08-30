// src/app/api/join/status/route.ts
// ¿Existe ya la membresía de este PaymentIntent? El hold lo autoriza Stripe en
// el momento, pero la fila la crea el WEBHOOK después. El modal consulta aquí
// antes de cantar "¡Precio asegurado!" — sin esto mentía: se ponía verde
// aunque confirm_join acabara liberando el hold.
// Devuelve solo un boolean; los PI ids no son adivinables.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const pi = new URL(req.url).searchParams.get('pi');
  if (!pi || !pi.startsWith('pi_') || pi.length > 100) {
    return NextResponse.json({ joined: false });
  }
  const { data, error } = await supabaseAdmin
    .from('group_members')
    .select('id')
    .eq('stripe_payment_intent_id', pi)
    .maybeSingle();
  if (error) return NextResponse.json({ joined: false });
  return NextResponse.json({ joined: !!data });
}
