'use client'

import { useState } from 'react'
import { withdrawBid } from './actions'

interface Props {
  bidId: string
  groupId: string
  sellerName: string
}

export default function WithdrawBidButton({ bidId, groupId, sellerName }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleWithdraw() {
    setLoading(true)
    setError(null)
    const result = await withdrawBid(bidId, groupId)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setConfirming(false)
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => { setConfirming(true); setError(null) }}
        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
      >
        Retirar
      </button>
    )
  }

  return (
    <div className="mt-3 p-4 rounded-xl border border-red-200 bg-red-50 space-y-3">
      <p className="text-sm text-red-800">
        ¿Retirar la puja de <strong>{sellerName}</strong>? La puja dejará de participar en el
        cálculo del precio. Si hay miembros con holds, se verificará que el nuevo precio no
        supere su precio garantizado.
      </p>
      {error && (
        <p className="text-sm text-red-600 bg-white px-3 py-2 rounded-lg border border-red-200">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => { setConfirming(false); setError(null) }}
          disabled={loading}
          className="flex-1 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-white transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleWithdraw}
          disabled={loading}
          className="flex-1 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-60"
        >
          {loading ? 'Retirando...' : 'Confirmar retirada'}
        </button>
      </div>
    </div>
  )
}
