'use client'

import { useId } from 'react'
import PulseRings from '@/components/PulseRings'

export type TierVariant = 'hot' | 'dropping' | 'complete'

export interface TierPoint {
  units: number
  price?: number
  unlocked?: boolean
}

/** GROPO PULSE · estado por salto (lenguaje: solo VERDE y MORADO)
 *  VERDE  sólido → demanda firme (dinero al precio actual)
 *  MORADO sólido → dinero condicional (holds de esperadores + tarjetas Pulse)
 *  MORADO difuminado → intención marcada (sin tarjeta), proporcional (>1 supera)
 *  MORADO bruma ancha → observadores */
export interface TierPulse {
  units: number
  marked: 0 | 1 | 2 | 3
  markedFraction?: number
  surge: boolean
  acceptedFraction: number
  committed?: number
  reached?: boolean
}

const GREEN = '#0B7B44'
const PURPLE = '#024947'

const fmtPrice = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} className="w-3 h-3" aria-hidden="true">
      <path d="M5 12l5 5 9-11" />
    </svg>
  )
}

interface Props {
  /** Unidades de demanda efectiva actuales */
  current: number
  /** Tramos ascendentes por unidades (desde tier_demand) */
  tiers: TierPoint[]
  variant: TierVariant
  /** GROPO PULSE: estado por tramo (opcional) */
  pulse?: TierPulse[]
  /** Bruma de observadores 0–3 */
  glow?: 0 | 1 | 2 | 3
  /** Tier marcado por el usuario (unidades) — ancla elevada (PMA) */
  selectedUnits?: number | null
  /** Si se pasa, los nodos NO alcanzados son táctiles (marcar tier) */
  onSelectTier?: (tier: TierPoint) => void
  /** Color del relleno firme. Default: verde (dinero asegurado) */
  fillColor?: string
  /** Mostrar el precio encima de cada nodo (default: true si traen price) */
  showPrices?: boolean
  className?: string
}

/**
 * TierProgress — barra de tramos + Gropo Pulse.
 * La demanda firme (verde) avanza de izquierda a derecha; la condicional
 * (morado) nace en cada tier y avanza hacia atrás. Cuando se tocan, el tier cae.
 */
