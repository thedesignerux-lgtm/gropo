'use client'

import { useState } from 'react'
import { addBidToGroup } from '../actions'
import type { Tier } from '../actions'

const EMPTY_TIER: Tier = { min_units: 0, price: 0 }

interface Props {
  groupId: string
  initialClosesDate: string  // YYYY-MM-DD
  isFirstBid: boolean        // G5: distingue primera puja vs. adicional
}

export default function AssignSellerForm({ groupId, initialClosesDate, isFirstBid }: Props) {
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState({
    seller_name: '',
    price_mode: 'stepped' as 'fluid' | 'stepped',
    min_execution: 5,
    max_stock: 50,
    payment_info: '',
    shipping_included: false,
    pvp: '',
    closes_date: initialClosesDate,
  })
  const [tiers, setTiers] = useState<Tier[]>([
    { min_units: 1, price: 0 },
    { min_units: 10, price: 0 },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setField(key: keyof typeof fields, value: string | number | boolean) {
    setFields(f => ({ ...f, [key]: value }))
    setError(null)
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

    const payload: Parameters<typeof addBidToGroup>[1] = {
      tiers,
      price_mode: fields.price_mode,
      min_execution: fields.min_execution,
      max_stock: fields.max_stock,
      payment_info: fields.payment_info,
      shipping_included: fields.shipping_included,
      seller_name: fields.seller_name,
    }

    // Solo la primera puja actualiza fecha de cierre y PVP del grupo
    if (isFirstBid) {
      payload.closes_at = `${fields.closes_date}T20:00:00+00:00`
      payload.pvp = fields.pvp
    }

    const result = await addBidToGroup(groupId, payload)
    setLoading(false)
    if (result?.error) setError(result.error)
    else setOpen(false)
  }

  const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:opacity-50'
  const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setError(null) }}
        className="text-xs font-semibold text-brand hover:underline"
      >
        {isFirstBid ? '+ Asignar vendedor' : '+ Añadir puja'}
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 bg-white rounded-2xl border border-gray-200 p-6 space-y-4 w-full">
      <h3 className="text-base font-bold text-gray-900">
        {isFirstBid ? 'Asignar vendedor (primera puja)' : 'Añadir puja de otro vendedor'}
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
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
        </div>

        {/* Fecha de cierre y PVP solo en la primera puja (datos del grupo, no de la puja) */}
        {isFirstBid && (
          <>
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
              <p className="text-xs text-gray-400 mt-1">Cierra a las <strong>22:00 h Madrid</strong> (20:00 UTC · fijo)</p>
            </div>

            <div className="col-span-2 sm:col-span-1">
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
            </div>
          </>
        )}
      </div>

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


        {/* UX-03 · El envío deja de ser un texto fijo del checkout: lo declara
            el vendedor aquí. Por defecto NO marcado — nunca afirmar algo sin
            confirmar. Regla del MVP: si el vendedor no puede incluirlo, se
            renegocia el precio del tramo; no se publica con envío aparte. */}
        <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3.5 cursor-pointer">
          <input
            type="checkbox"
            checked={fields.shipping_included}
            onChange={e => setField('shipping_included', e.target.checked)}
            disabled={loading}
            className="mt-0.5 h-4 w-4 accent-brand"
          />
          <span>
            <span className="block text-sm font-semibold text-gray-900">Los precios incluyen el envío a península</span>
            <span className="block text-xs text-gray-500 mt-0.5">
              Confírmalo con el vendedor antes de marcarlo. Si lo marcas, el comprador
              verá &ldquo;Envío incluido&rdquo; en el pago y no se le puede cobrar nada aparte.
            </span>
          </span>
        </label>

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
      </div>

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

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}

      <div className="flex gap-3">
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
          {loading
            ? (isFirstBid ? 'Asignando...' : 'Añadiendo...')
            : (isFirstBid ? 'Asignar vendedor' : 'Añadir puja')
          }
        </button>
      </div>
    </form>
  )
}
