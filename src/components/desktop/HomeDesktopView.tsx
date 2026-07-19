'use client'

import { useState, useEffect } from 'react'
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
  { key: 'infantil', label: 'Infantil' },
  { key: 'otros', label: 'Otros' },
]

const NAV_LINKS = [
  { href: '/', label: 'Explorar' },
  { href: '/mis-grupos', label: 'Mis grupos' },
  { href: '/favoritos', label: 'Mi Radar' },
  { href: '/como-funciona', label: 'Cómo funciona' },
]

function getProductCategory(_product: GroupProduct): string {
  return 'deporte'
}

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

/* ── Brand logo (cuadrado morado "v" + Vonda) ── */
function BrandLogo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="Vonda">
      <div className="w-[34px] h-[34px] rounded-[10px] grid place-items-center text-white font-extrabold text-lg" style={{ background: '#6C4BF4' }}>v</div>
      <span className="text-xl font-extrabold tracking-tight text-neutral-900">Vonda</span>
    </Link>
  )
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
  const countdown = useCountdown()

  const filtered = products.filter((p) => {
    if (query.trim() && !p.name.toLowerCase().includes(query.toLowerCase())) return false
    if (selectedCat !== 'todos' && getProductCategory(p) !== selectedCat) return false
    return true
  })

  // Grupo destacado = primero de la lista completa (sin filtrar). Resto → grid.
  const featured = products[0]
  const gridProducts = filtered.filter((p) => p.id !== featured?.id)

  // (stats removed — replaced by HowItWorks section)

  return (
    <div className="min-h-screen" style={{ background: '#FBFAF8' }}>
      {/* ══════════ NAVBAR ══════════ */}
      <header className="sticky top-0 z-30 border-b" style={{ background: 'rgba(251,250,248,0.9)', backdropFilter: 'blur(12px)', borderColor: '#EFEDE7' }}>
        <div className="max-w-[1240px] mx-auto flex items-center gap-8 px-8 h-[72px]">
          <BrandLogo />

          <nav className="hidden lg:flex items-center gap-7 ml-4">
            {NAV_LINKS.map((link) => {
              const active = link.href === '/'
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-[15px] transition-colors ${active ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-500 hover:text-neutral-900'}`}
                >
                  {active && <span className="text-brand mr-1.5" style={{ color: '#6C4BF4' }}>•</span>}
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-3.5 ml-auto">
            <Link
              href="/crear-peticion"
              className="text-[15px] font-semibold text-neutral-900 rounded-full px-5 py-2.5 bg-white transition-colors hover:border-brand"
              style={{ border: '1.5px solid #E4E1DA' }}
            >
              Crea tu grupo
            </Link>
            <Link
              href="/perfil"
              className="w-9 h-9 rounded-full grid place-items-center text-sm font-extrabold"
              style={{ background: '#EDE9FB', color: '#6C4BF4' }}
            >
              V
            </Link>
          </div>
        </div>
      </header>

      {/* ══════════ HERO + HOW IT WORKS (1a) ══════════ */}
      <section style={{ background: '#FBFAF8' }}>
        <div className="max-w-[1240px] mx-auto px-8 pt-14 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left: editorial + search + 3 steps + benefits */}
          <div>
            <h1 className="font-serif leading-[1.02] text-neutral-900" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: 'clamp(44px, 4.4vw, 64px)' }}>
              Cuantos más seamos,
              <br />
              <span className="italic" style={{ color: '#6C4BF4' }}>menos pagamos.</span>
            </h1>

            {/* Search bar card */}
            <div className="mt-8 flex items-center gap-2 bg-white rounded-full pl-6 pr-2 py-2" style={{ boxShadow: '0 18px 40px -24px rgba(30,20,60,.28)', border: '1px solid #EFEDE7' }}>
              <div className="flex-1 min-w-0">
                <div className="text-[10.5px] font-bold tracking-[0.14em] text-neutral-400 uppercase">Qué buscas</div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Busca tu producto"
                  className="w-full text-[15px] text-neutral-800 placeholder:text-neutral-400 bg-transparent focus:outline-none mt-0.5"
                />
              </div>
              <button
                type="button"
                aria-label="Buscar"
                className="shrink-0 w-12 h-12 rounded-full grid place-items-center transition-transform active:scale-95"
                style={{ background: '#6C4BF4' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>
              </button>
            </div>

            {/* Section heading */}
            <h2 className="mt-10 text-[13px] font-bold tracking-tight text-neutral-900">
              Tú decides el límite. <span style={{ color: '#6C4BF4' }}>Vonda baja el precio.</span>
            </h2>

            {/* Step progress line: 1 → 2 → 3 */}
            <div className="flex items-center gap-0 mt-5 mb-5">
              <StepCircle n={1} />
              <div className="flex-1 h-[2px] mx-1" style={{ background: '#D8D2F0' }} />
              <StepCircle n={2} />
              <div className="flex-1 h-[2px] mx-1" style={{ background: '#D8D2F0' }} />
              <StepCircle n={3} />
            </div>

            {/* 3 Step cards */}
            <div className="grid grid-cols-3 gap-3">
              {/* Step 1 */}
              <div className="rounded-xl p-4 flex flex-col" style={{ border: '1.5px dashed #D8D2F0', background: '#fff' }}>
                <div className="w-10 h-10 rounded-full grid place-items-center mb-3" style={{ background: '#EDE9FB' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6C4BF4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </div>
                <h3 className="text-[14px] font-extrabold text-neutral-900 tracking-tight">Tú decides el máximo</h3>
                <p className="text-[12px] text-neutral-500 mt-1.5 leading-relaxed">
                  Elige hasta cuánto pagarías.
                </p>
                <div className="mt-auto pt-3">
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#F9F8FC', border: '1px solid #ECEAF2' }}>
                    <span className="text-[11px] text-neutral-500">Tu límite</span>
                    <span className="text-[14px] font-extrabold ml-auto" style={{ color: '#6C4BF4' }}>30 €</span>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="rounded-xl p-4 flex flex-col" style={{ border: '1.5px dashed #D8D2F0', background: '#fff' }}>
                <div className="relative w-10 h-10 rounded-full grid place-items-center mb-3" style={{ background: '#EDE9FB' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6C4BF4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full grid place-items-center text-white text-[9px] font-bold" style={{ background: '#6C4BF4' }}>+</div>
                </div>
                <h3 className="text-[14px] font-extrabold text-neutral-900 tracking-tight">Vonda baja el precio</h3>
                <p className="text-[12px] text-neutral-500 mt-1.5 leading-relaxed">
                  Cada nueva persona acerca el siguiente precio.
                </p>
                <div className="mt-auto pt-3">
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#F9F8FC', border: '1px solid #ECEAF2' }}>
                    <span className="text-[11px] text-neutral-500">Faltan 4 personas</span>
                    <span className="text-[11px] text-neutral-400 mx-1">↓</span>
                    <span className="text-[14px] font-extrabold ml-auto" style={{ color: '#6C4BF4' }}>27 €</span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="rounded-xl p-4 flex flex-col" style={{ border: '1.5px dashed #D8D2F0', background: '#fff' }}>
                <div className="relative w-10 h-10 rounded-full grid place-items-center mb-3" style={{ background: '#EDE9FB' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6C4BF4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                  <div className="absolute -top-0.5 -right-0.5 w-4 h-4 grid place-items-center text-[9px]" style={{ color: '#6C4BF4' }}>★</div>
                </div>
                <h3 className="text-[14px] font-extrabold text-neutral-900 tracking-tight">Pagas el mejor precio</h3>
                <p className="text-[12px] text-neutral-500 mt-1.5 leading-relaxed">
                  Al cerrar la Vonda, todos pagan el mejor precio alcanzado.
                </p>
                <div className="mt-auto pt-3">
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#F9F8FC', border: '1px solid #ECEAF2' }}>
                    <span className="text-[14px] font-extrabold text-neutral-400">30 €</span>
                    <span className="text-[11px] text-neutral-400 mx-1">↓</span>
                    <span className="text-[14px] font-extrabold" style={{ color: '#6C4BF4' }}>27 €</span>
                    <div className="w-5 h-5 rounded-full grid place-items-center ml-auto" style={{ background: '#157F52' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: featured group */}
          {featured ? (
            <FeaturedCard product={featured} isFavorited={favSet.has(featured.id)} isAuthed={isAuthed} countdown={countdown} />
          ) : (
            <div className="rounded-[26px] bg-white grid place-items-center text-neutral-400 text-sm" style={{ border: '1px solid #EFEDE7', minHeight: 380 }}>
              No hay grupos destacados
            </div>
          )}
        </div>
      </section>

      {/* ══════════ CATEGORÍAS + GRID ══════════ */}
      <section className="bg-white border-t" style={{ borderColor: '#EFEDE7' }}>
        <div className="max-w-[1240px] mx-auto px-8 pt-8 pb-16">
          {/* Category chips */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-neutral-400 mr-1">Categorías</span>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCat(cat.key)}
                className="text-[13.5px] font-semibold rounded-full px-4 py-2.5 transition-colors cursor-pointer"
                style={
                  selectedCat === cat.key
                    ? { background: '#6C4BF4', color: '#fff', border: '1px solid #6C4BF4' }
                    : { background: '#fff', color: '#4a4a52', border: '1px solid #ECEAF2' }
                }
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Heading */}
          <div className="flex items-center justify-between pt-8 pb-1">
            <div className="flex items-center gap-3">
              <h2 className="text-[26px] font-extrabold tracking-tight text-neutral-900">Grupos abiertos</h2>
              <span className="text-[13px] font-bold rounded-full px-3 py-1" style={{ background: '#EDE9FB', color: '#6C4BF4' }}>
                {gridProducts.length} activo{gridProducts.length !== 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-sm text-neutral-400">
              Ordenar por: <strong className="text-neutral-900">Recomendados</strong>
            </span>
          </div>

          {/* Grid */}
          {gridProducts.length === 0 ? (
            <div className="py-20 text-center text-neutral-400 text-lg">
              {query.trim() ? `No se encontraron productos para "${query}"` : 'No hay más grupos abiertos en esta categoría'}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-5 pt-5">
              {gridProducts.map((product) => (
                <GridCard key={product.id} product={product} isFavorited={favSet.has(product.id)} isAuthed={isAuthed} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function StepCircle({ n }: { n: number }) {
  return (
    <div className="w-9 h-9 rounded-full grid place-items-center text-[14px] font-extrabold shrink-0" style={{ border: '2px solid #D8D2F0', color: '#6C4BF4', background: '#fff' }}>
      {n}
    </div>
  )
}


/* ═══════════════════════════════════════════
   Shared card hook — pricing + checkout logic
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
  const { data: pulseData } = usePulse(isComplete ? null : product.id)
  const selectedPrice = detents.length > 0 ? detents[selIdx].price : currentPrice
  const confirmed = selIdx <= curIdx
  const accent = confirmed ? '#6C4BF4' : '#E8944A'
  const ctaBg = confirmed ? 'rgba(108,75,244,.10)' : 'rgba(232,148,74,.12)'
  const ctaText = confirmed
    ? `Bloquear precio · ${fmt(selectedPrice)}`
    : `Bloquear precio · Máx. ${fmt(selectedPrice)}`

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

  return { currentPrice, nextTier, isComplete, missing, savings, href, detents, curIdx, selIdx, setSelIdx, pulseData, accent, ctaBg, ctaText, handleCheckout }
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
            <div className="text-[12.5px] font-bold pb-1" style={{ color: '#A8F0C0' }}>Ahorra {fmt(s.savings)}</div>
          )}
        </div>
      </Link>

      {/* Slider + CTA */}
      <div className="px-1 pt-5">
        {s.detents.length > 1 ? (
          <VondaTargetSlider detents={s.detents} curIdx={s.curIdx} selIdx={s.selIdx} onSelIdx={s.setSelIdx} size="mini" pulse={s.pulseData?.steps} glow={s.pulseData?.glow} />
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

/* ═══════════════════════════════════════════
   GridCard — tarjeta de grupo (grid inferior)
   ═══════════════════════════════════════════ */
function GridCard({ product, isFavorited, isAuthed }: { product: GroupProduct; isFavorited: boolean; isAuthed: boolean }) {
  const s = useCardState(product, isAuthed)

  return (
    <div className="rounded-[18px] overflow-hidden bg-white flex flex-col" style={{ border: '1px solid #ECEAF2' }}>
      {/* Image with gradient overlay */}
      <Link href={s.href} className="relative block w-full overflow-hidden group" style={{ aspectRatio: '1 / 0.85', background: '#1a1a1f' }}>
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover opacity-[.88] group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand/20 to-brand/5" />
        )}

        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-extrabold" style={{ background: 'rgba(255,255,255,.94)', color: '#6C4BF4', boxShadow: '0 4px 14px -6px rgba(30,20,60,.4)' }}>
          {s.isComplete ? '✓ Mejor precio' : `↓ Faltan ${s.missing} uds`}
        </div>

        <div className="absolute top-2 right-2">
          <FavoriteButton groupId={product.id} initialFavorited={isFavorited} size={16} icon="heart" className="w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-3.5 pb-3.5 pt-10" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,.68))' }}>
          <div className="text-sm font-bold text-white tracking-tight leading-tight line-clamp-1">{product.name}</div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-[17px] font-extrabold text-white">{fmt(s.currentPrice)}</span>
            {!s.isComplete && s.nextTier && <span className="text-[11.5px] text-white/70">→ {fmt(s.nextTier.price)}</span>}
          </div>
          {s.savings > 0 && (
            <div className="text-[11px] font-bold mt-0.5" style={{ color: '#A8F0C0' }}>Ahorra {fmt(s.savings)}</div>
          )}
        </div>
      </Link>

      {/* Slider + CTA */}
      <div className="px-3.5 pt-2.5 pb-3.5">
        {s.detents.length > 1 ? (
          <VondaTargetSlider detents={s.detents} curIdx={s.curIdx} selIdx={s.selIdx} onSelIdx={s.setSelIdx} size="mini" pulse={s.pulseData?.steps} glow={s.pulseData?.glow} />
        ) : (
          <div className="h-3" />
        )}
        <button
          type="button"
          onClick={s.handleCheckout}
          className="w-full mt-3 font-extrabold text-[12.5px] rounded-xl cursor-pointer transition-colors active:scale-[0.99] whitespace-nowrap py-3"
          style={{ border: `2px solid ${s.accent}`, background: s.ctaBg, color: s.accent }}
        >
          {s.ctaText}
        </button>
      </div>
    </div>
  )
}
