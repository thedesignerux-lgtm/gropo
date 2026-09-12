'use client'

import { useCallback, useRef, useEffect, useState } from 'react'
import PulseRings from '@/components/PulseRings'
import type { TierPulse } from '@/components/TierProgress'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ── Anillo de 4 triángulos (misma forma que el indicador de tramo del slider),
      apuntando hacia el candado central. Giran en la transición de bloqueo. ── */
function ArrowsRing({ color, size }: { color: string; size: number }) {
  const CX = 28, CY = 28
  const toR = (d: number) => d * Math.PI / 180
  const P = (a: number, r: number): [number, number] => [CX + r * Math.cos(toR(a)), CY + r * Math.sin(toR(a))]
  // Triángulo: punta a r=17 (hacia el centro), base a r=24, mitad de base 6
  const tris = [315, 45, 135, 225].map(a => {
    const [tpX, tpY] = P(a, 17)
    const [bcX, bcY] = P(a, 24)
    const px = Math.cos(toR(a + 90)), py = Math.sin(toR(a + 90))
    return `${tpX.toFixed(1)},${tpY.toFixed(1)} ${(bcX + 6 * px).toFixed(1)},${(bcY + 6 * py).toFixed(1)} ${(bcX - 6 * px).toFixed(1)},${(bcY - 6 * py).toFixed(1)}`
  })
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      {tris.map((pts, i) => <polygon key={i} points={pts} fill={color} />)}
    </svg>
  )
}

/* ── Centro del candado: disco de color, anillo blanco interior y padlock
      blanco con keyhole del color de acento (referencia) ── */
function LockCenter({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="14" fill={color} />
      <circle cx="28" cy="28" r="11.6" fill="none" stroke="#fff" strokeWidth="1.6" />
      <path d="M25.2 27v-2.2a2.8 2.8 0 0 1 5.6 0V27" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="23.2" y="27" width="9.6" height="7.4" rx="1.8" fill="#fff" />
      <circle cx="28" cy="30.2" r="1.2" fill={color} />
      <rect x="27.4" y="30.8" width="1.2" height="2.2" rx="0.6" fill={color} />
    </svg>
  )
}

export interface Detent { price: number; uds: number }

interface Props {
  detents: Detent[]
  curIdx: number
  selIdx: number
  onSelIdx: (i: number) => void
  /** 'full' muestra tallas grandes; 'mini' compacto para cards */
  size?: 'mini' | 'full'
  /** 'none' solo slider · 'nudge' slider + nudge · 'full' encabezado+estado + nudge */
  chrome?: 'none' | 'nudge' | 'full'
  /** Unidades que faltan para el siguiente tramo (para el nudge). Si no se pasa, se calcula. */
  udsToNext?: number
  /** GROPO PULSE: estado por tramo (de usePulse). Decorativo; si no se pasa, no se pinta. */
  pulse?: TierPulse[]
  /** Bruma de observadores 0–3 (de usePulse). */
  glow?: 0 | 1 | 2 | 3
  /** Se dispara SOLO al soltar el thumb (drag-end/tap). Para persistir el ancla. */
  onCommit?: (i: number) => void
  /** Índice mínimo seleccionable: bloquea el thumb por debajo (p. ej. Mi Radar). */
  minIdx?: number
  /** Modo lectura: desactiva el arrastre/tap del thumb. */
  disabled?: boolean
  /** Modo Mi Radar: controla comportamiento del track sin selección (sin rastro preview). */
  anchorMode?: boolean
  /** La flecha de ancla está desvaneciéndose (fade-out antes de desanclar). */
  anchorFading?: boolean
  /** Oculta el thumb (p. ej. estado deseleccionado en Mi Radar): el tramo actual
   *  queda representado solo por su nodo morado con ✓. El track sigue siendo tappable. */
  hideThumb?: boolean
  /** Precio bloqueado: reemplaza el thumb por el icono de candado con animación. */
  locked?: boolean
  /** Muestra rectángulos discretos en el tramo curIdx→siguiente: uno por unidad,
   *  rellenos los ya conseguidos y en blanco los que faltan. */
  shortfallTicks?: boolean
  /** Unidades firmes actuales (para calcular los ticks de "faltan"). */
  currentUnits?: number
}

