'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { closeGroup } from './actions'
import type { CloseResult } from './actions'

interface Props {
  groupId: string
  productName: string
  disabled?: boolean
}

const RESULT_MESSAGES: Record<string, (d: CloseResult) => string> = {
  closed: (d) =>
    `Grupo cerrado. Precio de liquidación: ${d.settlement_price?.toFixed(2).replace('.', ',')} € · ${d.total_units} uds. Todos los miembros pasan a "Instruido".`,
  surplus: (d) =>
    `Cerrado con excedente. ${d.adjudicated_units} uds adjudicadas a ${d.settlement_price?.toFixed(2).replace('.', ',')} € (instruidas). ${d.surplus_units} uds en excedente pendientes de resolución manual.${d.second_price_at_n != null ? ` 2º postor: ${d.second_price_at_n.toFixed(2).replace('.', ',')} €.` : ' Sin 2º postor.'}`,
  no_execution: (d) =>
    `Mínimo no alcanzado: ${d.total_units} uds de ${d.min_required} requeridas. Grupo cancelado, ningún miembro paga.`,
  no_active_bids: () =>
    `Sin pujas activas. Grupo cancelado.`,
  already_closed: () => `El grupo ya estaba cerrado.`,
  already_cancelled: () => `El grupo ya estaba cancelado.`,
}

export default function CloseGroupButton({ groupId, productName, disabled }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()

  const [inputVal, setInputVal] = useState('')
  const [loading, setLoading] = useState(false)
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null)

  const matches = inputVal.trim() === productName.trim()

  function openDialog() {
    setInputVal('')
    setOutcome(null)
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    dialogRef.current?.close()
  }

  async function handleConfirm() {
    if (!matches || loading) return
    setLoading(true)
    const res = await closeGroup(groupId)
    setLoading(false)

    if (res.error) {
      setOutcome({ ok: false, message: res.error })
      return
    }

    const d = res.data!
    const fmt = RESULT_MESSAGES[d.result]
    setOutcome({ ok: true, message: fmt ? fmt(d) : `Resultado: ${d.result}` })

    if (d.result === 'closed' || d.result === 'no_execution' || d.result === 'no_active_bids') {
      router.refresh()
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        disabled={disabled}
        className="px-4 py-2 rounded-xl border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Cerrar grupo
      </button>

      {/* Native dialog — backdrop styled via CSS class below */}
      <dialog
        ref={dialogRef}
        className="kuorum-dialog rounded-2xl border border-gray-200 shadow-2xl p-0 w-full max-w-md"
        onClick={(e) => { if (e.target === dialogRef.current) closeDialog() }}
      >
        <div className="p-6">
          <h2 className="text-base font-bold text-gray-900 mb-1">Cerrar grupo</h2>
          <p className="text-sm text-gray-500 mb-5">
            Esta acción es <strong className="text-gray-700">irreversible</strong>. Se calculará el precio
            final de liquidación y se instruirá el pago a todos los miembros adjudicados.
          </p>

          {outcome ? (
            /* ── Resultado ── */
            <div>
              <div
                className={`rounded-xl px-4 py-3 mb-4 text-sm leading-relaxed ${
                  outcome.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
                }`}
              >
                {outcome.message}
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          ) : (
            /* ── Confirmación ── */
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Escribe el nombre exacto del producto para confirmar
              </label>
              <p className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-1.5 rounded-lg mb-3 select-all">
                {productName}
              </p>
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                disabled={loading}
                placeholder="Escribe aquí…"
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 disabled:opacity-50 mb-4"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!matches || loading}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? 'Cerrando…' : 'Confirmar cierre'}
                </button>
              </div>
            </div>
          )}
        </div>
      </dialog>

      {/* Dialog backdrop */}
      <style>{`
        dialog.kuorum-dialog::backdrop {
          background: rgba(0, 0, 0, 0.45);
        }
      `}</style>
    </>
  )
}
