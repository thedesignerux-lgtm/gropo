// Plantilla del email de confirmación de unión a un grupo.
// Remitente visible: Lunivo (no Kuorum).

export interface JoinEmailData {
  nombre?: string
  productName: string
  currentPrice: number
  closesAt: string // ISO timestamp
}

function fmtPrice(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

// "domingo 14 de junio a las 22:00" en horario de Madrid
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

export function joinConfirmationEmail(data: JoinEmailData): {
  subject: string
  text: string
  html: string
} {
  const { nombre, productName, currentPrice, closesAt } = data
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const precio = fmtPrice(currentPrice)
  const cierre = fmtCloses(closesAt)

  const subject = `Te has unido al grupo · ${productName}`

  const text = `${saludo}

Te has unido al grupo de compra de ${productName}.

Precio actual: ${precio}
El grupo cierra el ${cierre}.

Cuantos más seáis, mejor precio para todos. Te avisaremos cuando el grupo cierre.

— Lunivo`

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eaeaea;">
        <tr><td style="padding:28px 28px 0 28px;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#111111;">Lunivo</p>
        </td></tr>
        <tr><td style="padding:20px 28px 8px 28px;">
          <p style="margin:0 0 16px 0;font-size:15px;color:#333333;line-height:1.5;">${saludo}</p>
          <p style="margin:0 0 16px 0;font-size:15px;color:#333333;line-height:1.5;">
            Te has unido al grupo de compra de <strong style="color:#111111;">${productName}</strong>.
          </p>
        </td></tr>
        <tr><td style="padding:0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#888888;">Precio actual</p>
              <p style="margin:0 0 14px 0;font-size:24px;font-weight:700;color:#111111;">${precio}</p>
              <p style="margin:0 0 6px 0;font-size:13px;color:#888888;">El grupo cierra</p>
              <p style="margin:0;font-size:15px;font-weight:600;color:#111111;">${cierre}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 28px 28px 28px;">
          <p style="margin:0;font-size:14px;color:#555555;line-height:1.5;">
            Cuantos más seáis, mejor precio para todos. Te avisaremos cuando el grupo cierre.
          </p>
          <p style="margin:20px 0 0 0;font-size:14px;color:#999999;">— Lunivo</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}
