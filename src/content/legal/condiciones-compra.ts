import type { LegalDoc } from '@/lib/legal'

/**
 * Condiciones de Compra — el documento donde se explica la mecánica real de Gropo.
 *
 * VOCABULARIO. Se usa «precio máximo» y no «PMA»: el léxico cerrado del producto
 * (PRODUCT_PRINCIPLES §7) prohíbe las siglas internas en cualquier superficie que
 * vea el comprador, y un documento legal es la superficie donde peor sienta una
 * sigla que nadie le ha explicado.
 */
const doc: LegalDoc = {
  slug: 'condiciones-compra',
  title: 'Condiciones de Compra',
  summary: 'Cómo funciona una compra colectiva: precio máximo, precio final, cierre del grupo y cobro.',
  intro: [{ type: 'p', text: 'Última actualización: [FECHA]' }],
  sections: [
    {
      n: '1',
      title: 'Cómo funciona una compra colectiva',
      blocks: [
        { type: 'p', text: 'Gropo permite que varios compradores agreguen su demanda sobre un mismo Producto.' },
        { type: 'p', text: 'El Vendedor establece distintas condiciones de precio vinculadas al número total de unidades.' },
        { type: 'p', text: 'A medida que aumentan las unidades del Grupo, puede alcanzarse un tramo de precio inferior.' },
        { type: 'p', text: 'Todos los compradores cuya compra se ejecute bajo un mismo tramo pagarán el mismo precio final por unidad.' },
        {
          type: 'table',
          head: ['Unidades', 'Precio por unidad'],
          rows: [
            ['1 – 5', '65 €'],
            ['6 – 10', '60 €'],
            ['11 – 20', '55 €'],
            ['21 o más', '50 €'],
          ],
        },
        { type: 'note', text: 'Ejemplo ilustrativo. Cada oferta publica sus propios tramos antes de que nadie participe.' },
      ],
    },
    {
      n: '2',
      title: 'Tu precio máximo',
      blocks: [
        { type: 'p', text: 'Antes de participar, el Usuario indica el precio máximo por unidad que acepta pagar.' },
        { type: 'p', text: 'Ese importe es el límite de la operación: es lo que se autoriza en la tarjeta y lo que nunca se superará.' },
      ],
    },
    {
      n: '3',
      title: 'Regla fundamental',
      blocks: [
        { type: 'p', text: 'Nunca se ejecutará una compra por un precio superior al máximo aceptado por el Usuario.' },
        { type: 'p', text: 'Si el precio final es igual o inferior a ese máximo, la compra podrá ejecutarse cuando se cumplan las restantes condiciones de la oferta.' },
        { type: 'p', text: 'Si el precio final lo supera, la compra no se ejecuta y la autorización se libera.' },
      ],
    },
    {
      n: '4',
      title: 'Duración',
      blocks: [
        { type: 'p', text: 'Los Grupos tienen una duración máxima de siete (7) días naturales.' },
        { type: 'p', text: 'El cierre se produce a las 22:00 horas, hora peninsular española (Europe/Madrid).' },
        { type: 'p', text: 'La fecha concreta de cierre se muestra siempre en la oferta antes de participar.' },
      ],
    },
    {
      n: '5',
      title: 'Cálculo del precio final',
      blocks: [
        { type: 'p', text: 'Al cierre del Grupo:' },
        {
          type: 'list',
          items: [
            'se determinan las unidades válidas del Grupo;',
            'se determina el tramo de precio alcanzado;',
            'se calcula el precio final;',
            'se comprueba el precio máximo de cada comprador;',
            'se determinan las compras que pueden ejecutarse;',
            'se procesa el pago correspondiente.',
          ],
        },
      ],
    },
    {
      n: '6',
      title: 'Pago',
      blocks: [
        { type: 'p', text: 'Al asegurar la plaza se solicita una autorización previa por el importe máximo aceptado. Esta autorización es una retención de fondos, no un cargo.' },
        { type: 'p', text: 'Si la compra se ejecuta, se cobra el precio final aplicable más los gastos adicionales previamente informados.' },
        { type: 'p', text: 'Si no se ejecuta, la autorización se cancela o se libera conforme a las reglas del método de pago utilizado.' },
      ],
    },
    {
      n: '7',
      title: 'Gastos de envío',
      blocks: [
        { type: 'p', text: 'Los gastos de envío serán asumidos por el comprador, salvo que:' },
        {
          type: 'list',
          items: [
            'el Vendedor ofrezca envío gratuito;',
            'el Vendedor incluya el envío en el precio;',
            'la oferta establezca expresamente otra condición.',
          ],
        },
        { type: 'p', text: 'El importe aplicable se muestra antes de confirmar la compra.' },
      ],
    },
    {
      n: '8',
      title: 'Vendedor',
      blocks: [
        { type: 'p', text: 'Cada Producto muestra la identidad del Vendedor responsable de la oferta.' },
        { type: 'p', text: 'El Vendedor es responsable de la compraventa y de las obligaciones legales correspondientes.' },
      ],
    },
    {
      n: '9',
      title: 'Confirmación',
      blocks: [
        { type: 'p', text: 'Antes de completar la operación, el Usuario puede revisar:' },
        {
          type: 'list',
          items: [
            'Producto;',
            'cantidad;',
            'precio máximo aceptado;',
            'condiciones del Grupo;',
            'precio final aplicable o mecanismo para determinarlo;',
            'gastos de envío;',
            'Vendedor;',
            'condiciones de devolución.',
          ],
        },
      ],
    },
    {
      n: '10',
      title: 'Obligación de pago',
      blocks: [
        { type: 'p', text: 'Antes de completar el pedido, el Usuario es informado de que la operación puede generar una obligación de pago cuando se cumplan las condiciones indicadas.' },
        { type: 'note', text: 'Al confirmar, autorizas un importe máximo. Si el precio final es igual o inferior a ese máximo, se realizará el cargo por el precio final. Si es superior, tu compra no se ejecutará y no se te cobrará nada.' },
      ],
    },
    {
      n: '11',
      title: 'Cancelación',
      blocks: [
        { type: 'p', text: 'Las condiciones de cancelación, desistimiento y reembolso se regulan en la Política de Devoluciones, Reembolsos y Desistimiento.' },
      ],
    },
    {
      n: '12',
      title: 'Derechos del consumidor',
      blocks: [
        { type: 'p', text: 'La participación en una compra colectiva no limita los derechos legales del consumidor.' },
      ],
    },
    {
      n: '13',
      title: 'Documentación contractual',
      blocks: [
        { type: 'p', text: 'Gropo proporcionará al Usuario la confirmación de la operación en un soporte duradero, incluyendo correo electrónico u otro medio equivalente.' },
      ],
    },
  ],
}

export default doc
