'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import DesktopNavbar from './DesktopNavbar'
import PulseBar from '@/components/PulseBar'
import { SITE_URL } from '@/lib/site'
import { committedUnits, ladderProgress, normalizeLadder } from '@/lib/ladder'

// ── Tipos ──────────────────────────────────────────────
export interface Membership {
  member_id: string
  quantity: number
  guaranteed_price: number
  final_price: number | null
  // Valores reales del enum en BD: authorized | instructed | paid | released | cancelled | auth_failed
  payment_status: string
  group_id: string
  product_name: string
  product_spec: string | null
  image_url: string | null
  status: string
  closes_at: string
  current_price: number
  payment_info: string | null
  join_mode: 'comprar' | 'esperar' | null
  target_price: number | null
}
interface LadderRow { min_units: number; price: number; effective_demand: number; unlocked: boolean }
type StateKey = 'encurso' | 'apunto' | 'meta' | 'liberado' | 'noalc'

const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'

const THEME: Record<StateKey, { c: string; bg: string; tx: string; bd: string; finbg: string; secbg: string }> = {
  encurso: { c: '#024947', bg: '#F0F7F7', tx: '#013230', bd: '#E0EEEE', finbg: '#F6F3FE', secbg: '#F1F8F7' },
  apunto:  { c: '#F0531F', bg: '#FDEBE3', tx: '#C2410C', bd: '#FCD9C6', finbg: '#FEF4EE', secbg: '#FEF1EA' },
  meta:    { c: '#0B7B44', bg: '#E7F7EF', tx: '#0B7B44', bd: '#BBF0D8', finbg: '#EEFAF3', secbg: '#E7F7EF' },
  liberado:{ c: '#2563EB', bg: '#EFF6FF', tx: '#1E40AF', bd: '#DBEAFE', finbg: '#F5F9FF', secbg: '#EFF6FF' },
  noalc:   { c: '#94A3B8', bg: '#F1F5F9', tx: '#475569', bd: '#E2E8F0', finbg: '#F6F8FA', secbg: '#F1F5F9' },
}

// ── Iconos ─────────────────────────────────────────────
const I = {
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></svg>,
  fire: <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3-1 4-1 6a3 3 0 006 0c2 3 1 6-1 8a5 5 0 01-9-3c0-2 2-3 2-5 0 0 3 1 4-6z" /></svg>,
  plus: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
  check: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M5 12l5 5 9-11" /></svg>,
  x: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  xc: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></svg>,
  shield: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></svg>,
  share: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>,
}

/**
 * Fecha y hora exacta del cierre, en hora de Madrid.
 *
 * El panel solo decía «2d 07h restantes». Una cuenta atrás transmite urgencia pero no
 * sirve para organizarse: «¿me da tiempo a decirle a un amigo que entre este finde?».
 * Van las dos cosas, y la zona horaria es EXPLÍCITA porque el cierre está definido a las
 * 22:00 de España peninsular, no a las 22:00 de quien mira la pantalla.
 */
function closeDateLabel(closesAt: string): string {
  const d = new Date(closesAt)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
  }).format(d)
}

function timeLeft(closesAt: string): string {
  const diff = new Date(closesAt).getTime() - Date.now()
  if (diff <= 0) return 'Cerrado'
  const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000)
  return d > 0 ? `${d}d ${String(h).padStart(2, '0')}h restantes` : `${h}h ${String(m).padStart(2, '0')}m restantes`
}

