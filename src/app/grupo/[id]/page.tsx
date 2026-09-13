import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Tier } from '@/lib/mock-data'
import HeroShareButton from '@/components/HeroShareButton'
import FavoriteButton from '@/components/FavoriteButton'
import BottomNav from '@/components/BottomNav'
import GroupLiveSection from '@/components/GroupLiveSection'
import GroupDesktopView from '@/components/desktop/GroupDesktopView'
import GroupCountdownBadge from '@/components/GroupCountdownBadge'
import GroupHowAndTrust from '@/components/GroupHowAndTrust'

export const dynamic = 'force-dynamic'

async function fetchGroup(id: string) {
  const { data: group, error } = await supabaseAdmin
    .from('groups')
    .select(`
      id, product_name, product_spec, pvp, image_url,
      total_units, current_price, next_price, closes_at
    `)
    .eq('id', id)
    .single()

  if (error || !group) return null

  let bestPrice = Number(group.current_price)
  let nextPrice = Number((group as any).next_price ?? group.current_price)
  let bestBidId: string | null = null
  const { data: rpc } = await supabaseAdmin.rpc('compute_price', { p_group_id: id })
  const row = (Array.isArray(rpc) ? rpc[0] : rpc) as any
  if (row) {
    if (row.best_price != null) bestPrice = Number(row.best_price)
    if (row.next_price != null) nextPrice = Number(row.next_price)
    bestBidId = row.best_bid_id ?? null
  }

  // Escalera FUSIONADA (D5): única fuente pública de tramos
  const { data: ladder } = await supabaseAdmin.rpc('tier_demand', { p_group_id: id })
  const tiers: Tier[] = (Array.isArray(ladder) ? ladder : []).map((t: any) => ({
    minUnits: Number(t.min_units),
    price: Number(t.price),
  }))

  // Stock mostrado = el de la puja que aporta el mejor precio actual
  let maxStock = 0
  let minExecution = 0
  if (bestBidId) {
    const { data: bid } = await supabaseAdmin
      .from('bids')
      .select('max_stock, min_execution')
      .eq('id', bestBidId)
      .single()
    if (bid) {
      maxStock = Number((bid as any).max_stock ?? 0)
      minExecution = Number((bid as any).min_execution ?? 0)
    }
  }

  const { count: bidCount } = await supabaseAdmin
    .from('bids')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', id)
    .eq('status', 'active')

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
    minExecution,
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
    <>
      {/* ── DESKTOP (≥1024px) ── */}
      <div className="hidden lg:block">
        <GroupDesktopView
          groupId={group.id}
          name={group.name}
          spec={group.spec}
          pvp={group.pvp}
          imageUrl={group.imageUrl}
          initialBestPrice={group.bestPrice}
          initialTotalUnits={group.totalUnits}
          bidCount={group.bidCount}
          tiers={group.tiers}
          maxStock={group.maxStock}
          minExecution={group.minExecution}
          closesAt={group.closesAt}
        />
      </div>

      {/* ── MOBILE (<1024px) — 2d: Hero grande + barra fusionada ── */}
      <div className="lg:hidden bg-white">
        <div className="max-w-md mx-auto bg-white pb-16">
          {/* HERO IMAGE with gradient overlay (2d) */}
          <div
            className="relative w-full overflow-hidden shrink-0"
            style={{ aspectRatio: '1 / 0.78', background: '#1a1a1f' }}
          >
            {group.imageUrl ? (
              <img
                src={group.imageUrl}
                alt={group.name}
                className="absolute inset-0 w-full h-full object-cover opacity-[.88]"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-brand/20 to-brand/5" />
            )}

            {/* Top bar: back + share/heart */}
            <div className="absolute left-4 right-4 flex justify-between z-10" style={{ top: 'env(safe-area-inset-top, 12px)', paddingTop: 12 }}>
              <Link
                href="/"
                className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-neutral-800"
                style={{ background: 'rgba(255,255,255,.94)', boxShadow: '0 4px 12px -6px rgba(0,0,0,.4)' }}
                aria-label="Volver"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </Link>
              <div className="flex items-center gap-2.5">
                <HeroShareButton
                  productName={group.name}
                  bestPrice={group.bestPrice}
                  pvp={group.pvp}
                  nextPrice={group.nextPrice}
                  groupId={group.id}
                />
                <div className="w-[38px] h-[38px] rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,.94)', boxShadow: '0 4px 12px -6px rgba(0,0,0,.4)' }}>
                  <FavoriteButton groupId={group.id} size={17} icon="heart" />
                </div>
              </div>
            </div>

            {/* Gradient overlay with countdown + name + spec */}
            <div className="absolute bottom-0 left-0 right-0 px-[18px] pb-4 pt-16" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,.72))' }}>
              <GroupCountdownBadge closesAt={group.closesAt} />
              <h1 className="text-[22px] font-extrabold text-white tracking-tight leading-tight mt-2">{group.name}</h1>
              {group.spec && (
                <p className="text-xs text-white/70 mt-0.5">{group.spec} · Deporte</p>
              )}
            </div>
          </div>

          {/* LIVE CONTENT + CTA */}
          <GroupLiveSection
            groupId={group.id}
            name={group.name}
            spec={group.spec}
            pvp={group.pvp}
            initialBestPrice={group.bestPrice}
            initialTotalUnits={group.totalUnits}
            bidCount={group.bidCount}
            tiers={group.tiers}
            maxStock={group.maxStock}
            minExecution={group.minExecution}
            closesAt={group.closesAt}
            heroMode
            /* UX-05 · Estos bloques vivían solo en escritorio: la ficha móvil no
               respondía "¿cuándo me cobráis?" ni "¿y si el grupo no sale?".
               Van como prop, no como hermano posterior, para que la barra de
               compra siga siendo el último hijo y no se desancle al hacer scroll. */
            belowContent={
              <div className="px-4 pb-6">
                <GroupHowAndTrust />
              </div>
            }
          />
        </div>
        <BottomNav />
      </div>
    </>
  )
}
