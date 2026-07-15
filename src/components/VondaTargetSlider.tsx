'use client'

import { useCallback, useRef } from 'react'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
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
}

export default function VondaTargetSlider({
  detents, curIdx, selIdx, onSelIdx, size = 'full', chrome = 'none', udsToNext,
}: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const n = detents.length
  const mini = size === 'mini'
  const pos = (i: number) => (n <= 1 ? 50 : 7 + (i / (n - 1)) * 86) + '%'

  const ui = {
    dot: mini ? 17 : 20,
    curDot: mini ? 22 : 26,
    thumb: mini ? 30 : 34,
    priceFont: mini ? 13 : 15,
    udsFont: mini ? 10.5 : 11,
    trackTop: mini ? 34 : 46,
    bubbleTop: mini ? -34 : -40,
  }

  const setFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current
    if (!el || n <= 1) return
    const r = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    onSelIdx(Math.round(ratio * (n - 1)))
  }, [n, onSelIdx])

  const startDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setFromClientX(e.clientX)
    const move = (ev: PointerEvent) => setFromClientX(ev.clientX)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [setFromClientX])

  const confirmed = selIdx <= curIdx
  const accent = confirmed ? '#6C4BF4' : '#E8944A'
  const accentShadow = confirmed ? 'rgba(108,75,244,.28)' : 'rgba(232,148,74,.28)'
  const nextIdx = curIdx < n - 1 ? curIdx + 1 : null
  const projW = nextIdx != null && n > 1 ? ((nextIdx - curIdx) / (n - 1)) * 86 + '%' : '0%'
  const bubbleX = selIdx === 0 ? 'translateX(-16%)' : (selIdx === n - 1 ? 'translateX(-84%)' : 'translateX(-50%)')
  const caretX = selIdx === 0 ? '16%' : (selIdx === n - 1 ? '84%' : '50%')

  // Copy (Vonda: elegir por debajo del actual = esperador válido)
  const selP = detents[selIdx]?.price ?? 0
  const curP = detents[curIdx]?.price ?? 0
  const nextP = nextIdx != null ? detents[nextIdx].price : null
  const faltan = udsToNext != null ? udsToNext : (nextIdx != null ? Math.max(0, detents[nextIdx].uds - detents[curIdx].uds) : 0)

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
  const statusBg = confirmed ? '#EDE9FB' : '#FCEEE0'
  const nudgeBg = confirmed ? '#F4F1FE' : '#FCF4EA'
  const nudgeBr = confirmed ? '#E4DCFB' : '#F3E3CC'

  return (
    <div className="select-none">
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
        {/* Máx bubble */}
        <div style={{ position: 'absolute', top: ui.bubbleTop, left: pos(selIdx), transform: bubbleX, transition: 'left .22s cubic-bezier(.34,1.56,.64,1)', zIndex: 5 }}>
          <div style={{ background: accent, color: '#fff', fontSize: 12, fontWeight: 800, padding: '6px 11px', borderRadius: 9, whiteSpace: 'nowrap', boxShadow: `0 8px 20px -8px ${accentShadow}` }}>
            Máx · {fmt(selP)}
          </div>
          <div style={{ width: 9, height: 9, background: accent, position: 'absolute', left: caretX, bottom: -3, transform: 'translateX(-50%) rotate(45deg)' }} />
        </div>

        {/* Track */}
        <div ref={trackRef} onPointerDown={startDrag} style={{ position: 'relative', height: 30, cursor: 'pointer', touchAction: 'none' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: 8, borderRadius: 999, background: '#ECEAF4' }} />
          <div className="ts-pulse" style={{ position: 'absolute', left: pos(curIdx), width: projW, top: '50%', transform: 'translateY(-50%)', height: 8, borderRadius: 999, background: 'repeating-linear-gradient(90deg,#C9BEF6 0 6px,transparent 6px 12px)' }} />
          <div className="ts-wave" style={{ position: 'absolute', left: 0, width: pos(curIdx), top: '50%', transform: 'translateY(-50%)', height: 8, borderRadius: 999, backgroundImage: 'repeating-linear-gradient(115deg,#8A6BF7 0 8px,#6C4BF4 8px 15px)', backgroundSize: '26px 100%' }} />

          {detents.map((d, i) => {
            const achieved = i <= curIdx
            return (
              <div key={i} style={{ position: 'absolute', top: '50%', left: pos(i), transform: 'translate(-50%,-50%)', width: ui.dot, height: ui.dot, borderRadius: '50%', background: achieved ? '#6C4BF4' : '#fff', border: `2.5px solid ${achieved ? '#6C4BF4' : '#CFCADE'}`, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 9, fontWeight: 900, lineHeight: 1, zIndex: 2, boxShadow: '0 2px 6px -2px rgba(30,20,60,.35)' }}>
                {achieved ? '✓' : ''}
              </div>
            )
          })}

          <div style={{ position: 'absolute', top: '50%', left: pos(curIdx), transform: 'translate(-50%,-50%)', width: ui.curDot, height: ui.curDot, borderRadius: '50%', background: '#fff', border: '1px solid #F0EDE7', display: 'grid', placeItems: 'center', zIndex: 3, boxShadow: '0 3px 10px -3px rgba(30,20,60,.5)' }}>
            <span style={{ width: ui.curDot * 0.42, height: ui.curDot * 0.42, borderRadius: '50%', background: '#F0503A' }} />
          </div>

          <div onPointerDown={startDrag} style={{ position: 'absolute', top: '50%', left: pos(selIdx), transform: 'translate(-50%,-50%)', width: ui.thumb, height: ui.thumb, borderRadius: '50%', background: '#fff', border: `3px solid ${accent}`, display: 'grid', placeItems: 'center', zIndex: 4, cursor: 'grab', transition: 'left .22s cubic-bezier(.34,1.56,.64,1),border-color .2s', boxShadow: `0 6px 16px -4px ${accentShadow}` }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: accent }} />
          </div>
        </div>

        {/* Labels */}
        <div style={{ position: 'relative', height: 40, marginTop: 12 }}>
          {detents.map((d, i) => {
            const achieved = i <= curIdx
            const priceColor = i === selIdx ? accent : (achieved ? '#6C4BF4' : '#9a97a2')
            return (
              <div key={i} style={{ position: 'absolute', left: pos(i), top: 0, transform: 'translateX(-50%)', textAlign: 'center' }}>
                <div style={{ fontSize: ui.priceFont, fontWeight: 800, color: priceColor, whiteSpace: 'nowrap' }}>{fmt(d.price)}</div>
                <div style={{ fontSize: ui.udsFont, color: '#9a97a2', marginTop: 2, whiteSpace: 'nowrap' }}>{d.uds} {d.uds === 1 ? 'ud' : 'uds'}</div>
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
