import Link from 'next/link'
import { Fragment } from 'react'
import { supabase } from '@/lib/supabase'
import { getStepPricing } from '@/lib/mock-data'
import type { Tier } from '@/lib/mock-data'
import GroupCountdown from '@/components/GroupCountdown'
import JoinModal from '@/components/JoinModal'
import HeroShareButton from '@/components/HeroShareButton'

export const dynamic = 'force-dynamic'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

// ─── Horizontal tier progress bar ─────────────────────────────────────────────

function TierBar({ tiers, currentTierIndex }: { tiers: Tier[]; currentTierIndex: number }) {
  return (
    <div className="flex items-center w-full">
      {tiers.map((tier, i) => {
        const isCurrent = i === currentTierIndex
        const isPast = i < currentTierIndex
        return (
          <Fragment key={tier.minUnits}>
            {i > 0 && (
              <div className={`flex-1 h-[3px] ${i <= currentTierIndex ? 'bg-brand' : 'bg-gray-200'}`} />
            )}
            <div className="flex flex-col items-center">
              <span className={`text-xs font-semibold leading-none mb-1.5 whitespace-nowrap ${
                isCurrent ? 'text-teal-700' : 'text-neutral-900'
              }`}>
                {Math.round(tier.price)}€
              </span>
              <div className={`w-4 h-4 rounded-full border-2 ${
                isCurrent
                  ? 'bg-brand border-brand'
                  : isPast
                  ? 'bg-white border-brand'
                  : 'bg-white border-gray-300'
              }`} />
              <span className="text-xs font-normal text-neutral-400 leading-none mt-1.5 whitespace-nowrap">
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-base text-neutral-400">Grupo no encontrado</p>
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
  const hasNextTier = pricing?.nextTier != null
  const unitsToNext = pricing?.unitsToNext ?? 0

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white' }}>
      <div style={{ maxWidth: 448, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'white' }}>

        {/* ── HERO IMAGE ── */}
        <div
          className="relative w-full bg-[#F5F5F5] overflow-hidden"
          style={{ height: '30dvh', flexShrink: 0 }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <div className="absolute top-3 left-3 right-3 flex justify-between z-10 pt-12">
            <Link
              href="/"
              className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors"
              aria-label="Volver"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
            <HeroShareButton
              productName={group.name}
              bestPrice={group.bestPrice}
              pvp={group.pvp}
              nextPrice={group.nextPrice}
              groupId={group.id}
            />
          </div>
        </div>

        {/* ── SCROLLABLE CONTENT ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>

          {/* Name + spec */}
          <div style={{ marginBottom: 6 }}>
            <h1 className="text-xl font-bold text-neutral-900 leading-tight" style={{ marginBottom: 2 }}>{group.name}</h1>
            {group.spec && (
              <p className="text-base font-normal text-neutral-500">{group.spec}</p>
            )}
          </div>

          {/* Price + badge + PVP */}
          <div style={{ marginBottom: 6 }}>
            <div className="flex items-center justify-between gap-2" style={{ marginBottom: 2 }}>
              <span className="text-3xl font-bold text-teal-700 leading-none">
                {fmt(group.bestPrice)}
              </span>
              {savings > 0.01 && (
                <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-semibold px-3.5 py-2 rounded-full flex-shrink-0">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                    <line x1="7" y1="7" x2="7.01" y2="7"/>
                  </svg>
                  Ahorras {fmt(savings)} vs PVP
                </span>
              )}
            </div>
            {group.pvp > 0 && (
              <p className="text-base font-normal text-neutral-400 line-through">{`PVP ${fmt(group.pvp)}`}</p>
            )}
          </div>

          {/* Tier progress bar */}
          {group.tiers.length >= 2 && (
            <div style={{ marginBottom: 6 }}>
              <p className="text-xs font-semibold uppercase text-neutral-400 tracking-widest" style={{ marginBottom: 6 }}>
                Tramos de precio
              </p>
              <TierBar tiers={group.tiers} currentTierIndex={currentTierIndex} />
            </div>
          )}

          {/* Orange box */}
          {(priceDrop || hasNextTier) && (
            <div className="bg-[#FFF3ED] rounded-xl" style={{ marginBottom: 6, padding: '6px 12px' }}>
              <p className="text-sm font-normal text-orange-600">
                {priceDrop
                  ? `Solo 1 más: Próximo precio ${fmt(group.nextPrice)}`
                  : `A ${unitsToNext} ${unitsToNext === 1 ? 'unidad' : 'uds'} del siguiente tramo`}
              </p>
            </div>
          )}

          {/* Metrics bar — 3 equal columns */}
          <div className="border-t border-[#EEEEEE]">
            <div className="flex divide-x divide-[#EEEEEE]" style={{ padding: '8px 0' }}>

              {/* Col 1 — Stock */}
              <div className="flex-1 flex flex-col items-center gap-1 px-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 flex-shrink-0">
                  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                  <polyline points="12 3 20 7.5 20 16.5 12 21 4 16.5 4 7.5 12 3"/>
                  <line x1="12" y1="12" x2="20" y2="7.5"/>
                  <line x1="12" y1="12" x2="12" y2="21"/>
                  <line x1="12" y1="12" x2="4" y2="7.5"/>
                </svg>
                <span className="text-sm font-normal text-neutral-700 text-center leading-tight">
                  {group.maxStock > 0
                    ? `${group.totalUnits} / ${group.maxStock} uds`
                    : `${group.totalUnits} uds`}
                </span>
                <span className="text-xs text-neutral-400 text-center leading-tight">de stock</span>
              </div>

              {/* Col 2 — Sellers */}
              <div className="flex-1 flex flex-col items-center gap-1 px-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 flex-shrink-0">
                  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                  <circle cx="12" cy="7" r="4"/>
                  <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                </svg>
                <span className="text-sm font-normal text-neutral-700 text-center leading-tight">
                  {group.bidCount === 1 ? '1 vendedor' : `${group.bidCount} vendedores`}
                </span>
                <span className="text-xs text-neutral-400 text-center leading-tight">
                  {group.bidCount === 1 ? 'verificado' : 'verificados'}
                </span>
              </div>

              {/* Col 3 — Live countdown */}
              <div className="flex-1 flex flex-col items-center gap-1 px-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600 flex-shrink-0">
                  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                  <circle cx="12" cy="12" r="9"/>
                  <polyline points="12 7 12 12 15 15"/>
                </svg>
                <GroupCountdown closesAt={group.closesAt} minimal />
              </div>

            </div>
          </div>

        </div>

        {/* ── CTA BAR ── */}
        <div
          className="flex items-center gap-3 border-t border-[#EEEEEE] bg-white"
          style={{ flexShrink: 0, padding: '8px 16px 12px' }}
        >
          <button
            className="w-14 h-14 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 flex-shrink-0"
            aria-label="Guardar en favoritos"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M19.5 13.572l-7.5 7.428l-7.5 -7.428m0 0a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"/>
            </svg>
          </button>
          <JoinModal
            groupId={group.id}
            productName={group.name}
            triggerClassName="flex-1 bg-brand text-white font-semibold text-base py-4 rounded-xl hover:bg-brand-dark active:scale-[0.98] transition-all"
          />
        </div>

      </div>
    </div>
  )
}
