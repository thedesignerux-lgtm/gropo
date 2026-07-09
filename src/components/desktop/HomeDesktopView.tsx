'use client'

import { useState } from 'react'
import type { GroupProduct } from '@/lib/mock-data'
import CountdownChip from '@/components/CountdownChip'
import HomeSidebar from './HomeSidebar'
import DesktopProductCard from './DesktopProductCard'

const CATEGORIES = ['Todos', 'Deporte', 'Tecnología', 'Hogar', 'Moda', 'Herramientas', 'Infantil', 'Otros']

interface Props {
  products: GroupProduct[]
  favoriteIds?: string[]
}

export default function HomeDesktopView({ products, favoriteIds = [] }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todos')
  const favSet = new Set(favoriteIds)

  const filtered = products.filter((p) => {
    if (query.trim() && !p.name.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="bg-white border-b border-neutral-100 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" aria-label="Vonda - inicio">
            <img src="/logo.png" alt="Vonda" className="h-8 w-auto" />
          </a>

          <div className="flex-1 max-w-md mx-8">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca tu producto..."
                className="w-full h-10 pl-10 pr-4 rounded-full border border-neutral-200 bg-white text-sm text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <CountdownChip />
            <a href="/favoritos" className="relative text-neutral-500 hover:text-brand transition-colors" aria-label="Mi Radar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
              </svg>
            </a>
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-semibold text-neutral-600">V</div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex gap-8">
          <HomeSidebar />

          <main className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-neutral-900">Grupos abiertos</h1>
                <span className="bg-brand/10 text-brand text-xs font-semibold px-2.5 py-1 rounded-full">
                  {products.length} activos
                </span>
              </div>

              <div className="flex items-center gap-2 bg-brand/5 border border-brand/10 rounded-xl px-4 py-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand flex-shrink-0">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Cuantos más, menos pagas</p>
                  <p className="text-xs text-neutral-500">El precio baja cuando se unen más personas.</p>
                </div>
                <a href="/como-funciona" className="text-xs text-brand font-medium hover:underline ml-2 whitespace-nowrap">
                  Saber más →
                </a>
              </div>
            </div>

            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      category === cat
                        ? 'bg-brand text-white'
                        : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center gap-1.5 text-sm text-neutral-500">
                  <span>Ordenar por:</span>
                  <select className="bg-transparent font-medium text-neutral-700 focus:outline-none cursor-pointer">
                    <option>Recomendados</option>
                    <option>Precio: menor</option>
                    <option>Precio: mayor</option>
                    <option>Más populares</option>
                    <option>Cierre próximo</option>
                  </select>
                </div>
                <div className="flex items-center border border-neutral-200 rounded-lg overflow-hidden">
                  <button className="p-2 bg-brand/10 text-brand" title="Grid">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                    </svg>
                  </button>
                  <button className="p-2 text-neutral-400 hover:text-neutral-600" title="Lista">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 lg:grid-cols-3 gap-4">
              {filtered.length === 0 ? (
                <div className="col-span-full py-16 text-center">
                  <p className="text-neutral-400">
                    {query.trim()
                      ? `No se encontraron productos para "${query}"`
                      : 'No hay grupos abiertos'}
                  </p>
                </div>
              ) : (
                filtered.map((product) => (
                  <DesktopProductCard
                    key={product.id}
                    product={product}
                    isFavorited={favSet.has(product.id)}
                  />
                ))
              )}
            </div>

            <div className="mt-8 border-t border-neutral-200 pt-6">
              <div className="flex items-center justify-center gap-12 text-sm text-neutral-500">
                <div className="flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <div>
                    <p className="font-medium text-neutral-700">Pago seguro</p>
                    <p className="text-xs text-neutral-400">Tu dinero siempre protegido</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <div>
                    <p className="font-medium text-neutral-700">Sin compromiso</p>
                    <p className="text-xs text-neutral-400">Únete gratis, compra cuando quieras</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
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
      </div>
    </div>
  )
}