// ── Derivación de estado + métricas desde datos reales ──
export function derive(m: Membership, ladder: LadderRow[]) {
  /**
   * EL TECHO REAL, según la regla que de verdad se aplica al cerrar.
   *
   * `close_group` paso 4 (liquidación por precio máximo universal, verificado sobre la
   * función VIVA en producción, no sobre el repositorio) cancela con campos distintos
   * según el modo:
   *
   *   join_mode='esperar' → si `target_price < precio final`
   *   join_mode='comprar' → si `guaranteed_price < precio final`
   *
   * Hoy los dos campos coinciden en las 27 membresías «esperar» de producción, así que
   * leer solo `guaranteed_price` daba el mismo número. Pero eso es una coincidencia
   * observada, no un constraint: si algún día `prepare_join` dejara de igualarlos, esta
   * pantalla estaría prometiendo un techo que el cierre no respeta. Se lee el campo que
   * manda en cada caso.
   */
  const commit = m.join_mode === 'esperar' && m.target_price != null
    ? Number(m.target_price)
    : Number(m.guaranteed_price)
  const cur = Number(m.current_price)
  const tiers = normalizeLadder(ladder)

  // Unidades dentro del grupo, todas. Sirve para decir cuánta gente hay, NO para medir
  // la distancia a un tramo.
  const groupUnits = committedUnits(tiers)

  // A-19 · Sin tramo siguiente NO hay objetivo, y ponerse uno mismo el listón daba
  // siempre «18 / 18 uds · 100 % completado»: un denominador que se cumple solo.
  //
  // CORREGIDO 15-sep-2026. Aquí estaba el bug que Benjamin vio en cuatro capturas:
  // `missing` restaba el umbral del tramo menos el TOTAL comprometido. Con 22 unidades
  // en el grupo y un tramo de 20, daba 0 y la tarjeta cantaba «Faltan 0 uds · 100 %
  // completado» de un tramo que el servidor marcaba como bloqueado —porque a ese precio
  // la demanda eran 12, no 22—. La ficha, con la cuenta buena, decía «faltan 8» al
  // mismo tiempo. La derivación es ahora la misma para las dos: `@/lib/ladder`.
  const prog = ladderProgress(tiers)
  const hasNextTier = prog.next != null
  const currentUnits = hasNextTier ? prog.reached : groupUnits
  const target = hasNextTier ? prog.target : groupUnits || m.quantity || 1
  const missing = prog.missing
  const nextObj = prog.next ? prog.next.price : null
  const pct = prog.pct
  const nextTier = prog.next

  // DOS EJES DISTINTOS, no colapsarlos (A-18):
  //   eje 1 — mi pago:  authorized (hold vivo) | paid | instructed | released | cancelled | auth_failed
  //   eje 2 — el grupo: open | closing | closed | cancelled
  // Que mi plaza se haya liberado NO significa que el grupo haya fracasado: hoy en producción hay
  // liberaciones en grupos `open` y `closed` que siguen adelante. Solo `groups.status = 'cancelled'`
  // significa que el grupo no salió.
  const ps = m.payment_status
  const groupFailed = m.status === 'cancelled'
  let state: StateKey
  if (ps === 'released' || ps === 'cancelled' || ps === 'auth_failed') {
    state = groupFailed ? 'noalc' : 'liberado'
  } else if (groupFailed) {
    state = 'noalc'
  } else if (ps === 'paid' || ps === 'instructed') {
    state = 'meta'
  } else if (m.status === 'open') {
    // hold activo (authorized) en grupo abierto → seguimiento
    const hoursLeft = Math.max(0, (new Date(m.closes_at).getTime() - Date.now()) / 3600000)
    state = nextTier && (missing <= 5 || hoursLeft < 48) ? 'apunto' : 'encurso'
  } else {
    state = 'encurso'
  }
  /**
   * `ladderKnown` separa dos cosas que la escalera vacía confundía: «este grupo ya está
   * en su precio mínimo» y «todavía no sé nada de este grupo». Sin esa distinción, una
   * tarjeta anunciaba «Precio mínimo» durante el instante en que la escalera aún no
   * había llegado. Es exactamente el error de A-36: afirmar algo que no se sabe.
   */
  const ladderKnown = tiers.length > 0

  return { commit, cur, currentUnits, groupUnits, target, missing, nextObj, pct, state, hasNextTier, ladderKnown, groupFailed, authFailed: ps === 'auth_failed' }
}

// Enriquecer con tier_demand (RPC anon, solo lectura) para la barra de progreso. Compartido desktop + móvil.
/**
 * `seed` son las escaleras que ya vienen con `/api/my-groups`. Con ellas las tarjetas se
 * pintan completas en la primera pasada; sin ellas —o para los grupos que falten— se
 * piden desde aquí como antes.
 */
export function useLadders(memberships: Membership[], seed?: Record<string, LadderRow[]>) {
  const [ladders, setLadders] = useState<Record<string, LadderRow[]>>(seed ?? {})

  // Si llegan escaleras nuevas con la respuesta, entran sin esperar a ninguna petición.
  useEffect(() => {
    if (seed && Object.keys(seed).length) setLadders((prev) => ({ ...prev, ...seed }))
  }, [seed])

  useEffect(() => {
    let cancelled = false
    async function run() {
      const openGroups = memberships.filter(m => m.status === 'open').map(m => m.group_id)
      // Solo lo que NO haya venido ya servido. Con la siembra completa, cero peticiones.
      const uniq = Array.from(new Set(openGroups)).filter(gid => !(seed && seed[gid]))
      if (uniq.length === 0) return
      const entries = await Promise.all(uniq.map(async gid => {
        try {
          const { data } = await supabase.rpc('tier_demand', { p_group_id: gid })
          return [gid, (Array.isArray(data) ? data : []) as LadderRow[]] as const
        } catch { return [gid, [] as LadderRow[]] as const }
      }))
      if (!cancelled) setLadders(prev => ({ ...prev, ...Object.fromEntries(entries) }))
    }
    if (memberships.length) run()
    return () => { cancelled = true }
  }, [memberships, seed])

  return ladders
}

/**
 * `loading` existe para que esta pantalla no AFIRME nada mientras espera. Con la lista
 * vacía y sin saber que está cargando, pintaba «Aún no participas en ningún grupo» a
 * alguien que sí participa, y un segundo después las tarjetas. Un esqueleto no miente.
 */
