// Plantilla del email "nuevas oportunidades para ti" — resumen semanal.
// Diseño v2 (sep-2026): header, saludo sin badge, múltiples tarjetas de producto
// con imagen, marca, precio actual + PVP tachado, fecha cierre, atributos,
// badge "Precio de grupo" y CTA "Ver oportunidad →" cada una,
// phone block, trust badges, footer.
// Se envía periódicamente (ej: sábados) con oportunidades relevantes.
// Remitente visible: Gropo.

import { SITE_URL } from '../site'
import {
  emailOpen, emailClose, emailHeader, emailSectionLabel, emailHero, emailSaludo,
  emailPhoneBlock, emailTrustBadges, emailFooter, emailSpacer, emailCTAInline,
  fmtPrice, fmtCloses, FONT, C, TRUST,
} from './brand'

export interface WeekendOpportunity {
  productName: string
  currentPrice: number
  pvp: number
  closesAt: string  // ISO timestamp
  groupUrl: string
  imageUrl?: string
  brandName?: string
  attributes?: string[]
}

export interface WeekendOpportunitiesData {
  nombre?: string
  opportunities: WeekendOpportunity[]
}

function renderOpportunityCard(opp: WeekendOpportunity): string {
  const { productName, currentPrice, pvp, closesAt, groupUrl, imageUrl, brandName, attributes } = opp
  const priceFmt = fmtPrice(currentPrice)
  const pvpFmt = fmtPrice(pvp)
  const cierre = fmtCloses(closesAt)

  const imgCell = imageUrl
    ? `<td class="product-img" width="160" style="vertical-align:top;padding:0;">
        <div style="background:${C.cardBg};border-radius:8px 0 0 0;overflow:hidden;text-align:center;max-width:160px;">
          <img src="${imageUrl}" width="160" alt="${productName}" style="display:block;width:100%;max-width:160px;height:auto;border:0;outline:none;">
        </div>
      </td>`
    : ''

  const brandHtml = brandName
    ? `<p style="margin:0 0 2px 0;font-family:${FONT};font-size:11px;font-weight:700;color:${C.muted};letter-spacing:0.5px;text-transform:uppercase;">${brandName}</p>`
    : ''

  const attrsHtml = attributes && attributes.length > 0
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
        <tr>${attributes.map((attr, i) => `
          <td style="vertical-align:top;padding-right:${i < attributes.length - 1 ? '10' : '0'}px;${i > 0 ? 'border-left:1px solid #E0E0E0;padding-left:10px;' : ''}">
            <p style="margin:0;font-family:${FONT};font-size:10px;color:${C.secondary};line-height:1.3;">${attr}</p>
          </td>`).join('')}
        </tr>
      </table>`
    : ''

  return `<tr><td class="email-pad" style="padding:14px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.border};border-radius:12px;overflow:hidden;">
    <tr>
      ${imgCell}
      <td class="product-info" style="vertical-align:top;padding:14px 16px;${imageUrl ? 'padding-left:14px;' : ''}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:top;">
              ${brandHtml}
              <p style="margin:0 0 6px 0;font-family:${FONT};font-size:15px;font-weight:700;color:${C.dark};line-height:1.3;">${productName}</p>
            </td>
            <td width="100" align="right" style="vertical-align:top;padding-left:8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="padding:3px 8px;background:${C.primaryLight};border-radius:6px;">
                  <p style="margin:0;font-family:${FONT};font-size:10px;font-weight:700;color:${C.primary};line-height:1.2;">🏷 Precio de grupo</p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 2px 0;">
          <span style="font-family:${FONT};font-size:22px;font-weight:800;color:${C.successGreen};line-height:1.2;">${priceFmt}</span>
          <span style="font-family:${FONT};font-size:14px;color:${C.light};text-decoration:line-through;margin-left:6px;">${pvpFmt}</span>
        </p>
        <p style="margin:0 0 8px 0;font-family:${FONT};font-size:12px;color:${C.muted};line-height:1.4;">📅 Cierra el ${cierre}</p>
        ${attrsHtml}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
          <tr>
            <td style="vertical-align:middle;">
              ${attrsHtml ? '' : ''}
            </td>
            <td align="right" style="vertical-align:middle;">
              ${emailCTAInline('Ver oportunidad', groupUrl)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</td></tr>`
}

export function weekendOpportunitiesEmail(data: WeekendOpportunitiesData): {
  subject: string
  text: string
  html: string
} {
  const { nombre, opportunities } = data

  const subject = opportunities.length === 1
    ? `Nueva oportunidad: ${opportunities[0].productName}`
    : `${opportunities.length} oportunidades esperándote en Gropo`

  // ── TEXT VERSION ──

  const oppTexts = opportunities.map(o => {
    const cierre = fmtCloses(o.closesAt)
    return `• ${o.productName}: ${fmtPrice(o.currentPrice)} (PVP: ${fmtPrice(o.pvp)})\n  Cierra el ${cierre}\n  Ver: ${o.groupUrl}`
  }).join('\n\n')

  const text = `${nombre ? `Hola ${nombre},` : 'Hola,'}

Estos productos que sigues en Gropo ya están a un precio conseguido por el grupo:

${oppTexts}

Es un buen momento para sumar tu compra.

Ver todos tus productos: ${SITE_URL}/mis-grupos

— Gropo`

  // ── HTML VERSION ──

  const saludoBody = `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:15px;color:${C.body};line-height:1.5;">
    Estos productos que sigues en Gropo ya están a un precio conseguido por el grupo:
  </p>
  <p style="margin:4px 0 0 0;font-family:${FONT};font-size:14px;color:${C.muted};font-style:italic;line-height:1.4;">Es un buen momento para sumar tu compra.</p>`

  const oppCards = opportunities.map(o => renderOpportunityCard(o)).join('\n')

  const html = [
    emailOpen(),
    emailHeader(),
    emailSectionLabel('NUEVAS OPORTUNIDADES PARA TI'),
    emailHero(emailSaludo(nombre, saludoBody)),
    oppCards,
    emailPhoneBlock(
      '¿Quieres ver todos tus productos seguidos?',
      'Entra en tu cuenta y consulta el estado de tus grupos, los precios y tus compras. No hace falta contraseña.',
      'Ver mi pedido',
      `${SITE_URL}/mis-grupos`,
    ),
    emailSpacer(4),
    emailTrustBadges([TRUST.mejoresPrecios, TRUST.pagoSeguro, TRUST.envio]),
    emailFooter(),
    emailClose(),
  ].join('\n')

  return { subject, text, html }
}
