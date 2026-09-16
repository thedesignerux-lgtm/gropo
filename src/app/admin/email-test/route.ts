import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  sendJoinConfirmation,
  sendSelectedPriceReached,
  sendPurchaseConfirmation,
  sendPaymentInstructions,
  sendClosedNotReached,
  sendAuthorizationFailed,
  sendShipmentConfirmed,
  sendWeekendOpportunities,
  sendTargetPending,
  sendPetitionMatched,
} from '@/lib/resend'

// Endpoint TEMPORAL de prueba de Resend — cubre TODOS los casos del sistema de
// comunicaciones del comprador con datos de ejemplo (no toca ningún grupo ni
// dato real).
//
// Uso: estando logueado en /admin, visita:
//   /admin/email-test?to=tu@email.com&case=all
//   /admin/email-test?to=tu@email.com&case=join
//
// Casos disponibles: join, price_reached, purchase_confirmed,
// payment_instructions, closed_not_reached, auth_failed, shipment,
// weekend, target_pending, petition_matched, all (por defecto: join, para no
// romper el uso anterior de este endpoint).
//
// Vive BAJO /admin a propósito: la cookie admin_auth se pone con path '/admin',
// así que el navegador solo la envía a rutas bajo /admin (igual que el CSV).

const CASES = [
  'join',
  'price_reached',
  'purchase_confirmed',
  'payment_instructions',
  'closed_not_reached',
  'auth_failed',
  'shipment',
  'weekend',
  'target_pending',
  'petition_matched',
] as const
type Case = (typeof CASES)[number]

function nextSunday22h(): string {
  const now = new Date()
  const daysUntilSunday = (7 - now.getDay()) % 7 || 7
  const closes = new Date(now)
  closes.setDate(now.getDate() + daysUntilSunday)
  closes.setHours(22, 0, 0, 0)
  return closes.toISOString()
}

async function sendCase(to: string, c: Case) {
  const closesAt = nextSunday22h()
  const groupUrl = 'https://www.gropo.es/grupo/dd000000-0000-4000-8000-000000000002'

  switch (c) {
    case 'join':
      // 01 · Participación confirmada
      return sendJoinConfirmation({
        to,
        nombre: 'Benjamín',
        productName: 'Cubierta Continental GP5000',
        currentPrice: 41.9,
        closesAt,
      })

    case 'price_reached':
      // 02 · El precio que elegiste ya se ha alcanzado (join_mode='esperar')
      return sendSelectedPriceReached({
        to,
        nombre: 'Benjamín',
        productName: 'Zapatillas Shimano RC503 Wide',
        targetPrice: 99,
        currentPrice: 99,
        totalUnits: 23,
        closesAt,
        groupUrl,
      })

    case 'purchase_confirmed':
      // 03 · Grupo cerrado · compra confirmada (cobro ya capturado, payment_status='paid')
      return sendPurchaseConfirmation({
        to,
        nombre: 'Benjamín',
        productName: 'Gafas Oakley Sutro Lite Sweep',
        quantity: 2,
        finalPrice: 89.9,
        total: 179.8,
      })

    case 'payment_instructions':
      // 03b · Grupo cerrado · compra confirmada (adjudicado por transferencia, payment_status='instructed')
      return sendPaymentInstructions({
        to,
        nombre: 'Benjamín',
        productName: 'Sillín Fizik Antares R3 Open',
        quantity: 1,
        finalPrice: 129,
        total: 129,
        paymentInfo: 'IBAN ES00 0000 0000 0000 0000 0000 (Vendedor de prueba)',
        concepto: 'GROPO-TEST-3',
        deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      })

    case 'closed_not_reached':
      // 04 · Grupo cerrado · precio no alcanzado
      return sendClosedNotReached({
        to,
        nombre: 'Benjamín',
        productName: 'Maillot Castelli Entrata VI',
        chosenPrice: 45,
        finalPrice: 55,
      })

    case 'auth_failed':
      // 05 · No hemos podido realizar la retención
      return sendAuthorizationFailed({
        to,
        nombre: 'Benjamín',
        productName: 'Cámara Continental TPU 28"',
        finalPrice: 12.5,
        groupUrl,
      })

    case 'shipment':
      // 06 · Pedido enviado
      return sendShipmentConfirmed({
        to,
        nombre: 'Benjamín',
        productName: 'Cubierta Continental GP5000',
        trackingCode: 'GLS123456789ES',
        carrier: 'gls',
        trackingUrl: 'https://gls-group.com/ES/es/seguimiento-de-paquetes?match=GLS123456789ES',
      })

    case 'weekend':
      // 08 · Nuevas oportunidades de compra (fin de semana)
      return sendWeekendOpportunities({
        to,
        nombre: 'Benjamín',
        opportunities: [
          { productName: 'Zapatillas Shimano RC503 Wide', currentPrice: 99, pvp: 119, closesAt, groupUrl },
          { productName: 'Gafas Oakley Sutro Lite Sweep', currentPrice: 89.9, pvp: 109.9, closesAt, groupUrl },
        ],
      })

    case 'target_pending':
      // Adicional · recordatorio de fin de semana para join_mode='esperar' con
      // target_price aún no alcanzado, pero grupo ya mejor que PVP
      return sendTargetPending({
        to,
        nombre: 'Benjamín',
        productName: 'Cubierta Continental GP5000',
        targetPrice: 35,
        currentPrice: 39.9,
        pvp: 45,
        closesAt,
        groupUrl,
      })

    case 'petition_matched':
      // Bonus: ya existía, no es parte de esta especificación pero usa el mismo cliente Resend
      return sendPetitionMatched({
        to,
        nombre: 'Benjamín',
        productName: 'Producto pedido de ejemplo',
        groupUrl,
      })
  }
}

export async function GET(req: Request) {
  const auth = cookies().get('admin_auth')?.value
  if (!process.env.ADMIN_SECRET || auth !== process.env.ADMIN_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const url = new URL(req.url)
  const to = url.searchParams.get('to')
  if (!to) {
    return NextResponse.json({ ok: false, error: 'Falta el parámetro ?to=email' }, { status: 400 })
  }

  const caseParam = url.searchParams.get('case') ?? 'join'
  const casesToSend: Case[] = caseParam === 'all' ? [...CASES] : caseParam.split(',').filter((c): c is Case => (CASES as readonly string[]).includes(c))

  if (casesToSend.length === 0) {
    return NextResponse.json(
      { ok: false, error: `case no reconocido. Usa uno de: ${CASES.join(', ')}, all` },
      { status: 400 },
    )
  }

  const results: Record<string, { ok: boolean; id?: string | null; error?: unknown }> = {}

  for (const c of casesToSend) {
    try {
      const { data, error } = await sendCase(to, c)
      results[c] = error ? { ok: false, error } : { ok: true, id: data?.id ?? null }
    } catch (e) {
      results[c] = { ok: false, error: e instanceof Error ? e.message : 'Error desconocido' }
    }
  }

  return NextResponse.json({ ok: true, to, results })
}
