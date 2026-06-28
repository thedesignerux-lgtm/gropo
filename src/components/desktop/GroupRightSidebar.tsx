'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTierDemand } from '@/hooks/useTierDemand'
import JoinModeSelector, { type ProjectionResult } from '@/components/JoinModeSelector'
import TierDemandLadder from '@/components/TierDemandLadder'
import ProgressToNextPrice from '@/components/ProgressToNextPrice'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

interface Tier { minUnits: number; price: number }

interface Props {
  groupId: string
  tiers: Tier[]
  bestPrice: number
  pvp: number
  maxStock: number
  closesAt: string
}

export default function GroupRightSidebar({
  groupId, tiers, bestPrice, pvp, maxStock, closesAt,
}: Props) {
  const [joinMode, setJoinMode] = useState<'comprar' | 'esperar'>('comprar')
  const [joinTarget, setJoinTarget] = useState<number | undefined>(undefined)
  const [quantity, setQuantity] = useState(1)
  const [projection, setProjection] = useState<ProjectionResult | null>(null)
  const [summary, setSummary] = useState<{ firmUnits: number; reserveUnits: number; maxStock: number } | null>(null)

  // tier_demand hook — refreshKey triggers summary re-fetch
  const { tiers: demandTiers, currentPrice, nextTier, missing, refreshKey } = useTierDemand(groupId)
  const displayPrice = currentPrice > 0 ? currentPrice : bestPrice

  // Fetch group summary — re-runs when realtime data arrives
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/group/${groupId}/summary`)
        const data = await res.json()
        setSummary(data)
      } catch {
        // silent
      }
    }
    load()
  }, [groupId, refreshKey])

  const handleProjection = useCallback((result: ProjectionResult | null) => {
    setProjection(result)
  }, [])

  const ctaPrice = projection ? projection.price : displayPrice
  const ctaHref = `/grupo/${groupId}/unirme${joinMode === 'esperar' && joinTarget ? `?mode=esperar&target=${joinTarget}` : ''}`

  // Countdown
  const closesDate = new Date(closesAt)
  const diffMs = closesDate.getTime() - Date.now()
  const days = Math.max(0, Math.floor(diffMs / 86400000))
  const hours = Math.max(0, Math.floor((diffMs % 86400000) / 3600000))
  const countdownLabel = days > 0 ? `${days}d ${hours}h` : `${hours}h`

  return (
    <aside className="w-[340px] flex-shrink-0 flex flex-col gap-4">
      {/* 1. Progress to next price */}
      <ProgressToNextPrice currentPrice={displayPrice} nextTier={nextTier} missing={missing} />

      {/* 2. Tier demand ladder */}
      {demandTiers.length > 0 ? (
        <TierDemandLadder tiers={demandTiers} currentPrice={displayPrice} />
      ) : (
        <TierDemandLadder groupId={groupId} />
      )}

      {/* 3. Join mode selector */}
      {tiers.length > 1 && (
        <JoinModeSelector
          groupId={groupId}
          tiers={tiers}
          currentPrice={displayPrice}
          totalUnits={summary ? summary.firmUnits + summary.reserveUnits : 0}
          quantity={quantity}
          demandTiers={demandTiers}
          onChange={(m, tp) => { setJoinMode(m); setJoinTarget(tp) }}
          onProjection={handleProjection}
        />
      )}

      {/* 4. Projection banner */}
      {projection && (
        <div className={`rounded-xl p-3 text-sm ${
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
              {nextTier && <span> &middot; faltan {missing} para {fmt(nextTier.price)}</span>}
            </p>
          )}
        </div>
      )}

      {/* 5. Quantity + Total + CTA */}
      <div>
        {/* Quantity selector */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-neutral-700">Cantidad</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-600 hover:border-brand transition-colors"
            >
              −
            </button>
            <span className="text-base font-semibold text-neutral-900 tabular-nums w-6 text-center">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(q => Math.min(10, q + 1))}
              className="w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-600 hover:border-brand transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {quantity > 1 && (
          <p className="text-xs text-neutral-500 text-right mb-2">
            Total estimado: {fmt(ctaPrice * quantity)}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            className="w-12 h-12 flex items-center justify-center rounded-xl border border-neutral-200 text-neutral-400 hover:text-brand hover:border-brand transition-colors flex-shrink-0"
            aria-label="Guardar en favoritos"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19.5 13.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
            </svg>
          </button>
          <a
            href={ctaHref}
            className="flex-1 bg-brand text-white font-semibold text-base py-3.5 rounded-xl text-center hover:bg-brand-dark active:scale-[0.98] transition-all block"
          >
            {joinMode === 'esperar' && joinTarget ? (
              <>
                <span className="block text-base font-semibold">Reservar plaza · {fmt(joinTarget)} máx.</span>
                <span className="block text-xs font-normal opacity-80">Asegura tu compra a este precio o menos</span>
              </>
            ) : (
              <>
                <span className="block text-base font-semibold">Comprar ahora · {fmt(ctaPrice)}</span>
                <span className="block text-xs font-normal opacity-80">Reservo mi plaza al precio actual</span>
              </>
            )}
          </a>
        </div>
        <p className="text-xs text-neutral-400 text-center mt-2">
          {joinMode === 'esperar'
            ? 'Sin cargos ahora. Cancela cuando quieras.'
            : 'Sin compromiso · Puedes cambiar de opción después'}
        </p>
      </div>

      {/* 6. Group summary (firmes / reservas) */}
      {summary && (
        <div className="bg-white rounded-xl border border-neutral-100 p-4">
          <h3 className="text-sm font-semibold text-neutral-900 mb-3">Resumen del grupo</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-neutral-600">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                Compradores firmes
              </span>
              <span className="text-sm font-semibold text-neutral-900">{summary.firmUnits} uds</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-neutral-600">
                <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                Reservas pendientes
              </span>
              <span className="text-sm font-semibold text-neutral-900">{summary.reserveUnits} uds</span>
            </div>
            {summary.maxStock > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                <span className="text-sm text-neutral-500">Stock máximo</span>
                <span className="text-sm font-semibold text-neutral-900">{summary.maxStock} uds</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. Ficha técnica */}
      <div className="bg-white rounded-xl border border-neutral-100 p-4">
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">Detalles</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">Cierra en</span>
            <span className="font-medium text-neutral-900">{countdownLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Envío estimado</span>
            <span className="font-medium text-neutral-900">3-5 días</span>
          </div>
          {maxStock > 0 && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Stock máximo</span>
              <span className="font-medium text-neutral-900">{maxStock} uds</span>
            </div>
          )}
        </div>
      </div>

      {/* 8. Por qué comprar en grupo */}
      <div className="bg-white rounded-xl border border-neutral-100 p-4">
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">Por qué comprar en grupo</h3>
        <ul className="space-y-2.5">
          {[
            { icon: 'tag', text: 'Precios más bajos que comprando solo' },
            { icon: 'shield', text: 'Pago seguro · Stripe' },
            { icon: 'truck', text: 'Envío incluido a toda España' },
            { icon: 'refresh', text: 'Devoluciones fáciles · 14 días' },
          ].map((item) => (
            <li key={item.text} className="flex items-start gap-2.5 text-sm text-neutral-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 flex-shrink-0 mt-0.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {item.text}
            </li>
          ))}
        </ul>
      </div>

      {/* Trust badges */}
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Pago seguro
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Devoluciones fáciles
        </span>
      </div>
    </aside>
  )
}
