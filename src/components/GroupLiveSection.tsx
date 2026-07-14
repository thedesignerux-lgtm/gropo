'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTierDemand } from '@/hooks/useTierDemand'
import { useCheckout } from '@/components/checkout/CheckoutProvider'
import { createClient } from '@/lib/supabase-browser'
import GroupCountdown from './GroupCountdown'
import CountdownChip from './CountdownChip'

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
  // ── Estado del flujo CTA: 'initial' (Participar, suave) → 'select' (Bloquear precio, denso)
  const [phase, setPhase] = useState<'initial' | 'select'>('initial')
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null)
  const [quantity, setQuantity] = useState(1)
  const selectorRef = useRef<HTMLDivElement | null>(null)

  // Checkout 1-Click: usuarios autenticados abren el FastCheckoutModal;
  // invitados caen al flujo /unirme actual.
  const { open } = useCheckout()
  const router = useRouter()
  const [authed, setAuthed] = useState<boolean | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setAuthed(!!user))
  }, [])

  // tier_demand hook = fuente de verdad de precio actual y participación
  const { tiers: demandTiers, currentPrice, nextTier, missing } = useTierDemand(groupId)
  const displayPrice = currentPrice > 0 ? currentPrice : initialBestPrice

  const totalParticipants = demandTiers.length > 0
    ? Math.max(...demandTiers.map(t => t.demand))
    : initialTotalUnits

  const savings = pvp > 0 ? pvp - displayPrice : 0

  // ── Puntos del stepper de precio: PVP + tramos de más caro a más barato
  const journeyPoints = useMemo(() => {
    const source = demandTiers.length > 0
      ? demandTiers.map(t => ({ price: t.price, unlocked: t.unlocked }))
      : tiers.map(t => ({ price: t.price, unlocked: t.price >= displayPrice }))
    const sorted = [...source]
      .sort((a, b) => b.price - a.price)
      .filter((t, i, arr) => i === 0 || t.price !== arr[i - 1].price)
    return sorted
  }, [demandTiers, tiers, displayPrice])

  // Índice (dentro de puntos totales, incluyendo PVP en posición 0) del precio actual
  const currentIdx = journeyPoints.findIndex(p => p.price === displayPrice)
  const totalPoints = journeyPoints.length + 1 // + PVP
  const progressPct = currentIdx >= 0 && totalPoints > 1
    ? ((currentIdx + 1) / (totalPoints - 1)) * 100
    : 0

  // ── Opciones del selector de máximo: precio actual + tramos más baratos
  const tierOptions = useMemo(() => {
    const sorted = [...tiers].sort((a, b) => b.price - a.price)
    return sorted.filter(t => t.price <= displayPrice).map(t => {
      const dt = demandTiers.find(d => d.price === t.price)
      const demand = dt?.demand ?? 0
      const unlocked = dt?.unlocked ?? (t.price >= displayPrice)
      return {
        price: t.price,
        minUnits: t.minUnits,
        missing: Math.max(0, t.minUnits - demand),
        unlocked,
      }
    })
  }, [tiers, displayPrice, demandTiers])

  // Selección efectiva: por defecto el tramo actual
  const effectiveSelected = selectedPrice ?? displayPrice
  const selectedOption = tierOptions.find(t => t.price === effectiveSelected)

  // Si el precio actual cambia (realtime) y la selección quedó por encima, resincronizar
  useEffect(() => {
    if (selectedPrice != null && selectedPrice > displayPrice) {
      setSelectedPrice(displayPrice)
    }
  }, [displayPrice, selectedPrice])

  const isEsperar = effectiveSelected < displayPrice

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
    if (selectedPrice == null) setSelectedPrice(displayPrice)
    // Scroll suave hasta el selector de máximo
    setTimeout(() => {
      selectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  const handleCheckout = () => {
    if (isEsperar) {
      router.push(ctaHref)
    } else if (authed) {
      open({
        groupId,
        productName: name,
        productSpec: spec,
        imageUrl: null,
        quantity,
        maxPricePerUnit: effectiveSelected,
      })
    } else {
      router.push(ctaHref)
    }
  }

  const handleSelectTier = (price: number) => {
    setSelectedPrice(price)
    if (phase === 'initial') setPhase('select')
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
          {/* Fila superior: precio actual + ahorro | siguiente */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.12em] mb-1">
                Precio actual
              </p>
              <div className="flex items-center gap-2.5">
                <span className="text-4xl font-extrabold leading-none text-neutral-900 tabular-nums">
                  {fmt(displayPrice)}
                </span>
                {savings > 0.01 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-green-50 text-green-700 flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                      <line x1="7" y1="7" x2="7.01" y2="7"/>
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
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.12em] mb-1">
                  Siguiente
                </p>
                <span className="text-2xl font-extrabold text-brand tabular-nums">
                  {fmt(nextTier.price)}
                </span>
              </div>
            )}
          </div>

          {/* ── STEPPER PVP → HECHO → AHORA → META ── */}
          {journeyPoints.length > 0 && (
            <div className="relative mt-5 mb-3">
              {/* Línea de fondo */}
              <div className="absolute left-2 right-2 top-[26px] h-[3px] bg-brand/15 rounded-full" />
              {/* Línea de progreso */}
              <div
                className="absolute left-2 top-[26px] h-[3px] bg-brand rounded-full transition-all duration-500"
                style={{ width: `calc((100% - 16px) * ${Math.min(progressPct, 100) / 100})` }}
              />
              <div className="relative flex justify-between">
                {/* Punto PVP */}
                <div className="flex flex-col items-center gap-1" style={{ width: 40 }}>
                  <span className="text-[10px] font-bold text-brand uppercase tracking-wide h-3">PVP</span>
                  <div className="w-5 h-5 rounded-full bg-white border-2 border-neutral-200" />
                  <span className="text-sm font-semibold text-neutral-400 line-through tabular-nums">{fmt(pvp)}</span>
                </div>

                {journeyPoints.map((pt, i) => {
                  const isCurrent = pt.price === displayPrice
                  const isNext = nextTier != null && pt.price === nextTier.price
                  const isLast = i === journeyPoints.length - 1
                  const isSelected = phase === 'select' && pt.price === effectiveSelected

                  const label = isCurrent ? 'HECHO' : isNext ? 'AHORA' : isLast ? 'META' : ''

                  return (
                    <div key={pt.price} className="flex flex-col items-center gap-1" style={{ width: 40 }}>
                      <span className={`text-[10px] font-bold uppercase tracking-wide h-3 ${
                        isCurrent || isNext ? 'text-brand' : 'text-neutral-400'
                      }`}>
                        {label}
                      </span>
                      <div className="relative w-5 h-5">
                        {/* Halo de selección */}
                        {isSelected && (
                          <>
                            <span className="absolute -inset-1.5 rounded-full bg-brand/30 animate-ping" />
                            <span className="absolute -inset-1.5 rounded-full ring-2 ring-brand/40" />
                          </>
                        )}
                        {pt.unlocked ? (
                          <div className="relative w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </div>
                        ) : isNext ? (
                          <div className="relative w-5 h-5 rounded-full bg-white border-[3px] border-brand" />
                        ) : (
                          <div className="relative w-5 h-5 rounded-full bg-brand/15" />
                        )}
                      </div>
                      <span className={`text-sm tabular-nums ${
                        isCurrent ? 'font-bold text-neutral-900'
                        : isNext ? 'font-bold text-brand'
                        : 'font-semibold text-neutral-500'
                      }`}>
                        {fmt(pt.price)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Faltan X unidades */}
          {nextTier && missing > 0 && (
            <p className="text-sm text-neutral-600 mb-3">
              Faltan <span className="font-bold text-brand">{missing} unidades</span> para bajar a{' '}
              <span className="font-bold text-brand">{fmt(nextTier.price)}</span>.
            </p>
          )}
          {!nextTier && demandTiers.length > 0 && (
            <p className="text-sm font-semibold text-green-700 mb-3">
              Mejor precio desbloqueado — el máximo descuento posible.
            </p>
          )}

          {/* Avatares + personas */}
          {totalParticipants > 0 && (
            <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
              <div className="flex items-center -space-x-1.5">
                {AVATAR_LETTERS.slice(0, avatarCount).map((letter) => (
                  <div
                    key={letter}
                    className="w-7 h-7 rounded-full bg-brand/10 border-2 border-white flex items-center justify-center text-[11px] font-bold text-brand"
                  >
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

        {/* ── SELECTOR DE MÁXIMO ── */}
        {tierOptions.length > 1 && (
          <div ref={selectorRef} className="mb-5 scroll-mt-4">
            <h2 className="text-lg font-bold text-neutral-900 mb-1">¿Cuál es el máximo que pagarías?</h2>
            <p className="text-sm text-neutral-500 mb-4">
              Nunca pagarás más de lo que elijas. Si el precio baja, pagas menos automáticamente.
            </p>

            {/* Pills segmentadas */}
            <div className="bg-neutral-100 rounded-2xl p-1.5 flex gap-1">
              {tierOptions.map((opt) => {
                const isSelected = effectiveSelected === opt.price
                return (
                  <button
                    key={opt.price}
                    type="button"
                    onClick={() => handleSelectTier(opt.price)}
                    className={`flex-1 py-3 rounded-xl text-base font-bold tabular-nums border-2 transition-all ${
                      isSelected
                        ? 'bg-white border-brand text-neutral-900 shadow-sm'
                        : 'border-transparent text-neutral-700 hover:bg-white/60'
                    }`}
                  >
                    {fmt(opt.price)}
                  </button>
                )
              })}
            </div>

            {/* Estado del tope elegido */}
            {selectedOption && (
              <div className="flex items-center gap-2 mt-3 px-1">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  selectedOption.unlocked ? 'bg-green-500' : 'bg-orange-400'
                }`} />
                <p className="text-sm text-neutral-600">
                  Tope actual: <span className="font-bold text-neutral-900">{fmt(selectedOption.price)}</span>
                  {' · '}
                  {selectedOption.unlocked
                    ? 'Desbloqueado'
                    : `Faltan ${selectedOption.missing} compras`}
                </p>
              </div>
            )}
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
                <polyline points="12 3 20 7.5 20 16.5 12 21 4 16.5 4 7.5 12 3"/>
                <line x1="12" y1="12" x2="20" y2="7.5"/>
                <line x1="12" y1="12" x2="12" y2="21"/>
                <line x1="12" y1="12" x2="4" y2="7.5"/>
              </svg>
              <span className="text-sm font-normal text-neutral-700 text-center leading-tight">
                {maxStock > 0 ? `${totalParticipants} / ${maxStock} uds` : `${totalParticipants} uds`}
              </span>
              <span className="text-xs text-neutral-400 text-center leading-tight">en el grupo</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-1 px-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 flex-shrink-0">
                <circle cx="12" cy="7" r="4"/>
                <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
              </svg>
              <span className="text-sm font-normal text-neutral-700 text-center leading-tight">
                Vendedor verificado
              </span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-1 px-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600 flex-shrink-0">
                <circle cx="12" cy="12" r="9"/>
                <polyline points="12 7 12 12 15 15"/>
              </svg>
              <GroupCountdown closesAt={closesAt} minimal />
            </div>
          </div>
        </div>
      </div>

      {/* ── BARRA STICKY: cantidad + CTA en dos fases ── */}
      <div className="sticky bottom-16 z-20 bg-white border-t border-[#EEEEEE] px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Stepper de cantidad */}
          <div className="inline-flex items-center rounded-xl border border-neutral-200 flex-shrink-0">
            <button
              type="button"
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="flex h-12 w-10 items-center justify-center text-lg text-neutral-700 disabled:text-neutral-300"
              aria-label="Menos"
            >
              −
            </button>
            <span className="w-6 text-center text-base font-semibold tabular-nums text-neutral-900">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(q => Math.min(10, q + 1))}
              disabled={quantity >= 10}
              className="flex h-12 w-10 items-center justify-center text-lg text-neutral-700 disabled:text-neutral-300"
              aria-label="Más"
            >
              +
            </button>
          </div>

          {/* CTA */}
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
              className="flex-1 h-12 rounded-xl bg-brand text-white font-semibold text-[15px] hover:bg-brand-dark active:scale-[0.98] transition-all whitespace-nowrap"
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
