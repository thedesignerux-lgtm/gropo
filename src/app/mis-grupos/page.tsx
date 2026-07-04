'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { normalizePhone } from '@/lib/phone'
import BottomNav from '@/components/BottomNav'

const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-base text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:opacity-50'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

interface VondaUser {
  email: string
  name: string
  phone?: string
}

// Forma plana que devuelve la RPC get_my_groups (un objeto por membresía)
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
  const [user, setUser] = useState<VondaUser | null | undefined>(undefined)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Formulario fallback (teléfono + email)
  const [showForm, setShowForm] = useState(false)
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [searching, setSearching] = useState(false)
  const skipAutoRef = useRef(false)

  // Leer identidad de localStorage (solo en cliente)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('vonda_user')
      setUser(raw ? (JSON.parse(raw) as VondaUser) : null)
    } catch {
      setUser(null)
    }
  }, [])

  // AUTO-CARGA: solo si localStorage tiene teléfono Y email guardados.
  // Si falta cualquiera de los dos, o la RPC devuelve vacío, caemos al formulario.
  useEffect(() => {
    if (user === undefined) return
    if (skipAutoRef.current) { skipAutoRef.current = false; return }

    const phone = normalizePhone(user?.phone || '')
    const email = (user?.email || '').trim()

    if (!phone || !email) {
      setFormPhone(user?.phone || '')
      setFormEmail(user?.email || '')
      setShowForm(true)
      return
    }

    async function load() {
      setLoading(true)
      setError(null)

      // Una sola RPC SECURITY DEFINER: identifica por teléfono normalizado
      // + email y devuelve los grupos sin exponer users/group_members a anon.
      const { data, error: rpcError } = await supabase.rpc('get_my_groups', { p_phone: phone, p_email: email })

      setLoading(false)
      if (rpcError) { setError(rpcError.message); return }
      const groups = ((data as any)?.groups ?? []) as Membership[]
      if (groups.length === 0) {
        setFormPhone(user?.phone || '')
        setFormEmail(user?.email || '')
        setShowForm(true)
        return
      }
      setMemberships(groups)
    }

    load()
  }, [user])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setNotFound(false)

    const email = formEmail.trim()
    if (!email) { setFormError('El email es obligatorio'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFormError('Email no válido'); return }
    const phone = normalizePhone(formPhone)
    if (!/^[679][0-9]{8}$/.test(phone)) { setFormError('Teléfono no válido (9 dígitos, empieza por 6, 7 o 9)'); return }

    setSearching(true)
    const { data, error: rpcError } = await supabase.rpc('get_my_groups', { p_phone: phone, p_email: email })
    setSearching(false)

    if (rpcError) { setFormError(rpcError.message); return }
    const groups = ((data as any)?.groups ?? []) as Membership[]
    if (groups.length === 0) { setNotFound(true); return }

    // Guardar identidad para que la auto-carga funcione en próximas visitas
    const next: VondaUser = { name: user?.name ?? '', email, phone }
    try { localStorage.setItem('vonda_user', JSON.stringify(next)) } catch {}
    skipAutoRef.current = true
    setUser(next)
    setMemberships(groups)
    setShowForm(false)
  }

  const enMarcha = memberships.filter(m => m.payment_status === 'pending')
  const cerrados = memberships.filter(m => m.payment_status === 'instructed' || m.payment_status === 'paid')

  // Hidratación: esperando localStorage (o esperando a que el efecto decida)
  if (user === undefined || (user === null && !showForm)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">···</p>
      </div>
    )
  }

  // FALLBACK: sin identidad completa o sin resultados → buscar por teléfono + email
  if (showForm) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto min-h-screen pb-28 px-4 pt-5">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Mis grupos</h1>
          <p className="text-sm text-gray-500 mt-0.5 mb-6">Dinos tu teléfono y tu email y buscamos tus pedidos.</p>

          <form onSubmit={handleSearch} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4" noValidate>
            <div>
              <label htmlFor="mg-phone" className={labelCls}>Teléfono</label>
              <input
                id="mg-phone"
                type="tel"
                inputMode="numeric"
                required
                placeholder="Teléfono móvil"
                className={inputCls}
                value={formPhone}
                onChange={e => { setFormPhone(e.target.value); setFormError(null); setNotFound(false) }}
                disabled={searching}
              />
            </div>
            <div>
              <label htmlFor="mg-email" className={labelCls}>Email</label>
              <input
                id="mg-email"
                type="email"
                required
                placeholder="el email con el que compraste"
                className={inputCls}
                value={formEmail}
                onChange={e => { setFormEmail(e.target.value); setFormError(null); setNotFound(false) }}
                disabled={searching}
              />
            </div>

            {formError && (
              <p className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{formError}</p>
            )}
            {notFound && (
              <p className="text-sm text-gray-500">No encontramos pedidos con esos datos.</p>
            )}

            <button
              type="submit"
              disabled={searching}
              className="w-full bg-brand text-white font-semibold text-sm py-3 rounded-2xl hover:bg-brand-dark transition-colors disabled:opacity-60"
            >
              {searching ? 'Buscando…' : 'Ver mis pedidos'}
            </button>
          </form>

          <Link
            href="/"
            className="block text-center text-sm font-semibold text-brand mt-6"
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
          <p className="text-sm text-gray-400 mt-0.5">{user?.name}</p>
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
                    const savings = Number(m.guaranteed_price) - Number(m.current_price)
                    return (
                      <div key={m.member_id} className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{m.product_name}</p>
                            {m.product_spec && (
                              <p className="text-xs text-gray-400 mt-0.5">{m.product_spec}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 bg-orange-100 text-orange-600 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                            </svg>
                            <Countdown closesAt={m.closes_at} />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-gray-50 rounded-xl px-3 py-2">
                            <p className="text-[10px] text-gray-400 mb-0.5">Tu precio</p>
                            <p className="text-sm font-bold text-gray-900">{fmt(Number(m.guaranteed_price))}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl px-3 py-2">
                            <p className="text-[10px] text-gray-400 mb-0.5">Precio actual</p>
                            <p className="text-sm font-bold text-brand">{fmt(Number(m.current_price))}</p>
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
                          href={`/grupo/${m.group_id}`}
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
                    const isPaid = m.payment_status === 'paid'
                    return (
                      <div key={m.member_id} className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{m.product_name}</p>
                            {m.product_spec && (
                              <p className="text-xs text-gray-400 mt-0.5">{m.product_spec}</p>
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

                        {!isPaid && m.payment_info && (
                          <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5 mb-3">
                            <p className="text-[10px] font-semibold text-orange-700 mb-1">Instrucciones de pago</p>
                            <p className="text-xs text-orange-900 whitespace-pre-line">{m.payment_info}</p>
                          </div>
                        )}

                        <Link
                          href={`/grupo/${m.group_id}`}
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
