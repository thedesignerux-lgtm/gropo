'use client'

import type { TabId } from './GroupSidebar'
import type { Tier } from '@/lib/mock-data'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

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
  activated: boolean
  unitsToNext: number
  nextTier: Tier | null
  /* counts for the "esperando" segment */
  waitingCount?: number
  waitingPrice?: number
}

/* ── Resumen tab (main product view) ── */
function ResumenTab({
  name, spec, imageUrl, pvp, bestPrice, totalUnits, maxStock,
  activated, unitsToNext, nextTier, waitingCount = 0, waitingPrice,
}: Omit<Props, 'activeTab' | 'tiers'>) {
  const savings = pvp - bestPrice
  const savingsPct = pvp > 0 ? Math.round((savings / pvp) * 100) : 0
  const buyingNow = totalUnits - waitingCount
  const barTotal = maxStock > 0 ? maxStock : Math.max(totalUnits, 30)

  // Activity feed (placeholder data — will be dynamic)
  const activities = [
    { name: 'Laura', action: 'se unió al grupo', time: 'Hace 15 min' },
    { name: 'Javier', action: `cambió a esperar a ${waitingPrice ? fmt(waitingPrice) : '—'}`, time: 'Hace 44 min' },
    { name: 'Marta', action: 'se unió al grupo', time: 'Hace 1 h' },
    { name: 'Carlos', action: 'compró ahora', time: 'Hace 2 h' },
    { name: 'Ana', action: `cambió a esperar a ${waitingPrice ? fmt(waitingPrice) : '—'}`, time: 'Hace 3 h' },
  ]

  // Comments (placeholder)
  const comments = [
    { name: 'Javier', text: 'Gran producto a muy buen precio. Si somos 4 más lo conseguimos!', time: 'Hace 1 h', likes: 3, hearts: 3 },
    { name: 'Marta', text: 'Ya queda poco! 💪', time: 'Hace 2 h', likes: 0, hearts: 2 },
  ]

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase tracking-wide">
        <span>CICLISMO</span>
        <span>›</span>
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

          {/* Fire callout — "X comprarían a Y€" */}
          {nextTier && waitingCount > 0 && (
            <div className="bg-orange-50 rounded-xl p-3.5 mb-4">
              <div className="flex items-start gap-2">
                <span className="text-lg">🔥</span>
                <div>
                  <p className="text-base font-semibold text-neutral-900">
                    {waitingCount} comprarían a {fmt(nextTier.price)}
                  </p>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    Solo faltan {unitsToNext} persona{unitsToNext === 1 ? '' : 's'} para activar
                  </p>
                  <p className="text-sm text-neutral-500">
                    {waitingCount} compras automáticas a {fmt(nextTier.price)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Price */}
          <div className="mb-4">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-neutral-900">{fmt(bestPrice)}</span>
              {pvp > bestPrice && (
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

      {/* Progress bar: comprando ahora vs esperando */}
      <div className="bg-white rounded-xl border border-neutral-100 p-4">
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="flex items-center gap-2 text-brand-green font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-green" />
            {buyingNow > 0 ? buyingNow : totalUnits} comprando ahora
          </span>
          {waitingCount > 0 && (
            <span className="flex items-center gap-2 text-brand font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-brand" />
              {waitingCount} esperando {waitingPrice ? fmt(waitingPrice) : ''}
            </span>
          )}
        </div>
        <div className="w-full h-3 bg-neutral-100 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-brand-green rounded-l-full"
            style={{ width: `${(buyingNow / barTotal) * 100}%`, transition: 'width 300ms' }}
          />
          {waitingCount > 0 && (
            <div
              className="h-full bg-brand"
              style={{ width: `${(waitingCount / barTotal) * 100}%`, transition: 'width 300ms' }}
            />
          )}
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-neutral-400">
          <span>{totalUnits} interesados en total</span>
          <span>{totalUnits} / {maxStock > 0 ? maxStock : '∞'} para desbloquear</span>
        </div>
      </div>

      {/* Two-column: About + Activity */}
      <div className="grid grid-cols-2 gap-4">
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
          <button className="mt-4 text-sm text-brand font-medium hover:underline flex items-center gap-1">
            Ver más detalles
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {/* Activity feed */}
        <div className="bg-white rounded-xl border border-neutral-100 p-5">
          <h3 className="text-sm font-semibold text-neutral-900 mb-3">Actividad reciente</h3>
          <div className="space-y-3">
            {activities.map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-semibold text-neutral-500 flex-shrink-0">
                  {a.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-700">
                    <span className="font-medium">{a.name}</span>{' '}
                    <span className="text-neutral-500">{a.action}</span>
                  </p>
                </div>
                <span className="text-xs text-neutral-400 flex-shrink-0">{a.time}</span>
              </div>
            ))}
          </div>
          <button className="mt-4 text-sm text-brand font-medium hover:underline flex items-center gap-1">
            Ver toda la actividad
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Comments */}
      <div className="bg-white rounded-xl border border-neutral-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-neutral-900">Lo que dicen los participantes</h3>
          <button className="text-sm text-brand font-medium hover:underline flex items-center gap-1.5">
            Ver conversación
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {comments.map((c, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-sm font-semibold text-neutral-500 flex-shrink-0">
                {c.name[0]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900">{c.name}</p>
                <p className="text-sm text-neutral-600 mt-0.5">{c.text}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-400">
                  <span>{c.time}</span>
                  {c.likes > 0 && <span>💬 {c.likes}</span>}
                  {c.hearts > 0 && <span>❤️ {c.hearts}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
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
