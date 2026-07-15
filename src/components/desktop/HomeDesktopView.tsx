'use client'

import { useState } from 'react'
import type { GroupProduct } from '@/lib/mock-data'
import DesktopNavbar from './DesktopNavbar'
import HomeCarousel from './HomeCarousel'
import HomeProductCard from './HomeProductCard'

const CATEGORIES = [
  { key: 'todos', label: 'Todos' },
  { key: 'deporte', label: 'Deporte' },
  { key: 'tecnologia', label: 'Tecnología' },
  { key: 'hogar', label: 'Hogar' },
  { key: 'moda', label: 'Moda' },
  { key: 'herramientas', label: 'Herramientas' },
  { key: 'infantil', label: 'Infantil' },
  { key: 'otros', label: 'Otros' },
]

// For now all products go to "Deporte" since Vonda is cycling.
// When we have real categories in the DB, map product.category here.
function getProductCategory(_product: GroupProduct): string {
  return 'deporte'
}

interface Props {
  products: GroupProduct[]
  favoriteIds?: string[]
  isAuthed?: boolean
}

export default function HomeDesktopView({ products, favoriteIds = [], isAuthed = false }: Props) {
  const [query, setQuery] = useState('')
  const [selectedCat, setSelectedCat] = useState('todos')
  const favSet = new Set(favoriteIds)

  // Filter by search
  const filtered = products.filter((p) => {
    if (query.trim() && !p.name.toLowerCase().includes(query.toLowerCase())) return false
    if (selectedCat !== 'todos' && getProductCategory(p) !== selectedCat) return false
    return true
  })

  // Group by category for carousels (when "Todos" selected)
  const byCategory = new Map<string, GroupProduct[]>()
  for (const p of filtered) {
    const cat = getProductCategory(p)
    const arr = byCategory.get(cat) || []
    arr.push(p)
    byCategory.set(cat, arr)
  }

  // Category labels for carousel titles
  const catLabels: Record<string, string> = {}
  for (const c of CATEGORIES) catLabels[c.key] = c.label

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <DesktopNavbar />

      {/* ── HERO SECTION ── */}
      <section className="border-b border-neutral-100" style={{ backgroundColor: '#F7F5F0' }}>
        <div className="max-w-[1280px] mx-auto px-8 pt-14 pb-10 text-center">
          <h1 className="text-[44px] leading-tight font-extrabold tracking-tight text-neutral-900 mb-3">
            Cuantos más seamos, menos pagamos
          </h1>
          <p className="text-base text-neutral-500 mb-10 max-w-md mx-auto">
            Únete a un grupo de compra. El precio baja según se llenan las plazas.
          </p>

          {/* Search bar — card with overlapping purple button */}
          <div className="max-w-[560px] mx-auto mb-10 relative">
            <div className="bg-white rounded-full shadow-md border border-neutral-200/60 pl-7 pr-20 pt-4 pb-4">
              <label className="text-[10px] font-bold text-neutral-900 uppercase tracking-[0.14em] block text-left mb-1">
                Qué buscas
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca un producto entre todos los grupos"
                className="w-full text-[15px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none bg-transparent"
              />
            </div>
            {/* Purple search button — overlapping right edge */}
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-[56px] h-[56px] rounded-full bg-brand flex items-center justify-center text-white shadow-lg hover:bg-brand-dark transition-colors"
              aria-label="Buscar"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </div>

          {/* Category pills */}
          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCat(cat.key)}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                  selectedCat === cat.key
                    ? 'bg-brand text-white shadow-sm'
                    : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCT CAROUSELS ── */}
      <main className="max-w-[1280px] mx-auto px-8 py-10">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-neutral-400 text-lg">
              {query.trim()
                ? `No se encontraron productos para "${query}"`
                : 'No hay grupos abiertos en esta categoría'}
            </p>
          </div>
        ) : selectedCat !== 'todos' ? (
          /* Single category selected: one carousel */
          <HomeCarousel title={catLabels[selectedCat] || selectedCat}>
            {filtered.map((product) => (
              <HomeProductCard
                key={product.id}
                product={product}
                isFavorited={favSet.has(product.id)}
                isAuthed={isAuthed}
              />
            ))}
          </HomeCarousel>
        ) : (
          /* "Todos": carousel per category + a "Todos" one at the top */
          <>
            {/* "Populares" / all products carousel at top */}
            <HomeCarousel title="Populares">
              {filtered.map((product) => (
                <HomeProductCard
                  key={product.id}
                  product={product}
                  isFavorited={favSet.has(product.id)}
                  isAuthed={isAuthed}
                />
              ))}
            </HomeCarousel>

            {/* Per-category carousels */}
            {Array.from(byCategory.entries()).map(([cat, catProducts]) => (
              <HomeCarousel key={cat} title={catLabels[cat] || cat}>
                {catProducts.map((product) => (
                  <HomeProductCard
                    key={product.id}
                    product={product}
                    isFavorited={favSet.has(product.id)}
                    isAuthed={isAuthed}
                  />
                ))}
              </HomeCarousel>
            ))}
          </>
        )}

        {/* Footer trust signals */}
        <div className="mt-6 border-t border-neutral-200 pt-8">
          <div className="flex items-center justify-center gap-12 text-sm text-neutral-500">
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-neutral-400">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <div>
                <p className="font-medium text-neutral-700">Pago seguro</p>
                <p className="text-xs text-neutral-400">Tu dinero siempre protegido</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-neutral-400">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <div>
                <p className="font-medium text-neutral-700">Sin compromiso</p>
                <p className="text-xs text-neutral-400">Únete gratis, compra cuando quieras</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-neutral-400">
                <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              <div>
                <p className="font-medium text-neutral-700">Devoluciones fáciles</p>
                <p className="text-xs text-neutral-400">Si algo no encaja, lo solucionamos</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
