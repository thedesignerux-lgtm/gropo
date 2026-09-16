// Email 08 del sistema de comunicaciones del comprador — "Nuevas oportunidades
// de compra" (fin de semana). Máximo 1 por usuario y fin de semana (lo controla
// el cron que lo dispara, no esta plantilla). Solo productos con una
// oportunidad real: precio ya mejorado por el grupo respecto al PVP.
import { emailBrandHeader, emailTrackBlock } from './brand'

export interface WeekendOpportunity {
  productName: string
  currentPrice: number
  pvp: number
  closesAt: string
  groupUrl: string
}

export interface WeekendOpportunitiesData {
  nombre?: string
  opportunities: WeekendOpportunity[]
}

function fmtPrice(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

function fmtCloses(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: 'Europe/Madrid',
  }).format(d)
}

export function weekendOpportunitiesEmail(data: WeekendOpportunitiesData): {
  subject: string
  text: string
  html: string
} {
  const { nombre, opportunities } = data
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const subject = opportunities.length === 1
    ? `Ya puedes comprar ${opportunities[0].productName} al precio que ha alcanzado el grupo`
    : `${opportunities.length} oportunidades de compra este fin de semana`
  const track = emailTrackBlock(28)

  const rowsText = opportunities.map(o =>
    `• ${o.productName} — ahora a ${fmtPrice(o.currentPrice)} (antes ${fmtPrice(o.pvp)}). Cierra ${fmtCloses(o.closesAt)}.\n  ${o.groupUrl}`
  ).join('\n\n')

  const text = `${saludo}

Estos productos que sigues en Gropo ya están a un precio conseguido por el grupo:

${rowsText}
${track.text}

— Gropo`

  const rowsHtml = opportunities.map(o => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;border-radius:12px;margin-bottom:12px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 6px 0;font-size:15px;font-weight:700;color:#111111;">${o.productName}</p>
        <p style="margin:0 0 4px 0;font-size:20px;font-weight:700;color:#0B7B44;">${fmtPrice(o.currentPrice)} <span style="font-size:13px;font-weight:400;color:#999999;text-decoration:line-through;">${fmtPrice(o.pvp)}</span></p>
        <p style="margin:0 0 10px 0;font-size:13px;color:#888888;">Cierra ${fmtCloses(o.closesAt)}</p>
        <a href="${o.groupUrl}" style="display:inline-block;background:#024947;color:#FFFFFF;font-size:13px;font-weight:700;text-decoration:none;padding:9px 16px;border-radius:8px;">Ver oportunidad</a>
      </td></tr>
    </table>`).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eaeaea;">
        <tr><td style="padding:28px 28px 0 28px;">
          ${emailBrandHeader(34)}
        </td></tr>
        <tr><td style="padding:20px 28px 8px 28px;">
          <p style="margin:0 0 16px 0;font-size:15px;color:#333333;line-height:1.5;">${saludo}</p>
          <p style="margin:0 0 16px 0;font-size:15px;color:#333333;line-height:1.5;">
            Estos productos que sigues en Gropo ya están a un precio conseguido por el grupo:
          </p>
        </td></tr>
        <tr><td style="padding:0 28px;">
          ${rowsHtml}
        </td></tr>
        ${track.html}
        <tr><td style="padding:18px 28px 28px 28px;">
          <p style="margin:0;font-size:14px;color:#999999;">— Gropo</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}
