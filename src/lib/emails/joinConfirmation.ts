// Plantilla del email de confirmación de unión a un grupo.
// Diseño v2 (sep-2026): header con tagline, badge "Ya estás dentro",
// tarjeta de producto, precio + cierre, bloque "Juntos llegamos más lejos",
// CTA "Ver mi pedido", trust badges, footer con links y social.
// Remitente visible: Gropo.

import { SITE_URL } from '../site'
import {
  emailOpen, emailClose, emailHeader, emailSectionLabel, emailHero, emailSaludo,
  emailProductCard, emailTwoColumns, emailInfoBlock, emailCTAButton,
  emailShareBlock, emailTrustBadges, emailFooter, emailSpacer,
  fmtPrice, fmtCloses, FONT, C, TRUST,
  type StatusBadgeConfig, type ProductCardData,
} from './brand'

export interface JoinEmailData {
  nombre?: string
  productName: string
  currentPrice: number
  closesAt: string // ISO timestamp
  imageUrl?: string
  brandName?: string
  attributes?: string[]
  groupUrl?: string
}

export function joinConfirmationEmail(data: JoinEmailData): {
  subject: string
  text: string
  html: string
} {
  const {
    nombre, productName, currentPrice, closesAt,
    imageUrl, brandName, attributes, groupUrl,
  } = data
  const precio = fmtPrice(currentPrice)
  const cierre = fmtCloses(closesAt)
  const url = groupUrl ?? `${SITE_URL}/mis-grupos`

  const subject = `Te has unido al grupo · ${productName}`

  // ── TEXT VERSION ──

  const text = `${nombre ? `Hola ${nombre},` : 'Hola,'}

Ya formas parte del grupo de compra de ${productName}.
Cuantos más seamos, mejor precio para todos.

Precio actual del grupo: ${precio}
El grupo cierra el ${cierre}.

No tienes que hacer nada más: tu participación ayuda a alcanzar un mejor precio para todos los miembros del grupo.

Ver mi pedido: ${url}

— Gropo`

  // ── HTML VERSION ──

  const badge: StatusBadgeConfig = {
    icon: '👥',
    iconBg: C.primaryLight,
    iconColor: C.primary,
    title: 'Ya estás dentro',
    subtitle: 'Gracias por unirte. Juntos compramos mejor.',
  }

  const productCard: ProductCardData = {
    imageUrl,
    brandName,
    productName,
    attributes,
  }

  const saludoBody = `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:15px;color:${C.body};line-height:1.5;">
    Ya formas parte del grupo de compra de <strong style="color:${C.dark};">${productName}</strong>.
  </p>
  <p style="margin:4px 0 0 0;font-family:${FONT};font-size:14px;color:${C.muted};font-style:italic;line-height:1.4;">Cuantos más seamos, mejor precio para todos.</p>`

  const html = [
    emailOpen(),
    emailHeader(),
    emailSectionLabel('TE HAS UNIDO AL GRUPO'),
    emailHero(emailSaludo(nombre, saludoBody), badge),
    emailProductCard(productCard),
    emailTwoColumns(
      {
        icon: '🏷',
        iconBg: C.primaryLight,
        label: 'Precio actual del grupo',
        value: precio,
        subtext: 'Cuantos más seáis, mejor precio',
        subtextColor: C.successGreen,
      },
      {
        icon: '📅',
        iconBg: C.primaryLight,
        label: 'El grupo cierra',
        value: cierre.split(' a las ')[0],
        subtext: `a las ${cierre.split(' a las ')[1] ?? ''}`,
        subtextColor: C.muted,
      },
    ),
    emailInfoBlock(
      '👥',
      'Juntos llegamos más lejos',
      'Tu participación ayuda a alcanzar un mejor precio para todos los miembros del grupo.',
    ),
    emailShareBlock(productName, url),
    emailCTAButton(
      'Ver mi pedido',
      url,
      'Entra en tu cuenta para ver todos los detalles del grupo, el precio actual y el estado de tu compra. No hace falta contraseña.',
    ),
    emailSpacer(4),
    emailTrustBadges([TRUST.mejoresPrecios, TRUST.compraSegura, TRUST.responsable]),
    emailFooter(),
    emailClose(),
  ].join('\n')

  return { subject, text, html }
}