export default function MisGruposDesktop({ memberships, ladderSeed, loading = false }: { memberships: Membership[]; ladderSeed?: Record<string, LadderRow[]>; loading?: boolean }) {
  const ladders = useLadders(memberships, ladderSeed)
  const [open, setOpen] = useState<string | null>(null)

  // Cerrar drawer con ESC + bloquear scroll de fondo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(null) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open])

  // A-20 · Esto era `memberships.length`: decía «5 activos» cuando lo activo era uno
  // —el único con dinero retenido— y los otros cuatro eran dos liberados y dos
  // cancelados. El único número que resumía la pantalla era el único que estaba mal.
  // Activo = hay algo en marcha: retención viva o pago pendiente, en un grupo que no
  // se ha cancelado. `paid` ya no es activo: está terminado.
  const active = memberships.filter(
    (m) => (m.payment_status === 'authorized' || m.payment_status === 'instructed') && m.status !== 'cancelled',
  ).length
  const openMem = memberships.find(m => m.member_id === open) || null

  return (
    <div className="hidden lg:block min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
      <DesktopNavbar />

        <main className="max-w-[1180px] mx-auto px-8 pb-16 pt-8">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <h1 className="text-[30px] font-extrabold text-neutral-900 tracking-tight">Mis grupos</h1>
              {!loading && active > 0 && <span className="bg-brand/10 text-brand text-xs font-semibold px-2.5 py-1 rounded-full">{active} {active === 1 ? 'activo' : 'activos'}</span>}
            </div>
            <p className="text-sm text-neutral-500 mt-1">Grupos en los que ya participas y estás asegurando tu precio.</p>
          </div>

          {loading ? (
            <div className="grid gap-[18px]" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,300px))' }}>
              {[0, 1, 2].map((i) => <MgSkeleton key={i} />)}
            </div>
          ) : active === 0 ? (
            <div className="text-sm text-neutral-500 bg-white border border-neutral-200 rounded-2xl px-5 py-8 text-center">
              Aún no participas en ningún grupo. <Link href="/" className="text-brand font-semibold">Explora grupos abiertos →</Link>
            </div>
          ) : (
            <div className="grid gap-[18px]" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,300px))' }}>
              {memberships.map(m => (
                <MgCard key={m.member_id} m={m} ladder={ladders[m.group_id] || []} onOpen={() => setOpen(m.member_id)} />
              ))}
            </div>
          )}
        </main>

      {/* Drawer */}
      <div onClick={() => setOpen(null)} className="fixed inset-0 z-40 transition-opacity duration-300" style={{ background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(2px)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }} />
      <aside role="dialog" aria-modal="true" aria-label="Detalle del grupo" className="fixed top-0 right-0 h-screen w-[440px] max-w-[92vw] bg-white z-50 flex flex-col transition-transform duration-300" style={{ boxShadow: '-12px 0 40px rgba(15,23,42,.18)', transform: open ? 'translateX(0)' : 'translateX(100%)' }}>
        {openMem && <Drawer m={openMem} ladder={ladders[openMem.group_id] || []} onClose={() => setOpen(null)} />}
      </aside>
    </div>
  )
}

/** Una de las salidas posibles al cierre. `ok` = se compra · `back` = vuelve el dinero. */
function Outcome({ tone, children }: { tone: 'ok' | 'back'; children: React.ReactNode }) {
  const color = tone === 'ok' ? '#0B7B44' : '#2563EB'
  const bg = tone === 'ok' ? '#E7F7EF' : '#EFF6FF'
  return (
    <li className="flex gap-2.5">
      <span
        aria-hidden
        className="grid place-items-center rounded-full shrink-0 mt-[1px]"
        style={{ width: 20, height: 20, background: bg, color }}
      >
        {tone === 'ok' ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-11" /></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg>
        )}
      </span>
      <span className="text-[12.5px] leading-[1.55] text-neutral-600">{children}</span>
    </li>
  )
}

/**
 * Esqueleto con la misma silueta que `MgCard`: mismo ancho de rejilla y una altura
 * cercana, para que al llegar los datos la página no pegue otro salto.
 */
export function MgSkeleton() {
  return (
    <div
      aria-hidden
      className="rounded-2xl border bg-white p-4 animate-pulse"
      style={{ borderColor: '#E9EEF3', minHeight: 336 }}
    >
      <div className="flex items-center justify-between">
        <div className="h-5 w-20 rounded-full bg-neutral-100" />
        <div className="h-4 w-24 rounded bg-neutral-100" />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-[52px] w-[52px] rounded-xl bg-neutral-100" />
        <div className="flex-1">
          <div className="h-4 w-3/4 rounded bg-neutral-100" />
          <div className="mt-2 h-3 w-1/2 rounded bg-neutral-100" />
        </div>
      </div>
      <div className="mt-4 h-[66px] rounded-xl bg-neutral-100" />
      <div className="mt-4 h-4 rounded-full bg-neutral-100" />
      <div className="mt-3 flex justify-between">
        <div className="h-3 w-28 rounded bg-neutral-100" />
        <div className="h-3 w-20 rounded bg-neutral-100" />
      </div>
      <div className="mt-4 h-4 w-48 rounded bg-neutral-100" />
      <div className="mt-4 h-10 rounded-xl bg-neutral-100" />
    </div>
  )
}

