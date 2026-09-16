// Email 05 del sistema de comunicaciones del comprador — "No hemos podido
// realizar la retención". Se envía cuando, DESPUÉS del cierre, el cobro del
// precio final falla (tarjeta rechazada, SCA, etc.). Por decisión de producto
// (16-sep-2026) el CTA es, por ahora, solo un enlace al producto/grupo — no un
// reintento de cobro automático (esa pieza queda pendiente de construir).
import { emailBrandHeader, emailTrackBlock } from './brand'

export interface AuthorizationFailedData {
  nombre?: string
  productName: string
  finalPrice: number
  groupUrl: string
}

function fmtPrice(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

export function authorizationFailedEmail(data: AuthorizationFailedData): {
  subject: string
  text: string
  html: string
} {
  const { nombre, productName, finalPrice, groupUrl } = data
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const precio = fmtPrice(finalPrice)

  const subject = `No hemos podido completar tu compra · ${productName}`
  const track = emailTrackBlock(28)

  const text = `${saludo}

Hemos intentado realizar una retención momentánea de ${precio} correspondiente al precio alcanzado por el grupo de ${productName}, pero no ha sido posible.

Por el momento, has quedado fuera del grupo. No se te ha realizado ningún cargo.

Puedes volver a intentarlo desde el producto: ${groupUrl}
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
            No hemos podido completar tu compra de <strong style="color:#111111;">${productName}</strong>.
          </p>
        </td></tr>
        <tr><td style="padding:0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff3f0;border:1px solid #ffd4c7;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#b4451a;">Retención no realizada</p>
              <p style="margin:0;font-size:14px;color:#333333;line-height:1.5;">
                Hemos intentado realizar una retención momentánea de <strong>${precio}</strong>, correspondiente al precio alcanzado por el grupo, pero no ha sido posible. Por el momento, has quedado fuera del grupo. No se te ha realizado ningún cargo.
              </p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 28px 0 28px;">
          <a href="${groupUrl}" style="display:inline-block;background:#024947;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;">Volver a intentarlo</a>
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
