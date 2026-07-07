'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useTierDemand } from '@/hooks/useTierDemand'
import TierDemandLadder from '@/components/TierDemandLadder'
import JoinModeSelector, { type ProjectionResult } from '@/components/JoinModeSelector'
import BestPriceReached from '@/components/BestPriceReached'
import PriceJourney from '@/components/PriceJourney'

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
  const isBestPrice = !nextTier
  const remaining = Math.max(0, maxStock - totalParticipants)

  const handleProjection = useCallback((result: ProjectionResult | null) => {
    setProjection(result)
  }, [])

  const selectedMaxPrice = joinMode === 'esperar' && joinTarget ? joinTarget : displayPrice

  // Build CTA href with all params (qty, mode, target)
  const ctaParams = new URLSearchParams()
  if (joinMode === 'esperar' && joinTarget) {
    ctaParams.set('mode', 'esperar')
    ctaParams.set('target', String(joinTarget))
  }
  if (quantity > 1) ctaParams.set('qty', String(quantity))
  const ctaHref = `/grupo/${groupId}/unirme${ctaParams.toString() ? `?${ctaParams.toString()}` : ''}`

  // Projected progress toward next tier
  const projectedMissing = nextTier ? Math.max(0, missing - quantity) : 0
  const wouldUnlock = nextTier ? quantity >= missing : false

  return (
    <div className="space-y-5">
      {/* ROW 1: Precios */}
      {isBestPrice ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-neutral-100 p-5 flex flex-col justify-center">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1">Precio habitual</p>
            <p className="text-2xl font-bold text-neutral-300 line-through">{fmt(pvp)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-100 p-5 flex flex-col justify-center">
            <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Tu precio hoy</p>
            <p className="text-3xl font-bold text-green-600">{fmt(displayPrice)}</p>
            {savings > 0.01 && (
              <p className="text-sm font-semibold text-green-600 mt-1">Ahorras {fmt(savings)} ({savingsPct}%)</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-neutral-100 p-5 flex flex-col justify-center">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1">Precio normal</p>
            <p className="text-2xl font-bold text-neutral-300 line-through">{fmt(pvp)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-100 p-5 flex flex-col justify-center">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1">Precio del grupo</p>
            <p className="text-3xl font-bold text-brand">{fmt(displayPrice)}</p>
            {savings > 0.01 && (
              <p className="text-xs font-semibold text-green-600 mt-1">Ahorras {fmt(savings)}</p>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-neutral-100 p-5 flex flex-col justify-center">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1">Próximo descuento</p>
            <p className="text-3xl font-bold text-green-600">{fmt(nextTier!.price)}</p>
            {wouldUnlock ? (
              <p className="text-xs font-semibold text-green-600 mt-1">
                ¡Con tus {quantity} ud{quantity > 1 ? 's' : ''} se desbloquea!
              </p>
            ) : (
              <p className="text-xs text-neutral-500 mt-1">
                Faltan {projectedMissing} compra{projectedMissing !== 1 ? 's' : ''}
                {quantity > 1 && <span className="text-brand"> (tú aportas {quantity})</span>}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Banner de mejor precio alcanzado */}
      {isBestPrice && (
        <BestPriceReached
          currentPrice={displayPrice}
          pvp={pvp}
          maxStock={maxStock}
          totalDemand={totalParticipants}
        />
      )}

      {/* Quantity + CTA — arriba cuando mejor precio alcanzado */}
      {isBestPrice && (
        <div className="bg-white rounded-2xl border border-neutral-100 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-neutral-700">Cantidad</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-600 hover:border-brand transition-colors text-lg">−</button>
                <span className="text-base font-semibold text-neutral-900 tabular-nums w-6 text-center">{quantity}</span>
                <button type="button" onClick={() => setQuantity(q => Math.min(10, q + 1))}
                  className="w-9 h-9 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-600 hover:border-brand transition-colors text-lg">+</button>
              </div>
              <span className="text-xs text-neutral-400">unidad{quantity > 1 ? 'es' : ''}</span>
            </div>

            <Link href={ctaHref}
              className="bg-green-600 text-white font-semibold text-base px-8 py-3.5 rounded-xl hover:bg-green-700 active:scale-[0.98] transition-all flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              Comprar · {fmt(selectedMaxPrice)}
            </Link>
          </div>
          <p className="text-xs text-neutral-400 text-center mt-3">Pago 100% seguro con Stripe</p>
        </div>
      )}

      {/* Recorrido de precio (solo cuando mejor precio alcanzado) */}
      {isBestPrice && (
        <PriceJourney pvp={pvp} currentPrice={displayPrice} tiers={demandTiers} />
      )}

      {/* Cómo baja el precio (solo cuando hay siguiente descuento) */}
      {!isBestPrice && (
        <>
          {demandTiers.length > 0 ? (
            <TierDemandLadder tiers={demandTiers} currentPrice={displayPrice} />
          ) : (
            <TierDemandLadder groupId={groupId} />
          )}
        </>
      )}

      {/* PMA Selector (solo cuando hay siguiente descuento) */}
      {!isBestPrice && (
        <div className="bg-white rounded-2xl border border-neutral-100 p-5">
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
        </div>
      )}

      {/* Quantity + CTA (solo cuando hay siguiente descuento) */}
      {!isBestPrice && (
        <div className="bg-white rounded-2xl border border-neutral-100 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-neutral-700">Cantidad</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-600 hover:border-brand transition-colors text-lg">−</button>
                <span className="text-base font-semibold text-neutral-900 tabular-nums w-6 text-center">{quantity}</span>
                <button type="button" onClick={() => setQuantity(q => Math.min(10, q + 1))}
                  className="w-9 h-9 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-600 hover:border-brand transition-colors text-lg">+</button>
              </div>
              <span className="text-xs text-neutral-400">unidad{quantity > 1 ? 'es' : ''}</span>
            </div>

            <Link href={ctaHref}
              className="bg-brand text-white font-semibold text-base px-8 py-3.5 rounded-xl hover:bg-brand-dark active:scale-[0.98] transition-all flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              {nextTier ? `Comprar (Máx. ${fmt(selectedMaxPrice)})` : `Comprar · ${fmt(selectedMaxPrice)}`}
            </Link>
          </div>
          <p className="text-xs text-neutral-400 text-center mt-3">Pago 100% seguro con Stripe</p>
        </div>
      )}
    </div>
  )
}
