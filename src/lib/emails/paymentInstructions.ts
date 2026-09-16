// Plantilla del email de instrucciones de pago al cierre.
// Diseño v2 (sep-2026): badge "Pedido confirmado" (check verde),
// tarjeta de producto, bloque pedido (qty × precio | total),
// bloque warning con datos de pago + concepto,
// plazo, CTA "Ver mi pedido", trust badges, footer.
// Se envía SOLO a miembros adjudicados (payment_status='instructed').
// Remitente visible: Gropo.

import { SITE_URL } from '../site'
import {
  emailOpen, emailClose, emailHeader, emailSectionLabel, emailHero, emailSaludo,
  emailProductCard, emailCTAButton,
  emailTrustBadges, emailFooter, emailSpacer,
  fmtPrice, FONT, C, TRUST,
  type StatusBadgeConfig, type ProductCardData,
} from './brand'

export interface PaymentEmailData {
  nombre?: string
  productName: string
  quantity: number
  finalPrice: number
  total: number
  paymentInfo?: string | null  // Bizum/IBAN de la puja ganadora; puede venir vacío
  concepto: string
  deadline: string  // ISO timestamp (ahora + 48h)
  imageUrl?: string
  brandName?: string
  attributes?: string[]
  groupUrl?: string
}

function fmtDeadline(iso: string): string {
  const d = new Date(iso)
  const fecha = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid',
  }).format(d)
  const hora = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid',
  }).format(d)
  return `${fecha} a las ${hora}`
}

