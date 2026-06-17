
// src/app/api/group/[id]/quote/route.ts
// Cotización en vivo para el selector de cantidad.
// Usa compute_price(group_id, extra_units) — la MISMA lógica que el cierre.
// No replicamos la matemática de tramos en el cliente.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
 
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const units = Math.max(1, Math.min(10, Number(searchParams.get('units') ?? 1)));
 
  const { data, error } = await supabaseAdmin.rpc('compute_price', {
    p_group_id: params.id,
    p_extra_units: units,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
 
  // compute_price RETURNS TABLE → llega como array de filas
  const row = Array.isArray(data) ? data[0] : data;
 
  return NextResponse.json({
    // precio por unidad SI el grupo cerrara ahora con tus unidades dentro
    pricePerUnit: row ? Number(row.best_price) : null,
    // precio si entrara 1 unidad más (para el "faltan N para bajar a Y€")
    nextPrice: row?.next_price != null ? Number(row.next_price) : null,
  });
}
 
