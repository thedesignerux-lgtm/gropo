import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import FavoriteButton from '@/components/FavoriteButton'
import WaveProgress from '@/components/WaveProgress'
import BottomNav from '@/components/BottomNav'

export const dynamic = 'force-dynamic'

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

// ─── Data fetching ──────────────────────────────────────────

interface RadarGroup {
  id: string
  name: string
  spec: string
  pvp: number
  imageUrl: string | null
  totalUnits: number
  maxStock: number
  status: string
  closesAt: string
  currentPrice: number
  nextPrice: number | null
  missing: number
}

async function fetchRadar(): Promise<{ groups: RadarGroup[] } | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: favs } = await supabase
    .from('favorites')
    .select('group_id')
    .eq('auth_id', user.id)

  const groupIds = (favs ?? []).map((f: any) => f.group_id)
  if (groupIds.length === 0) return { groups: [] }

  const { data: groups } = await supabaseAdmin
    .from('groups')
    .select('id, product_name, product_spec, pvp, image_url, total_units, status, closes_at')
    .in('id', groupIds)

  if (!groups || groups.length === 0) return { groups: [] }

  // Get max_stock from active/winner bids per group
  const { data: bids } = await supabaseAdmin
    .from('bids')
    .select('group_id, max_stock, status')
    .in('group_id', groupIds)
    .in('status', ['active', 'winner'])

  const maxStockByGroup: Record<string, number> = {}
  for (const b of bids ?? []) {
    const current = maxStockByGroup[b.group_id] ?? 0
    maxStockByGroup[b.group_id] = Math.max(current, Number(b.max_stock ?? 0))
  }

  // Tier demand for open groups
  const ladders = await Promise.all(
    groups.map((g: any) =>
      g.status === 'open'
        ? supabaseAdmin.rpc('tier_demand', { p_group_id: g.id })
        : { data: [] }
    )
  )

  const enriched: RadarGroup[] = groups.map((g: any, i: number) => {
    const ladder = Array.isArray(ladders[i]?.data) ? ladders[i]!.data : []
    const unlocked = (ladder as any[]).filter((t: any) => t.unlocked)
    const currentPrice = unlocked.length > 0
      ? Math.min(...unlocked.map((t: any) => Number(t.price)))
      : (ladder as any[]).length > 0
        ? Math.max(...(ladder as any[]).map((t: any) => Number(t.price)))
        : Number(g.current_price ?? 0)
    const nextTier = (ladder as any[])
      .filter((t: any) => !t.unlocked && Number(t.price) < currentPrice)
      .sort((a: any, b: any) => Number(b.price) - Number(a.price))[0] ?? null
    const missing = nextTier ? Math.max(0, Number(nextTier.min_units) - Number(nextTier.effective_demand)) : 0

    // For closed/cancelled groups, totalUnits = total_units from DB
    // For open groups, use max demand from ladder
    const demandUnits = (ladder as any[]).length > 0
      ? Math.max(...(ladder as any[]).map((t: any) => Number(t.effective_demand ?? 0)))
      : Number(g.total_units ?? 0)

    return {
      id: g.id,
      name: g.product_name,
      spec: g.product_spec ?? '',
      pvp: Number(g.pvp ?? 0),
      imageUrl: g.image_url ?? null,
      totalUnits: demandUnits,
      maxStock: maxStockByGroup[g.id] ?? 0,
      status: g.status,
      closesAt: g.closes_at,
      currentPrice,
      nextPrice: nextTier ? Number(nextTier.price) : null,
      missing,
    }
  })

  return { groups: enriched }
}

// ─── Page ───────────────────────────────────────────────────

