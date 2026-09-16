// Email 06 del sistema de comunicaciones del comprador — "Pedido enviado".
// Disparo: la etiqueta de Sendcloud se crea con éxito y ya existe código de
// seguimiento (ver generateShippingLabels en shipping-sendcloud.ts). No cubre
// actualizaciones posteriores del envío (email 07 de la spec): eso queda
// pendiente de conectar el webhook de tracking real de Sendcloud.
import { emailBrandHeader, emailTrackBlock } from './brand'

export interface ShipmentConfirmedData {
  nombre?: string
  productName: string
  trackingCode?: string | null
  carrier?: string | null
  trackingUrl?: string | null
}

export function shipmentConfirmedEmail(data: ShipmentConfirmedData): {
  subject: string
  text: string
  html: string
} {
  const { nombre, productName, trackingCode, carrier, trackingUrl } = data
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'

  const subject = `Tu pedido está en camino · ${productName}`
  const track = emailTrackBlock(28)

  const seguimiento = trackingCode
    ? `Código de seguimiento: ${trackingCode}${carrier ? ` (${carrier})` : ''}`
    : 'Te avisaremos con más detalles en cuanto estén disponibles.'

  const text = `${saludo}

Tu pedido de ${productName} ya está en camino.

${seguimiento}
${trackingUrl ? `Seguimiento: ${trackingUrl}` : ''}
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
            Tu pedido de <strong style="color:#111111;">${productName}</strong> ya está en camino.
          </p>
        </td></tr>
        <tr><td style="padding:0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0faf3;border:1px solid #c2ecd0;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0;font-size:14px;color:#333333;line-height:1.5;">${seguimiento}</p>
            </td></tr>
          </table>
        </td></tr>
        ${trackingUrl ? `<tr><td style="padding:20px 28px 0 28px;">
          <a href="${trackingUrl}" style="display:inline-block;background:#024947;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;">Seguir mi pedido</a>
        </td></tr>` : ''}
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
