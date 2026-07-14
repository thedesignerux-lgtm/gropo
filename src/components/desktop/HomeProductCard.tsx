import Link from 'next/link'
import type { GroupProduct } from '@/lib/mock-data'
import { getStepPricing } from '@/lib/mock-data'
import FavoriteButton from '@/components/FavoriteButton'

function fmt(price: number): string {
  return (price % 1 === 0 ? String(price) : price.toFixed(2).replace('.', ',')) + ' €'
}

// Unsplash placeholders by keyword (cycling-related)
const UNSPLASH_IMAGES = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop&q=80', // cycling
  'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop&q=80', // bike tire
  'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=400&h=300&fit=crop&q=80', // cycling gear
  'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=400&h=300&fit=crop&q=80', // road bike
  'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=400&h=300&fit=crop&q=80', // bicycle
  'https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?w=400&h=300&fit=crop&q=80', // bike parts
]

function getPlaceholderImage(id: string): string {
  // Deterministic pick based on group id
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  return UNSPLASH_IMAGES[Math.abs(hash) % UNSPLASH_IMAGES.length]
}

interface Props {
  product: GroupProduct
  isFavorited?: boolean
}

export default function HomeProductCard({ product, isFavorited = false }: Props) {
  const { currentPrice, nextTier, unitsToNext } = getStepPricing(product.tiers, product.currentUnits)
  const isComplete = !nextTier
  const missing = nextTier ? unitsToNext : 0
  const toPrice = nextTier ? nextTier.price : currentPrice
  const savings = product.pvp > currentPrice ? product.pvp - currentPrice : 0
  const savingsPct = product.pvp > 0 ? Math.round((savings / product.pvp) * 100) : 0
  const imageUrl = product.imageUrl || getPlaceholderImage(product.id)

  return (
    <Link
      href={`/grupo/${product.id}`}
      className="group flex-shrink-0 w-[280px] rounded-2xl bg-white border border-neutral-200 overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className="relative w-full h-[180px] bg-neutral-100 overflow-hidden">
        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {/* Badge top-left */}
        <span className={`absolute top-3 left-3 inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2.5 py-1 backdrop-blur-sm ${
          isComplete
            ? 'bg-green-500/90 text-white'
            : missing > 0 && missing < 4
            ? 'bg-orange-500/90 text-white'
            : 'bg-white/90 text-neutral-800'
        }`}>
          {isComplete ? 'Mejor precio' : `Faltan ${missing} uds`}
        </span>
        {/* Favorite top-right */}
        <div className="absolute top-3 right-3">
          <FavoriteButton
            groupId={product.id}
            initialFavorited={isFavorited}
            size={16}
            icon="heart"
            className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white flex items-center justify-center"
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-sm font-bold text-neutral-900 leading-tight line-clamp-2 mb-1">{product.name}</h3>
        {product.variant && (
          <p className="text-xs text-neutral-500 mb-2 line-clamp-1">{product.variant}</p>
        )}

        {/* Prices row */}
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-lg font-extrabold text-neutral-900 tabular-nums">{fmt(currentPrice)}</span>
          {product.pvp > currentPrice && (
            <span className="text-sm text-neutral-400 line-through tabular-nums">{fmt(product.pvp)}</span>
          )}
          {savingsPct > 0 && (
            <span className="text-xs font-bold text-green-600">-{savingsPct}%</span>
          )}
        </div>

        {/* Progress info */}
        {!isComplete && nextTier && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1">
              <span>Siguiente: <b className="text-brand">{fmt(toPrice)}</b></span>
              <span className="text-neutral-400">{product.currentUnits}/{nextTier.minUnits} uds</span>
            </div>
            <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all"
                style={{ width: `${Math.min(100, (product.currentUnits / nextTier.minUnits) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {isComplete && (
          <p className="text-xs font-semibold text-green-600 mb-3">Mejor precio alcanzado</p>
        )}

        {/* Footer: participants */}
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <div className="flex -space-x-1">
            {Array.from({ length: Math.min(3, Math.max(1, product.currentUnits)) }).map((_, i) => (
              <div key={i} className="w-5 h-5 rounded-full bg-neutral-200 border-[1.5px] border-white flex items-center justify-center text-[8px] font-bold text-neutral-500">
                {String.fromCharCode(65 + i)}
              </div>
            ))}
          </div>
          <span>{product.currentUnits} {product.currentUnits === 1 ? 'persona' : 'personas'}</span>
        </div>
      </div>
    </Link>
  )
}
