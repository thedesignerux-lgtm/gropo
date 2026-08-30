'use client'

// Panel de inicio de sesión reutilizable: Google + enlace mágico.
// Única fuente de la lógica de auth del cliente — RadarAuthSheet lo envuelve en
// una hoja, y Mis grupos / Mi perfil lo pintan a página completa cuando no hay
// sesión. Antes esta lógica vivía solo dentro de RadarAuthSheet.

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

export interface AuthPanelProps {
  title: string
  subtitle: string
  /** Texto del botón de email. Por defecto: "Continuar con el email". */
  ctaLabel?: string
  /** Icono del círculo superior. Por defecto: marcador (Radar). */
  icon?: React.ReactNode
  /** Ruta a la que volver tras autenticarse. Por defecto: la actual. */
  next?: string
  /** Nota bajo el formulario tras enviar el enlace. */
  sentNote?: string
  /** Email pre-rellenado (ej. del checkout). */
  initialEmail?: string
}

export default function AuthPanel({
  title,
  subtitle,
  ctaLabel = 'Continuar con el email',
  icon,
  next,
  sentNote = 'Haz clic en el enlace del email para entrar.',
  initialEmail = '',
}: AuthPanelProps) {
  const [email, setEmail] = useState(initialEmail)
  // Sync cuando initialEmail llega tarde (ej. desde localStorage)
  useEffect(() => { if (initialEmail && !email) setEmail(initialEmail) }, [initialEmail])
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function callbackUrl() {
    const target = next ?? window.location.pathname ?? '/'
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    setError(null)
    const supabase = createClient()
    // Arranque LIMPIO: barre cookies sb-* huérfanas (incluido el code-verifier
    // de un intento anterior a medias) antes de iniciar OAuth. Sin esto, un
    // login con Google previo abandonado bloquea el siguiente ("no me entra"),
    // que es exactamente lo que pasaba tras probar con varias cuentas.
    try { await fetch('/auth/signout', { method: 'POST' }) } catch { /* best-effort */ }
    try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* best-effort */ }
    const { error: gError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl(),
        // Forzar el selector de cuentas de Google. Sin esto, si el navegador
        // ya tiene una sesión de Google entra directo sin dejar elegir.
        queryParams: { prompt: 'select_account' },
      },
    })
    if (gError) {
      setGoogleLoading(false)
      setError('No se pudo conectar con Google. Inténtalo de nuevo.')
    }
    // Sin error: el navegador ya está redirigiendo a Google.
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl() },
    })

    setLoading(false)
    if (authError) setError('No se pudo enviar el enlace. Inténtalo de nuevo.')
    else setSent(true)
  }

  if (sent) {
    return (
      <div className="text-center pt-2">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-neutral-900 mb-2">Revisa tu correo</h2>
        <p className="text-sm text-neutral-600 mb-1">Hemos enviado un enlace de acceso a</p>
        <p className="text-sm font-semibold text-neutral-900 mb-4">{email}</p>
        <p className="text-xs text-neutral-400">{sentNote}</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-center mb-4 pt-2">
        <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
          {icon ?? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
          )}
        </div>
      </div>

      <h2 className="text-lg font-bold text-neutral-900 text-center mb-1">{title}</h2>
      <p className="text-sm text-neutral-500 text-center mb-6">{subtitle}</p>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-800 hover:bg-neutral-50 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        {googleLoading ? 'Conectando...' : 'Continuar con Google'}
      </button>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-neutral-200" />
        <span className="text-xs text-neutral-400">o con tu email</span>
        <div className="flex-1 h-px bg-neutral-200" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Tu email"
          required
          className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full bg-brand text-white font-semibold text-sm py-3 rounded-xl hover:bg-brand-dark active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? 'Enviando...' : ctaLabel}
        </button>
      </form>

      <p className="text-xs text-neutral-400 text-center mt-4">
        Te enviaremos un enlace mágico. Sin contraseñas.
      </p>
    </>
  )
}
