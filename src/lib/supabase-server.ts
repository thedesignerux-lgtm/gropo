import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { authCookieOptions } from './auth-cookie-domain'

export function createClient() {
  const cookieStore = cookies()
  const host = headers().get('host')
  const opts = authCookieOptions(host)
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      ...(opts ? { cookieOptions: opts } : {}),
      // Mismo motivo que en `supabase.ts` y `supabase-admin.ts`: sin esto, Next
      // puede servir desde su Data Cache lecturas hechas con la sesión de OTRA
      // persona. Aquí no es solo un precio desactualizado, es privacidad.
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {}
        },
      },
    },
  )
}
