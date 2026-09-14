'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import DesktopNavbar from './DesktopNavbar'
import PulseBar from '@/components/PulseBar'
import { SITE_URL } from '@/lib/site'

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

function timeLeft(closesAt: string): string {
  const diff = new Date(closesAt).getTime() - Date.now()
  if (diff <= 0) return 'Cerrado'
  const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000)
  return d > 0 ? `${d}d ${String(h).padStart(2, '0')}h restantes` : `${h}h ${String(m).padStart(2, '0')}m restantes`
}

// ── Derivación de estado + métricas desde datos reales ──
export function derive(m: Membership, ladder: LadderRow[]) {
  const commit = Number(m.guaranteed_price)
  const cur = Number(m.current_price)
  const currentUnits = ladder.length ? Math.max(...ladder.map(t => Number(t.effective_demand ?? 0))) : 0
  const nextTier = ladder.filter(t => !t.unlocked && Number(t.price) < cur).sort((a, b) => Number(b.price) - Number(a.price))[0] ?? null
  // A-19 · Sin tramo siguiente NO hay objetivo, y ponerse uno mismo el listón
  // (`target = currentUnits`) daba siempre «18 / 18 uds · 100 % completado»: no es
  // «18 de las 18 que hacían falta», es «18 de las 18 que hay». Un denominador que se
  // cumple solo. Cuando no queda escalera, la barra no se pinta: se dice que ya está
  // el mejor precio, que es lo que de verdad ha pasado.
  const hasNextTier = nextTier != null
  const target = nextTier ? Number(nextTier.min_units) : currentUnits || m.quantity || 1
  const missing = nextTier ? Math.max(0, Number(nextTier.min_units) - currentUnits) : 0
  const nextObj = nextTier ? Number(nextTier.price) : null
  const pct = target > 0 ? Math.min(100, Math.round((currentUnits / target) * 100)) : 100

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
  return { commit, cur, currentUnits, target, missing, nextObj, pct, state, hasNextTier, groupFailed, authFailed: ps === 'auth_failed' }
}

// Enriquecer con tier_demand (RPC anon, solo lectura) para la barra de progreso. Compartido desktop + móvil.
export function useLadders(memberships: Membership[]) {
  const [ladders, setLadders] = useState<Record<string, LadderRow[]>>({})
  useEffect(() => {
    let cancelled = false
    async function run() {
      const openGroups = memberships.filter(m => m.status === 'open').map(m => m.group_id)
      const uniq = Array.from(new Set(openGroups))
      const entries = await Promise.all(uniq.map(async gid => {
        try {
          const { data } = await supabase.rpc('tier_demand', { p_group_id: gid })
          return [gid, (Array.isArray(data) ? data : []) as LadderRow[]] as const
        } catch { return [gid, [] as LadderRow[]] as const }
      }))
      if (!cancelled) setLadders(Object.fromEntries(entries))
    }
    if (memberships.length) run()
    return () => { cancelled = true }
  }, [memberships])
  return ladders
}

