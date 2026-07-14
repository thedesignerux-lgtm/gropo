'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTierDemand } from '@/hooks/useTierDemand'
import { useCheckout } from '@/components/checkout/CheckoutProvider'
import { createClient } from '@/lib/supabase-browser'

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
  closesAt: string
}

const AVATAR_LETTERS = ['A', 'B', 'C']

export default function GroupRightSidebar({
  groupId, name, spec, imageUrl, pvp, tiers,
}: Props) {
  const { tiers: demandTiers, currentPrice, nextTier, missing } = useTierDemand(groupId)
  const displayPrice = currentPrice > 0 ? currentPrice : (tiers.length > 0 ? Math.max(...tiers.map(t => t.price)) : 0)

  const totalParticipants = demandTiers.length > 0 ? Math.max(...demandTiers.map(t => t.demand)) : 0

  // ── Stepper: PVP + tramos de más caro a más barato
  const journeyPoints = useMemo(() => {
    const source = demandTiers.length > 0
      ? demandTiers.map(t => ({ price: t.price, unlocked: t.unlocked }))
      : tiers.map(t => ({ price: t.price, unlocked: t.price >= displayPrice }))
    return [...source]
      .sort((a, b) => b.price - a.price)
      .filter((t, i, arr) => i === 0 || t.price !== arr[i - 1].price)
  }, [demandTiers, tiers, displayPrice])

  const currentIdx = journeyPoints.findIndex(p => p.price === displayPrice)
  const totalPoints = journeyPoints.length + 1
  const progressPct = currentIdx >= 0 && totalPoints > 1
    ? ((currentIdx + 1) / (totalPoints - 1)) * 100
    : 0

  // ── Opciones del selector de máximo
  const tierOptions = useMemo(() => {
    const sorted = [...tiers].sort((a, b) => b.price - a.price)
    return sorted.filter(t => t.price <= displayPrice).map(t => {
      const dt = demandTiers.find(d => d.price === t.price)
      const demand = dt?.demand ?? 0
      const unlocked = dt?.unlocked ?? (t.price >= displayPrice)
      return { price: t.price, minUnits: t.minUnits, missing: Math.max(0, t.minUnits - demand), unlocked }
    })
  }, [tiers, displayPrice, demandTiers])

  const [selectedPrice, setSelectedPrice] = useState<number>(displayPrice)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (displayPrice > 0 && !tierOptions.find(t => t.price === selectedPrice)) {
      setSelectedPrice(displayPrice)
    }
  }, [displayPrice, tierOptions, selectedPrice])

  const effectiveSelected = selectedPrice || displayPrice
  const selectedOption = tierOptions.find(t => t.price === effectiveSelected)
  const isEsperar = effectiveSelected < displayPrice

  // Auth + checkout
  const { open } = useCheckout()
  const router = useRouter()
  const [authed, setAuthed] = useState<boolean | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setAuthed(!!user))
  }, [])

  const ctaParams = new URLSearchParams()
  if (isEsperar) {
    ctaParams.set('mode', 'esperar')
    ctaParams.set('target', String(effectiveSelected))
  }
  if (quantity > 1) ctaParams.set('qty', String(quantity))
  const ctaHref = `/grupo/${groupId}/unirme${ctaParams.toString() ? `?${ctaParams.toString()}` : ''}`

  const handleBuy = () => {
    if (isEsperar) {
      router.push(ctaHref)
    } else if (authed) {
      open({ groupId, productName: name, productSpec: spec, imageUrl, quantity, maxPricePerUnit: effectiveSelected })
    } else {
      router.push(ctaHref)
    }
  }

  const avatarCount = Math.min(totalParticipants, AVATAR_LETTERS.length)
  const extraCount = totalParticipants - avatarCount

  return (
    <aside className="w-[380px] flex-shrink-0 sticky top-[24px]">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] p-6">

        {/* ── Precio actual + siguiente ── */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.12em] mb-1">Precio actual</p>
            <span className="text-4xl font-extrabold leading-none text-neutral-900 tabular-nums">{fmt(displayPrice)}</span>
          </div>
          {nextTier && (
            <div className="text-right">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.12em] mb-1">Siguiente</p>
              <span className="text-2xl font-extrabold text-brand tabular-nums">{fmt(nextTier.price)}</span>
            </div>
          )}
        </div>

        {/* ── Stepper PVP → HECHO → AHORA → META ── */}
        {journeyPoints.length > 0 && (
          <div className="relative mt-5 mb-4">
            <div className="absolute left-2 right-2 top-[26px] h-[3px] bg-brand/15 rounded-full" />
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
                const isSel = pt.price === effectiveSelected
                const label = isCurrent ? 'HECHO' : isNext ? 'AHORA' : isLast ? 'META' : ''

                return (
                  <div key={pt.price} className="flex flex-col items-center gap-1" style={{ width: 40 }}>
                    <span className={`text-[10px] font-bold uppercase tracking-wide h-3 ${isCurrent || isNext ? 'text-brand' : 'text-neutral-400'}`}>
                      {label}
                    </span>
                    <div className="relative w-5 h-5">
                      {isSel && <span className="absolute -inset-1.5 rounded-full ring-2 ring-brand/40" />}
                      {pt.unlocked ? (
                        <div className="relative w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
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

        {/* ── Faltan X ── */}
        {nextTier && missing > 0 && (
          <p className="text-sm text-neutral-600 mb-4">
            Faltan <span className="font-bold text-brand">{missing} unidad{missing !== 1 ? 'es' : ''}</span> para bajar a{' '}
            <span className="font-bold text-brand">{fmt(nextTier.price)}</span>.
          </p>
        )}
        {!nextTier && demandTiers.length > 0 && (
          <p className="text-sm font-semibold text-green-700 mb-4">
            Mejor precio desbloqueado — el máximo descuento posible.
          </p>
        )}

        {/* ── Avatares + personas ── */}
        {totalParticipants > 0 && (
          <div className="flex items-center justify-between">
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

        <div className="border-t border-neutral-100 my-5" />

        {/* ── Selector de máximo ── */}
        <h2 className="text-lg font-bold text-neutral-900 mb-3">¿Cuál es el máximo que pagarías?</h2>

        {tierOptions.length > 1 ? (
          <div className="bg-neutral-100 rounded-2xl p-1.5 flex gap-1">
            {tierOptions.map((opt) => {
              const isSelected = effectiveSelected === opt.price
              return (
                <button
                  key={opt.price}
                  type="button"
                  onClick={() => setSelectedPrice(opt.price)}
                  className={`flex-1 py-3 rounded-xl text-base font-bold tabular-nums transition-all ${
                    isSelected ? 'bg-brand text-white shadow-md' : 'text-neutral-700 hover:bg-white/60'
                  }`}
                >
                  {fmt(opt.price)}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="bg-neutral-100 rounded-2xl px-5 py-3 text-base font-bold text-neutral-900 tabular-nums">
            {fmt(displayPrice)}
          </div>
        )}

        {/* Estado del tope elegido */}
        {selectedOption && (
          <div className="flex items-center gap-2 mt-3">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedOption.unlocked ? 'bg-green-500' : 'bg-orange-400'}`} />
            <p className="text-sm text-neutral-600">
              Tope actual: <span className="font-bold text-neutral-900">{fmt(selectedOption.price)}</span>
              {' · '}
              {selectedOption.unlocked ? 'Desbloqueado' : `Faltan ${selectedOption.missing} compras`}
            </p>
          </div>
        )}

        {/* ── Cantidad + CTA ── */}
        <div className="flex items-center gap-3 mt-5">
          <div className="inline-flex items-center rounded-xl border border-neutral-200 flex-shrink-0">
            <button
              type="button"
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="flex h-12 w-11 items-center justify-center text-lg text-neutral-700 disabled:text-neutral-300"
              aria-label="Menos"
            >
              −
            </button>
            <span className="w-7 text-center text-base font-semibold tabular-nums text-neutral-900">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(q => Math.min(10, q + 1))}
              disabled={quantity >= 10}
              className="flex h-12 w-11 items-center justify-center text-lg text-neutral-700 disabled:text-neutral-300"
              aria-label="Más"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={handleBuy}
            className="flex-1 h-12 rounded-xl bg-brand text-white font-semibold text-[13px] hover:bg-brand-dark active:scale-[0.98] transition-all whitespace-nowrap"
          >
            Bloquear precio · Máx. {fmt(effectiveSelected)}
          </button>
        </div>

        <p className="text-xs text-neutral-400 text-center mt-3">Pago 100% seguro con Stripe</p>
      </div>
    </aside>
  )
}
