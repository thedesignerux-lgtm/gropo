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

  return (
    <div className="min-h-screen bg-white">
      {/* ── Compact header (1b) ── */}
      <header className="sticky top-0 z-30 bg-white border-b" style={{ borderColor: '#F1EFF5' }}>
        <div className="max-w-[1240px] mx-auto flex items-center gap-5 px-8 py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-[34px] h-[34px] rounded-[10px] bg-brand grid place-items-center text-white font-extrabold text-lg">v</div>
            <span className="text-xl font-extrabold tracking-tight text-neutral-900">Vonda</span>
          </Link>

          {/* Search bar with countdown badge */}
          <div className="flex-1 max-w-[460px] flex items-center h-12 rounded-full px-4 pr-1.5" style={{ background: '#F6F5FA', border: '1px solid #ECEAF2' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9a97a2" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca tu producto…"
              className="flex-1 text-sm text-neutral-700 placeholder:text-neutral-400 bg-transparent ml-3 focus:outline-none"
            />
            {countdown && (
              <span className="shrink-0 text-xs font-bold text-brand rounded-full px-3 py-1.5" style={{ background: '#EDE9FB' }}>
                {countdown}
              </span>
            )}
          </div>

          {/* Right: CTA + avatar */}
          <div className="flex items-center gap-3.5 ml-auto">
            <Link
              href="/crear-peticion"
              className="text-sm font-bold text-brand rounded-full px-4 py-2.5"
              style={{ border: '1.5px solid #DAD2FA' }}
            >
              Crear petición
            </Link>
            <Link
              href="/perfil"
              className="w-9 h-9 rounded-full grid place-items-center text-sm font-extrabold text-brand"
              style={{ background: '#EDE9FB' }}
            >
              V
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1240px] mx-auto px-8">
        {/* ── Category chips ── */}
        <div className="flex gap-2.5 flex-wrap pt-5 pb-2">
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

        {/* ── Heading ── */}
        <div className="flex items-center justify-between pt-5 pb-1">
          <div className="flex items-center gap-3">
            <h2 className="text-[26px] font-extrabold tracking-tight text-neutral-900">Grupos abiertos</h2>
            <span className="text-[13px] font-bold text-brand rounded-full px-3 py-1" style={{ background: '#EDE9FB' }}>
              {filtered.length} activo{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
          <span className="text-sm text-neutral-400">
            Ordenar por: <strong className="text-neutral-900">Recomendados</strong>
          </span>
        </div>

        {/* ── 4-column grid ── */}
        {filtered.length === 0 ? (
          <div className="py-20 text-center text-neutral-400 text-lg">
            {query.trim() ? `No se encontraron productos para "${query}"` : 'No hay grupos abiertos en esta categoría'}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-5 pt-5 pb-10">
            {filtered.map((product) => (
              <GridCard key={product.id} product={product} isFavorited={favSet.has(product.id)} isAuthed={isAuthed} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

/* ═══════════════════════════════════════════
   GridCard — 1b image card with gradient overlay
   ═══════════════════════════════════════════ */

function GridCard({ product, isFavorited, isAuthed }: { product: GroupProduct; isFavorited: boolean; isAuthed: boolean }) {
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
    <div className="rounded-[18px] overflow-hidden bg-white flex flex-col" style={{ border: '1px solid #ECEAF2' }}>
      {/* Image with gradient overlay */}
      <Link href={href} className="relative block w-full overflow-hidden group" style={{ aspectRatio: '1 / 0.85', background: '#1a1a1f' }}>
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover opacity-[.88] group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand/20 to-brand/5" />
        )}

        {/* Faltan badge */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-extrabold text-brand" style={{ background: 'rgba(255,255,255,.94)', boxShadow: '0 4px 14px -6px rgba(30,20,60,.4)' }}>
          {isComplete ? '✓ Mejor precio' : `↓ Faltan ${missing} uds`}
        </div>

        {/* Heart */}
        <div className="absolute top-2 right-2">
          <FavoriteButton
            groupId={product.id}
            initialFavorited={isFavorited}
            size={16}
            icon="heart"
            className="w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md"
          />
        </div>

        {/* Gradient overlay with name + prices */}
        <div className="absolute bottom-0 left-0 right-0 px-3.5 pb-3.5 pt-10" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,.68))' }}>
          <div className="text-sm font-bold text-white tracking-tight leading-tight line-clamp-1">{product.name}</div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-[17px] font-extrabold text-white">{fmt(currentPrice)}</span>
            {!isComplete && nextTier && (
              <span className="text-[11.5px] text-white/70">→ {fmt(nextTier.price)}</span>
            )}
          </div>
          {savings > 0 && (
            <div className="text-[11px] font-bold mt-0.5" style={{ color: '#A8F0C0' }}>Ahorra {fmt(savings)}</div>
          )}
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
          className="w-full mt-3 font-extrabold text-[12.5px] rounded-xl cursor-pointer transition-colors active:scale-[0.99] whitespace-nowrap py-3"
          style={{ border: `2px solid ${accent}`, background: ctaBg, color: accent }}
        >
          {ctaText}
        </button>
      </div>
    </div>
  )
}
