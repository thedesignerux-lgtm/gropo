'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTierDemand } from '@/hooks/useTierDemand'
import { usePulse } from '@/hooks/usePulse'
import { useCheckout } from '@/components/checkout/CheckoutProvider'
import { createClient } from '@/lib/supabase-browser'
import { type Detent } from '@/components/GropoTargetSlider'
import TierChooser from '@/components/desktop/TierChooser'
import { modeAccent } from '@/lib/brand-colors'
import GroupPeopleGlyph from '@/components/GroupPeopleGlyph'
import { getActivation } from '@/lib/activation'
import { fmtSaving } from '@/lib/money'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

interface Tier { minUnits: number; price: number }

interface Props {
  groupId: string
  name: string
  spec: string
  imageUrl: string | null
  pvp: number
  tiers: Tier[]
  maxStock: number
  minExecution: number
  /** A-04 · Personas, no unidades. */
  memberCount: number
  closesAt: string
}

export default function GroupRightSidebar({
  groupId, name, spec, imageUrl, tiers, pvp, maxStock, minExecution, memberCount, closesAt,
}: Props) {
  // A-29 · Hasta el 14-sep-2026 estas tres props se declaraban, se pasaban desde
  // GroupDesktopView… y no se desestructuraban. Consecuencia: el arreglo de A-11
  // (plazo vencido) nunca llegó a escritorio, el selector topaba en 10 fijo
  // ignorando el stock, y el ahorro no existía en esta vista.
  const { tiers: demandTiers, currentPrice, nextTier } = useTierDemand(groupId)
  /* El pulso sigue suscrito (alimenta las notificaciones); el chooser no lo pinta. */
  usePulse(nextTier ? groupId : null)
  const displayPrice = currentPrice > 0 ? currentPrice : (tiers.length > 0 ? Math.max(...tiers.map(t => t.price)) : 0)
  // UNIDADES comprometidas, no personas. La demanda efectiva es máxima en el tramo
  // más barato (ahí entran todos: los de «comprar» y los esperadores, cuyo objetivo
  // siempre es un precio de la escalera), así que este máximo equivale a la suma que
  // usan `group_committed_units` y `prepare_join`. El copy de abajo aún dice
  // «personas»: ver A-04 en UX_AUDIT_2.md.
  const committedUnits = demandTiers.length > 0 ? Math.max(...demandTiers.map(t => t.demand)) : 0

  /**
   * Demanda de CADA tramo para las tarjetas del slider, con las unidades como clave.
   * Sale de `tier_demand`, que es quien sabe cuántas unidades cuentan a cada precio.
   */
  const tierDemand = useMemo(
    () => Object.fromEntries(demandTiers.map((t) => [t.minUnits, t.demand])),
    [demandTiers],
  )

  // Detents: tramos ordenados por minUnits asc (= precio desc)
  const detents: Detent[] = useMemo(
    () => [...tiers].sort((a, b) => a.minUnits - b.minUnits).map(t => ({ price: t.price, uds: t.minUnits })),
    [tiers]
  )

  // Índice del tramo actual: el más barato ya alcanzado (precio >= displayPrice)
  const curIdx = useMemo(() => {
    let idx = 0
    for (let i = 0; i < detents.length; i++) if (detents[i].price >= displayPrice) idx = i
    return idx
  }, [detents, displayPrice])

  const [selIdx, setSelIdx] = useState(curIdx)
  const [quantity, setQuantity] = useState(1)
  const touchedRef = useRef(false)

  /**
   * EL PRECIO CON TUS UNIDADES DENTRO — y por qué el suelo del selector no es `curIdx`.
   *
   * `prepare_join` NO guarda como techo el tramo que marcas: guarda
   * `compute_price(grupo, tu_cantidad).best_price`, o sea el precio proyectado CON tus
   * unidades ya contadas. Verificado en producción el 15-sep-2026 sobre las Zapatillas
   * (demanda 12 en el tramo de 20):
   *
   *     compute_price(grupo, 7) → 119 €      compute_price(grupo, 8) → 99 €
   *
   * Es decir: con 8 unidades el techo que se graba es 99, no 119. La ficha enseñaba
   * «Asegurar hasta 119 €» y retenía 99 × 8. Marcar 119 con 8 unidades era imposible.
   *
   * Así que el suelo de lo elegible es este precio proyectado, no el precio del grupo.
   * Se pregunta al MISMO endpoint que usa el checkout (`/quote` → `compute_price`), para
   * no reimplementar la matemática de tramos en el navegador.
   */
  const [projPrice, setProjPrice] = useState<number | null>(null)
  useEffect(() => {
    const ac = new AbortController()
    fetch(`/api/group/${groupId}/quote?units=${quantity}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => { if (d?.pricePerUnit != null) setProjPrice(Number(d.pricePerUnit)) })
      .catch(() => {})
    return () => ac.abort()
  }, [groupId, quantity])

  // A-11 en escritorio · El plazo es una regla, no un adorno. Se calcula DESPUÉS
  // de montar (como GroupCountdown) para no romper la hidratación, y con
  // intervalo para que la pantalla se apague sola si vence con la página abierta.
  const [hasClosed, setHasClosed] = useState(false)
  useEffect(() => {
    if (!closesAt) return
    const check = () => setHasClosed(new Date(closesAt).getTime() <= Date.now())
    check()
    const id = setInterval(check, 1000)
    return () => clearInterval(id)
  }, [closesAt])

  /** Suelo de lo elegible: el tramo al que entrarías HOY con tus unidades dentro.
   *  Nunca por encima de `curIdx`; mientras no haya cotización, es `curIdx`. */
  const floorIdx = useMemo(() => {
    if (projPrice == null) return curIdx
    let idx = curIdx
    for (let i = 0; i < detents.length; i++) if (detents[i].price >= projPrice) idx = i
    return Math.max(curIdx, idx)
  }, [detents, projPrice, curIdx])

  // Si el usuario no ha tocado el slider, sigue al precio actual (realtime)
  useEffect(() => {
    if (!touchedRef.current) setSelIdx(curIdx)
  }, [curIdx])
  /* Si subes la cantidad y con ella desbloqueas un tramo, el que tenías marcado deja
     de existir como opción: la marca baja sola al nuevo suelo. */
  useEffect(() => {
    setSelIdx((i) => (i < floorIdx ? floorIdx : i))
  }, [floorIdx])
  useEffect(() => {
    if (selIdx > detents.length - 1) setSelIdx(curIdx)
  }, [detents.length, selIdx, curIdx])

  const handleSelIdx = (i: number) => { touchedRef.current = true; setSelIdx(i) }

  const selectedPrice = detents[selIdx]?.price ?? displayPrice
  /* «Comprar ahora» es elegir el suelo: el precio que ya tendrías entrando con tus
     unidades. Por debajo de ahí sí estás esperando a que el grupo baje. */
  const confirmed = selIdx <= floorIdx
  const isEsperar = !confirmed

  // Auth + checkout
  const { open } = useCheckout()
  const router = useRouter()
  const [authed, setAuthed] = useState<boolean | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setAuthed(!!user))
  }, [])

  // A-29 · Tope real del selector. `maxStock` es el stock de la puja que da el mejor
  // precio; restarle las unidades ya comprometidas es el mismo cálculo que hace
  // `remainingStock()` en el checkout. La autoridad sigue siendo `prepare_join`:
  // esto solo evita pedir lo que ya no existe.
  // A-01 · ¿Puede este grupo comprar hoy? Si no, el precio que se ve es el *fallback*
  // de `compute_price`: el de un tramo todavía cerrado.
  const activation = getActivation(tiers, committedUnits, minExecution)
  const notActivated = tiers.length > 0 && !activation.activated

  const remaining = maxStock > 0 ? Math.max(0, maxStock - committedUnits) : null
  const noStock = remaining !== null && remaining === 0
  const maxQty = remaining === null ? 10 : Math.max(1, Math.min(10, remaining))

  const ctaParams = new URLSearchParams()
  if (isEsperar) {
    ctaParams.set('mode', 'esperar')
    ctaParams.set('target', String(selectedPrice))
  }
  if (quantity > 1) ctaParams.set('qty', String(quantity))
  const ctaHref = `/grupo/${groupId}/unirme${ctaParams.toString() ? `?${ctaParams.toString()}` : ''}`

  // A-30 · Antes esto pintaba «✓ Precio bloqueado» al segundo 1,0 y no navegaba
  // hasta el 1,8. En ese instante no hay hold, ni PaymentIntent, ni membresía: el
  // comprador ni siquiera ha visto el formulario de pago. Confirmar algo que el
  // sistema todavía no puede garantizar es justo lo que P0-03 corrigió en móvil.
  // Ahora la acción arranca en el clic; `busy` solo protege del doble clic.
  const [busy, setBusy] = useState(false)
  const handleBuy = () => {
    if (busy || hasClosed || noStock) return
    setBusy(true)
    if (isEsperar && authed) {
      open({ groupId, productName: name, productSpec: spec, imageUrl, quantity, maxPricePerUnit: selectedPrice, joinMode: 'esperar', targetPrice: selectedPrice })
      setBusy(false)
    } else if (authed && !isEsperar) {
      open({ groupId, productName: name, productSpec: spec, imageUrl, quantity, maxPricePerUnit: selectedPrice })
      setBusy(false)
    } else {
      router.push(ctaHref)   // navegando: `busy` se queda puesto hasta que cambia la página
    }
  }

  const accent = modeAccent(confirmed)
  const accentShadow = confirmed ? 'rgba(2, 73, 71,.35)' : 'rgba(232,148,74,.35)'

  return (
    <aside className="flex-shrink-0 sticky top-[24px]">
      <div className="bg-white rounded-[22px] border border-[#E6EDEC] p-6" style={{ boxShadow: '0 24px 60px -34px rgba(30,20,60,.4)' }}>

        {/* ── Estado del grupo (A-11 y A-01 en escritorio) ── */}
        {hasClosed ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5 mb-4 bg-[#F1F5F9] text-[#475569]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]" />
            Cerrado
          </span>
        ) : notActivated ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5 mb-4 bg-[#FEF3E2] text-[#B4541A]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E8944A]" />
            Aún no activado
          </span>
        ) : null}

        {/* ── Precio actual + siguiente ── */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.12em] mb-1">{hasClosed ? 'Precio al cierre' : notActivated ? 'Precio de salida' : 'Precio actual'}</p>
            <span className="text-4xl font-extrabold leading-none text-neutral-900 tabular-nums">{fmt(displayPrice)}</span>
            {/* A-29 · `pvp` llegaba como prop y no se usaba: en escritorio no existía el ahorro.
                A-01 · Sin ahorro mientras no haya un precio real del que ahorrar. */}
            {pvp > displayPrice && displayPrice > 0 && !notActivated && (
              <p className="mt-1.5 text-[12.5px] text-neutral-500">
                <span className="line-through">{fmt(pvp)}</span>
                <span className="ml-2 font-bold text-[#0B7B44]">Ahorras {fmtSaving(pvp - displayPrice)}</span>
              </p>
            )}
            {notActivated && pvp > 0 && (
              <p className="mt-1.5 text-[12.5px] text-neutral-500 line-through">{fmt(pvp)}</p>
            )}
          </div>
          {nextTier && !hasClosed && !notActivated && (
            <div className="text-right">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.12em] mb-1">Siguiente</p>
              <span className="text-2xl font-extrabold text-brand tabular-nums">{fmt(nextTier.price)}</span>
            </div>
          )}
        </div>

        {/* ── Gente del grupo (A-33) ── */}
        {committedUnits > 0 && (
          <div className="flex items-center gap-2.5 mt-4">
            {/* A-33 · Aquí había tres círculos con las letras A, B y C. No eran
                iniciales de nadie. Ahora un símbolo de grupo, que no afirma nada. */}
            <GroupPeopleGlyph count={memberCount > 0 ? memberCount : committedUnits} />
            {/* A-04 · Personas para la gente, unidades para el precio. */}
            <span className="text-sm text-neutral-500">
              {memberCount <= 0
                ? <>{committedUnits} {committedUnits === 1 ? 'unidad' : 'unidades'} en el grupo</>
                : memberCount === committedUnits
                  ? <><b className="font-semibold text-neutral-700">{memberCount} {memberCount === 1 ? 'persona' : 'personas'}</b> en el grupo</>
                  : <><b className="font-semibold text-neutral-700">{memberCount} personas</b> ya han pedido <b className="font-semibold text-neutral-700">{committedUnits} unidades</b></>}
            </span>
          </div>
        )}

        {/* A-01 · La meta que faltaba: cuántas unidades necesita para arrancar. */}
        {notActivated && (
          <div className="mt-4 rounded-2xl px-4 py-3.5" style={{ background: '#FEF7ED', border: '1px solid #FBE3C7' }}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-bold text-[#8A4B10]">
                {activation.unitsToActivate === 1
                  ? 'Falta 1 unidad para que arranque'
                  : `Faltan ${activation.unitsToActivate} unidades para que arranque`}
              </span>
              <span className="text-[12px] font-bold tabular-nums text-[#B4541A]">
                {committedUnits} / {activation.targetUnits}
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: '#FBE3C7' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round((committedUnits / Math.max(1, activation.targetUnits)) * 100))}%`, background: '#E8944A' }} />
            </div>
            <p className="mt-2 text-[12px] leading-snug text-[#8A4B10]">
              Este grupo necesita {activation.targetUnits} unidades para salir adelante. Hasta
              entonces no hay compra ni cargo: si no llega, se cancela y no se cobra nada.
            </p>
          </div>
        )}

        <div className="border-t border-[#F1EFF5] my-5" />

        {/* A-11c · Un grupo cerrado no pregunta cuánto pagarías: cuenta qué pasó. */}
        {hasClosed && (
          <div className="rounded-2xl px-4 py-3.5" style={{ background: '#F5F4F8', border: '1px solid #E8E6F0' }}>
            <p className="text-[13px] font-bold text-neutral-700">Este grupo ya ha cerrado</p>
            <p className="mt-1 text-[12px] leading-snug text-neutral-500">
              Se quedó en {fmt(displayPrice)} con {committedUnits} {committedUnits === 1 ? 'unidad' : 'unidades'}.
              Ya no admite nuevas compras.
            </p>
          </div>
        )}

        {/* MOCKUP 15-sep-2026 · El slider de escritorio se sustituye por el panel de
            progreso + las tarjetas de tramo que dibujó Benjamin. La pregunta larga
            («¿Cuál es el precio máximo que pagarías?») desaparece: el panel ya explica
            la mecánica en una frase y las tarjetas llevan su propio encabezado, así que
            mantenerla repetiría el enunciado —que fue exactamente el fallo A-03—.
            En móvil NO cambia nada: `GroupLiveSection` sigue con el slider. */}
        {detents.length > 1 && !hasClosed ? (
          <TierChooser
            detents={detents}
            tierDemand={tierDemand}
            curIdx={curIdx}
            floorIdx={floorIdx}
            selIdx={selIdx}
            onSelIdx={handleSelIdx}
            /* La cantidad REAL, incluido el 1 por defecto. Ocultar el «+1» dejaba la
               barra contando sin ti y el suelo del selector contando contigo: con una
               demanda de 19/20, una sola unidad tuya baja el precio y la barra no se
               enteraba. La proyección y el suelo tienen que contar lo mismo. */
            myUnits={quantity}
            disabled={busy}
            notActivated={notActivated}
          />
        ) : (
          <div className="text-lg font-bold text-neutral-900">{fmt(displayPrice)}</div>
        )}

        {/* ── Cantidad + CTA ── */}
        <div className="flex items-center gap-3 mt-4">
          <div className={`inline-flex items-center rounded-xl border border-[#E4E1DA] flex-shrink-0 overflow-hidden ${hasClosed ? 'hidden' : ''}`}>
            <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1 || hasClosed}
              className="flex h-[46px] w-[42px] items-center justify-center text-xl text-[#3a3a42] bg-white disabled:text-neutral-300 cursor-pointer" aria-label="Menos">−</button>
            <span className="w-9 text-center text-[15px] font-extrabold tabular-nums text-neutral-900">{quantity}</span>
            <button type="button" onClick={() => setQuantity(q => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty || hasClosed}
              className="flex h-[46px] w-[42px] items-center justify-center text-xl text-[#3a3a42] bg-white disabled:text-neutral-300 cursor-pointer" aria-label="Más">+</button>
          </div>

          <button
            type="button"
            onClick={handleBuy}
            disabled={busy || hasClosed || noStock}
            className="flex-1 h-[46px] rounded-[14px] font-extrabold text-[13.5px] active:scale-[0.98] transition-all whitespace-nowrap disabled:active:scale-100"
            /* UX-06 · Mismo cambio que en móvil: la acción principal deja de
               parecer secundaria. */
            style={hasClosed || noStock
              ? { background: '#E8E8EC', color: '#6B6B76' }
              : { background: accent, color: '#fff', boxShadow: `0 12px 26px -14px ${accentShadow}` }}
          >
            {hasClosed
              ? 'Este grupo ya ha cerrado'
              : noStock
                ? 'Sin unidades disponibles'
                : busy
                  ? 'Abriendo…'
                  /* A-01 · No se puede «bloquear» un precio que aún no existe. */
                  : notActivated
                    ? 'Asegurar mi plaza · Hoy 0 €'
                    /* A-31 · Mismo verbo que en móvil. */
                    : `Asegurar hasta ${fmt(selectedPrice)}`}
          </button>
        </div>

        <p className="text-xs text-neutral-400 text-center mt-3">Pago 100% seguro con Stripe</p>
      </div>
    </aside>
  )
}
