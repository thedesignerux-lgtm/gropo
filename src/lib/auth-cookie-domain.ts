// Comparte las cookies de auth entre el dominio raíz (gropo.es) y www.gropo.es.
// Sin un dominio común, el ida y vuelta de OAuth de Google salta entre ambos
// hosts y la cookie de sesión (y la temporal de PKCE) no se lee → la sesión se
// pierde y el usuario vuelve a ver el login aunque Google ya lo autenticó.
// Solo se aplica en los hosts *.gropo.es; en previews de Vercel (*.vercel.app)
// o en local se deja sin dominio para no romper esas cookies.
export function cookieDomainFor(hostname?: string | null): string | undefined {
  if (!hostname) return undefined
  return hostname === 'gropo.es' || hostname.endsWith('.gropo.es') ? '.gropo.es' : undefined
}

export function authCookieOptions(hostname?: string | null) {
  const domain = cookieDomainFor(hostname)
  return domain ? { domain, path: '/', sameSite: 'lax' as const, secure: true } : undefined
}
