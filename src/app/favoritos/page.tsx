import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import FavoriteButton from '@/components/FavoriteButton'
import BottomNav from '@/components/BottomNav'
import type { Tier } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

async function fetchRadar() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Favoritos del usuario
  const { data: favs } = await supabase
    .from('favorites')
    .select('group_id')
    .eq('auth_id', user.id)

  const groupIds = (favs ?? []).map((f: any) => f.group_id)
  if (groupIds.length === 0) return { user, groups: [] }

  // Datos de los grupos
  const { data: groups } = await supabaseAdmin
    .from('groups')
    .select('id, product_name, product_spec, pvp, image_url, total_units, status, closes_at')
    .in('id', groupIds)

  if (!groups || groups.length === 0) return { user, groups: [] }

  // Escalera fusionada para cada grupo (precio actual)
  const ladders = await Promise.all(
    groups.map((g: any) =>
      g.status === 'open'
        ? supabaseAdmin.rpc('tier_demand', { p_group_id: g.id })
        : { data: [] }
    )
  )

  const enriched = groups.map((g: any, i: number) => {
    const ladder = Array.isArray(ladders[i]?.data) ? ladders[i]!.data : []
    const unlocked = (ladder as any[]).filter((t: any) => t.unlocked)
    const currentPrice = unlocked.length > 0
      ? Math.min(...unlocked.map((t: any) => Number(t.price)))
      : (ladder as any[]).length > 0
        ? Math.max(...(ladder as any[]).map((t: any) => Number(t.price)))
        : 0
    const nextTier = (ladder as any[])
      .filter((t: any) => !t.unlocked && Number(t.price) < currentPrice)
      .sort((a: any, b: any) => Number(b.price) - Number(a.price))[0] ?? null
    const missing = nextTier ? Math.max(0, Number(nextTier.min_units) - Number(nextTier.effective_demand)) : 0

    return {
      id: g.id,
      name: g.product_name,
      spec: g.product_spec ?? '',
      pvp: Number(g.pvp ?? 0),
      imageUrl: g.image_url ?? null,
      totalUnits: Number(g.total_units ?? 0),
      status: g.status,
      closesAt: g.closes_at,
      currentPrice,
      nextPrice: nextTier ? Number(nextTier.price) : null,
      missing,
    }
  })

  return { user, groups: enriched }
}

export default async function RadarPage() {
  const result = await fetchRadar()

  // No logueado → login
  if (!result) redirect('/login?next=/favoritos')

  const { groups } = result

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block min-h-screen bg-[#FAFAFA]">
        <header className="bg-white border-b border-neutral-100 sticky top-0 z-30">
          <div className="max-w-[1360px] mx-auto px-8 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Volver a grupos
            </a>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-8 py-8">
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">Mi Radar</h1>
          <p className="text-sm text-neutral-500 mb-6">Grupos que estás vigilando. Te avisaremos cuando baje el precio.</p>
          {groups.length === 0 ? <EmptyRadar /> : <RadarList groups={groups} />}
        </div>
      </div>

      {/* Mobile */}
      <div className="lg:hidden min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto min-h-screen pb-28">
          <div className="px-4 pt-6 pb-3">
            <h1 className="text-xl font-bold text-neutral-900 mb-0.5">Mi Radar</h1>
            <p className="text-xs text-neutral-500">Grupos que estás vigilando</p>
          </div>
          {groups.length === 0 ? <EmptyRadar /> : <RadarList groups={groups} />}
        </div>
        <BottomNav />
      </div>
    </>
  )
}

function EmptyRadar() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neutral-400">
          <path d="M19.5 13.572l-7.5 7.428-7.5-7.428a5 5 0 117.5-6.566 5 5 0 117.5 6.572" />
        </svg>
      </div>
      <p className="text-base font-semibold text-neutral-900 mb-1">Tu radar está vacío</p>
      <p className="text-sm text-neutral-500 text-center mb-4">
        Guarda grupos para seguir los movimientos de precio
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-dark transition-colors"
      >
        Explorar grupos
      </Link>
    </div>
  )
}

interface RadarGroup {
  id: string
  name: string
  spec: string
  pvp: number
  imageUrl: string | null
  totalUnits: number
  status: string
  closesAt: string
  currentPrice: number
  nextPrice: number | null
  missing: number
}

function RadarList({ groups }: { groups: RadarGroup[] }) {
  // Grupos abiertos primero, luego el resto
  const sorted = [...groups].sort((a, b) => {
    if (a.status === 'open' && b.status !== 'open') return -1
    if (a.status !== 'open' && b.status === 'open') return 1
    return 0
  })

  return (
    <div className="space-y-3 px-4 lg:px-0">
      {sorted.map(g => <RadarCard key={g.id} group={g} />)}
    </div>
  )
}

function RadarCard({ group: g }: { group: RadarGroup }) {
  const isOpen = g.status === 'open'
  const savings = g.pvp > 0 ? g.pvp - g.currentPrice : 0
  const savingsPct = g.pvp > 0 ? Math.round((savings / g.pvp) * 100) : 0

  // Countdown label
  let timeLabel = ''
  if (isOpen && g.closesAt) {
    const diff = Math.max(0, new Date(g.closesAt).getTime() - Date.now())
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    timeLabel = d > 0 ? `${d}d ${h}h restantes` : `${h}h restantes`
  }

  return (
    <Link href={`/grupo/${g.id}`} className="block">
      <div className={`bg-white rounded-2xl border p-4 transition-all hover:shadow-sm ${
        isOpen ? 'border-neutral-100' : 'border-neutral-100 opacity-60'
      }`}>
        {/* Top row: urgency + time */}
        {isOpen && (
          <div className="flex items-center justify-between mb-3">
            {g.missing > 0 && g.nextPrice ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2c1 3 3.5 5 6 6-1 4-3 7-6 10-3-3-5-6-6-10 2.5-1 5-3 6-6z"/></svg>
                Faltan {g.missing} uds para {fmt(g.nextPrice)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                Mejor precio alcanzado
              </span>
            )}
            {timeLabel && (
              <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
                {timeLabel}
              </span>
            )}
          </div>
        )}

        {/* Product row */}
        <div className="flex gap-3">
          <div className="w-16 h-16 rounded-xl bg-neutral-50 flex-shrink-0 flex items-center justify-center overflow-hidden">
            {g.imageUrl ? (
              <img src={g.imageUrl} alt={g.name} className="w-full h-full object-cover" />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-neutral-200"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900 truncate">{g.name}</p>
                {g.spec && <p className="text-xs text-neutral-500 truncate">{g.spec}</p>}
              </div>
              <FavoriteButton groupId={g.id} initialFavorited={true} size={20} />
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-lg font-bold text-neutral-900 tabular-nums">{fmt(g.currentPrice)}</span>
              {g.pvp > 0 && (
                <span className="text-xs text-neutral-400 line-through">{fmt(g.pvp)}</span>
              )}
              {savingsPct > 0 && (
                <span className="text-xs font-semibold text-green-600">-{savingsPct}%</span>
              )}
            </div>
          </div>
        </div>

        {/* Status for closed/cancelled groups */}
        {!isOpen && (
          <div className="mt-2 pt-2 border-t border-neutral-100">
            <span className="text-xs text-neutral-400">
              {g.status === 'closed' ? 'Grupo cerrado' : g.status === 'cancelled' ? 'Grupo cancelado' : g.status}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
