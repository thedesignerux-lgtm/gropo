'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { GroupProduct } from '@/lib/mock-data'
import { getStepPricing } from '@/lib/mock-data'
import { useCheckout } from '@/components/checkout/CheckoutProvider'
import { usePulse } from '@/hooks/usePulse'
import FavoriteButton from '@/components/FavoriteButton'
import VondaTargetSlider, { type Detent } from '@/components/VondaTargetSlider'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

// Unsplash placeholders (cycling-related) — hasta que exista imagen real
const UNSPLASH_IMAGES = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop&q=80',
  'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop&q=80',
  'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=400&h=300&fit=crop&q=80',
  'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=400&h=300&fit=crop&q=80',
  'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=400&h=300&fit=crop&q=80',
  'https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?w=400&h=300&fit=crop&q=80',
]

function getPlaceholderImage(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  return UNSPLASH_IMAGES[Math.abs(hash) % UNSPLASH_IMAGES.length]
}

interface Props {
  product: GroupProduct
  isFavorited?: boolean
  isAuthed?: boolean
}

export default function HomeProductCard({ product, isFavorited = false, isAuthed = false }: Props) {
  const { open } = useCheckout()
  const router = useRouter()

  const { currentPrice, nextTier, unitsToNext } = getStepPricing(product.tiers, product.currentUnits)
  const isComplete = !nextTier
  const missing = nextTier ? unitsToNext : 0
  const savings = product.pvp > currentPrice ? product.pvp - currentPrice : 0
  const imageUrl = product.imageUrl || getPlaceholderImage(product.id)
  const href = `/grupo/${product.id}`

  // Detents: tramos ordenados por minUnits asc (= precio desc), como en el diseño
  const detents: Detent[] = [...product.tiers]
    .sort((a, b) => a.minUnits - b.minUnits)
    .map(t => ({ price: t.price, uds: t.minUnits }))

  // Índice del tramo actual dentro de los detents
  let curIdx = 0
  for (let i = 0; i < detents.length; i++) {
    if (detents[i].uds <= product.currentUnits) curIdx = i
  }

  const [selIdx, setSelIdx] = useState(curIdx)
  const { data: pulseData } = usePulse(isComplete ? null : product.id)
  const selectedPrice = detents.length > 0 ? detents[selIdx].price : currentPrice
  const confirmed = selIdx <= curIdx

  const accent = confirmed ? '#6C4BF4' : '#E8944A'
  const ctaBg = confirmed ? 'rgba(108,75,244,.10)' : 'rgba(232,148,74,.12)'
  const ctaText = confirmed
    ? `Asegurar plaza · ${fmt(selectedPrice)}`
    : `Reservar plaza · Máx. ${fmt(selectedPrice)}`

  const handleCheckout = () => {
    if (!confirmed) {
      router.push(`${href}/unirme?mode=esperar&target=${selectedPrice}`)
    } else if (isAuthed) {
      open({
        groupId: product.id,
        productName: product.name,
        productSpec: product.variant,
        imageUrl,
        quantity: 1,
        maxPricePerUnit: selectedPrice,
      })
    } else {
      router.push(`${href}/unirme`)
    }
  }

  return (
    <div className="flex-shrink-0 w-[300px] rounded-2xl bg-white border border-neutral-200 overflow-hidden flex flex-col transition-shadow hover:shadow-lg">
      {/* Image */}
      <Link href={href} className="relative block w-full overflow-hidden group" style={{ aspectRatio: '1 / 0.72', background: '#F1EEFA' }}>
        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {/* Faltan pill */}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1 text-[11.5px] font-extrabold rounded-full px-2.5 py-1 bg-white/95 text-brand shadow-sm">
          {isComplete ? '✓ Mejor precio' : `↓ Faltan ${missing} uds`}
        </span>
        {/* Favorite */}
        <div className="absolute top-2.5 right-2.5">
          <FavoriteButton
            groupId={product.id}
            initialFavorited={isFavorited}
            size={16}
            icon="heart"
            className="w-8 h-8 rounded-full bg-white/95 hover:bg-white flex items-center justify-center"
          />
        </div>
      </Link>

      {/* Content */}
      <div className="p-3.5 pt-3 flex flex-col flex-1">
        <Link href={href} className="block">
          <div className="text-[14.5px] font-bold text-neutral-900 leading-tight line-clamp-1">{product.name}</div>
          {product.variant && (
            <div className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{product.variant}</div>
          )}
          <div className="flex items-baseline gap-2 mt-2.5">
            <span className="text-[18px] font-extrabold text-neutral-900 tabular-nums">{fmt(currentPrice)}</span>
            {!isComplete && nextTier && (
              <span className="text-xs text-neutral-500">luego {fmt(nextTier.price)}</span>
            )}
          </div>
          {savings > 0 && (
            <div className="text-xs font-bold text-[#157F52] mt-2">Ahorra {fmt(savings)}</div>
          )}
        </Link>

        {/* Interactive target slider */}
        {detents.length > 1 ? (
          <div className="mt-2.5">
            <VondaTargetSlider detents={detents} curIdx={curIdx} selIdx={selIdx} onSelIdx={setSelIdx} size="mini" pulse={pulseData?.steps} glow={pulseData?.glow} />
          </div>
        ) : (
          <div className="mt-3" />
        )}

        {/* CTA */}
        <button
          type="button"
          onClick={handleCheckout}
          className="w-full mt-auto font-extrabold text-[13px] rounded-xl cursor-pointer transition-colors active:scale-[0.99] whitespace-nowrap"
          style={{ border: `2px solid ${accent}`, background: ctaBg, color: accent, padding: '12px 10px', marginTop: 14, boxShadow: `0 12px 26px -14px ${confirmed ? 'rgba(108,75,244,.28)' : 'rgba(232,148,74,.28)'}` }}
        >
          {ctaText}
        </button>
      </div>
    </div>
  )
}
