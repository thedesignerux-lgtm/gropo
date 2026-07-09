'use client'

import { useState, useRef, useEffect } from 'react'
import { toggleFavorite } from '@/app/favoritos/actions'

interface Props {
  groupId: string
}

export default function RadarCardMenu({ groupId }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function handleRemove() {
    setOpen(false)
    await toggleFavorite(groupId)
  }

  function handleShare() {
    setOpen(false)
    const url = `https://www.vonda.es/grupo/${groupId}`
    if (navigator.share) {
      navigator.share({ title: 'Vonda', url })
    } else {
      navigator.clipboard.writeText(url)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open) }}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
        aria-label="Opciones"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-lg border border-neutral-100 py-1 min-w-[160px]"
          onClick={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleShare() }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Compartir
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemove() }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            Eliminar del radar
          </button>
        </div>
      )}
    </div>
  )
}
