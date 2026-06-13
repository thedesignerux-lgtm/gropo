import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sendJoinConfirmation } from '@/lib/resend'

// Endpoint TEMPORAL de prueba de Resend.
// Uso: estando logueado en /admin, visita:
//   /admin/email-test?to=tu@email.com
// Vive BAJO /admin a propósito: la cookie admin_auth se pone con path '/admin',
// así que el navegador solo la envía a rutas bajo /admin (igual que el CSV).

export async function GET(req: Request) {
  const auth = cookies().get('admin_auth')?.value
  if (!process.env.ADMIN_SECRET || auth !== process.env.ADMIN_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const to = new URL(req.url).searchParams.get('to')
  if (!to) {
    return NextResponse.json({ ok: false, error: 'Falta el parámetro ?to=email' }, { status: 400 })
  }

  // Próximo domingo 22:00 (Europe/Madrid) como fecha de cierre de ejemplo
  const now = new Date()
  const daysUntilSunday = (7 - now.getDay()) % 7 || 7
  const closes = new Date(now)
  closes.setDate(now.getDate() + daysUntilSunday)
  closes.setHours(22, 0, 0, 0)

  try {
    const { data, error } = await sendJoinConfirmation({
      to,
      nombre: 'Prueba',
      productName: 'Cubierta Continental GP5000',
      currentPrice: 41.9,
      closesAt: closes.toISOString(),
    })

    if (error) {
      return NextResponse.json({ ok: false, error }, { status: 502 })
    }
    return NextResponse.json({ ok: true, id: data?.id ?? null, to })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
