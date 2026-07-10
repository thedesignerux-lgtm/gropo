import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import WaveProgress from '@/components/WaveProgress'
import RadarCardMenu from '@/components/RadarCardMenu'
import BottomNav from '@/components/BottomNav'
import HomeSidebar from '@/components/desktop/HomeSidebar'
import CountdownChip from '@/components/CountdownChip'

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
  waveColor: 'orange' | 'brand' | 'green' | 'gray'
  cardBorder: string
  badgeLabel: string
  badgeClass: string
  ctaClass: string
}> = {
  hot: {
    icon: '🔥',
    title: 'Necesitan tu atención',
    subtitle: 'Oportunidades a punto de bajar.',
    waveColor: 'orange',
    cardBorder: 'border-orange-200 hover:border-orange-300',
    badgeLabel: 'ATENCIÓN',
    badgeClass: 'bg-orange-500 text-white',
    ctaClass: 'bg-orange-500 hover:bg-orange-600 text-white',
  },
  dropping: {
    icon: '⬇️',
    title: 'Han bajado recientemente',
    subtitle: 'Grupos que han reducido su precio.',
    waveColor: 'brand',
    cardBorder: 'border-brand/20 hover:border-brand/30',
    badgeLabel: 'BAJADA',
    badgeClass: 'bg-brand text-white',
    ctaClass: 'bg-brand hover:bg-brand-dark text-white',
  },
  secured: {
    icon: '🔒',
    title: 'Plaza asegurada',
    subtitle: 'Ya has bloqueado tu precio en estos grupos.',
    waveColor: 'green',
    cardBorder: 'border-green-200 hover:border-green-300',
    badgeLabel: 'CONSEGUIDO',
    badgeClass: 'bg-green-600 text-white',
    ctaClass: 'bg-green-600 hover:bg-green-700 text-white',
  },
  history: {
    icon: '📦',
    title: 'Historial',
    subtitle: 'Grupos finalizados en los que participaste.',
    waveColor: 'gray',
    cardBorder: 'border-neutral-200',
    badgeLabel: 'FINALIZADO',
    badgeClass: 'bg-neutral-400 text-white',
    ctaClass: 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700',
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
      {/* ═══════════ Desktop ═══════════ */}
      <div className="hidden lg:block min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
        {/* Header — same as Home */}
        <header className="bg-white border-b border-neutral-100 sticky top-0 z-30">
          <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
            <a href="/" aria-label="Vonda - inicio">
              <img src="/logo.png" alt="Vonda" className="h-8 w-auto" />
            </a>

            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Busca productos, marcas o categorías..."
                  className="w-full h-10 pl-10 pr-4 rounded-full border border-neutral-200 bg-white text-sm text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <CountdownChip />
              <a href="/favoritos" className="relative text-brand" aria-label="Mi Radar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                </svg>
              </a>
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-semibold text-neutral-600">V</div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
          </div>
        </header>

        {/* Body: Sidebar + Content */}
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <div className="flex gap-8">
            {/* Sidebar — reused from Home */}
            <HomeSidebar />

            {/* Main content */}
            <main className="flex-1 min-w-0">
              {/* Page header */}
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-neutral-900">Mi Radar</h1>
                <p className="text-sm text-neutral-500 mt-1">Tu panel de oportunidades. El radar piensa por ti.</p>
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
                        {/* Section header */}
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base">{meta.icon}</span>
                              <h2 className="text-base font-bold text-neutral-900">{meta.title}</h2>
                            </div>
                            <p className="text-xs text-neutral-500 mt-0.5 ml-7">{meta.subtitle}</p>
                          </div>
                          {items.length > 3 && (
                            <span className="text-sm font-semibold text-brand hover:underline cursor-pointer flex items-center gap-1">
                              Ver todas ({items.length})
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                            </span>
                          )}
                        </div>

                        {/* 3-column grid — uniform across ALL sections */}
                        <div className="grid grid-cols-3 gap-5">
                          {items.slice(0, 6).map(g => (
                            <OpportunityCard key={g.id} group={g} category={cat} />
                          ))}
                        </div>
                      </section>
                    )
                  })}
                </div>
              )}

              {/* Footer trust bar */}
              {groups.length > 0 && (
                <div className="mt-10 border-t border-neutral-200 pt-6">
                  <div className="flex items-center justify-center gap-12 text-sm text-neutral-500">
                    <div className="flex items-center gap-2">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-neutral-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      <span className="text-xs text-neutral-500">Pago seguro</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-neutral-400"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      <span className="text-xs text-neutral-500">Tu dinero siempre protegido</span>
                    </div>
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>

      {/* ═══════════ Mobile ═══════════ */}
      <div className="lg:hidden min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
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
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{meta.icon}</span>
                        <h2 className="text-sm font-bold text-neutral-900">{meta.title}</h2>
                        <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full">{items.length}</span>
                      </div>
                    </div>
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
    timeLabel = `${d}d ${String(h).padStart(2, '0')}h restantes`
  }

  // Urgency text
  let urgencyText = ''
  if (category === 'hot' && g.missing > 0) {
    urgencyText = `Faltan ${g.missing} unidades`
  } else if (category === 'hot') {
    urgencyText = 'Cierra pronto'
  } else if (category === 'dropping') {
    urgencyText = 'Precio en movimiento'
  }

  // Savings
  const savings = g.pvp > 0 && g.currentPrice < g.pvp ? g.pvp - g.currentPrice : 0

  // Price arrow for open groups with next tier
  const showPriceArrow = isOpen && g.nextPrice != null

  return (
    <Link href={`/grupo/${g.id}`} className="block group/card">
      <div className={`bg-white rounded-2xl border-2 overflow-hidden transition-all group-hover/card:shadow-lg ${meta.cardBorder} ${
        isHistory ? 'opacity-60 grayscale' : ''
      }`}>

        {/* ── Row 1: Badge + urgency + ⋮ ── */}
        <div className="px-4 pt-4 pb-1">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${meta.badgeClass}`}>
                  {category === 'hot' && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="opacity-90"><path d="M12 2c1 3 3.5 5 6 6-1 4-3 7-6 10-3-3-5-6-6-10 2.5-1 5-3 6-6z"/></svg>
                  )}
                  {category === 'secured' && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                  {meta.badgeLabel}
                </span>
                {urgencyText && (
                  <span className={`text-xs font-semibold ${
                    category === 'hot' ? 'text-orange-600' : 'text-brand'
                  }`}>{urgencyText}</span>
                )}
              </div>
              {timeLabel && (
                <span className="text-[10px] text-neutral-400 flex items-center gap-1 mt-1.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
                  {timeLabel}
                </span>
              )}
              {isHistory && g.closesAt && (
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Finalizado el {new Date(g.closesAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </span>
              )}
              {isClosed && g.closesAt && (
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Finaliza en {(() => {
                    const diff = Math.max(0, new Date(g.closesAt).getTime() - Date.now())
                    const d = Math.floor(diff / 86400000); const h = Math.floor((diff % 86400000) / 3600000)
                    return d > 0 ? `${d}d ${h}h` : `${h}h`
                  })()}
                </span>
              )}
            </div>
            <RadarCardMenu groupId={g.id} />
          </div>
        </div>

        {/* ── Row 2: Wave ticker (large, ~30% height, emotional, NO axes) ── */}
        <div className="px-4 py-3">
          <WaveProgress
            current={g.totalUnits}
            max={g.maxStock > 0 ? g.maxStock : Math.max(g.totalUnits * 2, 10)}
            height={80}
            showHalo
            colorScheme={meta.waveColor}
            showDot={isOpen}
            seed={g.id}
          />
        </div>

        {/* ── Row 3: Price block (current → ↓ → next) ── */}
        <div className="px-4 pb-3">
          {showPriceArrow ? (
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-neutral-900 tabular-nums">{fmt(g.currentPrice)}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-300 flex-shrink-0">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
              <span className="text-xl font-bold text-green-600 tabular-nums">{fmt(g.nextPrice!)}</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-3">
              <span className="text-xl font-bold text-neutral-900 tabular-nums">{fmt(g.currentPrice)}</span>
              {g.pvp > 0 && g.pvp !== g.currentPrice && (
                <span className="text-sm text-neutral-400 line-through tabular-nums">{fmt(g.pvp)}</span>
              )}
            </div>
          )}
          {!isOpen && savings > 0.01 && (
            <p className="text-xs font-semibold text-green-600 mt-1.5">
              Ahorro conseguido: {fmt(savings)}
            </p>
          )}
        </div>

        {/* ── Row 4: CTA full-width ── */}
        {!isHistory && (
          <div className="px-4 pb-4">
            <span className={`flex items-center justify-center w-full py-3 rounded-xl text-sm font-bold transition-all ${meta.ctaClass}`}>
              {isOpen ? 'Bloquear precio' : 'Ver resultado'}
            </span>
          </div>
        )}

        {/* ── Row 5: Product footer (secondary, bottom) ── */}
        <div className="border-t border-neutral-100 px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-neutral-50 flex-shrink-0 flex items-center justify-center overflow-hidden">
            {g.imageUrl ? (
              <img src={g.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-neutral-200" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-neutral-700 truncate">{g.name}</p>
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
