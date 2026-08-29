'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { generateLabels } from './actions'
import type { ShippingResult } from '@/lib/shipping-sendcloud'

interface Props {
  groupId: string
  disabled?: boolean
}

export default function GenerateLabelsButton({ groupId, disabled }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [outcome, setOutcome] = useState<{ ok: boolean; result?: ShippingResult; error?: string } | null>(null)

  function openDialog() {
    setOutcome(null)
    dialogRef.current?.showModal()
  }
  function closeDialog() {
    dialogRef.current?.close()
  }

  async function handleConfirm() {
    if (loading) return
    setLoading(true)
    const res = await generateLabels(groupId)
    setLoading(false)
    if (res.error) {
      setOutcome({ ok: false, error: res.error })
      return
    }
    setOutcome({ ok: true, result: res.data })
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        disabled={disabled}
        className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Generar etiquetas
      </button>

      <dialog
        ref={dialogRef}
        className="gropo-dialog rounded-2xl border border-gray-200 shadow-2xl p-0 w-full max-w-md"
        onClick={(e) => { if (e.target === dialogRef.current) closeDialog() }}
      >
        <div className="p-6">
          <h2 className="text-base font-bold text-gray-900 mb-1">Generar etiquetas de envío</h2>
          <p className="text-sm text-gray-500 mb-5">
            Una etiqueta por cada miembro <strong className="text-gray-700">adjudicado</strong> (instruido o pagado)
            que aún no tenga. Es idempotente: no duplica las existentes.
          </p>

          {outcome ? (
            <div>
              {outcome.ok && outcome.result ? (
                <div className="rounded-xl px-4 py-3 mb-4 text-sm leading-relaxed bg-green-50 text-green-800">
                  <p className="font-semibold mb-1">
                    {outcome.result.created} creada{outcome.result.created === 1 ? '' : 's'}
                    {outcome.result.skipped > 0 ? ` · ${outcome.result.skipped} ya tenían` : ''}
                    {outcome.result.failed.length > 0 ? ` · ${outcome.result.failed.length} fallida${outcome.result.failed.length === 1 ? '' : 's'}` : ''}
                  </p>
                  {outcome.result.failed.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-red-700">
                      {outcome.result.failed.map((f) => (
                        <li key={f.member_id} className="font-mono break-all">{f.member_id.slice(0, 8)}: {f.reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="rounded-xl px-4 py-3 mb-4 text-sm leading-relaxed bg-red-50 text-red-700">
                  {outcome.error}
                </div>
              )}
              <button
                type="button"
                onClick={closeDialog}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          ) : (
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
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Generando…' : 'Generar'}
              </button>
            </div>
          )}
        </div>
      </dialog>

      <style>{`
        dialog.gropo-dialog::backdrop { background: rgba(0, 0, 0, 0.45); }
      `}</style>
    </>
  )
}
