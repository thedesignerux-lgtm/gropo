// src/app/api/group/[id]/pulse/route.ts — GROPO PULSE (G3)
// Superficie PÚBLICA del Pulse: intensidad agregada por salto de la escalera
// fusionada. NUNCA viajan al cliente: conteos exactos, identidades, pujas.
// (Decisión P3: solo niveles discretos 0–3 + flag de surge.)
//
// Si hay sesión, añade el pledge propio del usuario (mine) para el CTA de G5.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PulseStateRow {
  min_units: number;
  price: number;
  committed: number;
  unlocked: boolean;
  accepted_units: number;
  watching_units: number;
  marked_units: number;
  latent_units: number;
  fireable: boolean;
}

function intensityBucket(latent: number): 0 | 1 | 2 | 3 {
  if (latent <= 0) return 0;
  if (latent <= 2) return 1;
  if (latent <= 5) return 2;
  return 3;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const groupId = params.id;
    const { data, error } = await supabaseAdmin.rpc('pulse_state', { p_group_id: groupId });
    if (error) {
      return NextResponse.json({ error: 'No disponible' }, { status: 400 });
    }
    const rows = (data ?? []) as PulseStateRow[];

    // Caso borde: saltos con precio >= al mejor ya desbloqueado son irrelevantes
    // (nadie espera un precio peor que el vigente) → fuera de la superficie pública.
    const currentMin = Math.min(
      ...rows.filter((r) => r.unlocked).map((r) => Number(r.price)),
      Infinity,
    );
    const relevant = rows.filter((r) => r.unlocked || Number(r.price) < currentMin);

    const steps = relevant.map((r) => {
      const needed = Math.max(0, r.min_units - Number(r.committed));
      return {
        units: r.min_units,
        price: Number(r.price),
        reached: r.unlocked,
        // Demanda efectiva a ese precio (ya pública vía tier_demand): incluye
        // esperadores CON HOLD cuyo target alcanza este salto → morado sólido
        committed: Number(r.committed),
        // Nodo: SOLO late si alguien marcó EXACTAMENTE este tier
        marked: r.unlocked ? 0 : intensityBucket(Number(r.marked_units)),
        // Difuminado proporcional: intención marcada vs unidades que faltan
        // (cap 2 = puede SUPERAR la demanda necesaria; sin cifras exactas)
        markedFraction: r.unlocked || needed === 0
          ? 0
          : Math.min(2, Number(r.marked_units) / needed),
        // Morado (dinero real): hay tarjetas aceptadas empujando hacia este salto
        surge: !r.unlocked && Number(r.accepted_units) > 0,
        // Relleno inverso: fracción del hueco cubierta por aceptaciones (0..1, sin cifras)
        acceptedFraction:
          r.unlocked || needed === 0
            ? 0
            : Math.min(1, Number(r.accepted_units) / needed),
        // "Alcanzable": comprometidos + aceptados + esperas llegarían al salto → gatea el CTA
        reachable:
          !r.unlocked &&
          Number(r.committed) + Number(r.accepted_units) + Number(r.watching_units) >= r.min_units,
      };
    });

    // Glow de grupo (naranja suave): observadores totales — favoritos + esperas,
    // medido en el salto más barato (donde todos cuentan). Solo intensidad, sin cifras.
    const cheapest = relevant.filter((r) => !r.unlocked).sort((a, b) => Number(a.price) - Number(b.price))[0];
    const glow = cheapest ? intensityBucket(Number(cheapest.latent_units)) : 0;

    // Pledge propio (solo con sesión; RLS-equivalente: filtramos por auth_id)
    let mine: { tier_price: number; quantity: number; status: string } | null = null;
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: pledge } = await supabaseAdmin
          .from('pulse_pledges')
          .select('tier_price, quantity, status')
          .eq('group_id', groupId)
          .eq('auth_id', user.id)
          .in('status', ['watching', 'accepted', 'holding', 'converted', 'failed'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (pledge) {
          mine = {
            tier_price: Number(pledge.tier_price),
            quantity: pledge.quantity,
            status: pledge.status,
          };
        }
      }
    } catch { /* sin sesión: mine = null */ }

    return NextResponse.json(
      { steps, glow, mine },
      { headers: { 'Cache-Control': 'private, max-age=10' } },
    );
  } catch (err: unknown) {
    console.error('[group/pulse] error', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
