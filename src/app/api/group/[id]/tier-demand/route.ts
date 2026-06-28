import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabaseAdmin.rpc('tier_demand', {
    p_group_id: params.id,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  // tier_demand RETURNS TABLE → array de filas, ordenado por precio DESC
  const tiers = (Array.isArray(data) ? data : []).map((r: any) => ({
    minUnits: Number(r.min_units),
    price: Number(r.price),
    demand: Number(r.effective_demand),
    unlocked: Boolean(r.unlocked),
  }));
  return NextResponse.json({ tiers });
}
