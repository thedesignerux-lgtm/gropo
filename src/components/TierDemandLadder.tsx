'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
type TierRow = { minUnits: number; price: number; demand: number; unlocked: boolean }
function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}
export default function TierDemandLadder({ groupId }: { groupId: string }) {
  const [tiers, setTiers] = useState<TierRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/group/${groupId}/tier-demand`)
        const data = await res.json()
        if (cancelled) return
        setTiers(Array.isArray(data.tiers) ? data.tiers : [])
      } catch {
        // silencioso: si falla, no rompe la ficha
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    // Canal con nombre único por instancia para evitar colisión con otros
    // canales realtime de la misma página (GroupLiveSection, GroupDesktopView).
    const channelName = `tier-demand-${groupId}-${Math.random().toString(36).slice(2)}`
    const channel = supabase.channel(channelName)
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'events', filter: `group_id=eq.${groupId}` },
      (payload) => {
        const ev = payload.new as any
        if (ev.type === 'member_joined' || ev.type === 'price_dropped') load()
      },
    )
    channel.subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [groupId])
  if (loading || tiers.length === 0) return null
  // El precio vigente del grupo = tramo desbloqueado más barato; si ninguno, el base (más caro).
  const unlockedTiers = tiers.filter(t => t.unlocked)
  const currentPrice = unlockedTiers.length > 0
    ? Math.min(...unlockedTiers.map(t => t.price))
    : Math.max(...tiers.map(t => t.price))
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 p-5">
      <h3 className="text-sm font-semibold text-neutral-900 mb-1">Metas de precio</h3>
      <p className="text-xs text-neutral-500 mb-4">
        Cada precio se activa cuando hay suficientes unidades dispuestas a pagarlo. El grupo paga la meta más barata alcanzada.
      </p>
      <div className="flex flex-col gap-3">
        {tiers.map((t) => {
          const frac = t.minUnits > 0 ? Math.min(1, t.demand / t.minUnits) : 1
          const isCurrent = t.price === currentPrice
          const missing = Math.max(0, t.minUnits - t.demand)
          return (
            <div key={t.price}>
              <div className="flex items-baseline justify-between mb-1">
                <span className={`text-sm font-semibold ${isCurrent ? 'text-brand' : 'text-neutral-900'}`}>
                  {fmt(t.price)}
                  {isCurrent && <span className="ml-2 text-[11px] font-medium text-brand">precio actual</span>}
                  {t.unlocked && !isCurrent && <span className="ml-2 text-[11px] font-medium text-green-600">alcanzado</span>}
                </span>
                <span className="text-xs text-neutral-500 tabular-nums">
                  {t.demand} / {t.minUnits} uds
                </span>
              </div>
              <div className="h-[6px] w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full rounded-full ${t.unlocked ? 'bg-green-500' : 'bg-brand'}`}
                  style={{ width: `${frac * 100}%`, transition: 'width 300ms ease' }}
                />
              </div>
              {!t.unlocked && missing > 0 && (
                <p className="mt-1 text-[11px] text-neutral-400">
                  Faltan {missing} {missing === 1 ? 'unidad dispuesta' : 'unidades dispuestas'} a este precio
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
