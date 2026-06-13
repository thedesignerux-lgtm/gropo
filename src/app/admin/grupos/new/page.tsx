'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createGroup } from '../actions'
import type { Tier } from '../actions'

function nextSundayISO(): string {
  const now = new Date()
  const daysUntil = now.getDay() === 0 ? 7 : 7 - now.getDay()
  const d = new Date(now)
  d.setDate(now.getDate() + daysUntil)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}T22:00`
}

const EMPTY_TIER: Tier = { min_units: 0, price: 0 }

export default function NewGroupPage() {
  const router = useRouter()

  const [fields, setFields] = useState({
    product_name: '',
    product_spec: '',
    product_url: '',
    image_url: '',
    closes_at: nextSundayISO(),
    seller_name: '',
    price_mode: 'fluid' as 'fluid' | 'stepped',
    min_execution: 5,
    max_stock: 50,
    payment_info: '',
  })
  const [tiers, setTiers] = useState<Tier[]>([
    { min_units: 1, price: 0 },
    { min_units: 10, price: 0 },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setField(key: keyof typeof fields, value: string | number) {
    setFields(f => ({ ...f, [key]: value }))
  }

  function setTier(index: number, key: keyof Tier, raw: string) {
    const value = parseFloat(raw)
    setTiers(ts => ts.map((t, i) => i === index ? { ...t, [key]: isNaN(value) ? 0 : value } : t))
  }

  function addTier() {
    setTiers(ts => [...ts, { ...EMPTY_TIER }])
  }

  function removeTier(index: number) {
    if (tiers.length <= 1) return
    setTiers(ts => ts.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await createGroup({ ...fields, tiers })
    setLoading(false)
    if (result?.error) setError(result.error)
  }

  const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:opacity-50'
  const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700 transition-colors">
          ←
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo grupo</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* ── GRUPO ── */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-bold text-gray-900">Producto</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Nombre del producto *</label>
              <input
                required
                type="text"
                value={fields.product_name}
                onChange={e => setField('product_name', e.target.value)}
                placeholder="Cubierta Continental GP5000"
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
                placeholder="700x25c, negro"
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
              <label className={labelCls}>Fecha de cierre *</label>
              <input
                required
                type="datetime-local"
                value={fields.closes_at}
                onChange={e => setField('closes_at', e.target.value)}
                disabled={loading}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Vendedor *</label>
              <input
                required
                type="text"
                value={fields.seller_name}
                onChange={e => setField('seller_name', e.target.value)}
                placeholder="Trek España"
                disabled={loading}
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">Se crea o reutiliza un usuario placeholder con role=seller</p>
            </div>
          </div>
        </section>

        {/* ── PUJA ── */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-bold text-gray-900">Primera puja</h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Modo de precio</label>
              <select
                value={fields.price_mode}
                onChange={e => setField('price_mode', e.target.value)}
                disabled={loading}
                className={inputCls}
              >
                <option value="fluid">Fluid</option>
                <option value="stepped">Stepped</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Ejecución mínima (uds)</label>
              <input
                required
                type="number"
                min={1}
                value={fields.min_execution}
                onChange={e => setField('min_execution', parseInt(e.target.value) || 1)}
                disabled={loading}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Stock máximo (uds)</label>
              <input
                required
                type="number"
                min={1}
                value={fields.max_stock}
                onChange={e => setField('max_stock', parseInt(e.target.value) || 1)}
                disabled={loading}
                className={inputCls}
              />
            </div>
          </div>

          {/* Datos de pago del vendedor */}
          <div>
            <label className={labelCls}>Datos de pago del vendedor (Bizum o IBAN)</label>
            <textarea
              rows={2}
              value={fields.payment_info}
              onChange={e => setField('payment_info', e.target.value)}
              placeholder="Bizum 600 000 000 · o · IBAN ES00 0000 0000 0000 0000 0000"
              disabled={loading}
              className={inputCls + ' resize-none'}
            />
            <p className="text-xs text-gray-400 mt-1">Se mostrará a los compradores adjudicados en el email de cierre. Opcional.</p>
          </div>

          {/* Tiers table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls + ' mb-0'}>Tramos de precio *</label>
              <button
                type="button"
                onClick={addTier}
                disabled={loading}
                className="text-xs font-semibold text-brand hover:underline disabled:opacity-50"
              >
                + Añadir tramo
              </button>
            </div>

            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-xs font-semibold text-gray-500">
                    <th className="px-4 py-2 text-left">Tramo</th>
                    <th className="px-4 py-2 text-right">Uds mínimas</th>
                    <th className="px-4 py-2 text-right">Precio (€)</th>
                    <th className="px-4 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tiers.map((tier, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-gray-500 text-xs">Tramo {i + 1}</td>
                      <td className="px-4 py-2">
                        <input
                          required
                          type="number"
                          min={1}
                          value={tier.min_units || ''}
                          onChange={e => setTier(i, 'min_units', e.target.value)}
                          disabled={loading}
                          className="w-full text-right px-2 py-1 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                          placeholder="10"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          required
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={tier.price || ''}
                          onChange={e => setTier(i, 'price', e.target.value)}
                          disabled={loading}
                          className="w-full text-right px-2 py-1 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                          placeholder="49.90"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeTier(i)}
                          disabled={loading || tiers.length <= 1}
                          className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-0"
                          aria-label="Eliminar tramo"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Orden ascendente por uds · precio descendente (más volumen = menor precio)
            </p>
          </div>
        </section>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={loading}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors disabled:opacity-60"
          >
            {loading ? 'Creando...' : 'Crear grupo'}
          </button>
        </div>

      </form>
    </div>
  )
}
