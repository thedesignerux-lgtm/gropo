'use client'

import { useState, useEffect, Fragment } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getActivationState, getMilestones } from '@/lib/mock-data'
import type { Tier, Milestone } from '@/lib/mock-data'
import GroupCountdown from './GroupCountdown'

function fmt(n: number | undefined | null): string {
  if (n === undefined || n === null) return '—'
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

// El relleno refleja total_units sobre el eje de unidades: un hito se ilumina
// (verde) cuando total_units alcanza su umbral de unidades, NO según el tramo
// de precio. Con total_units = 0 ningún hito está alcanzado.
function TierBar({ milestones, totalUnits }: { milestones: Milestone[]; totalUnits: number }) {
  let currentIndex = -1
  milestones.forEach((m, i) => { if (totalUnits >= m.units) currentIndex = i })

  // Progreso 0 → min_execution (units del primer hito). Ancho fijo pequeño que
  // se rellena con total_units/min_execution; lleno justo al activarse.
  const activationFrac = milestones.length > 0 && milestones[0].units > 0
    ? Math.min(1, totalUnits / milestones[0].units)
    : 1

  return (
    <div className="flex items-center w-full">
      {milestones.length > 0 && (
        <div className="h-[3px] bg-gray-200 rounded-full overflow-hidden flex-shrink-0" style={{ width: 20 }}>
          <div
            className="h-full bg-brand rounded-full"
            style={{ width: `${activationFrac * 100}%`, transition: 'width 300ms ease' }}
          />
        </div>
      )}
      {milestones.map((m, i) => {
        const reached = totalUnits >= m.units
        const isCurrent = i === currentIndex
        return (
          <Fragment key={m.units}>
            {i > 0 && (() => {
              const prevUnits = milestones[i - 1].units
              const currUnits = m.units
              const span = currUnits - prevUnits
              const frac = span > 0
                ? Math.max(0, Math.min(1, (totalUnits - prevUnits) / span))
                : (totalUnits >= currUnits ? 1 : 0)
              return (
                <div className="flex-1 h-[3px] bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full"
                    style={{ width: `${frac * 100}%`, transition: 'width 300ms ease' }}
                  />
                </div>
              )
            })()}
            <div className="flex flex-col items-center">
              <span className={`text-xs font-semibold leading-none mb-1.5 whitespace-nowrap ${
                isCurrent ? 'text-teal-700' : 'text-neutral-900'
              }`}>
                {m.price % 1 === 0 ? m.price : m.price.toFixed(2).replace('.', ',')}€
              </span>
              <div className={`w-4 h-4 rounded-full border-2 ${
                reached ? 'bg-brand border-brand' : 'bg-white border-gray-300'
              }`} />
              <span className="text-xs font-normal text-neutral-400 leading-none mt-1.5 whitespace-nowrap">
                {m.units}uds
              </span>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

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
  const [bestPrice, setBestPrice] = useState(initialBestPrice)
  const [totalUnits, setTotalUnits] = useState(initialTotalUnits)

  useEffect(() => {
    console.log('GroupLiveSection montado, groupId:', groupId)
    let cancelled = false

    // Re-consulta el estado ACTUAL del grupo (total_units de la tabla +
    // precio vía compute_price) y pisa los props initial* del SSR. Así la
    // pantalla se autocorrige aunque el HTML inicial haya llegado rancio.
    async function syncFromServer() {
      const { data: g } = await supabase
        .from('groups')
        .select('total_units, current_price, next_price')
        .eq('id', groupId)
        .single()
      const { data: rpc } = await supabase.rpc('compute_price', { p_group_id: groupId })
      if (cancelled) return

      const row = Array.isArray(rpc) ? rpc[0] : (rpc as any)
      const best =
        row?.best_price != null ? Number(row.best_price)
        : g?.current_price != null ? Number(g.current_price)
        : null

      if (g?.total_units != null) setTotalUnits(Number(g.total_units))
      if (best != null) setBestPrice(best)
    }

    // 1) al montar
    syncFromServer()

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
          const eventData = payload.new as any
          if (eventData.type === 'member_joined' || eventData.type === 'price_dropped') {
            const newBest: number = eventData.payload.new_price
            setBestPrice(newBest)
            setTotalUnits(eventData.payload.total_units)
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime status:', status)
        // 2) en cada (re)conexión del canal, re-sincroniza por si el socket
        // estuvo caído y nos perdimos eventos INSERT.
        if (status === 'SUBSCRIBED') syncFromServer()
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [groupId, tiers])

  const savings = pvp > 0 ? pvp - bestPrice : 0
  const { activated, unitsToActivate, nextTier, unitsToNext } = getActivationState(tiers, totalUnits, minExecution)
  const milestones: Milestone[] = getMilestones(tiers, minExecution)

  // Mensaje naranja según el estado del grupo.
  let progressMsg: string | null = null
  if (tiers.length > 0) {
    if (!activated) {
      progressMsg = `Falta${unitsToActivate === 1 ? '' : 'n'} ${unitsToActivate} para activar el grupo a ${fmt(tiers[0].price)}`
    } else if (nextTier) {
      progressMsg = `Falta${unitsToNext === 1 ? '' : 'n'} ${unitsToNext} para bajar a ${fmt(nextTier.price)}`
    }
  }

  return (
    <>
      <div style={{ padding: '8px 16px' }}>
        {/* Name + spec */}
        <div style={{ marginBottom: 6 }}>
          <h1 className="text-xl font-bold text-neutral-900 leading-tight" style={{ marginBottom: 2 }}>{name}</h1>
          {spec && <p className="text-base font-normal text-neutral-500">{spec}</p>}
        </div>

        {/* Price + badge + PVP */}
        <div style={{ marginBottom: 6 }}>
          {!activated && (
            <p className="text-xs font-medium text-neutral-500" style={{ marginBottom: 2 }}>
              {`Precio del grupo al activarse (${minExecution} uds)`}
            </p>
          )}
          <div className="flex items-center justify-between gap-2" style={{ marginBottom: 2 }}>
            <span
              className={`text-3xl font-bold leading-none ${activated ? 'text-teal-700' : 'text-neutral-900'}`}
              style={{ transition: 'all 300ms ease' }}
            >
              {fmt(bestPrice)}
            </span>
            {savings > 0.01 && (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-3.5 py-2 rounded-full flex-shrink-0 ${
                activated ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-600'
              }`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                {`${activated ? 'Ahorras' : 'Ahorrarás'} ${fmt(savings)}`}
              </span>
            )}
          </div>
          {pvp > 0 && (
            <p className="text-base font-normal text-neutral-400 line-through">{`PVP ${fmt(pvp)}`}</p>
          )}
        </div>

        {/* Tier bar */}
        {milestones.length >= 2 && (
          <div style={{ marginBottom: 6 }}>
            <p className="text-xs font-semibold uppercase text-neutral-400 tracking-widest" style={{ marginBottom: 6 }}>
              Tramos de precio
            </p>
            <TierBar milestones={milestones} totalUnits={totalUnits} />
          </div>
        )}

        {/* Orange box */}
        {progressMsg && (
          <div className="bg-[#FFF3ED] rounded-xl" style={{ marginBottom: 6, padding: '6px 12px' }}>
            <p className="text-sm font-normal text-orange-600">{progressMsg}</p>
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
        <Link
          href={`/grupo/${groupId}/unirme`}
          className="flex-1 bg-brand text-white font-semibold text-base py-4 rounded-xl text-center hover:bg-brand-dark active:scale-[0.98] transition-all"
        >
          Unirme a la vonda
        </Link>
      </div>
    </>
  )
}
