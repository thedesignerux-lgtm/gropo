import Link from 'next/link'
import { Fragment } from 'react'
import { supabase } from '@/lib/supabase'
import { getStepPricing } from '@/lib/mock-data'
import type { Tier } from '@/lib/mock-data'
import GroupCountdown from '@/components/GroupCountdown'
import JoinModal from '@/components/JoinModal'
import ShareButton from '@/components/ShareButton'
import BottomNav from '@/components/BottomNav'

export const dynamic = 'force-dynamic'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

function fmtTier(p: number): string {
  return (p % 1 === 0 ? String(Math.round(p)) : p.toFixed(2).replace('.', ',')) + '€'
}

// ─── Horizontal tier progress bar ─────────────────────────────────────────────

function TierBar({
  tiers,
  currentTierIndex,
}: {
  tiers: Tier[]
  currentTierIndex: number
}) {
  return (
    <div className="flex items-center w-full">
      {tiers.map((tier, i) => {
        const isCurrent = i === currentTierIndex
        const isPast = i < currentTierIndex
        return (
          <Fragment key={tier.minUnits}>
            {/* Connecting bar between circles */}
            {i > 0 && (
              <div
                className={`flex-1 h-[3px] ${
                  i <= currentTierIndex ? 'bg-brand' : 'bg-gray-200'
                }`}
              />
            )}
            {/* Tier stop: price · circle · units */}
            <div className="flex flex-col items-center">
              <span
                className={`text-[10px] font-bold leading-none mb-1.5 whitespace-nowrap ${
                  isCurrent ? 'text-brand' : 'text-gray-900'
                }`}
              >
                {fmtTier(tier.price)}
              </span>
              <div
                className={`w-4 h-4 rounded-full border-2 ${
                  isCurrent
                    ? 'bg-brand border-brand'
                    : isPast
                    ? 'bg-white border-brand'
                    : 'bg-white border-gray-300'
                }`}
              />
              <span className="text-[9px] text-gray-400 leading-none mt-1.5 whitespace-nowrap">
                {tier.minUnits}uds
              </span>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function fetchGroup(id: string) {
  const { data: group, error } = await supabase
    .from('groups')
    .select(`
      id, product_name, product_spec, pvp,
      total_units, current_price, next_price, closes_at,
      bids(tiers, price_mode, max_stock, min_execution)
    `)
    .eq('id', id)
    .single()

  if (error || !group) return null

  let bestPrice = Number(group.current_price)
  let nextPrice = Number((group as any).next_price ?? group.current_price)
  const { data: rpc } = await supabase.rpc('compute_price', { p_group_id: id })
  if (rpc && typeof rpc === 'object') {
    if ((rpc as any).best_price != null) bestPrice = Number((rpc as any).best_price)
    if ((rpc as any).next_price != null) nextPrice = Number((rpc as any).next_price)
  }

  const { count: bidCount } = await supabase
    .from('bids')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', id)

  const bid = Array.isArray(group.bids) ? group.bids[0] : null
  const tiers: Tier[] = ((bid as any)?.tiers ?? []).map((t: any) => ({
    minUnits: Number(t.min_units),
    price: Number(t.price),
  }))
  const maxStock = Number((bid as any)?.max_stock ?? 0)

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
    maxStock,
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

  const pricing = group.tiers.length > 0
    ? getStepPricing(group.tiers, group.totalUnits)
    : null
  const currentTierIndex = pricing
    ? group.tiers.findIndex(t => t.minUnits === pricing.currentTierMinUnits)
    : -1

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen pb-28">

        {/* Header: back arrow + centered product name */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center">
          <Link
            href="/"
            className="text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <span className="flex-1 text-center text-base font-bold text-gray-900 px-3 truncate">
            {group.name}
          </span>
          {/* Balancing spacer so title stays centered */}
          <div className="w-5 flex-shrink-0" />
        </div>

        {/* Image — 200px placeholder (not full screen) */}
        <div
          className="w-full bg-gray-100 flex items-center justify-center"
          style={{ height: 200 }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>

        <div className="px-4 pt-5 space-y-4 pb-6">

          {/* Product name · spec · price · savings badge */}
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{group.name}</h1>
            {group.spec && (
              <p className="text-sm text-gray-500 mt-0.5">{group.spec}</p>
            )}
            <div className="flex items-baseline gap-3 mt-3 flex-wrap">
              <span className="text-5xl font-bold text-brand leading-none">
                {fmt(group.bestPrice)}
              </span>
              {group.pvp > 0 && (
                <span className="text-base text-gray-400 line-through">
                  PVP {fmt(group.pvp)}
                </span>
              )}
            </div>
            {savings > 0.01 && (
              <span className="inline-flex items-center bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full mt-2">
                Ya ahorras {fmt(savings)} vs PVP
              </span>
            )}
          </div>

          {/* Orange box — only when 1 more unit drops the price */}
          {priceDrop && (
            <div className="flex items-center gap-2 bg-[#FFF3ED] rounded-2xl px-4 py-3">
              <span className="text-lg leading-none flex-shrink-0">🔥</span>
              <p className="flex-1 text-sm text-orange-600 min-w-0">
                <span className="font-bold text-orange-700">Si entra 1 unidad más:</span>{' '}
                Nuevo precio:{' '}
                <span className="font-bold">{fmt(group.nextPrice)}</span> para todos
              </p>
              <span className="text-orange-400 font-bold text-base flex-shrink-0">›</span>
            </div>
          )}

          {/* Tier bar */}
          {group.tiers.length >= 2 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Tramos de precio
              </p>
              <TierBar tiers={group.tiers} currentTierIndex={currentTierIndex} />
              {group.maxStock > 0 && (
                <p className="text-right text-[11px] text-gray-500 mt-2">
                  📦 {group.totalUnits} / {group.maxStock} unidades de stock
                </p>
              )}
            </div>
          )}

          {/* Chips — same row: sellers left, countdown right */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 font-medium">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {group.bidCount === 1
                ? '1 vendedor verificado pujando'
                : `${group.bidCount} vendedores compitiendo · verificados`}
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
