import Link from 'next/link'
import type { GroupProduct } from '@/lib/mock-data'
import { getStepPricing } from '@/lib/mock-data'

function fmt(price: number): string {
  return price.toFixed(2).replace('.', ',') + ' €'
}

function fmtSmart(price: number): string {
  return (price % 1 === 0 ? String(price) : price.toFixed(2).replace('.', ',')) + ' €'
}

export default function ProductCard({ product }: { product: GroupProduct }) {
  const { currentPrice, currentTierMinUnits, nextTier, unitsToNext } =
    getStepPricing(product.tiers, product.currentUnits)

  const discount = Math.round(((product.pvp - currentPrice) / product.pvp) * 100)
  const progress = nextTier
    ? Math.round(
        ((product.currentUnits - currentTierMinUnits) /
          (nextTier.minUnits - currentTierMinUnits)) *
          100
      )
    : 100

  return (
    <Link
      href={`/grupo/${product.id}`}
      className="flex flex-col rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm active:scale-[0.98] transition-transform"
    >
      {/* Image container — 1:1 square, fills card width; swap this div for <img> with object-cover tomorrow */}
      <div className="relative aspect-square w-full overflow-hidden">
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-300"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>

        {/* Units chip — top-left */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 text-[10px] font-semibold text-gray-600 shadow-sm">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {product.currentUnits}&nbsp;/&nbsp;{nextTier ? nextTier.minUnits : product.currentUnits}&nbsp;uds
        </div>

        {/* Discount badge — top-right */}
        <div className="absolute top-2 right-2 bg-brand text-white rounded-full px-2 py-1 text-[10px] font-bold">
          −{discount}%
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col gap-2 p-3 flex-1">
        <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2">
          {product.name}
        </h3>

        <p className="text-[11px] text-gray-400 leading-tight">{product.variant}</p>

        {/* Price row */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-base font-bold text-brand">{fmt(currentPrice)}</span>
          <span className="text-[11px] text-gray-400 line-through">{fmt(product.pvp)}</span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>{progress}% completado</span>
            <span>
              {product.currentUnits}&nbsp;/&nbsp;{nextTier ? nextTier.minUnits : product.currentUnits}&nbsp;uds
            </span>
          </div>
        </div>

        {/* Next-tier savings box */}
        <div className="flex items-center gap-1.5 rounded-xl bg-brand/5 px-2.5 py-2 mt-auto">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-brand flex-shrink-0"
          >
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          <span className="text-[11px] text-brand font-semibold leading-tight">
            {unitsToNext} uds más → {nextTier ? fmtSmart(nextTier.price) : ''}
          </span>
        </div>
      </div>
    </Link>
  )
}
