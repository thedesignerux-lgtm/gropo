import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const intent = searchParams.get('intent')

  if (code) {
    const cookieStore = cookies()
    // Acumular cookies para aplicarlas al redirect
    const cookiesToApply: { name: string; value: string; options: any }[] = []
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
              cookiesToApply.push({ name, value, options })
            })
          },
        },
      },
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const redirect = intent ? `${next}?intent=${intent}` : next
      const response = NextResponse.redirect(`${origin}${redirect}`)
      // Copiar las cookies de sesión al redirect para que el navegador las reciba
      cookiesToApply.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
      return response
    }
  }
  // Falló el intercambio (o no vino código): limpiar cookies sb-* para que el
  // siguiente intento arranque de cero, y no quedarse en un bucle de "no entra".
  const failResponse = NextResponse.redirect(`${origin}/login?error=auth`)
  for (const c of cookies().getAll()) {
    if (c.name.startsWith('sb-')) failResponse.cookies.set(c.name, '', { path: '/', maxAge: 0 })
  }
  return failResponse
}
