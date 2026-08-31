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
