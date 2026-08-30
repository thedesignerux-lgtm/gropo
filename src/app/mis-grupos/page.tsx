'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import AuthPanel from '@/components/AuthPanel'
import BottomNav from '@/components/BottomNav'
import MisGruposDesktop from '@/components/desktop/MisGruposDesktop'
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

export default function MisGruposPage() {
  const [sessionEmail, setSessionEmail] = useState<string | null | undefined>(undefined)
  const [userName, setUserName] = useState('')
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auth session check
  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => {
      setSessionEmail(data.user?.email ?? null)
      setUserName(data.user?.user_metadata?.full_name ?? data.user?.email ?? '')
    })
  }, [])

  // Auto-load groups when session is ready
  useEffect(() => {
    if (!sessionEmail) return

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/my-groups')
        if (!res.ok) throw new Error('Error cargando grupos')
        const data = await res.json()
        setMemberships(data.groups ?? [])
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [sessionEmail])

  // Checking session
  if (sessionEmail === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">···</p>
      </div>
    )
  }

  // Not logged in → AuthPanel (Google + magic link)
  if (sessionEmail === null) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto min-h-screen pb-28 px-4 pt-10">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <AuthPanel
              title="Entra para ver tus grupos"
              subtitle="Tus pedidos y su estado, en un sitio"
              ctaLabel="Entrar con el email"
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
            />
          </div>
          <Link href="/" className="block text-center text-sm font-semibold text-brand mt-6">
            Ver grupos abiertos
          </Link>
        </div>
        <BottomNav />
      </div>
    )
  }

  // Logged in → groups
  return (
    <>
      {/* Desktop */}
      <MisGruposDesktop memberships={memberships} userName={userName} />

      {/* Mobile */}
      <div className="lg:hidden min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto min-h-screen pb-28">
          <div className="px-4 pt-5 pb-4">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Mis grupos</h1>
            {userName && <p className="text-sm text-gray-400 mt-0.5">{userName}</p>}
          </div>

          {loading && (
            <div className="px-4 py-10 text-center text-sm text-gray-400">Cargando...</div>
          )}
          {error && (
            <p className="mx-4 bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</p>
          )}
          {!loading && !error && <MisGruposMobile memberships={memberships} />}
        </div>
        <BottomNav />
      </div>
    </>
  )
}
