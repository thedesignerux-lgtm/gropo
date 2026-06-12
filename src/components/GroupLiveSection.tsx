'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import { supabase } from '@/lib/supabase'
import { getStepPricing } from '@/lib/mock-data'
import type { Tier } from '@/lib/mock-data'
import GroupCountdown from './GroupCountdown'
import JoinModal from './JoinModal'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

function TierBar({ tiers, currentTierIndex }: { tiers: Tier[]; currentTierIndex: number }) {
  return (
    <div className="flex items-center w-full">
      {tiers.map((tier, i) => {
        const isCurrent = i === currentTierIndex
        const isPast = i < currentTierIndex
        return (
          <Fragment key={tier.minUnits}>
            {i > 0 && (
              <div className={`flex-1 h-[3px] ${i <= currentTierIndex ? 'bg-brand' : 'bg-gray-200'}`} />
            )}
            <div className="flex flex-col items-center">
              <span className={`text-xs font-semibold leading-none mb-1.5 whitespace-nowrap ${
                isCurrent ? 'text-teal-700' : 'text-neutral-900'
              }`}>
                {Math.round(tier.price)}€
              </span>
              <div className={`w-4 h-4 rounded-full border-2 ${
                isCurrent ? 'bg-brand border-brand' : isPast ? 'bg-white border-brand' : 'bg-white border-gray-300'
              }`} />
              <span className="text-xs font-normal text-neutral-400 leading-none mt-1.5 whitespace-nowrap">
                {tier.minUnits}uds
              </span>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

export interface JoinResult {
  success: boolean
  new_total_units: number
  new_price: number
  next_price: number
}

interface Props {
  groupId: string
  name: string
  spec: string
  pvp: number
  initialBestPrice: number
  initialNextPrice: number
  initialTotalUnits: number
  bidCount: number
  tiers: Tier[]
  maxStock: number
  closesAt: string
}

export default function GroupLiveSection({
  groupId, name, spec, pvp,
  initialBestPrice, initialNextPrice, initialTotalUnits,
  bidCount, tiers, maxStock, closesAt,
}: Props) {
  const [bestPrice, setBestPrice] = useState(initialBestPrice)
  const [nextPrice, setNextPrice] = useState(initialNextPrice)
  const [totalUnits, setTotalUnits] = useState(initialTotalUnits)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    console.log('GroupLiveSection montado, groupId:', groupId)

    const channel = supabase
      .channel(`group-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          console.log('Realtime evento recibido:', payload)
          const { type, payload: data } = payload.new as any
          if (type === 'member_joined' || type === 'price_dropped') {
            setBestPrice(data.new_price)
            setTotalUnits(data.total_units)
            setNextPrice(data.next_price ?? data.new_price)
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime status:', status)
      })

    return () => { supabase.removeChannel(channel) }
  }, [groupId, tiers])

  function handleJoined(result: JoinResult) {
    setBestPrice(result.new_price)
    setNextPrice(result.next_price ?? nextPrice)
    setTotalUnits(result.new_total_units)
    showToast(`¡Dentro! Precio actual: ${fmt(result.new_price)} · Somos ${result.new_total_units} uds`)
  }

  const savings = pvp > 0 ? pvp - bestPrice : 0
  const priceDrop = nextPrice < bestPrice
  const pricing = tiers.length > 0 ? getStepPricing(tiers, totalUnits) : null
  const currentTierIndex = pricing ? tiers.findIndex(t => t.minUnits === pricing.currentTierMinUnits) : -1
  const hasNextTier = pricing?.nextTier != null
  const unitsToNext = pricing?.unitsToNext ?? 0

  return (
    <>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-green-600 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg whitespace-nowrap">
          {toast}
        </div>
      )}

      <div style={{ padding: '8px 16px' }}>
        {/* Name + spec */}
        <div style={{ marginBottom: 6 }}>
          <h1 className="text-xl font-bold text-neutral-900 leading-tight" style={{ marginBottom: 2 }}>{name}</h1>
          {spec && <p className="text-base font-normal text-neutral-500">{spec}</p>}
        </div>

        {/* Price + badge + PVP */}
        <div style={{ marginBottom: 6 }}>
          <div className="flex items-center justify-between gap-2" style={{ marginBottom: 2 }}>
            <span
              className="text-3xl font-bold text-teal-700 leading-none"
              style={{ transition: 'all 300ms ease' }}
            >
              {fmt(bestPrice)}
            </span>
            {savings > 0.01 && (
              <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-semibold px-3.5 py-2 rounded-full flex-shrink-0">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                Ahorras {fmt(savings)} vs PVP
              </span>
            )}
          </div>
          {pvp > 0 && (
            <p className="text-base font-normal text-neutral-400 line-through">{`PVP ${fmt(pvp)}`}</p>
          )}
        </div>

        {/* Tier bar */}
        {tiers.length >= 2 && (
          <div style={{ marginBottom: 6 }}>
            <p className="text-xs font-semibold uppercase text-neutral-400 tracking-widest" style={{ marginBottom: 6 }}>
              Tramos de precio
            </p>
            <TierBar tiers={tiers} currentTierIndex={currentTierIndex} />
          </div>
        )}

        {/* Orange box */}
        {(priceDrop || hasNextTier) && (
          <div className="bg-[#FFF3ED] rounded-xl" style={{ marginBottom: 6, padding: '6px 12px' }}>
            <p className="text-sm font-normal text-orange-600">
              {priceDrop
                ? `Solo 1 más: Próximo precio ${fmt(nextPrice)}`
                : `A ${unitsToNext} ${unitsToNext === 1 ? 'unidad' : 'uds'} del siguiente tramo`}
            </p>
          </div>
        )}

        {/* Metrics bar */}
        <div className="border-t border-[#EEEEEE]">
          <div className="flex divide-x divide-[#EEEEEE]" style={{ padding: '8px 0' }}>
            {/* Col 1 — Stock */}
            <div className="flex-1 flex flex-col items-center gap-1 px-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 flex-shrink-0">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <polyline points="12 3 20 7.5 20 16.5 12 21 4 16.5 4 7.5 12 3"/>
                <line x1="12" y1="12" x2="20" y2="7.5"/>
                <line x1="12" y1="12" x2="12" y2="21"/>
                <line x1="12" y1="12" x2="4" y2="7.5"/>
              </svg>
              <span className="text-sm font-normal text-neutral-700 text-center leading-tight">
                {maxStock > 0 ? `${totalUnits} / ${maxStock} uds` : `${totalUnits} uds`}
              </span>
              <span className="text-xs text-neutral-400 text-center leading-tight">de stock</span>
            </div>

            {/* Col 2 — Sellers */}
            <div className="flex-1 flex flex-col items-center gap-1 px-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 flex-shrink-0">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <circle cx="12" cy="7" r="4"/>
                <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
              </svg>
              <span className="text-sm font-normal text-neutral-700 text-center leading-tight">
                {bidCount === 1 ? '1 vendedor' : `${bidCount} vendedores`}
              </span>
              <span className="text-xs text-neutral-400 text-center leading-tight">
                {bidCount === 1 ? 'verificado' : 'verificados'}
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

      {/* CTA */}
      <div className="sticky bottom-0 z-20 bg-white border-t border-[#EEEEEE] flex items-center gap-3 px-4 py-3">
        <button
          className="w-14 h-14 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 flex-shrink-0"
          aria-label="Guardar en favoritos"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
            <path d="M19.5 13.572l-7.5 7.428l-7.5 -7.428m0 0a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"/>
          </svg>
        </button>
        <JoinModal
          groupId={groupId}
          productName={name}
          onJoined={handleJoined}
          triggerClassName="flex-1 bg-brand text-white font-semibold text-base py-4 rounded-xl hover:bg-brand-dark active:scale-[0.98] transition-all"
        />
      </div>
    </>
  )
}
