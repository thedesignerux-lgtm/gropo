import type { LegalDoc } from '@/lib/legal'

/**
 * Aviso Legal — obligatorio por LSSI art. 10: el prestador debe facilitar
 * información identificativa «de forma permanente, fácil, directa y gratuita».
 * Mientras los datos de la sociedad sean placeholders, esta página NO cumple
 * esa obligación; por eso va `noindex` hasta que Benjamin los rellene.
 */
const doc: LegalDoc = {
  slug: 'aviso-legal',
  title: 'Aviso Legal',
  summary: 'Quién es el titular de Gropo, qué hace la plataforma y bajo qué condiciones se accede a ella.',
  intro: [
    { type: 'p', text: 'Última actualización: [FECHA]' },
  ],
  sections: [
    {
      n: '1',
      title: 'Identificación del titular',
      blocks: [
        { type: 'p', text: 'El presente sitio web y la plataforma Gropo son titularidad de:' },
        {
          type: 'list',
          items: [
            'Razón social: [RAZÓN SOCIAL]',
            'NIF/CIF: [NIF]',
            'Domicilio social: [DOMICILIO]',
            'Correo electrónico: [EMAIL]',
            'Teléfono: [TELEFONO]',
            'Datos registrales: [REGISTRO MERCANTIL]',
          ],
        },
        { type: 'p', text: 'En adelante, «Gropo».' },
        { type: 'p', text: 'Gropo es una plataforma tecnológica que permite a los consumidores participar en Compras Colectivas y a los vendedores profesionales ofrecer productos a través de ella.' },
      ],
    },
    {
      n: '2',
      title: 'Objeto',
      blocks: [
        { type: 'p', text: 'Este Aviso Legal regula el acceso y la utilización del sitio web, aplicaciones y demás servicios digitales proporcionados por Gropo.' },
        { type: 'p', text: 'El acceso y uso de la Plataforma implica la aceptación de las condiciones establecidas en este Aviso Legal y en los demás documentos legales aplicables.' },
      ],
    },
    {
      n: '3',
      title: 'Funcionamiento de Gropo',
      blocks: [
        { type: 'p', text: 'Gropo facilita la interacción entre consumidores y vendedores profesionales.' },
        { type: 'p', text: 'Salvo que se indique expresamente lo contrario, Gropo no actúa como vendedor de los productos ofrecidos por terceros.' },
        { type: 'p', text: 'El vendedor identificado en cada oferta será la parte responsable de la compraventa del Producto y de las obligaciones que legalmente le correspondan.' },
        { type: 'p', text: 'Gropo podrá prestar servicios tecnológicos relacionados con la publicación de ofertas, la agregación de demanda, la gestión de Grupos, los pagos, las comunicaciones, la logística y la atención al cliente.' },
      ],
    },
    {
      n: '4',
      title: 'Acceso',
      blocks: [
        { type: 'p', text: 'El acceso a determinadas funcionalidades podrá requerir la creación de una cuenta.' },
        { type: 'p', text: 'El Usuario se compromete a proporcionar información veraz y a mantenerla actualizada.' },
      ],
    },
    {
      n: '5',
      title: 'Propiedad intelectual',
      blocks: [
        { type: 'p', text: 'Todos los elementos propios de Gropo, incluyendo marca, logotipo, diseño, software, código, textos, gráficos, interfaces y contenidos, están protegidos por la normativa aplicable.' },
        { type: 'p', text: 'Queda prohibida su reproducción, distribución, transformación o explotación sin autorización, salvo cuando la ley permita expresamente dicha utilización.' },
      ],
    },
    {
      n: '6',
      title: 'Responsabilidad',
      blocks: [
        { type: 'p', text: 'Gropo adoptará medidas razonables para mantener el funcionamiento y la seguridad de la Plataforma.' },
        { type: 'p', text: 'No obstante, no garantiza la disponibilidad permanente del servicio ni la ausencia absoluta de errores, interrupciones o vulnerabilidades.' },
        { type: 'p', text: 'Gropo no será responsable de incumplimientos imputables al vendedor respecto de los productos que éste comercialice, sin perjuicio de las obligaciones que legalmente correspondan a Gropo como operador de la Plataforma.' },
      ],
    },
    {
      n: '7',
      title: 'Enlaces externos',
      blocks: [
        { type: 'p', text: 'La Plataforma podrá contener enlaces a sitios web de terceros. Gropo no controla dichos sitios ni asume responsabilidad por sus contenidos o políticas.' },
      ],
    },
    {
      n: '8',
      title: 'Comunicaciones',
      blocks: [
        { type: 'p', text: 'Las comunicaciones con Gropo podrán realizarse mediante los canales electrónicos indicados en la Plataforma.' },
      ],
    },
    {
      n: '9',
      title: 'Legislación aplicable',
      blocks: [
        { type: 'p', text: 'La relación entre Gropo y los Usuarios se regirá por la legislación española, sin perjuicio de las normas imperativas de protección de los consumidores que resulten aplicables.' },
      ],
    },
    {
      n: '10',
      title: 'Contacto',
      blocks: [
        { type: 'p', text: 'Para cualquier cuestión relacionada con la Plataforma:' },
        { type: 'list', items: ['[EMAIL]', '[DOMICILIO]'] },
      ],
    },
  ],
}

export default doc
