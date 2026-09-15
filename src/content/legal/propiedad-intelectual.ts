import type { LegalDoc } from '@/lib/legal'

const doc: LegalDoc = {
  slug: 'propiedad-intelectual',
  title: 'Política de Propiedad Intelectual',
  summary: 'De quién es cada contenido de la plataforma y cómo notificar una infracción.',
  intro: [{ type: 'p', text: 'Última actualización: [FECHA]' }],
  sections: [
    { n: '1', title: 'Propiedad de Gropo', blocks: [
      { type: 'p', text: 'La marca Gropo, sus logotipos, diseños, interfaces, software, código, textos, gráficos, elementos visuales y demás contenidos propios pertenecen a Gropo o a sus respectivos licenciantes.' },
      { type: 'p', text: 'No se concede ninguna licencia sobre dichos elementos salvo cuando se indique expresamente.' },
    ] },
    { n: '2', title: 'Contenido de vendedores', blocks: [
      { type: 'p', text: 'Los Vendedores conservan la titularidad de sus fotografías, textos, marcas y demás contenidos aportados a la Plataforma.' },
      { type: 'p', text: 'Al publicar contenido en Gropo, el Vendedor concede a Gropo una licencia no exclusiva, mundial y limitada al funcionamiento, promoción y prestación de los servicios de la Plataforma.' },
    ] },
    { n: '3', title: 'Garantía del Vendedor', blocks: [
      { type: 'p', text: 'El Vendedor garantiza que dispone de los derechos necesarios sobre los contenidos que publica.' },
    ] },
    { n: '4', title: 'Contenido de usuarios', blocks: [
      { type: 'p', text: 'Los Usuarios deberán disponer de los derechos necesarios sobre cualquier contenido que publiquen.' },
    ] },
    { n: '5', title: 'Notificación de infracciones', blocks: [
      { type: 'p', text: 'Cualquier persona que considere que un contenido disponible en Gropo infringe sus derechos podrá comunicarlo a [EMAIL LEGAL].' },
      { type: 'p', text: 'La comunicación deberá identificar el contenido afectado, el derecho presuntamente infringido, la relación con el contenido, los datos de contacto y cualquier documentación relevante.' },
    ] },
    { n: '6', title: 'Retirada', blocks: [
      { type: 'p', text: 'Gropo podrá adoptar las medidas correspondientes cuando reciba una notificación suficientemente fundamentada o cuando tenga conocimiento de una infracción.' },
    ] },
    { n: '7', title: 'Uso no autorizado', blocks: [
      { type: 'p', text: 'Queda prohibido copiar, extraer, reproducir o explotar sistemáticamente los contenidos o datos de Gropo sin autorización.' },
    ] },
  ],
}

export default doc
