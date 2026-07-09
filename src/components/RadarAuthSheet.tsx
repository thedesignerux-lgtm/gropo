'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

interface Props {
  open: boolean
  onClose: () => void
}

export default function RadarAuthSheet({ open, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)
    if (authError) {
      setError('No se pudo enviar el enlace. Inténtalo de nuevo.')
    } else {
      setSent(true)
    }
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
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

        {sent ? (
          /* Email sent state */
          <div className="text-center pt-2">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </div>
            <h2 className="text-lg font-bold text-neutral-900 mb-2">Revisa tu correo</h2>
            <p className="text-sm text-neutral-600 mb-1">Hemos enviado un enlace de acceso a</p>
            <p className="text-sm font-semibold text-neutral-900 mb-4">{email}</p>
            <p className="text-xs text-neutral-400">
              Haz clic en el enlace del email para entrar. Después, este producto se añadirá a tu Radar automáticamente.
            </p>
          </div>
        ) : (
          /* Login form */
          <>
            {/* Bookmark icon */}
            <div className="flex justify-center mb-4 pt-2">
              <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                </svg>
              </div>
            </div>

            <h2 className="text-lg font-bold text-neutral-900 text-center mb-1">
              Guarda este producto en tu Radar
            </h2>
            <p className="text-sm text-neutral-500 text-center mb-6">
              Te avisaremos cuando baje de precio
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Tu email"
                  required
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
                />
              </div>
              {error && (
                <p className="text-xs text-red-600">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full bg-brand text-white font-semibold text-sm py-3 rounded-xl hover:bg-brand-dark active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Iniciar sesión para activar tu Radar'}
              </button>
            </form>

            <p className="text-xs text-neutral-400 text-center mt-4">
              Te enviaremos un enlace mágico. Sin contraseñas.
            </p>
          </>
        )}
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
    </div>
  )
}
