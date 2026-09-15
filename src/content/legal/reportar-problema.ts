import type { LegalDoc } from '@/lib/legal'

/**
 * Canal de notificación del DSA. No es un texto jurídico: es la puerta por la que
 * cualquiera —comprador, titular de una marca, alguien que pasaba por ahí— puede
 * avisarnos de un producto ilícito. Si esta página es densa, no la usa nadie, y un
 * canal que no usa nadie no cumple su función por mucho que exista.
 */
const doc: LegalDoc = {
  slug: 'reportar-problema',
  title: 'Reportar un problema',
  summary: 'Cómo avisarnos de un producto ilegal, una falsificación, información incorrecta o un problema con un vendedor.',
  intro: [
    { type: 'p', text: 'En Gropo queremos que puedas informar fácilmente de cualquier problema relacionado con una oferta, un producto, un vendedor o un contenido.' },
    { type: 'p', text: 'Escríbenos a [EMAIL LEGAL] indicando qué quieres comunicar. Revisamos todos los avisos y adoptamos las medidas que correspondan conforme a la legislación aplicable y a nuestras políticas.' },
  ],
  sections: [
    { title: '¿Qué quieres comunicar?', blocks: [
      { type: 'p', text: 'Producto ilegal o peligroso. Un producto que consideres ilegal, peligroso o que pueda incumplir la normativa.' },
      { type: 'p', text: 'Producto falsificado. Un producto que sospeches que infringe derechos de propiedad intelectual o industrial.' },
      { type: 'p', text: 'Información incorrecta. Errores en el precio, el stock, las características, el vendedor o las condiciones de entrega.' },
      { type: 'p', text: 'Problema con un vendedor. Incumplimientos relacionados con un pedido o con las condiciones de venta.' },
      { type: 'p', text: 'Otro problema. Cualquier otra cuestión relacionada con la Plataforma.' },
    ] },
    { title: 'Qué información necesitamos', blocks: [
      { type: 'p', text: 'Cuando sea posible, incluye:' },
      { type: 'list', items: ['el producto;', 'el vendedor;', 'la dirección (URL) de la oferta;', 'el número de pedido, si existe;', 'una descripción del problema;', 'documentación o fotografías relevantes.'] },
    ] },
    { title: 'Qué hacemos después', blocks: [
      { type: 'p', text: 'Analizamos la comunicación recibida. Si es necesario, podemos suspender temporalmente una oferta mientras investigamos, retirarla, solicitar información al vendedor o adoptar las medidas legalmente exigibles.' },
      { type: 'p', text: 'Cuando la comunicación identifique a quien la envía y sea necesario responder, lo haremos por el mismo canal.' },
    ] },
    { title: 'Contacto', blocks: [
      { type: 'list', items: ['[EMAIL LEGAL]', '[RAZÓN SOCIAL], [DOMICILIO]'] },
    ] },
  ],
}

export default doc
