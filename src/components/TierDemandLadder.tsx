'use client'

import { useTierDemand, type TierRow } from '@/hooks/useTierDemand'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

interface PropsWithGroupId { groupId: string; tiers?: undefined; currentPrice?: undefined }
interface PropsWithData { groupId?: undefined; tiers: TierRow[]; currentPrice: number }
type Props = PropsWithGroupId | PropsWithData

export default function TierDemandLadder(props: Props) {
  const hook = useTierDemand(props.groupId ?? '')
  const tiers = props.tiers ?? hook.tiers
  const loading = props.tiers ? false : hook.loading

  if (loading || tiers.length === 0) return null

  const unlockedTiers = tiers.filter(t => t.unlocked)
  const currentPrice = props.currentPrice ?? (
    unlockedTiers.length > 0 ? Math.min(...unlockedTiers.map(t => t.price)) : Math.max(...tiers.map(t => t.price))
  )

  const sorted = [...tiers].sort((a, b) => b.price - a.price)

  const filtered = sorted.filter(t => {
    if (t.unlocked || t.price === currentPrice) return true
    if (t.price > currentPrice) return false
    const missing = Math.max(0, t.minUnits - t.demand)
    return !sorted.some(other =>
      other.price < t.price && !other.unlocked && other.price < currentPrice &&
      Math.max(0, other.minUnits - other.demand) <= missing
    )
  })

  return (
    <div className="bg-white rounded-xl border border-neutral-100 p-5">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-semibold text-neutral-900">Cómo baja el precio</h3>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-400 cursor-help">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      </div>
      <p className="text-xs text-neutral-500 mb-4">Cuantos más compradores, menor será el precio para todos.</p>

      <div className="flex items-center w-full">
        {filtered.map((t, i) => {
          const isCurrent = t.price === currentPrice
          const isEffectivelyUnlocked = t.unlocked || t.price >= currentPrice
          const missing = Math.max(0, t.minUnits - t.demand)

          return (
            <div key={t.price} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-shrink-0">
                <span className={`text-xs font-semibold mb-1.5 whitespace-nowrap ${
                  isCurrent ? 'text-brand' : isEffectivelyUnlocked ? 'text-green-600' : 'text-neutral-700'
                }`}>{fmt(t.price)}</span>

                {isEffectivelyUnlocked ? (
                  <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center ${
                    isCurrent ? 'w-[26px] h-[26px] bg-brand ring-3 ring-brand/20' : 'bg-brand'
                  }`}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                ) : (
                  <div className="w-[22px] h-[22px] rounded-full bg-white border-2 border-neutral-300" />
                )}

                <span className={`text-[10px] mt-1.5 whitespace-nowrap ${
                  isCurrent ? 'text-brand font-semibold' : isEffectivelyUnlocked ? 'text-green-600' : 'text-neutral-400'
                }`}>
                  {isCurrent ? 'Actual' : isEffectivelyUnlocked ? 'Alcanzado' : missing > 0 ? `Faltan ${missing} compras` : ''}
                </span>
              </div>

              {i < filtered.length - 1 && (() => {
                const nextT = filtered[i + 1]
                const nextEffective = nextT.unlocked || nextT.price >= currentPrice
                const lineUnlocked = isEffectivelyUnlocked && nextEffective
                const frac = isEffectivelyUnlocked && !nextEffective && nextT.minUnits > 0
                  ? Math.min(1, nextT.demand / nextT.minUnits) : (lineUnlocked ? 1 : 0)
                return (
                  <div className="flex-1 h-[3px] bg-neutral-200 rounded-full overflow-hidden mx-1">
                    <div className="h-full bg-brand rounded-full" style={{ width: `${frac * 100}%`, transition: 'width 300ms ease' }}/>
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>
    </div>
  )
}
