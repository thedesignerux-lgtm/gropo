'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DesktopNavbar from '@/components/desktop/DesktopNavbar'
import ExploreProductCard, { type CardStatus } from '@/components/ExploreProductCard'
import { type GroupProduct, getStepPricing } from '@/lib/mock-data'
import { useCheckout } from '@/components/checkout/CheckoutProvider'
import FavoriteButton from '@/components/FavoriteButton'
import GropoTargetSlider, { type Detent } from '@/components/GropoTargetSlider'
import { modeAccent } from '@/lib/brand-colors'
import EmptyShowcase from '@/components/EmptyShowcase'
import { fmtSaving } from '@/lib/money'

/* ───────────────────────── helpers ─────────────────────── */

const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'

type SortOption = 'popular' | 'price_asc' | 'price_desc' | 'closing_soon'

/* ── Countdown helper ── */
function useCountdown() {
  const [label, setLabel] = useState<string | null>(null)
  useEffect(() => {
    function calc() {
      const now = new Date()
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Madrid', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
      }).formatToParts(now)
      const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
      const dayOfWeek = weekdayMap[parts.find(p => p.type === 'weekday')!.value] ?? 0
      const hour = parseInt(parts.find(p => p.type === 'hour')!.value)
      const minute = parseInt(parts.find(p => p.type === 'minute')!.value)
      const target = 22 * 60
      const current = dayOfWeek * 1440 + hour * 60 + minute
      const rem = current < target ? target - current : 7 * 1440 - current + target
      const d = Math.floor(rem / 1440)
      const h = Math.floor((rem % 1440) / 60)
      setLabel(`Cierra ${d}d ${h}h`)
    }
    calc()
    const id = setInterval(calc, 60_000)
    return () => clearInterval(id)
  }, [])
  return label
}

