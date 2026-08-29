// src/app/api/cron/pulse/route.ts — GROPO PULSE (G2)
// Cron de respaldo: re-evalúa la masa crítica de todos los grupos abiertos
// (por si un disparo quedó a medias por un fallo transitorio) y expira los
// pledges de grupos ya cerrados. El disparo real casi siempre ocurre inline
// en /api/pulse/accept/complete; esto es la red de seguridad.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { runPulseTrigger, expireDeadPledges } from '@/lib/pulse';
import { notifyReachableWatchers } from '@/lib/pulse-notify';

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

  // Red de seguridad del aviso "ya sois suficientes": re-evalúa los grupos con
  // esperas vivas (dedup en BD → jamás avisa dos veces del mismo tramo).
  let notified = 0;
  const { data: watchers } = await supabaseAdmin
    .from('pulse_pledges')
    .select('group_id')
    .eq('status', 'watching');
  const watchIds = Array.from(new Set((watchers ?? []).map((w) => w.group_id)));
  for (const gid of watchIds) {
    notified += await notifyReachableWatchers(gid);
  }

  return NextResponse.json({ checked: groupIds.length, expired, notified, results });
}
