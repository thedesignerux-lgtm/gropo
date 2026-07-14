'use client'

import { useEffect, useState } from 'react'
import { useTierDemand } from '@/hooks/useTierDemand'
import GroupCountdown from '@/components/GroupCountdown'
import TierDemandLadder from '@/components/TierDemandLadder'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

interface Tier { minUnits: number; price: number }

interface Props {
  groupId: string
  name: string
  spec: string
  imageUrl?: string | null
  pvp: number
  tiers: Tier[]
  maxStock: number
  initialBestPrice: number
  closesAt: string
}

export default function GroupCenterContent({
  groupId, name, spec, imageUrl, pvp, tiers, maxStock, initialBestPrice, closesAt,
}: Props) {
  const { tiers: demandTiers, currentPrice, nextTier, missing } = useTierDemand(groupId)
  const displayPrice = currentPrice > 0 ? currentPrice : initialBestPrice
  const isBestPrice = !nextTier
  const savings = pvp > 0 && pvp > displayPrice ? pvp - displayPrice : 0
  const totalParticipants = demandTiers.length > 0 ? Math.max(...demandTiers.map(t => t.demand)) : 0

  // Summary (firm + reserve)
  const [summary, setSummary] = useState<{ firmUnits: number; reserveUnits: number } | null>(null)
  useEffect(() => {
    fetch(`/api/group/${groupId}/summary`).then(r => r.json()).then(setSummary).catch(() => {})
  }, [groupId])

  // Badge de descuento
  const discountBadge = isBestPrice
    ? { text: 'Mejor precio alcanzado', cls: 'bg-green-50 text-green-700 border-green-200' }
    : savings > 0
    ? { text: `Ahorras ${fmt(savings)}`, cls: 'bg-green-50 text-green-700 border-green-200' }
    : { text: 'Aún sin descuento', cls: 'bg-neutral-100 text-neutral-500 border-neutral-200' }

  // Próximo descuento — pill verde
  const nextDiscountPill = nextTier && !isBestPrice
    ? `Faltan ${missing} compra${missing !== 1 ? 's' : ''} para ${fmt(nextTier.price)}`
    : null

  return (
    <div className="space-y-6">

      {/* ── HEADER CARD ── */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <div className="flex gap-5">
          {/* Product image */}
          <div className="w-[120px] h-[120px] flex-shrink-0 rounded-xl bg-[#F5F5F5] overflow-hidden flex items-center justify-center">
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neutral-300">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
              </svg>
            )}
          </div>

          {/* Product info */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">
              Compra conjunta{spec ? ` · ${spec}` : ''}
            </p>
            <h1 className="text-xl font-bold text-neutral-900 leading-tight mb-2">{name}</h1>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Grupo abierto
              </span>
              <span className="text-sm text-neutral-500">
                Cierra en <GroupCountdown closesAt={closesAt} minimal />
              </span>
            </div>
          </div>

          {/* Price block */}
          <div className="flex-shrink-0 text-right">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Precio del grupo</p>
            <div className="flex items-center gap-2.5 justify-end">
              <span className="text-4xl font-bold text-neutral-900 tabular-nums">{fmt(displayPrice)}</span>
              {savings > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-green-50 text-green-700 flex-shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                  Ahorras {fmt(savings)}
                </span>
              )}
            </div>
            {savings > 0 ? (
              <p className="text-base text-neutral-400 line-through mt-1">{fmt(pvp)}</p>
            ) : (
              <span className={`inline-flex mt-2 text-xs font-medium px-3 py-1 rounded-full border ${discountBadge.cls}`}>
                {discountBadge.text}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── PRICE LADDER ── */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Cómo baja el precio</h2>
            <p className="text-sm text-neutral-500 mt-0.5">Cuantos más compradores se unen, menor será el precio para todos.</p>
          </div>
          {nextDiscountPill && (
            <span className="flex-shrink-0 inline-flex items-center text-xs font-semibold text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
              {nextDiscountPill}
            </span>
          )}
        </div>

        {/* Reuse existing TierDemandLadder (horizontal stepper) */}
        <div className="mt-4">
          {demandTiers.length > 0 ? (
            <TierDemandLadder tiers={demandTiers} currentPrice={displayPrice} />
          ) : (
            <TierDemandLadder groupId={groupId} />
          )}
        </div>

        {/* Bottom stats row */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-100 text-sm text-neutral-500">
          <span>
            {summary
              ? `${summary.firmUnits} compras aseguradas · ${summary.reserveUnits} en espera`
              : `${totalParticipants} compras aseguradas`}
          </span>
          <span>Stock disponible: {maxStock} uds</span>
        </div>
      </div>

      {/* ── DETAILS + WHY JOIN (2 cards side by side) ── */}
      <div className="grid grid-cols-2 gap-6">
        {/* Product details */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4">Detalles del producto</h3>
          <div className="divide-y divide-neutral-100">
            {[
              { label: 'Categoría', value: 'Cubiertas' },
              { label: 'Marca', value: 'Continental' },
              { label: 'Medidas', value: '700×25' },
              { label: 'Uso', value: 'Carretera' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <span className="text-sm text-neutral-500">{row.label}</span>
                <span className="text-sm font-semibold text-neutral-900">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Why join */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4">¿Por qué unirte?</h3>
          <ul className="space-y-3">
            {[
              'Aseguras tu unidad',
              'Siempre pagarás el mejor precio conseguido',
              'Cada nuevo comprador ayuda a bajar el precio',
              'Pago seguro con Stripe',
            ].map(text => (
              <li key={text} className="flex items-start gap-2.5 text-sm text-neutral-700">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 flex-shrink-0 mt-0.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
