'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { JoinResult } from './GroupLiveSection'

interface Props {
  groupId: string
  productName: string
  triggerClassName?: string
  onJoined?: (result: JoinResult) => void
}

export default function JoinModal({ groupId, productName, triggerClassName, onJoined }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', cantidad: 1 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof typeof form, value: string | number) {
    setForm(f => ({ ...f, [field]: value }))
    setError(null)
  }

  function validate(): string | null {
    if (!form.nombre.trim()) return 'El nombre es obligatorio'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Email no válido'
    const phone = form.telefono.replace(/[\s\-\.]/g, '').replace(/^\+34/, '')
    if (!/^[679][0-9]{8}$/.test(phone)) return 'Teléfono no válido (9 dígitos, empieza por 6, 7 o 9)'
    if (form.cantidad < 1 || form.cantidad > 10) return 'Cantidad entre 1 y 10'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('join_group', {
      p_group_id: groupId,
      p_name: form.nombre.trim(),
      p_email: form.email.trim(),
      p_phone: form.telefono.trim(),
      p_quantity: form.cantidad,
    })

    setLoading(false)

    if (rpcError) {
      setError(rpcError.message ?? 'Error al unirte al grupo')
      return
    }

    setOpen(false)
    setForm({ nombre: '', email: '', telefono: '', cantidad: 1 })
    onJoined?.(data as JoinResult)
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(null) }}
        className={triggerClassName ?? 'w-full bg-brand text-white font-semibold text-base py-4 rounded-2xl hover:bg-brand-dark active:scale-[0.98] transition-all'}
      >
        Sumarme a la compra
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => { if (!loading) setOpen(false) }}
          />
          <div className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl px-6 pt-6 pb-8 shadow-xl">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900">Unirme al grupo</h2>
              <button
                onClick={() => { if (!loading) setOpen(false) }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 disabled:opacity-40"
                aria-label="Cerrar"
                disabled={loading}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-5">{productName}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { id: 'nombre',   label: 'Nombre',   type: 'text',  placeholder: 'Tu nombre' },
                { id: 'email',    label: 'Email',    type: 'email', placeholder: 'tu@email.com' },
                { id: 'telefono', label: 'Teléfono', type: 'tel',   placeholder: '600 000 000' },
              ].map(({ id, label, type, placeholder }) => (
                <div key={id}>
                  <label htmlFor={id} className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
                  <input
                    id={id}
                    required
                    type={type}
                    value={(form as any)[id]}
                    onChange={e => set(id as keyof typeof form, e.target.value)}
                    placeholder={placeholder}
                    disabled={loading}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:opacity-50"
                  />
                </div>
              ))}
              <div>
                <label htmlFor="cantidad" className="block text-xs font-semibold text-gray-600 mb-1.5">Cantidad</label>
                <input
                  id="cantidad"
                  required
                  type="number"
                  min={1}
                  max={10}
                  value={form.cantidad}
                  onChange={e => set('cantidad', Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                  disabled={loading}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:opacity-50"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand text-white font-semibold text-sm py-3.5 rounded-xl hover:bg-brand-dark active:scale-[0.98] transition-all mt-1 disabled:opacity-60 disabled:scale-100"
              >
                {loading ? 'Uniéndome...' : 'Confirmar reserva'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
