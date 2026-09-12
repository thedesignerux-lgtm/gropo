// Plantilla del email "¡Ya sois suficientes!" — GROPO PULSE.
// Se envía a un usuario con ancla 'watching' cuando su tramo pasa a ser
// alcanzable (compradores + tarjetas aceptadas + esperas >= unidades del tramo).

export interface PulseReachableEmailData {
  nombre?: string
  productName: string
  tierPrice: number
  groupUrl: string // enlace a Mi Radar o al grupo (siempre el host canónico, ver lib/site.ts)
}

function fmtPrice(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

export function pulseReachableEmail(data: PulseReachableEmailData): {
  subject: string
  text: string
  html: string
} {
  const { nombre, productName, tierPrice, groupUrl } = data
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const precio = fmtPrice(tierPrice)

  const subject = `¡Ya sois suficientes! Bloquea tu precio de ${precio} · ${productName}`

  const text = `${saludo}

Buenas noticias: el precio de ${precio} que esperabas para ${productName} ya puede hacerse realidad — entre compradores y personas esperando como tú, ya sumáis suficientes.

Entra en tu Radar y bloquea tu precio. Solo añades tu tarjeta: no se te cobrará nada salvo que el resto también bloquee el suyo y el precio se active. Si eso ocurre, tu plaza y tu producto quedan asegurados a ${precio}.

Bloquea tu precio aquí: ${groupUrl}

Si ya no te interesa, no tienes que hacer nada.

— Gropo`

  const saludoHtml = nombre
    ? `Hola <span style="color:#6C4BF4;font-weight:600;">${nombre}</span>,`
    : 'Hola,'
  const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif`

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FBFAF8;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;font-family:${FONT};color:#1a1a1f;">
    <p style="font-size:15px;margin:0 0 18px;">${saludoHtml}</p>
    <h1 style="font-size:21px;line-height:1.3;margin:0 0 14px;">¡Ya sois suficientes para desbloquear <span style="color:#6C4BF4;">${precio}</span>!</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 14px;">
      El precio que esperabas para <b>${productName}</b> ya puede hacerse realidad:
      entre compradores y personas esperando como tú, ya sumáis suficientes.
    </p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 22px;">
      Solo añades tu tarjeta — <b>no se te cobrará nada</b> salvo que el resto también
      bloquee su precio y este se active. Si eso ocurre, tu plaza y tu producto quedan
      asegurados a <b>${precio}</b>.
    </p>
    <a href="${groupUrl}" style="display:block;text-align:center;background:#6C4BF4;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 20px;border-radius:12px;margin:0 0 22px;">Bloquear mi precio de ${precio}</a>
    <p style="font-size:13px;color:#8A8780;line-height:1.5;margin:0;">
      Si ya no te interesa, no tienes que hacer nada.
    </p>
    <p style="font-size:13px;color:#8A8780;margin:22px 0 0;">— Gropo</p>
  </div>
</body>
</html>`

  return { subject, text, html }
}
