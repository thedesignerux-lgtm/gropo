'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTierDemand } from '@/hooks/useTierDemand'
import { useCheckout } from '@/components/checkout/CheckoutProvider'
import GroupCountdown from './GroupCountdown'
import CountdownChip from './CountdownChip'
import VondaTargetSlider, { type Detent } from '@/components/VondaTargetSlider'
import { createClient } from '@/lib/supabase-browser'

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
}

const AVATAR_LETTERS = ['A', 'B', 'C']

export default function GroupLiveSection({
  groupId, name, spec, pvp,
  initialBestPrice, initialTotalUnits,
  tiers, maxStock, closesAt,
}: Props) {
  // ── Vonda Pulse: flujo CTA en dos fases ('initial' → 'select')
  const [phase, setPhase] = useState<'initial' | 'select'>('initial')
  const [quantity, setQuantity] = useState(1)
  const sliderRef = useRef<HTMLDivElement | null>(null)

  const { open } = useCheckout()
  const router = useRouter()
  const [authed, setAuthed] = useState<boolean | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setAuthed(!!user))
  }, [])

  const { tiers: demandTiers, currentPrice, nextTier, missing } = useTierDemand(groupId)
  const displayPrice = currentPrice > 0 ? currentPrice : initialBestPrice
  const totalParticipants = demandTiers.length > 0
    ? Math.max(...demandTiers.map(t => t.demand))
    : initialTotalUnits
  const savings = pvp > 0 ? pvp - displayPrice : 0

  // ── Detents del target slider (tramos por minUnits asc = precio desc)
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

  const effectiveSelected = detents[selIdx]?.price ?? displayPrice
  const confirmed = selIdx <= curIdx
  const isEsperar = !confirmed

  const handleSelIdx = (i: number) => {
    touchedRef.current = true
    setSelIdx(i)
    if (phase === 'initial') setPhase('select')
  }

  // ── CTA
  const ctaParams = new URLSearchParams()
  if (isEsperar) {
    ctaParams.set('mode', 'esperar')
    ctaParams.set('target', String(effectiveSelected))
  }
  if (quantity > 1) ctaParams.set('qty', String(quantity))
  const ctaHref = `/grupo/${groupId}/unirme${ctaParams.toString() ? `?${ctaParams.toString()}` : ''}`

  const handleParticipate = () => {
    setPhase('select')
    setTimeout(() => {
      sliderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  const handleCheckout = () => {
    if (isEsperar) {
      router.push(ctaHref)
    } else if (authed) {
      open({ groupId, productName: name, productSpec: spec, imageUrl: null, quantity, maxPricePerUnit: effectiveSelected })
    } else {
      router.push(ctaHref)
    }
  }

  const avatarCount = Math.min(totalParticipants, AVATAR_LETTERS.length)
  const extraCount = totalParticipants - avatarCount

  return (
    <>
      <div className="px-4 pt-3 pb-2">
        {/* Chip de cierre */}
        <div className="flex mb-3">
          <CountdownChip />
        </div>

        {/* Título + spec */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-neutral-900 leading-tight">{name}</h1>
          {spec && <p className="text-sm text-neutral-500 mt-0.5">{spec}</p>}
        </div>

        {/* ── CARD DE PRECIO ── */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 mb-5">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.12em] mb-1">Precio actual</p>
              <div className="flex items-center gap-2.5">
                <span className="text-4xl font-extrabold leading-none text-neutral-900 tabular-nums">{fmt(displayPrice)}</span>
                {savings > 0.01 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-green-50 text-green-700 flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                      <line x1="7" y1="7" x2="7.01" y2="7" />
                    </svg>
                    Ahorras {fmt(savings)}
                  </span>
                )}
              </div>
              {pvp > 0 && (
                <p className="text-base text-neutral-400 line-through mt-1">{fmt(pvp)}</p>
              )}
            </div>
            {nextTier && (
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.12em] mb-1">Siguiente</p>
                <span className="text-2xl font-extrabold text-brand tabular-nums">{fmt(nextTier.price)}</span>
              </div>
            )}
          </div>

          {/* Faltan X unidades */}
          {nextTier && missing > 0 && (
            <p className="text-sm text-neutral-600 mt-3">
              Faltan <span className="font-bold text-brand">{missing} unidad{missing !== 1 ? 'es' : ''}</span> para bajar a{' '}
              <span className="font-bold text-brand">{fmt(nextTier.price)}</span>.
            </p>
          )}
          {!nextTier && demandTiers.length > 0 && (
            <p className="text-sm font-semibold text-green-700 mt-3">
              Mejor precio desbloqueado — el máximo descuento posible.
            </p>
          )}

          {/* Avatares + personas */}
          {totalParticipants > 0 && (
            <div className="flex items-center justify-between border-t border-neutral-100 pt-3 mt-3">
              <div className="flex items-center -space-x-1.5">
                {AVATAR_LETTERS.slice(0, avatarCount).map((letter) => (
                  <div key={letter} className="w-7 h-7 rounded-full bg-brand/10 border-2 border-white flex items-center justify-center text-[11px] font-bold text-brand">
                    {letter}
                  </div>
                ))}
                {extraCount > 0 && (
                  <div className="w-7 h-7 rounded-full bg-brand/10 border-2 border-white flex items-center justify-center text-[10px] font-bold text-brand">
                    +{extraCount}
                  </div>
                )}
              </div>
              <span className="text-sm text-neutral-500">
                {totalParticipants} persona{totalParticipants !== 1 ? 's' : ''} en el grupo
              </span>
            </div>
          )}
        </div>

        {/* ── TARGET SLIDER (sustituye stepper + selector) ── */}
        {detents.length > 1 && (
          <div ref={sliderRef} className="mb-5 scroll-mt-4">
            <VondaTargetSlider
              detents={detents}
              curIdx={curIdx}
              selIdx={selIdx}
              onSelIdx={handleSelIdx}
              size="full"
              showChrome
              udsToNext={missing}
            />
          </div>
        )}

        {/* ── CUANTOS MÁS, MENOS PAGAS ── */}
        <div className="mb-5">
          <h2 className="text-lg font-bold text-neutral-900 mb-1.5">Cuantos más, menos pagas</h2>
          <p className="text-sm text-neutral-500 leading-relaxed">
            Cada persona que asegura su plaza acerca el siguiente tramo y el precio baja para
            todos. No pagas hasta que el grupo cierra.
          </p>
        </div>

        {/* Barra de métricas */}
        <div className="border-t border-[#EEEEEE]">
          <div className="flex divide-x divide-[#EEEEEE] py-2">
            <div className="flex-1 flex flex-col items-center gap-1 px-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 flex-shrink-0">
                <polyline points="12 3 20 7.5 20 16.5 12 21 4 16.5 4 7.5 12 3" />
                <line x1="12" y1="12" x2="20" y2="7.5" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <line x1="12" y1="12" x2="4" y2="7.5" />
              </svg>
              <span className="text-sm font-normal text-neutral-700 text-center leading-tight">
                {maxStock > 0 ? `${totalParticipants} / ${maxStock} uds` : `${totalParticipants} uds`}
              </span>
              <span className="text-xs text-neutral-400 text-center leading-tight">en el grupo</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-1 px-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 flex-shrink-0">
                <circle cx="12" cy="7" r="4" />
                <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
              </svg>
              <span className="text-sm font-normal text-neutral-700 text-center leading-tight">Vendedor verificado</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-1 px-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600 flex-shrink-0">
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 7 12 12 15 15" />
              </svg>
              <GroupCountdown closesAt={closesAt} minimal />
            </div>
          </div>
        </div>
      </div>

      {/* ── BARRA STICKY: cantidad + CTA en dos fases (Vonda Pulse) ── */}
      <div className="sticky bottom-16 z-20 bg-white border-t border-[#EEEEEE] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-xl border border-neutral-200 flex-shrink-0">
            <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}
              className="flex h-12 w-10 items-center justify-center text-lg text-neutral-700 disabled:text-neutral-300" aria-label="Menos">−</button>
            <span className="w-6 text-center text-base font-semibold tabular-nums text-neutral-900">{quantity}</span>
            <button type="button" onClick={() => setQuantity(q => Math.min(10, q + 1))} disabled={quantity >= 10}
              className="flex h-12 w-10 items-center justify-center text-lg text-neutral-700 disabled:text-neutral-300" aria-label="Más">+</button>
          </div>

          {phase === 'initial' ? (
            <button
              type="button"
              onClick={handleParticipate}
              className="flex-1 h-12 rounded-xl bg-brand/15 text-brand font-semibold text-base active:scale-[0.98] transition-all"
            >
              Participar
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCheckout}
              className="flex-1 h-12 rounded-xl text-white font-semibold text-[15px] active:scale-[0.98] transition-all whitespace-nowrap"
              style={{ background: confirmed ? '#6C4BF4' : '#E8944A' }}
            >
              {isEsperar
                ? `Reservar plaza · Máx. ${fmt(effectiveSelected)}`
                : `Bloquear precio · Máx. ${fmt(effectiveSelected)}`}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
