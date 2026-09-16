// Plantilla del email de confirmación de compra al cierre.
// Diseño v2 (sep-2026): "¡COMPRA CONFIRMADA!", badge "Grupo cerrado con éxito",
// tarjeta de producto, pedido (qty × precio | total), bloque "Pago realizado",
// bloque "¿Qué pasa ahora?", CTA "Ver mi pedido", trust badges, footer.
// Se envía SOLO a miembros cuyo pago fue capturado con éxito (payment_status='paid').
// Remitente visible: Gropo.

import { SITE_URL } from '../site'
import {
  emailOpen, emailClose, emailHeader, emailSectionLabel, emailHero, emailSaludo,
  emailProductCard, emailAlertBlock, emailInfoBlock, emailCTAButton,
  emailTrustBadges, emailFooter, emailSpacer,
  fmtPrice, FONT, C, TRUST,
  type StatusBadgeConfig, type ProductCardData,
} from './brand'

export interface PurchaseEmailData {
  nombre?: string
  productName: string
  quantity: number
  finalPrice: number
  total: number // importe realmente capturado
  imageUrl?: string
  brandName?: string
  attributes?: string[]
  groupUrl?: string
}

export function purchaseConfirmationEmail(data: PurchaseEmailData): {
  subject: string
  text: string
  html: string
} {
  const {
    nombre, productName, quantity, finalPrice, total,
    imageUrl, brandName, attributes, groupUrl,
  } = data
  const precioUd = fmtPrice(finalPrice)
  const totalFmt = fmtPrice(total)
  const url = groupUrl ?? `${SITE_URL}/mis-grupos`

  const subject = `¡Compra confirmada! · ${productName}`

  // ── TEXT VERSION ──

  const text = `${nombre ? `Hola ${nombre},` : 'Hola,'}

¡Compra confirmada! El grupo de ${productName} se ha cerrado con éxito y tu compra está confirmada.

Gracias por confiar en Gropo. Muy pronto recibirás tu pedido.

Tu pedido: ${quantity} ud${quantity === 1 ? '' : 's'} × ${precioUd}
Total cobrado: ${totalFmt}
Pago realizado con tarjeta.

Pago realizado: Hemos realizado el cobro en tu tarjeta. Si tu banco muestra una retención por un importe mayor, la diferencia se libera automáticamente en unos días.

¿Qué pasa ahora? Prepararemos tu envío y te avisaremos por email en cuanto lo entreguemos al transportista, junto con los datos de seguimiento.

Ver mi pedido: ${url}

— Gropo`

  // ── HTML VERSION ──

  const badge: StatusBadgeConfig = {
    icon: '✓',
    iconBg: C.successGreen,
    iconColor: C.white,
    title: 'Grupo cerrado con éxito',
    subtitle: 'Tu compra está confirmada.',
  }

  const productCard: ProductCardData = { imageUrl, brandName, productName, attributes }

  const saludoBody = `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:15px;color:${C.body};line-height:1.5;">
    El grupo de <strong style="color:${C.dark};">${productName}</strong> se ha cerrado con éxito y tu compra está confirmada.
  </p>
  <p style="margin:4px 0 0 0;font-family:${FONT};font-size:14px;color:${C.muted};line-height:1.4;">Gracias por confiar en Gropo. Muy pronto recibirás tu pedido.</p>`

  // Order details block
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
        <p style="margin:0 0 2px 0;font-family:${FONT};font-size:12px;color:${C.muted};line-height:1.3;">Total cobrado</p>
        <p style="margin:0 0 4px 0;font-family:${FONT};font-size:24px;font-weight:700;color:${C.dark};line-height:1.2;">${totalFmt}</p>
        <p style="margin:0;font-family:${FONT};font-size:12px;color:${C.muted};line-height:1.3;">Pago realizado con tarjeta</p>
      </td>
    </tr>
  </table>
</td></tr>`

  const html = [
    emailOpen(),
    emailHeader(),
    emailSectionLabel('¡COMPRA CONFIRMADA!'),
    emailHero(emailSaludo(nombre, saludoBody), badge),
    emailProductCard(productCard),
    orderBlock,
    emailAlertBlock(
      'success',
      'Pago realizado',
      'Hemos realizado el cobro en tu tarjeta. Si tu banco muestra una retención por un importe mayor, la diferencia se libera automáticamente en unos días.',
    ),
    emailInfoBlock(
      '📦',
      '¿Qué pasa ahora?',
      'Prepararemos tu envío y te avisaremos por email en cuanto lo entreguemos al transportista, junto con los datos de seguimiento.',
    ),
    emailCTAButton(
      'Ver mi pedido',
      url,
      'Entra en tu cuenta para ver todos los detalles, el estado de tu pedido y la información de envío. No hace falta contraseña.',
    ),
    emailSpacer(4),
    emailTrustBadges([TRUST.envio, TRUST.pagoSeguro, TRUST.compraMejor]),
    emailFooter(),
    emailClose(),
  ].join('\n')

  return { subject, text, html }
}
