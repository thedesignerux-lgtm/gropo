'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { GroupProduct } from '@/lib/mock-data'
import HomeCarousel from './HomeCarousel'
import HomeProductCard from './HomeProductCard'

const CATEGORIES = [
  { key: 'todos', label: 'Todos', icon: '🔥' },
  { key: 'deporte', label: 'Deporte', icon: '🚴' },
  { key: 'tecnologia', label: 'Tecnología', icon: '💻' },
  { key: 'hogar', label: 'Hogar', icon: '🏠' },
  { key: 'moda', label: 'Moda', icon: '👕' },
  { key: 'herramientas', label: 'Herramientas', icon: '🔧' },
  { key: 'infantil', label: 'Infantil', icon: '🧸' },
  { key: 'otros', label: 'Otros', icon: '📦' },
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
      <header className="sticky top-0 z-30 bg-white border-b border-neutral-100">
        <div className="max-w-[1280px] mx-auto px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5" aria-label="Vonda">
            <span className="w-[32px] h-[32px] rounded-lg bg-brand flex items-center justify-center text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2 6 4-14 2 8h6" /></svg>
            </span>
            <span className="text-lg font-bold text-neutral-900 tracking-tight">Vonda</span>
          </Link>

          {/* Center nav links */}
          <nav className="hidden xl:flex items-center gap-8">
            <Link href="/" className="text-sm font-semibold text-brand">Explorar</Link>
            <Link href="/mis-grupos" className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors">Mis grupos</Link>
            <Link href="/favoritos" className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors">Mi Radar</Link>
            <Link href="/como-funciona" className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors">Cómo funciona</Link>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-4">
            <Link
              href="/crear-peticion"
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Crea tu grupo
            </Link>
            <button className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200 transition-colors" aria-label="Ajustes">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-sm font-semibold text-white cursor-pointer">
              B
            </div>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="bg-white border-b border-neutral-100">
        <div className="max-w-[1280px] mx-auto px-8 py-12 text-center">
          <h1 className="text-4xl font-extrabold text-neutral-900 mb-3 tracking-tight">
            Cuantos más seamos, menos pagamos
          </h1>
          <p className="text-lg text-neutral-500 mb-8 max-w-xl mx-auto">
            Únete a grupos de compra y consigue los mejores precios. El precio baja en tiempo real según se unen más personas.
          </p>

          {/* Search bar */}
          <div className="max-w-lg mx-auto mb-8">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 block text-left">
              Qué buscas
            </label>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca cubiertas, cascos, rodillos..."
                className="w-full h-12 pl-12 pr-4 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm"
              />
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          {/* Category pills */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCat(cat.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                  selectedCat === cat.key
                    ? 'bg-brand text-white shadow-sm'
                    : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                <span className="text-base">{cat.icon}</span>
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
