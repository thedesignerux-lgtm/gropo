'use client'

import Link from 'next/link'
import Image from 'next/image'
import FavoriteButton from '@/components/FavoriteButton'
import type { GroupProduct } from '@/lib/mock-data'

/* ───────────────────────── tipos ───────────────────────── */

export type CardStatus = 'new' | 'active' | 'top_seller' | 'almost_reached'

export interface ExploreProductCardProps {
  group: GroupProduct
  status: CardStatus
  currentPrice: number
  unitsToNext: number
  nextTierPrice?: number
  nextTierMinUnits?: number
  initialFavorited?: boolean
}

/* ───────────────────────── helpers ─────────────────────── */

/**
 * Formatea un precio para tarjetas de catálogo:
 * - Sin decimales si la cifra es entera (819 €, 1.100 €).
 * - Con 2 decimales y coma si tiene céntimos (49,95 €).
 * - Separador de miles con punto (estándar ES).
 */
function fmtPrice(n: number): string {
  const isRound = n % 1 === 0
  if (isRound) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €'
  }
  const [int, dec] = n.toFixed(2).split('.')
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec + ' €'
}

function getBadge(status: CardStatus) {
  switch (status) {
    case 'new':
      return { label: 'Nuevo', bg: 'bg-blue-100', text: 'text-blue-700' }
    case 'top_seller':
      return { label: 'Top ventas', bg: 'bg-amber-100', text: 'text-amber-700' }
    case 'almost_reached':
      return { label: '¡Casi conseguido!', bg: 'bg-orange-100', text: 'text-orange-700' }
    default:
      return null
  }
}

/* ───────────────────────── componente ──────────────────── */

export default function ExploreProductCard({
  group,
  status,
  currentPrice,
  unitsToNext,
  nextTierPrice,
  nextTierMinUnits,
  initialFavorited = false,
}: ExploreProductCardProps) {
  /* ── cálculos ── */
  const discount = group.pvp > 0
    ? Math.round(((group.pvp - currentPrice) / group.pvp) * 100)
    : 0

  /* Coherencia de datos: solo mostrar siguiente precio si es MENOR al actual */
  const hasValidNextTier =
    nextTierPrice != null &&
    nextTierMinUnits != null &&
    nextTierPrice < currentPrice &&
    unitsToNext > 0

  /* ── barra de progreso adaptativa ── */
  const progress = hasValidNextTier
    ? (group.currentUnits / nextTierMinUnits!) * 100
    : 0
  // Visible en grupos no-nuevos con progreso real (>5 %).
  // El ancho natural comunica la intensidad: un 8 % es sutil, un 90 % es prominente.
  const showProgress = status !== 'new' && hasValidNextTier && progress >= 5
  // Mayor presencia visual en grupos avanzados o casi alcanzados
  const progressHeight = progress >= 60 || status === 'almost_reached' ? 'h-2' : 'h-1.5'

  const badge = getBadge(status)

  /* ── footer ── */
  const footerText = (() => {
    if (status === 'new') return '👥 Grupo recién abierto'
    if (hasValidNextTier) return `👥 ${group.currentUnits} / ${nextTierMinUnits} compradores`
    // Sin siguiente tramo (ya en el mejor precio): solo mostrar el total
    return `👥 ${group.currentUnits} compradores`
  })()

  /* ── bloque de oportunidad ── */
  const opportunityBlock = (() => {
    if (status === 'new') {
      return (
        <div className="bg-blue-50 text-blue-700 text-xs font-medium px-3 py-2 rounded-lg">
          Inicia el grupo y consigue el primer descuento
        </div>
      )
    }
    if (hasValidNextTier) {
      return (
        <div className="bg-teal-50 text-teal-700 text-xs font-medium px-3 py-2 rounded-lg">
          Faltan {unitsToNext} compradores para {fmtPrice(nextTierPrice!)}
        </div>
      )
    }
    return null
  })()

  /* ── render ── */
  return (
    <Link href={`/grupo/${group.id}`} className="group block">
      <article className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col h-full">
        {/* ── imagen ── */}
        <div className="relative aspect-square bg-gray-50">
          {group.imageUrl ? (
            <Image
              src={group.imageUrl}
              alt={group.name}
              fill
              className="object-contain p-5"
              sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 50vw"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-300">
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}

          {/* badge */}
          {badge && (
            <span
              className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}
            >
              {badge.label}
            </span>
          )}

          {/* favorito */}
          <div
            className="absolute top-3 right-3"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <FavoriteButton
              groupId={group.id}
              initialFavorited={initialFavorited}
              size={18}
              icon="heart"
              className="w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md"
            />
          </div>
        </div>

        {/* ── contenido ── */}
        <div className="px-5 pt-4 pb-5 flex flex-col gap-3 flex-1">
          {/* nombre + variante */}
          <div>
            <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">
              {group.name}
            </h3>
            {group.variant && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{group.variant}</p>
            )}
          </div>

          {/* precio — PVP tachado + precio actual + descuento */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm text-gray-500 line-through decoration-gray-400">
              {fmtPrice(group.pvp)}
            </span>
            <span className="text-lg font-bold text-gray-900">{fmtPrice(currentPrice)}</span>
            {discount > 0 && (
              <span className="text-xs font-semibold text-emerald-600">-{discount}%</span>
            )}
          </div>

          {/* oportunidad */}
          {opportunityBlock}

          {/* barra de progreso */}
          {showProgress && (
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className={`${progressHeight} rounded-full transition-all duration-500 ${
                  status === 'almost_reached' ? 'bg-orange-400' : 'bg-teal-400'
                }`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          )}

          {/* spacer */}
          <div className="flex-1" />

          {/* footer + CTA */}
          <div className="pt-1 border-t border-gray-50 space-y-2">
            <p className="text-xs text-gray-500">{footerText}</p>
            <span className="text-sm font-semibold text-teal-600 group-hover:text-teal-700 transition-colors inline-block">
              Ver oferta →
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}