// ── Tarjeta ────────────────────────────────────────────
export function MgCard({ m, ladder, onOpen }: { m: Membership; ladder: LadderRow[]; onOpen: () => void }) {
  const d = derive(m, ladder)
  const t = THEME[d.state]
  const paid = m.payment_status === 'paid'
  const isOpen = m.status === 'open'
  const badge = d.state === 'encurso' ? 'En curso'
    : d.state === 'apunto' ? 'A punto'
    : d.state === 'meta' ? 'Meta alcanzada'
    : d.state === 'liberado' ? (d.authFailed ? 'Pago no confirmado' : 'Plaza liberada')
    : 'No alcanzado'
  const badgeIcon = d.state === 'encurso' ? I.plus : d.state === 'apunto' ? I.fire : d.state === 'meta' ? I.check : I.xc
  // El grupo del que te has salido puede seguir vivo: enseñar su tiempo real, no «Finalizado».
  const time = d.state === 'meta' ? (paid ? 'Compra realizada' : 'Objetivo alcanzado')
    : d.state === 'noalc' ? 'Finalizado'
    : d.state === 'liberado' ? (isOpen ? timeLeft(m.closes_at) : 'Grupo finalizado')
    : timeLeft(m.closes_at)
  const saving = Math.max(0, d.commit - d.cur)

  return (
    <div onClick={onOpen} className="bg-white rounded-2xl border-2 p-4 pb-[18px] cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 motion-reduce:transition-none" style={{ borderColor: t.bd }}>
      {/* header */}
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1" style={{ background: t.bg, color: t.tx }}>{badgeIcon}{badge}</span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-400 font-medium">{d.state !== 'noalc' && I.clock}{time}</span>
      </div>
      {/* producto */}
      <div className="flex gap-3 items-start mt-3">
        <div className="w-14 h-14 rounded-xl bg-neutral-100 shrink-0 overflow-hidden flex items-center justify-center">
          {m.image_url ? <img src={m.image_url} alt="" className="w-full h-full object-cover" /> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-neutral-300"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>}
        </div>
        <div className="min-w-0 pt-0.5">
          <p className="text-[14.5px] font-bold text-neutral-900 leading-tight truncate">{m.product_name}</p>
          {m.product_spec && <p className="text-xs text-neutral-500 mt-1 truncate">{m.product_spec}</p>}
          <p className="text-[11px] font-semibold mt-1 truncate" style={{ color: m.join_mode === 'esperar' ? '#D97706' : '#024947' }}>{m.join_mode === 'esperar' ? 'En espera' : 'Compra directa'}</p>
        </div>
      </div>
      {/* financiero */}
      <div className="flex justify-between items-start rounded-xl px-3 py-2.5 mt-3" style={{ background: t.finbg }}>
        <div><p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Mi compromiso</p><p className="text-[18px] font-extrabold mt-0.5 tabular-nums whitespace-nowrap">{fmt(d.commit)}</p></div>
        <div className="text-right">
          {d.state === 'meta' ? (
            <><p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Precio final</p><p className="text-[18px] font-extrabold mt-0.5 tabular-nums whitespace-nowrap flex items-center gap-1 justify-end" style={{ color: t.c }}>{fmt(Number(m.final_price ?? m.guaranteed_price))} {I.check}</p></>
          ) : d.state === 'liberado' ? (
            <><p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Tu plaza</p><p className="text-[16px] font-extrabold mt-1" style={{ color: t.c }}>{d.authFailed ? 'Sin confirmar' : 'Liberada'}</p></>
          ) : d.state === 'noalc' ? (
            <><p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Estado final</p><p className="text-[16px] font-extrabold mt-1 text-neutral-600">No alcanzado</p></>
          ) : (
            <><p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Estado actual</p><p className="text-[18px] font-extrabold mt-0.5 tabular-nums whitespace-nowrap" style={{ color: t.c }}>{fmt(d.cur)}</p>{saving > 0.005 && <p className="text-[11px] font-semibold mt-0.5" style={{ color: '#0B7B44' }}>Ahorras {fmt(saving)}</p>}</>
          )}
        </div>
      </div>
      {/* barra — GROPO PULSE completa en grupos vivos; barra simple en estados finales */}
      {d.state === 'liberado' ? null : isOpen && (d.state === 'encurso' || d.state === 'apunto') && ladder.length > 0 ? (
        <PulseBar
          groupId={m.group_id}
          current={d.currentUnits}
          tiers={ladder.map(r => ({ units: Number(r.min_units), price: Number(r.price), unlocked: r.unlocked }))}
          variant={d.state === 'apunto' ? 'hot' : 'dropping'}
          className="mt-3"
        />
      ) : (
        <div className="relative h-[16px] flex items-center mt-3">
          <div className="flex-1 h-1.5 rounded-full bg-neutral-200 overflow-hidden mr-1"><div className="h-full rounded-full" style={{ width: `${d.state === 'meta' ? 100 : d.pct}%`, background: t.c }} /></div>
          <span className="relative w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0" style={{ background: (d.state === 'meta') ? t.c : '#fff', border: `2.5px solid ${t.c}`, color: '#fff' }}>
            {d.state === 'meta' && I.check}
          </span>
        </div>
      )}
      <div className="flex justify-between text-[12.5px] mt-2 mb-3">
        {/* «X / Y uds» sin decir para qué tramo es ambiguo: parecía el total del
            grupo, y no lo es. Son las unidades que cuentan PARA ESE PRECIO. */}
        <span className="text-neutral-500">{isOpen && d.state !== 'liberado'
          ? (d.hasNextTier
              ? `${d.currentUnits} / ${d.target} uds para ${fmt(d.nextObj ?? 0)}`
              : `${d.groupUnits} uds en el grupo`)
          : `${m.quantity} ud${m.quantity > 1 ? 's' : ''}`}</span>
        <span className="font-bold" style={{ color: d.state === 'noalc' ? '#94A3B8' : t.c }}>{d.state === 'meta' ? 'Objetivo alcanzado' : d.state === 'liberado' ? (isOpen ? 'El grupo sigue abierto' : 'Ya no participas') : d.state === 'noalc' ? 'Objetivo no alcanzado' : !d.ladderKnown ? '\u00A0' : d.nextObj == null ? 'Precio mínimo' : d.missing === 1 ? 'Falta 1 ud' : `Faltan ${d.missing} uds`}</span>
      </div>
      {/* estado / social */}
      <div className="flex items-center gap-2 mb-3.5 text-[12px] text-neutral-600">
        {d.state === 'meta'
          ? <>{I.check}<span>{paid ? 'Compra confirmada · Pago realizado' : 'Objetivo alcanzado · Pago pendiente'}</span></>
          : d.state === 'liberado'
            ? <span>{d.authFailed ? 'No se pudo confirmar el pago · Sin cargos realizados' : 'Retención anulada · Sin cargos realizados'}</span>
            : d.state === 'noalc'
              ? <span>Retención liberada · Sin cargos realizados</span>
              /* A-31 · «Estado: plaza asegurada», con su límite. La cifra es el
                 precio garantizado: el techo de lo que puede pagar. */
              /* «asegurada hasta 85 €» con 3 unidades se lee como 85 € en total, y son
                 85 € POR UNIDAD. En producción 25 de 184 membresías piden más de una
                 —una de ellas 10—, así que no es un caso hipotético. */
              : <><span style={{ color: t.c }}>{I.shield}</span><span>Tu plaza está asegurada hasta {fmt(d.commit)}{m.quantity > 1 ? ' por unidad' : ''}</span></>}
      </div>
      {/* CTA — A-35 · Era un <div> con aspecto de botón: funcionaba porque el onClick
          está en la tarjeta entera, pero NO se alcanzaba con el tabulador ni se
          anunciaba como botón. Un usuario de teclado no tenía forma de abrir el panel.
          Ahora es un <button> real; el click en cualquier parte de la tarjeta sigue
          funcionando igual porque el evento burbujea. */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpen() }}
        className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-[13.5px] font-bold bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{ border: `1.5px solid ${t.bd}`, color: t.c }}
      >
        {d.state === 'meta' ? (paid ? 'Ver compra / Ticket' : 'Ver instrucciones de pago') : d.state === 'liberado' ? 'Ver qué ha pasado' : d.state === 'noalc' ? 'Ver devolución' : 'Ver estado de tu plaza'} →
      </button>
    </div>
  )
}

