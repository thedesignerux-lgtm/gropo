// Email nuevo del sistema de comunicaciones del comprador — "Tu precio
// todavía no se ha alcanzado" (recordatorio de fin de semana). NO es ninguno
// de los 8 emails de la especificación original: es un caso adicional que
// detectó el fundador tras el primer despliegue (ver conversación) para
// cubrir al comprador en join_mode='esperar' cuyo target_price NO se ha
// alcanzado, pero cuyo grupo ya ha conseguido un precio mejor que el PVP.
//
// IMPORTANTE — decisión de alcance: este email es puramente informativo. NO
// ofrece un botón para "aceptar ahora" el precio actual, porque esa acción no
// existe todavía como funcionalidad: el comprador ya tiene una única
// participación en el grupo (una por persona y grupo) con una retención en
// tarjeta por su propio precio objetivo × cantidad, y aceptar un precio
// superior requeriría ampliar esa retención (nueva autorización de Stripe) y
// permitir editar target_price sobre una participación ya creada — ninguna de
// las dos cosas existe hoy. Construirlas es una decisión de producto y de
// dinero que no se toma en silencio (Sección 8 y 26 de la constitución).
// Por eso el CTA es "Ver mi grupo", igual que en el resto de emails
// informativos (closedNotReached, authorizationFailed).
import { emailBrandHeader, emailTrackBlock } from './brand'

export interface TargetPendingData {
  nombre?: string
  productName: string
  targetPrice: number // el precio que el usuario indicó (todavía no alcanzado)
  currentPrice: number // precio actual del grupo (> targetPrice, pero < pvp)
  pvp: number
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

export function targetPendingEmail(data: TargetPendingData): {
  subject: string
  text: string
  html: string
} {
  const { nombre, productName, targetPrice, currentPrice, pvp, closesAt, groupUrl } = data
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const elegido = fmtPrice(targetPrice)
  const actual = fmtPrice(currentPrice)
  const precioPvp = fmtPrice(pvp)
  const cierre = fmtCloses(closesAt)
  const ahorro = pvp > 0 ? Math.round((1 - currentPrice / pvp) * 100) : 0

  const subject = `Tu precio todavía no se ha alcanzado · ${productName}`
  const track = emailTrackBlock(28)

  const text = `${saludo}

El grupo de ${productName} sigue abierto. Tu precio elegido (${elegido}) todavía no se ha alcanzado, pero el grupo ya ha conseguido un precio mejor que el de venta al público:

Precio ya conseguido por el grupo: ${actual} (antes ${precioPvp})
Tu precio elegido: ${elegido}

No tienes que hacer nada: sigues dentro del grupo y, si el precio baja hasta el tuyo antes del cierre, tu compra se ejecutará automáticamente a ese precio o mejor. Si el grupo cierra sin llegar a tu precio, no se te cobrará nada y te avisaremos.

El grupo cierra el ${cierre}.

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
            Tu precio elegido para <strong style="color:#111111;">${productName}</strong> todavía no se ha alcanzado, pero el grupo ya ha conseguido un precio mejor que el de venta al público.
          </p>
        </td></tr>
        <tr><td style="padding:0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#666666;">Precio ya conseguido por el grupo</p>
              <p style="margin:0 0 4px 0;font-size:24px;font-weight:700;color:#111111;">${actual} <span style="font-size:14px;font-weight:400;color:#999999;text-decoration:line-through;">${precioPvp}</span></p>
              ${ahorro > 0 ? `<p style="margin:0 0 14px 0;font-size:13px;color:#0B7B44;font-weight:600;">${ahorro}% menos que el PVP</p>` : '<div style="margin-bottom:14px;"></div>'}
              <p style="margin:0;font-size:13px;color:#666666;">Tu precio elegido: <strong style="color:#111111;">${elegido}</strong></p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:14px 28px 0 28px;">
          <p style="margin:0;font-size:14px;color:#555555;line-height:1.5;">
            No tienes que hacer nada: sigues dentro del grupo. Si el precio baja hasta el tuyo antes del cierre, tu compra se ejecutará automáticamente. Si el grupo cierra sin llegar a tu precio, no se te cobrará nada.
          </p>
        </td></tr>
        <tr><td style="padding:10px 28px 0 28px;">
          <p style="margin:0;font-size:13px;color:#888888;">El grupo cierra el <strong style="color:#333333;">${cierre}</strong>.</p>
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
