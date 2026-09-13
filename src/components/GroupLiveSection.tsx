'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTierDemand } from '@/hooks/useTierDemand'
import { usePulse } from '@/hooks/usePulse'
import { useCheckout } from '@/components/checkout/CheckoutProvider'
import GroupCountdown from './GroupCountdown'
import GropoTargetSlider, { type Detent } from '@/components/GropoTargetSlider'
import { createClient } from '@/lib/supabase-browser'
import { modeAccent } from '@/lib/brand-colors'

function fmt(n: number | undefined | null): string {
  if (n === undefined || n === null) return '—'
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

interface Tier { minUnits: number; price: number }

interface Props {
  groupId: string
  name: string
  spec: string
  pvp: number
  initialBestPrice: number
  initialTotalUnits: number
  bidCount: number
  tiers: Tier[]
  maxStock: number
  minExecution: number
  closesAt: string
  /** When true, title/countdown/spec are in the hero overlay — hide them here */
  heroMode?: boolean
  /**
   * Contenido que va DEBAJO de la card y ENCIMA de la barra sticky.
   * Tiene que renderizarse aquí y no como hermano posterior: una barra
   * `sticky bottom-*` se desancla en cuanto su posición natural en el flujo
   * queda por encima, así que cualquier cosa que se ponga después la haría
   * desaparecer al hacer scroll.
   */
  belowContent?: React.ReactNode
}

const AVATAR_LETTERS = ['A', 'B', 'C']

export default function GroupLiveSection({
  groupId, name, spec, pvp,
  initialBestPrice, initialTotalUnits,
  tiers, closesAt, heroMode = false, belowContent,
}: Props) {
  const { open } = useCheckout()
  const router = useRouter()
  const [authed, setAuthed] = useState<boolean | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setAuthed(!!user))
  }, [])

  const { tiers: demandTiers, currentPrice, nextTier, missing } = useTierDemand(groupId)
  const { data: pulseData } = usePulse(nextTier ? groupId : null)
  const displayPrice = currentPrice > 0 ? currentPrice : initialBestPrice
  const totalParticipants = demandTiers.length > 0
    ? Math.max(...demandTiers.map(t => t.demand))
    : initialTotalUnits
  const savings = pvp > 0 ? pvp - displayPrice : 0

  // ── Detents del target slider
  const detents: Detent[] = useMemo(
    () => [...tiers].sort((a, b) => a.minUnits - b.minUnits).map(t => ({ price: t.price, uds: t.minUnits })),
    [tiers]
  )
  const curIdx = useMemo(() => {
    let idx = 0
    for (let i = 0; i < detents.length; i++) if (detents[i].price >= displayPrice) idx = i
    return idx
  }, [detents, displayPrice])

  const [selIdx, setSelIdx] = useState(curIdx)
  const touchedRef = useRef(false)
  useEffect(() => { if (!touchedRef.current) setSelIdx(curIdx) }, [curIdx])
  useEffect(() => { if (selIdx > detents.length - 1) setSelIdx(curIdx) }, [detents.length, selIdx, curIdx])
  const handleSelIdx = (i: number) => { touchedRef.current = true; setSelIdx(i) }

  const effectiveSelected = detents[selIdx]?.price ?? displayPrice
  const confirmed = selIdx <= curIdx
  const isEsperar = !confirmed
  const accent = modeAccent(confirmed)
  const statusLabel = confirmed ? 'Disponible' : 'En espera'  // UX-02
  const statusBg = confirmed ? '#DEEDEC' : '#FCEEE0'

  const [lockPhase, setLockPhase] = useState(0) // 0=idle, 1=spinning, 2=locked
  const handleCheckout = () => {
    if (lockPhase > 0) return
    setLockPhase(1) // arrows start spinning
    setTimeout(() => setLockPhase(2), 1000) // after 1s → CTA changes
    setTimeout(() => {
      if (isEsperar && authed) {
        open({ groupId, productName: name, productSpec: spec, imageUrl: null, quantity: 1, maxPricePerUnit: effectiveSelected, joinMode: 'esperar', targetPrice: effectiveSelected })
      } else if (isEsperar) {
        const p = new URLSearchParams({ mode: 'esperar', target: String(effectiveSelected) })
        router.push(`/grupo/${groupId}/unirme?${p.toString()}`)
      } else if (authed) {
        open({ groupId, productName: name, productSpec: spec, imageUrl: null, quantity: 1, maxPricePerUnit: effectiveSelected })
      } else {
        router.push(`/grupo/${groupId}/unirme?target=${effectiveSelected}`)
      }
    }, 1800)
  }

  const avatarCount = Math.min(totalParticipants, AVATAR_LETTERS.length)
  const extraCount = totalParticipants - avatarCount

  return (
    <>
      <div className="px-4 pt-4 pb-2">
        {/* Cierre + título (hidden when heroMode — shown in hero overlay) */}
        {!heroMode && (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-700 bg-orange-50 rounded-full px-3 py-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 15" /></svg>
              Cierra dom 22:00 · <GroupCountdown closesAt={closesAt} minimal />
            </span>
            <h1 className="text-2xl font-extrabold text-neutral-900 leading-tight tracking-tight mt-3">{name}</h1>
            {spec && <p className="text-sm text-neutral-500 mt-0.5">{spec}</p>}
          </>
        )}

        {/* ── CARD FUSIONADA (2d) ── */}
        <div className={`border border-neutral-200 rounded-2xl p-[18px] ${heroMode ? 'mt-0' : 'mt-4'}`}>
          {/* Precio + estado */}
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-neutral-400">Precio actual</p>
              <div className="flex items-center flex-wrap gap-2.5 mt-1">
                <span className="text-3xl font-extrabold leading-none text-neutral-900 tabular-nums">{fmt(displayPrice)}</span>
                {savings > 0.01 && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0B7B44] bg-[#E6F4EC] rounded-full px-2.5 py-1.5">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                    Ahorras {fmt(savings)}
                  </span>
                )}
              </div>
              {pvp > 0 && <p className="text-[15px] text-neutral-400 line-through mt-1">{fmt(pvp)}</p>}
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold rounded-full px-2.5 py-1.5 whitespace-nowrap flex-shrink-0" style={{ color: accent, background: statusBg }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent }} />
              {statusLabel}
            </div>
          </div>

          {/* Target slider (con nudge, sin encabezado — estado va arriba) */}
          {detents.length > 1 && (
            <div className="mt-3">
              {/* UX-05 · La pregunta rectora del producto solo existía en escritorio. */}
              <p className="text-[13px] font-bold text-neutral-900 mb-1.5">¿Cuál es el máximo que pagarías?</p>
              <GropoTargetSlider
                detents={detents}
                curIdx={curIdx}
                selIdx={selIdx}
                onSelIdx={handleSelIdx}
                size="mini"
                chrome="nudge"
                udsToNext={missing}
                pulse={pulseData?.steps}
                glow={pulseData?.glow}
                locked={lockPhase > 0}
                disabled={lockPhase > 0}
              />
            </div>
          )}

          {/* Avatares + personas */}
          {totalParticipants > 0 && (
            <div className="flex items-center justify-between mt-3.5">
              <div className="flex items-center -space-x-1.5">
                {AVATAR_LETTERS.slice(0, avatarCount).map((letter) => (
                  <div key={letter} className="w-7 h-7 rounded-full bg-brand/10 border-2 border-white flex items-center justify-center text-[10px] font-bold text-brand">{letter}</div>
                ))}
                {extraCount > 0 && (
                  <div className="w-7 h-7 rounded-full bg-brand/10 border-2 border-white flex items-center justify-center text-[10px] font-bold text-brand">+{extraCount}</div>
                )}
              </div>
              <span className="text-xs text-neutral-500">{totalParticipants} persona{totalParticipants !== 1 ? 's' : ''} en el grupo</span>
            </div>
          )}
        </div>
      </div>

      {belowContent}

      {/* ── BARRA STICKY: CTA que cambia de color ── */}
      <div className="sticky bottom-16 z-20 bg-white border-t border-[#EEEEEE] px-4 py-3">
        <button
          type="button"
          onClick={handleCheckout}
          disabled={lockPhase > 0}
          className="w-full h-12 rounded-xl font-bold text-[14.5px] active:scale-[0.98] transition-all whitespace-nowrap"
          /* UX-06 · Era un botón fantasma (relleno al 8 % con borde) para la única
             acción de la pantalla, la que autoriza una retención en la tarjeta.
             Sólido: #024947 da 10,26:1 con blanco y #B24A00 da 5,42:1. */
          style={lockPhase >= 2
            ? { border: '2px solid #0B7B44', background: '#E8F5E9', color: '#0B7B44' }
            : { background: accent, color: '#fff', boxShadow: `0 10px 24px -12px ${accent}` }}
        >
          {lockPhase >= 2 ? '✓ Precio bloqueado' : (isEsperar ? `Bloquear precio · Máx. ${fmt(effectiveSelected)}` : `Bloquear precio · ${fmt(effectiveSelected)}`)}
        </button>
      </div>
    </>
  )
}
