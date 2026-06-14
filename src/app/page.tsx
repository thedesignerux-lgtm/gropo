import { supabase } from '@/lib/supabase'
import type { GroupProduct, Tier } from '@/lib/mock-data'
import GroupsGrid from '@/components/GroupsGrid'
import BottomNav from '@/components/BottomNav'

// Siempre datos frescos de Supabase (no cache de Next.js)
export const dynamic = 'force-dynamic'

async function fetchGroups(): Promise<GroupProduct[]> {
  const { data, error } = await supabase
    .from('groups')
    .select(`
      id,
      product_name,
      product_spec,
      total_units,
      pvp,
      image_url,
      bids (
        tiers,
        price_mode
      )
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[fetchGroups]', error.message)
    return []
  }

  return (data ?? []).flatMap((row: any) => {
    const bid = Array.isArray(row.bids) ? row.bids[0] : null
    if (!bid?.tiers) return []

    const tiers: Tier[] = (bid.tiers as any[]).map((t: any) => ({
      minUnits: Number(t.min_units),
      price: Number(t.price),
    }))

    if (tiers.length === 0) return []

    return [{
      id: row.id as string,
      name: row.product_name as string,
      variant: (row.product_spec ?? '') as string,
      pvp: Number(row.pvp ?? 0),
      currentUnits: Number(row.total_units ?? 0),
      priceMode: 'stepped' as const,
      tiers,
      imageUrl: (row.image_url as string | null) ?? undefined,
    }]
  })
}

export default async function Home() {
  const products = await fetchGroups()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto min-h-screen pb-28">
        <GroupsGrid products={products} />
      </div>
      <BottomNav />
    </div>
  )
}
