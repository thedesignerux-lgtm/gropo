// Plantilla del email "grupo cerrado sin alcanzar tu precio".
// Diseño v2 (sep-2026): badge "Grupo cerrado" (X rojo), tarjeta de producto,
// dos columnas precio elegido vs precio final, texto explicativo,
// "Devolución garantizada" bloque verde, phone block + "Ver mi pedido",
// fila secundaria "Descubre otros grupos", footer (SIN trust badges).
// Se envía a miembros cuyo target_price NO fue alcanzado al cierre.
// Remitente visible: Gropo.

import { SITE_URL } from '../site'
import {
  emailOpen, emailClose, emailHeader, emailSectionLabel, emailHero, emailSaludo,
  emailProductCard, emailTwoColumns, emailAlertBlock,
  emailPhoneBlock, emailSecondaryRow,
  emailFooter, emailSpacer,
  fmtPrice, FONT, C,
  type StatusBadgeConfig, type ProductCardData,
} from './brand'

export interface ClosedNotReachedData {
  nombre?: string
  productName: string
  chosenPrice: number | null
  finalPrice: number | null
  imageUrl?: string
  brandName?: string
  attributes?: string[]
  groupUrl?: string
}

export function closedNotReachedEmail(data: ClosedNotReachedData): {
  subject: string
  text: string
  html: string
} {
  const {
    nombre, productName, chosenPrice, finalPrice,
    imageUrl, brandName, attributes, groupUrl,
  } = data
  const url = groupUrl ?? `${SITE_URL}/mis-grupos`

  const subject = `Grupo cerrado · ${productName}`

  // ── TEXT VERSION ──

  const text = `${nombre ? `Hola ${nombre},` : 'Hola,'}

El grupo de ${productName} se ha cerrado. No hemos alcanzado el precio que elegiste, así que tu compra no se va a ejecutar.
${chosenPrice != null ? `Tu precio elegido: ${fmtPrice(chosenPrice)}` : ''}
${finalPrice != null ? `Precio final del grupo: ${fmtPrice(finalPrice)}` : ''}

Devolución garantizada: No se te ha realizado ningún cargo. Si se había realizado una retención en tu tarjeta, ya ha quedado anulada — según tu banco, puede tardar unos días en desaparecer de tu extracto.

Ver mi pedido: ${url}

Descubre otros grupos en ${SITE_URL}/grupos

— Gropo`

  // ── HTML VERSION ──

  const badge: StatusBadgeConfig = {
    icon: '✕',
    iconBg: C.errorOrange,
    iconColor: C.white,
    title: 'Grupo cerrado',
    subtitle: 'No se ha alcanzado tu precio objetivo.',
  }

  const productCard: ProductCardData = { imageUrl, brandName, productName, attributes }

  const saludoBody = `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:15px;color:${C.body};line-height:1.5;">
    El grupo de <strong style="color:${C.dark};">${productName}</strong> se ha cerrado. No hemos alcanzado el precio que elegiste, así que <strong style="color:${C.dark};">tu compra no se va a ejecutar.</strong>
  </p>`

  // Two-column price comparison
  const priceColumns = (chosenPrice != null && finalPrice != null)
    ? emailTwoColumns(
        {
          icon: '🏷',
          iconBg: C.primaryLight,
          label: 'Tu precio elegido',
          value: fmtPrice(chosenPrice),
        },
        {
          icon: '👥',
          iconBg: C.primaryLight,
          label: 'Precio final del grupo',
          value: fmtPrice(finalPrice),
        },
      )
    : ''

  // Explanatory text below price columns
  const explanationRow = (chosenPrice != null && finalPrice != null)
    ? `<tr><td class="email-pad" style="padding:6px 28px 0 28px;">
        <p style="margin:0;font-family:${FONT};font-size:13px;color:${C.secondary};line-height:1.5;text-align:center;">El grupo se cerró sin alcanzar tu precio, por lo que tu compra no se ha ejecutado.</p>
      </td></tr>`
    : ''

  const html = [
    emailOpen(),
    emailHeader(),
    emailSectionLabel('GRUPO CERRADO'),
    emailHero(emailSaludo(nombre, saludoBody), badge),
    emailProductCard(productCard),
    priceColumns,
    explanationRow,
    emailAlertBlock(
      'success',
      'Devolución garantizada',
      'No se te ha realizado ningún cargo. Si se había realizado una retención en tu tarjeta, ya ha quedado anulada — según tu banco, puede tardar unos días en desaparecer de tu extracto.',
    ),
    emailPhoneBlock(
      '¿Quieres ver más detalles?',
      'Entra en tu cuenta para ver el grupo, el precio final y el estado de tu solicitud.',
      'Ver mi pedido',
      url,
    ),
    emailSecondaryRow(
      '🔍',
      'Descubre otros grupos',
      'Hay nuevas oportunidades esperándote.',
      'Explorar productos',
      `${SITE_URL}/grupos`,
    ),
    emailSpacer(4),
    emailFooter(),
    emailClose(),
  ].join('\n')

  return { subject, text, html }
}
