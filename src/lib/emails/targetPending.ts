// Plantilla del email "tu precio todavía no se ha alcanzado" (recordatorio).
// Diseño v2 (sep-2026): badge "Precio pendiente", tarjeta de producto,
// bloque de precio actual vs PVP + ahorro, precio elegido,
// bloque informativo, fecha cierre, CTA "Ver mi grupo",
// share block, trust badges, footer.
// Se envía a miembros con join_mode='esperar' cuyo target_price NO se ha
// alcanzado, pero cuyo grupo ya ha conseguido un precio mejor que el PVP.
// IMPORTANTE: el CTA es "Ver mi grupo" — no existe acción "aceptar ahora".
// Remitente visible: Gropo.

import {
  emailOpen, emailClose, emailHeader, emailSectionLabel, emailHero, emailSaludo,
  emailProductCard, emailInfoBlock, emailCTAButton,
  emailShareBlock, emailTrustBadges, emailFooter, emailSpacer,
  fmtPrice, fmtCloses, FONT, C, TRUST,
  type StatusBadgeConfig, type ProductCardData,
} from './brand'

export interface TargetPendingData {
  nombre?: string
  productName: string
  targetPrice: number   // el precio que el usuario indicó (todavía no alcanzado)
  currentPrice: number  // precio actual del grupo (> targetPrice, pero < pvp)
  pvp: number
  closesAt: string      // ISO timestamp
  groupUrl: string
  imageUrl?: string
  brandName?: string
  attributes?: string[]
}

export function targetPendingEmail(data: TargetPendingData): {
  subject: string
  text: string
  html: string
} {
  const {
    nombre, productName, targetPrice, currentPrice, pvp,
    closesAt, groupUrl,
    imageUrl, brandName, attributes,
  } = data
  const elegido = fmtPrice(targetPrice)
  const actual = fmtPrice(currentPrice)
  const precioPvp = fmtPrice(pvp)
  const cierre = fmtCloses(closesAt)
  const ahorro = pvp > 0 ? Math.round((1 - currentPrice / pvp) * 100) : 0

  const subject = `Tu precio todavía no se ha alcanzado · ${productName}`

  // ── TEXT VERSION ──

  const text = `${nombre ? `Hola ${nombre},` : 'Hola,'}

El grupo de ${productName} sigue abierto. Tu precio elegido (${elegido}) todavía no se ha alcanzado, pero el grupo ya ha conseguido un precio mejor que el de venta al público:

Precio ya conseguido por el grupo: ${actual} (antes ${precioPvp})${ahorro > 0 ? ` — ${ahorro}% menos` : ''}
Tu precio elegido: ${elegido}

No tienes que hacer nada: sigues dentro del grupo. Si el precio baja hasta el tuyo antes del cierre, tu compra se ejecutará automáticamente. Si el grupo cierra sin llegar a tu precio, no se te cobrará nada.

El grupo cierra el ${cierre}.

Ver mi grupo: ${groupUrl}

— Gropo`

  // ── HTML VERSION ──

  const badge: StatusBadgeConfig = {
    icon: '🏷',
    iconBg: C.primaryLight,
    iconColor: C.primary,
    title: 'Precio pendiente',
    subtitle: 'Tu precio elegido aún no se ha alcanzado.',
  }

  const productCard: ProductCardData = { imageUrl, brandName, productName, attributes }

  const saludoBody = `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:15px;color:${C.body};line-height:1.5;">
    Tu precio elegido para <strong style="color:${C.dark};">${productName}</strong> todavía no se ha alcanzado, pero el grupo ya ha conseguido un precio mejor que el de venta al público.
  </p>`

  // Price comparison block
  const priceBlock = `<tr><td class="email-pad" style="padding:16px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cardBg};border-radius:12px;">
    <tr><td style="padding:18px 18px;">
      <p style="margin:0 0 2px 0;font-family:${FONT};font-size:12px;color:${C.muted};line-height:1.3;">Precio ya conseguido por el grupo</p>
      <p style="margin:0 0 4px 0;">
        <span style="font-family:${FONT};font-size:24px;font-weight:700;color:${C.dark};line-height:1.2;">${actual}</span>
        <span style="font-family:${FONT};font-size:14px;color:${C.light};text-decoration:line-through;margin-left:6px;">${precioPvp}</span>
      </p>
      ${ahorro > 0 ? `<p style="margin:0 0 14px 0;font-family:${FONT};font-size:13px;color:${C.successGreen};font-weight:600;line-height:1.3;">${ahorro}% menos que el PVP</p>` : '<div style="margin-bottom:14px;"></div>'}
      <p style="margin:0 0 2px 0;font-family:${FONT};font-size:12px;color:${C.muted};line-height:1.3;">Tu precio elegido</p>
      <p style="margin:0;font-family:${FONT};font-size:18px;font-weight:700;color:${C.dark};line-height:1.2;">${elegido}</p>
    </td></tr>
  </table>
</td></tr>`

  // Closing date
  const closingRow = `<tr><td class="email-pad" style="padding:10px 28px 0 28px;">
  <p style="margin:0;font-family:${FONT};font-size:13px;color:${C.muted};line-height:1.4;">El grupo cierra el <strong style="color:${C.body};">${cierre}</strong>.</p>
</td></tr>`

  const html = [
    emailOpen(),
    emailHeader(),
    emailSectionLabel('ACTUALIZACIÓN DE TU GRUPO'),
    emailHero(emailSaludo(nombre, saludoBody), badge),
    emailProductCard(productCard),
    priceBlock,
    emailInfoBlock(
      '👥',
      'No tienes que hacer nada',
      'Sigues dentro del grupo. Si el precio baja hasta el tuyo antes del cierre, tu compra se ejecutará automáticamente. Si el grupo cierra sin llegar a tu precio, no se te cobrará nada.',
    ),
    closingRow,
    emailShareBlock(productName, groupUrl),
    emailCTAButton(
      'Ver mi grupo',
      groupUrl,
      'Entra en tu cuenta para ver todos los detalles del grupo y el precio actual. No hace falta contraseña.',
    ),
    emailSpacer(4),
    emailTrustBadges([TRUST.mejoresPrecios, TRUST.pagoSeguro, TRUST.sinCargos]),
    emailFooter(),
    emailClose(),
  ].join('\n')

  return { subject, text, html }
}
