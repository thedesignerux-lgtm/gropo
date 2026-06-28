'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export type TierRow = {
  minUnits: number
  price: number
  demand: number
  unlocked: boolean
}

export function useTierDemand(groupId: string) {
  const [tiers, setTiers] = useState<TierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/group/${groupId}/tier-demand`)
        const data = await res.json()
        if (cancelled) return
        setTiers(Array.isArray(data.tiers) ? data.tiers : [])
        setRefreshKey(k => k + 1)
      } catch {
        // silencioso
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

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

  // Derivados
  const unlockedTiers = tiers.filter(t => t.unlocked)
  const currentPrice = unlockedTiers.length > 0
    ? Math.min(...unlockedTiers.map(t => t.price))
    : tiers.length > 0 ? Math.max(...tiers.map(t => t.price)) : 0

  // nextTier = tramo más cercano POR DEBAJO del precio actual que NO esté desbloqueado
  const nextTier = [...tiers]
    .filter(t => !t.unlocked && t.price < currentPrice)
    .sort((a, b) => b.price - a.price)[0] ?? null
  const missing = nextTier ? Math.max(0, nextTier.minUnits - nextTier.demand) : 0

  return { tiers, loading, currentPrice, nextTier, missing, refreshKey }
}
