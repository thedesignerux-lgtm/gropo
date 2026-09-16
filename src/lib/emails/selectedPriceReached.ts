// Email 02 del sistema de comunicaciones del comprador — "El precio que
// elegiste ya se ha alcanzado". Solo aplica a join_mode='esperar': el grupo
// alcanzó (o mejoró) el precio máximo que el comprador había indicado.
// No reconstruye ni recalcula nada: recibe el precio ya decidido por
// confirm_join/compute_price.
import { emailBrandHeader, emailTrackBlock } from './brand'

export interface SelectedPriceReachedData {
  nombre?: string
  productName: string
  targetPrice: number // el precio que el usuario indicó
  currentPrice: number // precio actual del grupo (<= targetPrice)
  totalUnits: number
  closesAt: string // ISO
  groupUrl: string
}

function fmtPrice(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

function fmtCloses(iso: string): string {
  const d = new Date(iso)
  const fecha = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid',
  }).format(d)
  const hora = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid',
  }).format(d)
  return `${fecha} a las ${hora}`
}

export function selectedPriceReachedEmail(data: SelectedPriceReachedData): {
  subject: string
  text: string
  html: string
} {
  const { nombre, productName, targetPrice, currentPrice, totalUnits, closesAt, groupUrl } = data
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const precio = fmtPrice(currentPrice)
  const elegido = fmtPrice(targetPrice)
  const cierre = fmtCloses(closesAt)

  const subject = `El precio que elegiste ya se ha alcanzado · ${productName}`
  const track = emailTrackBlock(28)

  const text = `${saludo}

Buenas noticias: el grupo de ${productName} ha alcanzado el precio que indicaste.

Precio que elegiste: ${elegido}
Precio actual del grupo: ${precio}
Unidades reunidas: ${totalUnits}

Si el grupo se mantiene así (o mejora) hasta el cierre, tu compra se ejecutará a ${precio}. El grupo cierra el ${cierre}.

Ver mi grupo: ${groupUrl}
${track.text}

— Gropo`

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
            Buenas noticias: el grupo de <strong style="color:#111111;">${productName}</strong> ha alcanzado el precio que elegiste.
          </p>
        </td></tr>
        <tr><td style="padding:0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0faf3;border:1px solid #c2ecd0;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#3d8b57;">Precio que elegiste</p>
              <p style="margin:0 0 14px 0;font-size:20px;font-weight:700;color:#111111;">${elegido}</p>
              <p style="margin:0 0 6px 0;font-size:13px;color:#3d8b57;">Precio actual del grupo</p>
              <p style="margin:0 0 14px 0;font-size:24px;font-weight:700;color:#111111;">${precio}</p>
              <p style="margin:0;font-size:14px;color:#333333;">${totalUnits} unidad${totalUnits === 1 ? '' : 'es'} reunidas hasta ahora.</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:14px 28px 0 28px;">
          <p style="margin:0;font-size:14px;color:#555555;line-height:1.5;">
            Si el grupo se mantiene así (o mejora) hasta el cierre, tu compra se ejecutará a este precio. El grupo cierra el <strong style="color:#111111;">${cierre}</strong>.
          </p>
        </td></tr>
        <tr><td style="padding:20px 28px 0 28px;">
          <a href="${groupUrl}" style="display:inline-block;background:#024947;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;">Ver mi grupo</a>
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
