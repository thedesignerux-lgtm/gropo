// Plantilla del email de confirmación de compra al cierre.
// Se envía SOLO a miembros cuyo pago fue capturado con éxito (payment_status='paid').
// Remitente visible: Gropo.

export interface PurchaseEmailData {
  nombre?: string
  productName: string
  quantity: number
  finalPrice: number
  total: number // importe realmente capturado
}

function fmtPrice(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

export function purchaseConfirmationEmail(data: PurchaseEmailData): {
  subject: string
  text: string
  html: string
} {
  const { nombre, productName, quantity, finalPrice, total } = data
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const precioUd = fmtPrice(finalPrice)
  const totalFmt = fmtPrice(total)

  const subject = `Compra confirmada · ${productName}`

  const text = `${saludo}

El grupo de ${productName} se ha cerrado con éxito y tu compra está confirmada.

Tu pedido: ${quantity} ud${quantity === 1 ? '' : 's'} × ${precioUd}
Total cobrado: ${totalFmt}

Hemos realizado el cobro en tu tarjeta. Si tu banco muestra una retención por un importe mayor, la diferencia se libera automáticamente en unos días.

Prepararemos tu envío y te avisaremos con los datos de seguimiento.

Gracias por comprar en grupo.
— Gropo`

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eaeaea;">
        <tr><td style="padding:28px 28px 0 28px;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#111111;">Gropo</p>
        </td></tr>
        <tr><td style="padding:20px 28px 8px 28px;">
          <p style="margin:0 0 16px 0;font-size:15px;color:#333333;line-height:1.5;">${saludo}</p>
          <p style="margin:0 0 16px 0;font-size:15px;color:#333333;line-height:1.5;">
            El grupo de <strong style="color:#111111;">${productName}</strong> se ha cerrado con éxito y tu compra está confirmada.
          </p>
        </td></tr>
        <tr><td style="padding:0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#888888;">Tu pedido</p>
              <p style="margin:0 0 14px 0;font-size:15px;font-weight:600;color:#111111;">${quantity} ud${quantity === 1 ? '' : 's'} × ${precioUd}</p>
              <p style="margin:0 0 6px 0;font-size:13px;color:#888888;">Total cobrado</p>
              <p style="margin:0;font-size:24px;font-weight:700;color:#111111;">${totalFmt}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:14px 28px 0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0faf3;border:1px solid #c2ecd0;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#3d8b57;">Pago realizado</p>
              <p style="margin:0;font-size:14px;color:#333333;line-height:1.5;">
                Hemos realizado el cobro en tu tarjeta. Si tu banco muestra una retención por un importe mayor, la diferencia se libera automáticamente en unos días.
              </p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 28px 28px 28px;">
          <p style="margin:0;font-size:14px;color:#555555;line-height:1.5;">
            Prepararemos tu envío y te avisaremos con los datos de seguimiento.
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
