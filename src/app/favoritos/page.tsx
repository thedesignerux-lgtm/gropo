import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import TierProgress from '@/components/TierProgress'
import RadarCardMenu from '@/components/RadarCardMenu'
import BottomNav from '@/components/BottomNav'
import HomeSidebar from '@/components/desktop/HomeSidebar'
import CountdownChip from '@/components/CountdownChip'

export const dynamic = 'force-dynamic'

// Umbral de densidad alta: a partir de aquí se inyectan divisores de sección.
const HIGH_DENSITY_THRESHOLD = 5

function fmt(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

// ─── Data fetching ──────────────────────────────────────────

interface Tier {
  units: number
  price: number
  unlocked: boolean
}

interface RadarGroup {
  id: string
  name: string
  spec: string
  pvp: number
  imageUrl: string | null
  currentUnits: number
  maxStock: number
  status: string
  closesAt: string
  currentPrice: number
  nextPrice: number | null
  missing: number
  tiers: Tier[]
}

interface Suggestion {
  id: string
  name: string
  spec: string
  imageUrl: string | null
}

async function fetchRadar(): Promise<{ groups: RadarGroup[]; suggestions: Suggestion[] } | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: favs } = await supabase
    .from('favorites')
    .select('group_id')
    .eq('auth_id', user.id)

  const groupIds = (favs ?? []).map((f: any) => f.group_id)

  // Sugerencias para el cross-selling (grupos abiertos que el usuario aún no sigue).
  async function fetchSuggestions(exclude: string[]): Promise<Suggestion[]> {
    try {
      let q = supabaseAdmin
        .from('groups')
        .select('id, product_name, product_spec, image_url')
        .eq('status', 'open')
        .limit(3)
      if (exclude.length > 0) q = q.not('id', 'in', `(${exclude.join(',')})`)
      const { data } = await q
      return (data ?? []).map((g: any) => ({
        id: g.id,
        name: g.product_name,
        spec: g.product_spec ?? '',
        imageUrl: g.image_url ?? null,
      }))
    } catch {
      return []
    }
  }

  if (groupIds.length === 0) {
    return { groups: [], suggestions: await fetchSuggestions([]) }
  }

  const { data: groups } = await supabaseAdmin
    .from('groups')
    .select('id, product_name, product_spec, pvp, image_url, total_units, status, closes_at')
    .in('id', groupIds)

  if (!groups || groups.length === 0) {
    return { groups: [], suggestions: await fetchSuggestions(groupIds) }
  }

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

    const currentUnits = (ladder as any[]).length > 0
      ? Math.max(...(ladder as any[]).map((t: any) => Number(t.effective_demand ?? 0)))
      : Number(g.total_units ?? 0)

    // Tramos ascendentes por unidades para la barra de tiers.
    const tiers: Tier[] = (ladder as any[])
      .map((t: any) => ({
        units: Number(t.min_units),
        price: Number(t.price),
        unlocked: Boolean(t.unlocked),
      }))
      .sort((a, b) => a.units - b.units)

    return {
      id: g.id,
      name: g.product_name,
      spec: g.product_spec ?? '',
      pvp: Number(g.pvp ?? 0),
      imageUrl: g.image_url ?? null,
      currentUnits,
      maxStock: maxStockByGroup[g.id] ?? 0,
      status: g.status,
      closesAt: g.closes_at,
      currentPrice,
      nextPrice: nextTier ? Number(nextTier.price) : null,
      missing,
      tiers,
    }
  })

  return { groups: enriched, suggestions: await fetchSuggestions(groupIds) }
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

// ─── Page ───────────────────────────────────────────────────

