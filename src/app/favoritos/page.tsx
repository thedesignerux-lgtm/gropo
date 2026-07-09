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

// ─── Categorización ────────────────────────────────────────

type RadarCategory = 'hot' | 'dropping' | 'secured' | 'history'

function categorize(groups: RadarGroup[]): Record<RadarCategory, RadarGroup[]> {
  const hot: RadarGroup[] = []
  const dropping: RadarGroup[] = []
  const secured: RadarGroup[] = []
  const history: RadarGroup[] = []

  for (const g of groups) {
    if (g.status === 'closed') {
      secured.push(g)
    } else if (g.status === 'cancelled') {
      history.push(g)
    } else if (g.status === 'open') {
      // Hot: near a tier unlock (missing ≤ 8) or closing soon (< 24h)
      const hoursLeft = Math.max(0, (new Date(g.closesAt).getTime() - Date.now()) / 3600000)
      if ((g.missing > 0 && g.missing <= 8) || hoursLeft < 24) {
        hot.push(g)
      } else {
        dropping.push(g)
      }
    }
  }

  return { hot, dropping, secured, history }
}

const CATEGORY_META: Record<RadarCategory, {
  icon: string
  title: string
  subtitle: string
  waveColor: 'orange' | 'brand' | 'green'
}> = {
  hot: {
    icon: '🔥',
    title: 'Necesitan tu atención',
    subtitle: 'A punto de bajar de precio o cerrando pronto.',
    waveColor: 'orange',
  },
  dropping: {
    icon: '⬇️',
    title: 'Han bajado recientemente',
    subtitle: 'Grupos en los que sigues la evolución del precio.',
    waveColor: 'brand',
  },
  secured: {
    icon: '🔒',
    title: 'Plaza asegurada',
    subtitle: 'Grupos cerrados en los que participaste o seguiste.',
    waveColor: 'green',
  },
  history: {
    icon: '📦',
    title: 'Historial',
    subtitle: 'Grupos que no alcanzaron el mínimo necesario.',
    waveColor: 'brand',
  },
}

// ─── Page ───────────────────────────────────────────────────

