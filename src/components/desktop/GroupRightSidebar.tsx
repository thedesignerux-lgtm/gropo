'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTierDemand, type TierRow } from '@/hooks/useTierDemand'
import { useCheckout } from '@/components/checkout/CheckoutProvider'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'

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

export default function GroupRightSidebar({
  groupId, name, spec, imageUrl, pvp, tiers, maxStock, closesAt,
}: Props) {
  const { tiers: demandTiers, currentPrice, nextTier, missing } = useTierDemand(groupId)
  const displayPrice = currentPrice > 0 ? currentPrice : (tiers.length > 0 ? Math.max(...tiers.map(t => t.price)) : 0)
  const isBestPrice = !nextTier

  // Tier options: current price + all cheaper tiers (past tiers above current hidden)
  const tierOptions = useMemo(() => {
    const sorted = [...tiers].sort((a, b) => b.price - a.price)
    return sorted.filter(t => t.price <= displayPrice).map(t => {
      const dt = demandTiers.find(d => d.price === t.price)
      const demand = dt?.demand ?? 0
      const unlocked = dt?.unlocked ?? (t.price >= displayPrice)
      const realMissing = Math.max(0, t.minUnits - demand)
      const isLast = t.price === Math.min(...tiers.map(x => x.price))
      return { price: t.price, minUnits: t.minUnits, missing: realMissing, isLast, unlocked }
    })
  }, [tiers, displayPrice, demandTiers])

  const [selectedPrice, setSelectedPrice] = useState<number>(displayPrice)
  const [quantity, setQuantity] = useState(1)

  // Keep selectedPrice in sync when currentPrice changes
  useEffect(() => {
    if (displayPrice > 0 && !tierOptions.find(t => t.price === selectedPrice)) {
      setSelectedPrice(displayPrice)
    }
  }, [displayPrice, tierOptions, selectedPrice])

  // Determine mode from selection
  const isEsperar = selectedPrice < displayPrice
  const joinMode = isEsperar ? 'esperar' : 'comprar'

  // Does selecting this qty unlock the next tier?
  const selectedOption = tierOptions.find(t => t.price === selectedPrice)
  const wouldUnlock = selectedOption && selectedOption.missing > 0 && quantity >= selectedOption.missing

  // Auth check + checkout
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
      // Esperadores siempre van al flujo completo
      router.push(ctaHref)
    } else if (authed) {
      open({
        groupId,
        productName: name,
        productSpec: spec,
        imageUrl,
        quantity,
        maxPricePerUnit: displayPrice,
      })
    } else {
      router.push(ctaHref)
    }
  }

  return (
    <aside className="w-[380px] flex-shrink-0 sticky top-[80px] space-y-4">

      {/* ── PRICE SELECTOR CARD ── */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-1">¿Cuál es el máximo que pagarías?</h2>
        <p className="text-sm text-neutral-500 mb-5">
          Nunca pagarás más de lo que elijas. Si el precio baja, pagas menos automáticamente.
        </p>

        {/* Radio pills */}
        <div className="space-y-3">
          {tierOptions.map((opt) => {
            const isSelected = selectedPrice === opt.price
            const label = opt.unlocked
              ? 'Desbloqueado'
              : opt.isLast
              ? `Objetivo final (${opt.minUnits} compras)`
              : `Faltan ${opt.missing} compras`

            return (
              <button
                key={opt.price}
                type="button"
                onClick={() => setSelectedPrice(opt.price)}
                className={`w-full flex items-center justify-between px-5 py-4 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? 'border-brand bg-white'
                    : 'border-neutral-200 bg-white hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Radio dot */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'border-brand' : 'border-neutral-300'
                  }`}>
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-brand" />}
                  </div>
                  <span className="text-lg font-bold text-neutral-900">{fmt(opt.price)}</span>
                </div>
                <span className={`text-sm ${opt.unlocked ? 'text-green-600 font-semibold' : 'text-neutral-500'}`}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Context note */}
        {!isBestPrice && (
          <div className="flex items-start gap-2 mt-4 px-1">
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-1.5" />
            <p className="text-sm text-green-700 font-medium">
              Tu compra acerca al grupo al siguiente descuento.
            </p>
          </div>
        )}

        {/* Quantity + CTA */}
        <div className="flex items-center gap-3 mt-6">
          <div className="inline-flex items-center rounded-xl border border-neutral-200 flex-shrink-0">
            <button
              type="button"
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="flex h-12 w-12 items-center justify-center text-lg text-neutral-700 disabled:text-neutral-300"
            >
              −
            </button>
            <span className="w-8 text-center text-base font-semibold tabular-nums text-neutral-900">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(q => Math.min(10, q + 1))}
              disabled={quantity >= 10}
              className="flex h-12 w-12 items-center justify-center text-lg text-neutral-700 disabled:text-neutral-300"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={handleBuy}
            className="flex-1 h-12 rounded-xl bg-brand text-white font-semibold text-[13px] hover:bg-brand-dark active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            {isEsperar
              ? `Reservar (Máx. ${fmt(selectedPrice)})`
              : `Bloquear precio (Máx. ${fmt(selectedPrice)})`}
          </button>
        </div>

        <p className="text-xs text-neutral-400 text-center mt-3">Pago 100% seguro con Stripe</p>
      </div>

      {/* ── HELP LINK ── */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <Link href="/como-funciona" className="flex items-center justify-between group">
          <div>
            <span className="text-sm font-semibold text-neutral-900">¿Dudas?</span>
            <span className="text-sm text-brand ml-2 group-hover:underline">Lee cómo funciona la compra conjunta</span>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-400 group-hover:text-brand transition-colors">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </aside>
  )
}
