'use client'

/**
 * `/notificaciones` — PURCHASE ACTIVITY FEED.
 *
 * DECISIÓN DE PRODUCTO (Benjamin, 14-sep-2026). Las dos pantallas de seguimiento
 * dejan de solaparse porque responden a preguntas distintas:
 *
 *   /mis-grupos     → ¿En qué compras estoy y cuál es su estado AHORA?  (gestión)
 *   /notificaciones → ¿Qué ha CAMBIADO desde la última vez?             (actividad)
 *
 * Antes esta pantalla pintaba UNA FILA POR MEMBRESÍA, siempre, para siempre, con
 * títulos en presente continuo («Tu plaza sigue asegurada»). Eso no es una
 * notificación: es el estado, ya contado —y mejor— en la otra pantalla (A-22).
 *
 * La regla de admisión está en `lib/purchaseFeed.ts` y es una sola: si el evento no
 * cambia nada en la compra del usuario, no entra. Ni bienvenidas, ni cuenta, ni
 * perfil, ni marketing, ni novedades de producto, ni actividad de terceros.
 */

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import DesktopNavbar from '@/components/desktop/DesktopNavbar'
import BottomNav from '@/components/BottomNav'
import { useLadders, type Membership } from '@/components/desktop/MisGruposDesktop'
import { readLocalIdentity } from '@/lib/local-identity'
import { readLastSeen, markSeen } from '@/lib/lastSeen'
import {
  buildPurchaseFeed,
  type FeedEvent,
  type FeedItem,
  type FeedMembership,
} from '@/lib/purchaseFeed'
import {
  buildCommsFeedItems,
  groupsWithPreciseClose,
  type MyNotificationRow,
} from '@/lib/buyerCommsFeed'

