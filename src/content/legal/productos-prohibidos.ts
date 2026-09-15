import type { LegalDoc } from '@/lib/legal'

const doc: LegalDoc = {
  slug: 'productos-prohibidos',
  title: 'Productos y Contenidos Prohibidos',
  summary: 'Qué no se puede vender ni publicar en Gropo, y qué ocurre cuando se detecta.',
  intro: [
    { type: 'p', text: 'Última actualización: [FECHA]' },
    { type: 'p', text: 'Gropo pretende mantener un marketplace seguro y conforme con la legislación aplicable. Los vendedores no podrán ofrecer productos o contenidos que infrinjan la legislación, los derechos de terceros o las reglas de la Plataforma.' },
  ],
  sections: [
    { n: '1', title: 'Productos ilegales', blocks: [{ type: 'p', text: 'No podrán ofrecerse productos cuya comercialización sea ilegal.' }] },
    { n: '2', title: 'Productos falsificados', blocks: [{ type: 'p', text: 'Está prohibida la venta de productos falsificados o que infrinjan derechos de propiedad intelectual o industrial.' }] },
    { n: '3', title: 'Productos robados', blocks: [{ type: 'p', text: 'No podrán ofrecerse bienes cuya procedencia ilícita sea conocida o razonablemente sospechada.' }] },
    { n: '4', title: 'Productos peligrosos', blocks: [{ type: 'p', text: 'Gropo podrá prohibir productos que puedan presentar riesgos indebidos para la seguridad o la salud de los consumidores.' }] },
    { n: '5', title: 'Productos regulados', blocks: [{ type: 'p', text: 'Determinadas categorías sujetas a regulación especial podrán estar prohibidas o requerir requisitos adicionales.' }] },
    { n: '6', title: 'Contenido engañoso', blocks: [
      { type: 'p', text: 'Está prohibida la publicación de información falsa o deliberadamente engañosa sobre:' },
      { type: 'list', items: ['características;', 'precio;', 'stock;', 'origen;', 'autenticidad;', 'disponibilidad;', 'condiciones de entrega.'] },
    ] },
    { n: '7', title: 'Manipulación', blocks: [
      { type: 'p', text: 'Está prohibido manipular artificialmente:' },
      { type: 'list', items: ['unidades;', 'participación;', 'precios;', 'tramos de volumen;', 'valoraciones;', 'actividad de los Grupos.'] },
    ] },
    { n: '8', title: 'Retirada', blocks: [
      { type: 'p', text: 'Gropo podrá retirar contenidos u ofertas que infrinjan esta Política. Cuando corresponda, se informará al Vendedor de las razones de la medida.' },
    ] },
    { n: '9', title: 'Reincidencia', blocks: [
      { type: 'p', text: 'Las infracciones repetidas podrán provocar la suspensión o cancelación de la cuenta del Vendedor.' },
    ] },
    { n: '10', title: 'Notificación', blocks: [
      { type: 'p', text: 'Los Usuarios podrán informar de productos o contenidos potencialmente ilícitos desde la página «Reportar un problema».' },
    ] },
  ],
}

export default doc
