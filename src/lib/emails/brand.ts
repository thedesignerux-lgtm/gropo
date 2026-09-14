import { SITE_URL } from '../site'

// Logo para las plantillas de email.
//
// PNG y no SVG a propósito: la mayoría de clientes de correo no renderizan SVG.
// (En `public/logo-gropo.svg` hay una versión SVG Tiny-PS cuadrada; esa es la
// que serviría para BIMI el día que haya marca registrada y certificado, no
// para el cuerpo del email.)
//
// La URL es absoluta y con `www`: en un email no existe el concepto de ruta
// relativa, y el ápice responde 308.
export const EMAIL_LOGO_URL = `${SITE_URL}/logo.png`

/**
 * Cabecera de marca reutilizable por las cinco plantillas.
 *
 * El `alt` va estilado a propósito. Gmail y Outlook bloquean las imágenes por
 * defecto cuando el remitente aún no es de confianza, que es justo el primer
 * email que recibe alguien de Gropo: en ese caso se ve "Gropo" con el morado y
 * la tipografía de marca en lugar de un icono roto.
 *
 * El fichero nativo es 498×200, así que a estos tamaños sobra resolución para
 * pantallas retina. `width`/`height` como atributos además del estilo porque
 * Outlook ignora parte del CSS.
 */
export function emailBrandHeader(height = 40): string {
  const width = Math.round((height * 498) / 200)
  const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif`
  return `<img src="${EMAIL_LOGO_URL}" width="${width}" height="${height}" alt="Gropo" style="display:block;width:${width}px;height:${height}px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;font-family:${FONT};font-size:20px;font-weight:700;color:#024947;">`
}

/**
 * A-15 · Bloque «cómo consultar tu pedido», para las plantillas transaccionales.
 *
 * POR QUÉ EXISTE: hasta el 14-sep-2026, `joinConfirmation`, `purchaseConfirmation` y
 * `paymentInstructions` no tenían **ni un solo enlace**: `SITE_URL` se usaba solo
 * para pintar el logo. Y el comprador invitado —26 de 28 en producción no tienen
 * cuenta— no tenía más rastro de su pedido que el `localStorage` del navegador donde
 * compró. Cambia de móvil o borra datos y su pedido desaparece de su vista, con el
 * dinero retenido en la tarjeta.
 *
 * Lo más frustrante era que la vía de recuperación YA EXISTÍA y funciona:
 * `/api/my-groups` busca por email, así que entrando con el mismo correo de la compra
 * se ven los pedidos. Nadie se lo decía nunca. Esto solo lo cuenta.
 *
 * No hace falta pasar el email: este bloque viaja DENTRO del correo que se le envía,
 * así que «el mismo email al que te hemos enviado este mensaje» siempre es exacto.
 */
export function emailTrackBlock(padX = 32): { html: string; text: string } {
  const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif`
  const url = `${SITE_URL}/mis-grupos`

  const text = `¿Quieres ver cómo va tu pedido?
Entra en ${url} con el mismo email al que te hemos enviado este mensaje y verás tu grupo, el precio y el estado de tu pago. No hace falta contraseña.`

  const html = `<tr>
            <td style="padding:0 ${padX}px 24px ${padX}px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F0F7F7;border-radius:12px;">
                <tr>
                  <td style="padding:18px 20px;font-family:${FONT};">
                    <p style="margin:0 0 6px 0;font-size:15px;font-weight:700;color:#1A1A1A;line-height:1.4;">¿Quieres ver cómo va tu pedido?</p>
                    <p style="margin:0 0 14px 0;font-size:14px;color:#555555;line-height:1.5;">Entra con el mismo email al que te hemos enviado este mensaje y verás tu grupo, el precio y el estado de tu pago. No hace falta contraseña.</p>
                    <a href="${url}" style="display:inline-block;background:#024947;color:#FFFFFF;font-family:${FONT};font-size:14px;font-weight:700;text-decoration:none;padding:11px 20px;border-radius:10px;">Ver mi pedido</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`

  return { html, text }
}
