import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import type { GroupProduct, Tier } from '@/lib/mock-data'
import GroupsGrid from '@/components/GroupsGrid'
import BottomNav from '@/components/BottomNav'
import HomeDesktopView from '@/components/desktop/HomeDesktopView'

export const dynamic = 'force-dynamic'

async function fetchGroups(): Promise<GroupProduct[]> {
  const { data, error } = await supabaseAdmin
    .from('groups')
    .select('id, product_name, product_spec, total_units, pvp, image_url, closes_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[fetchGroups]', error.message)
    return []
  }
  const rows = data ?? []
  if (rows.length === 0) return []

  const ids = rows.map((r: any) => r.id)
  const { data: bidsMeta } = await supabaseAdmin
    .from('bids')
    .select('group_id, min_execution')
    .eq('status', 'active')
    .in('group_id', ids)
  const minExecByGroup = new Map<string, number>()
  for (const b of bidsMeta ?? []) {
    const v = Number((b as any).min_execution ?? 0)
    const prev = minExecByGroup.get((b as any).group_id)
    minExecByGroup.set((b as any).group_id, prev == null ? v : Math.min(prev, v))
  }

  const ladders = await Promise.all(
    rows.map((r: any) => supabaseAdmin.rpc('tier_demand', { p_group_id: r.id }))
  )

  return rows.flatMap((row: any, i: number) => {
    const ladder = Array.isArray(ladders[i]?.data) ? ladders[i]!.data : []
    const tiers: Tier[] = (ladder as any[]).map((t: any) => ({
      minUnits: Number(t.min_units),
      price: Number(t.price),
    }))
    if (tiers.length === 0) return []

    return [{
      id: row.id as string,
      name: row.product_name as string,
      variant: (row.product_spec ?? '') as string,
      pvp: row.pvp != null ? Number(row.pvp) : 0,
      currentUnits: Number(row.total_units ?? 0),
      priceMode: 'stepped' as const,
      tiers,
      minExecution: minExecByGroup.get(row.id) ?? 0,
      imageUrl: (row.image_url as string | null) ?? undefined,
      closesAt: (row.closes_at as string | null) ?? undefined,
    }]
  })
}

async function fetchFavoriteIds(): Promise<string[]> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('favorites')
      .select('group_id')
      .eq('auth_id', user.id)
    return (data ?? []).map((f: any) => f.group_id)
  } catch {
    return []
  }
}

export default async function Home() {
  const [products, favoriteIds] = await Promise.all([
    fetchGroups(),
    fetchFavoriteIds(),
  ])

  return (
    <>
      <div className="hidden lg:block">
        <HomeDesktopView products={products} favoriteIds={favoriteIds} />
      </div>

      <div className="lg:hidden min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto min-h-screen pb-28">
          <GroupsGrid products={products} favoriteIds={favoriteIds} />
        </div>
        <BottomNav />
      </div>
    </>
  )
}
