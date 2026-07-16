'use client'

import { useState, useEffect } from 'react'

function getLabel(closesAt: string): string {
  const diff = new Date(closesAt).getTime() - Date.now()
  if (diff <= 0) return 'Cerrado'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h`
  return `${h}h ${m}m`
}

export default function GroupCountdownBadge({ closesAt }: { closesAt: string }) {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    setLabel(getLabel(closesAt))
    const id = setInterval(() => setLabel(getLabel(closesAt)), 60_000)
    return () => clearInterval(id)
  }, [closesAt])

  if (!label) return null

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white rounded-full px-2.5 py-1"
      style={{ background: 'rgba(180,84,26,.85)' }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 15" />
      </svg>
      {label}
    </span>
  )
}
