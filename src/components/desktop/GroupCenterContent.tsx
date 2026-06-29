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

  const handleProjection = useCallback((result: ProjectionResult | null) => {
    setProjection(result)
  }, [])

  const selectedMaxPrice = joinMode === 'esperar' && joinTarget ? joinTarget : displayPrice
  const ctaHref = `/grupo/${groupId}/unirme${joinMode === 'esperar' && joinTarget ? `?mode=esperar&target=${joinTarget}` : ''}`

  return (
    <div className="space-y-5">
      {/* ROW 1: Precio normal · Precio del grupo · Próximo descuento */}
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

        {nextTier ? (
          <div className="bg-white rounded-2xl border border-neutral-100 p-5 flex flex-col justify-center">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1">Próximo descuento</p>
            <p className="text-3xl font-bold text-green-600">{fmt(nextTier.price)}</p>
            <p className="text-xs text-neutral-500 mt-1">Faltan {missing} compra{missing !== 1 ? 's' : ''}</p>
          </div>
        ) : (
          <div className="bg-green-50 rounded-2xl border border-green-100 p-5 flex flex-col items-center justify-center text-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 mb-2">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p className="text-sm font-semibold text-green-700">Mejor precio alcanzado</p>
          </div>
        )}
      </div>

      {/* ROW 2: Cómo baja el precio */}
      {demandTiers.length > 0 ? (
        <TierDemandLadder tiers={demandTiers} currentPrice={displayPrice} />
      ) : (
        <TierDemandLadder groupId={groupId} />
      )}

      {/* ROW 3: PMA Selector */}
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

      {/* ROW 4: Quantity + CTA */}
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
            Comprar (Máx. {fmt(selectedMaxPrice)})
          </Link>
        </div>
        <p className="text-xs text-neutral-400 text-center mt-3">Pago 100% seguro con Stripe</p>
      </div>
    </div>
  )
}
