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

export default function JoinModeSelector({
  groupId, tiers, currentPrice, totalUnits, quantity,
  demandTiers, onChange, onProjection,
}: JoinModeSelectorProps) {
  const [mode, setMode] = useState<'comprar' | 'esperar'>('comprar')
  const [collapsed, setCollapsed] = useState(false)
  const [projectedPrice, setProjectedPrice] = useState<number | null>(null)
  const filterPrice = mode === 'comprar' && projectedPrice != null ? Math.min(projectedPrice, currentPrice) : currentPrice

  const waitableTiers = useMemo(() =>
    [...tiers]
      .filter(t => t.price < filterPrice)
      .sort((a, b) => b.price - a.price),
    [tiers, filterPrice, mode]
  )

  const [targetPrice, setTargetPrice] = useState<number>(
    waitableTiers[0]?.price ?? 0
  )

  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchQuote = useCallback(async (m: 'comprar' | 'esperar', tp: number | undefined, qty: number) => {
    try {
      const targetParam = m === 'esperar' && tp != null ? `&target=${tp}` : ''
      const res = await fetch(`/api/group/${groupId}/quote?units=${qty}${targetParam}`)
      const data = await res.json()
      const R = data.pricePerUnit != null ? Number(data.pricePerUnit) : null
      if (R == null) {
        onProjection(null)
        setProjectedPrice(null)
        setCollapsed(false)
        return
      }

      const unlocks = R < currentPrice
      onProjection({ price: R, unlocks })
      setProjectedPrice(R)

      if (m === 'esperar' && tp != null && R <= tp) {
        setCollapsed(true)
        onChange('comprar')
      } else {
        setCollapsed(false)
      }
    } catch {
      onProjection(null)
      setProjectedPrice(null)
      setCollapsed(false)
    }
  }, [groupId, currentPrice, onProjection, onChange])

  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current)
    quoteTimer.current = setTimeout(() => {
      fetchQuote(mode, mode === 'esperar' ? targetPrice : undefined, quantity)
    }, 200)
    return () => { if (quoteTimer.current) clearTimeout(quoteTimer.current) }
  }, [mode, targetPrice, quantity, fetchQuote])

  useEffect(() => {
    if (mode === 'esperar' && !waitableTiers.some(t => t.price === targetPrice)) {
      if (waitableTiers.length > 0) {
        setTargetPrice(waitableTiers[0].price)
        onChange('esperar', waitableTiers[0].price)
      } else {
        setMode('comprar')
        onChange('comprar')
      }
    }
  }, [waitableTiers, mode, targetPrice])

  useEffect(() => {
    if (targetPrice === 0 && waitableTiers.length > 0) {
      setTargetPrice(waitableTiers[0].price)
    }
  }, [waitableTiers, targetPrice])

  if (waitableTiers.length === 0) return null

  const displayComprarPrice = projectedPrice != null ? projectedPrice : currentPrice

  function handleComprar() {
    setMode('comprar')
    setCollapsed(false)
    onChange('comprar')
  }

  function handleEsperar() {
    setMode('esperar')
    onChange('esperar', targetPrice)
  }

  function handleTierClick(price: number) {
    setTargetPrice(price)
    setMode('esperar')
    onChange('esperar', price)
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {/* LEFT: Comprar ahora */}
        <button
          type="button"
          onClick={handleComprar}
          className={`text-left rounded-2xl border-2 p-4 transition-all ${
            mode === 'comprar' || collapsed
              ? 'border-brand bg-brand/5'
              : 'border-neutral-100 bg-white hover:border-neutral-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              mode === 'comprar' || collapsed ? 'bg-brand' : 'border-2 border-neutral-300'
            }`}>
              {(mode === 'comprar' || collapsed) && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
            <span className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-brand">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              Comprar ahora
            </span>
            <span className="text-[10px] font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded-full ml-auto">
              Recomendado
            </span>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed mb-3">
            Compras hoy al precio actual.
            Si el grupo baja de precio antes del cierre, también pagarás el precio más bajo.
          </p>

          <div className="bg-brand/5 rounded-lg px-3 py-2">
            <p className="text-[10px] font-semibold text-brand uppercase tracking-wide mb-0.5">Precio máximo garantizado</p>
            <p className="text-sm font-bold text-brand">{fmtPrice(displayComprarPrice)} por unidad</p>
          </div>
        </button>

        {/* RIGHT: Reservar */}
        <button
          type="button"
          onClick={handleEsperar}
          className={`text-left rounded-2xl border-2 p-4 transition-all ${
            mode === 'esperar' && !collapsed
              ? 'border-brand bg-brand/5'
              : 'border-neutral-100 bg-white hover:border-neutral-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              mode === 'esperar' && !collapsed ? 'bg-brand' : 'border-2 border-neutral-300'
            }`}>
              {mode === 'esperar' && !collapsed && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
            <span className="text-sm font-bold text-neutral-900">Reservar: solo si el precio alcanza...</span>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed mb-3">
            Solo compraremos si el grupo alcanza el precio que elijas o uno mejor.
          </p>

          <div className="flex flex-wrap gap-2">
            {waitableTiers.map(t => (
              <div
                key={t.price}
                onClick={(e) => { e.stopPropagation(); handleTierClick(t.price) }}
                className={`px-3 py-2 rounded-xl text-center cursor-pointer transition-all ${
                  targetPrice === t.price && mode === 'esperar' && !collapsed
                    ? 'bg-brand text-white'
                    : 'bg-neutral-50 border border-neutral-200 text-neutral-700 hover:border-brand'
                }`}
              >
                <p className={`text-sm font-bold ${targetPrice === t.price && mode === 'esperar' && !collapsed ? 'text-white' : 'text-neutral-900'}`}>
                  {fmtPrice(t.price)}
                </p>
                <p className={`text-[10px] ${targetPrice === t.price && mode === 'esperar' && !collapsed ? 'text-white/80' : 'text-neutral-400'}`}>
                  {t.minUnits} uds
                </p>
              </div>
            ))}
          </div>
        </button>
      </div>

      {collapsed && (
        <p className="text-xs text-green-600 font-medium px-1 mt-2">
          Tu precio objetivo de {fmtPrice(targetPrice)} ya se alcanza con tu entrada. Compra directamente.
        </p>
      )}

      {mode === 'esperar' && !collapsed && (
        <div className="flex items-center gap-2 mt-3 p-3 bg-neutral-50 rounded-xl">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-neutral-400 flex-shrink-0">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <p className="text-xs text-neutral-500">
            No se realizará ningún cargo a tu tarjeta hasta que se cumpla tu condición.
          </p>
        </div>
      )}
    </div>
  )
}
