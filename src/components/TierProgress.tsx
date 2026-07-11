'use client'

import { useId } from 'react'

export type TierVariant = 'hot' | 'dropping' | 'complete'

export interface TierPoint {
  units: number
  price?: number
  unlocked?: boolean
}

const COLOR: Record<TierVariant, string> = {
  hot: '#F0531F',      // naranja del prototipo
  dropping: '#6B4EE6', // morado del prototipo
  complete: '#0F9D58', // verde (meta alcanzada)
}

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
  className?: string
}

/**
 * TierProgress — barra de progreso con nodos por tramo. Reemplaza a WaveProgress en Mi Radar.
 * Data-driven: soporta N tramos. Sin ejes ni etiquetas (decorativo → aria-hidden).
 *  - tramo alcanzado (unlocked) → círculo relleno con check
 *  - siguiente objetivo → anillo
 *  - tramos futuros → punto pequeño muted
 */
export default function TierProgress({ current, tiers, variant, className = '' }: Props) {
  useId()
  const color = COLOR[variant]
  const sorted = [...tiers].sort((a, b) => a.units - b.units)
  const max = sorted.length > 0 ? sorted[sorted.length - 1].units : 1
  const pct = (u: number) => Math.min(100, Math.max(0, (u / max) * 100))
  // Relleno y nodos comparten UNA sola fuente (unidades actuales) para que la barra
  // sea siempre coherente: un tramo alcanzado ⇔ el relleno llega a él.
  const nextIdx = sorted.findIndex((t) => current < t.units)

  return (
    <div className={`relative h-[22px] my-1 ${className}`} aria-hidden="true">
      {/* track + relleno */}
      <div className="absolute top-1/2 left-[11px] right-[11px] h-1.5 -translate-y-1/2 rounded-full overflow-hidden bg-neutral-200">
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{ width: `${pct(current)}%`, background: color }}
        />
      </div>

      {/* nodo inicial */}
      <span
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[22px] h-[22px] rounded-full flex items-center justify-center z-[2]"
        style={{ left: 0, background: color }}
      >
        <Check />
      </span>

      {/* un nodo por tramo */}
      {sorted.map((t, i) => {
        const reached = current >= t.units
        const isTarget = i === nextIdx
        const left = `${pct(t.units)}%`
        if (reached) {
          return (
            <span
              key={`${t.units}-${i}`}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[22px] h-[22px] rounded-full flex items-center justify-center z-[2]"
              style={{ left, background: color }}
            >
              <Check />
            </span>
          )
        }
        if (isTarget) {
          return (
            <span
              key={`${t.units}-${i}`}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[22px] h-[22px] rounded-full bg-white z-[2]"
              style={{ left, border: `2.5px solid ${color}` }}
            />
          )
        }
        return (
          <span
            key={`${t.units}-${i}`}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[11px] h-[11px] rounded-full bg-neutral-300 z-[2]"
            style={{ left }}
          />
        )
      })}
    </div>
  )
}