export default async function RadarPage() {
  const result = await fetchRadar()
  if (!result) redirect('/login?next=/favoritos')

  const { groups, suggestions } = result
  const cats = categorize(groups)
  const activeCount = cats.hot.length + cats.dropping.length + cats.secured.length
  const hasAnything = activeCount + cats.history.length > 0

  return (
    <>
      {/* ═══════════ Desktop ═══════════ */}
      <div className="hidden lg:flex min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
        <HomeSidebar promo="radar" activeCount={activeCount} />

        {/* Content column */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top bar (sobre el contenido, sin logo — el logo vive en el sidebar) */}
          <header className="sticky top-0 z-20 px-8 h-16 flex items-center gap-4" style={{ backgroundColor: 'rgba(247,249,252,0.85)', backdropFilter: 'blur(8px)' }}>
            <div className="flex-1 max-w-md relative">
              <input
                type="text"
                placeholder="Busca productos, marcas o categorías..."
                className="w-full h-10 pl-10 pr-4 rounded-full border border-neutral-200 bg-white text-sm text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <CountdownChip />
            <button className="relative text-neutral-500 hover:text-brand transition-colors" aria-label="Notificaciones">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 border-2 border-[#F7F9FC]" />
            </button>
            <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-sm font-semibold text-white">V</div>
          </header>

          <main className="w-full max-w-[1180px] px-8 pb-16 pt-2">
            {/* Título + tag + herramientas */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-[30px] font-extrabold text-neutral-900 tracking-tight">Mi Radar</h1>
                  {hasAnything && (
                    <span className="bg-brand/10 text-brand text-xs font-semibold px-2.5 py-1 rounded-full">
                      {activeCount} {activeCount === 1 ? 'oportunidad' : 'oportunidades'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-neutral-500 mt-1">
                  {hasAnything
                    ? 'Esto es lo que tu radar tiene en el punto de mira ahora mismo.'
                    : 'Oportunidades reales que estamos detectando para ti.'}
                </p>
              </div>

              {hasAnything && (
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button className="flex items-center gap-2 bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-700 hover:border-neutral-300 transition-colors">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                    Filtros
                  </button>
                  <button className="flex items-center gap-2 bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-700 hover:border-neutral-300 transition-colors">
                    Ordenar por: Mayor urgencia ↓
                  </button>
                </div>
              )}
            </div>

            {!hasAnything ? (
              <EmptyRadar />
            ) : (
              <SmartFeed cats={cats} activeCount={activeCount} suggestions={suggestions} />
            )}

            {hasAnything && (
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

      {/* ═══════════ Mobile ═══════════ */}
      <div className="lg:hidden min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
        <div className="min-h-screen pb-28">
          <div className="px-4 pt-6 pb-1">
            <h1 className="text-lg font-bold text-neutral-900">Mi Radar</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              {hasAnything ? 'Esto es lo que tu radar tiene en el punto de mira.' : 'Oportunidades detectadas para ti.'}
            </p>
          </div>

          {!hasAnything ? (
            <div className="px-4"><EmptyRadar /></div>
          ) : (
            <div className="px-4 mt-4">
              <SmartFeed cats={cats} activeCount={activeCount} suggestions={suggestions} />
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    </>
  )
}

// ─── Smart Feed (renderizado condicional por volumen) ───────

function SmartFeed({
  cats, activeCount, suggestions,
}: {
  cats: Record<RadarCategory, RadarGroup[]>
  activeCount: number
  suggestions: Suggestion[]
}) {
  // Móvil: 1 columna ancho completo. Desktop: columnas fijas ~300px (no se estiran con pocos elementos).
  const gridCls = 'grid gap-5 grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(280px,300px))]'
  const opps = [...cats.hot, ...cats.dropping]

  // DENSIDAD ALTA (≥5): divisores por categoría.
  if (activeCount >= HIGH_DENSITY_THRESHOLD) {
    return (
      <div className="space-y-8">
        <div className={gridCls}>
          {cats.hot.length > 0 && <Divider color="#F97316" title="Necesitan tu atención" n={cats.hot.length} />}
          {cats.hot.map(g => <OpportunityCard key={g.id} group={g} category="hot" />)}
          {cats.dropping.length > 0 && <Divider color="#6C3CE1" title="Han bajado recientemente" n={cats.dropping.length} />}
          {cats.dropping.map(g => <OpportunityCard key={g.id} group={g} category="dropping" />)}
          {cats.secured.length > 0 && <Divider color="#059669" title="Plaza asegurada" n={cats.secured.length} />}
          {cats.secured.map(g => <SecuredCard key={g.id} group={g} />)}
        </div>
        {cats.history.length > 0 && <HistoryList items={cats.history} />}
      </div>
    )
  }

  // DENSIDAD BAJA (1–4): grid único, sin títulos.
  return (
    <div className="space-y-8">
      <div className={gridCls}>
        {opps.map(g => (
          <OpportunityCard key={g.id} group={g} category={cats.hot.includes(g) ? 'hot' : 'dropping'} />
        ))}
        {cats.secured.map(g => <SecuredCard key={g.id} group={g} />)}
      </div>

      {activeCount === 1 && suggestions.length > 0 && (
        <CrossSell suggestions={suggestions} />
      )}

      {cats.history.length > 0 && <HistoryList items={cats.history} />}
    </div>
  )
}

function Divider({ color, title, n }: { color: string; title: string; n: number }) {
  return (
    <div className="flex items-center gap-2.5 mb-1 col-span-full">
      <span className="w-[5px] h-5 rounded" style={{ backgroundColor: color }} />
      <h2 className="text-[15px] font-bold text-neutral-900">{title}</h2>
      <span className="text-[11px] font-bold text-neutral-500 bg-white border border-neutral-200 rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">{n}</span>
    </div>
  )
}

// ─── Opportunity card (hot / dropping) ──────────────────────

// Hex EXACTOS del prototipo aprobado (no tokens) para fidelidad pixel a pixel.
const THEME = {
  hot: { border: '#FCD9C6', badgeBg: '#FDEBE3', badgeTx: '#C2410C', next: '#EA580C', cta: '#F0531F' },
  dropping: { border: '#DDD3FB', badgeBg: '#EDE9FE', badgeTx: '#6D28D9', next: '#7C3AED', cta: '#6B4EE6' },
  complete: { border: '#BBF0D8', badgeBg: '#E7F7EF', badgeTx: '#0B7B44', next: '#0F9D58', cta: '#0F9D58' },
} as const

function OpportunityCard({ group: g, category }: { group: RadarGroup; category: 'hot' | 'dropping' }) {
  const hoursLeft = g.closesAt ? Math.max(0, (new Date(g.closesAt).getTime() - Date.now()) / 3600000) : 0

  // Estado "Meta alcanzada": grupo abierto que ya llegó a su precio mínimo (sin siguiente tramo).
  // MISMA lógica que la card de Grupos Abiertos → estados consistentes entre pantallas.
  const complete = g.status === 'open' && g.nextPrice == null
  const variant: 'hot' | 'dropping' | 'complete' = complete ? 'complete' : category
  const t = THEME[variant]

  let badge = 'Ha bajado'
  let badgeIcon: 'fire' | 'clock' | 'down' | 'check' = 'down'
  if (complete) {
    badge = 'Meta alcanzada'; badgeIcon = 'check'
  } else if (category === 'hot') {
    if (g.missing > 0) { badge = `Faltan ${g.missing} unidades`; badgeIcon = 'fire' }
    else if (hoursLeft < 24) { badge = 'Cierra hoy'; badgeIcon = 'clock' }
    else { badge = 'Cierra pronto'; badgeIcon = 'clock' }
  }

  const showNext = g.status === 'open' && g.nextPrice != null

  return (
    <Link href={`/grupo/${g.id}`} className="block group/card">
      <div
        className="bg-white rounded-2xl border-2 p-4 pb-[18px] transition-all group-hover/card:shadow-lg group-hover/card:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover/card:translate-y-0"
        style={{ borderColor: t.border }}
      >
        {/* badge */}
        <span
          className="inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-[11px] py-[5px]"
          style={{ backgroundColor: t.badgeBg, color: t.badgeTx }}
        >
          {badgeIcon === 'fire' && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3-1 4-1 6a3 3 0 006 0c2 3 1 6-1 8a5 5 0 01-9-3c0-2 2-3 2-5 0 0 3 1 4-6z"/></svg>
          )}
          {badgeIcon === 'clock' && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg>
          )}
          {badgeIcon === 'down' && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>
          )}
          {badgeIcon === 'check' && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M5 12l5 5 9-11"/></svg>
          )}
          {badge}
        </span>

        {/* producto */}
        <div className="flex gap-3 items-start mt-3.5 mb-1">
          <div className="w-[52px] h-[52px] rounded-[11px] shrink-0 overflow-hidden flex items-center justify-center" style={{ backgroundColor: '#0F172A' }}>
            {g.imageUrl && <img src={g.imageUrl} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-neutral-900 leading-tight truncate max-w-[170px]">{g.name}</p>
            {g.spec && <p className="text-[12.5px] mt-[3px] truncate" style={{ color: '#475569' }}>{g.spec}</p>}
          </div>
          <div className="ml-auto">
            <RadarCardMenu groupId={g.id} />
          </div>
        </div>

        {/* precios */}
        <div className="flex justify-between items-end mt-4 mb-3">
          <div>
            <p className="text-[10.5px] font-bold uppercase" style={{ color: '#64748B', letterSpacing: '0.5px' }}>Precio actual</p>
            <p className="text-[23px] font-extrabold text-neutral-900 tabular-nums tracking-tight mt-[3px]">{fmt(g.currentPrice)}</p>
          </div>
          {showNext ? (
            <div className="text-right">
              <p className="text-[10.5px] font-bold uppercase" style={{ color: '#64748B', letterSpacing: '0.5px' }}>Siguiente precio</p>
              <p className="text-[23px] font-extrabold tabular-nums tracking-tight mt-[3px]" style={{ color: t.next }}>{fmt(g.nextPrice!)}</p>
            </div>
          ) : complete ? (
            <div className="text-right">
              <p className="text-[10.5px] font-bold uppercase" style={{ color: '#64748B', letterSpacing: '0.5px' }}>Precio final</p>
              <p className="text-[23px] font-extrabold tabular-nums tracking-tight mt-[3px]" style={{ color: t.next }}>{fmt(g.currentPrice)}</p>
            </div>
          ) : g.pvp > g.currentPrice ? (
            <div className="text-right">
              <p className="text-[10.5px] font-bold uppercase" style={{ color: '#64748B', letterSpacing: '0.5px' }}>PVP</p>
              <p className="text-[23px] font-extrabold tabular-nums tracking-tight mt-[3px] text-neutral-300 line-through">{fmt(g.pvp)}</p>
            </div>
          ) : null}
        </div>

        {/* barra de tiers */}
        {g.tiers.length > 0 && (
          <TierProgress current={g.currentUnits} tiers={g.tiers} variant={variant} />
        )}

        {/* frase accionable única */}
        {complete ? (
          <p className="text-[13px] font-semibold mt-[13px]" style={{ color: t.next }}>¡Rebaja máxima alcanzada!</p>
        ) : showNext && g.missing > 0 ? (
          <p className="text-[13px] font-medium mt-[13px]" style={{ color: '#334155' }}>
            Faltan <b style={{ color: t.next }}>{g.missing} unidades</b> para bajar a <b style={{ color: t.next }}>{fmt(g.nextPrice!)}</b>.
          </p>
        ) : null}

        {/* CTA (navega al grupo) */}
        <div
          className="flex items-center justify-center w-full rounded-[11px] py-[13px] text-sm font-bold text-white tracking-wide mt-4 min-h-[46px] transition-[filter] hover:brightness-95"
          style={{ backgroundColor: t.cta }}
        >
          {complete ? 'Entrar al precio mínimo' : `Asegurar precio · ${fmt(g.currentPrice)}`}
        </div>
      </div>
    </Link>
  )
}

// ─── Secured card (plaza asegurada) ─────────────────────────

function SecuredCard({ group: g }: { group: RadarGroup }) {
  const saving = g.pvp > 0 && g.currentPrice < g.pvp ? g.pvp - g.currentPrice : 0
  const dateLabel = g.closesAt ? new Date(g.closesAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''

  return (
    <Link href={`/grupo/${g.id}`} className="block group/card">
      <div className="rounded-2xl p-4 bg-[#ECFDF5] border border-green-200 transition-all group-hover/card:shadow-lg group-hover/card:-translate-y-0.5 motion-reduce:transition-none">
        <div className="flex items-center justify-between">
          <span className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-green-600">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>
          </span>
          {dateLabel && <span className="text-xs font-semibold text-green-800/70">{dateLabel}</span>}
        </div>
        <p className="text-[15px] font-bold text-neutral-900 mt-4 truncate">{g.name}</p>
        {g.spec && <p className="text-xs text-green-800/70 mt-1 truncate">{g.spec}</p>}
        <div className="flex justify-between items-end mt-4">
          <div>
            <p className="text-[11px] text-green-800/70 font-semibold">Precio bloqueado</p>
            <p className="text-xl font-extrabold text-green-600 tabular-nums mt-0.5">{fmt(g.currentPrice)}</p>
          </div>
          {g.pvp > 0 && g.pvp !== g.currentPrice && (
            <div className="text-right">
              <p className="text-[11px] text-green-800/70 font-semibold">Mercado hoy</p>
              <p className="text-sm text-neutral-400 line-through tabular-nums mt-1">{fmt(g.pvp)}</p>
            </div>
          )}
        </div>
        {saving > 0.01 && (
          <div className="flex items-center gap-1.5 bg-green-100 text-green-700 text-[13px] font-bold rounded-lg px-3 py-2 mt-3.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            Ahorras {fmt(saving)}
          </div>
        )}
      </div>
    </Link>
  )
}

// ─── Cross-sell (solo cuando hay 1 elemento) ────────────────

function CrossSell({ suggestions }: { suggestions: Suggestion[] }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-neutral-700 mb-3.5">Otros ciclistas también están siguiendo…</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {suggestions.map(x => (
          <Link key={x.id} href={`/grupo/${x.id}`} className="flex items-center gap-3 bg-white border border-neutral-200 rounded-xl px-3.5 py-3 hover:border-brand/30 transition-colors">
            <div className="w-[42px] h-[42px] rounded-lg bg-neutral-100 shrink-0 overflow-hidden flex items-center justify-center">
              {x.imageUrl
                ? <img src={x.imageUrl} alt="" className="w-full h-full object-cover" />
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-neutral-300" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-neutral-800 truncate">{x.name}</p>
              {x.spec && <p className="text-xs text-neutral-500 mt-0.5 truncate">{x.spec}</p>}
            </div>
            <span className="ml-auto w-[30px] h-[30px] rounded-lg border border-brand/30 text-brand text-lg flex items-center justify-center shrink-0" aria-hidden="true">+</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── History list ───────────────────────────────────────────

function HistoryList({ items }: { items: RadarGroup[] }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl px-5 py-2">
      <div className="flex items-center gap-2 py-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-neutral-400" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
        <h2 className="text-[15px] font-bold text-neutral-900">Historial</h2>
        <span className="text-[11px] font-bold text-neutral-500 bg-neutral-100 rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">{items.length}</span>
      </div>
      <div className="divide-y divide-neutral-100">
        {items.map(g => (
          <Link key={g.id} href={`/grupo/${g.id}`} className="flex items-center py-3.5 hover:bg-neutral-50 -mx-5 px-5 transition-colors">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-800 truncate">{g.name}</p>
              {g.spec && <p className="text-xs text-neutral-500 mt-0.5 truncate">{g.spec}</p>}
            </div>
            <div className="ml-auto text-right pl-4">
              <p className="text-sm font-bold text-neutral-800 tabular-nums">{fmt(g.currentPrice)}</p>
              <p className="text-xs font-semibold text-neutral-400 mt-0.5">Finalizado</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Empty state ────────────────────────────────────────────

function EmptyRadar() {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      <style>{`
        @keyframes radar-spin { to { transform: rotate(360deg); } }
        @keyframes radar-pulse { 0%{opacity:.55;transform:scale(.5)} 100%{opacity:0;transform:scale(1.9)} }
        .radar-sweep { transform-origin:50% 50%; animation: radar-spin 4s linear infinite; }
        .radar-pulse { transform-origin:center; animation: radar-pulse 2.4s ease-out infinite; }
        @media (prefers-reduced-motion: reduce){ .radar-sweep,.radar-pulse{ animation:none } }
      `}</style>

      <svg viewBox="0 0 420 300" className="w-[380px] max-w-[90%]" aria-hidden="true">
        <defs>
          <radialGradient id="radar-sw" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6C3CE1" stopOpacity=".55" />
            <stop offset="100%" stopColor="#6C3CE1" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g transform="translate(210 140)">
          <circle r="120" fill="none" stroke="#E4E0F7" strokeWidth="1.5" />
          <circle r="86" fill="none" stroke="#E4E0F7" strokeWidth="1.5" />
          <circle r="52" fill="none" stroke="#E4E0F7" strokeWidth="1.5" />
          <g className="radar-sweep"><path d="M0 0 L120 -60 A120 120 0 0 1 120 0 Z" fill="url(#radar-sw)" /></g>
          <circle className="radar-pulse" r="30" fill="#6C3CE1" opacity=".5" />
          <circle r="9" fill="#6C3CE1" />
          <circle cx="70" cy="-30" r="4.5" fill="none" stroke="#F97316" strokeWidth="2" />
          <circle cx="-58" cy="34" r="4.5" fill="#6C3CE1" />
          <circle cx="30" cy="66" r="3.5" fill="none" stroke="#F97316" strokeWidth="2" />
        </g>
        <path d="M40 250 L120 190 L175 235 L235 175 L300 240 L380 195 L380 260 L40 260 Z" fill="#EEEAFB" />
      </svg>

      <h2 className="text-2xl font-extrabold text-neutral-900 mt-1">
        Tu radar está <span className="text-brand">buscando</span> por ti
      </h2>
      <p className="text-sm text-neutral-500 mt-3 max-w-md leading-relaxed">
        Aún no sigues ninguna oportunidad. Explora nuestro mercado, guarda los productos que te interesan y te avisaremos cuando el precio baje.
      </p>
      <Link href="/" className="mt-6 px-8 py-3.5 bg-brand text-white text-sm font-bold rounded-xl hover:bg-brand-dark transition-colors active:scale-[0.98]">
        Descubrir grupos
      </Link>
      <p className="flex items-center gap-1.5 text-xs text-neutral-400 mt-3.5">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>
        Sin compromiso. Cancela cuando quieras.
      </p>
    </div>
  )
}
