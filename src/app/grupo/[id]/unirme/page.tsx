import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import JoinFlow, { type JoinGroup } from './JoinFlow'

export const dynamic = 'force-dynamic'

// Carga la vonda: tabla groups + compute_price (única fuente de verdad de precio)
// → best_bid_id → bids para los tramos y el stock. El precio por unidad reactivo
// lo calcula JoinFlow desde el quote; aquí solo se entregan los datos base.
async function fetchVonda(id: string): Promise<JoinGroup | null> {
  const { data: g, error } = await supabase
    .from('groups')
    .select('id, product_name, product_spec, pvp, image_url, total_units, current_price, closes_at')
    .eq('id', id)
    .single()
  if (error || !g) return null

  const { data: cp } = await supabase.rpc('compute_price', { p_group_id: id })
  const row = (Array.isArray(cp) ? cp[0] : cp) as
    | { best_price?: number; best_bid_id?: string }
    | null
  const currentPrice = row?.best_price != null ? Number(row.best_price) : Number(g.current_price)
  const bestBidId = row?.best_bid_id ?? null

  let tiers: { minUnits: number; price: number }[] = []
  let maxStock = 0
  let minExecution = 0

  if (bestBidId) {
    const { data: bid } = await supabase
      .from('bids')
      .select('tiers, max_stock, min_execution')
      .eq('id', bestBidId)
      .single()
    if (bid) {
      tiers = ((bid as any).tiers ?? []).map((t: any) => ({
        minUnits: Number(t.min_units),
        price: Number(t.price),
      }))
      maxStock = Number((bid as any).max_stock ?? 0)
      minExecution = Number((bid as any).min_execution ?? 0)
    }
  }

  return {
    id: g.id as string,
    product_name: g.product_name as string,
    product_spec: ((g as any).product_spec ?? '') as string,
    pvp: Number((g as any).pvp ?? 0),
    current_price: currentPrice,
    image_url: ((g as any).image_url as string | null) ?? null,
    total_units: Number(g.total_units ?? 0),
    closes_at: g.closes_at as string,
    max_stock: maxStock,
    min_execution: minExecution,
    tiers,
  }
}

export default async function UnirmePage({ params }: { params: { id: string } }) {
  const v = await fetchVonda(params.id)

  if (!v) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-base text-neutral-400">Vonda no encontrada</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto min-h-screen max-w-md bg-white pb-28">

        {/* ── CABECERA: marca + pago seguro 3D Secure ── */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-neutral-100 bg-white/95 px-4 backdrop-blur">
          <Link
            href={`/grupo/${v.id}`}
            aria-label="Volver a la vonda"
            className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <span className="text-base font-bold tracking-tight text-brand">Vonda</span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Pago seguro · 3D Secure
          </span>
        </header>

        <JoinFlow group={v} />
      </div>
    </div>
  )
}
