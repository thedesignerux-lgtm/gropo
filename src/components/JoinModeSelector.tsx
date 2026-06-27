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
  const waitableTiers = useMemo(() =>
    [...tiers]
      .filter(t => t.price < currentPrice)
      .sort((a, b) => b.price - a.price),
    [tiers, currentPrice]
  )

  const [mode, setMode] = useState<'comprar' | 'esperar'>('comprar')
  const [targetPrice, setTargetPrice] = useState<number>(
    waitableTiers[0]?.price ?? 0
  )
  const [collapsed, setCollapsed] = useState(false)

  // Debounce quote calls
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchQuote = useCallback(async (m: 'comprar' | 'esperar', tp: number | undefined, qty: number) => {
    try {
      const targetParam = m === 'esperar' && tp != null ? `&target=${tp}` : ''
      const res = await fetch(`/api/group/${groupId}/quote?units=${qty}${targetParam}`)
      const data = await res.json()
      const R = data.pricePerUnit != null ? Number(data.pricePerUnit) : null
      if (R == null) {
        onProjection(null)
        setCollapsed(false)
        return
      }

      const unlocks = R < currentPrice
      onProjection({ price: R, unlocks })

      // Collapse: esperar with target already reached
      if (m === 'esperar' && tp != null && R <= tp) {
        setCollapsed(true)
      } else {
        setCollapsed(false)
      }
    } catch {
      onProjection(null)
      setCollapsed(false)
    }
  }, [groupId, currentPrice, onProjection])

  // Fetch quote whenever mode, target, or quantity changes
  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current)
    quoteTimer.current = setTimeout(() => {
      fetchQuote(mode, mode === 'esperar' ? targetPrice : undefined, quantity)
    }, 200)
    return () => { if (quoteTimer.current) clearTimeout(quoteTimer.current) }
  }, [mode, targetPrice, quantity, fetchQuote])

  // Sync target if tiers change
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

  // Sync targetPrice when data arrives after mount
  useEffect(() => {
    if (targetPrice === 0 && waitableTiers.length > 0) {
      setTargetPrice(waitableTiers[0].price)
    }
  }, [waitableTiers, targetPrice])

  if (waitableTiers.length === 0) return null

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

  // Compute missing for each waitable tier from demandTiers
  function getMissing(tierPrice: number): number | null {
    if (!demandTiers) return null
    const dt = demandTiers.find(d => d.price === tierPrice)
    if (!dt) return null
    return Math.max(0, dt.minUnits - dt.demand)
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900 mb-3">Elige cómo participar</h3>
      <div className="flex flex-col gap-2">
        {/* Comprar ahora */}
        <button
          type="button"
          onClick={handleComprar}
          className={`w-full text-left rounded-xl border-2 p-3.5 transition-all ${
            mode === 'comprar' || collapsed
              ? 'border-brand bg-brand/5'
              : 'border-neutral-100 bg-white hover:border-neutral-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              mode === 'comprar' || collapsed ? 'border-brand' : 'border-neutral-300'
            }`}>
              {(mode === 'comprar' || collapsed) && <div className="w-2.5 h-2.5 rounded-full bg-brand" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold text-neutral-900">Comprar ahora</p>
                <span className="text-sm font-bold text-neutral-900">{fmtPrice(currentPrice)}</span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">Reservo mi plaza al precio actual.</p>
            </div>
          </div>
        </button>

        {/* Esperar a precio */}
        {!collapsed && (
          <div
            className={`rounded-xl border-2 transition-all ${
              mode === 'esperar'
                ? 'border-brand bg-brand/5'
                : 'border-neutral-100 bg-white hover:border-neutral-200'
            }`}
          >
            <button
              type="button"
              onClick={handleEsperar}
              className="w-full text-left p-3.5"
            >
              <div className="flex items-center gap-3">
                <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  mode === 'esperar' ? 'border-brand' : 'border-neutral-300'
                }`}>
                  {mode === 'esperar' && <div className="w-2.5 h-2.5 rounded-full bg-brand" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-semibold text-neutral-900">Comprar cuando alcance:</p>
                    <span className="text-sm font-bold text-brand">{fmtPrice(targetPrice)}</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Te avisaremos y reservarás tu plaza automáticamente.
                  </p>
                </div>
              </div>
            </button>

            {mode === 'esperar' && (
              <div className="flex gap-2 px-3.5 pb-3.5 ml-[30px] overflow-x-auto">
                {waitableTiers.map(t => {
                  return (
                    <button
                      key={t.price}
                      type="button"
                      onClick={() => handleTierClick(t.price)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        targetPrice === t.price
                          ? 'bg-brand text-white'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      {fmtPrice(t.price)}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Collapse note */}
        {collapsed && (
          <p className="text-xs text-green-600 font-medium px-1">
            Tu precio objetivo de {fmtPrice(targetPrice)} ya se alcanza con tu entrada. Compra directamente.
          </p>
        )}
      </div>
    </div>
  )
}