export default function GropoTargetSlider({
  detents, curIdx, selIdx, onSelIdx, size = 'full', chrome = 'none', udsToNext,
  pulse, glow = 0, onCommit, minIdx = 0, disabled = false, anchorMode = false,
  anchorFading = false, hideThumb = false, locked = false,
  shortfallTicks = false, currentUnits,
}: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const lastIdxRef = useRef(selIdx)
  const n = detents.length
  const mini = size === 'mini'
  const posN = (i: number) => (n <= 1 ? 50 : 7 + (i / (n - 1)) * 86)
  const pos = (i: number) => posN(i) + '%'

  const ui = {
    dot: mini ? 17 : 20,
    curDot: mini ? 22 : 26,
    thumb: mini ? 30 : 34,
    priceFont: mini ? 13 : 15,
    udsFont: mini ? 10.5 : 11,
    trackTop: mini ? 34 : 40,
  }

  const effectiveMin = Math.max(minIdx, curIdx)
  const setFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current
    if (!el || n <= 1) return
    const r = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    const i = Math.max(effectiveMin, Math.min(n - 1, Math.round(ratio * (n - 1))))
    lastIdxRef.current = i
    onSelIdx(i)
  }, [n, onSelIdx, effectiveMin])

  const startDrag = useCallback((e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    setFromClientX(e.clientX)
    const move = (ev: PointerEvent) => setFromClientX(ev.clientX)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      onCommit?.(lastIdxRef.current)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [setFromClientX, disabled, onCommit])

  // Detectar transición locked: false→true para disparar animación de spin
  const wasLockedRef = useRef(locked)
  const lockSpin = locked && !wasLockedRef.current
  useEffect(() => { wasLockedRef.current = locked }, [locked])

  const confirmed = selIdx <= curIdx
  const accent = confirmed ? '#024947' : '#E8944A'
  const accentShadow = confirmed ? 'rgba(2, 73, 71,.28)' : 'rgba(232,148,74,.28)'
  const nextIdx = curIdx < n - 1 ? curIdx + 1 : null
  // Rastro del track:
  //  · selIdx > curIdx (esperar) → rastro NARANJA de curIdx→selIdx (en todo contexto)
  //  · selIdx <= curIdx, sin anchorMode → preview morado de curIdx→nextIdx
  //  · anchorMode sin ancla → sin rastro (track liso, como el mockup 8c)
  const esperarTrail = selIdx > curIdx
  const projEndIdx = esperarTrail ? selIdx : nextIdx
  const showProj = esperarTrail || (!anchorMode && nextIdx != null && !shortfallTicks)

  // Rectángulos discretos del tramo curIdx→siguiente: uno por unidad que falta
  // para el próximo precio. Rellenos = ya conseguidos; en blanco = los que faltan.
  const tickGap = shortfallTicks && nextIdx != null ? (detents[nextIdx].uds - detents[curIdx].uds) : 0
  const showTicks = shortfallTicks && nextIdx != null && tickGap >= 1 && tickGap <= 12
  const tickFilled = showTicks
    ? Math.max(0, Math.min(tickGap, (currentUnits ?? detents[curIdx].uds) - detents[curIdx].uds))
    : 0
  const projW = showProj && projEndIdx != null && n > 1 ? ((projEndIdx - curIdx) / (n - 1)) * 86 + '%' : '0%'
  const projColor = esperarTrail ? '#E8944A' : '#CFE5E4'
  // Copy (Gropo: elegir por debajo del actual = esperador válido)
  const selP = detents[selIdx]?.price ?? 0
  const curP = detents[curIdx]?.price ?? 0
  const nextP = nextIdx != null ? detents[nextIdx].price : null
  const faltan = udsToNext != null ? udsToNext : (nextIdx != null ? Math.max(0, detents[nextIdx].uds - detents[curIdx].uds) : 0)

  // Tooltip naranja "Faltan X uds" sobre el tier SELECCIONADO — aparece 4s tras cada cambio
  const faltanSel = selIdx > curIdx ? Math.max(0, (detents[selIdx]?.uds ?? 0) - (detents[curIdx]?.uds ?? 0)) : 0
  const [faltanTipOn, setFaltanTipOn] = useState(false)
  useEffect(() => {
    if (selIdx <= curIdx || faltanSel <= 0) { setFaltanTipOn(false); return }
    setFaltanTipOn(true)
    const t = setTimeout(() => setFaltanTipOn(false), 4000)
    return () => clearTimeout(t)
  }, [selIdx, curIdx, faltanSel])
  // Posición: si el nodo seleccionado está cerca de los bordes, desplazar hacia el centro
  const tipPct = posN(selIdx)
  const tipShift = tipPct < 25 ? 'translateX(-12%)' : tipPct > 75 ? 'translateX(-88%)' : 'translateX(-50%)'
  let nudgeText: string
  if (confirmed) {
    if (selIdx < curIdx) {
      nudgeText = `Tu máximo es ${fmt(selP)}, pero gracias al grupo pagarás solo ${fmt(curP)}. ¡Estás dentro!`
    } else {
      nudgeText = `¡Estás dentro! Aceptas pagar hasta ${fmt(selP)} y el grupo ya está en ese precio` +
        (nextP != null ? `. Si entran ${faltan} uds más, bajaréis a ${fmt(nextP)}.` : '.')
    }
  } else {
    nudgeText = `Reservas tu plaza como esperador: solo pagarás si el grupo baja a ${fmt(selP)}. ` +
      `Ahora está en ${fmt(curP)}; cada persona que entra acerca ese precio.`
  }
  const statusLabel = confirmed ? 'Confirmado' : 'En espera'
  const statusBg = confirmed ? '#DEEDEC' : '#FCEEE0'
  const nudgeBg = confirmed ? '#F5FAFA' : '#FCF4EA'
  const nudgeBr = confirmed ? '#E6F1F1' : '#F3E3CC'

  // ── GROPO PULSE ──────────────────────────────────────────────
  // Capas de actividad en vivo mapeadas al sistema de posiciones del slider
  // (detents equiespaciados de 7% a 93%). Réplica de la lógica de TierProgress
  // adaptada; puramente decorativo (nunca afecta al thumb ni a la selección).
  const stepsP = pulse ?? []
  const pulseByUnits = new Map<number, TierPulse>(stepsP.map((p) => [p.units, p]))
  const firmUnits = detents[curIdx]?.uds ?? 0
  const firmPct = posN(curIdx)

  interface PLayer { left: number; width: number; kind: 'money' | 'marked' }
  const pLayers: PLayer[] = []
  const lockedSteps = stepsP.filter((p) => !(p.reached ?? false)).sort((a, b) => a.units - b.units)
  const condStep = lockedSteps[0] ?? null
  let moneyUnits = 0

  if (n > 1) lockedSteps.forEach((p) => {
    const idx = detents.findIndex((d) => d.uds === p.units)
    if (idx < 0) return
    const nodePct = posN(idx)
    const segStart = Math.max(firmPct, idx > 0 ? posN(idx - 1) : posN(0))
    const seg = Math.max(0, nodePct - segStart)
    if (seg <= 0) return
    const gapUnits = Math.max(1, p.units - firmUnits)

    let moneyW = 0
    if (condStep && p.units === condStep.units) {
      const held = Math.max(0, (p.committed ?? firmUnits) - firmUnits)
      const needed = Math.max(0, p.units - (p.committed ?? firmUnits))
      const accepted = clamp(p.acceptedFraction, 0, 1) * needed
      moneyUnits = held + accepted
      if (moneyUnits > 0) {
        const gap = Math.max(0, nodePct - firmPct)
        moneyW = Math.min(gap, Math.max((moneyUnits / gapUnits) * gap, 5))
        pLayers.push({ left: Math.max(firmPct, nodePct - moneyW), width: moneyW, kind: 'money' })
      }
    }

    const mf = clamp(p.markedFraction ?? 0, 0, 2)
    if (mf > 0) {
      const anchor = nodePct - moneyW
      let width = seg * Math.min(1, mf)
      width = Math.max(width, 5)
      let left = anchor - width
      const overflow = mf > 1 ? Math.min(4, (mf - 1) * seg) : 0
      left = Math.max(segStart - overflow, left - overflow)
      if (width > 0.5) pLayers.push({ left, width: anchor - left, kind: 'marked' })
    }
  })

  const surgeUnits = condStep && moneyUnits > 0 ? condStep.units : null
  const effectiveGlow = pLayers.length > 0 ? 0 : glow

  // El slider puede vivir dentro de un <Link> (Mi Radar y cards): el click nativo
  // del <a> navega aunque React frene el onClick de burbuja (el re-render del
  // arrastre desincroniza el dispatch sintético). Interceptamos el click con un
  // listener NATIVO en fase de captura para neutralizar la navegación sin afectar
  // al arrastre. Se monta UNA vez y permanece siempre: si dependiera de `disabled`,
  // el `setBusy(true)` que dispara el pledge al soltar quitaría la guarda justo
  // antes del click y este navegaría. Un click sobre el slider nunca debe navegar.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const guard = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation() }
    el.addEventListener('click', guard, true)
    return () => el.removeEventListener('click', guard, true)
  }, [])

  return (
    <div ref={rootRef} className="select-none">
      {chrome === 'full' && (
        <div className="flex items-center justify-between gap-3">
          <div className="font-extrabold text-neutral-900" style={{ fontSize: mini ? 14 : 16 }}>¿Cuál es el máximo que pagarías?</div>
          <div className="inline-flex items-center gap-1.5 font-extrabold rounded-full whitespace-nowrap" style={{ fontSize: 12.5, color: accent, background: statusBg, padding: '6px 11px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent }} />
            {statusLabel}
          </div>
        </div>
      )}

      <div className="relative" style={{ marginTop: ui.trackTop }}>
        {/* Tooltip naranja "Faltan X uds" sobre el tier seleccionado */}
        {selIdx > curIdx && faltanSel > 0 && (
          <div style={{ position: 'absolute', top: -34, left: pos(selIdx), transform: tipShift, transition: 'left .22s cubic-bezier(.34,1.56,.64,1), opacity .5s ease', opacity: faltanTipOn ? 1 : 0, zIndex: 7, pointerEvents: 'none' }}>
            <div style={{ background: '#E8944A', color: '#fff', fontSize: mini ? 11 : 12.5, fontWeight: 700, padding: mini ? '4px 10px' : '5px 13px', borderRadius: 20, whiteSpace: 'nowrap', boxShadow: '0 4px 12px -4px rgba(232,148,74,.4)' }}>
              {faltanSel === 1 ? 'Falta 1 ud' : `Faltan ${faltanSel} uds`}
            </div>
          </div>
        )}

        {/* Flecha de ancla: marca el tramo elegido cuando selIdx > curIdx (esperar) */}
        {(selIdx > curIdx || anchorFading) && (
          <div style={{ position: 'absolute', top: -4, left: pos(selIdx), transform: 'translateX(-50%)', transition: 'left .22s cubic-bezier(.34,1.56,.64,1), opacity .3s ease', opacity: anchorFading ? 0 : 1, zIndex: 6, pointerEvents: 'none' }}>
            <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `7px solid ${accent}` }} />
          </div>
        )}

        {/* Track */}
        <div ref={trackRef} onPointerDown={startDrag} style={{ position: 'relative', height: 30, cursor: 'pointer', touchAction: 'none' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: 8, borderRadius: 999, background: '#ECEAF4' }} />
          <div className="ts-pulse" style={{ position: 'absolute', left: pos(curIdx), width: projW, top: '50%', transform: 'translateY(-50%)', height: 8, borderRadius: 999, background: `repeating-linear-gradient(90deg,${projColor} 0 6px,transparent 6px 12px)` }} />

          {/* GROPO PULSE · capas de actividad en vivo (sobre la proyección, bajo la onda firme) */}
          {(pLayers.length > 0 || effectiveGlow > 0) && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: 8, borderRadius: 999, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
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
              {pLayers.filter((l) => l.kind === 'marked').map((l, i) => (
                <span key={`mk-${i}`} className="gropo-marked" style={{ left: `${l.left}%`, width: `${l.width}%` }} />
              ))}
              {pLayers.filter((l) => l.kind === 'money').map((l, i) => (
                <span key={`mn-${i}`} className="gropo-reverse-fill" style={{ left: `${l.left}%`, width: `${l.width}%` }} />
              ))}
            </div>
          )}

          <div className="ts-wave" style={{ position: 'absolute', left: 0, width: pos(curIdx), top: '50%', transform: 'translateY(-50%)', height: 8, borderRadius: 999, backgroundImage: 'repeating-linear-gradient(115deg,#04817E 0 8px,#024947 8px 15px)', backgroundSize: '26px 100%', zIndex: 1 }} />

          {/* Ticks "los que faltan" — tramo curIdx→siguiente */}
          {showTicks && nextIdx != null && (() => {
            const segStart = posN(curIdx), segEnd = posN(nextIdx)
            const slice = (segEnd - segStart) / tickGap
            const w = slice * 0.52
            return (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
                {Array.from({ length: tickGap }).map((_, k) => {
                  const center = segStart + (k + 0.5) * slice
                  const isFilled = k < tickFilled
                  return (
                    <span key={k} style={{ position: 'absolute', left: `${center}%`, top: '50%', transform: 'translate(-50%,-50%)', width: `${w}%`, height: 10, borderRadius: 2.5, background: isFilled ? '#024947' : '#fff', border: isFilled ? 'none' : '1.5px solid #CADEDD', boxSizing: 'border-box', boxShadow: isFilled ? '0 1px 3px -1px rgba(2, 73, 71,.5)' : 'none' }} />
                  )
                })}
              </div>
            )
          })()}

          {detents.map((d, i) => {
            const achieved = i <= curIdx
            const pp = pulseByUnits.get(d.uds)
            const isSurgeNode = surgeUnits != null && d.uds === surgeUnits
            const ringIntensity = achieved ? 0 : (isSurgeNode ? 3 : Math.min(1, pp?.marked ?? 0))
            const activePulse = ringIntensity > 0
            return (
              <div key={i} style={{ position: 'absolute', top: '50%', left: pos(i), transform: 'translate(-50%,-50%)', width: ui.dot, height: ui.dot, borderRadius: '50%', background: achieved ? '#024947' : '#fff', border: `2.5px solid ${achieved ? '#024947' : (activePulse ? '#024947' : '#CADEDD')}`, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 9, fontWeight: 900, lineHeight: 1, zIndex: 2, boxShadow: '0 2px 6px -2px rgba(30,20,60,.35)', pointerEvents: 'none' }}>
                {ringIntensity > 0 && <PulseRings tone="purple" intensity={ringIntensity as 1 | 2 | 3} />}
                {achieved ? '✓' : ''}
              </div>
            )
          })}

          {!hideThumb && !locked && (
            <div onPointerDown={startDrag} style={{ position: 'absolute', top: '50%', left: pos(selIdx), transform: 'translate(-50%,-50%)', width: ui.thumb, height: ui.thumb, borderRadius: '50%', background: '#fff', border: `3px solid ${accent}`, display: 'grid', placeItems: 'center', zIndex: 4, cursor: 'grab', transition: 'left .22s cubic-bezier(.34,1.56,.64,1),border-color .2s', boxShadow: `0 6px 16px -4px ${accentShadow}` }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: accent }} />
            </div>
          )}
          {locked && (() => {
            const sz = mini ? 40 : 48
            return (
              <div style={{ position: 'absolute', top: '50%', left: pos(selIdx), transform: 'translate(-50%,-50%)', width: sz, height: sz, zIndex: 5, pointerEvents: 'none' }}>
                {/* Flechas — giran 1 vuelta si es transición, estáticas si ya montó locked */}
                <div className={lockSpin ? 'lock-arrows-spin' : undefined} style={{ position: 'absolute', inset: 0 }}>
                  <ArrowsRing color={accent} size={sz} />
                </div>
                {/* Centro candado — fade in si es transición */}
                <div className={lockSpin ? 'lock-center-in' : undefined} style={{ position: 'absolute', inset: 0 }}>
                  <LockCenter color={accent} size={sz} />
                </div>
              </div>
            )
          })()}
        </div>

        {/* Labels */}
        <div style={{ position: 'relative', height: 40, marginTop: 12 }}>
          {detents.map((d, i) => {
            const achieved = i <= curIdx
            const priceColor = i === selIdx ? accent : (achieved ? '#024947' : '#9a97a2')
            return (
              <div key={i} style={{ position: 'absolute', left: pos(i), top: 0, transform: 'translateX(-50%)', textAlign: 'center' }}>
                <div style={{ fontSize: ui.priceFont, fontWeight: 800, color: priceColor, whiteSpace: 'nowrap' }}>{fmt(d.price)}</div>
                <div style={{ fontSize: ui.udsFont, fontWeight: 400, color: '#9a97a2', marginTop: 2, whiteSpace: 'nowrap' }}>{d.uds} {d.uds === 1 ? 'ud' : 'uds'}</div>
              </div>
            )
          })}
        </div>
      </div>

      {(chrome === 'full' || chrome === 'nudge') && (
        <div className="flex items-start gap-2.5 rounded-2xl" style={{ background: nudgeBg, border: `1px solid ${nudgeBr}`, padding: '13px 15px', marginTop: 6 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: accent, display: 'grid', placeItems: 'center', flex: '0 0 auto', color: '#fff', fontSize: 13, fontWeight: 900 }}>{confirmed ? '✓' : '!'}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: '#3a3a42' }}>{nudgeText}</div>
        </div>
      )}
    </div>
  )
}
