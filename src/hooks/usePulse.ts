// src/hooks/usePulse.ts — GROPO PULSE · estado agregado del pulso (cliente)
// Consume /api/group/[id]/pulse (agregado servidor, sin cifras — P3) y
// refresca cada 20 s. Nunca expone datos sensibles: el endpoint ya viene filtrado.
'use client'

import { useState, useEffect, useCallback } from 'react'

export interface PulseStep {
  units: number
  price: number
  reached: boolean
  /** Demanda efectiva a ese precio (incluye esperadores con hold) */
  committed: number
  /** Alguien marcó EXACTAMENTE este tier (0 = nadie), en buckets */
  marked: 0 | 1 | 2 | 3
  /** Intención marcada proporcional a lo que falta (0..2; >1 = supera) */
  markedFraction: number
  /** Morado: hay tarjetas aceptadas empujando hacia este salto */
  surge: boolean
  /** Relleno inverso morado: fracción 0..1 del hueco cubierta por aceptaciones */
  acceptedFraction: number
  reachable: boolean
}

export interface PulseMine {
  tier_price: number
  quantity: number
  status: 'watching' | 'accepted' | 'holding' | 'converted' | 'failed'
}

export interface PulseData {
  steps: PulseStep[]
  /** Glow naranja de grupo: observadores totales en buckets 0–3 */
  glow: 0 | 1 | 2 | 3
  mine: PulseMine | null
}

export function usePulse(groupId: string | null, intervalMs = 20000) {
  const [data, setData] = useState<PulseData | null>(null)

  const refresh = useCallback(async () => {
    if (!groupId) return
    try {
      const res = await fetch(`/api/group/${groupId}/pulse`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      if (json?.steps) setData(json as PulseData)
    } catch { /* silencioso: el pulse es decorativo, nunca rompe la página */ }
  }, [groupId])

  useEffect(() => {
    refresh()
    if (!groupId) return
    const t = setInterval(refresh, intervalMs)
    return () => clearInterval(t)
  }, [groupId, intervalMs, refresh])

  return { data, refresh }
}
