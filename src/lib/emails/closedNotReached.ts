// Email 04 del sistema de comunicaciones del comprador — "Grupo cerrado ·
// precio no alcanzado". Se envía a quien `close_group` cancela por no haber
// alcanzado el precio/condición que había indicado. No inventa el motivo del
// cierre: solo confirma que su compra no se ejecuta y que se le devuelve el
// importe retenido.
import { emailBrandHeader, emailTrackBlock } from './brand'

export interface ClosedNotReachedData {
  nombre?: string
  productName: string
  chosenPrice: number | null // precio/techo que el usuario había indicado (null si join_mode='comprar')
  finalPrice: number | null // precio final alcanzado por el grupo, si lo hubo
}

function fmtPrice(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

export function closedNotReachedEmail(data: ClosedNotReachedData): {
  subject: string
  text: string
  html: string
} {
  const { nombre, productName, chosenPrice, finalPrice } = data
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'

  const subject = `Grupo cerrado · precio no alcanzado · ${productName}`
  const track = emailTrackBlock(28)

  const detalle = chosenPrice != null
    ? `El precio que habías indicado era ${fmtPrice(chosenPrice)}${finalPrice != null ? ` y el grupo cerró en ${fmtPrice(finalPrice)}` : ''}.`
    : `El grupo no reunió las unidades necesarias para completarse.`

  const text = `${saludo}

El grupo de ${productName} se ha cerrado y no hemos alcanzado el precio que elegiste. Tu compra no se va a ejecutar.

${detalle}

No te preocupes: no se te ha realizado ningún cargo. Si habíamos hecho una retención en tu tarjeta, ya ha quedado anulada — según tu banco, puede tardar unos días en desaparecer de tu extracto.

Puedes ver otros grupos abiertos en Gropo cuando quieras.
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
            El grupo de <strong style="color:#111111;">${productName}</strong> se ha cerrado. No hemos alcanzado el precio que elegiste, así que tu compra <strong>no se va a ejecutar</strong>.
          </p>
        </td></tr>
        <tr><td style="padding:0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0;font-size:14px;color:#333333;line-height:1.5;">${detalle}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:14px 28px 0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0faf3;border:1px solid #c2ecd0;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#3d8b57;">Devolución</p>
              <p style="margin:0;font-size:14px;color:#333333;line-height:1.5;">
                No se te ha realizado ningún cargo. Si habíamos hecho una retención en tu tarjeta, ya ha quedado anulada — según tu banco, puede tardar unos días en desaparecer de tu extracto.
              </p>
            </td></tr>
          </table>
        </td></tr>
        ${track.html}
        <tr><td style="padding:18px 28px 28px 28px;">
          <p style="margin:0;font-size:14px;color:#555555;line-height:1.5;">
            Puedes ver otros grupos abiertos en Gropo cuando quieras.
          </p>
          <p style="margin:20px 0 0 0;font-size:14px;color:#999999;">— Gropo</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}
