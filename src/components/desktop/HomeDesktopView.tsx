'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { GroupProduct } from '@/lib/mock-data'
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
}

export default function HomeDesktopView({ products, favoriteIds = [] }: Props) {
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
      {/* ── TOP NAV ── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-neutral-100">
        <div className="max-w-[1280px] mx-auto px-8 h-16 flex items-center justify-between">
          {/* Left: nav links in pill container */}
          <nav className="hidden xl:flex items-center gap-1 bg-neutral-100 rounded-full p-1">
            <Link href="/" className="px-4 py-2 rounded-full text-sm font-semibold bg-white text-neutral-900 shadow-sm">Explorar</Link>
            <Link href="/mis-grupos" className="px-4 py-2 rounded-full text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors">Mis grupos</Link>
            <Link href="/favoritos" className="px-4 py-2 rounded-full text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors">Mi Radar</Link>
          </nav>

          {/* Center: Logo */}
          <Link href="/" className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5" aria-label="Vonda">
            <img src="/logo.png" alt="Vonda" className="h-8 w-auto" />
            <span className="text-xl font-bold text-neutral-900 tracking-tight">Vonda</span>
          </Link>

          {/* Right: CTA + avatar */}
          <div className="flex items-center gap-3">
            <Link
              href="/crear-peticion"
              className="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-full border border-neutral-200 text-sm font-semibold text-neutral-700 hover:border-brand hover:text-brand transition-colors"
            >
              Crea tu grupo
            </Link>
            <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-sm font-semibold text-white cursor-pointer">
              V
            </div>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="bg-[#F8F7F4] border-b border-neutral-100">
        <div className="max-w-[1280px] mx-auto px-8 pt-14 pb-10 text-center">
          <h1 className="text-[40px] leading-tight font-extrabold text-neutral-900 mb-3" style={{ fontFamily: "'Georgia', serif" }}>
            Cuantos más seamos, menos pagamos
          </h1>
          <p className="text-base text-neutral-500 mb-10 max-w-md mx-auto">
            Únete a un grupo de compra. El precio baja según se llenan las plazas.
          </p>

          {/* Search bar */}
          <div className="max-w-lg mx-auto mb-8">
            <div className="relative bg-white rounded-2xl shadow-sm border border-neutral-200 px-5 pt-3 pb-3">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.12em] block text-left mb-1.5">
                Qué buscas
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Busca un producto entre todos los grupos"
                  className="flex-1 text-sm text-neutral-700 placeholder:text-neutral-400 focus:outline-none bg-transparent"
                />
                <button
                  type="button"
                  className="w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white flex-shrink-0 hover:bg-brand-dark transition-colors"
                  aria-label="Buscar"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Category pills */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
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
