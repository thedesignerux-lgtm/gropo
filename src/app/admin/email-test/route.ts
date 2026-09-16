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

// Datos de ejemplo para las tarjetas de producto (v2)
const SAMPLE = {
  cubierta: {
    imageUrl: 'https://www.gropo.es/products/cubierta-gp5000.jpg',
    brandName: 'CONTINENTAL',
    attributes: ['Máximo rendimiento', 'Calidad Continental', 'Ideal para carretera'],
  },
  maillot: {
    imageUrl: 'https://www.gropo.es/products/maillot-castelli.jpg',
    brandName: 'CASTELLI',
    attributes: ['Rendimiento y comodidad', 'Ideal para tus rutas', 'Calidad Castelli'],
  },
  zapatillas: {
    imageUrl: 'https://www.gropo.es/products/zapatillas-shimano-rc503.jpg',
    brandName: 'SHIMANO',
    attributes: ['Ciclismo y carretera', 'Ligereza y comodidad', 'Calidad Shimano'],
  },
  gafas: {
    imageUrl: 'https://www.gropo.es/products/gafas-oakley-sutro.jpg',
    brandName: 'OAKLEY',
    attributes: ['Rendimiento y estilo', 'Ligeras y resistentes', 'Calidad Oakley'],
  },
  camara: {
    imageUrl: 'https://www.gropo.es/products/camara-continental-tpu.jpg',
    brandName: 'CONTINENTAL',
    attributes: ['Ligera y resistente', 'Ideal para carretera', 'Calidad Continental'],
  },
  sillin: {
    imageUrl: 'https://www.gropo.es/products/sillin-fizik.jpg',
    brandName: 'FIZIK',
    attributes: ['Confort extremo', 'Peso ligero', 'Calidad Fizik'],
  },
}

async function sendCase(to: string, c: Case) {
  const closesAt = nextSunday22h()
  const groupUrl = 'https://www.gropo.es/grupo/dd000000-0000-4000-8000-000000000002'

  switch (c) {
    case 'join':
      return sendJoinConfirmation({
        to,
        nombre: 'Benjamín',
        productName: 'Cubierta Continental GP5000',
        currentPrice: 41.9,
        closesAt,
        groupUrl,
        ...SAMPLE.cubierta,
      })

    case 'price_reached':
      return sendSelectedPriceReached({
        to,
        nombre: 'Benjamín',
        productName: 'Zapatillas Shimano RC503 Wide',
        targetPrice: 99,
        currentPrice: 99,
        totalUnits: 23,
        closesAt,
        groupUrl,
        ...SAMPLE.zapatillas,
      })

    case 'purchase_confirmed':
      return sendPurchaseConfirmation({
        to,
        nombre: 'Benjamín',
        productName: 'Gafas Oakley Sutro Lite Sweep',
        quantity: 2,
        finalPrice: 89.9,
        total: 179.8,
        groupUrl,
        ...SAMPLE.gafas,
      })

    case 'payment_instructions':
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
        groupUrl,
        ...SAMPLE.sillin,
      })

    case 'closed_not_reached':
      return sendClosedNotReached({
        to,
        nombre: 'Benjamín',
        productName: 'Maillot Castelli Entrata VI',
        chosenPrice: 45,
        finalPrice: 55,
        groupUrl,
        ...SAMPLE.maillot,
      })

    case 'auth_failed':
      return sendAuthorizationFailed({
        to,
        nombre: 'Benjamín',
        productName: 'Cámara Continental TPU 28"',
        finalPrice: 12.5,
        groupUrl,
        ...SAMPLE.camara,
      })

    case 'shipment':
      return sendShipmentConfirmed({
        to,
        nombre: 'Benjamín',
        productName: 'Cubierta Continental GP5000',
        trackingCode: 'GLS123456789ES',
        carrier: 'GLS',
        trackingUrl: 'https://gls-group.com/ES/es/seguimiento-de-paquetes?match=GLS123456789ES',
        groupUrl,
        ...SAMPLE.cubierta,
      })

    case 'weekend':
      return sendWeekendOpportunities({
        to,
        nombre: 'Benjamín',
        opportunities: [
          {
            productName: 'Zapatillas Shimano RC503 Wide',
            currentPrice: 99,
            pvp: 119,
            closesAt,
            groupUrl,
            ...SAMPLE.zapatillas,
          },
          {
            productName: 'Gafas Oakley Sutro Lite Sweep',
            currentPrice: 89.9,
            pvp: 109.9,
            closesAt,
            groupUrl,
            ...SAMPLE.gafas,
          },
        ],
      })

    case 'target_pending':
      return sendTargetPending({
        to,
        nombre: 'Benjamín',
        productName: 'Cubierta Continental GP5000',
        targetPrice: 35,
        currentPrice: 39.9,
        pvp: 45,
        closesAt,
        groupUrl,
        ...SAMPLE.cubierta,
      })

    case 'petition_matched':
      return sendPetitionMatched({
        to,
        nombre: 'Benjamín',
        productName: 'Producto pedido de ejemplo',
        groupUrl,
        currentPrice: 49.9,
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
