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
import { getActivation } from '@/lib/activation'

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
  tiers, minExecution, closesAt, heroMode = false, belowContent,
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

  // A-01 · ¿Puede este grupo comprar hoy? Si no, el precio que enseña `compute_price`
  // es el *fallback* —el de un tramo todavía cerrado— y no hay nada garantizado.
  const activation = getActivation(tiers, totalParticipants, minExecution)
  const notActivated = tiers.length > 0 && !activation.activated

  const effectiveSelected = detents[selIdx]?.price ?? displayPrice
  const confirmed = selIdx <= curIdx
  const isEsperar = !confirmed
  const accent = modeAccent(confirmed)
  /**
   * A-11 · El plazo vencido tiene que apagar la pantalla.
   *
   * Antes, un grupo pasado de fecha enseñaba «Cerrado» sobre la foto y
   * «Disponible» en la tarjeta de precio, con el botón de comprar activo. Y no
   * era solo cosmético: `prepare_join` protegía por ESTADO, nunca por fecha, así
   * que entre el cierre y la pasada del cron (domingos 21:00 UTC) el servidor
   * seguía aceptando compras. El servidor ya lo rechaza; esto es la otra mitad.
   *
   * Se calcula después de montar, como `GroupCountdown`: en el servidor y en el
   * cliente «ahora» no es el mismo instante, y hacerlo durante el render daría
   * un desajuste de hidratación. El intervalo hace que la pantalla se apague
   * sola si el plazo vence con la página abierta.
   */
  const [hasClosed, setHasClosed] = useState(false)
  useEffect(() => {
    const check = () => setHasClosed(new Date(closesAt).getTime() <= Date.now())
    check()
    const id = setInterval(check, 1000)
    return () => clearInterval(id)
  }, [closesAt])

  // A-01 · «Disponible» con un grupo que no puede ejecutarse era la primera de las
  // cinco afirmaciones falsas de esta tarjeta.
  const statusLabel = hasClosed ? 'Cerrado' : notActivated ? 'Aún no activado' : confirmed ? 'Disponible' : 'En espera'  // UX-02 · A-11 · A-01
  const statusBg = hasClosed ? '#F1EFF5' : notActivated ? '#FEF3E2' : confirmed ? '#DEEDEC' : '#FCEEE0'
  const statusFg = hasClosed || !notActivated ? accent : '#B4541A'

  /**
   * A-30 · Esto pintaba «✓ Precio bloqueado» al segundo 1,0 y no navegaba hasta el
   * 1,8. En ese instante no hay hold, ni PaymentIntent, ni membresía. P0-03 corrigió
   * el mismo error en `JoinFlow`, que es el checkout; la ficha se quedó sin tocar.
   * `busy` solo protege del doble clic.
   */
  const [busy, setBusy] = useState(false)
  const handleCheckout = () => {
    if (busy || hasClosed) return
    setBusy(true)
    {
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
    }
    // El checkout modal se abre en el sitio; al navegar, `busy` se queda puesto
    // hasta que cambia la página.
    if (authed) setBusy(false)
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
              {/* A-01 · «PRECIO ACTUAL» sobre el fallback de un tramo cerrado era
                  falso. Mientras el grupo no arranca, ese número es el precio al que
                  SALDRÍA, no uno que nadie tenga garantizado. */}
              {/* A-11c · Con el plazo vencido, «PRECIO ACTUAL» ya no describe nada:
                  no hay compra posible a ese precio. */}
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-neutral-400">
                {hasClosed ? 'Precio al cierre' : notActivated ? 'Precio de salida' : 'Precio actual'}
              </p>
              <div className="flex items-center flex-wrap gap-2.5 mt-1">
                <span className="text-3xl font-extrabold leading-none text-neutral-900 tabular-nums">{fmt(displayPrice)}</span>
                {/* Sin ahorro mientras no haya precio real del que ahorrar (A-01),
                    ni cuando ya no se puede comprar (A-11c). */}
                {savings > 0.01 && !notActivated && !hasClosed && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0B7B44] bg-[#E6F4EC] rounded-full px-2.5 py-1.5">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                    Ahorras {fmt(savings)}
                  </span>
                )}
              </div>
              {pvp > 0 && <p className="text-[15px] text-neutral-400 line-through mt-1">{fmt(pvp)}</p>}
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold rounded-full px-2.5 py-1.5 whitespace-nowrap flex-shrink-0" style={{ color: statusFg, background: statusBg }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusFg }} />
              {statusLabel}
            </div>
          </div>

          {/* A-01 · La meta que faltaba: cuántas unidades necesita el grupo para
              arrancar y cuántas lleva. El dato (`min_execution`) existía y llegaba
              hasta aquí como prop; simplemente no se pintaba. */}
          {notActivated && (
            <div className="mt-3.5 rounded-xl px-3.5 py-3" style={{ background: '#FEF7ED', border: '1px solid #FBE3C7' }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-bold text-[#8A4B10]">
                  {activation.unitsToActivate === 1
                    ? 'Falta 1 unidad para que arranque'
                    : `Faltan ${activation.unitsToActivate} unidades para que arranque`}
                </span>
                <span className="text-[12px] font-bold tabular-nums text-[#B4541A]">
                  {totalParticipants} / {activation.targetUnits}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: '#FBE3C7' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round((totalParticipants / Math.max(1, activation.targetUnits)) * 100))}%`,
                    background: '#E8944A',
                  }}
                />
              </div>
              <p className="mt-2 text-[12px] leading-snug text-[#8A4B10]">
                Este grupo necesita {activation.targetUnits} unidades para salir adelante.
                Hasta entonces no hay compra ni cargo: si no llega, se cancela y no se cobra nada.
              </p>
            </div>
          )}

          {/* Target slider (con nudge, sin encabezado — estado va arriba) */}
          {/* A-11c · Preguntar «¿cuál es el máximo que pagarías?» con un slider
              arrastrable en un grupo cerrado es seguir vendiendo con el botón
              apagado. En su lugar se cuenta lo que pasó. */}
          {hasClosed && (
            <div className="mt-3.5 rounded-xl px-3.5 py-3" style={{ background: '#F5F4F8', border: '1px solid #E8E6F0' }}>
              <p className="text-[13px] font-bold text-neutral-700">Este grupo ya ha cerrado</p>
              <p className="mt-1 text-[12px] leading-snug text-neutral-500">
                Se quedó en {fmt(displayPrice)} con {totalParticipants} {totalParticipants === 1 ? 'unidad' : 'unidades'}.
                Ya no admite nuevas compras.
              </p>
            </div>
          )}

          {detents.length > 1 && !hasClosed && (
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
                locked={busy}
                disabled={busy || hasClosed}
                notActivated={notActivated}
                udsToActivate={activation.unitsToActivate}
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
          disabled={busy || hasClosed}
          className="w-full h-12 rounded-xl font-bold text-[14.5px] active:scale-[0.98] transition-all whitespace-nowrap"
          /* UX-06 · Era un botón fantasma (relleno al 8 % con borde) para la única
             acción de la pantalla, la que autoriza una retención en la tarjeta.
             Sólido: #024947 da 10,26:1 con blanco y #B24A00 da 5,42:1. */
          style={hasClosed
            ? { background: '#E8E6F0', color: '#6B6B76', cursor: 'not-allowed' }
            : { background: accent, color: '#fff', boxShadow: `0 10px 24px -12px ${accent}` }}
        >
          {hasClosed
            ? 'Este grupo ya ha cerrado'
            : busy
              ? 'Abriendo…'
              /* A-01 · No se puede «bloquear» un precio que todavía no existe: lo que
                 se hace aquí es reservar plaza para que el grupo arranque. */
              : notActivated
                ? 'Reservar mi plaza · Hoy 0 €'
                : isEsperar ? `Bloquear precio · Máx. ${fmt(effectiveSelected)}` : `Bloquear precio · ${fmt(effectiveSelected)}`}
        </button>
      </div>
    </>
  )
}
