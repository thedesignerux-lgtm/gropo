import type { LegalDoc } from '@/lib/legal'

const doc: LegalDoc = {
  slug: 'cookies',
  title: 'Política de Cookies',
  summary: 'Qué tecnologías de almacenamiento usamos, para qué, y cómo gestionar tu consentimiento.',
  intro: [{ type: 'p', text: 'Última actualización: [FECHA]' }],
  sections: [
    {
      n: '1',
      title: 'Qué son las cookies',
      blocks: [
        { type: 'p', text: 'Las cookies son pequeños archivos que pueden almacenarse en el dispositivo del Usuario cuando visita una página web.' },
        { type: 'p', text: 'Permiten recordar preferencias, mantener sesiones, garantizar funcionalidades y obtener información sobre el uso de la Plataforma.' },
      ],
    },
    {
      n: '2',
      title: 'Qué tecnologías puede utilizar Gropo',
      blocks: [
        { type: 'p', text: 'Cookies estrictamente necesarias. Necesarias para el funcionamiento técnico de la Plataforma: autenticación, seguridad, gestión de sesión, proceso de compra, prevención del fraude y preferencias esenciales.' },
        { type: 'p', text: 'Cookies de preferencias. Permiten recordar determinadas elecciones realizadas por el Usuario.' },
        { type: 'p', text: 'Cookies analíticas. Permiten conocer cómo se utiliza la Plataforma y mejorar su funcionamiento. Se utilizarán conforme a las opciones de consentimiento disponibles.' },
        { type: 'p', text: 'Cookies publicitarias. Cuando Gropo utilice tecnologías destinadas a publicidad personalizada o seguimiento publicitario, solicitará el consentimiento cuando sea legalmente necesario.' },
      ],
    },
    {
      n: '3',
      title: 'Gestión del consentimiento',
      blocks: [
        { type: 'p', text: 'Cuando sea necesario obtener consentimiento, el Usuario podrá aceptar, rechazar o configurar las categorías correspondientes mediante el panel de configuración.' },
        { type: 'p', text: 'La retirada del consentimiento será tan sencilla como su otorgamiento.' },
      ],
    },
    {
      n: '4',
      title: 'Cookies de terceros',
      blocks: [
        { type: 'p', text: 'Algunos proveedores tecnológicos utilizados por Gropo pueden instalar tecnologías propias. La relación concreta de terceros se mantendrá actualizada en el panel de cookies: [LISTA DE COOKIES].' },
      ],
    },
    {
      n: '5',
      title: 'Duración',
      blocks: [
        { type: 'p', text: 'Las cookies podrán ser de sesión o persistentes. Su duración dependerá de su finalidad y proveedor.' },
      ],
    },
    {
      n: '6',
      title: 'Configuración del navegador',
      blocks: [
        { type: 'p', text: 'El Usuario también puede gestionar determinadas cookies mediante la configuración de su navegador.' },
        { type: 'note', text: 'Desactivar cookies necesarias puede afectar al funcionamiento de Gropo.' },
      ],
    },
    {
      n: '7',
      title: 'Actualizaciones',
      blocks: [
        { type: 'p', text: 'Gropo podrá actualizar esta Política cuando cambien las tecnologías utilizadas o la normativa aplicable.' },
      ],
    },
  ],
}

export default doc
