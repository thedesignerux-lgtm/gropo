'use client'

// Botón "Liberar" de la tabla de miembros del admin.
//
// No es una baja autoservicio: esto solo lo ve el admin. Es la salida para los
// casos que no son arrepentimiento (cantidad mal, dirección mal, alta duplicada,
// tarjeta robada) y que si no acaban en contracargo. Ver `releaseMember` en
// `actions.ts` para el porqué del orden de operaciones.
//
// Pide confirmación escribiendo el nombre, igual que el cierre de grupo: suelta
// dinero retenido y cambia el precio del grupo para todos los demás.

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { releaseMember } from './actions'

interface Props {
  memberId: string
  groupId: string
  memberName: string
  quantity: number
  holdLabel: string
}

export default function ReleaseMemberButton({ memberId, groupId, memberName, quantity, holdLabel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null)

  function open() {
    setOutcome(null)
    dialogRef.current?.showModal()
  }

  async function handleConfirm() {
    if (loading) return
    setLoading(true)
    const res = await releaseMember(memberId, groupId)
    setLoading(false)

    if (res.error) {
      setOutcome({ ok: false, message: res.error })
      return
    }
    setOutcome({
      ok: true,
      message: res.warning
        ? `Liberado. ⚠️ ${res.warning}`
        : `Liberado. El hold de ${memberName} se ha cancelado en Stripe y sus ${quantity} unidad(es) salen del grupo.`,
    })
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline"
      >
        Liberar
      </button>

      <dialog
        ref={dialogRef}
        className="rounded-2xl p-0 backdrop:bg-black/40 w-[min(92vw,460px)]"
        onClose={() => setOutcome(null)}
      >
        <div className="p-5">
          <h3 className="text-base font-bold text-gray-900">Liberar a {memberName}</h3>

          {!outcome ? (
            <>
              <p className="mt-2 text-sm text-gray-600">
                Se cancelará su retención de <b>{holdLabel}</b> en Stripe y sus{' '}
                <b>{quantity} unidad(es)</b> dejarán de contar en el grupo.
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Si al quitarlas el precio subiera por encima de lo garantizado a otro miembro, la
                operación se cancela sola y no se toca nada.
              </p>
              <p className="mt-2 text-xs text-gray-400">
                Esto no lo puede hacer el comprador. Úsalo solo para errores (cantidad, dirección,
                alta duplicada, tarjeta robada), no para arrepentimientos.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => dialogRef.current?.close()}
                  className="px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Liberando…' : 'Liberar el hold'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className={`mt-2 text-sm ${outcome.ok ? 'text-gray-700' : 'text-red-600'}`}>
                {outcome.message}
              </p>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => dialogRef.current?.close()}
                  className="px-3 py-2 rounded-lg text-sm font-bold text-white bg-gray-900 hover:bg-gray-800"
                >
                  Cerrar
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  )
}
