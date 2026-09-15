import type { LegalDoc } from '@/lib/legal'

const doc: LegalDoc = {
  slug: 'terminos',
  title: 'Términos y Condiciones de Uso',
  summary: 'Las reglas de uso de la plataforma: cuenta, uso permitido, participación en grupos y suspensión.',
  intro: [{ type: 'p', text: 'Última actualización: [FECHA]' }],
  sections: [
    {
      n: '1',
      title: 'Qué es Gropo',
      blocks: [
        { type: 'p', text: 'Gropo es una plataforma digital que permite a los Usuarios participar conjuntamente en compras de productos ofrecidos por vendedores profesionales.' },
        { type: 'p', text: 'La finalidad de Gropo es agregar demanda para que un grupo de compradores pueda acceder a condiciones de precio determinadas por el volumen alcanzado.' },
        { type: 'p', text: 'Gropo no es un sitio de cupones ni una plataforma de descuentos tradicionales.' },
      ],
    },
    {
      n: '2',
      title: 'Definiciones',
      blocks: [
        {
          type: 'list',
          items: [
            'Gropo: la plataforma tecnológica.',
            'Usuario: persona que utiliza Gropo.',
            'Comprador: Usuario que participa en una Compra Colectiva.',
            'Vendedor: profesional que ofrece productos a través de Gropo.',
            'Producto: bien ofrecido por un Vendedor.',
            'Grupo: conjunto de Usuarios que participan en una Compra Colectiva.',
            'Precio máximo: precio por unidad máximo que el Comprador acepta pagar.',
            'Precio final: precio por unidad que corresponde al tramo de volumen alcanzado al cierre del Grupo.',
            'Compra Colectiva: operación mediante la cual varios compradores agregan demanda sobre un Producto.',
          ],
        },
      ],
    },
    {
      n: '3',
      title: 'Cuenta',
      blocks: [
        { type: 'p', text: 'El Usuario deberá proporcionar información correcta y mantenerla actualizada.' },
        { type: 'p', text: 'El Usuario es responsable de mantener la confidencialidad de sus credenciales.' },
      ],
    },
    {
      n: '4',
      title: 'Uso permitido',
      blocks: [
        { type: 'p', text: 'El Usuario utilizará Gropo de forma lícita y conforme a estos Términos. Queda prohibido:' },
        {
          type: 'list',
          items: [
            'utilizar datos falsos;',
            'crear cuentas fraudulentas;',
            'manipular artificialmente los Grupos;',
            'utilizar sistemas automatizados no autorizados;',
            'intentar alterar precios o cantidades;',
            'realizar actividades fraudulentas;',
            'introducir software malicioso;',
            'vulnerar la seguridad de la Plataforma;',
            'utilizar Gropo para actividades ilícitas.',
          ],
        },
      ],
    },
    {
      n: '5',
      title: 'Compras',
      blocks: [
        { type: 'p', text: 'La participación en un Grupo no implica necesariamente que la compra vaya a ejecutarse.' },
        { type: 'p', text: 'La compra se ejecutará únicamente cuando se cumplan las condiciones aplicables a la oferta.' },
      ],
    },
    {
      n: '6',
      title: 'Precio máximo',
      blocks: [
        { type: 'p', text: 'El Usuario establece el precio máximo por unidad que está dispuesto a pagar.' },
        { type: 'p', text: 'Para que la compra pueda ejecutarse, el precio final nunca podrá superar ese máximo.' },
      ],
    },
    {
      n: '7',
      title: 'Duración de los Grupos',
      blocks: [
        { type: 'p', text: 'Cada Grupo tendrá una duración máxima de siete (7) días naturales.' },
        { type: 'p', text: 'Con carácter general, los Grupos se cerrarán a las 22:00 horas, hora peninsular española (Europe/Madrid).' },
        { type: 'p', text: 'La fecha y hora exactas de cierre se muestran en la Plataforma antes de participar.' },
      ],
    },
    {
      n: '8',
      title: 'Precio',
      blocks: [
        { type: 'p', text: 'El precio final dependerá del tramo de volumen alcanzado y de las condiciones de la oferta.' },
        { type: 'p', text: 'El Usuario podrá consultar el estado del Grupo y el precio correspondiente antes del cierre.' },
      ],
    },
    {
      n: '9',
      title: 'Pagos',
      blocks: [
        { type: 'p', text: 'Gropo utiliza proveedores externos especializados en pagos.' },
        { type: 'p', text: 'Al asegurar una plaza se realiza una autorización previa (retención) por el importe máximo aceptado por el Usuario.' },
        { type: 'p', text: 'La autorización no constituye un cargo definitivo.' },
      ],
    },
    {
      n: '10',
      title: 'Vendedores',
      blocks: [
        { type: 'p', text: 'Los Productos son ofrecidos por vendedores profesionales identificados en cada oferta.' },
        { type: 'p', text: 'El Vendedor será responsable de cumplir las obligaciones legales aplicables a la venta.' },
      ],
    },
    {
      n: '11',
      title: 'Contenido de usuarios',
      blocks: [
        { type: 'p', text: 'Los Usuarios podrán aportar determinados contenidos cuando la Plataforma lo permita.' },
        { type: 'p', text: 'El Usuario garantiza que dispone de los derechos necesarios para publicar dichos contenidos.' },
      ],
    },
    {
      n: '12',
      title: 'Suspensión',
      blocks: [
        { type: 'p', text: 'Gropo podrá suspender o cancelar cuentas cuando existan indicios razonables de fraude, abuso o incumplimiento de estos Términos o de la legislación aplicable.' },
      ],
    },
    {
      n: '13',
      title: 'Modificaciones',
      blocks: [
        { type: 'p', text: 'Gropo podrá modificar estos Términos cuando resulte necesario. Las modificaciones sustanciales serán comunicadas cuando legalmente corresponda.' },
      ],
    },
    {
      n: '14',
      title: 'Legislación',
      blocks: [
        { type: 'p', text: 'Estos Términos se regirán por la legislación española, respetando siempre los derechos imperativos reconocidos a los consumidores.' },
      ],
    },
  ],
}

export default doc
