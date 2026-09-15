import type { LegalDoc } from '@/lib/legal'

/**
 * Política de Devoluciones, Reembolsos y Desistimiento.
 *
 * DECISIÓN DE PRODUCTO (Benjamin, sep-2026): los gastos de envío ordinarios los paga
 * el comprador salvo que el vendedor los incluya. Ojo con el matiz legal: en un
 * DESISTIMIENTO el empresario debe reembolsar los costes de entrega ordinaria; lo que
 * asume el consumidor son los costes DIRECTOS de devolución, y sólo si se le informó
 * antes. Esas dos cosas no son la misma y aquí están separadas a propósito.
 */
const doc: LegalDoc = {
  slug: 'devoluciones',
  title: 'Devoluciones, Reembolsos y Desistimiento',
  summary: 'Qué pasa con tu dinero en cada escenario: grupo que no sale, precio por encima de tu máximo, devolución y reembolso.',
  intro: [
    { type: 'p', text: 'Última actualización: [FECHA]' },
    { type: 'p', text: 'Esta Política regula las devoluciones, desistimientos, cancelaciones y reembolsos de las compras realizadas a través de Gropo.' },
    { type: 'p', text: 'Gropo actúa como plataforma tecnológica e intermediario que facilita la realización de compras colectivas entre consumidores y vendedores profesionales. Salvo que se indique expresamente lo contrario, el vendedor identificado en cada oferta es el responsable de la compraventa frente al consumidor, incluyendo entrega, conformidad, garantías, desistimiento y devoluciones.' },
    { type: 'note', text: 'Los derechos reconocidos legalmente al consumidor no se ven limitados por esta Política.' },
  ],
  sections: [
    {
      n: '1',
      title: 'Resumen rápido',
      blocks: [
        { type: 'p', text: 'Si el grupo no alcanza las condiciones necesarias: la compra no se ejecuta, no se realiza ningún cargo y la autorización se cancela o libera.' },
        { type: 'p', text: 'Si el precio final supera tu precio máximo: tu compra no se ejecuta por ese precio y la autorización se libera.' },
        { type: 'p', text: 'Si la compra se ejecuta: se cobra el precio final por las unidades adquiridas, más los gastos adicionales informados previamente. Nunca por encima del máximo que aceptaste.' },
        { type: 'p', text: 'Si quieres devolver el producto: cuando tengas derecho de desistimiento podrás ejercerlo en el plazo legal, normalmente 14 días naturales desde la recepción, sin indicar el motivo.' },
        { type: 'p', text: 'Gastos de envío: los asume el comprador cuando se indiquen expresamente antes de la compra y no estén incluidos en el precio. En caso de desistimiento se aplican las reglas legales de reembolso de los costes de entrega.' },
      ],
    },
    {
      n: '2',
      title: 'Cancelación antes del cierre del grupo',
      blocks: [
        { type: 'p', text: 'Una vez confirmada la participación, la posibilidad de retirarla antes del cierre depende de las funcionalidades habilitadas por Gropo y de las condiciones particulares de la oferta.' },
        { type: 'p', text: 'Mientras el Grupo permanezca abierto, Gropo podrá permitir al Usuario retirar su participación cuando sea técnicamente posible y no contravenga una obligación ya nacida.' },
        { type: 'p', text: 'Cuando exista una autorización de pago y la participación sea retirada antes de la ejecución, Gropo cancelará dicha autorización conforme a las reglas del proveedor de pagos.' },
        { type: 'note', text: 'Una autorización de pago no es un cargo definitivo.' },
      ],
    },
    {
      n: '3',
      title: 'Cierre del grupo',
      blocks: [
        { type: 'p', text: 'Las compras colectivas tienen una duración máxima de siete (7) días naturales y se cierran a las 22:00 horas, hora peninsular española (Europe/Madrid).' },
        { type: 'p', text: 'Una vez cerrado el Grupo:' },
        {
          type: 'list',
          items: [
            'se determina el volumen válido alcanzado;',
            'se determina el tramo de precio correspondiente;',
            'se calcula el precio final;',
            'se comprueba el precio máximo de cada participante;',
            'se identifican las compras ejecutables;',
            'se procede, cuando corresponda, a cobrar el importe autorizado.',
          ],
        },
      ],
    },
    {
      n: '4',
      title: 'Cuando el precio final es igual o inferior a tu máximo',
      blocks: [
        { type: 'p', text: 'La compra podrá ejecutarse siempre que se cumplan las restantes condiciones de la oferta.' },
        { type: 'p', text: 'Ejemplo: precio máximo 60 €, precio final 55 €, cantidad 1 → importe del producto 55 €.' },
        { type: 'p', text: 'Se cobra el precio final, no el importe máximo autorizado.' },
      ],
    },
    {
      n: '5',
      title: 'Cuando el precio final supera tu máximo',
      blocks: [
        { type: 'p', text: 'Si el precio final supera el máximo aceptado, la compra no se ejecuta.' },
        { type: 'p', text: 'Ejemplo: precio máximo 55 €, precio final 60 € → la compra no se ejecuta.' },
        { type: 'p', text: 'Gropo no cobrará el importe correspondiente a esa operación y cancelará o liberará la autorización conforme a las reglas del método de pago utilizado.' },
      ],
    },
    {
      n: '6',
      title: 'Cuando no se alcanza el volumen mínimo',
      blocks: [
        { type: 'p', text: 'Algunas ofertas establecen un volumen mínimo de unidades necesario para que la compra colectiva pueda ejecutarse. Esta condición se muestra antes de participar.' },
        { type: 'p', text: 'Si el Grupo finaliza sin alcanzarlo y la oferta establece que el mínimo es condición necesaria de ejecución: la compra no se ejecuta, no se realiza cargo definitivo y cualquier autorización previa se cancela o libera.' },
      ],
    },
    {
      n: '7',
      title: 'Cancelación por falta de stock',
      blocks: [
        { type: 'p', text: 'El vendedor debe disponer del stock necesario para cumplir las ventas que haya aceptado.' },
        { type: 'p', text: 'Si excepcionalmente no pudiera suministrar un Producto ya confirmado por causa que le sea imputable, el consumidor tendrá derecho a las soluciones que correspondan conforme a la legislación aplicable.' },
        { type: 'p', text: 'La falta de stock no permite al vendedor modificar unilateralmente el precio acordado ni sustituir el Producto por otro sin consentimiento del comprador.' },
      ],
    },
    {
      n: '8',
      title: 'Cancelación por incidencia del vendedor',
      blocks: [
        { type: 'p', text: 'Si el vendedor incumple las condiciones de una oferta, no puede suministrar el Producto o existe una circunstancia que impide ejecutar legítimamente la operación, Gropo podrá cancelar la compra.' },
        { type: 'p', text: 'Cuando se haya producido un cargo, se tramitará el reembolso correspondiente. Cuando solo exista una autorización previa, ésta será cancelada o liberada.' },
      ],
    },
    {
      n: '9',
      title: 'Derecho de desistimiento',
      blocks: [
        { type: 'p', text: 'Cuando el consumidor tenga derecho legal de desistimiento, podrá desistir de la compra sin necesidad de indicar el motivo dentro del plazo legal aplicable.' },
        { type: 'p', text: 'Para las ventas de bienes a distancia, el plazo general es de 14 días naturales desde que el consumidor o un tercero designado por él, distinto del transportista, adquiere la posesión material del bien. Existen excepciones legales para determinados productos y situaciones.' },
        { type: 'p', text: 'El ejercicio del desistimiento no podrá estar sujeto a penalización cuando la ley reconozca dicho derecho.' },
      ],
    },
    {
      n: '10',
      title: 'Cómo ejercer el desistimiento',
      blocks: [
        { type: 'p', text: 'El consumidor puede comunicar su decisión de desistir mediante:' },
        {
          type: 'list',
          items: [
            'Email: [EMAIL DEVOLUCIONES]',
            'o el procedimiento de devolución habilitado dentro de su cuenta de Gropo, cuando esté disponible.',
          ],
        },
        { type: 'p', text: 'La comunicación deberá identificar el nombre del comprador, el número de pedido, el Producto y la voluntad de desistir.' },
        { type: 'p', text: 'Puede utilizarse el formulario de desistimiento incluido al final de esta Política, aunque su uso no es obligatorio cuando la comunicación permita identificar claramente la decisión.' },
      ],
    },
    {
      n: '11',
      title: 'Devolución del producto',
      blocks: [
        { type: 'p', text: 'Una vez comunicado el desistimiento, el consumidor deberá devolver el Producto sin demora indebida y, en principio, dentro de los 14 días naturales siguientes a la comunicación. El plazo se considera cumplido si la devolución se realiza antes de que termine dicho período.' },
        { type: 'p', text: 'El Producto deberá enviarse al vendedor o a la dirección de devolución que éste haya indicado.' },
        { type: 'p', text: 'Gropo podrá facilitar una etiqueta o procedimiento de devolución cuando este servicio esté disponible.' },
      ],
    },
    {
      n: '12',
      title: 'Costes de devolución',
      blocks: [
        { type: 'p', text: 'Salvo que el vendedor haya ofrecido asumirlos o que la legislación establezca otra cosa, el consumidor asumirá los costes directos de devolución derivados del ejercicio del derecho de desistimiento.' },
        { type: 'p', text: 'Esta regla se aplica siempre que el consumidor haya sido informado previamente de que debía asumir dichos costes. Si el vendedor no hubiera informado correctamente, se aplicarán las consecuencias previstas legalmente.' },
      ],
    },
    {
      n: '13',
      title: 'Gastos de envío de la compra',
      blocks: [
        { type: 'p', text: 'Los gastos de envío correspondientes a la entrega inicial serán asumidos por el comprador cuando así se haya indicado claramente antes de realizar la compra.' },
        { type: 'p', text: 'El importe o método de cálculo debe mostrarse antes de la confirmación. El vendedor podrá ofrecer envío gratuito, envío incluido en el precio, tarifa fija, tarifa calculada según destino u otras modalidades legalmente permitidas.' },
      ],
    },
    {
      n: '14',
      title: 'Reembolso en caso de desistimiento',
      blocks: [
        { type: 'p', text: 'Cuando el consumidor ejerza válidamente su derecho de desistimiento, el empresario deberá reembolsar los pagos recibidos, incluidos, cuando corresponda, los costes de entrega ordinaria. Si el consumidor eligió expresamente una modalidad de entrega más costosa que la ordinaria menos costosa ofrecida, el empresario no está obligado a reembolsar ese sobrecoste.' },
        {
          type: 'list',
          items: [
            'Producto: reembolsable.',
            'Coste de entrega ordinaria: reembolsable cuando corresponda legalmente.',
            'Sobrecoste por envío urgente o modalidad más cara elegida voluntariamente: no necesariamente reembolsable.',
            'Coste directo de devolución: normalmente a cargo del consumidor, conforme a la sección 12.',
          ],
        },
      ],
    },
    {
      n: '15',
      title: 'Plazo del reembolso',
      blocks: [
        { type: 'p', text: 'El reembolso se realizará sin demoras indebidas y, como regla general, dentro de los 14 días naturales desde que el empresario haya sido informado de la decisión de desistimiento.' },
        { type: 'p', text: 'En el caso de bienes, el empresario podrá retener el reembolso hasta haber recibido los bienes o hasta que el consumidor presente prueba de su devolución, según qué condición se cumpla primero.' },
        { type: 'p', text: 'El reembolso se realizará utilizando el mismo medio de pago empleado en la operación inicial, salvo que el consumidor haya aceptado expresamente otro medio y éste no le genere costes.' },
      ],
    },
    {
      n: '16',
      title: 'Cuando no ha llegado a haber cobro',
      blocks: [
        { type: 'p', text: 'Cuando una compra colectiva no llegue a ejecutarse antes de que se produzca un cargo definitivo, normalmente no existirá importe que reembolsar: sólo una autorización previa.' },
        { type: 'p', text: 'Gropo procederá a cancelarla o a solicitar su liberación. El momento en que el importe vuelva a aparecer como disponible depende de la entidad financiera y del método de pago.' },
      ],
    },
    {
      n: '17',
      title: 'Diferencia entre autorización y cargo',
      blocks: [
        { type: 'p', text: 'Autorización: reserva temporal de disponibilidad de fondos por el importe máximo aplicable.' },
        { type: 'p', text: 'Cargo: movimiento definitivo mediante el que se cobra el importe correspondiente a una compra ejecutada.' },
        { type: 'p', text: 'La autorización máxima no equivale al importe definitivo. Si el precio final es inferior, solo se cobra el precio final y los demás conceptos previamente informados.' },
      ],
    },
    {
      n: '18',
      title: 'Producto defectuoso o no conforme',
      blocks: [
        { type: 'p', text: 'El derecho de desistimiento es independiente de los derechos legales que correspondan al consumidor cuando un Producto sea defectuoso, no sea conforme con el contrato o no corresponda con lo anunciado.' },
        { type: 'p', text: 'El vendedor será responsable de atender estas reclamaciones conforme a sus obligaciones legales.' },
      ],
    },
    {
      n: '19',
      title: 'Producto incorrecto',
      blocks: [
        { type: 'p', text: 'Si el consumidor recibe un Producto diferente del adquirido, deberá comunicarlo a Gropo o al vendedor a través de los canales habilitados.' },
        { type: 'p', text: 'Cuando el error sea imputable al vendedor, éste asumirá las consecuencias que legalmente correspondan. El consumidor no deberá asumir costes que legalmente correspondan al vendedor.' },
      ],
    },
    {
      n: '20',
      title: 'Producto dañado durante el transporte',
      blocks: [
        { type: 'p', text: 'Si el Producto llega dañado, el consumidor deberá comunicarlo lo antes posible a través de los canales de atención habilitados.' },
        { type: 'p', text: 'Gropo podrá solicitar fotografías, descripción del daño, embalaje, etiqueta de transporte, número de pedido y cualquier otra información necesaria para gestionar la incidencia.' },
      ],
    },
    {
      n: '21',
      title: 'Excepciones al derecho de desistimiento',
      blocks: [
        { type: 'p', text: 'El derecho de desistimiento no será aplicable cuando concurra alguna de las excepciones legalmente previstas.' },
        { type: 'p', text: 'Cuando una oferta esté sujeta a una excepción, dicha circunstancia se comunicará claramente al consumidor antes de la compra.' },
        { type: 'note', text: 'Gropo no aplicará una excepción simplemente porque el vendedor la haya indicado, si no está legalmente permitida.' },
      ],
    },
    {
      n: '22',
      title: 'Productos personalizados',
      blocks: [
        { type: 'p', text: 'Los Productos confeccionados conforme a especificaciones del consumidor o claramente personalizados podrán estar sujetos a una excepción del derecho de desistimiento cuando concurran los requisitos legales. Se informará antes de la compra.' },
      ],
    },
    {
      n: '23',
      title: 'Productos precintados',
      blocks: [
        { type: 'p', text: 'Determinados bienes precintados que no sean aptos para ser devueltos por razones de protección de la salud o de higiene podrán estar sujetos a una excepción cuando el precinto haya sido retirado después de la entrega y se cumplan los requisitos legales. La excepción deberá informarse previamente.' },
      ],
    },
    {
      n: '24',
      title: 'Disminución del valor del producto',
      blocks: [
        { type: 'p', text: 'El consumidor podrá responder de la disminución de valor del bien cuando resulte de una manipulación que vaya más allá de la necesaria para comprobar su naturaleza, características y funcionamiento, en los términos previstos legalmente.' },
        { type: 'p', text: 'No se penalizará al consumidor por la disminución de valor derivada del uso necesario para comprobar el Producto.' },
      ],
    },
    {
      n: '25',
      title: 'Compras con varias unidades',
      blocks: [
        { type: 'p', text: 'Cuando un pedido contenga varias unidades y el desistimiento afecte a todas ellas, se aplicarán las reglas correspondientes al conjunto del pedido.' },
        { type: 'p', text: 'Cuando afecte únicamente a determinadas unidades, el reembolso se calculará conforme a las unidades devueltas y a las condiciones legalmente aplicables.' },
      ],
    },
    {
      n: '26',
      title: 'Pedidos con entrega separada',
      blocks: [
        { type: 'p', text: 'Cuando un pedido contenga varios Productos entregados por separado, el plazo de desistimiento se computará conforme a las reglas legales, incluyendo, cuando corresponda, desde la recepción del último bien.' },
      ],
    },
    {
      n: '27',
      title: 'Reembolsos parciales',
      blocks: [
        { type: 'p', text: 'Cuando solo proceda devolver una parte de un pedido, Gropo o el vendedor tramitarán el reembolso correspondiente a los Productos afectados. Los gastos de entrega se determinarán conforme a la legislación aplicable y a las circunstancias del pedido.' },
      ],
    },
    {
      n: '28',
      title: 'Cupones, promociones y bonificaciones',
      blocks: [
        { type: 'p', text: 'Cuando una compra haya utilizado un cupón, promoción o bonificación, el cálculo del reembolso se realizará conforme a las condiciones de dicha promoción y a los derechos legales del consumidor.' },
        { type: 'p', text: 'En ningún caso una promoción podrá utilizarse para limitar derechos legalmente reconocidos.' },
      ],
    },
    {
      n: '29',
      title: 'Reembolsos por cancelación de Gropo',
      blocks: [
        { type: 'p', text: 'Cuando Gropo o el vendedor cancelen una compra colectiva antes de su ejecución y se haya producido un cargo definitivo, el importe será reembolsado conforme a la causa de la cancelación y a las obligaciones legales aplicables.' },
      ],
    },
    {
      n: '30',
      title: 'Reembolsos por incumplimiento del vendedor',
      blocks: [
        { type: 'p', text: 'Cuando el vendedor no cumpla sus obligaciones y corresponda cancelar la venta o efectuar un reembolso, Gropo podrá gestionar o facilitar el proceso utilizando los mecanismos de pago disponibles.' },
        { type: 'p', text: 'La responsabilidad del vendedor frente al consumidor no desaparece porque Gropo facilite técnicamente el reembolso.' },
      ],
    },
    {
      n: '31',
      title: 'Reembolso por error en el cobro',
      blocks: [
        { type: 'p', text: 'Si se produce un cobro superior al importe que correspondía conforme a las condiciones de la compra, Gropo y/o el vendedor corregirán el importe y reembolsarán la diferencia.' },
        { type: 'p', text: 'El consumidor no está obligado a aceptar un precio superior al acordado.' },
      ],
    },
    {
      n: '32',
      title: 'Contracargos y disputas de pago',
      blocks: [
        { type: 'p', text: 'Cuando una operación sea objeto de una disputa o contracargo a través de la entidad financiera o proveedor de pagos, Gropo podrá solicitar información adicional para investigar la operación.' },
        { type: 'p', text: 'La existencia de un procedimiento de contracargo no limita los derechos legales del consumidor.' },
      ],
    },
    {
      n: '33',
      title: 'Cómo iniciar una devolución',
      blocks: [
        {
          type: 'list',
          items: [
            'Accede a «Mis grupos».',
            'Selecciona el pedido correspondiente.',
            'Selecciona «Solicitar devolución» o la opción disponible.',
            'Indica el motivo cuando sea necesario para gestionar la solicitud.',
            'Sigue las instrucciones de devolución.',
          ],
        },
        { type: 'p', text: 'Cuando el derecho ejercido no requiera justificar el motivo, la ausencia de explicación no impedirá ejercerlo.' },
      ],
    },
    {
      n: '34',
      title: 'Responsabilidad de Gropo',
      blocks: [
        { type: 'p', text: 'Gropo facilita la infraestructura tecnológica de la operación y puede prestar servicios de coordinación de pagos, logística y atención al cliente.' },
        { type: 'p', text: 'Salvo que se indique expresamente lo contrario, Gropo no sustituye al vendedor en las obligaciones legales que le corresponden respecto del Producto.' },
      ],
    },
    {
      n: '35',
      title: 'Contacto',
      blocks: [
        { type: 'list', items: ['[RAZÓN SOCIAL]', 'Email: [EMAIL DEVOLUCIONES]', 'Domicilio: [DOMICILIO]'] },
        { type: 'p', text: 'Cuando la reclamación corresponda directamente al vendedor, Gropo podrá trasladarla y facilitar su resolución.' },
      ],
    },
    {
      n: '36',
      title: 'Formulario de desistimiento',
      blocks: [
        { type: 'p', text: 'El consumidor podrá utilizar el siguiente modelo cuando quiera ejercer su derecho de desistimiento y dicho derecho resulte aplicable:' },
        { type: 'p', text: 'A la atención de [RAZÓN SOCIAL] / [VENDEDOR], [DOMICILIO], [EMAIL DEVOLUCIONES].' },
        { type: 'p', text: 'Por la presente comunico que desisto del contrato de compraventa correspondiente al siguiente Producto:' },
        {
          type: 'list',
          items: [
            'Producto:',
            'Número de pedido:',
            'Fecha de compra:',
            'Fecha de recepción:',
            'Nombre del consumidor:',
            'Dirección del consumidor:',
            'Fecha:',
            'Firma (solo cuando el formulario se presente en papel):',
          ],
        },
      ],
    },
    {
      n: '37',
      title: 'Prevalencia de los derechos legales',
      blocks: [
        { type: 'p', text: 'Esta Política no pretende limitar, excluir ni sustituir los derechos reconocidos a los consumidores por la legislación aplicable.' },
        { type: 'p', text: 'Cuando una disposición de esta Política sea menos favorable para el consumidor que una norma imperativa aplicable, prevalecerá dicha norma.' },
      ],
    },
    {
      n: '38',
      title: 'Modificaciones',
      blocks: [
        { type: 'p', text: 'Gropo podrá actualizar esta Política cuando resulte necesario por cambios legales, operativos o tecnológicos. La versión vigente estará disponible permanentemente en la Plataforma.' },
        { type: 'p', text: 'Las modificaciones no afectarán a los derechos ya adquiridos respecto de compras anteriores, salvo cuando la modificación resulte exigida por la legislación aplicable.' },
      ],
    },
    {
      n: '39',
      title: 'Regla fundamental de Gropo',
      blocks: [
        { type: 'p', text: 'La mecánica de una compra colectiva no reduce los derechos legales del consumidor.' },
        { type: 'p', text: 'Que el precio se determine mediante la agregación de demanda, que el Grupo dure como máximo siete días o que el pago se autorice antes del cierre no modifica los derechos que corresponden al consumidor una vez realizada la compraventa.' },
        { type: 'p', text: 'Gropo mostrará antes de la compra las condiciones económicas esenciales de la operación: precio actual, precio máximo, precio final o mecanismo para determinarlo, cantidad, gastos de envío, vendedor, fecha de cierre, condiciones de ejecución y condiciones de devolución.' },
      ],
    },
  ],
}

export default doc
