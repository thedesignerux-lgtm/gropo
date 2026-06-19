'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { GroupProduct } from '@/lib/mock-data'
import CountdownChip from '@/components/CountdownChip'
import ProductCard from '@/components/ProductCard'

export default function GroupsGrid({ products }: { products: GroupProduct[] }) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : products

  return (
    <>
      {/* Sticky header + search */}
      <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm">
        {/* Header row */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <span className="text-2xl font-bold tracking-tight text-brand">vonda</span>
          <CountdownChip />
        </div>

        {/* Search bar */}
        <div className="px-4 pb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-400"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Busca tu producto..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-shadow"
            />
          </div>
        </div>

        {/* Section header */}
        <div className="flex items-baseline justify-between px-4 mb-3">
          <h2 className="text-base font-bold text-gray-900">Grupos abiertos</h2>
          <span className="text-xs text-gray-400">Cuantos más, menos pagas</span>
        </div>
      </div>

      {/* Product grid */}
      <div className="px-4 grid grid-cols-2 gap-3">
        {products.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-sm text-gray-400">
            No hay grupos abiertos
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-sm text-gray-400">
            No se encontraron productos para &ldquo;{query}&rdquo;
          </div>
        ) : (
          filtered.map(product => (
            <ProductCard key={product.id} product={product} />
          ))
        )}
      </div>

      {/* CTA — crear petición */}
      <Link
        href="/crear-peticion"
        className="mx-4 mt-4 flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-gray-200 bg-white"
      >
        <div className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center flex-shrink-0">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-400"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-700">¿No encuentras tu producto?</p>
          <p className="text-xs text-gray-400 mt-0.5">Crea una petición — gratis y sin compromiso</p>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-300 flex-shrink-0"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>
    </>
  )
}
