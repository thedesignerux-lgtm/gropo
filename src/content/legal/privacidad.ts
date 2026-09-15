import type { LegalDoc } from '@/lib/legal'

/**
 * Política de Privacidad.
 *
 * NO SE NOMBRAN PROVEEDORES TODAVÍA. Stripe, Supabase, Resend, Sendcloud y Vercel
 * están efectivamente en producción, pero nombrarlos en una política pública obliga a
 * declarar también su papel (encargado vs. responsable), su ubicación y las garantías
 * de transferencia internacional. Eso es exactamente lo que tiene que revisar el
 * abogado, y una lista incompleta es peor que una lista pendiente.
 */
const doc: LegalDoc = {
  slug: 'privacidad',
  title: 'Política de Privacidad',
  summary: 'Qué datos tratamos, para qué, con qué base legal, durante cuánto tiempo y qué derechos tienes.',
  intro: [{ type: 'p', text: 'Última actualización: [FECHA]' }],
  sections: [
    {
      n: '1',
      title: 'Responsable del tratamiento',
      blocks: [
        {
          type: 'list',
          items: [
            '[RAZÓN SOCIAL]',
            'NIF/CIF: [NIF]',
            'Domicilio: [DOMICILIO]',
            'Email: [EMAIL PRIVACIDAD]',
            'Delegado de Protección de Datos, cuando resulte obligatorio: [DPD]',
          ],
        },
      ],
    },
    {
      n: '2',
      title: 'Qué datos recopilamos',
      blocks: [
        { type: 'p', text: 'Datos identificativos: nombre, apellidos, email, teléfono e identificadores de cuenta.' },
        { type: 'p', text: 'Datos de entrega: dirección, código postal, ciudad, provincia y país.' },
        { type: 'p', text: 'Datos de compra: productos, cantidades, grupos en los que participa, precio máximo aceptado, precio final, pedidos, devoluciones e incidencias.' },
        { type: 'p', text: 'Datos de pago: Gropo recibe determinada información relacionada con las operaciones de pago. Los datos completos de las tarjetas son tratados directamente por el proveedor de servicios de pago; Gropo no los almacena.' },
        { type: 'p', text: 'Datos técnicos: dirección IP, dispositivo, navegador, sistema operativo, identificadores técnicos, registros de actividad y datos de seguridad.' },
        { type: 'p', text: 'Comunicaciones: podremos conservar las comunicaciones relacionadas con pedidos, soporte e incidencias.' },
      ],
    },
    {
      n: '3',
      title: 'Para qué utilizamos los datos',
      blocks: [
        {
          type: 'list',
          items: [
            'crear y gestionar cuentas;',
            'permitir la participación en compras colectivas;',
            'procesar pedidos;',
            'gestionar pagos;',
            'calcular y comunicar el precio final;',
            'gestionar envíos;',
            'gestionar devoluciones;',
            'prestar atención al cliente;',
            'prevenir el fraude;',
            'garantizar la seguridad;',
            'cumplir obligaciones legales;',
            'gestionar y mejorar la Plataforma;',
            'enviar comunicaciones comerciales cuando exista una base jurídica adecuada.',
          ],
        },
      ],
    },
    {
      n: '4',
      title: 'Bases jurídicas',
      blocks: [
        {
          type: 'list',
          items: [
            'ejecución del contrato;',
            'cumplimiento de obligaciones legales;',
            'consentimiento;',
            'interés legítimo;',
            'protección de la seguridad y prevención del fraude.',
          ],
        },
      ],
    },
    {
      n: '5',
      title: 'Proveedores',
      blocks: [
        { type: 'p', text: 'Gropo utiliza proveedores tecnológicos para prestar sus servicios, incluyendo proveedores de pagos, logística, alojamiento, infraestructura, analítica, comunicaciones, atención al cliente y prevención del fraude.' },
        { type: 'p', text: 'La relación concreta de proveedores se publicará aquí y se mantendrá actualizada: [LISTA DE PROVEEDORES].' },
      ],
    },
    {
      n: '6',
      title: 'Vendedores',
      blocks: [
        { type: 'p', text: 'Cuando el Usuario realice una compra, los datos necesarios para ejecutar el pedido se comunicarán al vendedor responsable del Producto.' },
        { type: 'p', text: 'El vendedor solo podrá utilizarlos para finalidades legítimas relacionadas con la operación y deberá cumplir la normativa de protección de datos aplicable.' },
      ],
    },
    {
      n: '7',
      title: 'Conservación',
      blocks: [
        { type: 'p', text: 'Gropo conservará los datos durante el tiempo necesario para cumplir las finalidades para las que fueron obtenidos y, posteriormente, durante los períodos necesarios para cumplir obligaciones legales o atender posibles responsabilidades.' },
      ],
    },
    {
      n: '8',
      title: 'Derechos',
      blocks: [
        { type: 'p', text: 'El Usuario podrá ejercer los derechos que le reconozca la normativa aplicable:' },
        {
          type: 'list',
          items: ['acceso;', 'rectificación;', 'supresión;', 'oposición;', 'limitación;', 'portabilidad;', 'retirada del consentimiento cuando el tratamiento se base en éste.'],
        },
        { type: 'p', text: 'Puede ejercerlos escribiendo a [EMAIL PRIVACIDAD].' },
      ],
    },
    {
      n: '9',
      title: 'Reclamaciones',
      blocks: [
        { type: 'p', text: 'El Usuario podrá presentar una reclamación ante la autoridad de protección de datos competente cuando considere que sus derechos no han sido respetados.' },
      ],
    },
    {
      n: '10',
      title: 'Seguridad',
      blocks: [
        { type: 'p', text: 'Gropo aplica medidas técnicas y organizativas adecuadas para proteger los datos personales frente a accesos no autorizados, pérdida, destrucción o alteración.' },
      ],
    },
    {
      n: '11',
      title: 'Transferencias internacionales',
      blocks: [
        { type: 'p', text: 'Cuando alguno de los proveedores utilizados por Gropo implique una transferencia internacional de datos, ésta se realizará conforme a las garantías previstas por la legislación aplicable.' },
      ],
    },
    {
      n: '12',
      title: 'Cambios',
      blocks: [
        { type: 'p', text: 'Gropo podrá actualizar esta Política cuando resulte necesario por cambios legales, tecnológicos o en sus servicios. La versión vigente estará disponible permanentemente en la Plataforma.' },
      ],
    },
  ],
}

export default doc
