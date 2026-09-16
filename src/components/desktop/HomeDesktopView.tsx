'use client'

import { useState, useMemo } from 'react'
import DesktopNavbar from '@/components/desktop/DesktopNavbar'
import ExploreProductCard, { type CardStatus } from '@/components/ExploreProductCard'
import { type GroupProduct, getStepPricing } from '@/lib/mock-data'

/* ───────────────────────── tipos ───────────────────────── */

type SortOption = 'popular' | 'price_asc' | 'price_desc' | 'closing_soon'

interface Props {
  products: GroupProduct[]
  favoriteIds?: string[]
  isAuthed?: boolean
}

/* ───────────────────── detección de estado ─────────────── */

interface EnrichedGroup {
  group: GroupProduct
  currentPrice: number
  unitsToNext: number
  nextTierPrice?: number
  nextTierMinUnits?: number
  status: CardStatus
}

function enrichGroups(products: GroupProduct[]): EnrichedGroup[] {
  /* Paso 1: calcular pricing para cada grupo */
  const withPricing = products.map((group) => {
    const pricing = getStepPricing(group.tiers, group.currentUnits)
    return { group, pricing }
  })

  /* Paso 2: determinar el umbral de "top_seller" (top ~30 % por personas, mínimo 8) */
  const nonNew = withPricing.filter(
    ({ group }) => !((group.memberCount ?? 0) <= 1 && group.currentUnits <= 1),
  )
  const sortedByMembers = [...nonNew].sort(
    (a, b) => (b.group.memberCount ?? 0) - (a.group.memberCount ?? 0),
  )
  const topCount = Math.max(1, Math.ceil(sortedByMembers.length * 0.3))
  const topThreshold = sortedByMembers[topCount - 1]?.group.memberCount ?? 8

  /* Paso 3: asignar estado */
  return withPricing.map(({ group, pricing }) => {
    let status: CardStatus = 'active'

    if ((group.memberCount ?? 0) <= 1 && group.currentUnits <= 1) {
      status = 'new'
    } else if (pricing.nextTier && pricing.unitsToNext <= 3) {
      status = 'almost_reached'
    } else if ((group.memberCount ?? 0) >= Math.max(8, topThreshold)) {
      status = 'top_seller'
    }

    return {
      group,
      currentPrice: pricing.currentPrice,
      unitsToNext: pricing.unitsToNext,
      nextTierPrice: pricing.nextTier?.price,
      nextTierMinUnits: pricing.nextTier?.minUnits,
      status,
    }
  })
}

/* ───────────────────────── componente ──────────────────── */

export default function HomeDesktopView({ products, favoriteIds = [] }: Props) {
  const [sortBy, setSortBy] = useState<SortOption>('popular')

  const favSet = useMemo(() => new Set(favoriteIds), [favoriteIds])
  const enriched = useMemo(() => enrichGroups(products), [products])

  const sorted = useMemo(() => {
    const list = [...enriched]
    switch (sortBy) {
      case 'popular':
        list.sort((a, b) => (b.group.memberCount ?? 0) - (a.group.memberCount ?? 0))
        break
      case 'price_asc':
        list.sort((a, b) => a.currentPrice - b.currentPrice)
        break
      case 'price_desc':
        list.sort((a, b) => b.currentPrice - a.currentPrice)
        break
      case 'closing_soon':
        list.sort((a, b) => {
          const at = a.group.closesAt ? new Date(a.group.closesAt).getTime() : Infinity
          const bt = b.group.closesAt ? new Date(b.group.closesAt).getTime() : Infinity
          return at - bt
        })
        break
    }
    return list
  }, [enriched, sortBy])

  return (
    <div className="min-h-screen bg-gray-50">
      <DesktopNavbar />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ── cabecera ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Grupos abiertos</h1>
            <span className="bg-teal-100 text-teal-700 text-sm font-semibold px-2.5 py-0.5 rounded-full">
              {products.length}
            </span>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
          >
            <option value="popular">Más populares</option>
            <option value="price_asc">Precio: menor a mayor</option>
            <option value="price_desc">Precio: mayor a menor</option>
            <option value="closing_soon">Cierre más próximo</option>
          </select>
        </div>

        {/* ── grid ── */}
        {sorted.length > 0 ? (
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-5">
            {sorted.map((item) => (
              <ExploreProductCard
                key={item.group.id}
                group={item.group}
                status={item.status}
                currentPrice={item.currentPrice}
                unitsToNext={item.unitsToNext}
                nextTierPrice={item.nextTierPrice}
                nextTierMinUnits={item.nextTierMinUnits}
                initialFavorited={favSet.has(item.group.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No hay grupos abiertos en este momento</p>
          </div>
        )}
      </main>
    </div>
  )
}
