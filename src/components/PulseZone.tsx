// src/components/PulseZone.tsx — VONDA PULSE v3 · Mi Radar
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

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import TierProgress, { type TierPoint, type TierVariant } from '@/components/TierProgress'
import PulseAcceptModal from '@/components/PulseAcceptModal'
import { usePulse } from '@/hooks/usePulse'

const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
const PURPLE = '#6C3CE1'
const GREEN = '#0F9D58'

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
}

export default function PulseZone({
  groupId, productName, current, tiers, variant, currentPrice, complete = false, ctaColor = '#F0531F', children,
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

  async function cancel(e: React.MouseEvent) {
    stop(e); setBusy(true); setError(null)
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

  function onSelectTier(t: TierPoint) {
    if (!markable || busy || t.price == null) return
    if (mine && myStep && t.units === myStep.units) return
    upsertPledge(t.price, qty)
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
          <span className="inline-flex items-center gap-1.5 font-bold" style={{ color: '#6D28D9' }}>
            <Dot color={PURPLE} />
            Compromiso activo · {fmt(mine.tier_price)} — 0 € hasta que haya grupo
          </span>
          <button onClick={cancel} disabled={busy} className="text-neutral-400 font-semibold hover:text-neutral-600">Quitar</button>
        </div>
      )
    } else if (mine?.status === 'watching' && !canAccept) {
      statusLine = (
        <div className="flex items-center justify-between text-[12px]">
          <span className="inline-flex items-center gap-2 font-bold" style={{ color: '#6D28D9' }}>
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
        <p className="text-[12px] text-neutral-400">
          Toca el <b style={{ color: '#6D28D9' }}>precio que esperas</b> — sin tarjeta, sin compromiso.
        </p>
      )
    }
  }

  // ── CTA primaria (UNA) + secundaria opcional ──
  let primary: React.ReactNode
  if (complete) {
    primary = <Cta color={GREEN} soft onClick={(e) => go(e, `/grupo/${groupId}`)}>Entrar al precio mínimo</Cta>
  } else if (mine?.status === 'converted') {
    primary = <Cta color={GREEN} soft onClick={(e) => go(e, '/mis-grupos')}>Precio activado · Ver en Mis grupos</Cta>
  } else if (mine?.status === 'holding') {
    primary = <Cta color={PURPLE} disabled>Activando tu precio…</Cta>
  } else if (canAccept && mine) {
    primary = (
      <>
        <Cta color={PURPLE} onClick={(e) => { stop(e); setModal(true) }}>
          Ya sois suficientes → Aceptar {fmt(mine.tier_price)}
        </Cta>
        <button
          onClick={(e) => go(e, `/grupo/${groupId}`)}
          className="w-full mt-1.5 rounded-[11px] py-2 text-[12.5px] font-bold bg-white border"
          style={{ color: ctaColor, borderColor: `${ctaColor}44` }}
        >
          Asegurar precio · {fmt(currentPrice)}
        </button>
      </>
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
    // Sin ancla: aseguras tu PLAZA al precio vigente (y bajas con el grupo)
    primary = (
      <Cta color={ctaColor} soft onClick={(e) => go(e, `/grupo/${groupId}`)}>
        Asegurar plaza · {fmt(currentPrice)}
      </Cta>
    )
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {tiers.length > 0 && (
        <TierProgress
          current={current}
          tiers={tiers}
          variant={variant}
          pulse={complete ? undefined : pulse}
          glow={complete ? 0 : glow}
          selectedUnits={selectedUnits}
          onSelectTier={markable ? onSelectTier : undefined}
        />
      )}

      {statusLine && <div className="mt-1.5">{statusLine}</div>}
      {children}
      <div className="mt-3.5">{primary}</div>

      {modal && mine && (
        <PulseAcceptModal
          groupId={groupId}
          productName={productName}
          tierPrice={mine.tier_price}
          quantity={mine.quantity}
          onClose={() => { setModal(false); refresh() }}
        />
      )}
    </div>
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
