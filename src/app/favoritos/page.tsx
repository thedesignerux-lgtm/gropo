import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import WaveProgress from '@/components/WaveProgress'
import RadarCardMenu from '@/components/RadarCardMenu'
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
      const hoursLeft = Math.max(0, (new Date(g.closesAt).getTime() - Date.now()) / 3600000)
      if ((g.missing > 0 && g.missing <= 8) || hoursLeft < 48) {
        hot.push(g)
      } else {
        dropping.push(g)
      }
    }
  }

  return { hot, dropping, secured, history }
}

const SECTION_META: Record<RadarCategory, {
  icon: string
  title: string
  subtitle: string
  waveColor: 'orange' | 'brand' | 'green'
}> = {
  hot: {
    icon: '🔥',
    title: 'Necesitan tu atención',
    subtitle: 'Oportunidades a punto de bajar.',
    waveColor: 'orange',
  },
  dropping: {
    icon: '⬇️',
    title: 'Han bajado recientemente',
    subtitle: 'Grupos que han reducido su precio.',
    waveColor: 'brand',
  },
  secured: {
    icon: '🔒',
    title: 'Plaza asegurada',
    subtitle: 'Ya has bloqueado tu precio en estos grupos.',
    waveColor: 'green',
  },
  history: {
    icon: '📦',
    title: 'Historial',
    subtitle: 'Grupos finalizados en los que participaste.',
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
          <div className="mb-10">
            <h1 className="text-2xl font-bold text-neutral-900">Mi Radar</h1>
            <p className="text-sm text-neutral-500 mt-1">Tu panel de oportunidades. El radar piensa por ti.</p>
          </div>

          {groups.length === 0 ? (
            <EmptyRadar />
          ) : (
            <div className="space-y-12">
              {orderedCats.map(cat => {
                const items = cats[cat]
                if (items.length === 0) return null
                const meta = SECTION_META[cat]
                return (
                  <section key={cat}>
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{meta.icon}</span>
                          <h2 className="text-base font-bold text-neutral-900">{meta.title}</h2>
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5 ml-8">{meta.subtitle}</p>
                      </div>
                      {items.length > 3 && (
                        <span className="text-xs font-semibold text-brand hover:underline cursor-pointer">
                          Ver todas ({items.length}) →
                        </span>
                      )}
                    </div>

                    {/* Always 3 columns — all sections */}
                    <div className="grid grid-cols-3 gap-6">
                      {items.map(g => (
                        <OpportunityCard key={g.id} group={g} category={cat} />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Tablet ─── */}
      <div className="hidden md:block lg:hidden min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-xl font-bold text-neutral-900">Mi Radar</h1>
            <p className="text-sm text-neutral-500 mt-1">Tu panel de oportunidades.</p>
          </div>

          {groups.length === 0 ? (
            <EmptyRadar />
          ) : (
            <div className="space-y-10">
              {orderedCats.map(cat => {
                const items = cats[cat]
                if (items.length === 0) return null
                const meta = SECTION_META[cat]
                return (
                  <section key={cat}>
                    <div className="flex items-center gap-2 mb-4">
                      <span>{meta.icon}</span>
                      <h2 className="text-sm font-bold text-neutral-900">{meta.title}</h2>
                      <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full">{items.length}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      {items.map(g => (
                        <OpportunityCard key={g.id} group={g} category={cat} />
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
      <div className="md:hidden min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
        <div className="min-h-screen pb-28">
          <div className="px-4 pt-6 pb-1">
            <h1 className="text-lg font-bold text-neutral-900">Mi Radar</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Tu panel de oportunidades.</p>
          </div>

          {groups.length === 0 ? (
            <div className="px-4"><EmptyRadar /></div>
          ) : (
            <div className="px-4 space-y-8 mt-4">
              {orderedCats.map(cat => {
                const items = cats[cat]
                if (items.length === 0) return null
                const meta = SECTION_META[cat]
                return (
                  <section key={cat}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">{meta.icon}</span>
                      <h2 className="text-sm font-bold text-neutral-900">{meta.title}</h2>
                      <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full">{items.length}</span>
                    </div>
                    {/* 1 column, edge-to-edge */}
                    <div className="space-y-4">
                      {items.map(g => (
                        <OpportunityCard key={g.id} group={g} category={cat} />
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

// ─── OpportunityCard ───────────────────────────────────────
// Jerarquía: 1. Halo de Color → 2. Ticker (Ola) → 3. Precio → 4. CTA

function OpportunityCard({ group: g, category }: { group: RadarGroup; category: RadarCategory }) {
  const meta = SECTION_META[category]
  const isOpen = g.status === 'open'
  const isClosed = g.status === 'closed'
  const isHistory = category === 'history'

  // Countdown
  let timeLabel = ''
  if (isOpen && g.closesAt) {
    const diff = Math.max(0, new Date(g.closesAt).getTime() - Date.now())
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    timeLabel = d > 0 ? `${d}d ${h}h restantes` : `${h}h restantes`
  }

  // Status badge
  let badgeLabel = ''
  let badgeClass = ''
  if (category === 'hot') {
    badgeLabel = 'ATENCIÓN'
    badgeClass = 'bg-orange-500 text-white'
  } else if (category === 'dropping') {
    badgeLabel = 'BAJADA'
    badgeClass = 'bg-brand text-white'
  } else if (category === 'secured') {
    badgeLabel = 'CONSEGUIDO'
    badgeClass = 'bg-green-600 text-white'
  } else {
    badgeLabel = 'FINALIZADO'
    badgeClass = 'bg-neutral-400 text-white'
  }

  // Urgency text (right of badge)
  let urgencyText = ''
  if (category === 'hot' && g.missing > 0) {
    urgencyText = `Faltan ${g.missing} unidades`
  } else if (category === 'hot') {
    urgencyText = `Cierra pronto`
  }

  // Savings for secured/history
  const savings = g.pvp > 0 && g.currentPrice < g.pvp ? g.pvp - g.currentPrice : 0

  // Next price (for open groups) or final price logic
  const showPriceArrow = isOpen && g.nextPrice != null
  const targetPrice = g.nextPrice ?? g.currentPrice

  return (
    <Link href={`/grupo/${g.id}`} className="block group">
      <div className={`bg-white rounded-2xl overflow-hidden transition-all group-hover:shadow-md ${
        isHistory ? 'opacity-60 grayscale' : ''
      }`}
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)' }}
      >
        {/* ── Header: Badge + urgency + ⋮ ── */}
        <div className="flex items-start justify-between px-5 pt-4 pb-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${badgeClass}`}>
                {category === 'hot' && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="opacity-80"><path d="M12 2c1 3 3.5 5 6 6-1 4-3 7-6 10-3-3-5-6-6-10 2.5-1 5-3 6-6z"/></svg>
                )}
                {category === 'secured' && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-80"><polyline points="20 6 9 17 4 12"/></svg>
                )}
                {badgeLabel}
              </span>
              {urgencyText && (
                <span className="text-xs font-semibold text-orange-600">{urgencyText}</span>
              )}
            </div>
            {timeLabel && (
              <span className="text-[10px] text-neutral-400 flex items-center gap-1 ml-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
                {timeLabel}
              </span>
            )}
            {isClosed && g.closesAt && (
              <span className="text-[10px] text-neutral-400">
                Finaliza en {(() => {
                  const diff = Math.max(0, new Date(g.closesAt).getTime() - Date.now())
                  const d = Math.floor(diff / 86400000)
                  const h = Math.floor((diff % 86400000) / 3600000)
                  return d > 0 ? `${d}d ${h}h` : `${h}h`
                })()}
              </span>
            )}
            {isHistory && g.closesAt && (
              <span className="text-[10px] text-neutral-400">
                Finalizado el {new Date(g.closesAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
          {/* Single ⋮ menu — consolidated (Ley de Hick) */}
          <RadarCardMenu groupId={g.id} />
        </div>

        {/* ── Wave ticker (emotional, no axes) ── */}
        <div className="px-5 py-2">
          <WaveProgress
            current={g.totalUnits}
            max={g.maxStock > 0 ? g.maxStock : Math.max(g.totalUnits * 2, 10)}
            height={56}
            showHalo
            colorScheme={meta.waveColor}
            showDot={isOpen}
          />
        </div>

        {/* ── Price block: current → next ── */}
        <div className="px-5 pb-2">
          {showPriceArrow ? (
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-neutral-900 tabular-nums">{fmt(g.currentPrice)}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-300 mx-2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
              <span className="text-xl font-bold text-green-600 tabular-nums">{fmt(targetPrice)}</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-3">
              <span className="text-xl font-bold text-neutral-900 tabular-nums">{fmt(g.currentPrice)}</span>
              {g.pvp > 0 && g.pvp !== g.currentPrice && (
                <span className="text-sm text-neutral-400 line-through tabular-nums">{fmt(g.pvp)}</span>
              )}
            </div>
          )}

          {/* Savings callout for secured/history */}
          {!isOpen && savings > 0.01 && (
            <p className="text-xs font-semibold text-green-600 mt-1">
              Ahorro conseguido: {fmt(savings)}
            </p>
          )}
        </div>

        {/* ── CTA — full width (only for active groups) ── */}
        {!isHistory && (
          <div className="px-5 pb-4 pt-1">
            <span className={`flex items-center justify-center w-full py-3 rounded-xl text-sm font-bold transition-all ${
              category === 'hot'
                ? 'bg-orange-500 text-white group-hover:bg-orange-600'
                : category === 'secured'
                  ? 'bg-green-600 text-white group-hover:bg-green-700'
                  : 'bg-brand text-white group-hover:bg-brand-dark'
            }`}>
              {isOpen ? 'Bloquear precio' : 'Ver resultado'}
            </span>
          </div>
        )}

        {/* ── Product footer (secondary) ── */}
        <div className={`border-t border-neutral-100 px-5 py-3 flex items-center gap-3 ${
          isHistory ? 'opacity-70' : ''
        }`}>
          <div className="w-9 h-9 rounded-lg bg-neutral-50 flex-shrink-0 flex items-center justify-center overflow-hidden">
            {g.imageUrl ? (
              <img src={g.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-neutral-200" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-neutral-600 truncate">{g.name}</p>
            {g.spec && <p className="text-[10px] text-neutral-400 truncate">{g.spec}</p>}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Empty state ────────────────────────────────────────────

function EmptyRadar() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center mb-5">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
        </svg>
      </div>
      <p className="text-lg font-bold text-neutral-900 mb-1">Tu radar está despejado</p>
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
