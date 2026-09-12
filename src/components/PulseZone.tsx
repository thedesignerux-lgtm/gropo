// src/components/PulseZone.tsx — GROPO PULSE v3 · Mi Radar
// Dueño único del área inferior de la tarjeta: barra (anatomía del mockup) +
// UNA línea de estado + UNA CTA primaria por estado (secundaria opcional).
//
// Estados → CTA primaria:
//   meta alcanzada        → "Entrar al precio mínimo" (verde)
//   convertido            → "Ver en Mis grupos" (verde)
//   activando (holding)   → "Activando tu precio…" (morado, deshabilitada)
//   masa alcanzada        → "Ya sois suficientes → Aceptar X €" (morado)
//                           [secundaria: Asegurar precio · Y €]
//   resto                 → "Asegurar precio · Y €" (color del variant)
'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { type TierPoint, type TierVariant } from '@/components/TierProgress'
import GropoTargetSlider, { type Detent } from '@/components/GropoTargetSlider'
import PulseAcceptModal from '@/components/PulseAcceptModal'
import { usePulse } from '@/hooks/usePulse'

const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
const PURPLE = '#024947'
const GREEN = '#0B7B44'

interface Props {
  groupId: string
  productName: string
  current: number
  tiers: TierPoint[]
  variant: TierVariant
  /** Precio vigente (para la CTA "Asegurar precio · X €") */
  currentPrice: number
  /** Meta alcanzada (sin siguiente tramo) */
  complete?: boolean
  /** Color de la CTA por defecto (tema del variant de la tarjeta) */
  ctaColor?: string
  /** Línea informativa de la tarjeta (p. ej. "Faltan N unidades para bajar a X €") */
  children?: React.ReactNode
  /** Mi Radar (8c): leyendas en caja (gris / morada + CTA / naranja) en
   *  lugar de la línea de estado + CTA por defecto. */
  boxedLegend?: boolean
}

