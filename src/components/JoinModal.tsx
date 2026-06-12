'use client'

import { useState } from 'react'

interface Props {
  groupId: string
  productName: string
}

export default function JoinModal({ groupId, productName }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', cantidad: 1 })

  function set(field: keyof typeof form, value: string | number) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    console.log('[JoinModal] reserva', { groupId, ...form })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-brand text-white font-bold text-base py-4 rounded-2xl hover:bg-brand-dark active:scale-[0.98] transition-all"
      >
        Unirme al grupo
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl px-6 pt-6 pb-8 shadow-xl">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900">Unirme al grupo</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                aria-label="Cerrar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-5">{productName}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { id: 'nombre',    label: 'Nombre',    type: 'text',   placeholder: 'Tu nombre' },
                { id: 'email',     label: 'Email',     type: 'email',  placeholder: 'tu@email.com' },
                { id: 'telefono',  label: 'Teléfono',  type: 'tel',    placeholder: '+34 600 000 000' },
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
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
                  value={form.cantidad}
                  onChange={e => set('cantidad', Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-brand text-white font-bold text-sm py-3.5 rounded-xl hover:bg-brand-dark active:scale-[0.98] transition-all mt-1"
              >
                Confirmar reserva
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
