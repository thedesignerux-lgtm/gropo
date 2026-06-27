'use client'

import type { TierRow } from '@/hooks/useTierDemand'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

interface Props {
  currentPrice: number
  nextTier: TierRow | null
  missing: number
}

export default function ProgressToNextPrice({ currentPrice, nextTier, missing }: Props) {
  if (!nextTier) return null

  const pct = nextTier.minUnits > 0
    ? Math.min(100, Math.round((nextTier.demand / nextTier.minUnits) * 100))
    : 100

  return (
    <div className="bg-white rounded-xl border border-neutral-100 p-4">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
        Progreso hacia el siguiente precio
      </p>

      {/* Big number */}
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-2xl font-bold text-neutral-900 tabular-nums">
          {nextTier.demand} / {nextTier.minUnits}
          <span className="text-sm font-medium text-neutral-500 ml-1">unidades</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#993C1D] bg-orange-50 px-2.5 py-1 rounded-full">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2c1 3 3.5 5 6 6-1 4-3 7-6 10-3-3-5-6-6-10 2.5-1 5-3 6-6z" />
          </svg>
          Faltan {missing} uds para {fmt(nextTier.price)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 w-full bg-neutral-100 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-brand rounded-full"
          style={{ width: `${pct}%`, transition: 'width 300ms ease' }}
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
