'use client'

import { Fragment, useState } from 'react'
import type { Tier, Milestone } from '@/lib/mock-data'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

/* ── Horizontal Tier Bar (desktop style) ── */
function DesktopTierBar({ milestones, totalUnits }: { milestones: Milestone[]; totalUnits: number }) {
  let currentIndex = -1
  milestones.forEach((m, i) => { if (totalUnits >= m.units) currentIndex = i })

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-neutral-900">Tramos de precio</h3>
        <button className="text-neutral-400 hover:text-neutral-600 transition-colors" title="Info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </button>
      </div>

      {/* Price labels */}
      <div className="flex items-end justify-between mb-2">
        {milestones.map((m) => (
          <span key={m.units} className="text-xs font-semibold text-neutral-700 text-center" style={{ width: `${100 / milestones.length}%` }}>
            {fmt(m.price)}
          </span>
        ))}
      </div>

      {/* Dot + line visualization */}
      <div className="flex items-center w-full">
        {milestones.map((m, i) => {
          const reached = totalUnits >= m.units
          const isCurrent = i === currentIndex
          return (
            <Fragment key={m.units}>
              {i > 0 && (() => {
                const prev = milestones[i - 1].units
                const span = m.units - prev
                const frac = span > 0
                  ? Math.max(0, Math.min(1, (totalUnits - prev) / span))
                  : (totalUnits >= m.units ? 1 : 0)
                return (
                  <div className="flex-1 h-[3px] bg-neutral-200 rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full" style={{ width: `${frac * 100}%`, transition: 'width 300ms ease' }} />
                  </div>
                )
              })()}
              <div className="relative flex flex-col items-center">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  reached ? 'bg-brand border-brand' : 'bg-white border-neutral-300'
                } ${isCurrent ? 'ring-2 ring-brand/20' : ''}`}>
                  {reached && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </div>
            </Fragment>
          )
        })}
      </div>

      {/* Unit labels */}
      <div className="flex items-start justify-between mt-2">
        {milestones.map((m) => (
          <span key={m.units} className="text-[11px] text-neutral-400 text-center" style={{ width: `${100 / milestones.length}%` }}>
            {m.units} uds
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Next tier callout ── */
function NextTierCallout({ unitsToNext, nextPrice, savingsPerPerson }: {
  unitsToNext: number; nextPrice: number; savingsPerPerson: number
}) {
  return (
    <div className="bg-brand/5 border border-brand/15 rounded-xl p-3.5 flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-neutral-900">
          {unitsToNext} persona{unitsToNext === 1 ? '' : 's'} más
        </p>
        <p className="text-xs text-neutral-600 mt-0.5">
          Todos bajaréis automáticamente a {fmt(nextPrice)}
        </p>
        <p className="text-xs text-brand font-medium mt-0.5">
          Ahorro de {fmt(savingsPerPerson)} por persona
        </p>
      </div>
    </div>
  )
}

/* ── Participation option card ── */
type ParticipationMode = 'comprar' | 'esperar' | 'seguir'

function ParticipationCard({ mode, selected, onClick, currentPrice, targetPrice }: {
  mode: ParticipationMode
  selected: boolean
  onClick: () => void
  currentPrice: number
  targetPrice?: number
}) {
  const configs = {
    comprar: {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
      title: 'Comprar ahora',
      subtitle: `${fmt(currentPrice)} o mejor`,
      desc: 'Reservo mi plaza al precio actual o mejor.',
    },
    esperar: {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      title: `Esperar a ${targetPrice ? fmt(targetPrice) : '—'}`,
      subtitle: 'Compra automática',
      desc: 'Entraré automáticamente cuando se alcance este precio.',
    },
    seguir: {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
      title: 'Seguir producto',
      subtitle: 'Solo actualizaciones',
      desc: 'No quiero comprar ahora, solo seguir el progreso del grupo.',
    },
  }

  const config = configs[mode]

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
        selected
          ? 'border-brand bg-brand/3'
          : 'border-neutral-100 hover:border-neutral-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex-shrink-0 mt-0.5 ${selected ? 'text-brand' : 'text-neutral-400'}`}>
          {config.icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${selected ? 'text-brand' : 'text-neutral-900'}`}>
            {config.title}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">{config.subtitle}</p>
          <p className="text-xs text-neutral-400 mt-1">{config.desc}</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`flex-shrink-0 mt-1 ${selected ? 'text-brand' : 'text-neutral-300'}`}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </button>
  )
}

/* ── Main Right Sidebar ── */
interface Props {
  groupId: string
  tiers: Tier[]
  milestones: Milestone[]
  totalUnits: number
  bestPrice: number
  nextPrice: number
  pvp: number
  maxStock: number
  closesAt: string
  unitsToNext: number
  nextTier: Tier | null
  activated: boolean
}

export default function GroupRightSidebar({
  groupId, tiers, milestones, totalUnits, bestPrice, nextPrice,
  pvp, maxStock, closesAt, unitsToNext, nextTier, activated,
}: Props) {
  const [selectedMode, setSelectedMode] = useState<ParticipationMode>('comprar')

  // Target price for "esperar" mode — use the next tier price if available
  const targetPrice = nextTier?.price ?? (tiers.length > 0 ? tiers[tiers.length - 1].price : bestPrice)

  // Savings per person if next tier is reached
  const savingsPerPerson = nextTier ? bestPrice - nextTier.price : 0

  // Countdown label
  const closesDate = new Date(closesAt)
  const diffMs = closesDate.getTime() - Date.now()
  const days = Math.max(0, Math.floor(diffMs / 86400000))
  const hours = Math.max(0, Math.floor((diffMs % 86400000) / 3600000))
  const countdownLabel = days > 0 ? `${days}d ${hours}h` : `${hours}h`

  const ctaHref = selectedMode === 'seguir'
    ? '#'
    : `/grupo/${groupId}/unirme${selectedMode === 'esperar' ? `?mode=esperar&target=${targetPrice}` : ''}`

  return (
    <aside className="w-[340px] flex-shrink-0 flex flex-col gap-4">
      {/* Tier bar */}
      {milestones.length >= 2 && (
        <DesktopTierBar milestones={milestones} totalUnits={totalUnits} />
      )}

      {/* Next tier callout */}
      {nextTier && unitsToNext > 0 && (
        <NextTierCallout
          unitsToNext={unitsToNext}
          nextPrice={nextTier.price}
          savingsPerPerson={savingsPerPerson}
        />
      )}

      {/* Participation options */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">Elige cómo participar</h3>
        <div className="flex flex-col gap-2">
          <ParticipationCard
            mode="comprar"
            selected={selectedMode === 'comprar'}
            onClick={() => setSelectedMode('comprar')}
            currentPrice={bestPrice}
          />
          <ParticipationCard
            mode="esperar"
            selected={selectedMode === 'esperar'}
            onClick={() => setSelectedMode('esperar')}
            currentPrice={bestPrice}
            targetPrice={targetPrice}
          />
          <ParticipationCard
            mode="seguir"
            selected={selectedMode === 'seguir'}
            onClick={() => setSelectedMode('seguir')}
            currentPrice={bestPrice}
          />
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-neutral-400">Unidades disponibles</p>
          <p className="text-sm font-semibold text-neutral-900">{maxStock > 0 ? maxStock : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-400">Cierra en</p>
          <p className="text-sm font-semibold text-neutral-900">{countdownLabel}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-400">Envío estimado</p>
          <p className="text-sm font-semibold text-neutral-900">3-5 días</p>
        </div>
      </div>

      {/* Trust */}
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Pago seguro
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Devoluciones fáciles
        </span>
      </div>

      {/* CTA */}
      <div>
        <div className="flex items-center gap-3">
          <button
            className="w-12 h-12 flex items-center justify-center rounded-xl border border-neutral-200 text-neutral-400 hover:text-brand hover:border-brand transition-colors flex-shrink-0"
            aria-label="Guardar en favoritos"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19.5 13.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
            </svg>
          </button>
          <a
            href={ctaHref}
            className="flex-1 bg-brand text-white font-semibold text-base py-3.5 rounded-xl text-center hover:bg-brand-dark active:scale-[0.98] transition-all block"
          >
            <span className="block text-base font-semibold">Reservar mi plaza</span>
            <span className="block text-xs font-normal opacity-80">Entrar al grupo ahora</span>
          </a>
        </div>
        <p className="text-xs text-neutral-400 text-center mt-2">
          Sin compromiso · Puedes cambiar de opción después
        </p>
      </div>
    </aside>
  )
}
