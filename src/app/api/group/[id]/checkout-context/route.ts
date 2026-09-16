// src/app/api/group/[id]/checkout-context/route.ts
// Da al FastCheckoutModal lo que necesita para dejar elegir unidades y tramo de
// precio SIN salir del modal (Benjamin, 16-sep-2026): la escalera de tramos, el
// stock real y el precio vigente. Misma fuente que `/grupo/[id]/unirme` — no se
// reinventa el cálculo de stock ni de tramos en el cliente.
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const groupId = params.id

  const { data: cp } = await supabaseAdmin.rpc('compute_price', { p_group_id: groupId })
  const row = (Array.isArray(cp) ? cp[0] : cp) as { best_price?: number; best_bid_id?: string } | null
  const bestBidId = row?.best_bid_id ?? null
  const currentPrice = row?.best_price != null ? Number(row.best_price) : 0

  const { data: ladder } = await supabaseAdmin.rpc('tier_demand', { p_group_id: groupId })
  const tiers = (Array.isArray(ladder) ? ladder : []).map((t: any) => ({
    minUnits: Number(t.min_units),
    price: Number(t.price),
    demand: Number(t.effective_demand ?? 0),
  }))

  // P2-01 · unidades que YA ocupan stock — misma RPC que usa `unirme` y el
  // checkout server-side (`prepare_join`). Si falla, no mentimos con un cero
  // (eso diría "stock entero"): caemos a `total_units`, que sobreestima el
  // consumo pero nunca infla el stock disponible.
  const { data: committed, error: committedError } = await supabaseAdmin.rpc(
    'group_committed_units',
    { p_group_id: groupId },
  )
  let committedUnits: number
  if (committedError) {
    console.error('[checkout-context] group_committed_units falló, usando total_units:', committedError.message)
    const { data: g } = await supabaseAdmin.from('groups').select('total_units').eq('id', groupId).single()
    committedUnits = Number(g?.total_units ?? 0)
  } else {
    committedUnits = Number(committed ?? 0)
  }

  let maxStock = 0
  if (bestBidId) {
    const { data: bid } = await supabaseAdmin.from('bids').select('max_stock').eq('id', bestBidId).single()
    maxStock = Number((bid as any)?.max_stock ?? 0)
  }

  return NextResponse.json({ tiers, committedUnits, maxStock, currentPrice })
}
