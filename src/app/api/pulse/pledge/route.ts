// src/app/api/pulse/pledge/route.ts — GROPO PULSE (G2)
// POST: crear/actualizar pledge 'watching' ("Esperar en este precio").
// DELETE: cancelar el pledge vivo.
// Requiere sesión (magic link). La validación de negocio vive en SQL.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/lib/supabase-server';
import { notifyReachableWatchers } from '@/lib/pulse-notify';

export const runtime = 'nodejs';

async function getAuthUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Inicia sesión para usar el Pulse' }, { status: 401 });
    }

    const body = await req.json();
    const { group_id, quantity, tier_price } = body ?? {};
    if (!group_id || !tier_price) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc('pulse_pledge_upsert', {
      p_auth_id: user.id,
      p_group_id: group_id,
      p_quantity: Number(quantity) || 1,
      p_tier_price: Number(tier_price),
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Aviso "ya sois suficientes" (no-fatal, best-effort): esta espera puede
    // completar la masa de su tramo — para ella misma y para otros watchers.
    await notifyReachableWatchers(group_id);

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error('[pulse/pledge] error', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
    }
    const body = await req.json();
    const { group_id } = body ?? {};
    if (!group_id) {
      return NextResponse.json({ error: 'Falta group_id' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin.rpc('pulse_pledge_cancel', {
      p_auth_id: user.id,
      p_group_id: group_id,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error('[pulse/pledge] DELETE error', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
