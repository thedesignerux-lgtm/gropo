import { cookies, headers } from 'next/headers'
// Guard de autenticación para las server actions del admin.
// Acepta DOS credenciales:
//  1. La cookie admin_auth (el admin logueado en el panel).
//  2. El Bearer CRON_SECRET en Authorization (el cron de Vercel, que llama
//     a closeGroup sin cookie; la ruta del cron ya valida este mismo secreto).
// Falla cerrado: sin variables configuradas, todo se rechaza.
export function requireAdmin(): string | null {
  const secret = process.env.ADMIN_SECRET
  const auth = cookies().get('admin_auth')?.value
  if (secret && auth === secret) return null
  const cronSecret = process.env.CRON_SECRET
  const bearer = headers().get('authorization')
  if (cronSecret && bearer === `Bearer ${cronSecret}`) return null
  return 'No autorizado'
}
