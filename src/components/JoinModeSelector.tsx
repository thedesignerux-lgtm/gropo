'use client'
import { useState, useMemo, useEffect } from 'react'
type Tier = { minUnits: number; price: number }
function fmtPrice(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}
function fmtPill(n: number): string {
  if (n % 1 === 0) return n + '€'
  return n.toFixed(2).replace('.', ',') + '€'
}
interface JoinModeSelectorProps {
  tiers: Tier[]
  currentPrice: number
  totalUnits: number
  onChange: (mode: 'comprar' | 'esperar', targetPrice?: number) => void
}
export default function JoinModeSelector({ tiers, currentPrice, totalUnits, onChange }: JoinModeSelectorProps) {
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
  if (waitableTiers.length === 0) return null
  function handleComprar() {
    setMode('comprar')
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
      <h3 className="text-sm font-semibold text-neutral-900 mb-3">Elige cómo participar</h3>
      <div className="flex flex-col gap-2">
        {/* Comprar ahora */}
        <button
          type="button"
          onClick={handleComprar}
          className={`w-full text-left rounded-xl border-2 p-3.5 transition-all ${
            mode === 'comprar'
              ? 'border-brand bg-brand/5'
              : 'border-neutral-100 bg-white hover:border-neutral-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              mode === 'comprar' ? 'border-brand' : 'border-neutral-300'
            }`}>
              {mode === 'comprar' && <div className="w-2.5 h-2.5 rounded-full bg-brand" />}
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
        {/* Comprar cuando alcance */}
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
              {waitableTiers.map(t => (
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
                  {fmtPill(t.price)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
