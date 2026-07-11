'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { toggleFavorite } from '@/app/favoritos/actions'
import RadarAuthSheet from '@/components/RadarAuthSheet'

interface Props {
  groupId: string
  initialFavorited?: boolean
  size?: number
  className?: string
  showToast?: boolean
  icon?: 'bookmark' | 'heart'
}

export default function FavoriteButton({ groupId, initialFavorited = false, size = 24, className = '', showToast = true, icon = 'bookmark' }: Props) {
  const [favorited, setFavorited] = useState(initialFavorited)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)
  const [showAuthSheet, setShowAuthSheet] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sincroniza con el valor del servidor cuando cambia (evita el "doble clic")
  useEffect(() => {
    setFavorited(initialFavorited)
  }, [initialFavorited])

  // Cleanup timer
  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current) }
  }, [])

  function showToastMessage(msg: string) {
    if (!showToast) return
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (isPending) return

    const next = !favorited
    setFavorited(next)
    startTransition(async () => {
      const result = await toggleFavorite(groupId)
      if (result.error === 'not_authenticated') {
        setFavorited(false)
        setShowAuthSheet(true)
      } else if (result.error) {
        setFavorited(!next) // revert
      } else {
        setFavorited(result.favorited)
        if (result.favorited) {
          showToastMessage('Añadido a Mi Radar')
        } else {
          showToastMessage('Eliminado de Mi Radar')
        }
      }
    })
  }

  return (
    <>
      <div className="relative inline-flex">
        <button
          onClick={handleClick}
          disabled={isPending}
          className={`flex items-center justify-center transition-all active:scale-90 disabled:opacity-50 ${className}`}
          aria-label={favorited ? 'Quitar del radar' : 'Guardar en mi radar'}
        >
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={favorited ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-colors ${favorited ? 'text-brand' : 'text-neutral-400 hover:text-neutral-600'}`}
          >
            {icon === 'heart'
              ? <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              : <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />}
          </svg>
        </button>

        {/* Mini toast */}
        {toast && (
          <div
            className="absolute right-0 top-full mt-2 z-50 whitespace-nowrap"
            style={{ animation: 'fadeInUp 200ms ease-out' }}
          >
            <div className="bg-neutral-900 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-lg">
              {toast}
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>

      {/* Auth bottom sheet for non-logged users */}
      <RadarAuthSheet open={showAuthSheet} onClose={() => setShowAuthSheet(false)} />
    </>
  )
}
