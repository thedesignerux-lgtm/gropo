'use client'

import { useState } from 'react'
import { updateGroup } from './actions'

interface Props {
  groupId: string
  initial: {
    product_name: string
    product_spec: string
    product_url: string
    image_url: string
    pvp: string
    closes_date: string  // YYYY-MM-DD
  }
}

export default function EditGroupForm({ groupId, initial }: Props) {
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setField(key: keyof typeof fields, value: string) {
    setFields(f => ({ ...f, [key]: value }))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await updateGroup(groupId, fields)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setOpen(false)
    }
  }

  const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:opacity-50'
  const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

  return (
    <div>
      <button
        onClick={() => { setOpen(o => !o); setError(null); setFields(initial) }}
        className="text-sm font-semibold text-brand hover:underline"
      >
        {open ? 'Cancelar edición' : 'Editar grupo'}
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="mt-5 bg-white rounded-2xl border border-gray-200 p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-gray-900">Editar grupo</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Nombre del producto *</label>
              <input
                required
                type="text"
                value={fields.product_name}
                onChange={e => setField('product_name', e.target.value)}
                disabled={loading}
                className={inputCls}
              />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Especificación</label>
              <input
                type="text"
                value={fields.product_spec}
                onChange={e => setField('product_spec', e.target.value)}
                disabled={loading}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>URL producto (opcional)</label>
              <input
                type="url"
                value={fields.product_url}
                onChange={e => setField('product_url', e.target.value)}
                placeholder="https://..."
                disabled={loading}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>URL imagen (opcional)</label>
              <input
                type="url"
                value={fields.image_url}
                onChange={e => setField('image_url', e.target.value)}
                placeholder="https://..."
                disabled={loading}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>PVP precio de tienda (opcional)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={fields.pvp}
                onChange={e => setField('pvp', e.target.value)}
                placeholder="54.95"
                disabled={loading}
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">Muestra el descuento en la tarjeta del grupo</p>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Fecha de cierre *</label>
              <input
                required
                type="date"
                value={fields.closes_date}
                onChange={e => setField('closes_date', e.target.value)}
                disabled={loading}
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">
                Cierra a las <strong>22:00 h Madrid</strong> (20:00 UTC · fijo)
              </p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null) }}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors disabled:opacity-60"
            >
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
