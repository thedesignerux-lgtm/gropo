'use client'

import { createPortal } from 'react-dom'
import AuthPanel from '@/components/AuthPanel'

interface Props {
  open: boolean
  onClose: () => void
}

export default function RadarAuthSheet({ open, onClose }: Props) {
  if (!open) return null

  function handleBackdropClick(e: React.MouseEvent) {
    // Nunca dejar que el click burbujee hasta la tarjeta/Link que abrió la hoja
    e.stopPropagation()
    if (e.target === e.currentTarget) onClose()
  }

  // Portal a <body>: dentro de la tarjeta (que tiene transform en hover),
  // position:fixed se ancla a la tarjeta y la hoja "baila" y deja pasar clicks.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" style={{ animation: 'fadeIn 200ms ease-out' }} />

      {/* Sheet */}
      <div
        className="relative w-full max-w-md bg-white rounded-t-2xl lg:rounded-2xl p-6 pb-8 lg:p-8"
        style={{ animation: 'slideUp 250ms ease-out' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
          aria-label="Cerrar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <AuthPanel
          title="Guarda este producto en tu Radar"
          subtitle="Te avisaremos cuando baje de precio"
          ctaLabel="Iniciar sesión para activar tu Radar"
          sentNote="Haz clic en el enlace del email para entrar. Después, este producto se añadirá a tu Radar automáticamente."
        />
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  )
}
