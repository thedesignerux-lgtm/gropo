'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { GroupProduct } from '@/lib/mock-data'
import { getStepPricing } from '@/lib/mock-data'
import { useCheckout } from '@/components/checkout/CheckoutProvider'
import { usePulse } from '@/hooks/usePulse'
import FavoriteButton from '@/components/FavoriteButton'
import GropoTargetSlider, { type Detent } from '@/components/GropoTargetSlider'
import HowGropoSheet from '@/components/HowGropoSheet'

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

/* Vista derivada de un grupo con su precio/estado calculado. */
interface Priced {
  p: GroupProduct
  currentPrice: number
  nextTier: { minUnits: number; price: number } | null
  unitsToNext: number
  savings: number
  complete: boolean
}

function price(p: GroupProduct): Priced {
  const sp = getStepPricing(p.tiers, p.currentUnits)
  const savings = p.pvp > sp.currentPrice ? p.pvp - sp.currentPrice : 0
  return { p, currentPrice: sp.currentPrice, nextTier: sp.nextTier, unitsToNext: sp.unitsToNext, savings, complete: !sp.nextTier }
}

export default function GroupsGrid({ products, favoriteIds = [], isAuthed = false }: Props) {
  const [query, setQuery] = useState('')
  const [selectedCat, setSelectedCat] = useState('todos')
  const [sheetOpen, setSheetOpen] = useState(false)
  const favSet = new Set(favoriteIds)

  const priced = useMemo(() => products.map(price), [products])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return priced
    return priced.filter((x) => x.p.name.toLowerCase().includes(q))
  }, [priced, query])

  const searching = query.trim().length > 0

  // Destacado = grupo abierto más cercano a desbloquear el siguiente precio.
  const featured = useMemo(() => {
    const withNext = priced.filter((x) => x.nextTier && x.unitsToNext > 0)
    if (withNext.length > 0) return [...withNext].sort((a, b) => a.unitsToNext - b.unitsToNext)[0]
    return priced[0] ?? null
  }, [priced])

  // Carruseles (sobre todos los grupos abiertos).
  const nearNext = useMemo(
    () => priced.filter((x) => x.nextTier && x.unitsToNext > 0 && x.p.id !== featured?.p.id).sort((a, b) => a.unitsToNext - b.unitsToNext),
    [priced, featured],
  )
  const droppedMost = useMemo(() => [...priced].sort((a, b) => b.savings - a.savings), [priced])
  const popular = useMemo(() => [...priced].sort((a, b) => b.p.currentUnits - a.p.currentUnits), [priced])

  return (
    <>
      {/* ── Header 10M (fijo, no hace scroll) ── */}
      <header className="shrink-0 z-10" style={{ background: '#FBFAF8' }}>
        <div className="flex items-center justify-between px-[16px] py-1.5">
          <div className="flex items-center gap-[7px]">
            <img src="/logo-mark.png" alt="Gropo" className="w-7 h-7 object-contain" />
            <span className="text-[17px] font-extrabold text-[#1a1a1f]" style={{ letterSpacing: '-0.5px' }}>Gropo</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] font-semibold" style={{ color: '#6B6B76' }}>
              Cierra <strong className="font-extrabold text-[#1a1a1f]">Dom 22:00</strong>
            </span>
            <Link href="/favoritos" aria-label="Alertas" className="w-[30px] h-[30px] rounded-full grid place-items-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.5 0" /></svg>
            </Link>
            <Link href="/perfil" className="w-[30px] h-[30px] rounded-full grid place-items-center text-[13px] font-extrabold text-brand" style={{ background: '#EDE9FB' }}>V</Link>
          </div>
        </div>
      </header>

      {/* ── Headline editorial (hace scroll) — SE MANTIENE ── */}
      <div className="px-[18px] pt-3 pb-1">
        <h1 className="text-[33px] leading-[1.05] tracking-tight text-[#1a1a1f]" style={{ fontFamily: 'var(--font-instrument-serif), serif', fontWeight: 400, margin: '4px 0 0' }}>
          Cuantos más seamos,<br />
          <em className="text-brand not-italic" style={{ fontFamily: 'var(--font-instrument-serif), serif', fontStyle: 'italic' }}>menos pagamos.</em>
        </h1>
      </div>

      {/* ── Sticky search + chips ── */}
      <div className="sticky top-0 z-10" style={{ background: '#FBFAF8' }}>
        <div className="px-[18px] pt-3 pb-1.5">
          <div className="flex items-center h-[52px] bg-white rounded-full pl-4 pr-1.5" style={{ border: '1px solid #E7E4DD', boxShadow: '0 10px 26px -16px rgba(30,20,60,.35)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9a97a2" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca un producto o categoría"
              className="flex-1 text-[13.5px] text-neutral-700 placeholder:text-neutral-400 bg-transparent ml-3 focus:outline-none"
            />
            <button type="button" className="w-10 h-10 rounded-full bg-brand grid place-items-center shrink-0" aria-label="Buscar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>
            </button>
          </div>
        </div>

        <div className="flex gap-2.5 overflow-x-auto px-[18px] pt-3 pb-1.5 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCat(cat.key)}
              className="shrink-0 text-[12.5px] font-semibold rounded-full transition-colors"
              style={
                selectedCat === cat.key
                  ? { background: '#6C4BF4', color: '#fff', border: '1px solid #6C4BF4', padding: '8px 15px' }
                  : { background: 'transparent', color: '#4a4a52', border: '1px solid #ECEAF2', padding: '8px 15px' }
              }
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {searching ? (
        /* ── Resultados de búsqueda ── */
        <div className="px-[18px] pt-3.5 pb-8">
          <div className="flex items-baseline gap-2.5 mb-3">
            <h2 className="text-2xl tracking-tight text-[#1a1a1f]" style={{ fontFamily: 'var(--font-instrument-serif), serif', fontWeight: 400 }}>Resultados</h2>
            <span className="text-xs font-bold text-brand rounded-full px-2.5 py-1" style={{ background: '#EDE9FB' }}>{filtered.length}</span>
          </div>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-400">No se encontraron productos para “{query}”</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((x) => (
                <CarouselCard key={x.p.id} x={x} isFavorited={favSet.has(x.p.id)} wide />
              ))}
            </div>
          )}
        </div>
      ) : featured ? (
        <>
          {/* ── Card destacada ── */}
          <FeaturedGropoCard x={featured} isFavorited={favSet.has(featured.p.id)} isAuthed={isAuthed} onOpenSheet={() => setSheetOpen(true)} />

          {/* ── Carruseles ── */}
          {nearNext.length > 0 && <CarouselRow title="Cerca del siguiente precio" items={nearNext} favSet={favSet} first />}
          {droppedMost.length > 0 && <CarouselRow title="Más han bajado hoy" items={droppedMost} favSet={favSet} />}
          {popular.length > 0 && <CarouselRow title="Gropos populares" items={popular} favSet={favSet} link="Ver todos" />}

          <div className="h-16" />
        </>
      ) : (
        <div className="px-[18px] py-16 text-center text-sm text-neutral-400">No hay grupos abiertos</div>
      )}

      {/* ── Bottom sheet ¿Cómo funciona Gropo? ── */}
      <HowGropoSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  )
}

