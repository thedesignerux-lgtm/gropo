import { supabaseAdmin } from '@/lib/supabase-admin'
import type { GroupProduct, Tier } from '@/lib/mock-data'
import GroupsGrid from '@/components/GroupsGrid'
import BottomNav from '@/components/BottomNav'
import HomeDesktopView from '@/components/desktop/HomeDesktopView'

// Siempre datos frescos de Supabase (no cache de Next.js)
export const dynamic = 'force-dynamic'

async function fetchGroups(): Promise<GroupProduct[]> {
  const { data, error } = await supabaseAdmin
    .from('groups')
    .select('id, product_name, product_spec, total_units, pvp, image_url')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[fetchGroups]', error.message)
    return []
  }
  const rows = data ?? []
  if (rows.length === 0) return []

  // min_execution por grupo (pujas activas), una sola consulta
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

  // Escalera FUSIONADA (D5) por grupo — misma fuente que la ficha
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
    }]
  })
}

export default async function Home() {
  const products = await fetchGroups()

  return (
    <>
      {/* Desktop (≥1024px) */}
      <div className="hidden lg:block">
        <HomeDesktopView products={products} />
      </div>

      {/* Mobile (<1024px) */}
      <div className="lg:hidden min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto min-h-screen pb-28">
          <GroupsGrid products={products} />
        </div>
        <BottomNav />
      </div>
    </>
  )
}