export default function MisGruposDesktop({ memberships, userName }: { memberships: Membership[]; userName?: string }) {
  const ladders = useLadders(memberships)
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
              {active > 0 && <span className="bg-brand/10 text-brand text-xs font-semibold px-2.5 py-1 rounded-full">{active} {active === 1 ? 'activo' : 'activos'}</span>}
            </div>
            <p className="text-sm text-neutral-500 mt-1">Grupos en los que ya participas y estás asegurando tu precio.</p>
          </div>

          {active === 0 ? (
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
          <p className="text-[11px] font-semibold mt-1 truncate" style={{ color: m.join_mode === 'esperar' ? '#D97706' : '#024947' }}>{m.join_mode === 'esperar' ? `Reserva a ${fmt(Number(m.target_price))}` : 'Compra directa'}</p>
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
        <span className="text-neutral-500">{isOpen && d.state !== 'liberado'
          ? (d.hasNextTier ? `${d.currentUnits} / ${d.target} uds en el grupo` : `${d.currentUnits} uds en el grupo`)
          : `${m.quantity} ud${m.quantity > 1 ? 's' : ''}`}</span>
        <span className="font-bold" style={{ color: d.state === 'noalc' ? '#94A3B8' : t.c }}>{d.state === 'meta' ? 'Objetivo alcanzado' : d.state === 'liberado' ? (isOpen ? 'El grupo sigue abierto' : 'Ya no participas') : d.state === 'noalc' ? 'Objetivo no alcanzado' : d.nextObj == null ? 'Precio mínimo' : d.missing === 1 ? 'Falta 1 ud' : `Faltan ${d.missing} uds`}</span>
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
              : <><span style={{ color: t.c }}>{I.shield}</span><span>Tu plaza está asegurada hasta {fmt(d.commit)}</span></>}
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
            <div><div className="text-base font-bold">{m.product_name}</div>{spec && <div className="text-[12.5px] text-neutral-500 mt-0.5">{spec}</div>}<div className="text-[11px] font-semibold mt-1" style={{ color: m.join_mode === 'esperar' ? '#D97706' : '#024947' }}>{m.join_mode === 'esperar' ? `Reserva a ${fmt(Number(m.target_price))}` : 'Compra directa'}</div></div>
          </div>
          <div className="flex gap-3 items-start rounded-2xl p-3.5 mt-4" style={{ background: t.secbg }}>
            <span className="w-[38px] h-[38px] rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: t.c }}>{I.shield}</span>
            <div><h5 className="text-sm font-bold">Tu plaza está asegurada hasta {fmt(d.commit)}</h5><p className="text-[11.5px] text-neutral-600 mt-1 leading-snug">Solo pagarás el precio final del grupo, nunca más de {fmt(d.commit)}. El importe está retenido, no cobrado.</p></div>
            <div className="ml-auto text-right shrink-0"><span className="text-xs font-bold rounded-lg px-2.5 py-1 bg-white inline-block" style={{ color: t.c, border: `1px solid ${t.bd}` }}>stripe</span><small className="block text-[10.5px] text-neutral-400 mt-1.5">Retención activa</small></div>
          </div>
          <div className="flex justify-between gap-2 mt-[18px]">
            <div><div className="text-[11px] text-neutral-500">Mi compromiso</div><div className="text-[19px] font-extrabold mt-1 whitespace-nowrap">{fmt(d.commit)}</div></div>
            <div className="text-center"><div className="text-[11px] text-neutral-500">Estado actual</div><div className="text-[19px] font-extrabold mt-1 whitespace-nowrap" style={{ color: '#0B7B44' }}>{fmt(d.cur)}</div>{saving > 0.005 && <div className="text-[11.5px] mt-0.5" style={{ color: '#0B7B44' }}>Estás ahorrando {fmt(saving)}</div>}</div>
            <div className="text-right"><div className="text-[11px] text-neutral-500">Próximo objetivo</div><div className="text-[19px] font-extrabold mt-1 whitespace-nowrap">{d.nextObj != null ? fmt(d.nextObj) : '—'}</div><div className="text-[11.5px] text-neutral-500 mt-0.5">{d.nextObj != null ? (d.missing === 1 ? 'Falta 1 ud' : `Faltan ${d.missing} uds`) : 'Precio mínimo'}</div></div>
          </div>
          {/* A-19 · Sin tramo siguiente no hay porcentaje que medir: la barra estaría
              siempre llena contra un objetivo que se pone ella misma. */}
          {d.hasNextTier ? (
            <>
              <div className="flex items-center mt-4"><div className="flex-1 h-1.5 rounded-full bg-neutral-200 overflow-hidden mr-1"><div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: t.c }} /></div><span className="w-4 h-4 rounded-full bg-white shrink-0" style={{ border: `2.5px solid ${t.c}` }} /></div>
              <div className="flex justify-between text-xs text-neutral-500 mt-2"><span>{d.currentUnits} / {d.target} uds</span><span>{d.pct}% completado</span></div>
            </>
          ) : (
            <div className="flex justify-between text-xs mt-4"><span className="text-neutral-500">{d.currentUnits} uds en el grupo</span><span className="font-bold" style={{ color: t.c }}>Mejor precio alcanzado</span></div>
          )}
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
            <div><div className="text-base font-bold">{m.product_name}</div>{spec && <div className="text-[12.5px] text-neutral-500 mt-0.5">{spec}</div>}<div className="text-[11px] font-semibold mt-1" style={{ color: m.join_mode === 'esperar' ? '#D97706' : '#024947' }}>{m.join_mode === 'esperar' ? `Reserva a ${fmt(Number(m.target_price))}` : 'Compra directa'}</div></div>
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
          <div><div className="text-base font-bold">{m.product_name}</div>{spec && <div className="text-[12.5px] text-neutral-500 mt-0.5">{spec}</div>}<div className="text-[11px] font-semibold mt-1" style={{ color: m.join_mode === 'esperar' ? '#D97706' : '#024947' }}>{m.join_mode === 'esperar' ? `Reserva a ${fmt(Number(m.target_price))}` : 'Compra directa'}</div></div>
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
