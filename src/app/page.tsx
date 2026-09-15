import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import type { GroupProduct, Tier } from '@/lib/mock-data'
import GroupsGrid from '@/components/GroupsGrid'
import BottomNav from '@/components/BottomNav'
import SiteFooter from '@/components/SiteFooter'
import HomeDesktopView from '@/components/desktop/HomeDesktopView'

export const dynamic = 'force-dynamic'

async function fetchGroups(): Promise<GroupProduct[]> {
  const { data, error } = await supabaseAdmin
    .from('groups')
    .select('id, product_name, product_spec, total_units, pvp, image_url, closes_at')
    .eq('status', 'open')
    .eq('is_demo', false) // los grupos DEMO solo son accesibles por URL directa
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
    .select('group_id, min_execution, max_stock')
    .eq('status', 'active')
    .in('group_id', ids)
  const minExecByGroup = new Map<string, number>()
  const maxStockByGroup = new Map<string, number>()
  for (const b of bidsMeta ?? []) {
    const v = Number((b as any).min_execution ?? 0)
    const prev = minExecByGroup.get((b as any).group_id)
    minExecByGroup.set((b as any).group_id, prev == null ? v : Math.min(prev, v))
    // A-02 · Con varias pujas activas nos quedamos con el stock mayor: es el techo
    // de lo que se puede vender hoy. La autoridad al comprar sigue siendo
    // `prepare_join`, que mira el stock de la puja concreta.
    const st = Number((b as any).max_stock ?? 0)
    const prevSt = maxStockByGroup.get((b as any).group_id) ?? 0
    maxStockByGroup.set((b as any).group_id, Math.max(prevSt, st))
  }

  /**
   * A-04 · PERSONAS por grupo — un dato distinto de las unidades.
   *
   * La tarjeta decía «15 confirmados» usando unidades: en las cámaras son 20
   * personas y 57 unidades. Una sola consulta agregada para todo el catálogo, con los
   * mismos estados de pago que `tier_demand`, y se cuenta en JS: `group_by` no existe
   * en el cliente de Supabase y no merece una vista nueva por un contador.
   */
  const { data: memberRows } = await supabaseAdmin
    .from('group_members')
    .select('group_id')
    .in('group_id', ids)
    .in('payment_status', ['authorized', 'instructed', 'paid'])
  const memberCountByGroup = new Map<string, number>()
  for (const r of memberRows ?? []) {
    const g = (r as any).group_id as string
    memberCountByGroup.set(g, (memberCountByGroup.get(g) ?? 0) + 1)
  }

  const ladders = await Promise.all(
    rows.map((r: any) => supabaseAdmin.rpc('tier_demand', { p_group_id: r.id }))
  )

  return rows.flatMap((row: any, i: number) => {
    const ladder = Array.isArray(ladders[i]?.data) ? ladders[i]!.data : []
    const asc = (ladder as any[])
      .map((t: any) => ({
        minUnits: Number(t.min_units),
        price: Number(t.price),
        demand: Number(t.effective_demand ?? 0),
        unlocked: Boolean(t.unlocked),
      }))
      .sort((a, b) => a.minUnits - b.minUnits)
    const tiers: Tier[] = asc.map(t => ({ minUnits: t.minUnits, price: t.price }))
    if (tiers.length === 0) return []

    // Unidades de display derivadas de tier_demand (no de total_units, que solo
    // cuenta demanda firme y se queda a 0 si todos los miembros son esperadores).
    // Regla: el precio mostrado debe ser el del tramo desbloqueado más barato,
    // y el progreso hacia el siguiente tramo usa su demanda efectiva real.
    const unlockedBase = asc.filter(t => t.unlocked).reduce((m, t) => Math.max(m, t.minUnits), 0)
    const nextLocked = asc.find(t => !t.unlocked && t.minUnits > unlockedBase) ?? null
    const currentUnits = nextLocked
      ? Math.min(nextLocked.minUnits - 1, Math.max(unlockedBase, nextLocked.demand))
      : Math.max(unlockedBase, Number(row.total_units ?? 0))

    return [{
      id: row.id as string,
      name: row.product_name as string,
      variant: (row.product_spec ?? '') as string,
      pvp: row.pvp != null ? Number(row.pvp) : 0,
      currentUnits,
      priceMode: 'stepped' as const,
      tiers,
      minExecution: minExecByGroup.get(row.id) ?? 0,
      imageUrl: (row.image_url as string | null) ?? undefined,
      closesAt: (row.closes_at as string | null) ?? undefined,
      maxStock: maxStockByGroup.get(row.id) ?? 0,
      memberCount: memberCountByGroup.get(row.id) ?? 0,
      // La demanda efectiva es máxima en el tramo más barato, donde entran todos:
      // ese máximo es la suma de unidades vivas del grupo.
      committedUnits: asc.length > 0 ? Math.max(...asc.map(t => t.demand)) : 0,
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

async function fetchIsAuthed(): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return !!user
  } catch {
    return false
  }
}

export default async function Home() {
  const [products, favoriteIds, isAuthed] = await Promise.all([
    fetchGroups(),
    fetchFavoriteIds(),
    fetchIsAuthed(),
  ])

  return (
    <>
      <div className="hidden lg:block">
        <HomeDesktopView products={products} favoriteIds={favoriteIds} isAuthed={isAuthed} />
        <SiteFooter />
      </div>

      <div className="lg:hidden min-h-screen" style={{ background: '#FBFAF8' }}>
        <div className="max-w-md mx-auto pb-8">
          <GroupsGrid products={products} favoriteIds={favoriteIds} isAuthed={isAuthed} />
        </div>
        <SiteFooter />
        <BottomNav />
      </div>
    </>
  )
}
