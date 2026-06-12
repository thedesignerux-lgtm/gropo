import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getStepPricing } from '@/lib/mock-data'
import type { Tier } from '@/lib/mock-data'
import GroupCountdown from '@/components/GroupCountdown'
import JoinModal from '@/components/JoinModal'
import ShareButton from '@/components/ShareButton'
import BottomNav from '@/components/BottomNav'

export const dynamic = 'force-dynamic'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

// ─── SVG stepped price / units curve ──────────────────────────────────────────

function PriceCurve({ tiers, currentUnits }: { tiers: Tier[]; currentUnits: number }) {
  if (tiers.length < 2) return null

  const W = 300, H = 130
  const P = { t: 16, r: 20, b: 28, l: 44 }
  const cW = W - P.l - P.r
  const cH = H - P.t - P.b

  const prices = tiers.map(t => t.price)
  const maxPr = Math.max(...prices)
  const minPr = Math.min(...prices)
  const spread = maxPr - minPr || 1
  const lastU = tiers[tiers.length - 1].minUnits
  const maxU = lastU + Math.ceil(lastU * 0.25)

  const xp = (u: number) => (P.l + (u / maxU) * cW).toFixed(1)
  const yp = (p: number) => (P.t + ((maxPr - p) / spread) * cH).toFixed(1)

  // Stepped path: horizontal at each tier price, then vertical drop to next
  let d = `M ${xp(tiers[0].minUnits)} ${yp(tiers[0].price)}`
  for (let i = 0; i < tiers.length; i++) {
    const nx = i < tiers.length - 1 ? xp(tiers[i + 1].minUnits) : xp(maxU)
    d += ` H ${nx}`
    if (i < tiers.length - 1) d += ` V ${yp(tiers[i + 1].price)}`
  }

  const dotX = xp(currentUnits)
  const curPrice = tiers.reduce((p, t) => (t.minUnits <= currentUnits ? t.price : p), tiers[0].price)
  const dotY = yp(curPrice)
  const fillD = `${d} V ${(P.t + cH).toFixed(1)} H ${P.l} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true">
      {tiers.map(t => (
        <line key={t.minUnits}
          x1={P.l} y1={yp(t.price)} x2={W - P.r} y2={yp(t.price)}
          stroke="#E5E7EB" strokeWidth="1" strokeDasharray="3 3"
        />
      ))}
      <path d={fillD} fill="#0F6E56" fillOpacity="0.07" />
      <path d={d} fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={dotX} cy={dotY} r="9" fill="#0F6E56" fillOpacity="0.15" />
      <circle cx={dotX} cy={dotY} r="4.5" fill="#0F6E56" />
      <text x={P.l - 5} y={(P.t + 4).toString()} fontSize="9" fill="#9CA3AF" textAnchor="end">
        {maxPr.toFixed(0)}€
      </text>
      <text x={P.l - 5} y={(P.t + cH + 4).toString()} fontSize="9" fill="#9CA3AF" textAnchor="end">
        {minPr.toFixed(0)}€
      </text>
      <text x={dotX} y={(H - 8).toString()} fontSize="9" fill="#0F6E56" fontWeight="600" textAnchor="middle">
        {currentUnits} uds
      </text>
    </svg>
  )
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function fetchGroup(id: string) {
  const { data: group, error } = await supabase
    .from('groups')
    .select(`
      id, product_name, product_spec, pvp,
      total_units, current_price, next_price, closes_at,
      bids(tiers, price_mode)
    `)
    .eq('id', id)
    .single()

  if (error || !group) return null

  // RPC compute_price — fallback to stored columns on any error
  let bestPrice: number = Number(group.current_price)
  let nextPrice: number = Number((group as any).next_price ?? group.current_price)
  const { data: rpc } = await supabase.rpc('compute_price', { p_group_id: id })
  if (rpc && typeof rpc === 'object') {
    if ((rpc as any).best_price != null) bestPrice = Number((rpc as any).best_price)
    if ((rpc as any).next_price != null) nextPrice = Number((rpc as any).next_price)
  }

  // Count competing sellers
  const { count: bidCount } = await supabase
    .from('bids')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', id)

  // Parse JSONB tiers (DB stores snake_case min_units)
  const bid = Array.isArray(group.bids) ? group.bids[0] : null
  const tiers: Tier[] = ((bid as any)?.tiers ?? []).map((t: any) => ({
    minUnits: Number(t.min_units),
    price: Number(t.price),
  }))

  return {
    id: group.id as string,
    name: group.product_name as string,
    spec: ((group as any).product_spec ?? '') as string,
    pvp: Number((group as any).pvp ?? 0),
    totalUnits: Number(group.total_units ?? 0),
    closesAt: group.closes_at as string,
    bestPrice,
    nextPrice,
    bidCount: bidCount ?? 0,
    tiers,
  }
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function GrupoPage({ params }: { params: { id: string } }) {
  const group = await fetchGroup(params.id)

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Grupo no encontrado</p>
      </div>
    )
  }

  const savings = group.pvp > 0 ? group.pvp - group.bestPrice : 0
  const priceDrop = group.nextPrice < group.bestPrice

  const { nextTier, unitsToNext } = group.tiers.length > 0
    ? getStepPricing(group.tiers, group.totalUnits)
    : { nextTier: null, unitsToNext: 0 }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen pb-28">

        {/* Sticky back header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <span className="text-sm font-semibold text-gray-700 truncate">{group.name}</span>
        </div>

        {/* Image placeholder */}
        <div className="aspect-square w-full bg-gray-100 flex items-center justify-center">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>

        <div className="px-4 pt-5 space-y-5 pb-6">

          {/* Product name + spec */}
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{group.name}</h1>
            {group.spec && (
              <p className="text-sm text-gray-500 mt-1">{group.spec}</p>
            )}
          </div>

          {/* Price block */}
          <div className="space-y-2">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-4xl font-bold text-brand leading-none">{fmt(group.bestPrice)}</span>
              {group.pvp > 0 && (
                <span className="text-base text-gray-400 line-through">PVP {fmt(group.pvp)}</span>
              )}
            </div>
            {savings > 0.01 && (
              <span className="inline-flex items-center gap-1.5 bg-brand/10 text-brand text-xs font-semibold px-3 py-1.5 rounded-full">
                Ya ahorras {fmt(savings)} vs PVP
              </span>
            )}
          </div>

          {/* Next-tier box */}
          {priceDrop ? (
            <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-2xl p-4">
              <span className="text-xl leading-none mt-0.5">🔥</span>
              <div>
                <p className="text-sm font-bold text-orange-700">Si entra 1 unidad más</p>
                <p className="text-sm text-orange-600 mt-0.5">
                  el precio baja a <strong>{fmt(group.nextPrice)}</strong> para todos
                </p>
              </div>
            </div>
          ) : nextTier ? (
            <div className="flex items-start gap-3 bg-brand/5 rounded-2xl p-4">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand flex-shrink-0 mt-0.5">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              <p className="text-sm text-brand font-medium">
                A <strong>{unitsToNext}</strong> {unitsToNext === 1 ? 'unidad' : 'unidades'} de bajar a <strong>{fmt(nextTier.price)}</strong>
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-brand/5 rounded-2xl p-4">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand flex-shrink-0">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <p className="text-sm text-brand font-medium">¡Ya estáis en el mejor precio!</p>
            </div>
          )}

          {/* SVG price curve */}
          {group.tiers.length >= 2 && (
            <div className="rounded-2xl bg-gray-50 px-3 pt-3 pb-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                Curva de precio
              </p>
              <PriceCurve tiers={group.tiers} currentUnits={group.totalUnits} />
            </div>
          )}

          {/* Info chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {group.bidCount} {group.bidCount === 1 ? 'vendedor' : 'vendedores'} compitiendo · verificados
            </span>
            <GroupCountdown closesAt={group.closesAt} />
          </div>

          {/* CTA buttons */}
          <div className="space-y-3 pt-1">
            <JoinModal groupId={group.id} productName={group.name} />
            <ShareButton
              productName={group.name}
              bestPrice={group.bestPrice}
              pvp={group.pvp}
              nextPrice={group.nextPrice}
              groupId={group.id}
            />
          </div>

        </div>
      </div>
      <BottomNav />
    </div>
  )
}