export function paymentInstructionsEmail(data: PaymentEmailData): {
  subject: string
  text: string
  html: string
} {
  const {
    nombre, productName, quantity, finalPrice, total,
    paymentInfo, concepto, deadline,
    imageUrl, brandName, attributes, groupUrl,
  } = data
  const precioUd = fmtPrice(finalPrice)
  const totalFmt = fmtPrice(total)
  const plazo = fmtDeadline(deadline)
  const url = groupUrl ?? `${SITE_URL}/mis-grupos`
  const hasPago = !!(paymentInfo && paymentInfo.trim())

  const subject = `Instrucciones de pago · ${productName}`

  // ── TEXT VERSION ──

  const pagoText = hasPago
    ? `Realiza el pago directamente al vendedor:\n${paymentInfo!.trim()}\n\nConcepto del pago (imprescindible): ${concepto}`
    : `Te enviaremos los datos de pago del vendedor por separado.\nCuando los recibas, usa este concepto: ${concepto}`

  const text = `${nombre ? `Hola ${nombre},` : 'Hola,'}

El grupo de ${productName} se ha cerrado y tu pedido está confirmado.

Tu pedido: ${quantity} ud${quantity === 1 ? '' : 's'} × ${precioUd}
Total a pagar: ${totalFmt}

${pagoText}

Plazo: antes del ${plazo} (48 horas).

Ver mi pedido: ${url}

— Gropo`

  // ── HTML VERSION ──

  const badge: StatusBadgeConfig = {
    icon: '✓',
    iconBg: C.successGreen,
    iconColor: C.white,
    title: 'Pedido confirmado',
    subtitle: 'Tu compra está confirmada.',
  }

  const productCard: ProductCardData = { imageUrl, brandName, productName, attributes }

  const saludoBody = `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:15px;color:${C.body};line-height:1.5;">
    El grupo de <strong style="color:${C.dark};">${productName}</strong> se ha cerrado y tu pedido está confirmado.
  </p>`

  // Order details block (same style as purchaseConfirmation)
  const orderBlock = `<tr><td class="email-pad" style="padding:16px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cardBg};border-radius:12px;" class="two-col">
    <tr>
      <td width="50%" style="padding:18px 16px;vertical-align:top;">
        <div style="display:inline-block;width:32px;height:32px;background:${C.primaryLight};border-radius:8px;text-align:center;line-height:32px;font-size:16px;margin-bottom:8px;">🛒</div>
        <p style="margin:0 0 2px 0;font-family:${FONT};font-size:12px;color:${C.muted};line-height:1.3;">Tu pedido</p>
        <p style="margin:0 0 4px 0;font-family:${FONT};font-size:20px;font-weight:700;color:${C.dark};line-height:1.2;">${quantity} ud${quantity === 1 ? '' : 's'} × ${precioUd}</p>
        <p style="margin:0;font-family:${FONT};font-size:12px;color:${C.muted};line-height:1.3;">${productName}</p>
      </td>
      <td width="1" style="width:1px;background:#E0E0E0;font-size:0;line-height:0;">&nbsp;</td>
      <td width="50%" style="padding:18px 16px;vertical-align:top;">
        <div style="display:inline-block;width:32px;height:32px;background:${C.primaryLight};border-radius:8px;text-align:center;line-height:32px;font-size:16px;margin-bottom:8px;">💳</div>
        <p style="margin:0 0 2px 0;font-family:${FONT};font-size:12px;color:${C.muted};line-height:1.3;">Total a pagar</p>
        <p style="margin:0;font-family:${FONT};font-size:24px;font-weight:700;color:${C.dark};line-height:1.2;">${totalFmt}</p>
      </td>
    </tr>
  </table>
</td></tr>`

  // Payment info block (warning style)
  const paymentBlock = hasPago
    ? `<tr><td class="email-pad" style="padding:16px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.warningBg};border:1px solid ${C.warningBdr};border-radius:12px;">
    <tr><td style="padding:18px 18px;">
      <p style="margin:0 0 4px 0;font-family:${FONT};font-size:15px;font-weight:700;color:#B45309;line-height:1.3;">Datos de pago</p>
      <p style="margin:0 0 6px 0;font-family:${FONT};font-size:13px;color:${C.secondary};line-height:1.4;">Paga directamente al vendedor:</p>
      <p style="margin:0 0 14px 0;font-family:${FONT};font-size:16px;font-weight:600;color:${C.dark};line-height:1.4;white-space:pre-wrap;">${paymentInfo!.trim()}</p>
      <p style="margin:0 0 4px 0;font-family:${FONT};font-size:13px;color:${C.secondary};line-height:1.3;">Concepto (imprescindible)</p>
      <p style="margin:0;font-family:monospace;font-size:16px;font-weight:700;color:${C.dark};line-height:1.3;">${concepto}</p>
    </td></tr>
  </table>
</td></tr>`
    : `<tr><td class="email-pad" style="padding:16px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.warningBg};border:1px solid ${C.warningBdr};border-radius:12px;">
    <tr><td style="padding:18px 18px;">
      <p style="margin:0 0 4px 0;font-family:${FONT};font-size:15px;font-weight:700;color:#B45309;line-height:1.3;">Datos de pago</p>
      <p style="margin:0 0 14px 0;font-family:${FONT};font-size:14px;color:${C.body};line-height:1.5;">Te enviaremos los datos de pago del vendedor por separado.</p>
      <p style="margin:0 0 4px 0;font-family:${FONT};font-size:13px;color:${C.secondary};line-height:1.3;">Concepto que deberás usar</p>
      <p style="margin:0;font-family:monospace;font-size:16px;font-weight:700;color:${C.dark};line-height:1.3;">${concepto}</p>
    </td></tr>
  </table>
</td></tr>`

  // Deadline row
  const deadlineRow = `<tr><td class="email-pad" style="padding:14px 28px 0 28px;">
  <p style="margin:0;font-family:${FONT};font-size:14px;color:${C.secondary};line-height:1.5;">
    Plazo: <strong style="color:${C.dark};">antes del ${plazo}</strong> (48 horas).
  </p>
</td></tr>`

  const html = [
    emailOpen(),
    emailHeader(),
    emailSectionLabel('INSTRUCCIONES DE PAGO'),
    emailHero(emailSaludo(nombre, saludoBody), badge),
    emailProductCard(productCard),
    orderBlock,
    paymentBlock,
    deadlineRow,
    emailCTAButton(
      'Ver mi pedido',
      url,
      'Entra en tu cuenta para ver todos los detalles del grupo y el estado de tu compra. No hace falta contraseña.',
    ),
    emailSpacer(4),
    emailTrustBadges([TRUST.pagoSeguro, TRUST.envio, TRUST.compraMejor]),
    emailFooter(),
    emailClose(),
  ].join('\n')

  return { subject, text, html }
}
