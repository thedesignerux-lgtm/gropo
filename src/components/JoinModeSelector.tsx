'use client'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import type { TierRow } from '@/hooks/useTierDemand'

type Tier = { minUnits: number; price: number }

function fmtPrice(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

export interface ProjectionResult {
  price: number
  unlocks: boolean
}

interface JoinModeSelectorProps {
  groupId: string
  tiers: Tier[]
  currentPrice: number
  totalUnits: number
  quantity: number
  demandTiers?: TierRow[]
  onChange: (mode: 'comprar' | 'esperar', targetPrice?: number) => void
  onProjection: (result: ProjectionResult | null) => void
}

function getViabilityLabel(missing: number, isFirst: boolean, isLast: boolean): { text: string; color: string } {
  if (missing === 0 || isFirst) return { text: 'Disponible ahora', color: 'text-green-600' }
  if (missing <= 3) return { text: `Muy cerca (${missing} compra${missing !== 1 ? 's' : ''})`, color: 'text-orange-600' }
  if (missing <= 8) return { text: `A medio camino (${missing} compras)`, color: 'text-orange-500' }
  if (isLast) return { text: `Objetivo final (${missing} compras)`, color: 'text-neutral-500' }
  return { text: `Faltan ${missing} compras`, color: 'text-neutral-500' }
}

export default function JoinModeSelector({
  groupId, tiers, currentPrice, totalUnits, quantity,
  demandTiers, onChange, onProjection,
}: JoinModeSelectorProps) {
  const allTiers = useMemo(() =>
    [...tiers].sort((a, b) => b.price - a.price),
    [tiers]
  )

  const [selectedPrice, setSelectedPrice] = useState<number>(currentPrice)
  const [projectedPrice, setProjectedPrice] = useState<number | null>(null)

  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchQuote = useCallback(async (price: number, qty: number) => {
    try {
      const isEsperar = price < currentPrice
      const targetParam = isEsperar ? `&target=${price}` : ''
      const res = await fetch(`/api/group/${groupId}/quote?units=${qty}${targetParam}`)
      const data = await res.json()
      const R = data.pricePerUnit != null ? Number(data.pricePerUnit) : null
      if (R == null) {
        onProjection(null)
        setProjectedPrice(null)
        return
      }
      onProjection({ price: R, unlocks: R < currentPrice })
      setProjectedPrice(R)
    } catch {
      onProjection(null)
      setProjectedPrice(null)
    }
  }, [groupId, currentPrice, onProjection])

  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current)
    quoteTimer.current = setTimeout(() => {
      fetchQuote(selectedPrice, quantity)
    }, 200)
    return () => { if (quoteTimer.current) clearTimeout(quoteTimer.current) }
  }, [selectedPrice, quantity, fetchQuote])

  useEffect(() => {
    if (selectedPrice > currentPrice) {
      setSelectedPrice(currentPrice)
      onChange('comprar')
    }
  }, [currentPrice])

  function handleSelect(price: number) {
    setSelectedPrice(price)
    if (price >= currentPrice) {
      onChange('comprar')
    } else {
      onChange('esperar', price)
    }
  }

  if (allTiers.length <= 1) return null

  return (
    <div>
      <h2 className="text-base font-bold text-neutral-900 mb-1">¿Cuál es el máximo que pagarías?</h2>
      <p className="text-xs text-neutral-500 mb-4">
        Nunca pagarás más de lo que elijas. Si el precio baja, pagas menos automáticamente.
      </p>

      <div className="space-y-2">
        {allTiers.map((t, i) => {
          const isSelected = selectedPrice === t.price
          const isCurrent = t.price >= currentPrice
          const dt = demandTiers?.find(d => d.price === t.price)
          const missing = dt ? Math.max(0, dt.minUnits - dt.demand) : t.minUnits
          const isFirst = i === 0
          const isLast = i === allTiers.length - 1
          const viability = isCurrent && isFirst
            ? { text: 'Disponible ahora', color: 'text-green-600' }
            : getViabilityLabel(missing, false, isLast)

          return (
            <button
              key={t.price}
              type="button"
              onClick={() => handleSelect(t.price)}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-brand bg-brand/5'
                  : 'border-neutral-100 bg-white hover:border-neutral-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-brand' : 'border-2 border-neutral-300'
                }`}>
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
                <span className={`text-base font-bold ${isSelected ? 'text-neutral-900' : 'text-neutral-700'}`}>
                  {fmtPrice(t.price)}
                </span>
              </div>
              <span className={`text-xs font-medium ${viability.color}`}>
                {viability.text}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2 mt-4 p-3 bg-brand/5 rounded-xl">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand flex-shrink-0">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        <p className="text-xs text-neutral-600">
          Tu compra acerca al grupo al siguiente descuento.
        </p>
      </div>
    </div>
  )
}
