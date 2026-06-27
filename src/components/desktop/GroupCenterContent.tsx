'use client'

import type { TabId } from './GroupSidebar'
import { useTierDemand } from '@/hooks/useTierDemand'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

interface Tier { minUnits: number; price: number }

interface Props {
  activeTab: TabId
  name: string
  spec: string
  imageUrl?: string
  pvp: number
  bestPrice: number
  totalUnits: number
  maxStock: number
  tiers: Tier[]
  groupId: string
}

/* ── Resumen tab (main product view) ── */
function ResumenTab({
  name, spec, imageUrl, pvp, bestPrice, totalUnits, maxStock, groupId,
}: Omit<Props, 'activeTab' | 'tiers'>) {
  const { tiers: demandTiers, currentPrice, nextTier, missing } = useTierDemand(groupId)
  const displayPrice = currentPrice > 0 ? currentPrice : bestPrice
  const savings = pvp - displayPrice
  const savingsPct = pvp > 0 ? Math.round((savings / pvp) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-wide">
        <span>CICLISMO</span>
        <span>&rsaquo;</span>
        <span>CUBIERTAS</span>
      </div>

      {/* Product header */}
      <div className="flex gap-6">
        {/* Image */}
        <div className="w-[280px] h-[280px] flex-shrink-0 bg-[#F5F5F5] rounded-2xl overflow-hidden flex items-center justify-center">
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="w-full h-full object-contain p-4" />
          ) : (
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">{name}</h1>
          {spec && <p className="text-base text-neutral-500 mb-3">{spec}</p>}

          {/* Verified seller badge */}
          <div className="flex items-center gap-1.5 mb-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-green">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span className="text-sm font-medium text-brand-green">Vendedor verificado</span>
          </div>

          {/* Next tier callout — real data from tier_demand */}
          {nextTier && missing > 0 && (
            <div className="bg-orange-50 rounded-xl p-3.5 mb-4">
              <div className="flex items-start gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#993C1D] flex-shrink-0 mt-0.5">
                  <path d="M12 2c1 3 3.5 5 6 6-1 4-3 7-6 10-3-3-5-6-6-10 2.5-1 5-3 6-6z" />
                </svg>
                <div>
                  <p className="text-base font-semibold text-neutral-900">
                    Faltan {missing} ud{missing === 1 ? '' : 's'} para {fmt(nextTier.price)}
                  </p>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    El precio baja automáticamente para todos cuando se alcancen {nextTier.minUnits} uds
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Price */}
          <div className="mb-4">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-neutral-900">{fmt(displayPrice)}</span>
              {pvp > displayPrice && (
                <span className="text-lg text-neutral-400 line-through">{fmt(pvp)}</span>
              )}
            </div>
            {savings > 0.01 && (
              <p className="text-sm font-medium text-brand-green mt-1">
                Ahorras {fmt(savings)} ({savingsPct}%)
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar: total demand */}
      <div className="bg-white rounded-xl border border-neutral-100 p-4">
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="flex items-center gap-2 text-neutral-700 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-brand" />
            {totalUnits} unidades en el grupo
          </span>
        </div>
        <div className="w-full h-3 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-full"
            style={{ width: `${maxStock > 0 ? (totalUnits / maxStock) * 100 : 50}%`, transition: 'width 300ms' }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-neutral-400">
          <span>{totalUnits} uds actuales</span>
          <span>{maxStock > 0 ? `${maxStock} stock máximo` : ''}</span>
        </div>
      </div>

      {/* About */}
      <div className="bg-white rounded-xl border border-neutral-100 p-5">
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">Sobre el producto</h3>
        <p className="text-sm text-neutral-600 leading-relaxed mb-3">
          El referente en rendimiento. Máximo agarre, baja resistencia a la rodadura y protección antipinchazos. Ideal para entrenamientos y competiciones.
        </p>
        <ul className="space-y-2">
          {[
            'Compuesto BlackChili para mayor agarre',
            'Protección Vectran Breaker antipinchazos',
            'Baja resistencia a la rodadura',
            'Durabilidad y kilometraje superior',
          ].map((feat) => (
            <li key={feat} className="flex items-start gap-2 text-sm text-neutral-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-green flex-shrink-0 mt-0.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {feat}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ── Placeholder tabs ── */
function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-64 bg-neutral-50 rounded-2xl">
      <div className="text-center">
        <p className="text-lg font-semibold text-neutral-400">{title}</p>
        <p className="text-sm text-neutral-300 mt-1">Próximamente</p>
      </div>
    </div>
  )
}

/* ── Main export ── */
export default function GroupCenterContent(props: Props) {
  const { activeTab, ...rest } = props

  switch (activeTab) {
    case 'resumen':
      return <ResumenTab {...rest} />
    case 'conversacion':
      return <PlaceholderTab title="Conversación" />
    case 'participantes':
      return <PlaceholderTab title="Participantes" />
    case 'historial':
      return <PlaceholderTab title="Historial de precios" />
    case 'preguntas':
      return <PlaceholderTab title="Preguntas" />
    case 'alertas':
      return <PlaceholderTab title="Alertas" />
    default:
      return <ResumenTab {...rest} />
  }
}