/**
 * A-23 · El botón de compartir estaba MUERTO: sin `onClick` y sin `type`.
 *
 * Era la única acción del panel «Ver estado de tu plaza», en móvil y en escritorio,
 * y justo encima el propio panel pide compartir («Comparte tu enlace y baja el precio
 * para todos»). De todos los hallazgos pequeños de la auditoría, el más caro: la
 * palanca de crecimiento del modelo, apagada en la pantalla donde el comprador ya
 * está comprometido y tiene el máximo interés en que entre más gente.
 *
 * El mecanismo ya estaba resuelto en otros tres sitios (`PostCheckoutView`,
 * `GroupDesktopView`, `RadarCardMenu`): `navigator.share` donde existe —móvil— y
 * copia al portapapeles donde no. La URL sale de `SITE_URL`, no de
 * `window.location.origin`: el enlace que se comparte tiene que ser el canónico, que
 * es lo que arregló en su día el problema de los enlaces a `vonda.es`.
 *
 * El feedback es obligatorio: copiar al portapapeles sin decirlo es invisible, y el
 * usuario pulsa otra vez creyendo que no ha funcionado.
 */
function ShareGroupButton({ groupId, productName, color }: { groupId: string; productName: string; color: string }) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = `${SITE_URL}/grupo/${groupId}`
    const shareData = { title: productName, text: `Estoy en este grupo de Gropo: cuantos más entremos, menos pagamos.`, url }
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        // El usuario canceló el diálogo, o el navegador lo rechazó: caemos a copiar.
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Sin permiso de portapapeles (http, o navegador viejo): el input temporal.
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="w-full rounded-xl py-3.5 text-[14.5px] font-bold text-white flex items-center justify-center gap-2 transition-[filter] hover:brightness-110 active:scale-[0.99]"
      style={{ background: color }}
    >
      {copied ? <>{I.check} Enlace copiado</> : <>{I.share} Comparte con un amigo</>}
    </button>
  )
}