/* ═══════════════════════════════════════════
   FeaturedGropoCard — card destacada 10M
   ═══════════════════════════════════════════ */

function FeaturedGropoCard({ x, isFavorited, isAuthed, onOpenSheet }: { x: Priced; isFavorited: boolean; isAuthed: boolean; onOpenSheet: () => void }) {
  const { p, currentPrice, savings, complete } = x
  const { open } = useCheckout()
  const router = useRouter()
  const href = `/grupo/${p.id}`

  const detents: Detent[] = useMemo(
    () => [...p.tiers].sort((a, b) => a.minUnits - b.minUnits).map((t) => ({ price: t.price, uds: t.minUnits })),
    [p.tiers],
  )
  let curIdx = 0
  for (let i = 0; i < detents.length; i++) if (detents[i].uds <= p.currentUnits) curIdx = i

  const [selIdx, setSelIdx] = useState(curIdx)
  const { data: pulseData } = usePulse(complete ? null : p.id)

  const selectedPrice = detents.length > 0 ? detents[selIdx].price : currentPrice
  const confirmed = selIdx <= curIdx
  const accent = confirmed ? '#6C4BF4' : '#E8944A'

  const handlePrimary = () => {
    if (!confirmed) {
      router.push(`${href}/unirme?mode=esperar&target=${selectedPrice}`)
    } else if (isAuthed) {
      open({
        groupId: p.id,
        productName: p.name,
        productSpec: p.variant,
        imageUrl: p.imageUrl ?? null,
        quantity: 1,
        maxPricePerUnit: selectedPrice,
      })
    } else {
      router.push(`${href}/unirme`)
    }
  }

  return (
    <div className="mx-3 mt-1 relative rounded-[16px]" style={{ background: '#F5F3F9', padding: '13px 13px 12px' }}>
      {/* Header: eyebrow + status pill */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-extrabold uppercase text-brand" style={{ letterSpacing: '0.4px' }}>★ Gropo destacada</span>
        {confirmed ? (
          <span className="inline-flex items-center gap-1.5 rounded-full text-[11.5px] font-bold text-brand" style={{ background: '#EDE9FB', padding: '3px 10px 3px 4px' }}>
            <span className="grid place-items-center rounded-full text-white text-[9px] font-black" style={{ width: 16, height: 16, background: '#6C4BF4' }}>✓</span>
            Precio asegurado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full text-[11.5px] font-bold whitespace-nowrap" style={{ background: '#FCEEE0', color: '#E8944A', padding: '3px 10px 3px 4px' }}>
            <span className="grid place-items-center rounded-full text-white text-[9px] font-black" style={{ width: 16, height: 16, background: '#E8944A' }}>↗</span>
            Objetivo: {fmt(selectedPrice)}
          </span>
        )}
      </div>

      {/* Summary row */}
      <Link href={href} className="flex gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="text-[18px] font-extrabold tracking-tight leading-[1.15] text-[#1a1a1f]">{p.name}</div>
          <div className="text-[9.5px] font-extrabold uppercase text-brand mt-1.5" style={{ letterSpacing: '0.5px' }}>Precio actual</div>
          <div className="flex items-baseline gap-[7px] mt-px flex-wrap">
            <span className="text-[22px] font-extrabold text-brand leading-none" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{fmt(currentPrice)}</span>
            {p.pvp > currentPrice && <span className="text-[12px] font-semibold text-neutral-400 line-through">{fmt(p.pvp)}</span>}
            {savings > 0 && <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={{ color: '#157F52', background: '#E6F4EC' }}>Ahorras {fmt(savings)}</span>}
          </div>
          <div className="flex items-center gap-2 mt-2.5">
            <div className="flex">
              {['A', 'B', 'C'].map((c, i) => (
                <span key={c} className="grid place-items-center rounded-full text-brand text-[7.5px] font-extrabold" style={{ width: 19, height: 19, background: '#EDE9FB', border: '2px solid #F5F3F9', marginLeft: i === 0 ? 0 : -6 }}>{c}</span>
              ))}
            </div>
            <span className="text-[10.5px] font-bold text-[#1a1a1f] whitespace-nowrap">{p.currentUnits} confirmado{p.currentUnits !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="rounded-[12px] overflow-hidden shrink-0" style={{ width: 104, height: 88, background: '#F0EEE8' }}>
          {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />}
        </div>
      </Link>

      {/* Price selector */}
      <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid #E4DEEE' }}>
        <div className="text-[17px] font-extrabold tracking-tight leading-[1.2] mb-1.5 text-[#1a1a1f]">¿Hasta cuánto quieres pagar?</div>
        {detents.length > 1 ? (
          <GropoTargetSlider detents={detents} curIdx={curIdx} selIdx={selIdx} onSelIdx={setSelIdx} size="mini" chrome="nudge" pulse={pulseData?.steps} glow={pulseData?.glow} shortfallTicks currentUnits={p.currentUnits} />
        ) : (
          <div className="h-2" />
        )}

        {/* CTA */}
        <button
          type="button"
          onClick={handlePrimary}
          className="w-full mt-3.5 font-extrabold text-[15px] rounded-[13px] cursor-pointer transition-colors active:scale-[0.99] whitespace-nowrap overflow-hidden text-ellipsis"
          style={{ border: `2px solid ${accent}`, background: confirmed ? 'rgba(108,75,244,.10)' : 'rgba(232,148,74,.12)', color: accent, padding: 15, boxShadow: `0 12px 26px -14px ${confirmed ? 'rgba(108,75,244,.28)' : 'rgba(232,148,74,.28)'}` }}
        >
          {confirmed ? `Asegurar hasta ${fmt(selectedPrice)}` : `Fijar límite en ${fmt(selectedPrice)}`}
        </button>
        {!confirmed && (
          <button
            type="button"
            onClick={() => setSelIdx(curIdx)}
            className="w-full mt-2 font-extrabold text-[15px] rounded-[13px] cursor-pointer transition-colors whitespace-nowrap"
            style={{ border: '2px solid #D9D3EC', background: 'transparent', color: '#6C4BF4', padding: 15, animation: 'ctaIn .22s ease-out both' }}
          >
            Asegurar {fmt(currentPrice)} ahora
          </button>
        )}

        {/* Trust line — debajo de la CTA */}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6C4BF4" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          <span className="text-[12px] font-extrabold text-[#1a1a1f]">Hoy 0 €</span>
          <button type="button" onClick={onOpenSheet} aria-label="Cómo funciona el pago" className="grid place-items-center rounded-full text-brand text-[11px] font-black transition-colors" style={{ width: 18, height: 18, background: '#EDE9FB' }}>i</button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   CarouselRow + CarouselCard
   ═══════════════════════════════════════════ */

function CarouselRow({ title, items, favSet, first, link = 'Ver todas →' }: { title: string; items: Priced[]; favSet: Set<string>; first?: boolean; link?: string }) {
  return (
    <section>
      <div className="flex items-baseline justify-between px-[16px]" style={{ paddingTop: first ? 16 : 2, paddingBottom: 4 }}>
        <h3 className="text-[14.5px] font-extrabold italic tracking-tight text-[#1a1a1f]">{title}</h3>
        <span className="text-[11.5px] font-bold text-brand cursor-pointer">{link}</span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar" style={{ padding: '4px 16px 14px' }}>
        {items.map((x) => (
          <CarouselCard key={x.p.id} x={x} isFavorited={favSet.has(x.p.id)} />
        ))}
      </div>
    </section>
  )
}

function CarouselCard({ x, isFavorited, wide }: { x: Priced; isFavorited: boolean; wide?: boolean }) {
  const { p, currentPrice, savings } = x
  const href = `/grupo/${p.id}`
  const detents = [...p.tiers].sort((a, b) => a.minUnits - b.minUnits)
  let curIdx = 0
  for (let i = 0; i < detents.length; i++) if (detents[i].minUnits <= p.currentUnits) curIdx = i
  const n = detents.length
  const pct = (i: number) => (n <= 1 ? 50 : 6 + (i / (n - 1)) * 88)

  return (
    <div className={wide ? '' : 'shrink-0'} style={wide ? { minWidth: 0 } : { flex: '0 0 132px', minWidth: 0 }}>
      {/* Image block */}
      <Link href={href} className="relative block overflow-hidden rounded-[13px]" style={{ aspectRatio: '1 / 1', background: '#F0EEE8' }}>
        {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />}
        {/* Action buttons */}
        <div className="absolute flex gap-1.5" style={{ top: 7, right: 7 }}>
          <span className="grid place-items-center rounded-full bg-white" style={{ width: 30, height: 30, boxShadow: '0 3px 10px -3px rgba(0,0,0,.3)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="10.5" x2="15.4" y2="6.5" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /></svg>
          </span>
          <span className="grid place-items-center rounded-full bg-white" style={{ width: 30, height: 30, boxShadow: '0 3px 10px -3px rgba(0,0,0,.3)' }}>
            <FavoriteButton groupId={p.id} initialFavorited={isFavorited} size={15} icon="heart" />
          </span>
        </div>
        {/* Caption overlay */}
        <div className="absolute left-0 right-0 bottom-0" style={{ padding: '20px 10px 10px', background: 'linear-gradient(to top, rgba(0,0,0,.8), rgba(0,0,0,.25) 60%, transparent)' }}>
          <div className="text-[12.5px] font-extrabold text-white truncate">{p.name}</div>
          <div className="flex items-baseline justify-between gap-1 mt-0.5">
            <span className="text-[14px] font-extrabold text-white" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{fmt(currentPrice)}</span>
            {savings > 0 && <span className="text-[10px] font-extrabold" style={{ color: '#5FD08A' }}>−{fmt(savings)}</span>}
          </div>
        </div>
      </Link>

      {/* Tier mini-bar */}
      {n > 1 && (
        <div style={{ padding: '8px 1px 0' }}>
          <div className="relative" style={{ height: 7 }}>
            <div className="absolute rounded-full" style={{ left: '6%', right: '6%', top: '50%', transform: 'translateY(-50%)', height: 3.5, background: '#E8E6F0' }} />
            <div className="absolute rounded-full" style={{ left: '6%', width: `${Math.max(0, pct(curIdx) - 6)}%`, top: '50%', transform: 'translateY(-50%)', height: 3.5, background: '#6C4BF4' }} />
            {detents.map((d, i) => (
              <span key={i} className="absolute rounded-full" style={{ left: `${pct(i)}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 7, height: 7, background: i <= curIdx ? '#6C4BF4' : '#D9D6E8' }} />
            ))}
          </div>
          <div className="relative" style={{ height: 12, marginTop: 2 }}>
            {detents.map((d, i) => (
              <span key={i} className="absolute" style={{ left: `${pct(i)}%`, transform: 'translateX(-50%)', fontFamily: 'var(--font-space-grotesk), sans-serif', fontSize: 7.5, whiteSpace: 'nowrap', color: i === curIdx ? '#6C4BF4' : '#9a97a2', fontWeight: i === curIdx ? 700 : 500 }}>{fmt(d.price)}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

