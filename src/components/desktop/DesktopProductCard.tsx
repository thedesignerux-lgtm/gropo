'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { GroupProduct } from '@/lib/mock-data'
import { getStepPricing, getActivationState } from '@/lib/mock-data'
import { useCheckout } from '@/components/checkout/CheckoutProvider'
import { usePulse } from '@/hooks/usePulse'
import FavoriteButton from '@/components/FavoriteButton'
import VondaTargetSlider, { type Detent } from '@/components/VondaTargetSlider'

function fmt(price: number): string {
  return (price % 1 === 0 ? String(price) : price.toFixed(2).replace('.', ',')) + ' €'
}

type Category = 'hot' | 'dropping' | 'complete'

const THEME: Record<Category, { color: string; border: string; badgeBg: string; badgeTx: string }> = {
  hot: { color: '#6D28D9', border: '#E9E4FB', badgeBg: '#FDEBE3', badgeTx: '#C2410C' },
  dropping: { color: '#6D28D9', border: '#E9E4FB', badgeBg: '#EDE9FE', badgeTx: '#6D28D9' },
  complete: { color: '#0F9D58', border: '#BBF0D8', badgeBg: '#E7F7EF', badgeTx: '#0B7B44' },
}

function countdown(closesAt?: string): string | null {
  if (!closesAt) return null
  const diff = new Date(closesAt).getTime() - Date.now()
  if (diff <= 0) return 'Cierra pronto'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h restantes`
  return `${h}h ${String(m).padStart(2, '0')}m restantes`
}

interface Props {
  product: GroupProduct
  isFavorited?: boolean
  isAuthed?: boolean
}

export default function DesktopProductCard({ product, isFavorited = false, isAuthed = false }: Props) {
  const { open } = useCheckout()
  const router = useRouter()

  const { currentPrice, nextTier, unitsToNext } = getStepPricing(product.tiers, product.currentUnits)
  const { activated } = getActivationState(product.tiers, product.currentUnits, product.minExecution)
  const isComplete = activated && !nextTier

  const category: Category = isComplete
    ? 'complete'
    : nextTier && unitsToNext > 0 && unitsToNext < 4
      ? 'hot'
      : 'dropping'
  const t = THEME[category]

  const toPrice = nextTier ? nextTier.price : product.tiers[0].price
  const missing = nextTier ? unitsToNext : Math.max(0, product.minExecution - product.currentUnits)
  const timeLabel = countdown(product.closesAt)
  const href = `/grupo/${product.id}`

  // Detents + slider
  const detents: Detent[] = [...product.tiers]
    .sort((a, b) => a.minUnits - b.minUnits)
    .map(tier => ({ price: tier.price, uds: tier.minUnits }))
  let curIdx = 0
  for (let i = 0; i < detents.length; i++) if (detents[i].uds <= product.currentUnits) curIdx = i

  const [selIdx, setSelIdx] = useState(curIdx)
  const { data: pulseData } = usePulse(isComplete ? null : product.id)
  const selectedPrice = detents.length > 0 ? detents[selIdx].price : currentPrice
  const confirmed = selIdx <= curIdx
  const accent = confirmed ? '#6C4BF4' : '#E8944A'

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
    <div className="flex flex-col rounded-2xl bg-white border-2 p-4 transition-all hover:shadow-lg" style={{ borderColor: t.border }}>
      {/* Header: badge + countdown */}
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1" style={{ backgroundColor: t.badgeBg, color: t.badgeTx }}>
          {category === 'hot' && <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3-1 4-1 6a3 3 0 006 0c2 3 1 6-1 8a5 5 0 01-9-3c0-2 2-3 2-5 0 0 3 1 4-6z" /></svg>}
          {category === 'dropping' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>}
          {category === 'complete' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M5 12l5 5 9-11" /></svg>}
          {category === 'complete' ? 'Meta alcanzada' : missing > 0 ? `Faltan ${missing} unidades` : 'Bajando de precio'}
        </span>
        {timeLabel && (
          <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400 font-medium flex-shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></svg>
            {timeLabel}
          </span>
        )}
      </div>

      {/* Product */}
      <Link href={href} className="flex gap-3 items-start mt-3 group">
        <div className="w-[68px] h-[68px] rounded-xl bg-neutral-100 shrink-0 overflow-hidden flex items-center justify-center">
          {product.imageUrl
            ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-neutral-300" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>}
        </div>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-[15px] font-bold text-neutral-900 leading-tight line-clamp-2">{product.name}</h3>
          {product.variant && <p className="text-xs text-neutral-500 mt-1 leading-snug">{product.variant}</p>}
        </div>
      </Link>

      {/* Prices */}
      <div className="flex justify-between items-end mt-4 mb-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Precio actual</p>
          <p className="text-[19px] font-extrabold text-neutral-900 tabular-nums mt-0.5">{fmt(currentPrice)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{isComplete ? 'Precio final' : 'Siguiente precio'}</p>
          <p className="text-[19px] font-extrabold tabular-nums mt-0.5" style={{ color: t.color }}>{fmt(isComplete ? currentPrice : toPrice)}</p>
        </div>
      </div>

      {/* VONDA target slider (arrastrable) */}
      {detents.length > 1 ? (
        <div className="mt-2">
          <VondaTargetSlider detents={detents} curIdx={curIdx} selIdx={selIdx} onSelIdx={setSelIdx} size="mini" pulse={pulseData?.steps} glow={pulseData?.glow} />
        </div>
      ) : (
        <div className="mt-2" />
      )}

      {/* Progreso: texto único */}
      <p className="text-[13px] text-neutral-700 mt-2.5">
        {isComplete ? (
          <span className="font-semibold" style={{ color: t.color }}>¡Rebaja máxima alcanzada!</span>
        ) : (
          <>Faltan <b style={{ color: t.color }}>{missing} unidades</b> para bajar a <b style={{ color: t.color }}>{fmt(toPrice)}</b>.</>
        )}
      </p>

      {/* Social + ahorro */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex -space-x-1.5">
          {Array.from({ length: Math.min(3, Math.max(1, product.currentUnits)) }).map((_, i) => (
            <div key={i} aria-hidden="true" className="w-6 h-6 rounded-full bg-neutral-200 border-2 border-white flex items-center justify-center text-[9px] font-bold text-neutral-500">
              {String.fromCharCode(65 + i)}
            </div>
          ))}
          {product.currentUnits > 3 && (
            <div aria-hidden="true" className="w-6 h-6 rounded-full bg-neutral-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-neutral-500">+{product.currentUnits - 3}</div>
          )}
        </div>
        <span className="text-xs text-neutral-500">{product.currentUnits} {product.currentUnits === 1 ? 'persona' : 'personas'} en el grupo</span>
      </div>

      {product.pvp > currentPrice && (
        <div className="flex items-center gap-1.5 mt-2.5 text-[13px] font-semibold text-brand-green">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
          Ahorras {fmt(product.pvp - currentPrice)} respecto al PVP
        </div>
      )}

      {/* Footer: CTA + corazón */}
      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={handleCheckout}
          className="flex-1 flex items-center justify-center py-3 rounded-xl text-sm font-bold transition-[filter] hover:brightness-95 whitespace-nowrap"
          style={{ backgroundColor: `${accent}14`, color: accent, border: `2px solid ${accent}` }}
        >
          {confirmed ? `Asegurar plaza · ${fmt(selectedPrice)}` : `Reservar plaza · Máx. ${fmt(selectedPrice)}`}
        </button>
        <FavoriteButton
          groupId={product.id}
          initialFavorited={isFavorited}
          size={18}
          icon="heart"
          className="w-11 h-11 rounded-xl border border-neutral-200 hover:border-neutral-300 flex items-center justify-center shrink-0 bg-white"
        />
      </div>
    </div>
  )
}
