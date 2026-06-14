import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Tier } from '@/lib/mock-data'
import HeroShareButton from '@/components/HeroShareButton'
import GroupLiveSection from '@/components/GroupLiveSection'

export const dynamic = 'force-dynamic'

async function fetchGroup(id: string) {
  const { data: group, error } = await supabase
    .from('groups')
    .select(`
      id, product_name, product_spec, pvp, image_url,
      total_units, current_price, next_price, closes_at,
      bids(tiers, price_mode, max_stock, min_execution)
    `)
    .eq('id', id)
    .single()

  if (error || !group) return null

  let bestPrice = Number(group.current_price)
  let nextPrice = Number((group as any).next_price ?? group.current_price)
  const { data: rpc } = await supabase.rpc('compute_price', { p_group_id: id })
  if (rpc && typeof rpc === 'object') {
    if ((rpc as any).best_price != null) bestPrice = Number((rpc as any).best_price)
    if ((rpc as any).next_price != null) nextPrice = Number((rpc as any).next_price)
  }

  const { count: bidCount } = await supabase
    .from('bids')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', id)

  const bid = Array.isArray(group.bids) ? group.bids[0] : null
  const tiers: Tier[] = ((bid as any)?.tiers ?? []).map((t: any) => ({
    minUnits: Number(t.min_units),
    price: Number(t.price),
  }))
  const maxStock = Number((bid as any)?.max_stock ?? 0)

  return {
    id: group.id as string,
    name: group.product_name as string,
    spec: ((group as any).product_spec ?? '') as string,
    pvp: Number((group as any).pvp ?? 0),
    imageUrl: ((group as any).image_url as string | null) ?? undefined,
    totalUnits: Number(group.total_units ?? 0),
    closesAt: group.closes_at as string,
    bestPrice,
    nextPrice,
    bidCount: bidCount ?? 0,
    tiers,
    maxStock,
  }
}

export default async function GrupoPage({ params }: { params: { id: string } }) {
  const group = await fetchGroup(params.id)

  if (!group) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-base text-neutral-400">Grupo no encontrado</p>
      </div>
    )
  }

  return (
    <div className="bg-white">
      <div className="max-w-md mx-auto bg-white">

        {/* ── HERO IMAGE ── */}
        <div
          className="relative w-full bg-[#F5F5F5] overflow-hidden flex-shrink-0"
          style={{ aspectRatio: '4/3' }}
        >
          {group.imageUrl ? (
            <img
              src={group.imageUrl}
              alt={group.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          )}
          <div className="absolute left-3 right-3 flex justify-between z-10" style={{ top: 12 }}>
            <Link
              href="/"
              className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors"
              aria-label="Volver"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
            <HeroShareButton
              productName={group.name}
              bestPrice={group.bestPrice}
              pvp={group.pvp}
              nextPrice={group.nextPrice}
              groupId={group.id}
            />
          </div>
        </div>

        {/* ── LIVE CONTENT + CTA ── */}
        <GroupLiveSection
          groupId={group.id}
          name={group.name}
          spec={group.spec}
          pvp={group.pvp}
          initialBestPrice={group.bestPrice}
          initialNextPrice={group.nextPrice}
          initialTotalUnits={group.totalUnits}
          bidCount={group.bidCount}
          tiers={group.tiers}
          maxStock={group.maxStock}
          closesAt={group.closesAt}
        />

      </div>
    </div>
  )
}