export default async function RadarPage() {
  const result = await fetchRadar()
  if (!result) redirect('/login?next=/favoritos')

  const { groups } = result
  const cats = categorize(groups)
  const orderedCats: RadarCategory[] = ['hot', 'dropping', 'secured', 'history']

  return (
    <>
      {/* ─── Desktop ─── */}
      <div className="hidden lg:block min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
        <header className="bg-white border-b border-neutral-100 sticky top-0 z-30">
          <div className="max-w-[1360px] mx-auto px-8 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Volver a grupos
            </a>
          </div>
        </header>

        <div className="max-w-[1360px] mx-auto px-8 py-10">
          {/* Header */}
          <div className="flex items-center gap-3 mb-10">
            <h1 className="text-2xl font-bold text-neutral-900">Mi Radar</h1>
            {groups.length > 0 && (
              <span className="text-xs font-semibold bg-neutral-900 text-white px-2.5 py-1 rounded-full">
                {groups.length}
              </span>
            )}
          </div>

          {groups.length === 0 ? (
            <EmptyRadar />
          ) : (
            <div className="space-y-14">
              {orderedCats.map(cat => {
                const items = cats[cat]
                if (items.length === 0) return null
                const meta = CATEGORY_META[cat]
                return (
                  <section key={cat}>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className="text-lg">{meta.icon}</span>
                      <h2 className="text-lg font-bold text-neutral-900">{meta.title}</h2>
                      <span className="text-xs font-semibold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">{items.length}</span>
                    </div>
                    <p className="text-sm text-neutral-500 mb-6 ml-8">{meta.subtitle}</p>

                    <div className="grid grid-cols-3 gap-6">
                      {items.map(g => (
                        <RadarCard key={g.id} group={g} category={cat} />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Mobile ─── */}
      <div className="lg:hidden min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
        <div className="max-w-md mx-auto min-h-screen pb-28">
          <div className="px-4 pt-6 pb-2">
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-xl font-bold text-neutral-900">Mi Radar</h1>
              {groups.length > 0 && (
                <span className="text-[11px] font-semibold bg-neutral-900 text-white px-2 py-0.5 rounded-full">
                  {groups.length}
                </span>
              )}
            </div>
          </div>

          {groups.length === 0 ? (
            <div className="px-4"><EmptyRadar /></div>
          ) : (
            <div className="px-4 space-y-8 mt-2">
              {orderedCats.map(cat => {
                const items = cats[cat]
                if (items.length === 0) return null
                const meta = CATEGORY_META[cat]
                return (
                  <section key={cat}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{meta.icon}</span>
                      <h2 className="text-sm font-bold text-neutral-900">{meta.title}</h2>
                      <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full">{items.length}</span>
                    </div>
                    <div className="space-y-4">
                      {items.map(g => (
                        <RadarCard key={g.id} group={g} category={cat} />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    </>
  )
}

// ─── Radar Card (unified desktop + mobile) ─────────────────

function RadarCard({ group: g, category }: { group: RadarGroup; category: RadarCategory }) {
  const meta = CATEGORY_META[category]
  const isOpen = g.status === 'open'
  const isClosed = g.status === 'closed'

  // Countdown
  let timeLabel = ''
  if (isOpen && g.closesAt) {
    const diff = Math.max(0, new Date(g.closesAt).getTime() - Date.now())
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    timeLabel = d > 0 ? `${d}d ${h}h` : `${h}h`
  }

  // Urgency label
  let urgencyLabel = ''
  let urgencyStyle = ''
  if (category === 'hot' && isOpen) {
    if (g.missing > 0 && g.missing <= 8) {
      urgencyLabel = `Faltan ${g.missing} unidades`
      urgencyStyle = 'text-orange-700 bg-orange-50'
    } else {
      urgencyLabel = `Cierra en ${timeLabel}`
      urgencyStyle = 'text-red-700 bg-red-50'
    }
  } else if (category === 'dropping') {
    urgencyLabel = 'Siguiendo'
    urgencyStyle = 'text-brand bg-brand/10'
  } else if (category === 'secured') {
    urgencyLabel = 'Plaza asegurada'
    urgencyStyle = 'text-green-700 bg-green-50'
  } else if (category === 'history') {
    urgencyLabel = 'No ejecutado'
    urgencyStyle = 'text-neutral-500 bg-neutral-100'
  }

  const discount = g.pvp > 0 && g.currentPrice < g.pvp
    ? Math.round(((g.pvp - g.currentPrice) / g.pvp) * 100)
    : 0

  return (
    <div className="bg-white rounded-2xl overflow-hidden transition-all hover:shadow-md"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)' }}>

      {/* Top: urgency badge + ⋮ menu */}
      <div className="flex items-center justify-between px-5 pt-4 pb-1">
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${urgencyStyle}`}>
          {urgencyLabel}
        </span>
        <div className="flex items-center gap-2">
          {timeLabel && isOpen && category !== 'hot' && (
            <span className="text-[10px] text-neutral-400 flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
              {timeLabel}
            </span>
          )}
          <FavoriteButton groupId={g.id} initialFavorited={true} size={16} showToast={false} />
        </div>
      </div>

      {/* Center: WAVE (large, ~30% of card) with halo */}
      <div className="px-5 py-3">
        <WaveProgress
          current={g.totalUnits}
          max={g.maxStock > 0 ? g.maxStock : Math.max(g.totalUnits * 2, 10)}
          height={48}
          showHalo
          colorScheme={meta.waveColor}
          showDot
        />
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-neutral-400 tabular-nums">{g.totalUnits} / {g.maxStock > 0 ? g.maxStock : '∞'} uds</span>
          {discount > 0 && (
            <span className="text-[11px] font-bold text-green-600">-{discount}%</span>
          )}
        </div>
      </div>

      {/* Price block */}
      <div className="px-5 pb-2">
        <div className="flex items-end gap-3">
          <span className="text-2xl font-bold text-neutral-900 tabular-nums leading-none">
            {fmt(g.currentPrice)}
          </span>
          {g.pvp > 0 && g.pvp !== g.currentPrice && (
            <span className="text-sm text-neutral-400 line-through tabular-nums leading-none mb-0.5">
              {fmt(g.pvp)}
            </span>
          )}
        </div>
        {isOpen && g.nextPrice && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
              <polyline points="17 18 23 18 23 12" />
            </svg>
            <span className="text-xs font-semibold text-green-600">
              Siguiente: {fmt(g.nextPrice)}
            </span>
          </div>
        )}
      </div>

      {/* CTA — full width */}
      <div className="px-5 pb-3 pt-1">
        <Link
          href={`/grupo/${g.id}`}
          className={`flex items-center justify-center w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${
            isOpen
              ? category === 'hot'
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-brand text-white hover:bg-brand-dark'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
          }`}
        >
          {isOpen
            ? `Bloquear por ${fmt(g.currentPrice)}`
            : isClosed
              ? 'Ver resultado'
              : 'Ver grupo'
          }
        </Link>
      </div>

      {/* Product info — bottom, secondary */}
      <div className="border-t border-neutral-100 px-5 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-neutral-50 flex-shrink-0 flex items-center justify-center overflow-hidden">
          {g.imageUrl ? (
            <img src={g.imageUrl} alt={g.name} className="w-full h-full object-cover" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-neutral-200"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-neutral-600 truncate">{g.name}</p>
          {g.spec && <p className="text-[10px] text-neutral-400 truncate">{g.spec}</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ────────────────────────────────────────────

function EmptyRadar() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center mb-5">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand">
          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
        </svg>
      </div>
      <p className="text-lg font-bold text-neutral-900 mb-1">Tu radar está vacío</p>
      <p className="text-sm text-neutral-500 text-center mb-5 max-w-xs">
        Explora grupos y añade productos a tu radar para seguir las mejores oportunidades.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-brand text-white text-sm font-bold rounded-xl hover:bg-brand-dark transition-colors"
      >
        Explorar grupos
      </Link>
    </div>
  )
}
