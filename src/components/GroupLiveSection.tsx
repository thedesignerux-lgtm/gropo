'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTierDemand } from '@/hooks/useTierDemand'
import GroupCountdown from './GroupCountdown'
import JoinModeSelector, { type ProjectionResult } from '@/components/JoinModeSelector'
import TierDemandLadder from '@/components/TierDemandLadder'
import ProgressToNextPrice from '@/components/ProgressToNextPrice'

function fmt(n: number | undefined | null): string {
  if (n === undefined || n === null) return '—'
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

interface Tier { minUnits: number; price: number }

interface Props {
  groupId: string
  name: string
  spec: string
  pvp: number
  initialBestPrice: number
  initialTotalUnits: number
  bidCount: number
  tiers: Tier[]
  maxStock: number
  minExecution: number
  closesAt: string
}

export default function GroupLiveSection({
  groupId, name, spec, pvp,
  initialBestPrice, initialTotalUnits,
  bidCount, tiers, maxStock, minExecution, closesAt,
}: Props) {
  const [totalUnits, setTotalUnits] = useState(initialTotalUnits)
  const [joinMode, setJoinMode] = useState<'comprar' | 'esperar'>('comprar')
  const [joinTarget, setJoinTarget] = useState<number | undefined>(undefined)
  const [quantity, setQuantity] = useState(1)
  const [projection, setProjection] = useState<ProjectionResult | null>(null)

  // tier_demand hook = source of truth for current price
  const { tiers: demandTiers, currentPrice, nextTier, missing } = useTierDemand(groupId)

  // Use currentPrice from tier_demand if available, else initial
  const displayPrice = currentPrice > 0 ? currentPrice : initialBestPrice

  useEffect(() => {
    let cancelled = false

    async function syncFromServer() {
      const { data: g } = await supabase
        .from('groups')
        .select('total_units')
        .eq('id', groupId)
        .single()
      if (cancelled) return
      if (g?.total_units != null) setTotalUnits(Number(g.total_units))
    }

    syncFromServer()

    const channel = supabase
      .channel(`group-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const eventData = payload.new as any
          if (eventData.type === 'member_joined' || eventData.type === 'price_dropped') {
            setTotalUnits(eventData.payload.total_units)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') syncFromServer()
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [groupId])

  const savings = pvp > 0 ? pvp - displayPrice : 0

  const handleProjection = useCallback((result: ProjectionResult | null) => {
    setProjection(result)
  }, [])

  const ctaPrice = projection ? projection.price : displayPrice
  const ctaHref = `/grupo/${groupId}/unirme${joinMode === 'esperar' && joinTarget ? `?mode=esperar&target=${joinTarget}` : ''}`

  return (
    <>
      <div style={{ padding: '8px 16px' }}>
        {/* Name + spec */}
        <div style={{ marginBottom: 6 }}>
          <h1 className="text-xl font-bold text-neutral-900 leading-tight" style={{ marginBottom: 2 }}>{name}</h1>
          {spec && <p className="text-base font-normal text-neutral-500">{spec}</p>}
        </div>

        {/* Price + badge + PVP */}
        <div style={{ marginBottom: 6 }}>
          <div className="flex items-center justify-between gap-2" style={{ marginBottom: 2 }}>
            <span
              className="text-3xl font-bold leading-none text-neutral-900"
              style={{ transition: 'all 300ms ease' }}
            >
              {fmt(displayPrice)}
            </span>
            {savings > 0.01 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-3.5 py-2 rounded-full flex-shrink-0 bg-green-50 text-green-700">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                Ahorras {fmt(savings)}
              </span>
            )}
          </div>
          {pvp > 0 && (
            <p className="text-base font-normal text-neutral-400 line-through">{`PVP ${fmt(pvp)}`}</p>
          )}
        </div>

        {/* Progress to next price */}
        <div style={{ marginBottom: 6 }}>
          <ProgressToNextPrice currentPrice={displayPrice} nextTier={nextTier} missing={missing} />
        </div>

        {/* Tier demand ladder */}
        <div style={{ marginBottom: 6 }}>
          {demandTiers.length > 0 ? (
            <TierDemandLadder tiers={demandTiers} currentPrice={displayPrice} />
          ) : (
            <TierDemandLadder groupId={groupId} />
          )}
        </div>

        {/* How it works note */}
        <div className="bg-neutral-50 rounded-xl p-3" style={{ marginBottom: 6 }}>
          <p className="text-xs text-neutral-500">
            El precio baja a medida que se unen más compradores. Cuantos más seáis, menos paga cada uno.
          </p>
        </div>

        {/* Metrics bar */}
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
                {maxStock > 0 ? `${totalUnits} / ${maxStock} uds` : `${totalUnits} uds`}
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
                {bidCount === 1 ? '1 vendedor' : `${bidCount} vendedores`}
              </span>
              <span className="text-xs text-neutral-400 text-center leading-tight">
                {bidCount === 1 ? 'verificado' : 'verificados'}
              </span>
            </div>

            {/* Col 3 — Live countdown */}
            <div className="flex-1 flex flex-col items-center gap-1 px-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600 flex-shrink-0">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <circle cx="12" cy="12" r="9"/>
                <polyline points="12 7 12 12 15 15"/>
              </svg>
              <GroupCountdown closesAt={closesAt} minimal />
            </div>
          </div>
        </div>
      </div>

      {/* Join mode selector */}
      {tiers.length > 1 && (
        <div className="px-4 pb-2">
          <JoinModeSelector
            groupId={groupId}
            tiers={tiers}
            currentPrice={displayPrice}
            totalUnits={totalUnits}
            quantity={quantity}
            demandTiers={demandTiers}
            onChange={(m, tp) => { setJoinMode(m); setJoinTarget(tp) }}
            onProjection={handleProjection}
          />
        </div>
      )}

      {/* Sticky bottom: quantity + projection banner + CTA */}
      <div className="sticky bottom-0 z-20 bg-white border-t border-[#EEEEEE] px-4 py-3">
        {/* Quantity selector */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-neutral-700">Cantidad</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-600 hover:border-brand transition-colors"
              aria-label="Menos"
            >
              −
            </button>
            <span className="text-base font-semibold text-neutral-900 tabular-nums w-6 text-center">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(q => Math.min(10, q + 1))}
              className="w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-600 hover:border-brand transition-colors"
              aria-label="Más"
            >
              +
            </button>
          </div>
        </div>

        {/* Total estimate */}
        {quantity > 1 && (
          <p className="text-xs text-neutral-500 text-right mb-2">
            Total estimado: {fmt(ctaPrice * quantity)}
          </p>
        )}

        {/* Projection banner */}
        {projection && (
          <div className={`rounded-xl p-2.5 mb-2 text-sm ${
            projection.unlocks
              ? 'bg-green-50 text-green-700'
              : 'bg-neutral-50 text-neutral-600'
          }`}>
            {projection.unlocks ? (
              <p className="font-medium">
                Con tus {quantity} ud{quantity > 1 ? 's' : ''}, el grupo baja a {fmt(projection.price)} para todos
              </p>
            ) : (
              <p>
                Con tus {quantity} ud{quantity > 1 ? 's' : ''}, el grupo sigue en {fmt(projection.price)}
                {nextTier && <span> &middot; faltan {missing} para bajar a {fmt(nextTier.price)}</span>}
              </p>
            )}
          </div>
        )}

        {/* CTA row */}
        <div className="flex items-center gap-3">
          <button
            className="w-14 h-14 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 flex-shrink-0"
            aria-label="Guardar en favoritos"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M19.5 13.572l-7.5 7.428l-7.5 -7.428m0 0a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"/>
            </svg>
          </button>
          <Link
            href={ctaHref}
            className="flex-1 bg-brand text-white font-semibold text-base py-4 rounded-xl text-center hover:bg-brand-dark active:scale-[0.98] transition-all"
          >
            {joinMode === 'esperar' && joinTarget ? (
              `Reservar plaza · ${fmt(joinTarget)} máx.`
            ) : (
              `Comprar ahora · ${fmt(ctaPrice)}`
            )}
          </Link>
        </div>
      </div>
    </>
  )
}