// ── Drawer ─────────────────────────────────────────────
export function Drawer({ m, ladder, onClose }: { m: Membership; ladder: LadderRow[]; onClose: () => void }) {
  const d = derive(m, ladder)
  const t = THEME[d.state]
  const paid = m.payment_status === 'paid'
  const saving = Math.max(0, d.commit - d.cur)
  const spec = m.product_spec || ''

  const head = (title: string) => (
    <div className="flex items-center justify-between px-[22px] pt-[22px] pb-1">
      <span className="text-[20px] font-extrabold tracking-tight">{title}</span>
      <button onClick={onClose} aria-label="Cerrar" className="w-8 h-8 flex items-center justify-center text-neutral-500 hover:text-neutral-800">{I.x}</button>
    </div>
  )

  // EN CURSO / A PUNTO → panel "Ver estado de tu plaza"
  if (d.state === 'encurso' || d.state === 'apunto') {
    const badge = d.state === 'encurso' ? 'En curso' : 'A punto'
    const badgeIcon = d.state === 'encurso' ? I.plus : I.fire
    return (
      <>
        {head('Ver estado de tu plaza')}
        <div className="px-[22px] py-5 overflow-y-auto flex-1">
          <div className="flex items-center justify-between mb-3.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1" style={{ background: t.bg, color: t.tx }}>{badgeIcon}{badge}</span>
            <span className="inline-flex items-center gap-1.5 text-neutral-400 text-[12.5px]">{I.clock}{timeLeft(m.closes_at)}</span>
          </div>
          <div className="flex gap-3 items-center">
            <div className="w-[52px] h-[52px] rounded-xl bg-neutral-100 shrink-0 overflow-hidden">{m.image_url && <img src={m.image_url} alt="" className="w-full h-full object-cover" />}</div>
            <div><div className="text-base font-bold">{m.product_name}</div>{spec && <div className="text-[12.5px] text-neutral-500 mt-0.5">{spec}</div>}<div className="text-[11px] font-semibold mt-1" style={{ color: m.join_mode === 'esperar' ? '#D97706' : '#024947' }}>{m.join_mode === 'esperar' ? 'En espera' : 'Compra directa'}</div></div>
          </div>
          <div className="flex gap-3 items-start rounded-2xl p-3.5 mt-4" style={{ background: t.secbg }}>
            <span className="w-[38px] h-[38px] rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: t.c }}>{I.shield}</span>
            <div><h5 className="text-sm font-bold">Tu plaza está asegurada hasta {fmt(d.commit)}{m.quantity > 1 ? ' por unidad' : ''}</h5><p className="text-[11.5px] text-neutral-600 mt-1 leading-snug">Solo pagarás el precio final del grupo, nunca más de {fmt(d.commit)}{m.quantity > 1 ? ' por unidad' : ''}. El importe está retenido, no cobrado.</p></div>
            <div className="ml-auto text-right shrink-0"><span className="text-xs font-bold rounded-lg px-2.5 py-1 bg-white inline-block" style={{ color: t.c, border: `1px solid ${t.bd}` }}>stripe</span><small className="block text-[10.5px] text-neutral-400 mt-1.5">Retención activa</small></div>
          </div>
          <div className="flex justify-between gap-2 mt-[18px]">
            <div><div className="text-[11px] text-neutral-500">Mi compromiso</div><div className="text-[19px] font-extrabold mt-1 whitespace-nowrap">{fmt(d.commit)}</div></div>
            <div className="text-center"><div className="text-[11px] text-neutral-500">Estado actual</div><div className="text-[19px] font-extrabold mt-1 whitespace-nowrap" style={{ color: '#0B7B44' }}>{fmt(d.cur)}</div>{saving > 0.005 && <div className="text-[11.5px] mt-0.5" style={{ color: '#0B7B44' }}>Estás ahorrando {fmt(saving)}</div>}</div>
            <div className="text-right"><div className="text-[11px] text-neutral-500">Próximo objetivo</div><div className="text-[19px] font-extrabold mt-1 whitespace-nowrap">{d.nextObj != null ? fmt(d.nextObj) : '—'}</div><div className="text-[11.5px] text-neutral-500 mt-0.5">{d.nextObj != null ? (d.missing === 1 ? 'Falta 1 ud' : `Faltan ${d.missing} uds`) : d.ladderKnown ? 'Precio mínimo' : '\u00A0'}</div></div>
          </div>
          {/* A-19 · Sin tramo siguiente no hay porcentaje que medir: la barra estaría
              siempre llena contra un objetivo que se pone ella misma. */}
          {d.hasNextTier ? (
            <>
              <div className="flex items-center mt-4"><div className="flex-1 h-1.5 rounded-full bg-neutral-200 overflow-hidden mr-1"><div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: t.c }} /></div><span className="w-4 h-4 rounded-full bg-white shrink-0" style={{ border: `2.5px solid ${t.c}` }} /></div>
              <div className="flex justify-between text-xs text-neutral-500 mt-2"><span>{d.currentUnits} / {d.target} uds para {fmt(d.nextObj ?? 0)}</span><span>{d.pct}% completado</span></div>
            </>
          ) : (
            <div className="flex justify-between text-xs mt-4"><span className="text-neutral-500">{d.groupUnits} uds en el grupo</span><span className="font-bold" style={{ color: t.c }}>Mejor precio alcanzado</span></div>
          )}
          {/* ── P1-10 · Lo que el panel no contaba ────────────────────────────
              Aquí había medio panel vacío. Lo que le faltaba no era relleno: eran
              datos que el sistema ya tiene y que el comprador necesita justo aquí,
              porque es la pantalla a la que vuelve días después de comprar.

              El caso de RULE-032 es el más importante: si el precio final supera tu
              máximo te quedas fuera y se libera la retención — y **ese comprador no
              recibe ningún email** (`sendClosePaymentEmails` solo escribe a
              `instructed` y `paid`). Esta pantalla es literalmente el único sitio
              donde puede enterarse de que eso puede pasar. */}
          <div className="mt-5 rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Tu pedido</span>
              <span className="text-[13px] font-semibold text-neutral-800">
                {m.quantity} {m.quantity === 1 ? 'unidad' : 'unidades'}
              </span>
            </div>
            <div className="px-4 py-3 flex items-baseline justify-between gap-3">
              <span className="text-[12.5px] text-neutral-500">Tu precio máximo</span>
              <span className="text-[13px] font-semibold text-neutral-800 whitespace-nowrap">
                {fmt(d.commit)}{m.quantity > 1 ? ' / unidad' : ''}
              </span>
            </div>
            {closeDateLabel(m.closes_at) && (
              <div className="px-4 py-3 border-t border-neutral-100 flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] text-neutral-500">Cierra</span>
                <span className="text-[13px] font-semibold text-neutral-800 text-right">
                  {closeDateLabel(m.closes_at)}
                  <span className="block text-[11px] font-normal text-neutral-400">hora peninsular</span>
                </span>
              </div>
            )}
          </div>

          <div className="mt-4">
            <h5 className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-2.5">Qué pasa al cerrar</h5>
            <ul className="space-y-2.5">
              <Outcome tone="ok">
                Si el precio final es <b className="font-semibold text-neutral-800">{fmt(d.commit)}</b> o menos,
                se te cobra ese precio final — que puede ser más bajo. Nunca más.
              </Outcome>
              <Outcome tone="back">
                Si el precio final lo supera, tu compra <b className="font-semibold text-neutral-800">no se ejecuta</b>:
                se libera la retención y no se te cobra nada.
              </Outcome>
              <Outcome tone="back">
                Si el grupo no sale adelante, tampoco se cobra nada y se libera la retención.
              </Outcome>
            </ul>
          </div>

          <p className="text-[12.5px] text-neutral-500 mt-5 leading-relaxed">Cuantas más personas entren, antes se cierra el grupo y antes aseguras tu precio. Comparte tu enlace y baja el precio para todos.</p>
        </div>
        <div className="px-[22px] py-4 border-t border-neutral-100">
          <ShareGroupButton groupId={m.group_id} productName={m.product_name} color={t.c} />
        </div>
      </>
    )
  }

  // META ALCANZADA
  if (d.state === 'meta') {
    return (
      <>
        {head('Tu compra')}
        <div className="px-[22px] py-5 overflow-y-auto flex-1">
          <div className="flex gap-3 items-center mb-2">
            <div className="w-[52px] h-[52px] rounded-xl bg-neutral-100 shrink-0 overflow-hidden">{m.image_url && <img src={m.image_url} alt="" className="w-full h-full object-cover" />}</div>
            <div><div className="text-base font-bold">{m.product_name}</div>{spec && <div className="text-[12.5px] text-neutral-500 mt-0.5">{spec}</div>}<div className="text-[11px] font-semibold mt-1" style={{ color: m.join_mode === 'esperar' ? '#D97706' : '#024947' }}>{m.join_mode === 'esperar' ? 'En espera' : 'Compra directa'}</div></div>
          </div>
          <div className="border border-neutral-200 rounded-2xl p-4 mt-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-3">Confirmación de compra</h4>
            <div className="flex justify-between text-[13.5px] py-1"><span className="text-neutral-600">Precio final</span><span className="font-semibold">{fmt(Number(m.final_price ?? m.guaranteed_price))}</span></div>
            <div className="flex justify-between text-[13.5px] py-1"><span className="text-neutral-600">Unidades</span><span className="font-semibold">{m.quantity}</span></div>
            <div className="flex justify-between text-[13.5px] py-1 border-t border-neutral-100 mt-2 pt-2.5"><span className="font-bold">Total</span><span className="font-bold">{fmt(Number(m.final_price ?? m.guaranteed_price) * m.quantity)}</span></div>
          </div>
          {!paid && m.payment_info && (
            <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 mt-4"><p className="text-[11px] font-bold text-orange-700 mb-1 uppercase tracking-wide">Instrucciones de pago</p><p className="text-[12.5px] text-orange-900 whitespace-pre-line">{m.payment_info}</p></div>
          )}
        </div>
        <div className="px-[22px] py-4 border-t border-neutral-100">
          <Link href={`/grupo/${m.group_id}`} className="w-full rounded-xl py-3.5 text-[14.5px] font-bold text-white flex items-center justify-center" style={{ background: t.c }}>{paid ? 'Ver compra / Ticket' : 'Completar pago'}</Link>
        </div>
      </>
    )
  }

  // PLAZA LIBERADA — mi plaza ya no existe, pero el grupo NO ha fracasado (A-18).
  // No afirmamos el motivo de la liberación: el sistema no lo sabe.
  if (d.state === 'liberado') {
    const grupoVivo = m.status === 'open'
    return (
      <>
        {head(d.authFailed ? 'Pago no confirmado' : 'Tu plaza liberada')}
        <div className="px-[22px] py-5 overflow-y-auto flex-1">
          <div className="flex gap-3 items-center mb-2">
            <div className="w-[52px] h-[52px] rounded-xl bg-neutral-100 shrink-0 overflow-hidden">{m.image_url && <img src={m.image_url} alt="" className="w-full h-full object-cover" />}</div>
            <div><div className="text-base font-bold">{m.product_name}</div>{spec && <div className="text-[12.5px] text-neutral-500 mt-0.5">{spec}</div>}</div>
          </div>
          <div className="flex gap-2.5 rounded-2xl p-3.5 mt-4 text-[12.5px] leading-relaxed" style={{ background: '#EFF6FF', color: '#1E3A8A' }}>
            <span className="shrink-0">{I.shield}</span>
            <span>La retención de <b>{fmt(d.commit)}</b> ha sido <b>anulada</b>. El fondo ya no está bloqueado y no se ha realizado ningún cargo.</span>
          </div>
          <div className="border border-neutral-200 rounded-2xl p-4 mt-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-2">Qué ha pasado</h4>
            <p className="text-[13px] text-neutral-600 leading-relaxed">
              {d.authFailed
                ? 'No pudimos confirmar la autorización de tu tarjeta, así que tu plaza no llegó a reservarse.'
                : 'Tu plaza en este grupo se ha liberado, así que ya no participas en esta compra.'}
            </p>
            {grupoVivo && (
              <p className="text-[13px] text-neutral-600 leading-relaxed mt-2">
                <b>El grupo sigue abierto.</b> Si quieres volver a entrar y queda stock, puedes unirte otra vez.
              </p>
            )}
          </div>
        </div>
        <div className="px-[22px] py-4 border-t border-neutral-100">
          {grupoVivo ? (
            <Link href={`/grupo/${m.group_id}`} className="w-full rounded-xl py-3.5 text-[14.5px] font-bold text-white flex items-center justify-center" style={{ background: t.c }}>Ver el grupo</Link>
          ) : (
            <Link href="/" className="w-full rounded-xl py-3.5 text-[14.5px] font-bold flex items-center justify-center bg-white" style={{ color: t.c, border: `1.5px solid ${t.bd}` }}>Explorar grupos similares</Link>
          )}
        </div>
      </>
    )
  }

  // NO ALCANZADO
  return (
    <>
      {head('Devolución')}
      <div className="px-[22px] py-5 overflow-y-auto flex-1">
        <div className="flex gap-3 items-center mb-2">
          <div className="w-[52px] h-[52px] rounded-xl bg-neutral-100 shrink-0 overflow-hidden">{m.image_url && <img src={m.image_url} alt="" className="w-full h-full object-cover" />}</div>
          <div><div className="text-base font-bold">{m.product_name}</div>{spec && <div className="text-[12.5px] text-neutral-500 mt-0.5">{spec}</div>}<div className="text-[11px] font-semibold mt-1" style={{ color: m.join_mode === 'esperar' ? '#D97706' : '#024947' }}>{m.join_mode === 'esperar' ? 'En espera' : 'Compra directa'}</div></div>
        </div>
        <div className="flex gap-2.5 rounded-2xl p-3.5 mt-4 text-[12.5px] leading-relaxed" style={{ background: '#EFF6FF', color: '#1E3A8A' }}>
          <span className="shrink-0">{I.shield}</span>
          <span>La retención de <b>{fmt(d.commit)}</b> ha sido <b>anulada</b>. El fondo ya no está bloqueado y no se ha realizado ningún cargo.</span>
        </div>
        <div className="border border-neutral-200 rounded-2xl p-4 mt-4">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-2">Por qué no se alcanzó</h4>
          {/* Este panel solo se alcanza con groups.status = 'cancelled' (ver derive), así que la causa es cierta. */}
          <p className="text-[13px] text-neutral-600 leading-relaxed">El grupo se canceló sin llegar al volumen mínimo. Cuando esto pasa, nadie paga: es la garantía de Gropo.</p>
        </div>
      </div>
      <div className="px-[22px] py-4 border-t border-neutral-100">
        <Link href="/" className="w-full rounded-xl py-3.5 text-[14.5px] font-bold flex items-center justify-center bg-white" style={{ color: t.c, border: `1.5px solid ${t.bd}` }}>Explorar grupos similares</Link>
      </div>
    </>
  )
}
