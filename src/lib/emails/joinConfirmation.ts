// Plantilla del email de confirmación de unión a un grupo.
// Remitente visible: Gropo.

export interface JoinEmailData {
  nombre?: string
  productName: string
  currentPrice: number
  closesAt: string // ISO timestamp
}

function fmtPrice(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

// "domingo, 21 de junio a las 22:00" en horario de Madrid
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

— Gropo`

  // Saludo HTML: nombre en verde de marca; sin nombre, solo "Hola,".
  const saludoHtml = nombre
    ? `Hola <span style="color:#0F9D58;font-weight:600;">${nombre}</span>,`
    : 'Hola,'

  // Fuente común para reutilizar en estilos inline.
  const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif`

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background:#F0EDFF;font-family:${FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F0EDFF;">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <!-- Contenedor blanco 600px -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;">

          <!-- ============ HEADER ============ -->
          <tr>
            <td style="padding:28px 32px 12px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width:36px;height:36px;background:#6C3CE1;border-radius:18px;text-align:center;vertical-align:middle;color:#FFFFFF;font-family:${FONT};font-size:20px;font-weight:700;line-height:36px;">V</td>
                        <td style="padding-left:10px;font-family:${FONT};font-size:22px;font-weight:700;color:#1A1A1A;vertical-align:middle;">Gropo</td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <!-- ILUSTRACIÓN AQUÍ -->
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ============ SALUDO ============ -->
          <tr>
            <td style="padding:12px 32px 0 32px;">
              <p style="margin:0 0 12px 0;font-family:${FONT};font-size:16px;color:#1A1A1A;line-height:1.4;">${saludoHtml}</p>
              <p style="margin:0 0 20px 0;font-family:${FONT};font-size:15px;color:#1A1A1A;line-height:1.5;">Te has unido al grupo de compra de <strong style="color:#1A1A1A;">${productName}</strong>.</p>
            </td>
          </tr>

          <!-- ============ TARJETA DE DATOS ============ -->
          <tr>
            <td style="padding:0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F0FF;border-radius:12px;">
                <tr>
                  <td style="padding:24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <!-- Columna izquierda: precio -->
                        <td width="50%" style="vertical-align:top;padding-right:20px;font-family:${FONT};">
                          <p style="margin:0 0 8px 0;font-size:20px;line-height:1;">🏷️</p>
                          <p style="margin:0 0 4px 0;font-size:13px;color:#888888;">Precio actual</p>
                          <p style="margin:0 0 12px 0;font-size:28px;font-weight:700;color:#1A1A1A;line-height:1.1;">${precio}</p>
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="background:#E8F5E9;border-radius:20px;padding:6px 12px;font-family:${FONT};font-size:12px;font-weight:600;color:#2E7D32;line-height:1.3;">📈 Cuantos más seáis, mejor precio</td>
                            </tr>
                          </table>
                        </td>
                        <!-- Separador vertical fino -->
                        <td width="1" style="width:1px;background:#E0E0E0;font-size:0;line-height:0;">&nbsp;</td>
                        <!-- Columna derecha: cierre -->
                        <td width="50%" style="vertical-align:top;padding-left:20px;font-family:${FONT};">
                          <p style="margin:0 0 8px 0;font-size:20px;line-height:1;">📅</p>
                          <p style="margin:0 0 4px 0;font-size:13px;color:#888888;">El grupo cierra</p>
                          <p style="margin:0;font-size:15px;font-weight:700;color:#1A1A1A;line-height:1.4;">${cierre}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ============ TARJETA DE COMUNIDAD ============ -->
          <tr>
            <td style="padding:16px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F0FF;border-radius:12px;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="32" style="vertical-align:top;font-size:22px;line-height:1;">👥</td>
                        <td style="vertical-align:top;padding-left:10px;font-family:${FONT};">
                          <p style="margin:0 0 4px 0;font-size:15px;font-weight:700;color:#1A1A1A;line-height:1.4;">Cuantos más seáis, mejor precio para todos.</p>
                          <p style="margin:0;font-size:14px;color:#888888;line-height:1.4;">Te avisaremos cuando el grupo cierre.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ============ CIERRE ============ -->
          <tr>
            <td style="padding:24px 32px 32px 32px;">
              <p style="margin:0 0 4px 0;font-family:${FONT};font-size:15px;color:#1A1A1A;line-height:1.4;">¡Gracias por unirte!</p>
              <p style="margin:0;font-family:${FONT};font-size:15px;font-weight:700;color:#6C3CE1;">— Gropo</p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}
