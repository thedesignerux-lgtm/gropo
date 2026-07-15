'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTierDemand } from '@/hooks/useTierDemand'
import { useCheckout } from '@/components/checkout/CheckoutProvider'
import { createClient } from '@/lib/supabase-browser'
import VondaTargetSlider, { type Detent } from '@/components/VondaTargetSlider'

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
  groupId, name, spec, imageUrl, tiers,
}: Props) {
  const { tiers: demandTiers, currentPrice, nextTier, missing } = useTierDemand(groupId)
  const displayPrice = currentPrice > 0 ? currentPrice : (tiers.length > 0 ? Math.max(...tiers.map(t => t.price)) : 0)
  const totalParticipants = demandTiers.length > 0 ? Math.max(...demandTiers.map(t => t.demand)) : 0

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

  // Si el usuario no ha tocado el slider, sigue al precio actual (realtime)
  useEffect(() => {
    if (!touchedRef.current) setSelIdx(curIdx)
  }, [curIdx])
  useEffect(() => {
    if (selIdx > detents.length - 1) setSelIdx(curIdx)
  }, [detents.length, selIdx, curIdx])

  const handleSelIdx = (i: number) => { touchedRef.current = true; setSelIdx(i) }

  const selectedPrice = detents[selIdx]?.price ?? displayPrice
  const confirmed = selIdx <= curIdx
  const isEsperar = !confirmed

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
    ctaParams.set('target', String(selectedPrice))
  }
  if (quantity > 1) ctaParams.set('qty', String(quantity))
  const ctaHref = `/grupo/${groupId}/unirme${ctaParams.toString() ? `?${ctaParams.toString()}` : ''}`

  const handleBuy = () => {
    if (isEsperar) {
      router.push(ctaHref)
    } else if (authed) {
      open({ groupId, productName: name, productSpec: spec, imageUrl, quantity, maxPricePerUnit: selectedPrice })
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

        {/* ── Avatares + personas ── */}
        {totalParticipants > 0 && (
          <div className="flex items-center justify-between mt-4">
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

        {/* ── Target slider (reemplaza stepper + selector) ── */}
        {detents.length > 1 ? (
          <VondaTargetSlider
            detents={detents}
            curIdx={curIdx}
            selIdx={selIdx}
            onSelIdx={handleSelIdx}
            size="full"
            showChrome
            udsToNext={missing}
          />
        ) : (
          <div className="text-lg font-bold text-neutral-900">{fmt(displayPrice)}</div>
        )}

        {/* ── Cantidad + CTA ── */}
        <div className="flex items-center gap-3 mt-5">
          <div className="inline-flex items-center rounded-xl border border-neutral-200 flex-shrink-0">
            <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}
              className="flex h-12 w-11 items-center justify-center text-lg text-neutral-700 disabled:text-neutral-300" aria-label="Menos">−</button>
            <span className="w-7 text-center text-base font-semibold tabular-nums text-neutral-900">{quantity}</span>
            <button type="button" onClick={() => setQuantity(q => Math.min(10, q + 1))} disabled={quantity >= 10}
              className="flex h-12 w-11 items-center justify-center text-lg text-neutral-700 disabled:text-neutral-300" aria-label="Más">+</button>
          </div>

          <button
            type="button"
            onClick={handleBuy}
            className="flex-1 h-12 rounded-xl font-semibold text-[13px] active:scale-[0.98] transition-all whitespace-nowrap text-white"
            style={{ background: confirmed ? '#6C4BF4' : '#E8944A' }}
          >
            {confirmed ? `Bloquear precio · Máx. ${fmt(selectedPrice)}` : `Reservar plaza · Máx. ${fmt(selectedPrice)}`}
          </button>
        </div>

        <p className="text-xs text-neutral-400 text-center mt-3">Pago 100% seguro con Stripe</p>
      </div>
    </aside>
  )
}
