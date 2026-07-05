'use client'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

interface TierPoint {
  price: number
  unlocked: boolean
}

interface Props {
  pvp: number
  currentPrice: number
  tiers: TierPoint[]
}

export default function PriceJourney({ pvp, currentPrice, tiers }: Props) {
  // Ordenar de más caro a más barato, eliminar duplicados
  const points = [...tiers]
    .sort((a, b) => b.price - a.price)
    .filter((t, i, arr) => i === 0 || t.price !== arr[i - 1].price)

  if (points.length === 0) return null

  const totalDrop = pvp - currentPrice
  const dropPct = pvp > 0 ? Math.round((totalDrop / pvp) * 100) : 0

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
          Así ha bajado el precio
        </p>
        {dropPct > 0 && (
          <span className="text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
            −{dropPct}% desde el precio normal
          </span>
        )}
      </div>

      <div className="relative flex items-center justify-between">
        {/* Línea de fondo */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-green-200 rounded-full" />
        {/* Línea de progreso */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-green-500 rounded-full" />

        {/* PVP como primer punto */}
        <div className="relative flex flex-col items-center z-10">
          <div className="w-6 h-6 rounded-full bg-neutral-200 flex items-center justify-center mb-2">
            <span className="text-[10px] text-neutral-500">×</span>
          </div>
          <span className="text-xs font-medium text-neutral-400 line-through">{fmt(pvp)}</span>
          <span className="text-[10px] text-neutral-400">PVP</span>
        </div>

        {/* Tiers */}
        {points.map((tier) => {
          const isCurrentBest = tier.price === currentPrice
          return (
            <div key={tier.price} className="relative flex flex-col items-center z-10">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center mb-2 ${
                isCurrentBest ? 'bg-green-600 ring-2 ring-green-200' : 'bg-green-500'
              }`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <span className={`text-xs font-semibold ${isCurrentBest ? 'text-green-600' : 'text-neutral-600'}`}>
                {fmt(tier.price)}
              </span>
              {isCurrentBest && (
                <span className="text-[10px] font-semibold text-green-600">Actual</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