/** «hace 5 min» · «hace 3 h» · «ayer» · «13 sept». */
function cuando(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime()
  if (diff < 60_000) return 'ahora mismo'
  const min = Math.floor(diff / 60_000)
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ayer'
  if (d < 7) return `hace ${d} días`
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const ICONO_BG: Record<string, { bg: string; fg: string }> = {
  tier_unlocked: { bg: '#E7F7EF', fg: '#0B7B44' },
  price_drop: { bg: '#E7F7EF', fg: '#0B7B44' },
  members_joined: { bg: '#F0F7F7', fg: '#024947' },
  near_tier: { bg: '#FDEBE3', fg: '#B4541A' },
  closing_soon: { bg: '#FDEBE3', fg: '#B4541A' },
  closed: { bg: '#E7F7EF', fg: '#0B7B44' },
  not_executed: { bg: '#F1F5F9', fg: '#475569' },
  // Sistema de comunicaciones del comprador — derivados de buyer_communications.
  participation_confirmed: { bg: '#F0F7F7', fg: '#024947' },
  price_reached: { bg: '#E7F7EF', fg: '#0B7B44' },
  closed_success: { bg: '#E7F7EF', fg: '#0B7B44' },
  closed_not_reached: { bg: '#F1F5F9', fg: '#475569' },
  auth_failed: { bg: '#FDEBE3', fg: '#B4541A' },
  shipment_confirmed: { bg: '#F0F7F7', fg: '#024947' },
  target_pending: { bg: '#F0F7F7', fg: '#024947' },
}

export default function NotificacionesPage() {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [notifications, setNotifications] = useState<MyNotificationRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [identified, setIdentified] = useState(true)
  const [lastSeen] = useState<string | null>(() => readLastSeen())
  // Las escaleras vienen con `/api/my-groups`: una tanda menos de peticiones aquí
  // también. Por la vía de identidad local no llegan y `useLadders` las pide él.
  const [ladderSeed, setLadderSeed] = useState<Record<string, any[]> | undefined>(undefined)
  const ladders = useLadders(memberships, ladderSeed)
  const now = Date.now()

  /**
   * A-21 · Tres escalones de identidad, en este orden: la sesión primero (misma
   * fuente que `/mis-grupos`), la identidad local después, y solo entonces nadie.
   * Antes esta pantalla miraba SOLO el navegador, así que a alguien con sesión
   * iniciada y un pago retenido vivo le enseñaba el estado vacío de usuario nuevo.
   */
  useEffect(() => {
    let cancelled = false

    async function load() {
      let groups: Membership[] = []

      let notifs: MyNotificationRow[] = []

      try {
        const res = await fetch('/api/my-groups')
        if (res.ok) {
          const data = await res.json()
          groups = (data?.groups ?? []) as Membership[]
          notifs = (data?.notifications ?? []) as MyNotificationRow[]
          if (data?.ladders && !cancelled) setLadderSeed(data.ladders)
        }
      } catch { /* sin sesión o endpoint caído → identidad local */ }

      let localIdentity: { phone?: string; email?: string } | null = null
      if (groups.length === 0) {
        const u = readLocalIdentity()
        if (u.phone && u.email) {
          localIdentity = u
          const { data } = await supabase.rpc('get_my_groups', { p_phone: u.phone, p_email: u.email })
          groups = ((data as any)?.groups ?? []) as Membership[]
        } else if (!cancelled) {
          setIdentified(false)
        }
      }

      // Por identidad local (sin sesión), las notificaciones se piden aparte —
      // el mismo patrón de verificación teléfono+email que get_my_groups.
      if (notifs.length === 0 && localIdentity?.phone && localIdentity?.email) {
        const { data } = await supabase.rpc('get_my_notifications', {
          p_phone: localIdentity.phone,
          p_email: localIdentity.email,
        })
        notifs = ((data as any)?.notifications ?? []) as MyNotificationRow[]
      }
      if (!cancelled) setNotifications(notifs)

      if (cancelled) return
      setMemberships(groups)

      // Los eventos de SUS grupos. La política RLS de `events` ya permite leerlos
      // (todo menos `petition_created`), así que no se abre ninguna superficie nueva:
      // es la misma tabla que la ficha escucha en tiempo real para la escalera.
      if (groups.length > 0) {
        const ids = Array.from(new Set(groups.map((g) => g.group_id)))
        const { data: rows } = await supabase
          .from('events')
          .select('id, group_id, type, payload, created_at')
          .in('group_id', ids)
          .order('created_at', { ascending: false })
          .limit(120)
        if (!cancelled) setEvents((rows ?? []) as FeedEvent[])
      }

      if (!cancelled) setLoaded(true)
    }

    load()
    return () => { cancelled = true }
  }, [])

  // Al ver el feed, se marca la visita: lo nuevo de hoy deja de serlo mañana. Se
  // guarda DESPUÉS de pintar, para que esta misma visita todavía vea sus puntos.
  useEffect(() => {
    if (loaded && memberships.length > 0) markSeen()
  }, [loaded, memberships.length])

  const items = useMemo(() => {
    const base = buildPurchaseFeed(memberships as unknown as FeedMembership[], events, ladders as any, new Date(now))
    const comms = buildCommsFeedItems(notifications)
    // Cuando existe una comunicación de cierre PRECISA (por participación) para
    // un grupo, se descarta la versión aproximada derivada de `events` (por
    // grupo) para ESE grupo — evita mostrar dos veces "el grupo ha cerrado" con
    // matices distintos. Los grupos cerrados antes de este sistema no tienen
    // fila en `buyer_communications` y siguen viendo la versión aproximada.
    const preciseGroups = groupsWithPreciseClose(notifications)
    const baseFiltrado = base.filter(
      (it) => !((it.kind === 'closed' || it.kind === 'not_executed') && preciseGroups.has(it.groupId)),
    )
    return [...baseFiltrado, ...comms].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    // `now` cambia en cada render; se fija a la carga a propósito para que el feed
    // no se reordene mientras se lee.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberships, events, ladders, notifications])

  const vivos = items.filter((i) => i.live)
  const historico = items.filter((i) => !i.live)
  const esNuevo = (it: FeedItem) =>
    !it.live && (!lastSeen || new Date(it.at).getTime() > new Date(lastSeen).getTime())

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
      <div className="hidden lg:block"><DesktopNavbar /></div>

      <div className="flex-1 min-w-0 flex flex-col pb-24 lg:pb-0">
        <main className="w-full max-w-[720px] mx-auto px-4 lg:px-10 pt-6 lg:pt-10 pb-14">
          <h1 className="text-2xl lg:text-[28px] font-extrabold tracking-tight text-neutral-900">Actividad</h1>
          <p className="text-sm text-neutral-500 mt-1">Lo que ha cambiado en tus compras.</p>

          {!loaded && (
            <div className="mt-8 text-center text-sm text-neutral-400">Cargando…</div>
          )}

          {loaded && items.length === 0 && (
            <div className="mt-8 bg-white border border-neutral-200 rounded-2xl px-6 py-14 text-center">
              <div className="w-14 h-14 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto mb-4">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></svg>
              </div>
              <p className="text-[15px] font-bold text-neutral-900">
                {!identified ? 'No sabemos cuáles son tus grupos' : memberships.length === 0 ? 'Todo tranquilo por ahora' : 'Sin novedades'}
              </p>
              <p className="text-sm text-neutral-500 mt-1 max-w-xs mx-auto">
                {!identified
                  ? 'Si ya has comprado en Gropo, entra con el mismo email que usaste y verás la actividad de tus grupos.'
                  : memberships.length === 0
                    ? 'Cuando te unas a un grupo, aquí verás cada vez que baje el precio, entre gente nueva o se acerque el cierre.'
                    : 'Tus grupos siguen su curso. Te avisamos aquí en cuanto cambie algo.'}
              </p>
              {!identified ? (
                <div className="mt-5 flex flex-col items-center gap-2">
                  <Link href="/mis-grupos" className="inline-block bg-brand text-white font-bold text-sm rounded-xl px-6 py-3">Entrar con mi email</Link>
                  <Link href="/" className="text-sm font-semibold text-brand">Explorar grupos</Link>
                </div>
              ) : memberships.length === 0 ? (
                <Link href="/" className="inline-block mt-5 bg-brand text-white font-bold text-sm rounded-xl px-6 py-3">Explorar grupos</Link>
              ) : (
                <Link href="/mis-grupos" className="inline-block mt-5 text-sm font-semibold text-brand">Ver el estado de mis compras →</Link>
              )}
            </div>
          )}

          {/* ── Lo que aún se puede mover ── */}
          {vivos.length > 0 && (
            <section className="mt-6">
              <h2 className="text-[11px] font-extrabold uppercase tracking-wide text-neutral-400 mb-2">Ahora</h2>
              <div className="flex flex-col gap-3">
                {vivos.map((it) => <FeedRow key={it.id} it={it} now={now} nuevo={false} />)}
              </div>
            </section>
          )}

          {/* ── Lo que ya ha pasado ── */}
          {historico.length > 0 && (
            <section className="mt-7">
              {vivos.length > 0 && (
                <h2 className="text-[11px] font-extrabold uppercase tracking-wide text-neutral-400 mb-2">Antes</h2>
              )}
              <div className="flex flex-col gap-3">
                {historico.map((it) => <FeedRow key={it.id} it={it} now={now} nuevo={esNuevo(it)} />)}
              </div>
            </section>
          )}
        </main>
      </div>

      <div className="lg:hidden"><BottomNav /></div>
    </div>
  )
}

function FeedRow({ it, now, nuevo }: { it: FeedItem; now: number; nuevo: boolean }) {
  const c = ICONO_BG[it.kind] ?? { bg: '#F0F7F7', fg: '#024947' }
  return (
    <Link
      href={it.href}
      className="flex items-start gap-3.5 bg-white border rounded-2xl p-4 hover:border-neutral-300 transition-colors"
      style={{ borderColor: nuevo ? '#CFE6E4' : '#E5E5E5' }}
    >
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[17px]" style={{ background: c.bg, color: c.fg }}>
        {it.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-[14.5px] font-bold text-neutral-900">{it.title}</p>
          {nuevo && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#024947' }} aria-label="Nuevo" />}
          <span className="ml-auto text-[11.5px] text-neutral-400 shrink-0">{it.live ? 'Ahora' : cuando(it.at, now)}</span>
        </div>
        <p className="text-[13px] font-semibold text-neutral-700 mt-0.5 truncate">{it.productName}</p>
        <p className="text-[13px] text-neutral-500 mt-0.5">{it.body}</p>
        <span className="inline-block text-[12.5px] font-bold text-brand mt-1.5">{it.ctaLabel} →</span>
      </div>
    </Link>
  )
}
