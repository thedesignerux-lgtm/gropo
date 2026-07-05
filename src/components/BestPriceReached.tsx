'use client'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

interface Props {
  currentPrice: number
  pvp: number
  maxStock: number
  totalDemand: number
}

export default function BestPriceReached({ currentPrice, pvp, maxStock, totalDemand }: Props) {
  const savings = pvp - currentPrice
  const savingsPct = pvp > 0 ? Math.round((savings / pvp) * 100) : 0
  const remaining = Math.max(0, maxStock - totalDemand)

  return (
    <div className="space-y-4">
      {/* Banner verde */}
      <div className="bg-green-50 rounded-2xl border border-green-200 p-5">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div>
            <p className="text-base font-bold text-neutral-900">Máximo descuento desbloqueado</p>
            <p className="text-sm text-neutral-600 mt-1">
              El grupo alcanzó el volumen necesario y desbloqueó el mejor precio.
            </p>
            <p className="text-sm font-semibold text-green-600 mt-1">
              Tu precio de {fmt(currentPrice)} está garantizado.
            </p>
          </div>
        </div>
      </div>

      {/* Fila de stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-neutral-100 p-4 text-center">
          <p className="text-2xl font-bold text-brand tabular-nums">{remaining}</p>
          <p className="text-xs text-neutral-500 mt-1">unidades disponibles</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-100 p-4 text-center">
          <p className="text-2xl font-bold text-green-600 tabular-nums">{savingsPct}%</p>
          <p className="text-xs text-neutral-500 mt-1">de ahorro conseguido</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-100 p-4 text-center">
          <p className="text-2xl font-bold text-brand tabular-nums">{fmt(savings)}</p>
          <p className="text-xs text-neutral-500 mt-1">menos que el precio normal</p>
        </div>
      </div>

      {/* Urgencia */}
      {remaining > 0 && (
        <div className="bg-orange-50 rounded-xl border border-orange-200 px-4 py-3 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600 flex-shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-sm text-orange-800">
            <span className="font-semibold">¡No te quedes sin el tuyo!</span>{' '}
            Solo quedan {remaining} unidades disponibles al precio mínimo.
          </p>
        </div>
      )}
    </div>
  )
}