export default function PulseZone({
  groupId, productName, current, tiers, currentPrice, complete = false, ctaColor = '#F0531F', children,
  boxedLegend = false,
}: Props) {
  const { data, refresh } = usePulse(complete ? null : groupId)
  const router = useRouter()
  const [modal, setModal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const steps = data?.steps ?? []
  const glow = data?.glow ?? 0
  const mine = data?.mine ?? null
  const pulse = steps.map((s) => ({
    units: s.units, marked: s.marked, markedFraction: s.markedFraction,
    surge: s.surge, acceptedFraction: s.acceptedFraction,
    committed: s.committed, reached: s.reached,
  }))
  const myStep = mine ? steps.find((s) => s.price === mine.tier_price) ?? null : null
  const selectedUnits = mine && ['watching', 'accepted', 'holding'].includes(mine.status)
    ? myStep?.units ?? null
    : null
  const canAccept = mine?.status === 'watching' && !!myStep?.reachable && !myStep?.reached
  const markable = !complete && (mine == null || mine.status === 'watching')
  const qty = mine?.quantity ?? 1

  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation() }
  const go = (e: React.MouseEvent, href: string) => { stop(e); router.push(href) }

  // ── Micro-interacción de bloqueo (misma que la ficha): 0=idle, 1=giro, 2=bloqueado ──
  const [lockPhase, setLockPhase] = useState(0)
  const lockTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => { lockTimers.current.forEach(clearTimeout) }, [])
  function startLock(e: React.MouseEvent, action: () => void) {
    stop(e)
    if (lockPhase > 0) return
    setLockPhase(1)
    lockTimers.current.push(setTimeout(() => setLockPhase(2), 1000))
    lockTimers.current.push(setTimeout(action, 1800))
  }
  const lockedCtaStyle = { border: '2px solid #0B7B44', background: '#E8F5E9', color: '#0B7B44' }

  async function upsertPledge(price: number, quantity: number) {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/pulse/pledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, quantity, tier_price: price }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? 'No se pudo guardar tu espera')
      }
      await refresh()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally { setBusy(false) }
  }

  async function removePledge() {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/pulse/pledge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? 'No se pudo cancelar')
      }
      await refresh()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally { setBusy(false) }
  }

  async function cancel(e: React.MouseEvent) {
    stop(e)
    await removePledge()
  }

  // ── Target slider: detents, índice actual y ancla ──
  const detents: Detent[] = useMemo(
    () => [...tiers]
      .filter((t) => t.price != null)
      .sort((a, b) => a.units - b.units)
      .map((t) => ({ price: t.price as number, uds: t.units })),
    [tiers]
  )
  const curIdx = useMemo(() => {
    let idx = 0
    for (let i = 0; i < detents.length; i++) {
      const reached = tiers.find((t) => t.units === detents[i].uds)?.unlocked ?? current >= detents[i].uds
      if (reached) idx = i
    }
    return idx
  }, [detents, tiers, current])
  const anchoredIdx = useMemo(() => {
    if (selectedUnits != null) {
      const i = detents.findIndex((d) => d.uds === selectedUnits)
      if (i >= 0) return i
    }
    return curIdx
  }, [selectedUnits, detents, curIdx])

  // ── UI OPTIMISTA ──────────────────────────────────────────────
  // El thumb y la leyenda responden AL INSTANTE al toque; la llamada a
  // /api/pulse/pledge (upsert/remove) va en segundo plano. Sin bloqueo por
  // `busy` ni fade, así no se percibe latencia de red. `committedRef` guarda
  // el ancla confirmada (o curIdx si no hay) para detectar el re-tap (toggle),
  // ya que selIdx ya se ha actualizado cuando llega onCommit.
  const [selIdx, setSelIdx] = useState(anchoredIdx)
  const committedRef = useRef(anchoredIdx)
  useEffect(() => {
    // Sincroniza desde el servidor solo cuando el ancla confirmada cambia
    // (carga inicial o confirmación); no pisa el estado local optimista.
    committedRef.current = anchoredIdx
    setSelIdx(anchoredIdx)
  }, [anchoredIdx])

  // 8c: ¿el usuario ha tocado el tramo ACTUAL (disponible)? → leyenda morada + CTA.
  // Sin toque = leyenda gris. Un pledge en espera manda (leyenda naranja) y limpia esto.
  const [curActive, setCurActive] = useState(false)
  useEffect(() => { if (mine?.status === 'watching') setCurActive(false) }, [mine?.status])

  const sliderDisabled = complete || !markable

  function onCommitAnchor(i: number) {
    if (complete || !markable) return
    const prev = committedRef.current
    if (i > curIdx) {
      if (prev === i) {
        // Re-tap sobre la misma ancla → desanclar (instantáneo)
        committedRef.current = curIdx
        setCurActive(false)
        setSelIdx(curIdx)
        removePledge()
      } else if (detents[i]) {
        // Ancla en un tramo más barato (esperador): persistir en segundo plano
        committedRef.current = i
        setCurActive(false)
        setSelIdx(i)
        upsertPledge(detents[i].price, qty)
      }
    } else {
      // Toque en el tramo actual (o clamp inferior)
      if (prev > curIdx) {
        // Había ancla en espera → desanclar (vuelve a gris)
        committedRef.current = curIdx
        setCurActive(false)
        setSelIdx(curIdx)
        removePledge()
      } else {
        // Toggle gris ↔ morado sobre el tramo disponible
        setSelIdx(curIdx)
        setCurActive((v) => !v)
      }
    }
  }

  // ── Línea de estado (máx. UNA) ──
  let statusLine: React.ReactNode = null
  if (!complete) {
    if (error) {
      statusLine = <p className="text-[12px] font-semibold text-red-600">{error}</p>
    } else if (mine?.status === 'failed') {
      statusLine = (
        <p className="text-[12px] font-semibold text-red-600">
          Tu tarjeta no pudo verificarse.{' '}
          <button onClick={(e) => go(e, `/grupo/${groupId}`)} className="underline font-bold">Reintentar</button>
        </p>
      )
    } else if (mine?.status === 'accepted') {
      statusLine = (
        <div className="flex items-center justify-between text-[12px]">
          <span className="inline-flex items-center gap-1.5 font-bold" style={{ color: '#013230' }}>
            <Dot color={PURPLE} />
            Compromiso activo · {fmt(mine.tier_price)} — 0 € hasta que haya grupo
          </span>
          <button onClick={cancel} disabled={busy} className="text-neutral-400 font-semibold hover:text-neutral-600">Quitar</button>
        </div>
      )
    } else if (mine?.status === 'watching') {
      // Stepper de cantidad SIEMPRE visible en watching — también cuando ya se
      // puede aceptar (antes, canAccept ocultaba esta línea y era imposible
      // cambiar la cantidad antes de comprometerse).
      statusLine = (
        <div className="flex items-center justify-between text-[12px]">
          <span className="inline-flex items-center gap-2 font-bold" style={{ color: '#013230' }}>
            <Dot color={PURPLE} />
            Tu ancla: {fmt(mine.tier_price)}
            <span className="inline-flex items-center gap-1.5 font-semibold text-neutral-500">
              <button disabled={busy} onClick={(e) => { stop(e); if (qty > 1) upsertPledge(mine.tier_price, qty - 1) }} className="w-5 h-5 rounded-full border border-neutral-200 leading-none">−</button>
              {qty} ud{qty > 1 ? 's' : ''}
              <button disabled={busy} onClick={(e) => { stop(e); if (qty < 10) upsertPledge(mine.tier_price, qty + 1) }} className="w-5 h-5 rounded-full border border-neutral-200 leading-none">+</button>
            </span>
          </span>
          <button onClick={cancel} disabled={busy} className="text-neutral-400 font-semibold hover:text-neutral-600">Quitar</button>
        </div>
      )
    } else if (mine == null && markable && steps.some((s) => !s.reached)) {
      statusLine = (
        <p className="hidden lg:block text-[12px] text-neutral-400">
          Toca el <b style={{ color: '#013230' }}>precio que esperas</b> — sin tarjeta, sin compromiso.
        </p>
      )
    }
  }

  // ── CTA primaria (UNA) + secundaria opcional ──
  let primary: React.ReactNode
  if (complete) {
    primary = <Cta color={GREEN} soft onClick={(e) => go(e, `/grupo/${groupId}`)}>Entrar al precio mínimo</Cta>
  } else if (mine?.status === 'converted') {
    // En Mi Radar no enviamos a "Mis grupos": confirmación estática (sin navegación).
    primary = (
      <div
        className="flex items-center justify-center gap-2 w-full rounded-[11px] py-[13px] text-sm font-bold min-h-[46px]"
        style={{ backgroundColor: `${GREEN}12`, color: GREEN, border: `1px solid ${GREEN}2E` }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-4 h-4" aria-hidden="true"><path d="M5 12l5 5 9-11" /></svg>
        Precio activado
      </div>
    )
  } else if (mine?.status === 'holding') {
    primary = <Cta color={PURPLE} disabled>Activando tu precio…</Cta>
  } else if (canAccept && mine) {
    // UNA sola CTA: el foco es activar el precio anclado. La secundaria
    // "Asegurar precio" competía con ella y desviaba a otro flujo.
    primary = (
      <Cta color={PURPLE} onClick={(e) => { stop(e); setModal(true) }}>
        Ya sois suficientes → Aceptar {fmt(mine.tier_price)}
      </Cta>
    )
  } else if (mine?.status === 'watching') {
    // Con ancla marcada: asegurar AL PRECIO DEL NODO (flujo esperar con ese target)
    primary = (
      <Cta
        color={ctaColor}
        soft
        onClick={(e) => go(e, `/grupo/${groupId}/unirme?mode=esperar&target=${mine.tier_price}&qty=${qty}`)}
      >
        Asegurar precio · {fmt(mine.tier_price)}
      </Cta>
    )
  } else {
    // Sin ancla: aseguras tu PLAZA al precio vigente (y bajas con el grupo).
    // Va al flujo de unirse en modo 'comprar', igual que la rama con ancla va al
    // suyo: la CTA hace lo que dice. Antes llevaba a la ficha (/grupo/[id]) y
    // desde Mi Radar parecía que el botón te devolvía a la página del producto.
    primary = (
      <Cta
        color={ctaColor}
        soft
        onClick={(e) => go(e, `/grupo/${groupId}/unirme${qty > 1 ? `?qty=${qty}` : ''}`)}
      >
        Bloquear precio · {fmt(currentPrice)}
      </Cta>
    )
  }

  // ── 8c: leyenda en caja (gris / morada + CTA / naranja) ──
  // Solo en estados de navegación normales; los estados especiales (activado,
  // meta, aceptado, activando, error…) siguen usando statusLine + primary.
  // canAccept NO es estado especial en modo boxed: se integra en la leyenda con
  // UNA sola CTA (sin la secundaria "Asegurar precio").
  const specialState =
    complete || !!error ||
    mine?.status === 'failed' || mine?.status === 'accepted' ||
    mine?.status === 'holding' || mine?.status === 'converted'
  const useBoxed = boxedLegend && !specialState
  const anchoredLower = mine?.status === 'watching' || selIdx > curIdx
  // Estado gris (sin selección): sin thumb; el tramo actual = nodo morado con ✓.
  const noSelection = useBoxed && !anchoredLower && !curActive

  let boxed: React.ReactNode = null
  if (useBoxed) {
    if (anchoredLower && canAccept && mine) {
      // Masa alcanzada para tu precio anclado → leyenda morada + UNA CTA de aceptar
      boxed = (
        <>
          <div className="flex items-start gap-2.5 rounded-2xl mt-3.5" style={{ background: '#EFF6F6', border: '1px solid #E2F0EF', padding: '12px 14px' }}>
            <MedalIcon color="#024947" />
            <div>
              <p className="text-[13px] leading-snug" style={{ color: '#024947' }}>
                ¡Ya sois suficientes! Tu precio de <b>{fmt(mine.tier_price)}</b> puede hacerse realidad.
              </p>
              <p className="text-[12px] leading-snug mt-1.5" style={{ color: '#024947' }}>
                Solo añades tu tarjeta: <b>hoy no se te cobra ni se retiene nada</b>. Si el resto
                también fija su precio y este se activa, se retiene el importe y se cobra al cerrar
                el grupo el domingo.
              </p>
            </div>
          </div>
          {/* Sin micro-interacción de candado: aquí el slider está oculto (el foco
              es activar el precio, no elegirlo), así que la animación no tendría
              dónde ocurrir — y "✓ Precio bloqueado" sería falso: aún no hay
              tarjeta. Abre el modal directamente. */}
          <button
            onClick={(e) => { stop(e); setModal(true) }}
            className="w-full mt-3 rounded-[12px] py-3.5 text-sm font-bold transition-[filter] hover:brightness-95 active:scale-[0.99]"
            style={{ background: '#024947', color: '#fff' }}
          >
            Ya sois suficientes → Aceptar {fmt(mine.tier_price)}
          </button>
        </>
      )
    } else if (anchoredLower) {
      const missUds = Math.max(0, (detents[selIdx]?.uds ?? 0) - current)
      boxed = (
        <div className="flex items-start gap-2.5 rounded-2xl mt-3.5" style={{ background: '#FCF3E9', border: '1px solid #F3E1CB', padding: '12px 14px' }}>
          <MedalIcon color="#C77A2E" />
          <p className="text-[13px] leading-snug" style={{ color: '#9A6428' }}>
            {missUds === 1 ? 'Falta ' : 'Faltan '}<b>{missUds} {missUds === 1 ? 'ud' : 'uds'}</b> para este tramo. Solo te avisaremos si este precio puede hacerse realidad.
          </p>
        </div>
      )
    } else if (curActive) {
      boxed = (
        <>
          <div className="flex items-start gap-2.5 rounded-2xl mt-3.5" style={{ background: '#EFF6F6', border: '1px solid #E2F0EF', padding: '12px 14px' }}>
            <MedalIcon color="#024947" />
            <p className="text-[13px] leading-snug" style={{ color: '#024947' }}>
              Este precio ya está disponible. <b>¡Desbloquéalo ahora!</b>
            </p>
          </div>
          <button
            onClick={(e) => startLock(e, () => router.push(`/grupo/${groupId}/unirme`))}
            disabled={lockPhase === 1}
            className="w-full mt-3 rounded-[12px] py-3.5 text-sm font-bold transition-[filter] hover:brightness-95 active:scale-[0.99]"
            style={lockPhase >= 2 ? lockedCtaStyle : { background: '#024947', color: '#fff' }}
          >
            {lockPhase >= 2 ? '✓ Precio bloqueado' : <>Desbloquear precio a {fmt(currentPrice)}</>}
          </button>
        </>
      )
    } else {
      boxed = (
        <div className="flex items-center gap-2.5 rounded-2xl mt-3.5" style={{ background: '#F3F2EF', border: '1px solid #E7E5DF', padding: '12px 14px' }}>
          <span className="w-4 h-4 rounded-full border-2 shrink-0" style={{ borderColor: '#BDBAB2' }} />
          <p className="text-[13px]" style={{ color: '#8A8780' }}>Toca un precio para anclar tu interés</p>
        </div>
      )
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {/* En canAccept el slider sobra: el precio ya está elegido y lo único que
          toca es activarlo. Mostrarlo invita a re-anclar y compite con la CTA. */}
      {detents.length > 0 && !canAccept && (
        <GropoTargetSlider
          detents={detents}
          curIdx={curIdx}
          selIdx={selIdx}
          onSelIdx={setSelIdx}
          onCommit={onCommitAnchor}
          minIdx={curIdx}
          disabled={sliderDisabled || lockPhase > 0}
          locked={lockPhase > 0}
          size="mini"
          chrome="none"
          anchorMode
          hideThumb={noSelection && lockPhase === 0}
          pulse={complete ? undefined : pulse}
          glow={complete ? 0 : glow}
        />
      )}

      {useBoxed ? (
        boxed
      ) : (
        <>
          {statusLine && <div className="mt-1.5">{statusLine}</div>}
          {children}
          <div className="mt-3.5">{primary}</div>
        </>
      )}

      {modal && mine && (
        <PulseAcceptModal
          groupId={groupId}
          productName={productName}
          tierPrice={mine.tier_price}
          quantity={mine.quantity}
          onClose={() => { setModal(false); setLockPhase(0); refresh() }}
        />
      )}
    </div>
  )
}

function MedalIcon({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto', marginTop: 1 }} aria-hidden="true">
      <path d="M7.5 3.5 10 8M16.5 3.5 14 8" />
      <circle cx="12" cy="14.5" r="5.5" />
      <path d="M12 12v2.5l1.6 1" />
    </svg>
  )
}

function Dot({ color }: { color: string }) {
  return (
    <span className="relative flex w-2 h-2">
      <span className="absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping" style={{ background: color }} />
      <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: color }} />
    </span>
  )
}

function Cta({ color, soft, disabled, onClick, children }: {
  color: string; soft?: boolean; disabled?: boolean; onClick?: (e: React.MouseEvent) => void; children: React.ReactNode
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex items-center justify-center w-full rounded-[11px] py-[13px] text-sm font-bold tracking-wide min-h-[46px] transition-[filter] hover:brightness-95 disabled:opacity-60"
      style={
        soft
          ? { backgroundColor: `${color}12`, color, border: `1px solid ${color}2E` }
          : { backgroundColor: color, color: '#fff' }
      }
    >
      {children}
    </button>
  )
}
