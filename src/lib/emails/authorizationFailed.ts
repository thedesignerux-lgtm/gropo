// Plantilla del email "no hemos podido completar tu compra" (autorización fallida).
// Diseño v2 (sep-2026): header, saludo sin badge, tarjeta de producto,
// bloque error "Pago no realizado" con importe, sección "¿Quieres volver a intentarlo?",
// CTA "Volver a intentarlo", link de soporte, trust badges, footer.
// Se envía cuando el intento de autorización/captura de Stripe falla.
// Remitente visible: Gropo.

import {
  emailOpen, emailClose, emailHeader, emailSectionLabel, emailHero, emailSaludo,
  emailProductCard, emailAlertBlock, emailCTAButton,
  emailTrustBadges, emailFooter, emailSpacer,
  fmtPrice, FONT, C, TRUST,
  type ProductCardData,
} from './brand'
import { CONTACT_EMAIL } from '../site'

export interface AuthorizationFailedData {
  nombre?: string
  productName: string
  finalPrice: number
  groupUrl: string
  imageUrl?: string
  brandName?: string
  attributes?: string[]
}

export function authorizationFailedEmail(data: AuthorizationFailedData): {
  subject: string
  text: string
  html: string
} {
  const { nombre, productName, finalPrice, groupUrl, imageUrl, brandName, attributes } = data
  const precioFmt = fmtPrice(finalPrice)

  const subject = `Acción necesaria · ${productName}`

  // ── TEXT VERSION ──

  const text = `${nombre ? `Hola ${nombre},` : 'Hola,'}

No hemos podido completar tu compra de ${productName}.

Pago no realizado: Hemos intentado realizar una retención momentánea de ${precioFmt}, correspondiente al precio alcanzado por el grupo, pero no ha sido posible. Por el momento, has quedado fuera del grupo. No se te ha realizado ningún cargo.

¿Quieres volver a intentarlo? Puedes unirte de nuevo al grupo y completar tu compra en solo unos segundos.

Volver a intentarlo: ${groupUrl}

Si tienes algún problema con el pago, puedes contactar con nuestro equipo de soporte: ${CONTACT_EMAIL}

— Gropo`

  // ── HTML VERSION ──

  const productCard: ProductCardData = { imageUrl, brandName, productName, attributes }

  const saludoBody = `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:15px;color:${C.body};line-height:1.5;">
    No hemos podido completar tu compra de <strong style="color:${C.dark};">${productName}</strong>.
  </p>`

  // Retry section (styled like an info block but simpler)
  const retrySection = `<tr><td class="email-pad" style="padding:16px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cardBg};border-radius:12px;">
    <tr><td style="padding:20px 20px;">
      <p style="margin:0 0 8px 0;font-family:${FONT};font-size:18px;font-weight:700;color:${C.dark};line-height:1.3;">¿Quieres volver a intentarlo?</p>
      <p style="margin:0;font-family:${FONT};font-size:14px;color:${C.secondary};line-height:1.5;">Puedes unirte de nuevo al grupo y completar tu compra en solo unos segundos.</p>
    </td></tr>
  </table>
</td></tr>`

  // Support link below CTA
  const supportLink = `<tr><td class="email-pad" style="padding:12px 28px 0 28px;">
  <p style="margin:0;font-family:${FONT};font-size:13px;color:${C.muted};line-height:1.5;">Si tienes algún problema con el pago, puedes <a href="mailto:${CONTACT_EMAIL}" style="color:${C.primary};font-weight:600;text-decoration:underline;">contactar con nuestro equipo de soporte.</a></p>
</td></tr>`

  const html = [
    emailOpen(),
    emailHeader(),
    emailSectionLabel('NO HEMOS PODIDO COMPLETAR TU COMPRA'),
    emailHero(emailSaludo(nombre, saludoBody)),
    emailProductCard(productCard),
    emailAlertBlock(
      'error',
      'Pago no realizado',
      `Hemos intentado realizar una retención momentánea de <strong>${precioFmt}</strong>, correspondiente al precio alcanzado por el grupo, pero no ha sido posible. Por el momento, has quedado fuera del grupo. No se te ha realizado ningún cargo.`,
    ),
    retrySection,
    emailCTAButton('Volver a intentarlo', groupUrl),
    supportLink,
    emailSpacer(4),
    emailTrustBadges([TRUST.pagoSeguro, TRUST.sinCargos, TRUST.compraMejor]),
    emailFooter(),
    emailClose(),
  ].join('\n')

  return { subject, text, html }
}
