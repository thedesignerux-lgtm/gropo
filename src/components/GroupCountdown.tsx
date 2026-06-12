'use client'

import { useState, useEffect } from 'react'

function getRemaining(closesAt: string) {
  const diff = new Date(closesAt).getTime() - Date.now()
  if (diff <= 0) return null
  const s = Math.floor(diff / 1000)
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  }
}

interface Props {
  closesAt: string
  /** When true: render plain text (for metrics bar). Default: orange pill chip. */
  minimal?: boolean
}

export default function GroupCountdown({ closesAt, minimal }: Props) {
  const [rem, setRem] = useState<ReturnType<typeof getRemaining>>(null)

  useEffect(() => {
    setRem(getRemaining(closesAt))
    const id = setInterval(() => setRem(getRemaining(closesAt)), 1000)
    return () => clearInterval(id)
  }, [closesAt])

  if (rem === undefined) return null

  if (!rem) {
    return minimal
      ? <span className="text-[12px] font-bold text-gray-400 text-center">Cerrado</span>
      : <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-500 text-xs font-medium px-3 py-1.5 rounded-full">Cerrado</span>
  }

  const label = rem.days > 0
    ? `${rem.days}d ${rem.hours}h ${rem.minutes}m`
    : `${rem.hours}h ${rem.minutes}m ${rem.seconds}s`

  if (minimal) {
    return (
      <span className="text-[12px] font-bold text-orange-500 text-center leading-tight">
        Cierra en {label}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 text-xs font-semibold px-3 py-1.5 rounded-full">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      Cierra en {label}
    </span>
  )
}
