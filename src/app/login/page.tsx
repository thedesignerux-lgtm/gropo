'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  if (sent) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-neutral-100 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
              <rect width="20" height="16" x="2" y="4" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-neutral-900 mb-2">Revisa tu correo</h1>
          <p className="text-sm text-neutral-600 mb-1">Hemos enviado un enlace de acceso a</p>
          <p className="text-sm font-semibold text-neutral-900 mb-6">{email}</p>
          <p className="text-xs text-neutral-400">
            Haz clic en el enlace del email para entrar. Si no lo ves, revisa la carpeta de spam.
          </p>
          <button
            onClick={() => { setSent(false); setError(null) }}
            className="mt-6 text-sm text-brand font-medium hover:underline"
          >
            Usar otro email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-neutral-100 p-8">
          <Link href="/" className="block text-center mb-6">
            <img src="/logo.png" alt="Vonda" className="h-8 mx-auto" />
          </Link>
          <h1 className="text-xl font-bold text-neutral-900 text-center mb-2">Entra en Vonda</h1>
          <p className="text-sm text-neutral-500 text-center mb-6">
            Te enviaremos un enlace de acceso por email. Sin contraseñas.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1.5">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-colors"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-3 rounded-xl bg-brand text-white font-semibold text-sm hover:bg-brand-dark active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Enviando...' : 'Enviar enlace de acceso'}
            </button>
          </form>
        </div>
        <p className="text-xs text-neutral-400 text-center mt-4">
          Al continuar, aceptas nuestros términos y política de privacidad.
        </p>
      </div>
    </div>
  )
}