/* ───────────────────────── tipos ───────────────────────── */

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
  const withPricing = products.map((group) => {
    const pricing = getStepPricing(group.tiers, group.currentUnits)
    return { group, pricing }
  })

  const nonNew = withPricing.filter(
    ({ group }) => !((group.memberCount ?? 0) <= 1 && group.currentUnits <= 1),
  )
  const sortedByMembers = [...nonNew].sort(
    (a, b) => (b.group.memberCount ?? 0) - (a.group.memberCount ?? 0),
  )
  const topCount = Math.max(1, Math.ceil(sortedByMembers.length * 0.2))
  const topThreshold = sortedByMembers[topCount - 1]?.group.memberCount ?? 10

  return withPricing.map(({ group, pricing }) => {
    let status: CardStatus = 'active'

    if ((group.memberCount ?? 0) <= 1 && group.currentUnits <= 1) {
      status = 'new'
    } else if (pricing.nextTier && pricing.unitsToNext <= 3) {
      status = 'almost_reached'
    } else if ((group.memberCount ?? 0) >= Math.max(10, topThreshold)) {
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

/* ═══════════════════════════════════════════
   useCardState — pricing + checkout para FeaturedCard
   ═══════════════════════════════════════════ */
function useCardState(product: GroupProduct, isAuthed: boolean) {
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
  const selectedPrice = detents.length > 0 ? detents[selIdx].price : currentPrice
  const confirmed = selIdx <= curIdx
  const accent = modeAccent(confirmed)
  const ctaBg = confirmed ? 'rgba(2, 73, 71,.10)' : 'rgba(232,148,74,.12)'
  const ctaText = confirmed
    ? `Asegurar hasta ${fmt(selectedPrice)}`
    : `Asegurar hasta ${fmt(selectedPrice)}`

  const handleCheckout = () => {
    if (!confirmed && isAuthed) {
      open({
        groupId: product.id,
        productName: product.name,
        productSpec: product.variant,
        imageUrl: product.imageUrl ?? null,
        quantity: 1,
        maxPricePerUnit: selectedPrice,
        joinMode: 'esperar',
        targetPrice: selectedPrice,
      })
    } else if (!confirmed) {
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

  return { currentPrice, nextTier, isComplete, missing, savings, href, detents, curIdx, selIdx, setSelIdx, accent, ctaBg, ctaText, handleCheckout }
}

/* ───────────────────────── componente ──────────────────── */

export default function HomeDesktopView({ products, favoriteIds = [], isAuthed = false }: Props) {
  const [sortBy, setSortBy] = useState<SortOption>('popular')
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')

  const favSet = useMemo(() => new Set(favoriteIds), [favoriteIds])
  const enriched = useMemo(() => enrichGroups(products), [products])
  const countdown = useCountdown()

  /* Producto destacado: el primero de la lista */
  const featured = products[0]

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

  /* Filtrar por búsqueda */
  const filtered = useMemo(() => {
    if (!query.trim()) return sorted
    const q = query.toLowerCase()
    return sorted.filter((item) => item.group.name.toLowerCase().includes(q))
  }, [sorted, query])

  return (
    <div className="min-h-screen" style={{ background: '#FBFAF8' }}>
      <DesktopNavbar />

      {/* ══════════ HERO ══════════ */}
      <section style={{ background: '#FBFAF8' }}>
        <div className="max-w-[1240px] mx-auto px-8 pt-14 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Izquierda: editorial + search + 3 pasos */}
          <div>
            <h1 className="font-serif leading-[1.02] text-neutral-900" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: 'clamp(44px, 4.4vw, 64px)' }}>
              Cuantos más seamos,
              <br />
              <span className="italic" style={{ color: '#024947' }}>menos pagamos.</span>
            </h1>

            {/* Search bar */}
            <div className="mt-8 flex items-center gap-2 bg-white rounded-full pl-6 pr-2 py-2" style={{ boxShadow: '0 18px 40px -24px rgba(30,20,60,.28)', border: '1px solid #EFEDE7' }}>
              <div className="flex-1 min-w-0">
                <div className="text-[10.5px] font-bold tracking-[0.14em] text-neutral-400 uppercase">Qué buscas</div>
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Busca tu producto"
                  className="w-full text-[15px] text-neutral-800 placeholder:text-neutral-400 bg-transparent focus:outline-none mt-0.5"
                />
              </div>
              <button
                type="button"
                onClick={() => searchRef.current?.focus()}
                aria-label="Buscar"
                className="shrink-0 w-12 h-12 rounded-full grid place-items-center transition-transform active:scale-95"
                style={{ background: '#024947' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>
              </button>
            </div>

            {/* Subtítulo */}
            <h2 className="mt-10 text-[13px] font-bold tracking-tight text-neutral-900">
              Tú decides el límite. <span style={{ color: '#024947' }}>Gropo baja el precio.</span>
            </h2>

            {/* Step progress line */}
            <div className="flex items-center gap-0 mt-5 mb-5">
              <StepCircle n={1} />
              <div className="flex-1 h-[2px] mx-1" style={{ background: '#D8EAE9' }} />
              <StepCircle n={2} />
              <div className="flex-1 h-[2px] mx-1" style={{ background: '#D8EAE9' }} />
              <StepCircle n={3} />
            </div>

            {/* 3 Step cards */}
            <div className="grid grid-cols-3 gap-3">
              {/* Step 1 */}
              <div className="rounded-xl p-4 flex flex-col" style={{ border: '1.5px dashed #D8EAE9', background: '#fff' }}>
                <div className="w-10 h-10 rounded-full grid place-items-center mb-3" style={{ background: '#DEEDEC' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#024947" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </div>
                <h3 className="text-[14px] font-extrabold text-neutral-900 tracking-tight">Tú decides el máximo</h3>
                <p className="text-[12px] text-neutral-500 mt-1.5 leading-relaxed">
                  Elige hasta cuánto pagarías.
                </p>
                <div className="mt-auto pt-3">
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#F9F8FC', border: '1px solid #E6EDEC' }}>
                    <span className="text-[11px] text-neutral-500">Tu límite</span>
                    <span className="text-[14px] font-extrabold ml-auto" style={{ color: '#024947' }}>30 €</span>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="rounded-xl p-4 flex flex-col" style={{ border: '1.5px dashed #D8EAE9', background: '#fff' }}>
                <div className="relative w-10 h-10 rounded-full grid place-items-center mb-3" style={{ background: '#DEEDEC' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#024947" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full grid place-items-center text-white text-[9px] font-bold" style={{ background: '#024947' }}>+</div>
                </div>
                <h3 className="text-[14px] font-extrabold text-neutral-900 tracking-tight">Gropo baja el precio</h3>
                <p className="text-[12px] text-neutral-500 mt-1.5 leading-relaxed">
                  Cada nueva persona acerca el siguiente precio.
                </p>
                <div className="mt-auto pt-3">
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#F9F8FC', border: '1px solid #E6EDEC' }}>
                    <span className="text-[11px] text-neutral-500">Faltan 4 personas</span>
                    <span className="text-[11px] text-neutral-400 mx-1">↓</span>
                    <span className="text-[14px] font-extrabold ml-auto" style={{ color: '#024947' }}>27 €</span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="rounded-xl p-4 flex flex-col" style={{ border: '1.5px dashed #D8EAE9', background: '#fff' }}>
                <div className="relative w-10 h-10 rounded-full grid place-items-center mb-3" style={{ background: '#DEEDEC' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#024947" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                  <div className="absolute -top-0.5 -right-0.5 w-4 h-4 grid place-items-center text-[9px]" style={{ color: '#024947' }}>★</div>
                </div>
                <h3 className="text-[14px] font-extrabold text-neutral-900 tracking-tight">Pagas el mejor precio</h3>
                <p className="text-[12px] text-neutral-500 mt-1.5 leading-relaxed">
                  Al cerrar el gropo, todos pagan el mejor precio alcanzado.
                </p>
                <div className="mt-auto pt-3">
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#F9F8FC', border: '1px solid #E6EDEC' }}>
                    <span className="text-[14px] font-extrabold text-neutral-400">30 €</span>
                    <span className="text-[11px] text-neutral-400 mx-1">↓</span>
                    <span className="text-[14px] font-extrabold" style={{ color: '#024947' }}>27 €</span>
                    <div className="w-5 h-5 rounded-full grid place-items-center ml-auto" style={{ background: '#0B7B44' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Derecha: producto destacado */}
          {featured ? (
            <FeaturedCard product={featured} isFavorited={favSet.has(featured.id)} isAuthed={isAuthed} countdown={countdown} />
          ) : (
            <div className="rounded-[26px] bg-white" style={{ border: '1px solid #EFEDE7' }}>
              <EmptyShowcase minHeight={380} />
            </div>
          )}
        </div>
      </section>

      {/* ══════════ GRID DE GRUPOS ══════════ */}
      {products.length > 0 && (
        <section className="bg-white border-t" style={{ borderColor: '#EFEDE7' }}>
          <main className="max-w-7xl mx-auto px-6 pt-10 pb-12">
            {/* Cabecera */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">Grupos abiertos</h2>
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

            {/* Grid */}
            {filtered.length > 0 ? (
              <div className="grid grid-cols-3 xl:grid-cols-4 gap-6">
                {filtered.map((item) => (
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
                <p className="text-gray-500 text-lg">
                  {query.trim() ? `No se encontraron productos para "${query}"` : 'No hay grupos abiertos en este momento'}
                </p>
              </div>
            )}
          </main>
        </section>
      )}

      {/* ══════════ TRUST BANNER — LA LÓGICA GROPO ══════════ */}
      <section style={{ background: '#024947' }}>
        <div className="max-w-[1240px] mx-auto px-8 py-16">
          {/* Encabezado */}
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold tracking-[0.2em] uppercase mb-3" style={{ color: '#7DBFBD' }}>
              La lógica Gropo
            </p>
            <h2 className="text-[28px] font-extrabold text-white tracking-tight leading-tight">
              Más demanda compatible.<br />
              Mejor precio para todos.
            </h2>
          </div>

          {/* 3 pasos */}
          <div className="grid grid-cols-3 gap-8 mb-14">
            {/* Paso 1 */}
            <div className="text-center">
              <div className="w-12 h-12 rounded-full grid place-items-center mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A8F0C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
              <h3 className="text-[15px] font-bold text-white mb-2">Tú pones el límite</h3>
              <p className="text-[13px] leading-relaxed" style={{ color: '#9DD5D3' }}>
                Decides el precio máximo que estás dispuesto a pagar. Nunca pagarás más.
              </p>
            </div>

            {/* Paso 2 */}
            <div className="text-center">
              <div className="w-12 h-12 rounded-full grid place-items-center mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A8F0C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </div>
              <h3 className="text-[15px] font-bold text-white mb-2">Gropo acumula demanda</h3>
              <p className="text-[13px] leading-relaxed" style={{ color: '#9DD5D3' }}>
                Cuantas más personas se unen al grupo, más baja el precio para todos.
              </p>
            </div>

            {/* Paso 3 */}
            <div className="text-center">
              <div className="w-12 h-12 rounded-full grid place-items-center mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A8F0C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
              </div>
              <h3 className="text-[15px] font-bold text-white mb-2">Todos pagan lo mismo</h3>
              <p className="text-[13px] leading-relaxed" style={{ color: '#9DD5D3' }}>
                Al cerrar el grupo, todos los compradores pagan el mejor precio alcanzado.
              </p>
            </div>
          </div>

          {/* Separador */}
          <div className="h-px mb-10" style={{ background: 'rgba(255,255,255,0.12)' }} />

          {/* 4 trust signals */}
          <div className="grid grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full grid place-items-center shrink-0" style={{ background: 'rgba(255,255,255,0.10)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A8F0C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">Envío garantizado</p>
                <p className="text-[11px]" style={{ color: '#9DD5D3' }}>Seguimiento incluido</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full grid place-items-center shrink-0" style={{ background: 'rgba(255,255,255,0.10)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A8F0C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">Pago seguro</p>
                <p className="text-[11px]" style={{ color: '#9DD5D3' }}>Stripe protege tus datos</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full grid place-items-center shrink-0" style={{ background: 'rgba(255,255,255,0.10)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A8F0C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">Sin riesgos</p>
                <p className="text-[11px]" style={{ color: '#9DD5D3' }}>Devolución si no se alcanza</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full grid place-items-center shrink-0" style={{ background: 'rgba(255,255,255,0.10)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A8F0C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">Soporte durante el proceso</p>
                <p className="text-[11px]" style={{ color: '#9DD5D3' }}>Te acompañamos de inicio a fin</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ═══════════════════════════════════════════
   StepCircle
   ═══════════════════════════════════════════ */
function StepCircle({ n }: { n: number }) {
  return (
    <div className="w-9 h-9 rounded-full grid place-items-center text-[14px] font-extrabold shrink-0" style={{ border: '2px solid #D8EAE9', color: '#024947', background: '#fff' }}>
      {n}
    </div>
  )
}

/* ═══════════════════════════════════════════
   FeaturedCard — grupo destacado (hero derecha)
   ═══════════════════════════════════════════ */
function FeaturedCard({ product, isFavorited, isAuthed, countdown }: { product: GroupProduct; isFavorited: boolean; isAuthed: boolean; countdown: string | null }) {
  const s = useCardState(product, isAuthed)

  return (
    <div className="rounded-[26px] bg-white p-5" style={{ boxShadow: '0 30px 70px -40px rgba(30,20,60,.45)', border: '1px solid #EFEDE7' }}>
      <div className="flex items-center justify-between px-1 pb-3">
        <span className="text-[10.5px] font-bold tracking-[0.16em] uppercase text-neutral-400">Grupo destacado</span>
        {countdown && (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-bold rounded-full px-3 py-1" style={{ background: '#FBEEE0', color: '#C77A2E' }}>
            <span>⏱</span>{countdown}
          </span>
        )}
      </div>

      {/* Image */}
      <Link href={s.href} className="relative block w-full overflow-hidden rounded-[18px] group" style={{ aspectRatio: '1 / 0.62', background: '#111114' }}>
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover opacity-[.92] group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand/20 to-brand/5" />
        )}
        <div className="absolute top-3 right-3">
          <FavoriteButton groupId={product.id} initialFavorited={isFavorited} size={17} icon="heart" className="w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-12 flex items-end justify-between" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,.72))' }}>
          <div>
            <div className="text-[17px] font-bold text-white tracking-tight leading-tight">{product.name}</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-[20px] font-extrabold text-white">{fmt(s.currentPrice)}</span>
              {!s.isComplete && s.nextTier && <span className="text-[13px] text-white/70">→ {fmt(s.nextTier.price)}</span>}
            </div>
          </div>
          {s.savings > 0 && (
            <div className="text-[12.5px] font-bold pb-1" style={{ color: '#A8F0C0' }}>Ahorra {fmtSaving(s.savings)}</div>
          )}
        </div>
      </Link>

      {/* Slider + CTA */}
      <div className="px-1 pt-5">
        {s.detents.length > 1 ? (
          <GropoTargetSlider detents={s.detents} curIdx={s.curIdx} selIdx={s.selIdx} onSelIdx={s.setSelIdx} size="mini" />
        ) : (
          <div className="h-3" />
        )}
        <button
          type="button"
          onClick={s.handleCheckout}
          className="w-full mt-5 font-extrabold text-[14px] rounded-xl cursor-pointer transition-colors active:scale-[0.99] whitespace-nowrap py-3.5"
          style={{ border: `2px solid ${s.accent}`, background: s.ctaBg, color: s.accent }}
        >
          {s.ctaText}
        </button>
      </div>
    </div>
  )
}
