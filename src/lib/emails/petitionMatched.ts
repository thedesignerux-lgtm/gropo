// Plantilla del email "tu petición ya tiene grupo".
// Se envía al peticionario cuando el admin asigna el primer vendedor
// (primera puja) a la petición. Remitente visible: Gropo.

export interface PetitionMatchedData {
  nombre?: string
  productName: string
  groupUrl: string
}

export function petitionMatchedEmail(data: PetitionMatchedData): {
  subject: string
  text: string
  html: string
} {
  const { nombre, productName, groupUrl } = data
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'

  const subject = 'Tu producto ya tiene grupo en Gropo'

  const text = `${saludo}

¡Buenas noticias! Ya hay un grupo de compra para ${productName}.

Entra a unirte: ${groupUrl}

Cuantos más seáis, mejor precio para todos.

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
            ¡Buenas noticias! Ya hay un grupo de compra para <strong style="color:#111111;">${productName}</strong>.
          </p>
        </td></tr>
        <tr><td style="padding:8px 28px 4px 28px;">
          <a href="${groupUrl}" style="display:inline-block;background:#1D9E75;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 22px;border-radius:12px;">
            Entrar a unirme
          </a>
        </td></tr>
        <tr><td style="padding:20px 28px 28px 28px;">
          <p style="margin:0;font-size:14px;color:#555555;line-height:1.5;">
            Cuantos más seáis, mejor precio para todos.
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
