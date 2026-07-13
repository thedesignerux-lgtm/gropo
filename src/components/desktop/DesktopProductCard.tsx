import Link from 'next/link'
import type { GroupProduct } from '@/lib/mock-data'
import { getStepPricing, getActivationState } from '@/lib/mock-data'
import FavoriteButton from '@/components/FavoriteButton'
import PulseBar from '@/components/PulseBar'

function fmt(price: number): string {
  return (price % 1 === 0 ? String(price) : price.toFixed(2).replace('.', ',')) + ' €'
}

type Category = 'hot' | 'dropping' | 'complete'

// Estilo SOFT (mockup 12 jul): lavanda; pill NARANJA si faltan <4 uds, DORADA si no
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
}

export default function DesktopProductCard({ product, isFavorited = false }: Props) {
  const { currentPrice, nextTier, unitsToNext } = getStepPricing(product.tiers, product.currentUnits)
  const { activated } = getActivationState(product.tiers, product.currentUnits, product.minExecution)
  const isComplete = activated && !nextTier
  const hoursLeft = product.closesAt ? Math.max(0, (new Date(product.closesAt).getTime() - Date.now()) / 3600000) : null

  const category: Category = isComplete
    ? 'complete'
    : nextTier && unitsToNext > 0 && unitsToNext < 4
      ? 'hot'
      : 'dropping'
  const t = THEME[category]

  const target = nextTier ? nextTier.minUnits : activated ? product.currentUnits : product.minExecution
  const toPrice = nextTier ? nextTier.price : product.tiers[0].price
  const missing = nextTier ? unitsToNext : Math.max(0, product.minExecution - product.currentUnits)
  const pct = target > 0 ? Math.min(100, Math.round((product.currentUnits / target) * 100)) : 100
  const timeLabel = countdown(product.closesAt)

  return (
    <Link
      href={`/grupo/${product.id}`}
      className="group flex flex-col rounded-2xl bg-white border-2 p-4 transition-all hover:shadow-lg hover:-translate-y-0.5 motion-reduce:transition-none"
      style={{ borderColor: t.border }}
    >
      {/* Header: badge + countdown + kebab */}
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1" style={{ backgroundColor: t.badgeBg, color: t.badgeTx }}>
          {category === 'hot' && <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3-1 4-1 6a3 3 0 006 0c2 3 1 6-1 8a5 5 0 01-9-3c0-2 2-3 2-5 0 0 3 1 4-6z" /></svg>}
          {category === 'dropping' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>}
          {category === 'complete' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M5 12l5 5 9-11" /></svg>}
          {category === 'complete' ? 'Meta alcanzada' : missing > 0 ? `Faltan ${missing} unidades` : 'Bajando de precio'}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {timeLabel && (
            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400 font-medium">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></svg>
              {timeLabel}
            </span>
          )}
          <span className="text-neutral-300" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
          </span>
        </div>
      </div>

      {/* Product */}
      <div className="flex gap-3 items-start mt-3">
        <div className="w-[68px] h-[68px] rounded-xl bg-neutral-100 shrink-0 overflow-hidden flex items-center justify-center">
          {product.imageUrl
            ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-neutral-300" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>}
        </div>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-[15px] font-bold text-neutral-900 leading-tight line-clamp-2">{product.name}</h3>
          {product.variant && <p className="text-xs text-neutral-500 mt-1 leading-snug">{product.variant}</p>}
        </div>
      </div>

      {/* Prices */}
      <div className="flex justify-between items-end mt-4 mb-2.5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Precio actual</p>
          <p className="text-[19px] font-extrabold text-neutral-900 tabular-nums mt-0.5">{fmt(currentPrice)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{isComplete ? 'Precio final' : 'Siguiente precio'}</p>
          <p className="text-[19px] font-extrabold tabular-nums mt-0.5" style={{ color: t.color }}>{fmt(isComplete ? currentPrice : toPrice)}</p>
        </div>
      </div>

      {/* VONDA PULSE: barra completa (nodos + precios + glow + conversión) */}
      <PulseBar
        groupId={product.id}
        current={product.currentUnits}
        tiers={product.tiers.map((tier) => ({ units: tier.minUnits, price: tier.price }))}
        variant={category}
        disabled={isComplete}
      />

      {/* Progreso: texto único (sin "X/Y uds", regla de oro) */}
      <p className="text-[13px] text-neutral-700 mt-2.5">
        {isComplete ? (
          <span className="font-semibold" style={{ color: t.color }}>¡Rebaja máxima alcanzada!</span>
        ) : (
          <>Faltan <b style={{ color: t.color }}>{missing} unidades</b> para bajar a <b style={{ color: t.color }}>{fmt(toPrice)}</b>.</>
        )}
      </p>

      {/* Social: avatares + actividad */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex -space-x-1.5" role="group" aria-label={`${product.currentUnits} personas en el grupo`}>
          {Array.from({ length: Math.min(3, Math.max(1, product.currentUnits)) }).map((_, i) => (
            <div key={i} aria-hidden="true" className="w-6 h-6 rounded-full bg-neutral-200 border-2 border-white flex items-center justify-center text-[9px] font-bold text-neutral-500">
              {String.fromCharCode(65 + i)}
            </div>
          ))}
          {product.currentUnits > 3 && (
            <div aria-hidden="true" className="w-6 h-6 rounded-full bg-neutral-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-neutral-500">+{product.currentUnits - 3}</div>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
          {product.currentUnits} {product.currentUnits === 1 ? 'persona' : 'personas'} en el grupo
        </span>
      </div>

      {/* Beneficio: ahorro (persuasión, contraste alto en descubrimiento) */}
      {product.pvp > currentPrice && (
        <div className="flex items-center gap-1.5 mt-2.5 text-[13px] font-semibold text-brand-green">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
          Ahorras {fmt(product.pvp - currentPrice)} respecto al PVP
        </div>
      )}

      {/* Footer: CTA + corazón */}
      <div className="flex items-center gap-2 mt-4">
        <div
          className="flex-1 flex items-center justify-center py-3 rounded-xl text-sm font-bold transition-[filter] hover:brightness-95"
          style={{ backgroundColor: `${t.color}12`, color: t.color, border: `1px solid ${t.color}2E` }}
        >
          {isComplete ? 'Entrar al precio mínimo' : `Asegurar plaza · ${fmt(currentPrice)}`}
        </div>
        <FavoriteButton
          groupId={product.id}
          initialFavorited={isFavorited}
          size={18}
          icon="heart"
          className="w-11 h-11 rounded-xl border border-neutral-200 hover:border-neutral-300 flex items-center justify-center shrink-0 bg-white"
        />
      </div>
    </Link>
  )
}
