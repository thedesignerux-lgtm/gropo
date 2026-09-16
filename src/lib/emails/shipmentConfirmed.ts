// Plantilla del email "tu pedido está en camino" — confirmación de envío.
// Diseño v2 (sep-2026): badge "Tu pedido ya está en camino" con camión,
// tarjeta de producto, bloque de tracking (código + estado + transportista),
// CTA "Seguir mi pedido", phone block + "Ver mi pedido", trust badges, footer.
// Se envía cuando el vendedor confirma el envío y proporciona tracking.
// Remitente visible: Gropo.

import { SITE_URL } from '../site'
import {
  emailOpen, emailClose, emailHeader, emailSectionLabel, emailHero, emailSaludo,
  emailProductCard, emailCTAButton, emailPhoneBlock,
  emailTrustBadges, emailFooter, emailSpacer,
  FONT, C, TRUST,
  type StatusBadgeConfig, type ProductCardData,
} from './brand'

export interface ShipmentConfirmedData {
  nombre?: string
  productName: string
  trackingCode?: string
  carrier?: string
  trackingUrl?: string
  imageUrl?: string
  brandName?: string
  attributes?: string[]
  groupUrl?: string
}

export function shipmentConfirmedEmail(data: ShipmentConfirmedData): {
  subject: string
  text: string
  html: string
} {
  const {
    nombre, productName, trackingCode, carrier, trackingUrl,
    imageUrl, brandName, attributes, groupUrl,
  } = data
  const url = groupUrl ?? `${SITE_URL}/mis-grupos`

  const subject = `Tu pedido está en camino · ${productName}`

  // ── TEXT VERSION ──

  const text = `${nombre ? `Hola ${nombre},` : 'Hola,'}

Tu pedido de ${productName} ya está en camino. En breve lo recibirás en la dirección de entrega que nos indicaste.
${trackingCode ? `\nCódigo de seguimiento: ${trackingCode}` : ''}
${carrier ? `Transportista: ${carrier}` : ''}
${trackingUrl ? `\nSeguir mi pedido: ${trackingUrl}` : ''}

Ver mi pedido: ${url}

— Gropo`

  // ── HTML VERSION ──

  const badge: StatusBadgeConfig = {
    icon: '🚚',
    iconBg: C.primaryLight,
    iconColor: C.primary,
    title: 'Tu pedido ya está en camino.',
    subtitle: 'Gracias por comprar en Gropo.',
  }

  const productCard: ProductCardData = { imageUrl, brandName, productName, attributes }

  const saludoBody = `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:15px;color:${C.body};line-height:1.5;">
    Tu pedido de <strong style="color:${C.dark};">${productName}</strong> ya está en camino.
  </p>
  <p style="margin:4px 0 0 0;font-family:${FONT};font-size:14px;color:${C.muted};line-height:1.4;">En breve lo recibirás en la dirección de entrega que nos indicaste.</p>`

  // Tracking block
  const trackingBlock = trackingCode
    ? `<tr><td class="email-pad" style="padding:16px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cardBg};border-radius:12px;">
    <tr>
      <td width="52" style="padding:16px 0 16px 16px;vertical-align:top;">
        <div style="width:40px;height:40px;background:${C.primaryLight};border-radius:10px;text-align:center;line-height:40px;font-size:20px;">📦</div>
      </td>
      <td style="padding:16px 12px;vertical-align:top;">
        <p style="margin:0 0 2px 0;font-family:${FONT};font-size:12px;color:${C.muted};line-height:1.3;">Código de seguimiento</p>
        <p style="margin:0 0 4px 0;font-family:${FONT};font-size:18px;font-weight:700;color:${C.dark};line-height:1.3;letter-spacing:0.5px;">${trackingCode}</p>
        ${carrier ? `<p style="margin:0;font-family:${FONT};font-size:12px;color:${C.muted};line-height:1.3;">Transportista: ${carrier}</p>` : ''}
      </td>
      <td width="100" align="right" style="padding:16px 16px 16px 0;vertical-align:middle;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:4px 10px;background:#E8F5E9;border-radius:20px;">
            <p style="margin:0;font-family:${FONT};font-size:12px;font-weight:600;color:${C.successGreen};line-height:1.3;">● En tránsito</p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</td></tr>`
    : ''

  const ctaRow = trackingUrl
    ? emailCTAButton(
        'Seguir mi pedido',
        trackingUrl,
        'Haz clic para ver el estado actualizado en la web del transportista.',
      )
    : emailCTAButton(
        'Ver mi pedido',
        url,
        'Entra en tu cuenta para ver los detalles y el estado de tu pedido.',
      )

  const html = [
    emailOpen(),
    emailHeader(),
    emailSectionLabel('TU PEDIDO ESTÁ EN CAMINO'),
    emailHero(emailSaludo(nombre, saludoBody), badge),
    emailProductCard(productCard),
    trackingBlock,
    ctaRow,
    emailPhoneBlock(
      '¿Quieres ver más detalles de tu pedido?',
      'Entra con el mismo email al que te hemos enviado este mensaje y podrás ver tu pedido, los detalles y el estado actual. No hace falta contraseña.',
      'Ver mi pedido',
      url,
    ),
    emailSpacer(4),
    emailTrustBadges([TRUST.envio, TRUST.compraSegura, TRUST.responsable]),
    emailFooter(),
    emailClose(),
  ].join('\n')

  return { subject, text, html }
}
