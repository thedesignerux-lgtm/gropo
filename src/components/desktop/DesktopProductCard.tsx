import Link from 'next/link'
import type { GroupProduct } from '@/lib/mock-data'
import { getStepPricing, getActivationState, getMilestones } from '@/lib/mock-data'
import FavoriteButton from '@/components/FavoriteButton'

function fmt(price: number): string {
  return price.toFixed(2).replace('.', ',') + ' €'
}

function fmtSmart(price: number): string {
  return (price % 1 === 0 ? String(price) : price.toFixed(2).replace('.', ',')) + ' €'
}

interface Props {
  product: GroupProduct
  isFavorited?: boolean
}

export default function DesktopProductCard({ product, isFavorited = false }: Props) {
  const { currentPrice } = getStepPricing(product.tiers, product.currentUnits)
  const { activated, unitsToActivate, nextTier, unitsToNext } =
    getActivationState(product.tiers, product.currentUnits, product.minExecution)
  const milestones = getMilestones(product.tiers, product.minExecution)

  const discount = product.pvp > 0 ? Math.round(((product.pvp - currentPrice) / product.pvp) * 100) : 0
  const isComplete = activated && !nextTier
  const savingsPerPerson = nextTier ? currentPrice - nextTier.price : 0

  const progressTarget = !activated
    ? product.minExecution
    : nextTier ? nextTier.minUnits : product.currentUnits

  return (
    <Link
      href={`/grupo/${product.id}`}
      className={`group flex flex-col rounded-2xl overflow-hidden bg-white border-2 transition-all hover:shadow-md ${
        isComplete ? 'border-brand-green' : 'border-neutral-100 hover:border-neutral-200'
      }`}
    >
      {isComplete && (
        <div className="bg-brand-green/10 px-3 py-2 flex items-center gap-2">
          <span className="text-brand-green text-xs font-bold uppercase tracking-wide">
            ¡PRECIO MÍNIMO ALCANZADO!
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-green ml-auto">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
      )}

      <div className="relative aspect-square w-full overflow-hidden bg-[#F5F5F5]">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}

        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 text-[11px] font-semibold text-neutral-600 shadow-sm">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {product.currentUnits} / {progressTarget} uds
        </div>

        <div className="absolute top-2.5 right-2.5">
          <FavoriteButton
            groupId={product.id}
            initialFavorited={isFavorited}
            size={16}
            className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm shadow-sm"
          />
        </div>

        {product.pvp > 0 && discount > 0 && (
          <div className="absolute bottom-2.5 right-2.5 bg-brand text-white rounded-full px-2.5 py-1 text-xs font-bold shadow-sm">
            −{discount}%
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 p-3.5 flex-1">
        <h3 className="font-bold text-neutral-900 text-sm leading-tight line-clamp-2">
          {product.name}
        </h3>
        {product.variant && (
          <p className="text-xs text-neutral-400 leading-tight">{product.variant}</p>
        )}

        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-lg font-bold ${activated ? 'text-brand' : 'text-neutral-900'}`}>
            {fmt(currentPrice)}
          </span>
          {product.pvp > 0 && (
            <span className="text-xs text-neutral-400 line-through">{fmt(product.pvp)}</span>
          )}
        </div>

        <div>
          <div className="flex h-2 rounded-full overflow-hidden gap-px bg-white">
            {milestones.map((m, i) => {
              const start = i === 0 ? 0 : milestones[i - 1].units
              const span = m.units - start
              const fillPct = span > 0
                ? Math.max(0, Math.min(1, (product.currentUnits - start) / span)) * 100
                : (product.currentUnits >= m.units ? 100 : 0)
              const bg = fillPct >= 100
                ? '#0F9D58'
                : fillPct > 0
                ? `linear-gradient(to right, #0F9D58 ${fillPct}%, rgba(15,157,88,0.12) ${fillPct}%)`
                : '#E5E7EB'
              return <div key={m.units} className="flex-1 rounded-full" style={{ background: bg }} />
            })}
          </div>
          <div className="flex justify-end text-[10px] text-neutral-400 mt-1">
            {product.currentUnits} / {progressTarget} uds
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-brand/5 px-3 py-2.5 mt-auto">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand flex-shrink-0 mt-0.5">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          <div>
            <span className="text-xs text-brand font-semibold leading-tight block">
              {!activated
                ? `${unitsToActivate} más personas → ${fmtSmart(product.tiers[0].price)}`
                : nextTier
                ? `${unitsToNext} más personas → ${fmtSmart(nextTier.price)}`
                : '¡Precio mínimo alcanzado!'}
            </span>
            {nextTier && savingsPerPerson > 0.01 && (
              <span className="text-[11px] text-neutral-500 block mt-0.5">
                Ahorro {fmtSmart(savingsPerPerson)} por persona
              </span>
            )}
          </div>
        </div>

        {product.currentUnits > 0 && (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex -space-x-1.5">
              {Array.from({ length: Math.min(3, product.currentUnits) }).map((_, i) => (
                <div key={i} className="w-6 h-6 rounded-full bg-neutral-200 border-2 border-white flex items-center justify-center text-[9px] font-bold text-neutral-500">
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
              {product.currentUnits > 3 && (
                <div className="w-6 h-6 rounded-full bg-neutral-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-neutral-500">
                  +{product.currentUnits - 3}
                </div>
              )}
            </div>
            <span className="text-xs text-neutral-500">
              {product.currentUnits} comprando ahora
            </span>
          </div>
        )}
      </div>

      {isComplete && (
        <div className="px-3.5 pb-3.5">
          <div className="bg-brand-green/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-brand-green text-xs">🎉</span>
            <span className="text-xs font-medium text-brand-green">
              ¡Precio mínimo alcanzado! Se mantiene en {fmtSmart(currentPrice)}
            </span>
          </div>
        </div>
      )}
    </Link>
  )
}