export default async function RadarPage() {
  const result = await fetchRadar()
  if (!result) redirect('/login?next=/favoritos')

  const { groups } = result
  const active = groups.filter(g => g.status === 'open')
  const closed = groups.filter(g => g.status === 'closed')
  const cancelled = groups.filter(g => g.status === 'cancelled')

  return (
    <>
      {/* ─── Desktop ─── */}
      <div className="hidden lg:block min-h-screen bg-[#FAFAFA]">
        <header className="bg-white border-b border-neutral-100 sticky top-0 z-30">
          <div className="max-w-[1360px] mx-auto px-8 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Volver a grupos
            </a>
          </div>
        </header>

        <div className="max-w-[1200px] mx-auto px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-neutral-900">Mi Radar</h1>
              {groups.length > 0 && (
                <span className="text-xs font-semibold bg-neutral-900 text-white px-2.5 py-1 rounded-full">
                  {groups.length} guardados
                </span>
              )}
            </div>
          </div>

          {groups.length === 0 ? (
            <EmptyRadar />
          ) : (
            <div className="space-y-8">
              {/* Active groups */}
              {active.length > 0 && (
                <DesktopSection
                  title="Grupos activos"
                  subtitle="Grupos que siguen abiertos y en los que puedes unirte."
                  groups={active}
                  dotColor="bg-brand"
                />
              )}
              {/* Closed groups */}
              {closed.length > 0 && (
                <DesktopSection
                  title="Grupos finalizados"
                  subtitle="Grupos que ya alcanzaron su precio final."
                  groups={closed}
                  dotColor="bg-neutral-400"
                />
              )}
              {/* Cancelled groups */}
              {cancelled.length > 0 && (
                <DesktopSection
                  title="Grupos cancelados"
                  subtitle="Grupos que no alcanzaron el mínimo necesario."
                  groups={cancelled}
                  dotColor="bg-neutral-300"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Mobile ─── */}
      <div className="lg:hidden min-h-screen bg-white">
        <div className="max-w-md mx-auto min-h-screen pb-28">
          {/* Header */}
          <div className="px-4 pt-6 pb-2">
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-xl font-bold text-neutral-900">Mi Radar</h1>
              {groups.length > 0 && (
                <span className="text-[11px] font-semibold bg-neutral-900 text-white px-2 py-0.5 rounded-full">
                  {active.length} oportunidades
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500">
              Grupos que sigues y oportunidades para bloquear el mejor precio.
            </p>
          </div>

          {/* Tabs */}
          {groups.length > 0 && (
            <MobileTabs
              active={active}
              closed={closed}
              cancelled={cancelled}
            />
          )}

          {groups.length === 0 && <EmptyRadar />}
        </div>
        <BottomNav />
      </div>
    </>
  )
}

// ─── Mobile Tabs (client component wrapper needed) ──────────

function MobileTabs({
  active,
  closed,
  cancelled,
}: {
  active: RadarGroup[]
  closed: RadarGroup[]
  cancelled: RadarGroup[]
}) {
  // Server component — render all tabs, use CSS to show/hide via anchors
  // For simplicity, show all sections stacked (tabs become section headers)
  return (
    <div className="px-4 space-y-2 mt-3">
      {/* Active */}
      {active.length > 0 && (
        <>
          <div className="flex items-center gap-2 py-2">
            <span className="text-sm font-semibold text-neutral-900">Activos</span>
            <span className="text-xs font-semibold bg-brand/10 text-brand px-2 py-0.5 rounded-full">{active.length}</span>
          </div>
          <div className="space-y-3">
            {active.map(g => <MobileRadarCard key={g.id} group={g} />)}
          </div>
        </>
      )}
      {/* Closed */}
      {closed.length > 0 && (
        <>
          <div className="flex items-center gap-2 py-2 mt-4">
            <span className="text-sm font-semibold text-neutral-500">Finalizados</span>
            <span className="text-xs font-medium bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">{closed.length}</span>
          </div>
          <div className="space-y-3">
            {closed.map(g => <MobileRadarCard key={g.id} group={g} />)}
          </div>
        </>
      )}
      {/* Cancelled */}
      {cancelled.length > 0 && (
        <>
          <div className="flex items-center gap-2 py-2 mt-4">
            <span className="text-sm font-semibold text-neutral-400">Cancelados</span>
            <span className="text-xs font-medium bg-neutral-100 text-neutral-400 px-2 py-0.5 rounded-full">{cancelled.length}</span>
          </div>
          <div className="space-y-3">
            {cancelled.map(g => <MobileRadarCard key={g.id} group={g} />)}
          </div>
        </>
      )}

      {/* Empty state footer */}
      <div className="pt-8 pb-4">
        <div className="bg-neutral-50 rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-neutral-700 mb-1">Tu radar está tranquilo</p>
          <p className="text-xs text-neutral-500 mb-3">
            Explora grupos y añade productos a tu radar para no perderte nada.
          </p>
          <Link
            href="/"
            className="inline-flex px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-dark transition-colors"
          >
            Explorar grupos
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Mobile Card ────────────────────────────────────────────

function MobileRadarCard({ group: g }: { group: RadarGroup }) {
  const isOpen = g.status === 'open'
  const isClosed = g.status === 'closed'

  // Countdown
  let timeLabel = ''
  if (isOpen && g.closesAt) {
    const diff = Math.max(0, new Date(g.closesAt).getTime() - Date.now())
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    timeLabel = d > 0 ? `${d}d ${String(h).padStart(2, '0')}h restantes` : `${h}h restantes`
  }

  // Status label for closed/cancelled
  const statusLabel = isClosed ? 'Finalizado' : g.status === 'cancelled' ? 'Cancelado' : ''
  const completedMax = g.maxStock > 0 && g.totalUnits >= g.maxStock

  return (
    <Link href={`/grupo/${g.id}`} className="block">
      <div className={`bg-white rounded-2xl border p-4 transition-all hover:shadow-sm ${
        isOpen ? 'border-neutral-200' : 'border-neutral-100 opacity-70'
      }`}>
        {/* Top row: urgency + countdown */}
        <div className="flex items-center justify-between mb-3">
          {isOpen ? (
            g.missing > 0 && g.nextPrice ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-red-500"><path d="M12 2c1 3 3.5 5 6 6-1 4-3 7-6 10-3-3-5-6-6-10 2.5-1 5-3 6-6z"/></svg>
                Faltan {g.missing} uds
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                {completedMax ? '¡Completado!' : 'Mejor precio'}
              </span>
            )
          ) : (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              isClosed ? 'text-green-700 bg-green-50' : 'text-neutral-500 bg-neutral-100'
            }`}>
              {isClosed ? '✅ Plaza asegurada' : 'Cancelado'}
            </span>
          )}

          <div className="flex items-center gap-2">
            {timeLabel && (
              <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
                {timeLabel}
              </span>
            )}
          </div>
        </div>

        {/* Product info */}
        <div className="flex gap-3 mb-3">
          <div className="w-20 h-20 rounded-xl bg-neutral-50 flex-shrink-0 flex items-center justify-center overflow-hidden">
            {g.imageUrl ? (
              <img src={g.imageUrl} alt={g.name} className="w-full h-full object-cover" />
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-neutral-200"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-neutral-900 leading-tight">{g.name}</p>
            {g.spec && <p className="text-xs text-neutral-500 mt-0.5">{g.spec}</p>}
          </div>
        </div>

        {/* Wave progress bar */}
        <WaveProgress
          current={g.totalUnits}
          max={g.maxStock}
          height={28}
        />

        {/* Units + next price */}
        <div className="flex items-center justify-between mt-1.5 mb-3">
          <span className="text-xs font-semibold text-neutral-700 tabular-nums">
            {g.totalUnits} / {g.maxStock} uds
          </span>
          {isOpen && g.nextPrice ? (
            <span className="text-xs text-neutral-500">
              Próximo: <span className="font-semibold text-neutral-700">{fmt(g.nextPrice)}</span>
            </span>
          ) : null}
        </div>

        {/* Price + CTA */}
        <div className="flex items-end justify-between border-t border-neutral-100 pt-3">
          <div>
            {g.pvp > 0 && (
              <p className="text-[11px] text-neutral-400 line-through">PVP: {fmt(g.pvp)}</p>
            )}
            <p className="text-lg font-bold text-neutral-900 tabular-nums leading-tight">
              {isOpen ? 'Actual: ' : isClosed ? 'Precio final: ' : ''}{fmt(g.currentPrice)}
            </p>
          </div>
          {isOpen ? (
            <span className="inline-flex items-center gap-1.5 bg-brand text-white text-xs font-bold px-4 py-2.5 rounded-xl">
              Bloquear por {fmt(g.currentPrice)}
            </span>
          ) : (
            <span className={`inline-flex items-center text-xs font-semibold px-3 py-2 rounded-xl border ${
              isClosed ? 'border-neutral-200 text-neutral-700' : 'border-neutral-200 text-neutral-400'
            }`}>
              {isClosed ? 'Ver resultado' : statusLabel}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Desktop Section ────────────────────────────────────────

function DesktopSection({
  title,
  subtitle,
  groups,
  dotColor,
}: {
  title: string
  subtitle: string
  groups: RadarGroup[]
  dotColor: string
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <h2 className="text-base font-bold text-neutral-900">{title}</h2>
      </div>
      <p className="text-xs text-neutral-500 mb-3 ml-4">{subtitle}</p>
      <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden divide-y divide-neutral-100">
        {groups.map(g => <DesktopRadarRow key={g.id} group={g} />)}
      </div>
    </div>
  )
}

// ─── Desktop Row ────────────────────────────────────────────

function DesktopRadarRow({ group: g }: { group: RadarGroup }) {
  const isOpen = g.status === 'open'
  const isClosed = g.status === 'closed'
  const completedMax = g.maxStock > 0 && g.totalUnits >= g.maxStock

  // Countdown
  let timeLabel = ''
  if (isOpen && g.closesAt) {
    const diff = Math.max(0, new Date(g.closesAt).getTime() - Date.now())
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    timeLabel = d > 0 ? `${d}d ${h}h` : `${h}h`
  } else if (isClosed && g.closesAt) {
    timeLabel = `Terminado el ${new Date(g.closesAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
  }

  return (
    <Link href={`/grupo/${g.id}`} className="block hover:bg-neutral-50/50 transition-colors">
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Favorite toggle */}
        <FavoriteButton groupId={g.id} initialFavorited={true} size={18} showToast={false} />

        {/* Product image */}
        <div className="w-16 h-16 rounded-xl bg-neutral-50 flex-shrink-0 flex items-center justify-center overflow-hidden">
          {g.imageUrl ? (
            <img src={g.imageUrl} alt={g.name} className="w-full h-full object-cover" />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-neutral-200"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          )}
        </div>

        {/* Name + spec + badge */}
        <div className="w-[180px] flex-shrink-0">
          <p className="text-sm font-semibold text-neutral-900 truncate">{g.name}</p>
          {g.spec && <p className="text-xs text-neutral-500 truncate">{g.spec}</p>}
          {isOpen && completedMax && (
            <span className="inline-flex items-center mt-1 text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
              ¡Completado!
            </span>
          )}
          {isOpen && !completedMax && g.missing > 0 && (
            <span className="inline-flex items-center mt-1 text-[10px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-full">
              A punto de bajar
            </span>
          )}
          {!isOpen && (
            <span className={`inline-flex items-center mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              isClosed ? 'text-neutral-600 bg-neutral-100' : 'text-neutral-400 bg-neutral-50'
            }`}>
              {isClosed ? 'Finalizado' : 'Cancelado'}
            </span>
          )}
        </div>

        {/* Wave progress */}
        <div className="flex-1 min-w-[140px]">
          <WaveProgress current={g.totalUnits} max={g.maxStock} height={24} />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-neutral-500 tabular-nums">{g.totalUnits} / {g.maxStock} uds</span>
            {isOpen && g.nextPrice ? (
              <span className="text-[10px] text-neutral-400">{fmt(g.nextPrice)}</span>
            ) : isClosed ? (
              <span className="text-[10px] text-neutral-400">Precio final</span>
            ) : null}
          </div>
        </div>

        {/* Urgency / status */}
        <div className="w-[120px] flex-shrink-0 text-center">
          {isOpen && g.missing > 0 ? (
            <span className="inline-flex items-center text-[11px] font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
              Faltan {g.missing} uds
            </span>
          ) : isOpen && completedMax ? (
            <span className="inline-flex items-center text-[11px] font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
              ¡Completado!
            </span>
          ) : !isOpen ? (
            <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full ${
              isClosed ? 'text-neutral-600 bg-neutral-100' : 'text-neutral-400 bg-neutral-50'
            }`}>
              {isClosed ? 'Finalizado' : 'No se alcanzó el mínimo'}
            </span>
          ) : null}
          {timeLabel && (
            <p className="text-[10px] text-neutral-400 mt-1 flex items-center justify-center gap-1">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
              {timeLabel}
            </p>
          )}
        </div>

        {/* Price */}
        <div className="w-[120px] flex-shrink-0 text-right">
          <p className="text-base font-bold text-neutral-900 tabular-nums">{fmt(g.currentPrice)}</p>
          {g.pvp > 0 && (
            <p className="text-xs text-neutral-400 line-through">{fmt(g.pvp)}</p>
          )}
        </div>

        {/* CTA */}
        <div className="w-[120px] flex-shrink-0">
          {isOpen ? (
            <span className="flex items-center justify-center bg-brand text-white text-xs font-bold py-2.5 rounded-xl w-full">
              Ver grupo
            </span>
          ) : (
            <span className="flex items-center justify-center border border-neutral-200 text-neutral-700 text-xs font-semibold py-2.5 rounded-xl w-full">
              Ver grupo
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Empty state ────────────────────────────────────────────

function EmptyRadar() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand">
          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
        </svg>
      </div>
      <p className="text-base font-semibold text-neutral-900 mb-1">Tu radar está vacío</p>
      <p className="text-sm text-neutral-500 text-center mb-4">
        Explora grupos y añade productos a tu radar para no perderte nada.
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
