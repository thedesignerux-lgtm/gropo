'use client'

import { useState, useEffect } from 'react'
import { useTierDemand } from '@/hooks/useTierDemand'

interface Props {
  groupId: string
  maxStock: number
}

export default function GroupRightSidebar({ groupId, maxStock }: Props) {
  const [summary, setSummary] = useState<{ firmUnits: number; reserveUnits: number; maxStock: number } | null>(null)
  const { tiers: demandTiers, refreshKey, nextTier } = useTierDemand(groupId)
  const isBestPrice = !nextTier
  const rawParticipants = demandTiers.length > 0 ? Math.max(...demandTiers.map(t => t.demand)) : 0
  const totalParticipants = maxStock > 0 ? Math.min(rawParticipants, maxStock) : rawParticipants

  useEffect(() => {
    async function load() {
      try { const res = await fetch(`/api/group/${groupId}/summary`); const data = await res.json(); setSummary(data) } catch {}
    }
    load()
  }, [groupId, refreshKey])

  return (
    <aside className="w-[280px] flex-shrink-0 sticky top-[80px] space-y-4">
      {/* Resumen del grupo — solo cuando hay descuentos pendientes */}
      {!isBestPrice && (
        <div className="bg-white rounded-2xl border border-neutral-100 p-5">
          <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide mb-4">Resumen del grupo</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-neutral-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-neutral-400"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
                Stock disponible
              </span>
              <span className="text-sm font-semibold text-neutral-900">{maxStock} unidades</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-neutral-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-neutral-400"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                Participantes
              </span>
              <span className="text-sm font-semibold text-neutral-900">{totalParticipants}</span>
            </div>
            {summary && (<>
              <div className="border-t border-neutral-100 pt-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-neutral-600"><span className="w-2 h-2 rounded-full bg-green-500"/>Compras aseguradas</span>
                <span className="text-sm font-semibold text-neutral-900">{summary.firmUnits}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-neutral-600"><span className="w-2 h-2 rounded-full bg-brand"/>Compras en espera</span>
                <span className="text-sm font-semibold text-neutral-900">{summary.reserveUnits}</span>
              </div>
            </>)}
          </div>
        </div>
      )}

      {/* Specs del producto — siempre visible */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-5">
        <div className="space-y-3 text-sm">
          {[
            { icon: '📦', label: 'Categoría', value: 'Cubiertas' },
            { icon: '🛡️', label: 'Marca', value: 'Continental' },
            { icon: '📐', label: 'Medidas', value: '700x25' },
            { icon: '🚴', label: 'Uso', value: 'Carretera' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-neutral-500"><span className="text-sm">{item.icon}</span>{item.label}</span>
              <span className="font-medium text-neutral-900">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Confianza — copy adaptado al estado */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-5">
        <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide mb-3">
          {isBestPrice ? 'Tu compra' : '¿Por qué unirte?'}
        </h3>
        <ul className="space-y-2.5">
          {(isBestPrice
            ? [
                'Precio garantizado al mejor descuento',
                'Nunca pagarás más de lo que elijas',
                'Pago seguro con Stripe',
              ]
            : [
                'Aseguras tu unidad',
                'Siempre pagarás el mejor precio conseguido',
                'Cada nuevo comprador ayuda a bajar el precio',
                'Pago seguro con Stripe',
              ]
          ).map(text => (
            <li key={text} className="flex items-start gap-2.5 text-sm text-neutral-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 flex-shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"/></svg>
              {text}
            </li>
          ))}
        </ul>
      </div>

      {/* Dudas — siempre visible */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">¿Dudas?</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Lee cómo funciona la compra conjunta</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-400"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
    </aside>
  )
}
