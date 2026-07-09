'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleFavorite } from '@/app/favoritos/actions'

interface Props {
  groupId: string
  initialFavorited?: boolean
  size?: number
  className?: string
}

export default function FavoriteButton({ groupId, initialFavorited = false, size = 24, className = '' }: Props) {
  const [favorited, setFavorited] = useState(initialFavorited)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Sincroniza con el valor del servidor cuando cambia (evita el "doble clic")
  useEffect(() => {
    setFavorited(initialFavorited)
  }, [initialFavorited])

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
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)
      } else if (result.error) {
        setFavorited(!next) // revert
      } else {
        setFavorited(result.favorited)
      }
    })
  }

  return (
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
        className={`transition-colors ${favorited ? 'text-red-500' : 'text-neutral-400 hover:text-neutral-600'}`}
      >
        <path d="M19.5 13.572l-7.5 7.428-7.5-7.428a5 5 0 117.5-6.566 5 5 0 117.5 6.572" />
      </svg>
    </button>
  )
}
