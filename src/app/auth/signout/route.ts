import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { cookieDomainFor } from '@/lib/auth-cookie-domain'

// Cierre de sesión robusto en servidor. El signOut del cliente solo borra las
// cookies que el JS ve; si quedan trozos huérfanos de sesiones anteriores
// (sb-<ref>-auth-token.0, .1, ...) el navegador los sigue enviando y Supabase
// no consigue reconstruir la sesión → "entra para ver tus grupos" en bucle.
// Aquí barremos TODAS las cookies sb-* del dominio.
export async function POST() {
  const supabase = createClient()
  try { await supabase.auth.signOut() } catch { /* best-effort */ }

  const response = NextResponse.json({ ok: true })
  const domain = cookieDomainFor(headers().get('host'))
  for (const cookie of cookies().getAll()) {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set(cookie.name, '', { path: '/', maxAge: 0 })
      if (domain) response.cookies.set(cookie.name, '', { path: '/', maxAge: 0, domain })
    }
  }
  return response
}

export const GET = POST
