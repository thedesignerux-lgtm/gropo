import { NextResponse } from 'next/server'
import { sendClosePaymentEmails } from '@/lib/emails/sendClose'

// Dispara los emails de pago de un grupo ya cerrado.
// Llama a la MISMA función que usa el botón de cierre — reutilizable por el cron.
//
// Guard por SECRETO en cabecera (no cookie): este endpoint vive bajo /api, fuera
// del path '/admin' de la cookie admin_auth, y además el futuro cron no tiene
// cookie — usa un secreto. Por ahora reutiliza ADMIN_SECRET; al construir el
// cron lo cambiaremos a CRON_SECRET.
//
// Uso manual:
//   curl -X POST https://<host>/api/email/close-payment \
//        -H "x-admin-secret: <ADMIN_SECRET>" \
//        -H "content-type: application/json" \
//        -d '{"groupId":"..."}'
//
// Nota: la vía normal de prueba es el botón "Cerrar grupo" del admin, que ya
// dispara estos emails directamente. Este endpoint es para re-disparar y cron.

export async function POST(req: Request) {
  const secret = process.env.ADMIN_SECRET
  const provided = req.headers.get('x-admin-secret')
  if (!secret || provided !== secret) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const groupId = body?.groupId as string | undefined
  if (!groupId) {
    return NextResponse.json({ ok: false, error: 'groupId requerido' }, { status: 400 })
  }

  try {
    const result = await sendClosePaymentEmails(groupId)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
