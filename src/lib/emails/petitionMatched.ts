// Plantilla del email "tu petición ya tiene grupo".
// Diseño v2 (sep-2026): header con tagline, badge "Compra en grupo",
// tarjeta de producto con imagen, precio actual, "Entrar al grupo" CTA,
// trust badges, footer.
// Remitente visible: Gropo.

import {
  emailOpen, emailClose, emailHeader, emailSectionLabel, emailHero, emailSaludo,
  emailProductCard, emailCTAButton, emailShareBlock,
  emailTrustBadges, emailFooter, emailSpacer,
  fmtPrice, FONT, C, TRUST,
  type StatusBadgeConfig, type ProductCardData,
} from './brand'

export interface PetitionMatchedData {
  nombre?: string
  productName: string
  groupUrl: string
  currentPrice?: number
  imageUrl?: string
  brandName?: string
  attributes?: string[]
}

export function petitionMatchedEmail(data: PetitionMatchedData): {
  subject: string
  text: string
  html: string
} {
  const { nombre, productName, groupUrl, currentPrice, imageUrl, brandName, attributes } = data

  const subject = `¡Buenas noticias! Ya hay grupo para ${productName}`

  // ── TEXT VERSION ──

  const text = `${nombre ? `Hola ${nombre},` : 'Hola,'}

¡Buenas noticias! Ya hay un grupo de compra para ${productName}.

Únete y consigue un mejor precio junto a otros compradores.
${currentPrice != null ? `Precio actual: ${fmtPrice(currentPrice)}` : ''}

Entrar al grupo: ${groupUrl}

Descubre el grupo, el precio actual y únete con un solo clic. No hace falta contraseña.

— Gropo`

  // ── HTML VERSION ──

  const badge: StatusBadgeConfig = {
    icon: '👥',
    iconBg: C.primaryLight,
    iconColor: C.primary,
    title: 'Compra en grupo',
    subtitle: 'y consigue mejores precios.',
  }

  const productCard: ProductCardData = {
    imageUrl,
    brandName,
    productName,
    attributes,
  }

  const priceHtml = currentPrice != null
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
        <tr><td style="padding:8px 14px;background:${C.cardBg};border-radius:8px;">
          <p style="margin:0 0 2px 0;font-family:${FONT};font-size:12px;color:${C.muted};">Precio actual</p>
          <p style="margin:0;font-family:${FONT};font-size:24px;font-weight:700;color:${C.dark};">🏷 ${fmtPrice(currentPrice)}</p>
        </td></tr>
      </table>`
    : ''

  const saludoBody = `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:15px;color:${C.body};line-height:1.5;">
    Ya hay un grupo de compra para <strong style="color:${C.dark};">${productName}</strong>.
  </p>
  <p style="margin:4px 0 0 0;font-family:${FONT};font-size:14px;color:${C.muted};line-height:1.4;">Únete y consigue un mejor precio junto a otros compradores.</p>`

  // The price block goes inside the product card area
  const priceRow = currentPrice != null
    ? `<tr><td class="email-pad" style="padding:0 28px;">${priceHtml}</td></tr>`
    : ''

  const html = [
    emailOpen(),
    emailHeader(),
    emailSectionLabel('¡BUENAS NOTICIAS!'),
    emailHero(emailSaludo(nombre, saludoBody), badge),
    emailProductCard(productCard),
    priceRow,
    emailShareBlock(productName, groupUrl),
    emailCTAButton(
      'Entrar al grupo',
      groupUrl,
      'Descubre el grupo, el precio actual y únete con un solo clic. No hace falta contraseña.',
    ),
    emailSpacer(4),
    emailTrustBadges([TRUST.mejoresPrecios, TRUST.pagoSeguro, TRUST.envio]),
    emailFooter(),
    emailClose(),
  ].join('\n')

  return { subject, text, html }
}
