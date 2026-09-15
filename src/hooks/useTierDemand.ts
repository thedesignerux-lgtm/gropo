'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { currentLadderPrice, ladderProgress, type LadderTier } from '@/lib/ladder'

export type TierRow = LadderTier

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

  // Derivados. La cuenta vive en `@/lib/ladder`, no aquí: esta misma derivación estaba
  // duplicada en Mis grupos con una resta distinta, y las dos pantallas contaban cosas
  // diferentes del mismo grupo. Ver la cabecera de ese fichero.
  const currentPrice = currentLadderPrice(tiers)
  const { next: nextTier, missing } = ladderProgress(tiers)

  return { tiers, loading, currentPrice, nextTier, missing, refreshKey }
}
