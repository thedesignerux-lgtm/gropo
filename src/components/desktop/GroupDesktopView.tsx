'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getActivationState, getMilestones } from '@/lib/mock-data'
import type { Tier, Milestone } from '@/lib/mock-data'
import GroupSidebar, { type TabId } from './GroupSidebar'
import GroupRightSidebar from './GroupRightSidebar'
import GroupCenterContent from './GroupCenterContent'
import CountdownChip from '@/components/CountdownChip'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

interface Props {
  groupId: string
  name: string
  spec: string
  pvp: number
  imageUrl?: string
  initialBestPrice: number
  initialTotalUnits: number
  bidCount: number
  tiers: Tier[]
  maxStock: number
  minExecution: number
  closesAt: string
}

export default function GroupDesktopView({
  groupId, name, spec, pvp, imageUrl,
  initialBestPrice, initialTotalUnits,
  bidCount, tiers, maxStock, minExecution, closesAt,
}: Props) {
  const [bestPrice, setBestPrice] = useState(initialBestPrice)
  const [totalUnits, setTotalUnits] = useState(initialTotalUnits)
  const [activeTab, setActiveTab] = useState<TabId>('resumen')

  // Real-time sync (same as GroupLiveSection)
  useEffect(() => {
    let cancelled = false

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

    syncFromServer()

    const channel = supabase
      .channel(`group-desktop-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const eventData = payload.new as any
          if (eventData.type === 'member_joined' || eventData.type === 'price_dropped') {
            setBestPrice(eventData.payload.new_price)
            setTotalUnits(eventData.payload.total_units)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') syncFromServer()
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [groupId])

  const { activated, unitsToActivate, nextTier, unitsToNext } = getActivationState(tiers, totalUnits, minExecution)
  const milestones: Milestone[] = getMilestones(tiers, minExecution)
  const nextPrice = nextTier?.price ?? bestPrice

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Top bar */}
      <header className="bg-white border-b border-neutral-100 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="text-xl font-bold text-neutral-900 tracking-tight">
            vonda
          </a>

          {/* Search */}
          <div className="flex-1 max-w-md mx-8">
            <div className="relative">
              <input
                type="text"
                placeholder="Busca tu producto..."
                className="w-full h-10 pl-10 pr-4 rounded-full border border-neutral-200 bg-white text-sm text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <CountdownChip />
            {/* Notifications */}
            <button className="relative text-neutral-500 hover:text-neutral-700 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
            {/* Avatar */}
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-semibold text-neutral-600">
                V
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>
      </header>

      {/* Main 3-column layout */}
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex gap-8">
          {/* Left sidebar */}
          <GroupSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            conversationCount={12}
            participantCount={totalUnits}
            questionCount={3}
            productName={name}
            bestPrice={bestPrice}
            pvp={pvp}
            nextPrice={nextPrice}
            groupId={groupId}
          />

          {/* Center content */}
          <main className="flex-1 min-w-0">
            <GroupCenterContent
              activeTab={activeTab}
              name={name}
              spec={spec}
              imageUrl={imageUrl}
              pvp={pvp}
              bestPrice={bestPrice}
              totalUnits={totalUnits}
              maxStock={maxStock}
              tiers={tiers}
              activated={activated}
              unitsToNext={unitsToNext}
              nextTier={nextTier}
              waitingCount={12}
              waitingPrice={nextTier?.price}
            />
          </main>

          {/* Right sidebar */}
          <GroupRightSidebar
            groupId={groupId}
            tiers={tiers}
            milestones={milestones}
            totalUnits={totalUnits}
            bestPrice={bestPrice}
            nextPrice={nextPrice}
            pvp={pvp}
            maxStock={maxStock}
            closesAt={closesAt}
            unitsToNext={unitsToNext}
            nextTier={nextTier}
            activated={activated}
          />
        </div>
      </div>
    </div>
  )
}
