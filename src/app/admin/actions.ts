'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function adminLogin(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const password = formData.get('password') as string
  const secret = process.env.ADMIN_SECRET

  if (!secret) return 'ADMIN_SECRET no configurado en el servidor'
  if (password !== secret) return 'Contraseña incorrecta'

  cookies().set('admin_auth', secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/admin',
  })

  redirect('/admin')
}

export async function adminLogout(): Promise<void> {
  cookies().delete('admin_auth')
  redirect('/admin')
}
