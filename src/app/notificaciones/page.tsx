'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import DesktopNavbar from '@/components/desktop/DesktopNavbar'
import BottomNav from '@/components/BottomNav'
import { useLadders, derive, type Membership } from '@/components/desktop/MisGruposDesktop'
import { readLocalIdentity } from '@/lib/local-identity'

type NType = 'success' | 'urgent' | 'info' | 'default'
interface Noti { id: string; type: NType; title: string; sub: string; groupId: string }

function buildNotis(memberships: Membership[], ladders: Record<string, any[]>): Noti[] {
  return memberships.map(m => {
    const d = derive(m, ladders[m.group_id] || [])
    const p = m.product_name
    if (d.state === 'meta') {
      const paid = m.payment_status === 'paid'
      return { id: m.member_id, type: 'success', title: paid ? '¡Compra confirmada!' : 'Tu grupo alcanzó la meta', sub: `${p} · ${paid ? 'pago realizado' : 'pago pendiente'}`, groupId: m.group_id }
    }
    if (d.state === 'liberado') {
      return { id: m.member_id, type: 'info', title: d.authFailed ? 'No pudimos confirmar tu pago' : 'Tu plaza se ha liberado', sub: `${p} · retención anulada, sin cargos`, groupId: m.group_id }
    }
    if (d.state === 'noalc') {
      return { id: m.member_id, type: 'info', title: 'El grupo no salió adelante', sub: `${p} · no se alcanzó el objetivo, sin cargos`, groupId: m.group_id }
    }
    if (d.state === 'apunto') {
      return { id: m.member_id, type: 'urgent', title: 'Tu grupo está a punto de cerrar', sub: d.nextObj != null ? `${p} · faltan ${d.missing} uds para bajar a ${d.nextObj} €` : `${p} · cierra pronto`, groupId: m.group_id }
    }
    return { id: m.member_id, type: 'default', title: 'Tu plaza sigue asegurada', sub: `${p} · el precio sigue bajando mientras entra gente`, groupId: m.group_id }
  })
}

const ICONS: Record<NType, { bg: string; fg: string; svg: React.ReactNode }> = {
  success: { bg: '#E7F7EF', fg: '#0B7B44', svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5 9-11" /></svg> },
  urgent: { bg: '#FDEBE3', fg: '#F0531F', svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></svg> },
  info: { bg: '#EFF6FF', fg: '#2563EB', svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg> },
  default: { bg: '#F0F7F7', fg: '#024947', svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></svg> },
}

export default function NotificacionesPage() {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loaded, setLoaded] = useState(false)
  const [identified, setIdentified] = useState(true)
  const ladders = useLadders(memberships)

  // A-21 — Esta pantalla miraba SOLO la identidad local del navegador, así que a un comprador con
  // sesión iniciada y un pago retenido vivo le enseñaba el estado vacío de usuario nuevo.
  // Orden correcto: 1) la sesión (misma fuente que /mis-grupos), 2) la identidad local, 3) nada.
  useEffect(() => {
    let cancelled = false

    async function load() {
      // 1. Sesión iniciada → /api/my-groups resuelve el teléfono desde `users` y llama a get_my_groups.
      try {
        const res = await fetch('/api/my-groups')
        if (res.ok) {
          const data = await res.json()
          const groups = (data?.groups ?? []) as Membership[]
          if (groups.length > 0) {
            if (!cancelled) { setMemberships(groups); setLoaded(true) }
            return
          }
        }
      } catch { /* sin sesión o endpoint caído → seguimos con la identidad local */ }

      // 2. Sin sesión (o sesión sin membresías): identidad guardada en este navegador.
      const u = readLocalIdentity()
      if (u.phone && u.email) {
        const { data } = await supabase.rpc('get_my_groups', { p_phone: u.phone, p_email: u.email })
        const groups = ((data as any)?.groups ?? []) as Membership[]
        if (!cancelled) { setMemberships(groups); setLoaded(true) }
        return
      }

      // 3. No sabemos quién es: el estado vacío no debe afirmar que no ha comprado nada.
      if (!cancelled) { setIdentified(false); setLoaded(true) }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const notis = buildNotis(memberships, ladders)

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
      <div className="hidden lg:block"><DesktopNavbar /></div>

      <div className="flex-1 min-w-0 flex flex-col pb-24 lg:pb-0">
        <main className="w-full max-w-[720px] mx-auto px-4 lg:px-10 pt-6 lg:pt-10 pb-14">
          <h1 className="text-2xl lg:text-[28px] font-extrabold tracking-tight text-neutral-900">Notificaciones</h1>
          <p className="text-sm text-neutral-500 mt-1">Lo que pasa con tus grupos, en un vistazo.</p>

          {loaded && notis.length === 0 ? (
            <div className="mt-8 bg-white border border-neutral-200 rounded-2xl px-6 py-14 text-center">
              <div className="w-14 h-14 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto mb-4">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></svg>
              </div>
              <p className="text-[15px] font-bold text-neutral-900">{identified ? 'Todo tranquilo por ahora' : 'No sabemos cuáles son tus grupos'}</p>
              <p className="text-sm text-neutral-500 mt-1 max-w-xs mx-auto">
                {identified
                  ? 'Cuando te unas a un grupo, aquí verás cómo baja el precio y cuándo se cierra.'
                  : 'Si ya has comprado en Gropo, entra con el mismo email que usaste y verás tus grupos y sus retenciones.'}
              </p>
              {identified ? (
                <Link href="/" className="inline-block mt-5 bg-brand text-white font-bold text-sm rounded-xl px-6 py-3">Explorar grupos</Link>
              ) : (
                <div className="mt-5 flex flex-col items-center gap-2">
                  <Link href="/mis-grupos" className="inline-block bg-brand text-white font-bold text-sm rounded-xl px-6 py-3">Entrar con mi email</Link>
                  <Link href="/" className="text-sm font-semibold text-brand">Explorar grupos</Link>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-3">
              {notis.map(n => {
                const ic = ICONS[n.type]
                return (
                  <Link key={n.id} href={`/grupo/${n.groupId}`} className="flex items-start gap-3.5 bg-white border border-neutral-200 rounded-2xl p-4 hover:border-neutral-300 transition-colors">
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: ic.bg, color: ic.fg }}>{ic.svg}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-bold text-neutral-900">{n.title}</p>
                      <p className="text-[13px] text-neutral-500 mt-0.5">{n.sub}</p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-neutral-300 shrink-0 mt-2"><path d="M9 6l6 6-6 6" /></svg>
                  </Link>
                )
              })}
            </div>
          )}
        </main>
      </div>

      <div className="lg:hidden"><BottomNav /></div>
    </div>
  )
}
