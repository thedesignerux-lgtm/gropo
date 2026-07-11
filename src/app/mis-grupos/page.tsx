'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { normalizePhone } from '@/lib/phone'
import BottomNav from '@/components/BottomNav'
import MisGruposDesktop from '@/components/desktop/MisGruposDesktop'
import MisGruposMobile from '@/components/MisGruposMobile'

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
    <>
    {/* ═══════ Desktop ═══════ */}
    <MisGruposDesktop memberships={memberships} userName={user?.name} />

    {/* ═══════ Mobile ═══════ */}
    <div className="lg:hidden min-h-screen bg-gray-50">
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

        {!loading && !error && <MisGruposMobile memberships={memberships} />}
      </div>
      <BottomNav />
    </div>
    </>
  )
}
