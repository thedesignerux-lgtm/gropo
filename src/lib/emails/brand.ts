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