export default function TierProgress({
  current, tiers, variant, pulse, glow = 0, selectedUnits = null, onSelectTier,
  fillColor, showPrices, className = '',
}: Props) {
  useId()
  // Soft (mockup 12 jul): morado como color de la demanda; verde SOLO al máximo
  const color = fillColor ?? (variant === 'complete' ? GREEN : '#013230')
  const sorted = [...tiers].sort((a, b) => a.units - b.units)
  const nextIdx = sorted.findIndex((t) => current < t.units)

  // Nodos equiespaciados; el relleno interpola unidades entre nodos.
  const n = Math.max(1, sorted.length)
  const nodePos = sorted.map((_, i) => ((i + 1) / n) * 100)
  const posByUnits = new Map<number, number>(sorted.map((t, i) => [t.units, nodePos[i]]))
  const pct = (u: number) => {
    if (u <= 0) return 0
    let prevU = 0
    let prevP = 0
    for (let i = 0; i < sorted.length; i++) {
      const tu = sorted[i].units
      const tp = nodePos[i]
      if (u <= tu) return prevP + ((tp - prevP) * (u - prevU)) / Math.max(1, tu - prevU)
      prevU = tu
      prevP = tp
    }
    return 100
  }

  const stepsP = pulse ?? []
  const pulseByUnits = new Map<number, TierPulse>(stepsP.map((p) => [p.units, p]))
  const hasCommitted = stepsP.some((p) => p.committed != null)

  // Demanda FIRME al precio actual
  let firmUnits = current
  if (hasCommitted) {
    const reachedSteps = stepsP.filter((p) => p.reached)
    firmUnits = reachedSteps.length > 0
      ? Math.max(...reachedSteps.map((p) => p.committed ?? 0))
      : Math.min(current, stepsP[0]?.committed ?? current)
  }
  const firmPct = hasCommitted ? pct(firmUnits) : pct(current)

  // Capas condicionales por salto bloqueado, ancladas en su nodo hacia atrás.
  // El DINERO condicional (holds + tarjetas) se concentra en el salto más barato
  // bloqueado; la intención marcada se pinta en el salto de cada uno.
  interface Layer { left: number; width: number; kind: 'money' | 'marked' }
  const layers: Layer[] = []
  const lockedSteps = stepsP.filter((p) => !(p.reached ?? false)).sort((a, b) => a.units - b.units)
  const condStep = lockedSteps[0] ?? null
  let moneyUnits = 0

  lockedSteps.forEach((p) => {
    const idx = sorted.findIndex((t) => t.units === p.units)
    if (idx < 0) return
    const nodePct = nodePos[idx]
    const segStart = Math.max(firmPct, idx > 0 ? nodePos[idx - 1] : 0)
    const seg = Math.max(0, nodePct - segStart)
    if (seg <= 0) return
    const gapUnits = Math.max(1, p.units - firmUnits)

    let moneyW = 0
    if (condStep && p.units === condStep.units) {
      const held = Math.max(0, (p.committed ?? firmUnits) - firmUnits)
      const needed = Math.max(0, p.units - (p.committed ?? firmUnits))
      const accepted = Math.max(0, Math.min(1, p.acceptedFraction)) * needed
      moneyUnits = held + accepted
      if (moneyUnits > 0) {
        const gap = Math.max(0, nodePct - firmPct)
        moneyW = Math.min(gap, Math.max((moneyUnits / gapUnits) * gap, 8))
        // Parte EXACTAMENTE del nodo del tier, hacia atrás
        layers.push({ left: Math.max(firmPct, nodePct - moneyW), width: moneyW, kind: 'money' })
      }
    }

    // Intención marcada: difuminado A CONTINUACIÓN del sólido (nunca intercalado);
    // puede SUPERAR la demanda necesaria (overflow ~4% sobre la firme)
    const mf = Math.max(0, Math.min(2, p.markedFraction ?? 0))
    if (mf > 0) {
      const anchor = nodePct - moneyW
      let width = seg * Math.min(1, mf)
      width = Math.max(width, 6)
      let left = anchor - width
      const overflow = mf > 1 ? Math.min(4, (mf - 1) * seg) : 0
      left = Math.max(segStart - overflow, left - overflow)
      if (width > 0.5) layers.push({ left, width: anchor - left, kind: 'marked' })
    }
  })

  const surgeUnits = condStep && moneyUnits > 0 ? condStep.units : null

  // La bruma (observadores) solo vive cuando NO hay nada más concreto:
  // en cuanto alguien pone tarjeta o marca un tier, desaparece.
  const effectiveGlow = layers.length > 0 ? 0 : glow

  const interactive = !!onSelectTier
  const hasAnchor = selectedUnits != null && sorted.some((t) => t.units === selectedUnits && !(pulseByUnits.get(t.units)?.reached ?? current >= t.units))
  const labels = (showPrices ?? sorted.some((t) => t.price != null))
  const labelH = labels ? 15 : 0
  const anchorH = hasAnchor ? 17 : 0
  const centerY = labelH + anchorH + 11
  const height = centerY + 11

  return (
    <div className={`relative my-1 ${className}`} style={{ height }} aria-hidden={!interactive}>
      {/* Precios sobre los nodos */}
      {labels && sorted.map((t, i) => {
        if (t.price == null) return null
        const reached = t.unlocked ?? current >= t.units
        const p = pulseByUnits.get(t.units)
        const isSurgeNode = surgeUnits != null && t.units === surgeUnits
        const isSelected = selectedUnits != null && t.units === selectedUnits
        const labelColor = reached ? color
          : isSurgeNode || isSelected || (p?.marked ?? 0) > 0 ? '#013230'
          : '#94A3B8'
        return (
          <span
            key={`lbl-${t.units}-${i}`}
            className="absolute -translate-x-1/2 text-[10px] font-bold tabular-nums whitespace-nowrap"
            style={{ left: `${nodePos[i]}%`, top: 0, color: labelColor }}
          >
            {fmtPrice(t.price)}
          </span>
        )
      })}

      {/* Ancla del usuario (PMA) — siempre morada */}
      {hasAnchor && (
        <span
          className="gropo-anchor"
          style={{ left: `${posByUnits.get(selectedUnits!) ?? pct(selectedUnits!)}%`, top: labelH }}
        >
          <span className="gropo-anchor__ring" />
          <span className="gropo-anchor__line" />
        </span>
      )}

      {/* track + capas */}
      <div
        className="absolute left-[9px] right-[9px] h-1 -translate-y-1/2 rounded-full overflow-hidden"
        style={{ top: centerY, background: '#EEF1F6' }}
      >
        {/* Bruma de observadores (muy sutil) — solo si no hay compromiso ni intención */}
        {effectiveGlow > 0 && (
          <span
            className="gropo-glow"
            style={{
              left: `${firmPct}%`,
              width: `${Math.max(0, 100 - firmPct)}%`,
              ['--glow-min' as never]: `${0.06 + effectiveGlow * 0.04}`,
              ['--glow-max' as never]: `${0.12 + effectiveGlow * 0.07}`,
            }}
          />
        )}
        {/* Intención marcada (difuminado) */}
        {layers.filter((l) => l.kind === 'marked').map((l, i) => (
          <span key={`mk-${i}`} className="gropo-marked" style={{ left: `${l.left}%`, width: `${l.width}%` }} />
        ))}
        {/* Dinero condicional (sólido, en movimiento) */}
        {layers.filter((l) => l.kind === 'money').map((l, i) => (
          <span key={`mn-${i}`} className="gropo-reverse-fill" style={{ left: `${l.left}%`, width: `${l.width}%` }} />
        ))}
        {/* Demanda firme */}
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{ width: `${firmPct}%`, background: color }}
        />
      </div>

      {/* nodo inicial */}
      <span
        className="absolute -translate-y-1/2 -translate-x-1/2 w-[18px] h-[18px] rounded-full flex items-center justify-center z-[2]"
        style={{ left: 0, top: centerY, background: color }}
      >
        <Check />
      </span>

      {/* un nodo por tramo */}
      {sorted.map((t, i) => {
        const reached = t.unlocked ?? current >= t.units
        const isTarget = i === nextIdx
        const left = `${nodePos[i]}%`
        const p = pulseByUnits.get(t.units)
        const isSelected = selectedUnits != null && t.units === selectedUnits
        const isSurgeNode = surgeUnits != null && t.units === surgeUnits
        const ringIntensity = isSurgeNode ? 3 : Math.min(1, p?.marked ?? 0)

        if (reached) {
          return (
            <span
              key={`${t.units}-${i}`}
              className="absolute -translate-y-1/2 -translate-x-1/2 w-[18px] h-[18px] rounded-full flex items-center justify-center z-[2]"
              style={{ left, top: centerY, background: color }}
            >
              <Check />
            </span>
          )
        }

        const active = isSurgeNode || isSelected || ringIntensity > 0
        const node = (
          <span
            className={`relative rounded-full flex items-center justify-center ${isTarget || isSelected ? 'w-[18px] h-[18px] bg-white' : 'w-[9px] h-[9px]'}`}
            style={
              isTarget || isSelected
                ? { border: `2px solid ${active ? PURPLE : '#CBD5E1'}` }
                : { background: active ? PURPLE : '#DFE3EC' }
            }
          >
            {ringIntensity > 0 && <PulseRings tone="purple" intensity={ringIntensity as 1 | 2 | 3} />}
            {isSelected && <span className="w-[7px] h-[7px] rounded-full" style={{ background: PURPLE }} />}
          </span>
        )

        if (interactive) {
          return (
            <button
              key={`${t.units}-${i}`}
              type="button"
              aria-label={t.price != null ? `Esperar en ${t.price} €` : `Esperar en el tramo de ${t.units} unidades`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelectTier!(t) }}
              className="absolute -translate-y-1/2 -translate-x-1/2 z-[3] w-9 h-9 flex items-center justify-center rounded-full"
              style={{ left, top: centerY }}
            >
              {node}
            </button>
          )
        }
        return (
          <span
            key={`${t.units}-${i}`}
            className="absolute -translate-y-1/2 -translate-x-1/2 z-[2] flex items-center justify-center"
            style={{ left, top: centerY }}
          >
            {node}
          </span>
        )
      })}
    </div>
  )
}
