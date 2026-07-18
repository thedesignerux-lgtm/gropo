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

const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'

const CATEGORIES = [
  { key: 'todos', label: 'Todos' },
  { key: 'deporte', label: 'Deporte' },
  { key: 'tecnologia', label: 'Tecnología' },
  { key: 'hogar', label: 'Hogar' },
  { key: 'moda', label: 'Moda' },
  { key: 'herramientas', label: 'Herramientas' },
]

interface Props {
  products: GroupProduct[]
  favoriteIds?: string[]
  isAuthed?: boolean
}

export default function GroupsGrid({ products, favoriteIds = [], isAuthed = false }: Props) {
  const [query, setQuery] = useState('')
  const [selectedCat, setSelectedCat] = useState('todos')
  const favSet = new Set(favoriteIds)

  const filtered = products.filter((p) => {
    if (query.trim() && !p.name.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  return (
    <>
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10" style={{ background: '#FBFAF8' }}>
        {/* Logo row */}
        <div className="flex items-center justify-between px-[18px] pt-2 pb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[9px] bg-brand grid place-items-center text-white font-extrabold text-[17px]">v</div>
            <span className="text-[19px] font-extrabold tracking-tight">Vonda</span>
          </div>
          <Link href="/perfil" className="w-[34px] h-[34px] rounded-full grid place-items-center text-sm font-extrabold text-brand" style={{ background: '#EDE9FB' }}>
            V
          </Link>
        </div>

        {/* Editorial headline */}
        <div className="px-[18px] pt-4 pb-1">
          <h1 className="text-[33px] leading-[1.05] tracking-tight text-[#1a1a1f]" style={{ fontFamily: 'var(--font-instrument-serif), serif', fontWeight: 400 }}>
            Cuantos más seamos,<br />
            <em className="text-brand not-italic" style={{ fontFamily: 'var(--font-instrument-serif), serif', fontStyle: 'italic' }}>menos pagamos.</em>
          </h1>
        </div>

        {/* Search bar */}
        <div className="px-[18px] pt-3.5 pb-1.5">
          <div className="flex items-center h-[52px] bg-white rounded-full pl-4 pr-1.5" style={{ border: '1px solid #E7E4DD', boxShadow: '0 10px 26px -16px rgba(30,20,60,.35)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9a97a2" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca un producto entre todos los grupos"
              className="flex-1 text-[13.5px] text-neutral-700 placeholder:text-neutral-400 bg-transparent ml-3 focus:outline-none"
            />
            <button
              type="button"
              className="w-10 h-10 rounded-full bg-brand grid place-items-center shrink-0"
              aria-label="Buscar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>
            </button>
          </div>
        </div>

        {/* Category chips — horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto px-[18px] pt-3 pb-1.5 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCat(cat.key)}
              className="shrink-0 text-[12.5px] font-semibold rounded-full px-4 py-2 transition-colors"
              style={
                selectedCat === cat.key
                  ? { background: '#6C4BF4', color: '#fff', border: '1px solid #6C4BF4' }
                  : { background: 'transparent', color: '#4a4a52', border: '1px solid #ECEAF2' }
              }
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Section heading ── */}
      <div className="flex items-baseline gap-2.5 px-[18px] pt-3.5 pb-0.5">
        <h2 className="text-2xl tracking-tight text-[#1a1a1f]" style={{ fontFamily: 'var(--font-instrument-serif), serif', fontWeight: 400 }}>Grupos abiertos</h2>
        <span className="text-xs font-bold text-brand rounded-full px-2.5 py-1" style={{ background: '#EDE9FB' }}>
          {filtered.length} activo{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Cards ── */}
      <div className="px-[18px] pt-3 pb-7">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-400">
            {query.trim() ? `No se encontraron productos para "${query}"` : 'No hay grupos abiertos'}
          </div>
        ) : (
          filtered.map((product) => (
            <MobileCard key={product.id} product={product} isFavorited={favSet.has(product.id)} isAuthed={isAuthed} />
          ))
        )}
      </div>

      {/* CTA — crear petición */}
      <Link
        href="/crear-peticion"
        className="mx-[18px] mb-6 flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-gray-200 bg-white"
      >
        <div className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-700">¿No encuentras tu producto?</p>
          <p className="text-xs text-gray-400 mt-0.5">Crea una petición — gratis y sin compromiso</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>
    </>
  )
}

/* ═══════════════════════════════════════════
   MobileCard — 8a full-width image card
   ═══════════════════════════════════════════ */

function MobileCard({ product, isFavorited, isAuthed }: { product: GroupProduct; isFavorited: boolean; isAuthed: boolean }) {
  const { open } = useCheckout()
  const router = useRouter()
  const { currentPrice, nextTier, unitsToNext } = getStepPricing(product.tiers, product.currentUnits)
  const isComplete = !nextTier
  const missing = nextTier ? unitsToNext : 0
  const savings = product.pvp > currentPrice ? product.pvp - currentPrice : 0
  const href = `/grupo/${product.id}`

  const detents: Detent[] = [...product.tiers]
    .sort((a, b) => a.minUnits - b.minUnits)
    .map(t => ({ price: t.price, uds: t.minUnits }))
  let curIdx = 0
  for (let i = 0; i < detents.length; i++) if (detents[i].uds <= product.currentUnits) curIdx = i

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
        imageUrl: product.imageUrl ?? null,
        quantity: 1,
        maxPricePerUnit: selectedPrice,
      })
    } else {
      router.push(`${href}/unirme`)
    }
  }

  return (
    <div className="rounded-[18px] overflow-hidden bg-white mb-4" style={{ border: '1px solid #ECEAF2', boxShadow: '0 12px 30px -24px rgba(30,20,60,.4)' }}>
      {/* Image with gradient overlay */}
      <Link href={href} className="relative block w-full overflow-hidden" style={{ aspectRatio: '1 / 0.72', background: '#1a1a1f' }}>
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover opacity-90"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand/20 to-brand/5" />
        )}

        {/* Faltan badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold text-brand" style={{ background: 'rgba(255,255,255,.94)', boxShadow: '0 4px 14px -6px rgba(30,20,60,.4)' }}>
          {isComplete ? '✓ Mejor precio' : `↓ ${missing} uds`}
        </div>

        {/* Share + Heart */}
        <div className="absolute top-2.5 right-2.5 flex gap-[7px]">
          <div className="w-[34px] h-[34px] rounded-full grid place-items-center cursor-pointer" style={{ background: 'rgba(255,255,255,.92)', boxShadow: '0 4px 12px -6px rgba(0,0,0,.4)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="10.5" x2="15.4" y2="6.5" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /></svg>
          </div>
          <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,.92)', boxShadow: '0 4px 12px -6px rgba(0,0,0,.4)' }}>
            <FavoriteButton
              groupId={product.id}
              initialFavorited={isFavorited}
              size={17}
              icon="heart"
            />
          </div>
        </div>

        {/* Gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-3.5 pb-3.5 pt-12" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,.68))' }}>
          <div className="text-[15px] font-bold text-white tracking-tight leading-tight">{product.name}</div>
          <div className="flex items-baseline gap-[7px] mt-1">
            <span className="text-[18px] font-bold text-white" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{fmt(currentPrice)}</span>
            {!isComplete && nextTier && (
              <span className="text-xs text-white/70">→ {fmt(nextTier.price)}</span>
            )}
            {savings > 0 && (
              <span className="text-[11.5px] font-bold ml-auto" style={{ color: '#A8F0C0' }}>{fmt(savings)}</span>
            )}
          </div>
        </div>
      </Link>

      {/* Slider + CTA */}
      <div className="px-3.5 pt-2.5 pb-3.5">
        {detents.length > 1 ? (
          <VondaTargetSlider detents={detents} curIdx={curIdx} selIdx={selIdx} onSelIdx={setSelIdx} size="mini" pulse={pulseData?.steps} glow={pulseData?.glow} />
        ) : (
          <div className="h-3" />
        )}
        <button
          type="button"
          onClick={handleCheckout}
          className="w-full mt-3 font-extrabold text-[13px] rounded-xl cursor-pointer transition-colors active:scale-[0.99] whitespace-nowrap py-3.5"
          style={{ border: `2px solid ${accent}`, background: ctaBg, color: accent }}
        >
          {ctaText}
        </button>
      </div>
    </div>
  )
}
