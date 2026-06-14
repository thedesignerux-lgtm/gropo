'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { normalizePhone } from '@/lib/phone'
import BottomNav from '@/components/BottomNav'

const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-base text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:opacity-50'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

export default function CrearPeticionPage() {
  const [form, setForm] = useState({
    producto: '',
    spec: '',
    url: '',
    cantidad: '1',
    nombre: '',
    email: '',
    telefono: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Autorrellenar identidad si ya se unió/pidió antes
  useEffect(() => {
    try {
      const raw = localStorage.getItem('grupeta_user')
      if (raw) {
        const u = JSON.parse(raw)
        setForm(f => ({
          ...f,
          nombre: u.name ?? f.nombre,
          email: u.email ?? f.email,
          telefono: u.phone ?? f.telefono,
        }))
      }
    } catch {}
  }, [])

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setError(null)
  }

  function adjustQuantity(delta: number) {
    const current = parseInt(form.cantidad, 10)
    const base = Number.isNaN(current) ? 0 : current
    set('cantidad', String(Math.min(10, Math.max(1, base + delta))))
  }

  function validate(): string | null {
    if (!form.producto.trim()) return 'El producto es obligatorio'
    const qty = parseInt(form.cantidad, 10)
    if (Number.isNaN(qty) || qty < 1 || qty > 10) return 'Cantidad entre 1 y 10'
    if (!form.nombre.trim()) return 'El nombre es obligatorio'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Email no válido'
    const phone = normalizePhone(form.telefono)
    if (!/^[679][0-9]{8}$/.test(phone)) return 'Teléfono no válido (9 dígitos, empieza por 6, 7 o 9)'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)
    setError(null)

    const { error: rpcError } = await supabase.rpc('create_petition', {
      p_product_name: form.producto.trim(),
      p_product_spec: form.spec.trim() || null,
      p_product_url: form.url.trim() || null,
      p_quantity: parseInt(form.cantidad, 10),
      p_name: form.nombre.trim(),
      p_email: form.email.trim(),
      p_phone: form.telefono.trim(),
    })

    setLoading(false)

    if (rpcError) {
      setError(rpcError.message ?? 'No pudimos crear tu petición. Inténtalo de nuevo.')
      return
    }

    // Recordar identidad para próximas pantallas (teléfono normalizado)
    try {
      localStorage.setItem('grupeta_user', JSON.stringify({
        name: form.nombre.trim(),
        email: form.email.trim(),
        phone: normalizePhone(form.telefono),
      }))
    } catch {}

    setDone(true)
  }

  // ── Pantalla de confirmación ──
  if (done) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto min-h-screen pb-28 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mb-4">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">¡Petición creada!</h1>
          <p className="text-sm text-gray-500 mb-6">
            Te avisaremos por email en cuanto encontremos un vendedor.
          </p>
          <Link
            href="/"
            className="bg-brand text-white font-semibold text-sm px-6 py-3 rounded-2xl hover:bg-brand-dark transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
        <BottomNav />
      </div>
    )
  }

  // ── Formulario ──
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto min-h-screen pb-28">

        {/* Header */}
        <div className="px-4 pt-5 pb-2">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-700 transition-colors" aria-label="Volver">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Crear petición</h1>
          </div>
          <p className="text-sm text-brand font-semibold mt-1 ml-8">Gratis y sin compromiso</p>
        </div>

        <form onSubmit={handleSubmit} className="px-4 pt-4 space-y-5">

          {/* Producto */}
          <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-base font-bold text-gray-900">¿Qué buscas?</h2>

            <div>
              <label htmlFor="producto" className={labelCls}>Producto *</label>
              <input
                id="producto"
                required
                type="text"
                value={form.producto}
                onChange={e => set('producto', e.target.value)}
                placeholder="Cubierta Continental GP5000"
                disabled={loading}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="spec" className={labelCls}>Especificación / variante (opcional)</label>
              <input
                id="spec"
                type="text"
                value={form.spec}
                onChange={e => set('spec', e.target.value)}
                placeholder="700x25, negro"
                disabled={loading}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="url" className={labelCls}>Enlace de referencia (opcional)</label>
              <input
                id="url"
                type="url"
                value={form.url}
                onChange={e => set('url', e.target.value)}
                placeholder="https://..."
                disabled={loading}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="cantidad" className={labelCls}>Cantidad que quieres *</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustQuantity(-1)}
                  disabled={loading || parseInt(form.cantidad, 10) <= 1}
                  aria-label="Restar una unidad"
                  className="shrink-0 w-11 h-11 rounded-xl border border-gray-200 text-gray-700 text-xl font-medium bg-white hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40 disabled:active:scale-100"
                >
                  −
                </button>
                <input
                  id="cantidad"
                  required
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.cantidad}
                  onChange={e => {
                    const v = e.target.value
                    if (v === '' || /^\d+$/.test(v)) set('cantidad', v)
                  }}
                  disabled={loading}
                  className="w-full min-w-0 px-3.5 py-2.5 rounded-xl border border-gray-200 text-base text-center text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => adjustQuantity(1)}
                  disabled={loading || parseInt(form.cantidad, 10) >= 10}
                  aria-label="Sumar una unidad"
                  className="shrink-0 w-11 h-11 rounded-xl border border-gray-200 text-gray-700 text-xl font-medium bg-white hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40 disabled:active:scale-100"
                >
                  +
                </button>
              </div>
            </div>
          </section>

          {/* Datos */}
          <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-base font-bold text-gray-900">Tus datos</h2>

            <div>
              <label htmlFor="nombre" className={labelCls}>Nombre *</label>
              <input
                id="nombre"
                required
                type="text"
                value={form.nombre}
                onChange={e => set('nombre', e.target.value)}
                placeholder="Tu nombre"
                disabled={loading}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="email" className={labelCls}>Email *</label>
              <input
                id="email"
                required
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="tu@email.com"
                disabled={loading}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="telefono" className={labelCls}>Teléfono *</label>
              <input
                id="telefono"
                required
                type="tel"
                value={form.telefono}
                onChange={e => set('telefono', e.target.value)}
                placeholder="600 000 000"
                disabled={loading}
                className={inputCls}
              />
            </div>
          </section>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-white font-semibold text-base py-4 rounded-2xl hover:bg-brand-dark active:scale-[0.98] transition-all disabled:opacity-60 disabled:scale-100"
          >
            {loading ? 'Enviando...' : 'Crear petición'}
          </button>
        </form>
      </div>
      <BottomNav />
    </div>
  )
}
