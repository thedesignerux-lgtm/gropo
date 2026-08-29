// src/components/PulseBar.tsx — GROPO PULSE · barra completa de solo lectura
// La misma anatomía (nodos + precios + glow + parpadeos + conversión) para las
// superficies NO interactivas: Grupos Abiertos (Home) y Mis Grupos.
// Se autoalimenta del endpoint agregado; sin pulse, es una barra de tramos normal.
'use client'

import TierProgress, { type TierPoint, type TierVariant } from '@/components/TierProgress'
import { usePulse } from '@/hooks/usePulse'

interface Props {
  groupId: string
  current: number
  tiers: TierPoint[]
  variant: TierVariant
  /** No consultar el pulse (grupo cerrado / meta alcanzada) */
  disabled?: boolean
  className?: string
}

export default function PulseBar({ groupId, current, tiers, variant, disabled = false, className }: Props) {
  const { data } = usePulse(disabled ? null : groupId)
  const pulse = disabled
    ? undefined
    : data?.steps.map((s) => ({
        units: s.units, marked: s.marked, markedFraction: s.markedFraction,
        surge: s.surge, acceptedFraction: s.acceptedFraction,
        committed: s.committed, reached: s.reached,
      }))
  return (
    <TierProgress
      current={current}
      tiers={tiers}
      variant={variant}
      pulse={pulse}
      glow={disabled ? 0 : data?.glow ?? 0}
      className={className}
    />
  )
}
