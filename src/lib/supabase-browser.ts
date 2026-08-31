import { createBrowserClient } from '@supabase/ssr'
import { authCookieOptions } from './auth-cookie-domain'

export function createClient() {
  const opts = typeof window !== 'undefined' ? authCookieOptions(window.location.hostname) : undefined
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    opts ? { cookieOptions: opts } : undefined,
  )
}
