'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useTierDemand } from '@/hooks/useTierDemand'
import TierDemandLadder from '@/components/TierDemandLadder'
import JoinModeSelector, { type ProjectionResult } from '@/components/JoinModeSelector'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

interface Tier { minUnits: number; price: number }

interface Props {
  groupId: string
  pvp: number
  tiers: Tier[]
  maxStock: number
  initialBestPrice: number
}

export default function GroupCenterContent({
  groupId, pvp, tiers, maxStock, initialBestPrice,
}: Props) {
  const [joinMode, setJoinMode] = useState<'comprar' | 'esperar'>('comprar')
  const [joinTarget, setJoinTarget] = useState<number | undefined>(undefined)
  const [quantity, setQuantity] = useState(1)
  const [projection, setProjection] = useState<ProjectionResult | null>(null)

  const { tiers: demandTiers, currentPrice, nextTier, missing } = useTierDemand(groupId)
  const displayPrice = currentPrice > 0 ? currentPrice : initialBestPrice

  const totalParticipants = demandTiers.length > 0
    ? Math.max(...demandTiers.map(t => t.demand))
    : 0

  const savings = pvp > 0 && pvp > displayPrice ? pvp - displayPrice : 0
  const savingsPct = pvp > 0 ? Math.round((savings / pvp) * 100) : 0

  const handleProjection = useCallback((result: ProjectionResult | null) => {
    setProjection(result)
  }, [])

  const ctaPrice = projection ? projection.price : displayPrice
  const ctaHref = `/grupo/${groupId}/unirme${joinMode === 'esperar' && joinTarget ? `?mode=esperar&target=${joinTarget}` : ''}`

  const demandCallout = (() => {
    if (!demandTiers || demandTiers.length === 0) return null
    const waiting = demandTiers
      .filter(t => !t.unlocked && t.demand > 0)
      .sort((a, b) => b.demand - a.demand)
    return waiting[0] ?? null
  })()

  return (
    <div className="space-y-5">
      {/* ROW 1: PVP · Price · Progress */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-neutral-100 p-5 flex flex-col justify-center">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1">PVP inicial</p>
          <p className="text-2xl font-bold text-neutral-300 line-through">{fmt(pvp)}</p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-100 p-5 flex flex-col justify-center">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1">Precio actual</p>
          <p className="text-3xl font-bold text-brand">{fmt(displayPrice)}</p>
          <p className="text-xs text-neutral-400 mt-0.5">por unidad</p>
          {savings > 0.01 && (
            <p className="text-xs font-semibold text-green-600 mt-1">
              -{savingsPct}% ({fmt(savings)} menos)
            </p>
          )}
        </div>

        {nextTier ? (
          <div className="bg-white rounded-2xl border border-neutral-100 p-5">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1">
              Progreso hacia el siguiente precio
            </p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-3xl font-bold text-neutral-900">{nextTier.demand}</span>
              <span className="text-lg text-neutral-400">/ {nextTier.minUnits}</span>
              <span className="text-sm text-neutral-400 ml-1">unidades</span>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#993C1D] bg-orange-50 px-2 py-0.5 rounded-full mb-2">
              Faltan {missing} unidades para {fmt(nextTier.price)}
            </span>
            <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full"
                style={{ width: `${Math.min(100, Math.round((nextTier.demand / nextTier.minUnits) * 100))}%`, transition: 'width 300ms' }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
              <span>{fmt(displayPrice)} · Precio actual</span>
              <span>{fmt(nextTier.price)} · Próximo precio</span>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 rounded-2xl border border-green-100 p-5 flex flex-col items-center justify-center text-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 mb-2">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p className="text-sm font-semibold text-green-700">Mejor precio alcanzado</p>
            <p className="text-xs text-green-600 mt-0.5">Este grupo tiene el precio más bajo posible</p>
          </div>
        )}
      </div>

      {/* ROW 2: Tier ladder */}
      {demandTiers.length > 0 ? (
        <TierDemandLadder tiers={demandTiers} currentPrice={displayPrice} />
      ) : (
        <TierDemandLadder groupId={groupId} />
      )}

      {/* ROW 3: Demand callout */}
      {demandCallout && (
        <div className="bg-white rounded-2xl border border-neutral-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              {demandCallout.demand} persona{demandCallout.demand !== 1 ? 's' : ''} compraría{demandCallout.demand !== 1 ? 'n' : ''} a {fmt(demandCallout.price)}
            </p>
            <p className="text-xs text-neutral-500">
              Demanda efectiva si el grupo llega a ese precio o mejor.
            </p>
          </div>
        </div>
      )}

      {/* ROW 4: Participation selector */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-5">
        <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wide mb-4">¿Cómo quieres participar?</h2>

        <JoinModeSelector
          groupId={groupId}
          tiers={tiers}
          currentPrice={displayPrice}
          totalUnits={totalParticipants}
          quantity={quantity}
          demandTiers={demandTiers}
          onChange={(m, tp) => { setJoinMode(m); setJoinTarget(tp) }}
          onProjection={handleProjection}
        />

        {projection && (
          <div className={`rounded-xl p-3 mt-4 text-sm ${
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
                {nextTier && <span> · faltan {missing} para {fmt(nextTier.price)}</span>}
              </p>
            )}
          </div>
        )}

      </div>

      {/* ROW 5: Quantity + CTA */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-neutral-700">Cantidad</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-600 hover:border-brand transition-colors text-lg"
              >−</button>
              <span className="text-base font-semibold text-neutral-900 tabular-nums w-6 text-center">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(q => Math.min(10, q + 1))}
                className="w-9 h-9 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-600 hover:border-brand transition-colors text-lg"
              >+</button>
            </div>
            <span className="text-xs text-neutral-400">unidad{quantity > 1 ? 'es' : ''}</span>
          </div>

          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="text-xs text-neutral-400">Total estimado</p>
              <p className="text-xl font-bold text-neutral-900">{fmt(ctaPrice * quantity)}</p>
              <p className="text-[10px] text-neutral-400">por unidad (máx.)</p>
            </div>

            <Link
              href={ctaHref}
              className="bg-brand text-white font-semibold text-base px-8 py-3.5 rounded-xl hover:bg-brand-dark active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              Continuar
            </Link>
          </div>
        </div>

        <p className="text-xs text-neutral-400 text-center mt-3">Es seguro · Stripe</p>
      </div>
    </div>
  )
}
