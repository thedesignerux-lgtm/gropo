import type { LegalDoc } from '@/lib/legal'

/**
 * Condiciones para Vendedores Profesionales.
 *
 * Es el documento más largo del paquete y no es por gusto: el DSA obliga a la
 * plataforma a recabar y verificar razonablemente la identidad del comerciante ANTES
 * de dejarle publicar, y la relación económica (comisiones, liquidación, contracargos)
 * tiene que estar escrita en algún sitio antes de que entre el primer vendedor real.
 */
const doc: LegalDoc = {
  slug: 'condiciones-vendedores',
  title: 'Condiciones para Vendedores Profesionales',
  summary: 'La relación entre Gropo y los vendedores: requisitos, obligaciones, precios por volumen, pagos, comisiones y responsabilidad.',
  intro: [
    { type: 'p', text: 'Última actualización: [FECHA]' },
    { type: 'p', text: 'Estas Condiciones regulan la relación entre [RAZÓN SOCIAL] («Gropo») y las personas físicas o jurídicas que actúen como empresarios o profesionales y utilicen la Plataforma para ofrecer Productos mediante compras colectivas.' },
    { type: 'p', text: 'Complementan los Términos y Condiciones de Uso, la Política de Privacidad y las condiciones particulares de cada oferta publicada.' },
    { type: 'p', text: 'Al registrarse como Vendedor Profesional y utilizar los servicios de Gropo, el Vendedor declara que ha leído y acepta estas Condiciones.' },
  ],
  sections: [
    { n: '1', title: 'Definiciones', blocks: [
      { type: 'list', items: [
        'Gropo: la plataforma tecnológica que permite publicar ofertas y agregar la demanda de distintos compradores.',
        'Vendedor: empresario o profesional que ofrece Productos a través de Gropo.',
        'Comprador: usuario que participa en una compra colectiva.',
        'Producto: bien ofrecido por el Vendedor a través de la Plataforma.',
        'Grupo o compra colectiva: conjunto de compradores que agregan su demanda respecto de un Producto con el objetivo de alcanzar condiciones de precio asociadas al volumen.',
        'Tramo: nivel de volumen al que corresponde un determinado precio por unidad.',
        'Precio máximo: precio por unidad máximo que el Comprador acepta pagar.',
        'Precio final: precio por unidad que corresponde a la compra colectiva una vez cerrado el Grupo.',
        'Cierre: momento en el que finaliza la recepción de nuevas participaciones en un Grupo.',
        'Plataforma: el sitio web, aplicaciones, herramientas y servicios digitales proporcionados por Gropo.',
      ] },
    ] },
    { n: '2', title: 'Función de Gropo', blocks: [
      { type: 'p', text: 'Gropo proporciona una infraestructura tecnológica destinada a facilitar la agregación de demanda y la contratación de Productos ofrecidos por Vendedores Profesionales.' },
      { type: 'p', text: 'Salvo que se indique expresamente lo contrario en una oferta concreta, Gropo actúa como intermediario o proveedor de servicios de plataforma, y no como vendedor del Producto.' },
      { type: 'p', text: 'El contrato de compraventa se celebra entre el Vendedor y el Comprador cuando se cumplen las condiciones necesarias para su ejecución. El Vendedor será responsable de las obligaciones que legalmente correspondan al vendedor frente al consumidor.' },
      { type: 'p', text: 'Gropo podrá prestar servicios adicionales: publicación de ofertas, agregación de demanda, procesamiento o coordinación del pago, comunicación, gestión tecnológica de pedidos, coordinación logística, atención inicial al cliente, gestión de incidencias y herramientas de análisis y seguimiento.' },
      { type: 'note', text: 'La prestación de estos servicios no convierte por sí misma a Gropo en vendedor del Producto.' },
    ] },
    { n: '3', title: 'Requisitos para ser Vendedor', blocks: [
      { type: 'p', text: 'Solo podrán utilizar las funcionalidades destinadas a Vendedores Profesionales quienes actúen en el ejercicio de una actividad empresarial o profesional.' },
      { type: 'p', text: 'El Vendedor deberá proporcionar información veraz, completa y actualizada sobre su identidad y actividad. Gropo podrá solicitar documentación para verificar identidad, razón social, domicilio, identificación fiscal, actividad profesional, titularidad de la cuenta, datos de contacto, información bancaria e información relativa a los Productos.' },
    ] },
    { n: '4', title: 'Identidad y trazabilidad del Vendedor', blocks: [
      { type: 'p', text: 'El Vendedor acepta que determinada información identificativa pueda mostrarse a los Compradores cuando resulte legalmente exigible o necesario para garantizar la transparencia de la operación.' },
      { type: 'list', items: ['nombre o razón social;', 'dirección profesional;', 'datos de contacto;', 'número de identificación fiscal;', 'información sobre su condición de profesional;', 'información registral cuando resulte aplicable.'] },
      { type: 'p', text: 'El Vendedor autoriza a Gropo a realizar las comprobaciones necesarias para verificar dicha información.' },
    ] },
    { n: '5', title: 'Responsabilidad sobre la información proporcionada', blocks: [
      { type: 'p', text: 'El Vendedor será responsable de que toda la información facilitada sea exacta, completa, actualizada, verificable, legal y no engañosa, y deberá informar inmediatamente a Gropo cuando alguno de estos datos deje de ser correcto.' },
      { type: 'p', text: 'No podrá proporcionar información que pueda inducir a error al consumidor sobre precio, descuento, disponibilidad, características, origen, marca, estado, garantía, condiciones de entrega, condiciones de devolución o cualquier otra característica esencial del Producto.' },
    ] },
    { n: '6', title: 'Productos que pueden ofrecerse', blocks: [
      { type: 'p', text: 'El Vendedor únicamente podrá publicar Productos cuya comercialización sea legal y respecto de los cuales tenga capacidad legítima para vender, garantizando que:' },
      { type: 'list', items: ['son auténticos;', 'no infringen derechos de terceros;', 'cumplen la normativa aplicable;', 'cumplen los requisitos de seguridad;', 'disponen de las autorizaciones necesarias cuando correspondan;', 'cumplen las obligaciones de etiquetado e información;', 'son conformes con la descripción publicada.'] },
      { type: 'p', text: 'Gropo podrá prohibir determinadas categorías de Productos.' },
    ] },
    { n: '7', title: 'Información del Producto', blocks: [
      { type: 'p', text: 'Antes de publicar una oferta, el Vendedor deberá proporcionar información suficiente para que el consumidor pueda tomar una decisión de compra informada, incluyendo cuando corresponda: nombre, descripción, características principales, fotografías, marca, modelo, referencia, estado, unidades disponibles, precio o estructura de precios, gastos de envío, impuestos, condiciones de entrega, condiciones particulares, garantías, restricciones y cualquier otra información legalmente exigible.' },
    ] },
    { n: '8', title: 'Sistema de precios por volumen', blocks: [
      { type: 'p', text: 'El Vendedor podrá establecer diferentes tramos de precio en función del número total de unidades comprometidas dentro de una compra colectiva.' },
      { type: 'table', head: ['Unidades', 'Precio por unidad'], rows: [['1 – 5', '65 €'], ['6 – 10', '60 €'], ['11 – 20', '55 €'], ['21 o más', '50 €']] },
      { type: 'p', text: 'Los tramos, precios y condiciones deberán definirse antes de la apertura del Grupo.' },
      { type: 'p', text: 'Una vez publicada una compra colectiva, el Vendedor no podrá modificar unilateralmente sus condiciones esenciales mientras el Grupo esté abierto, salvo cuando la Plataforma lo permita expresamente y no perjudique a los consumidores que ya hayan participado.' },
    ] },
    { n: '9', title: 'Precio ofrecido', blocks: [
      { type: 'p', text: 'Los precios introducidos deberán ser reales, aplicables y sostenibles económicamente.' },
      { type: 'p', text: 'El Vendedor será responsable de comprobar que los precios publicados incluyen o permiten identificar correctamente los impuestos y demás conceptos que legalmente deban comunicarse al consumidor.' },
      { type: 'p', text: 'Gropo podrá mostrar separadamente precio del Producto, impuestos, gastos de envío y otros costes.' },
    ] },
    { n: '10', title: 'Condiciones mínimas de ejecución', blocks: [
      { type: 'p', text: 'El Vendedor podrá establecer un volumen mínimo necesario para ejecutar una compra colectiva. Esta condición deberá comunicarse claramente antes de que los consumidores participen.' },
      { type: 'p', text: 'Si al cierre no se alcanza el mínimo establecido, la operación podrá cancelarse conforme a las condiciones de la oferta.' },
      { type: 'note', text: 'El Vendedor no podrá introducir posteriormente un mínimo que no hubiera sido comunicado antes de la participación.' },
    ] },
    { n: '11', title: 'Stock', blocks: [
      { type: 'p', text: 'El Vendedor deberá disponer de stock suficiente para atender las unidades que haya puesto a disposición del Grupo. Cuando exista un límite máximo de unidades, deberá indicarse en la oferta.' },
      { type: 'p', text: 'Deberá actualizar inmediatamente la información de stock cuando exista riesgo de no poder atender las unidades comprometidas. La venta de unidades superiores al stock disponible podrá considerarse un incumplimiento.' },
    ] },
    { n: '12', title: 'Duración de los Grupos', blocks: [
      { type: 'p', text: 'Las compras colectivas tendrán una duración máxima de siete (7) días naturales desde su apertura y se cerrarán a las 22:00 horas, hora oficial de España peninsular (Europe/Madrid).' },
      { type: 'p', text: 'La fecha y hora exactas de cierre serán determinadas por Gropo y mostradas en la Plataforma. En ningún caso un Grupo podrá permanecer abierto más de siete días naturales desde su apertura.' },
      { type: 'p', text: 'Una vez alcanzado el cierre: dejan de admitirse nuevas participaciones, se congela el volumen válido, se determina el tramo de precio correspondiente, se calcula el precio final y se determinan las operaciones ejecutables.' },
    ] },
    { n: '13', title: 'Precio final', blocks: [
      { type: 'p', text: 'El precio final será el correspondiente al tramo de volumen alcanzado por el Grupo conforme a las condiciones previamente establecidas por el Vendedor.' },
      { type: 'p', text: 'El Vendedor deberá respetarlo y no podrá cobrar al Comprador un precio superior al que corresponda conforme a las condiciones publicadas.' },
    ] },
    { n: '14', title: 'Precio máximo del Comprador', blocks: [
      { type: 'p', text: 'El Comprador establece el precio máximo por unidad que acepta pagar.' },
      { type: 'p', text: 'Cuando el precio final sea superior a ese máximo, la operación de dicho Comprador no podrá ejecutarse por ese precio.' },
      { type: 'p', text: 'El Vendedor acepta que no podrá exigir al Comprador el pago de un importe superior al máximo aceptado para dicha operación.' },
    ] },
    { n: '15', title: 'Igualdad del precio dentro del tramo', blocks: [
      { type: 'p', text: 'Salvo que las condiciones particulares de la oferta establezcan expresamente otra estructura, los Compradores que participen en una misma compra colectiva estarán sujetos al mismo precio final por unidad correspondiente al tramo alcanzado.' },
      { type: 'p', text: 'El Vendedor no podrá cobrar precios diferentes por una misma unidad basándose únicamente en el orden en que los compradores participaron.' },
    ] },
    { n: '16', title: 'Autorización del pago', blocks: [
      { type: 'p', text: 'Gropo solicitará una autorización previa por un importe máximo basado en el precio máximo aceptado por el Comprador. Esta autorización no constituye un cargo definitivo.' },
      { type: 'p', text: 'Una vez cerrado el Grupo y determinado el precio final, Gropo podrá capturar el importe correspondiente, siempre que se hayan cumplido las condiciones de ejecución.' },
      { type: 'note', text: 'El Vendedor no podrá solicitar directamente al Comprador un pago adicional para compensar la diferencia entre el precio máximo y el precio final.' },
    ] },
    { n: '17', title: 'Captura del pago', blocks: [
      { type: 'p', text: 'Cuando corresponda ejecutar la operación, el importe se calculará como precio final × unidades adquiridas, más los conceptos adicionales previamente comunicados y legalmente aplicables.' },
      { type: 'p', text: 'El Vendedor recibirá la liquidación correspondiente después de que se haya producido la operación conforme a las reglas establecidas entre el Vendedor y Gropo.' },
    ] },
    { n: '18', title: 'Imposibilidad de ejecución', blocks: [
      { type: 'p', text: 'Una compra colectiva podrá no ejecutarse cuando:' },
      { type: 'list', items: ['no se alcance el volumen mínimo;', 'no exista stock suficiente;', 'el precio final sea incompatible con el precio máximo de determinados Compradores;', 'exista un problema de pago;', 'exista una causa legal;', 'concurra fuerza mayor;', 'se produzca una incidencia técnica grave;', 'resulte imposible suministrar el Producto.'] },
    ] },
    { n: '19', title: 'Obligación de suministro', blocks: [
      { type: 'p', text: 'Una vez confirmada una venta ejecutable, el Vendedor deberá suministrar el Producto en las condiciones anunciadas.' },
      { type: 'p', text: 'No podrá cancelar unilateralmente una venta simplemente porque el precio final sea inferior al esperado, porque el Grupo haya alcanzado un volumen elevado, porque la demanda supere sus expectativas o porque considere posteriormente insuficiente su margen.' },
      { type: 'note', text: 'El precio por volumen aceptado por el Vendedor constituye una condición esencial de la oferta.' },
    ] },
    { n: '20', title: 'Preparación del pedido', blocks: [
      { type: 'p', text: 'El Vendedor deberá preparar los pedidos dentro del plazo comunicado en la oferta.' },
      { type: 'p', text: 'El Producto deberá corresponder exactamente con el Producto comprado: modelo, variante, talla, color, cantidad, características y accesorios incluidos. No podrá sustituirse unilateralmente por otro diferente.' },
    ] },
    { n: '21', title: 'Envío', blocks: [
      { type: 'p', text: 'El Vendedor será responsable de entregar el Producto al operador logístico dentro del plazo establecido.' },
      { type: 'p', text: 'Cuando Gropo proporcione herramientas o servicios logísticos, el Vendedor deberá utilizarlos conforme a las instrucciones correspondientes y proporcionar información de envío suficiente para permitir el seguimiento del pedido.' },
    ] },
    { n: '22', title: 'Embalaje', blocks: [
      { type: 'p', text: 'Los Productos deberán enviarse correctamente embalados y protegidos. El Vendedor será responsable de los daños derivados de un embalaje manifiestamente inadecuado.' },
    ] },
    { n: '23', title: 'Facturación', blocks: [
      { type: 'p', text: 'Cuando legalmente corresponda, el Vendedor será responsable de emitir la factura o documento justificativo de la compraventa, cumpliendo la legislación fiscal aplicable.' },
      { type: 'p', text: 'Gropo podrá facilitar herramientas para la generación, transmisión o gestión de información relacionada con la facturación, sin asumir por ello las obligaciones fiscales propias del Vendedor salvo pacto expreso.' },
    ] },
    { n: '24', title: 'Impuestos', blocks: [
      { type: 'p', text: 'El Vendedor será responsable de determinar y satisfacer los impuestos, tasas y obligaciones fiscales que legalmente correspondan a sus ventas.' },
      { type: 'p', text: 'Cuando Gropo esté legalmente obligada a recaudar, retener, informar o gestionar determinados impuestos, podrá hacerlo conforme a la legislación aplicable. El Vendedor deberá proporcionar la información necesaria.' },
    ] },
    { n: '25', title: 'Garantía y conformidad', blocks: [
      { type: 'p', text: 'El Vendedor será responsable frente al consumidor de las obligaciones legales relativas a la conformidad de los Productos vendidos.' },
      { type: 'note', text: 'Que la venta se haya realizado mediante una compra colectiva no reduce ni elimina los derechos legales del consumidor.' },
      { type: 'p', text: 'Deberá atender las reclamaciones relacionadas con falta de conformidad, defectos, funcionamiento, características no coincidentes, garantías y obligaciones legales asociadas al Producto.' },
    ] },
    { n: '26', title: 'Derecho de desistimiento', blocks: [
      { type: 'p', text: 'Cuando legalmente corresponda, el consumidor tendrá derecho a desistir de la compra dentro del plazo legalmente establecido. El Vendedor deberá aceptar y gestionar las devoluciones que correspondan.' },
      { type: 'p', text: 'No podrá imponer restricciones contrarias a la legislación aplicable. Cuando exista una excepción legal al derecho de desistimiento, deberá comunicarla a Gropo antes de publicar la oferta.' },
    ] },
    { n: '27', title: 'Devoluciones', blocks: [
      { type: 'p', text: 'El Vendedor será responsable de las devoluciones derivadas del ejercicio válido de derechos del consumidor, salvo que Gropo asuma expresamente determinada función.' },
      { type: 'p', text: 'No podrá establecer mediante sus condiciones particulares una política menos favorable que los derechos mínimos reconocidos legalmente al consumidor.' },
    ] },
    { n: '28', title: 'Productos defectuosos', blocks: [
      { type: 'p', text: 'Cuando un Producto sea defectuoso o no conforme con el contrato, el Vendedor deberá proporcionar la solución legalmente correspondiente: reparación, sustitución, reducción del precio, resolución del contrato, reembolso o cualquier otra prevista legalmente.' },
    ] },
    { n: '29', title: 'Atención al cliente', blocks: [
      { type: 'p', text: 'El Vendedor deberá disponer de un canal de contacto válido para atender incidencias relacionadas con los Productos vendidos.' },
      { type: 'p', text: 'Gropo podrá actuar como primer punto de contacto cuando así se haya establecido. El Vendedor deberá responder a las solicitudes trasladadas por Gropo dentro de un plazo razonable.' },
    ] },
    { n: '30', title: 'Reclamaciones', blocks: [
      { type: 'p', text: 'El Vendedor deberá colaborar de buena fe en la resolución de reclamaciones y no podrá ignorar, rechazar o retrasar injustificadamente una reclamación legítima de un consumidor.' },
      { type: 'p', text: 'Cuando Gropo solicite información para investigar una incidencia, el Vendedor deberá proporcionarla.' },
    ] },
    { n: '31', title: 'Productos ilegales o inseguros', blocks: [
      { type: 'p', text: 'El Vendedor no podrá ofrecer Productos cuya venta esté prohibida o restringida cuando no disponga de las autorizaciones necesarias.' },
      { type: 'p', text: 'Si Gropo recibe información que indique que un Producto puede ser ilegal, peligroso o incumplir la normativa, podrá suspender temporalmente la oferta mientras investiga y, cuando resulte necesario, retirarla y adoptar las medidas legalmente exigibles.' },
    ] },
    { n: '32', title: 'Propiedad intelectual', blocks: [
      { type: 'p', text: 'El Vendedor declara disponer de los derechos necesarios para utilizar las fotografías, vídeos, textos, marcas, logotipos, diseños y documentación que proporcione a Gropo.' },
      { type: 'p', text: 'Autoriza a Gropo a utilizar dichos materiales en la medida necesaria para mostrar, promocionar y operar la oferta dentro de la Plataforma, y será responsable de cualquier reclamación derivada de la utilización no autorizada de contenidos de terceros.' },
    ] },
    { n: '33', title: 'Promoción de las ofertas', blocks: [
      { type: 'p', text: 'Gropo podrá mostrar y promocionar las ofertas dentro de la Plataforma, newsletters, comunicaciones, redes sociales, campañas publicitarias y otros canales de marketing propios.' },
      { type: 'p', text: 'El Vendedor podrá establecer restricciones razonables cuando existan razones legales o contractuales para ello.' },
    ] },
    { n: '34', title: 'Posicionamiento de las ofertas', blocks: [
      { type: 'p', text: 'Gropo podrá determinar la forma en que las ofertas aparecen dentro de la Plataforma, considerando entre otros factores relevancia, disponibilidad, actividad, progreso, precio, cercanía a un nuevo tramo, popularidad, comportamiento de los usuarios, fecha, filtros y campañas promocionales.' },
      { type: 'p', text: 'Cuando legalmente sea exigible, Gropo proporcionará información sobre los principales parámetros utilizados.' },
    ] },
    { n: '35', title: 'Reseñas y valoraciones', blocks: [
      { type: 'p', text: 'Gropo podrá permitir que los Compradores valoren Productos y Vendedores. Las valoraciones deberán reflejar experiencias reales.' },
      { type: 'p', text: 'El Vendedor no podrá comprar valoraciones falsas, manipular valoraciones, amenazar a usuarios para modificar opiniones, publicar valoraciones falsas sobre sí mismo ni utilizar incentivos fraudulentos para obtenerlas.' },
    ] },
    { n: '36', title: 'Comportamiento del Vendedor', blocks: [
      { type: 'p', text: 'El Vendedor deberá utilizar Gropo de forma lícita y de buena fe. No podrá:' },
      { type: 'list', items: ['manipular el volumen de los Grupos;', 'crear compradores ficticios;', 'utilizar cuentas fraudulentas;', 'alterar artificialmente los tramos de precio;', 'publicar información falsa;', 'intentar sacar a los compradores de Gropo para evitar las comisiones;', 'utilizar la Plataforma para actividades ilícitas;', 'manipular reseñas;', 'eludir medidas de seguridad.'] },
    ] },
    { n: '37', title: 'Manipulación del volumen', blocks: [
      { type: 'p', text: 'El Vendedor no podrá crear, directa o indirectamente, participaciones ficticias destinadas a provocar artificialmente la consecución de un tramo de precio.' },
      { type: 'p', text: 'Gropo podrá excluir operaciones fraudulentas del cálculo del volumen y recalcular el resultado del Grupo cuando esa exclusión modifique el tramo alcanzado.' },
    ] },
    { n: '38', title: 'Operaciones fuera de Gropo', blocks: [
      { type: 'p', text: 'Cuando un Comprador haya sido captado mediante Gropo, el Vendedor no podrá utilizar la información obtenida a través de la Plataforma para eludir deliberadamente el sistema de contratación o las comisiones acordadas.' },
      { type: 'p', text: 'Las restricciones concretas y su duración se establecerán en el acuerdo comercial entre Gropo y el Vendedor.' },
    ] },
    { n: '39', title: 'Comisiones de Gropo', blocks: [
      { type: 'p', text: 'Gropo podrá cobrar al Vendedor una comisión por los servicios prestados. El porcentaje o importe aplicable será el indicado en el acuerdo comercial, plan contratado o condiciones económicas vigentes.' },
      { type: 'p', text: 'Salvo acuerdo contrario, las comisiones podrán calcularse sobre el importe de las ventas ejecutadas y deducirse de las liquidaciones cuando así se haya acordado previamente.' },
    ] },
    { n: '40', title: 'Liquidación al Vendedor', blocks: [
      { type: 'p', text: 'La liquidación se realizará conforme al calendario y condiciones establecidos entre Gropo y el Vendedor, y podrá estar condicionada a:' },
      { type: 'list', items: ['confirmación del pago;', 'ausencia de fraude;', 'envío;', 'entrega;', 'vencimiento de determinados períodos;', 'devoluciones;', 'contracargos;', 'otras circunstancias previstas contractualmente.'] },
      { type: 'p', text: 'Gropo podrá retener temporalmente cantidades cuando resulte necesario para gestionar riesgos de fraude, devoluciones, contracargos u otras obligaciones legítimas.' },
    ] },
    { n: '41', title: 'Contracargos', blocks: [
      { type: 'p', text: 'Cuando una operación sea objeto de un contracargo o reversión de pago, Gropo podrá repercutir al Vendedor el importe correspondiente cuando el motivo esté relacionado con una obligación o responsabilidad suya. Las condiciones concretas se establecerán en el acuerdo económico.' },
    ] },
    { n: '42', title: 'Fraude', blocks: [
      { type: 'p', text: 'Gropo podrá aplicar controles destinados a detectar operaciones fraudulentas y suspender o cancelar operaciones cuando existan indicios razonables de fraude, uso indebido, manipulación, robo de identidad, medios de pago comprometidos o abuso de promociones.' },
      { type: 'p', text: 'Estas medidas podrán adoptarse incluso cuando el Producto haya sido reservado pero todavía no enviado.' },
    ] },
    { n: '43', title: 'Incumplimiento del Vendedor', blocks: [
      { type: 'p', text: 'Se considerará incumplimiento, entre otros:' },
      { type: 'list', items: ['no entregar un Producto vendido;', 'vender Productos inexistentes;', 'falsear stock;', 'alterar precios después de la participación;', 'enviar un Producto diferente;', 'vender Productos falsificados;', 'incumplir garantías;', 'incumplir derechos de consumidores;', 'proporcionar información falsa;', 'manipular Grupos;', 'utilizar fraudulentamente la Plataforma.'] },
    ] },
    { n: '44', title: 'Suspensión de ofertas', blocks: [
      { type: 'p', text: 'Gropo podrá suspender una oferta cuando exista una razón objetiva relacionada con seguridad, legalidad, fraude, falta de stock, incumplimiento, reclamaciones, información incorrecta o funcionamiento técnico.' },
      { type: 'p', text: 'La suspensión podrá afectar a nuevas participaciones sin perjuicio de los derechos que correspondan a compradores que ya hayan formalizado una compra.' },
    ] },
    { n: '45', title: 'Cancelación de la cuenta del Vendedor', blocks: [
      { type: 'p', text: 'Gropo podrá suspender o cancelar la cuenta de un Vendedor cuando exista un incumplimiento grave o reiterado de estas Condiciones o de la legislación aplicable.' },
      { type: 'p', text: 'La cancelación no extinguirá las obligaciones que, por su naturaleza, deban continuar después de la terminación de la relación.' },
    ] },
    { n: '46', title: 'Efectos de la terminación', blocks: [
      { type: 'p', text: 'La terminación de la relación no afectará automáticamente a las compraventas ya formalizadas. El Vendedor seguirá obligado respecto de dichas operaciones en cuanto a:' },
      { type: 'list', items: ['entrega;', 'garantía;', 'devoluciones;', 'desistimiento;', 'atención al cliente;', 'reembolsos;', 'obligaciones fiscales.'] },
    ] },
    { n: '47', title: 'Información y auditoría', blocks: [
      { type: 'p', text: 'Gropo podrá solicitar al Vendedor documentación necesaria para verificar el cumplimiento de sus obligaciones, y el Vendedor deberá colaborar razonablemente.' },
      { type: 'p', text: 'Cuando exista una obligación legal de conservación de información, ambas partes conservarán los registros correspondientes durante el período exigido.' },
    ] },
    { n: '48', title: 'Protección de datos', blocks: [
      { type: 'p', text: 'El Vendedor solo podrá utilizar los datos personales de los Compradores para finalidades legítimas relacionadas con la ejecución de la compraventa y conforme a la legislación aplicable.' },
      { type: 'p', text: 'No podrá utilizarlos para marketing no autorizado, venta de bases de datos, comunicaciones ajenas a la operación, elaboración ilícita de perfiles ni cualquier otra finalidad incompatible.' },
    ] },
    { n: '49', title: 'Comunicaciones', blocks: [
      { type: 'p', text: 'Gropo podrá comunicarse con el Vendedor mediante correo electrónico, la Plataforma, el panel de vendedor, notificaciones u otros medios de contacto proporcionados. El Vendedor deberá mantener al menos un canal de contacto operativo.' },
    ] },
    { n: '50', title: 'Cambios en las Condiciones', blocks: [
      { type: 'p', text: 'Gropo podrá modificar estas Condiciones para futuras operaciones. Las modificaciones sustanciales serán comunicadas cuando legalmente corresponda.' },
      { type: 'p', text: 'Las condiciones aplicables a operaciones ya formalizadas no podrán modificarse unilateralmente cuando ello perjudique derechos adquiridos u obligaciones contractuales existentes.' },
    ] },
    { n: '51', title: 'Responsabilidad del Vendedor', blocks: [
      { type: 'p', text: 'El Vendedor será responsable de los daños, reclamaciones, sanciones o costes derivados de su incumplimiento de estas Condiciones, de la legislación aplicable, de los derechos de los consumidores, de las obligaciones fiscales, de las obligaciones relativas a los Productos o de los derechos de propiedad intelectual de terceros.' },
      { type: 'p', text: 'Esta responsabilidad se entenderá sin perjuicio de las limitaciones legalmente aplicables.' },
    ] },
    { n: '52', title: 'Relación independiente', blocks: [
      { type: 'p', text: 'La relación entre Gropo y el Vendedor no constituye, salvo pacto expreso, sociedad, agencia, relación laboral, franquicia ni representación comercial exclusiva. El Vendedor actuará como empresario independiente.' },
    ] },
    { n: '53', title: 'Legislación aplicable', blocks: [
      { type: 'p', text: 'Estas Condiciones se regirán por la legislación española, sin perjuicio de las normas imperativas que puedan resultar aplicables al Vendedor por razón de su domicilio o actividad.' },
    ] },
    { n: '54', title: 'Jurisdicción', blocks: [
      { type: 'p', text: 'Las controversias entre Gropo y Vendedores Profesionales se someterán a los juzgados y tribunales que resulten competentes conforme a la legislación aplicable.' },
      { type: 'p', text: 'Cuando la legislación permita pactar jurisdicción entre empresarios, podrá establecerse la correspondiente sumisión expresa en el acuerdo comercial.' },
    ] },
    { n: '55', title: 'Aceptación', blocks: [
      { type: 'p', text: 'Antes de comenzar a utilizar las funcionalidades destinadas a Vendedores Profesionales, el Vendedor deberá aceptar estas Condiciones. La aceptación podrá quedar registrada electrónicamente.' },
      { type: 'p', text: 'El registro de aceptación podrá incluir identidad del Vendedor, fecha y hora, versión de las Condiciones, dirección IP u otros registros técnicos e información adicional necesaria para acreditarla.' },
    ] },
    { n: '56', title: 'Prevalencia de las condiciones particulares', blocks: [
      { type: 'p', text: 'Las condiciones particulares de una oferta podrán establecer reglas específicas respecto de Producto, stock, tramos, precio, volumen mínimo, volumen máximo, duración, envío y restricciones.' },
      { type: 'p', text: 'En caso de contradicción prevalecerán únicamente respecto de aquellos aspectos que regulen expresamente, siempre que sean compatibles con estas Condiciones y con la legislación aplicable.' },
    ] },
    { n: '57', title: 'Contacto', blocks: [
      { type: 'list', items: ['[RAZÓN SOCIAL]', 'Domicilio: [DOMICILIO]', 'Email: [EMAIL]', 'NIF/CIF: [NIF]', 'Registro mercantil: [REGISTRO MERCANTIL]'] },
    ] },
    { title: 'Anexo I — Información mínima para publicar una oferta', blocks: [
      { type: 'p', text: 'Producto: nombre, descripción, características, imágenes, marca y modelo cuando corresponda.' },
      { type: 'p', text: 'Precio: precio de cada tramo, volumen correspondiente a cada tramo, impuestos y gastos adicionales.' },
      { type: 'p', text: 'Disponibilidad: stock, máximo de unidades y restricciones por comprador.' },
      { type: 'p', text: 'Ejecución: volumen mínimo, condiciones de ejecución, plazo de preparación y condiciones de envío.' },
      { type: 'p', text: 'Consumidor: garantía, devoluciones, desistimiento y excepciones legales cuando correspondan.' },
      { type: 'note', text: 'Gropo podrá impedir la publicación de una oferta que no contenga la información obligatoria.' },
    ] },
    { title: 'Anexo II — Regla económica de la compra colectiva', blocks: [
      { type: 'p', text: 'Demanda agregada → tramo alcanzado → precio final. El Vendedor deberá respetar el precio final resultante.' },
      { type: 'p', text: 'Cuando el Comprador haya establecido un precio máximo: si el precio final es menor o igual, la operación es ejecutable; si es mayor, no lo es para ese Comprador.' },
      { type: 'p', text: 'Cuando la operación sea ejecutable y el pago haya sido previamente autorizado: autorización máxima → precio final → captura del importe final.' },
      { type: 'p', text: 'El Vendedor no podrá cobrar al Comprador una cantidad superior al precio final correspondiente a la oferta, salvo conceptos adicionales previamente comunicados y legalmente aplicables.' },
    ] },
  ],
}

export default doc
