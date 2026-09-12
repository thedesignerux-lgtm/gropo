// Plantilla del email de instrucciones de pago al cierre.
// Se envía SOLO a miembros adjudicados (payment_status='instructed').
// Remitente visible: Gropo.

import { emailBrandHeader } from './brand'

export interface PaymentEmailData {
  nombre?: string
  productName: string
  quantity: number
  finalPrice: number
  total: number
  paymentInfo?: string | null // Bizum/IBAN de la puja ganadora; puede venir vacío
  concepto: string
  deadline: string // ISO timestamp (ahora + 48h)
}

function fmtPrice(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

// "lunes 16 de junio a las 22:00" en horario de Madrid
function fmtDeadline(iso: string): string {
  const d = new Date(iso)
  const fecha = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid',
  }).format(d)
  const hora = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid',
  }).format(d)
  return `${fecha} a las ${hora}`
}

export function paymentInstructionsEmail(data: PaymentEmailData): {
  subject: string
  text: string
  html: string
} {
  const { nombre, productName, quantity, finalPrice, total, paymentInfo, concepto, deadline } = data
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const precioUd = fmtPrice(finalPrice)
  const totalFmt = fmtPrice(total)
  const plazo = fmtDeadline(deadline)
  const hasPago = !!(paymentInfo && paymentInfo.trim())

  const subject = `Instrucciones de pago · ${productName}`

  // Bloque de pago (texto)
  const pagoText = hasPago
    ? `Realiza el pago directamente al vendedor:
${paymentInfo!.trim()}

Concepto del pago (imprescindible): ${concepto}`
    : `Te enviaremos los datos de pago del vendedor por separado.
Cuando los recibas, usa este concepto: ${concepto}`

  const text = `${saludo}

El grupo de ${productName} se ha cerrado y tu pedido está confirmado.

Tu pedido: ${quantity} ud${quantity === 1 ? '' : 's'} × ${precioUd}
Total a pagar: ${totalFmt}

${pagoText}

Plazo: antes del ${plazo} (48 horas).

Gracias por participar.
— Gropo`

  // Bloque de pago (HTML)
  const pagoHtml = hasPago
    ? `<p style="margin:0 0 6px 0;font-size:13px;color:#888888;">Paga directamente al vendedor</p>
       <p style="margin:0 0 14px 0;font-size:16px;font-weight:600;color:#111111;white-space:pre-wrap;">${paymentInfo!.trim()}</p>
       <p style="margin:0 0 6px 0;font-size:13px;color:#888888;">Concepto (imprescindible)</p>
       <p style="margin:0;font-size:16px;font-weight:700;color:#111111;font-family:monospace;">${concepto}</p>`
    : `<p style="margin:0 0 6px 0;font-size:13px;color:#888888;">Datos de pago</p>
       <p style="margin:0 0 14px 0;font-size:15px;color:#111111;">Te enviaremos los datos de pago del vendedor por separado.</p>
       <p style="margin:0 0 6px 0;font-size:13px;color:#888888;">Concepto que deberás usar</p>
       <p style="margin:0;font-size:16px;font-weight:700;color:#111111;font-family:monospace;">${concepto}</p>`

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
            El grupo de <strong style="color:#111111;">${productName}</strong> se ha cerrado y tu pedido está confirmado.
          </p>
        </td></tr>
        <tr><td style="padding:0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#888888;">Tu pedido</p>
              <p style="margin:0 0 14px 0;font-size:15px;font-weight:600;color:#111111;">${quantity} ud${quantity === 1 ? '' : 's'} × ${precioUd}</p>
              <p style="margin:0 0 6px 0;font-size:13px;color:#888888;">Total a pagar</p>
              <p style="margin:0;font-size:24px;font-weight:700;color:#111111;">${totalFmt}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:14px 28px 0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0;border:1px solid #ffe2c2;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              ${pagoHtml}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 28px 28px 28px;">
          <p style="margin:0;font-size:14px;color:#555555;line-height:1.5;">
            Plazo: <strong style="color:#111111;">antes del ${plazo}</strong> (48 horas).
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
