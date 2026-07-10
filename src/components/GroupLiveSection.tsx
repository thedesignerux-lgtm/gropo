'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTierDemand } from '@/hooks/useTierDemand'
import { useCheckout } from '@/components/checkout/CheckoutProvider'
import { createClient } from '@/lib/supabase-browser'
import GroupCountdown from './GroupCountdown'
import JoinModeSelector, { type ProjectionResult } from '@/components/JoinModeSelector'
import TierDemandLadder from '@/components/TierDemandLadder'
import FavoriteButton from '@/components/FavoriteButton'
import ProgressToNextPrice from '@/components/ProgressToNextPrice'
import WaveProgress from '@/components/WaveProgress'

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

export default function GroupLiveSection({
  groupId, name, spec, pvp,
  initialBestPrice, initialTotalUnits,
  bidCount, tiers, maxStock, minExecution, closesAt,
}: Props) {
  const [joinMode, setJoinMode] = useState<'comprar' | 'esperar'>('comprar')
  const [joinTarget, setJoinTarget] = useState<number | undefined>(undefined)
  const [quantity, setQuantity] = useState(1)
  const [projection, setProjection] = useState<ProjectionResult | null>(null)

  // Checkout 1-Click (Gate A3): usuarios autenticados abren el FastCheckoutModal;
  // invitados caen al flujo /unirme actual. Auth se comprueba al montar.
  const { open } = useCheckout()
  const router = useRouter()
  const [authed, setAuthed] = useState<boolean | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setAuthed(!!user))
  }, [])

  // tier_demand hook = source of truth for current price AND participation count
  const { tiers: demandTiers, currentPrice, nextTier, missing } = useTierDemand(groupId)

  // Use currentPrice from tier_demand if available, else initial
  const displayPrice = currentPrice > 0 ? currentPrice : initialBestPrice

  // Total participants = demand at the cheapest tier (includes ALL members)
  const totalParticipants = demandTiers.length > 0
    ? Math.max(...demandTiers.map(t => t.demand))
    : initialTotalUnits

  const savings = pvp > 0 ? pvp - displayPrice : 0

  const handleProjection = useCallback((result: ProjectionResult | null) => {
    setProjection(result)
  }, [])

  const ctaPrice = projection ? projection.price : displayPrice

  // Build CTA href with all params (qty, mode, target)
  const ctaParams = new URLSearchParams()
  if (joinMode === 'esperar' && joinTarget) {
    ctaParams.set('mode', 'esperar')
    ctaParams.set('target', String(joinTarget))
  }
  if (quantity > 1) ctaParams.set('qty', String(quantity))
  const ctaHref = `/grupo/${groupId}/unirme${ctaParams.toString() ? `?${ctaParams.toString()}` : ''}`

  // Comprar/bloquear: logueado → modal 1-Click; invitado → /unirme.
  const handleBuy = () => {
    if (authed) {
      open({
        groupId,
        productName: name,
        productSpec: spec,
        imageUrl: null,
        quantity,
        maxPricePerUnit: ctaPrice,
      })
    } else {
      router.push(ctaHref)
    }
  }

  return (
    <>
      <div style={{ padding: '8px 16px' }}>
        {/* Name + bookmark */}
        <div style={{ marginBottom: 6 }}>
          <div className="flex items-start justify-between gap-2" style={{ marginBottom: 2 }}>
            <h1 className="text-xl font-bold text-neutral-900 leading-tight flex-1">{name}</h1>
            <FavoriteButton groupId={groupId} size={22} className="flex-shrink-0 mt-0.5" />
          </div>
          {spec && <p className="text-base font-normal text-neutral-500">{spec}</p>}
        </div>

        {/* Price + badge + PVP */}
        <div style={{ marginBottom: 6 }}>
          <div className="flex items-center justify-between gap-2" style={{ marginBottom: 2 }}>
            <span
              className="text-3xl font-bold leading-none text-neutral-900"
              style={{ transition: 'all 300ms ease' }}
            >
              {fmt(displayPrice)}
            </span>
            {savings > 0.01 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-3.5 py-2 rounded-full flex-shrink-0 bg-green-50 text-green-700">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                Ahorras {fmt(savings)}
              </span>
            )}
          </div>
          {pvp > 0 && (
            <p className="text-base font-normal text-neutral-400 line-through">{`PVP ${fmt(pvp)}`}</p>
          )}
        </div>

        {/* Progress to next price — now reacts to selected quantity */}
        <div style={{ marginBottom: 6 }}>
          <ProgressToNextPrice
            currentPrice={displayPrice}
            nextTier={nextTier}
            missing={missing}
            selectedQuantity={quantity}
          />
        </div>

        {/* Tier demand ladder */}
        <div style={{ marginBottom: 6 }}>
          {demandTiers.length > 0 ? (
            <TierDemandLadder tiers={demandTiers} currentPrice={displayPrice} />
          ) : (
            <TierDemandLadder groupId={groupId} />
          )}
        </div>

        {/* How it works note */}
        <div className="bg-neutral-50 rounded-xl p-3" style={{ marginBottom: 6 }}>
          <p className="text-xs text-neutral-500">
            El precio baja a medida que se unen más compradores. Cuantos más seáis, menos paga cada uno.
          </p>
        </div>

        {/* Wave progress */}
        <div style={{ marginBottom: 6 }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-neutral-500 font-medium">Progreso del grupo</span>
            <span className="text-xs text-neutral-400">{totalParticipants} / {maxStock > 0 ? maxStock : '∞'} uds</span>
          </div>
          <WaveProgress current={totalParticipants} max={maxStock > 0 ? maxStock : totalParticipants * 2} height={20} />
        </div>

        {/* Metrics bar */}
        <div className="border-t border-[#EEEEEE]">
          <div className="flex divide-x divide-[#EEEEEE]" style={{ padding: '8px 0' }}>
            {/* Col 1 — Participantes */}
            <div className="flex-1 flex flex-col items-center gap-1 px-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 flex-shrink-0">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
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

            {/* Col 2 — Sellers */}
            <div className="flex-1 flex flex-col items-center gap-1 px-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 flex-shrink-0">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <circle cx="12" cy="7" r="4"/>
                <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
              </svg>
              <span className="text-sm font-normal text-neutral-700 text-center leading-tight">
                Vendedor verificado
              </span>
            </div>

            {/* Col 3 — Live countdown */}
            <div className="flex-1 flex flex-col items-center gap-1 px-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600 flex-shrink-0">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <circle cx="12" cy="12" r="9"/>
                <polyline points="12 7 12 12 15 15"/>
              </svg>
              <GroupCountdown closesAt={closesAt} minimal />
            </div>
          </div>
        </div>
      </div>

      {/* Join mode selector */}
      {tiers.length > 1 && (
        <div className="px-4 pb-2">
          <JoinModeSelector
            groupId={groupId}
            tiers={tiers}
            currentPrice={displayPrice}
            totalUnits={totalParticipants}
            quantity={quantity}
            demandTiers={demandTiers}
            onChange={(m, tp) => { setJoinMode(m); setJoinTarget(tp) }}
            onProjection={handleProjection}
          />
        </div>
      )}

      {/* Sticky bottom: quantity + projection banner + CTA */}
      <div className="sticky bottom-0 z-20 bg-white border-t border-[#EEEEEE] px-4 py-3">
        {/* Quantity selector */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-neutral-700">Cantidad</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-600 hover:border-brand transition-colors"
              aria-label="Menos"
            >
              −
            </button>
            <span className="text-base font-semibold text-neutral-900 tabular-nums w-6 text-center">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(q => Math.min(10, q + 1))}
              className="w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-600 hover:border-brand transition-colors"
              aria-label="Más"
            >
              +
            </button>
          </div>
        </div>

        {/* Total estimate */}
        {quantity > 1 && (
          <p className="text-xs text-neutral-500 text-right mb-2">
            Total estimado: {fmt(ctaPrice * quantity)}
          </p>
        )}

        {/* Projection banner */}
        {projection && (
          <div className={`rounded-xl p-2.5 mb-2 text-sm ${
            projection.unlocks
              ? 'bg-green-50 text-green-700'
              : 'bg-neutral-50 text-neutral-600'
          }`}>
            {projection.unlocks ? (
              <p className="font-medium">
                Con tus {quantity} ud{quantity > 1 ? 's' : ''}, el grupo baja a {fmt(projection.price)} para todos
              </p>
            ) : (
              <p>
                Con tus {quantity} ud{quantity > 1 ? 's' : ''}, el grupo sigue en {fmt(projection.price)}
                {nextTier && <span> &middot; faltan {missing} para bajar a {fmt(nextTier.price)}</span>}
              </p>
            )}
          </div>
        )}

        {/* CTA row */}
        <div className="flex items-center gap-3">
          {joinMode === 'esperar' && joinTarget ? (
            <Link
              href={ctaHref}
              className="flex-1 bg-brand text-white font-semibold text-base py-4 rounded-xl text-center hover:bg-brand-dark active:scale-[0.98] transition-all"
            >
              Reservar plaza · {fmt(joinTarget)} máx.
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleBuy}
              className="flex-1 bg-brand text-white font-semibold text-base py-4 rounded-xl text-center hover:bg-brand-dark active:scale-[0.98] transition-all"
            >
              Bloquear precio · {fmt(ctaPrice)}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
