// src/app/api/cron/pulse/route.ts — VONDA PULSE (G2)
// Cron de respaldo: re-evalúa la masa crítica de todos los grupos abiertos
// (por si un disparo quedó a medias por un fallo transitorio) y expira los
// pledges de grupos ya cerrados. El disparo real casi siempre ocurre inline
// en /api/pulse/accept/complete; esto es la red de seguridad.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { runPulseTrigger, expireDeadPledges } from '@/lib/pulse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // Solo grupos abiertos CON pledges aceptados vivos (evita trabajo inútil)
  const { data: candidates, error } = await supabaseAdmin
    .from('pulse_pledges')
    .select('group_id')
    .eq('status', 'accepted');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const groupIds = Array.from(new Set((candidates ?? []).map((c) => c.group_id)));
  for (const gid of groupIds) {
    try {
      results[gid] = await runPulseTrigger(gid);
    } catch (err: unknown) {
      const e = err as { message?: string };
      results[gid] = { error: e?.message };
    }
  }

  const expired = await expireDeadPledges();

  return NextResponse.json({ checked: groupIds.length, expired, results });
}
