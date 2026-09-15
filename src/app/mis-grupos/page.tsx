'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import AuthPanel from '@/components/AuthPanel'
import BottomNav from '@/components/BottomNav'
import MisGruposDesktop, { MgSkeleton } from '@/components/desktop/MisGruposDesktop'
import DesktopNavbar from '@/components/desktop/DesktopNavbar'
import MisGruposMobile from '@/components/MisGruposMobile'

interface Membership {
  member_id: string
  quantity: number
  guaranteed_price: number
  final_price: number | null
  payment_status: 'pending' | 'instructed' | 'paid'
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

/**
 * POR QUÉ ESTA PÁGINA TARDABA (15-sep-2026).
 *
 * Benjamin: «al navegar desde/hacia Mis grupos, la pantalla desaparece unos segundos».
 * No era una animación ni el router: eran DOS VIAJES DE RED EN SERIE y un marco que se
 * iba con ellos.
 *
 *   1. `supabase.auth.getUser()` desde el navegador — viaje a Supabase, que además
 *      refresca el token. Mientras tanto la página devolvía una pantalla COMPLETA con
 *      tres puntos y **sin barra de navegación**: por eso desaparecía todo.
 *   2. Solo cuando eso volvía, `fetch('/api/my-groups')` — segundo viaje. Durante él,
 *      la lista estaba vacía y la vista de escritorio anunciaba «Aún no participas en
 *      ningún grupo» a alguien que sí participa.
 *
 * Tres estados, dos de ellos falsos. `/como-funciona` y `/favoritos` iban fluidas
 * porque pintan su barra en el primer render y no encadenan peticiones.
 *
 * QUÉ SE HACE AHORA. `/api/my-groups` **ya resuelve la sesión en el servidor** desde
 * las cookies y devuelve 401 si no hay ninguna, así que preguntárselo antes al
 * navegador era preguntar dos veces lo mismo. Se lanza esa única petición al montar y
 * su código de estado decide la pantalla: 401 → entrar, 200 → tus grupos.
 *
 * El nombre del usuario es decorativo, así que su petición va EN PARALELO y fuera del
 * camino crítico: aparece cuando llega y no retiene nada.
 *
 * Y el marco no se va nunca: las tres ramas pintan la barra de navegación.
 */
type Phase = 'loading' | 'anon' | 'ready'

/** Marco de escritorio para la rama sin sesión: la barra no puede desaparecer. */
function DesktopShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="hidden lg:block min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
      <DesktopNavbar />
      <main className="max-w-[1180px] mx-auto px-8 pb-16 pt-8">{children}</main>
    </div>
  )
}

export default function MisGruposPage() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [userName, setUserName] = useState('')
  const [memberships, setMemberships] = useState<Membership[]>([])
  // Las escaleras llegan con los pedidos: las tarjetas se pintan completas de una vez.
  const [ladderSeed, setLadderSeed] = useState<Record<string, any[]> | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  // Única petición del camino crítico. El 401 ES la respuesta «no hay sesión».
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/my-groups')
        if (cancelled) return
        if (res.status === 401) {
          setPhase('anon')
          return
        }
        if (!res.ok) throw new Error('No hemos podido cargar tus grupos')
        const data = await res.json()
        if (cancelled) return
        setMemberships(data.groups ?? [])
        setLadderSeed(data.ladders ?? undefined)
        setPhase('ready')
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message ?? 'No hemos podido cargar tus grupos')
        setPhase('ready')
      }
    })()
    return () => { cancelled = true }
  }, [])

  // El saludo. Va aparte a propósito: que tarde no debe retrasar los pedidos.
  useEffect(() => {
    let cancelled = false
    createClient().auth.getUser().then(({ data }) => {
      if (cancelled) return
      setUserName(data.user?.user_metadata?.full_name ?? data.user?.email ?? '')
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const authPanel = (
    <AuthPanel
      title="Entra para ver tus grupos"
      /* A-15 · La recuperación por email ya funcionaba —`/api/my-groups` busca
         por email, no por cuenta— y nadie lo decía. 26 de 28 compradores con
         compra viva no tienen cuenta creada; sin esta frase no saben que el
         correo de su compra les sirve para entrar. */
      subtitle="Usa el mismo email con el que compraste y verás tus pedidos, aunque no te hayas creado una cuenta"
      ctaLabel="Entrar con el email"
      icon={
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      }
    />
  )

  return (
    <>
      {/* ═══ Escritorio ═══ */}
      {phase === 'anon' ? (
        <DesktopShell>
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-neutral-200 p-6">
            {authPanel}
          </div>
          <Link href="/" className="block text-center text-sm font-semibold text-brand mt-6">
            Ver grupos abiertos
          </Link>
        </DesktopShell>
      ) : (
        <MisGruposDesktop memberships={memberships} ladderSeed={ladderSeed} loading={phase === 'loading'} />
      )}

      {/* ═══ Móvil ═══ */}
      <div className="lg:hidden min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto min-h-screen pb-28">
          {phase === 'anon' ? (
            <div className="px-4 pt-10">
              <div className="bg-white rounded-2xl border border-gray-200 p-6">{authPanel}</div>
              <Link href="/" className="block text-center text-sm font-semibold text-brand mt-6">
                Ver grupos abiertos
              </Link>
            </div>
          ) : (
            <>
              <div className="px-4 pt-5 pb-4">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Mis grupos</h1>
                {userName && <p className="text-sm text-gray-400 mt-0.5">{userName}</p>}
              </div>
              {error && (
                <p className="mx-4 bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</p>
              )}
              {phase === 'loading' ? (
                <div className="px-4 grid grid-cols-1 gap-4">
                  {[0, 1].map((i) => <MgSkeleton key={i} />)}
                </div>
              ) : (
                !error && <MisGruposMobile memberships={memberships} ladderSeed={ladderSeed} />
              )}
            </>
          )}
        </div>
        <BottomNav />
      </div>
    </>
  )
}
