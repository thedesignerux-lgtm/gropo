// Plantilla del email "¡Objetivo conseguido!" — el precio elegido se ha alcanzado.
// Diseño v2 (sep-2026): badge "¡Lo hemos conseguido!", tarjeta de producto,
// dos columnas precio elegido vs precio final, texto confirmación,
// dos columnas cierre + unidades, CTA "Ver mi grupo", trust badges, footer.
// Se envía a miembros con join_mode='esperar' cuando currentPrice ≤ targetPrice.
// Remitente visible: Gropo.

import {
  emailOpen, emailClose, emailHeader, emailSectionLabel, emailHero, emailSaludo,
  emailProductCard, emailTwoColumns, emailCTAButton,
  emailShareBlock, emailTrustBadges, emailFooter, emailSpacer,
  fmtPrice, fmtCloses, FONT, C, TRUST,
  type StatusBadgeConfig, type ProductCardData,
} from './brand'

export interface SelectedPriceReachedData {
  nombre?: string
  productName: string
  targetPrice: number
  currentPrice: number
  totalUnits: number
  closesAt: string  // ISO timestamp
  groupUrl: string
  imageUrl?: string
  brandName?: string
  attributes?: string[]
}

export function selectedPriceReachedEmail(data: SelectedPriceReachedData): {
  subject: string
  text: string
  html: string
} {
  const {
    nombre, productName, targetPrice, currentPrice,
    totalUnits, closesAt, groupUrl,
    imageUrl, brandName, attributes,
  } = data
  const targetFmt = fmtPrice(targetPrice)
  const priceFmt = fmtPrice(currentPrice)
  const cierre = fmtCloses(closesAt)

  const subject = `¡Objetivo conseguido! · ${productName}`

  // ── TEXT VERSION ──

  const text = `${nombre ? `Hola ${nombre},` : 'Hola,'}

¡Buenas noticias! El grupo de ${productName} ha alcanzado el precio que elegiste.

El precio que elegiste: ${targetFmt}
Precio final del grupo: ${priceFmt}

Tu compra se ejecutará a este precio si el grupo se mantiene (o mejora) hasta el cierre.

El grupo cierra el ${cierre}.
${totalUnits} unidades reunidas hasta ahora.

Ver mi grupo: ${groupUrl}

— Gropo`

  // ── HTML VERSION ──

  const badge: StatusBadgeConfig = {
    icon: '🎉',
    iconBg: C.primaryLight,
    iconColor: C.primary,
    title: '¡Lo hemos conseguido!',
    subtitle: 'Tu compra se ejecutará al precio acordado.',
  }

  const productCard: ProductCardData = { imageUrl, brandName, productName, attributes }

  const saludoBody = `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:15px;color:${C.body};line-height:1.5;">
    Buenas noticias: el grupo de <strong style="color:${C.dark};">${productName}</strong> ha alcanzado el precio que elegiste.
  </p>`

  // Confirmation text below price columns
  const confirmationRow = `<tr><td class="email-pad" style="padding:8px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.successBg};border-radius:8px;">
    <tr>
      <td width="36" style="padding:10px 0 10px 12px;vertical-align:middle;">
        <div style="width:24px;height:24px;background:${C.successGreen};border-radius:50%;text-align:center;line-height:24px;font-size:14px;color:${C.white};">✓</div>
      </td>
      <td style="padding:10px 14px 10px 8px;vertical-align:middle;">
        <p style="margin:0;font-family:${FONT};font-size:13px;color:${C.successGreen};font-weight:600;line-height:1.4;">Tu compra se ejecutará a este precio si el grupo se mantiene (o mejora) hasta el cierre.</p>
      </td>
    </tr>
  </table>
</td></tr>`

  // Closing date split for display
  const cierreParts = cierre.split(' a las ')
  const cierreDate = cierreParts[0] ?? cierre
  const cierreTime = cierreParts[1] ?? ''

  const html = [
    emailOpen(),
    emailHeader(),
    emailSectionLabel('¡OBJETIVO CONSEGUIDO!'),
    emailHero(emailSaludo(nombre, saludoBody), badge),
    emailProductCard(productCard),
    emailTwoColumns(
      {
        icon: '🏷',
        iconBg: C.primaryLight,
        label: 'El precio que elegiste',
        value: targetFmt,
      },
      {
        icon: '👥',
        iconBg: C.primaryLight,
        label: 'Precio final del grupo',
        value: priceFmt,
      },
    ),
    confirmationRow,
    emailTwoColumns(
      {
        icon: '📅',
        iconBg: C.primaryLight,
        label: 'El grupo cierra el',
        value: cierreDate,
        subtext: cierreTime ? `a las ${cierreTime}` : undefined,
        subtextColor: C.muted,
      },
      {
        icon: '👥',
        iconBg: C.primaryLight,
        label: `${totalUnits} unidades`,
        value: 'reunidas hasta ahora.',
        subtext: 'Gracias por formar parte del grupo.',
        subtextColor: C.muted,
      },
    ),
    emailShareBlock(productName, groupUrl),
    emailCTAButton(
      'Ver mi grupo',
      groupUrl,
      'Entra en tu cuenta para ver todos los detalles de tu grupo, el precio final y el estado de tu compra. No hace falta contraseña.',
    ),
    emailSpacer(4),
    emailTrustBadges([TRUST.envio, TRUST.pagoSeguro, TRUST.compraMejor]),
    emailFooter(),
    emailClose(),
  ].join('\n')

  return { subject, text, html }
}
