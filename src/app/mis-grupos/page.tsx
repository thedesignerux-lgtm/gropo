'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

interface GrupetaUser {
  email: string
  name: string
  phone?: string
}

interface Membership {
  id: string
  quantity: number
  guaranteed_price: number
  final_price: number | null
  payment_status: 'pending' | 'instructed' | 'paid'
  groups: {
    id: string
    product_name: string
    product_spec: string | null
    closes_at: string
    current_price: number
    image_url: string | null
    status: string
    bids: Array<{ payment_info: string | null; status: string }>
  }
}

function fmt(n: number) {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

function Countdown({ closesAt }: { closesAt: string }) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    function compute() {
      const diff = new Date(closesAt).getTime() - Date.now()
      if (diff <= 0) { setLabel('Cerrado'); return }
      const days = Math.floor(diff / 86_400_000)
      const hours = Math.floor((diff % 86_400_000) / 3_600_000)
      const mins = Math.floor((diff % 3_600_000) / 60_000)
      setLabel(days > 0 ? `${days}d ${hours}h` : `${hours}h ${mins}m`)
    }
    compute()
    const id = setInterval(compute, 60_000)
    return () => clearInterval(id)
  }, [closesAt])

  return <span>{label || '···'}</span>
}

export default function MisGruposPage() {
  const [user, setUser] = useState<GrupetaUser | null | undefined>(undefined)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Leer identidad de localStorage (solo en cliente)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('grupeta_user')
      setUser(raw ? (JSON.parse(raw) as GrupetaUser) : null)
    } catch {
      setUser(null)
    }
  }, [])

  // Cargar membresías cuando tengamos el usuario
  useEffect(() => {
    if (!user) return

    async function load() {
      setLoading(true)
      setError(null)

      // Buscar por teléfono (campo principal). Si el localStorage es antiguo
      // y no tiene phone, caer a email como fallback.
      const rawPhone = user!.phone || ''
      const phone = rawPhone.replace(/[\s\-\.]/g, '').replace(/^\+34/, '')
      const query = supabase.from('users').select('id')
      const { data: userData, error: userError } = await (
        phone
          ? query.eq('phone', phone).single()
          : query.eq('email', user!.email).single()
      )

      if (userError || !userData) {
        setLoading(false)
        setError('No encontramos tu cuenta. ¿Usaste un teléfono diferente al unirte?')
        return
      }

      const { data, error: membError } = await supabase
        .from('group_members')
        .select(`
          id, quantity, guaranteed_price, final_price, payment_status,
          groups (
            id, product_name, product_spec, closes_at, current_price, image_url, status,
            bids (payment_info, status)
          )
        `)
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false })

      setLoading(false)
      if (membError) { setError(membError.message); return }
      setMemberships((data ?? []) as unknown as Membership[])
    }

    load()
  }, [user])

  const enMarcha = memberships.filter(m => m.payment_status === 'pending')
  const cerrados = memberships.filter(m => m.payment_status === 'instructed' || m.payment_status === 'paid')

  // Hidratación: esperando localStorage
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">···</p>
      </div>
    )
  }

  // Sin usuario identificado
  if (user === null) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto min-h-screen pb-28 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Todavía no estás en ningún grupo</h1>
          <p className="text-sm text-gray-500 mb-6">Únete a un grupo de compra para ver tu seguimiento aquí.</p>
          <Link
            href="/"
            className="bg-brand text-white font-semibold text-sm px-6 py-3 rounded-2xl hover:bg-brand-dark transition-colors"
          >
            Ver grupos abiertos
          </Link>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto min-h-screen pb-28">

        {/* Header */}
        <div className="px-4 pt-5 pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Mis grupos</h1>
          <p className="text-sm text-gray-400 mt-0.5">{user.name}</p>
        </div>

        {loading && (
          <div className="px-4 py-10 text-center text-sm text-gray-400">Cargando...</div>
        )}
        {error && (
          <p className="mx-4 bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</p>
        )}

        {!loading && !error && (
          <div className="px-4 space-y-8">

            {/* ── EN MARCHA ── */}
            <section>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                En marcha · {enMarcha.length}
              </h2>
              {enMarcha.length === 0 ? (
                <p className="text-sm text-gray-400">No tienes grupos activos.</p>
              ) : (
                <div className="space-y-3">
                  {enMarcha.map(m => {
                    const g = m.groups
                    const savings = Number(m.guaranteed_price) - Number(g.current_price)
                    return (
                      <div key={m.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{g.product_name}</p>
                            {g.product_spec && (
                              <p className="text-xs text-gray-400 mt-0.5">{g.product_spec}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 bg-orange-100 text-orange-600 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                            </svg>
                            <Countdown closesAt={g.closes_at} />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-gray-50 rounded-xl px-3 py-2">
                            <p className="text-[10px] text-gray-400 mb-0.5">Tu precio</p>
                            <p className="text-sm font-bold text-gray-900">{fmt(Number(m.guaranteed_price))}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl px-3 py-2">
                            <p className="text-[10px] text-gray-400 mb-0.5">Precio actual</p>
                            <p className="text-sm font-bold text-brand">{fmt(Number(g.current_price))}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl px-3 py-2">
                            <p className="text-[10px] text-gray-400 mb-0.5">Uds</p>
                            <p className="text-sm font-bold text-gray-900">{m.quantity}</p>
                          </div>
                        </div>

                        {savings > 0.005 && (
                          <div className="flex items-center gap-1.5 bg-brand/5 rounded-xl px-3 py-2 mb-3">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand shrink-0">
                              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                              <polyline points="17 6 23 6 23 12" />
                            </svg>
                            <p className="text-xs font-semibold text-brand">
                              Ya ahorras {fmt(savings * m.quantity)}&nbsp;·&nbsp;{fmt(savings)}/ud
                            </p>
                          </div>
                        )}

                        <Link
                          href={`/grupo/${g.id}`}
                          className="block w-full text-center text-sm font-semibold text-brand border border-brand/30 rounded-xl py-2 hover:bg-brand/5 transition-colors"
                        >
                          Ver grupo →
                        </Link>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* ── CERRADOS ── */}
            <section>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Cerrados · {cerrados.length}
              </h2>
              {cerrados.length === 0 ? (
                <p className="text-sm text-gray-400">Todavía no has participado en ningún grupo cerrado.</p>
              ) : (
                <div className="space-y-3">
                  {cerrados.map(m => {
                    const g = m.groups
                    const activeBid = Array.isArray(g.bids)
                      ? (g.bids.find((b: any) => b.status === 'active') ?? g.bids[0] ?? null)
                      : null
                    const isPaid = m.payment_status === 'paid'
                    return (
                      <div key={m.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{g.product_name}</p>
                            {g.product_spec && (
                              <p className="text-xs text-gray-400 mt-0.5">{g.product_spec}</p>
                            )}
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${isPaid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {isPaid ? 'Pagado ✓' : 'Pendiente de pago'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-gray-50 rounded-xl px-3 py-2">
                            <p className="text-[10px] text-gray-400 mb-0.5">Precio final</p>
                            <p className="text-sm font-bold text-gray-900">{fmt(Number(m.final_price ?? m.guaranteed_price))}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl px-3 py-2">
                            <p className="text-[10px] text-gray-400 mb-0.5">Unidades</p>
                            <p className="text-sm font-bold text-gray-900">{m.quantity}</p>
                          </div>
                        </div>

                        {!isPaid && activeBid?.payment_info && (
                          <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5 mb-3">
                            <p className="text-[10px] font-semibold text-orange-700 mb-1">Instrucciones de pago</p>
                            <p className="text-xs text-orange-900 whitespace-pre-line">{activeBid.payment_info}</p>
                          </div>
                        )}

                        <Link
                          href={`/grupo/${g.id}`}
                          className="block w-full text-center text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl py-2 hover:bg-gray-50 transition-colors"
                        >
                          Ver detalles →
                        </Link>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* ── PETICIONES ── */}
            <section>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Peticiones
              </h2>
              <div className="bg-white rounded-2xl border border-gray-200 px-4 py-6 text-center">
                <p className="text-sm text-gray-400">Próximamente</p>
              </div>
            </section>

          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
