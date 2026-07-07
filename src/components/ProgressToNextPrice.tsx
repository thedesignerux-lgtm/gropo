'use client'

import type { TierRow } from '@/hooks/useTierDemand'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

interface Props {
  currentPrice: number
  nextTier: TierRow | null
  missing: number
  selectedQuantity?: number  // unidades que el usuario ha elegido (preview)
}

export default function ProgressToNextPrice({ currentPrice, nextTier, missing, selectedQuantity = 0 }: Props) {
  if (!nextTier) return null

  const realDemand = nextTier.demand
  const projectedDemand = realDemand + selectedQuantity
  const projectedMissing = Math.max(0, missing - selectedQuantity)

  // Barra: porcentaje real + porcentaje proyectado
  const realPct = nextTier.minUnits > 0
    ? Math.min(100, Math.round((realDemand / nextTier.minUnits) * 100))
    : 100
  const projectedPct = nextTier.minUnits > 0
    ? Math.min(100, Math.round((projectedDemand / nextTier.minUnits) * 100))
    : 100
  const wouldUnlock = projectedDemand >= nextTier.minUnits

  return (
    <div className="bg-white rounded-xl border border-neutral-100 p-4">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
        Progreso hacia el siguiente precio
      </p>

      {/* Big number */}
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-2xl font-bold text-neutral-900 tabular-nums">
          {selectedQuantity > 0 ? (
            <>
              {realDemand}
              <span className="text-brand"> +{selectedQuantity}</span>
              <span className="text-lg font-medium text-neutral-400"> / {nextTier.minUnits}</span>
            </>
          ) : (
            <>
              {realDemand} / {nextTier.minUnits}
            </>
          )}
          <span className="text-sm font-medium text-neutral-500 ml-1">unidades</span>
        </span>
        {wouldUnlock ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            ¡Desbloqueáis {fmt(nextTier.price)}!
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#993C1D] bg-orange-50 px-2.5 py-1 rounded-full">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2c1 3 3.5 5 6 6-1 4-3 7-6 10-3-3-5-6-6-10 2.5-1 5-3 6-6z" />
            </svg>
            Faltan {projectedMissing} uds para {fmt(nextTier.price)}
          </span>
        )}
      </div>

      {/* Progress bar with projection overlay */}
      <div className="h-2.5 w-full bg-neutral-100 rounded-full overflow-hidden mb-2 relative">
        {/* Projected (lighter brand) — rendered behind if wider than real */}
        {selectedQuantity > 0 && projectedPct > realPct && (
          <div
            className="absolute h-full rounded-full bg-brand/30"
            style={{ width: `${projectedPct}%`, transition: 'width 300ms ease' }}
          />
        )}
        {/* Real demand (solid brand) */}
        <div
          className="h-full bg-brand rounded-full relative z-10"
          style={{ width: `${realPct}%`, transition: 'width 300ms ease' }}
        />
      </div>

      {/* Extremes */}
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span>{fmt(currentPrice)} &middot; actual</span>
        <span>{fmt(nextTier.price)} &middot; próximo</span>
      </div>
    </div>
  )
}
