# UX_TEST_DATASET.md — entorno de pruebas para la auditoría heurística

**Creado el 13 de septiembre de 2026.** 15 grupos en producción diseñados para que cada uno
ponga a prueba una hipótesis de UX concreta. No son datos de relleno.

---

## ⚠️ ANTES DE NADA

**No cierres ninguno de estos grupos desde el admin.** Los miembros son ficticios y **no tienen
`PaymentIntent`**: cerrar intentaría capturar pagos que no existen. Todos llevan el prefijo
`dd000000-` para que sean inconfundibles.

**Están visibles en la home** (`is_demo = false`). Decisión tuya del 13-sep: sin eso no se puede
auditar el listado, ni las tarjetas, ni los carruseles, ni la jerarquía del catálogo.

**Las fotos son de tiendas reales, enlazadas desde su CDN.** Comprobado: las 15 cargan desde
`gropo.es` (ninguna tiene protección de hotlink). Dos cosas que conviene tener presentes:
son imágenes con derechos de la marca o del retailer, y viven en un servidor ajeno que puede
cambiarlas o retirarlas sin avisar. Para un dataset temporal que borramos al terminar es un
riesgo pequeño, pero **no es material para producción**: cuando haya catálogo de verdad, las
fotos las tiene que aportar el vendedor. Cada URL de origen está guardada en `groups.product_url`
para poder sustituirla.

### Borrarlo todo

```sql
delete from groups where id::text like 'dd000000-%';
```

Las claves ajenas van en cascada: se llevan pujas, miembros y eventos. Una sola línea.

---

## RESUMEN

| # | Producto | PVP | Precio hoy | Siguiente | Uds. | Stock libre | Cierra | Caso |
|---|----------|-----|-----------|-----------|------|-------------|--------|------|
| 01 | Casco Giro Aries Spherical | 329,99 € | **289 €** | 259 € | 2 | 58 | 6 d | **A** · recién creado, sin activar |
| 02 | Zapatillas Shimano RC503 | 159,99 € | **119 €** | 99 € | 12 | 68 | 4 d | **B** · en progreso |
| 03 | Garmin Edge 840 Solar | 599,99 € | **449 €** | 419 € | 10 | 30 | 2 d | **C** · faltan 2 para el tramo |
| 04 | Maillot Castelli Entrata VI | 79,95 € | **49,95 €** | 42,95 € | 18 | 102 | 5 d | **D+E** · tramo 1 conseguido, producto barato |
| 05 | Rodillo Wahoo KICKR CORE | 599,99 € | **449 €** | — | 22 | 13 | 1 d | **F** · mejor precio, no queda nada |
| 06 | Gafas Oakley Sutro Lite Sweep | 197 € | **89 €** | — | 18 | **2** | 3 d | **G** · stock crítico |
| 07 | Bicicleta Orbea Orca M30 | 2.599 € | **1.849 €** | 1.749 € | 6 | **144** | 6 d | **H** · stock de sobra, tramo lejos |
| 08 | Sillín Fizik Antares R3 | 139 € | **99 €** | 85 € | 11 | 39 | 4 d | **I** · tú estás esperando |
| 09 | Grupo Shimano 105 Di2 | 1.846 € | **1.499 €** | 1.399 € | 15 | **1** | **9 h** | **J** · extremo |
| 10 | Cámara Continental TPU | 29,95 € | **17,95 €** | 14,95 € | 57 | 343 | 5 d | Precio bajo, varias unidades |
| 11 | Ruedas Zipp 303 S | 1.100 € | **819 €** | 799 € | 12 | 48 | 5 d | **Dos vendedores** compitiendo |
| 12 | Specialized Diverge E5 | 1.549 € | — | — | 0 | — | 6 d | Petición **sin vendedor** |
| 13 | Culote Assos Mille GT | 320 € | **255 €** final | — | 14 | — | cerrado | **Cerrado con éxito** |
| 14 | Chaqueta GOREWEAR Shakedry | 329,95 € | — | — | 0 | — | cancelado | **Cancelado** por mínimo |
| 15 | Pedales Favero Assioma Duo | 799 € | **579 €** final | — | 16 | **−4** | excedente | **Excedente**: 16 pedidas, 12 de stock |

URL de cada uno: `https://www.gropo.es/grupo/dd000000-0000-4000-8000-0000000000NN`
(`NN` = el número de la tabla, con cero delante).

Los estados no están puestos a mano: salen de la composición real de miembros y pujas, así que
`compute_price`, `tier_demand` y `group_committed_units` los calculan igual que en producción.
Verificado grupo a grupo contra el diseño.

---

## LAS FICHAS

### G01 · Casco Giro Aries Spherical MIPS
**Situación.** Nació hace 15 horas. Dos compradores. El primer tramo pide 5 unidades y la
ejecución mínima son 5. Ni el tramo más caro está desbloqueado.
**Estado.** A — recién creado, sin activar.
**Qué debería entender el usuario.** Que este grupo **todavía no existe de verdad**: que si no
entra más gente no se compra nada, y que 289 € es una expectativa, no una garantía.
**Qué queremos comprobar.** Si la interfaz distingue "precio del tramo que aún no está
desbloqueado" de "precio que tienes hoy". `compute_price` tiene un **fallback**: cuando no hay
ningún tramo desbloqueado devuelve el precio del tramo de menor `min_units` igualmente. Así que
la web dirá **289 €** aunque ese tramo esté cerrado.
**Riesgo de UX.** Que el visitante lea 289 € como precio asegurado y se lleve la sorpresa al
cierre. Es la mentira más cara posible: la que descubres cuando ya has puesto la tarjeta.
**Pone a prueba.** La caja de precio, el badge "Precio asegurado", el concepto de *activación*
(`min_execution`), la barra de progreso vacía y el estado de la tarjeta en la home.

### G02 · Zapatillas Shimano RC503 Wide
**Situación.** 8 compradores firmes y 4 esperadores apuntando a 99 €. Al tramo de 99 € le faltan
8 unidades.
**Estado.** B — en progreso, el siguiente tramo a media distancia.
**Qué debería entender el usuario.** Que hoy son 119 €, que hay 12 personas dentro y que con 8
más bajaría a 99 €.
**Qué queremos comprobar.** Si el usuario entiende **cuánto falta y para qué**, y si distingue
las 12 unidades comprometidas de las 8 que cuentan para el precio de hoy.
**Riesgo de UX.** Que convivan dos números de "gente" sin explicar cuál es cuál.
**Pone a prueba.** El progreso hacia el siguiente tramo, el contador de participantes, la
diferencia entre demanda comprometida y demanda efectiva.

### G03 · Garmin Edge 840 Solar
**Situación.** Faltan **2 unidades** para 419 €. Cierra en 2 días. Producto de 600 € de PVP.
**Estado.** C — el tramo está a punto de caer.
**Qué debería entender el usuario.** Que su compra, sola, casi lo desbloquea; y que si compra 2
lo desbloquea del todo, para todos.
**Qué queremos comprobar.** Si la interfaz **comunica la oportunidad** o la entierra. Es el
momento de máxima palanca de todo el modelo: el usuario puede cambiar el precio de los demás.
**Riesgo de UX.** Desaprovecharlo. Si "faltan 2" está en gris de 12 px debajo de una barra,
se pierde el único momento en que compartir el enlace tiene sentido evidente.
**Pone a prueba.** El mensaje de "faltan N", el selector de cantidad como palanca, el copy
persuasivo (aquí sí aporta), el botón de compartir.

### G04 · Maillot Castelli Entrata VI
**Situación.** 18 compradores, tramo 1 conseguido, 15 de ejecución mínima superados. Producto de
79,95 € con precio de grupo de 49,95 €. Precios con decimales.
**Estado.** D + E — el primer tramo está conseguido y es el vigente.
**Qué debería entender el usuario.** Que 49,95 € ya es suyo si compra, y que el siguiente escalón
está a 7 unidades.
**Qué queremos comprobar.** Dos cosas: si "conseguido" se lee como conseguido, y si el ahorro
(30 €) se comunica bien en un producto barato. Y cómo se ven los **decimales** en todos los
tamaños de texto.
**Riesgo de UX.** Que el porcentaje y el importe absoluto se peleen. 30 € sobre 79,95 € es un 37 %,
que suena mejor que "30 €"; en el G07 pasa justo lo contrario.
**Pone a prueba.** Formato monetario con decimales, el badge de ahorro, el estado "tramo
conseguido", la jerarquía cuando el precio es de dos cifras.

### G05 · Rodillo Wahoo KICKR CORE
**Situación.** 22 unidades, los tres tramos desbloqueados. **No hay siguiente precio.** Cierra
mañana.
**Estado.** F — mejor precio alcanzado.
**Qué debería entender el usuario.** Que esto ya no va a bajar más y que lo único que queda es
decidir.
**Qué queremos comprobar.** Cómo cambia la jerarquía visual cuando **desaparece la zanahoria**.
Toda la interfaz está construida alrededor de "faltan X para bajar a Y". Aquí no falta nada.
**Riesgo de UX.** Que la pantalla se quede sin argumento. El CTA pierde su motor y el único
resorte que queda es el cierre — que además es mañana.
**Pone a prueba.** La barra de progreso al 100 %, el hueco donde vivía "faltan N", la cuenta
atrás como argumento sustituto, el CTA sin urgencia de precio.

### G06 · Gafas Oakley Sutro Lite Sweep
**Situación.** **Quedan 2 unidades.** Y además el mejor precio ya está conseguido. Ahorro del
55 % sobre PVP.
**Estado.** G — stock crítico.
**Qué debería entender el usuario.** Que quedan 2 y que el precio ya no baja más: dos urgencias
distintas a la vez.
**Qué queremos comprobar.** Si conviven **escasez de stock** y **precio tope** sin canibalizarse.
Y si el selector de cantidad topa en 2 (debe: `prepare_join` rechaza a partir de 3).
**Riesgo de UX.** Apilar dos mensajes de urgencia y que ninguno se lea. O peor: que el usuario
confunda "quedan 2 unidades" con "faltan 2 para el descuento".
**Pone a prueba.** El badge de stock, el tope del selector, la convivencia de dos urgencias, el
estado "no hay más tramos".

### G07 · Bicicleta Orbea Orca M30
**Situación.** 6 compradores, **144 unidades libres**, y al siguiente tramo le faltan 9. Ticket de
1.849 € con 750 € de ahorro sobre PVP.
**Estado.** H — stock de sobra, demanda escasa.
**Qué debería entender el usuario.** Que hay sitio de sobra **no significa** que el grupo vaya
bien. Lo que falta es gente, no unidades.
**Qué queremos comprobar.** Si la interfaz separa las dos ideas. Es la confusión conceptual más
peligrosa del producto: *stock disponible* ≠ *demanda necesaria*.
**Riesgo de UX.** Que "quedan 144" se lea como señal de salud y el usuario no entienda por qué
debería invitar a nadie.
**Pone a prueba.** La convivencia de stock y demanda en la misma pantalla, el ahorro absoluto
grande (750 €) frente al relativo modesto (29 %), la maquetación con precios de 4 cifras.

### G08 · Sillín Fizik Antares R3 — **este es el tuyo**
**Situación.** Eres uno de los 6 esperadores apuntando a 85 €. Al tramo le **falta 1 unidad**.
Hoy el grupo está a 99 €.
**Estado.** I — el usuario está esperando.
**Qué debería entender el usuario.** Que su dinero está retenido, que su precio es 85 €, que no
pagará si no se llega, y que **falta una sola unidad**.
**Qué queremos comprobar.** Qué le cuenta la web a alguien que ya está dentro y esperando.
Este es el estado peor cubierto de todo el producto.
**Riesgo de UX.** Que el esperador no encuentre en ningún sitio cuánto falta *para su precio* —
distinto de cuánto falta para el siguiente tramo del grupo. Y que no sepa qué puede hacer:
¿esperar? ¿invitar? ¿cambiar a comprar ahora?
**Pone a prueba.** `/mis-grupos`, `/notificaciones`, el estado de espera en la ficha, la acción
disponible para quien ya está dentro.
**Nota:** entra con tu cuenta (`thedesignerux@gmail.com`) para verlo. Con sesión cerrada eres un
visitante más.

### G09 · Grupo Shimano 105 Di2 R7100 — **el caso extremo**
**Situación.** Todo a la vez:
- **4 tramos** (1.699 / 1.599 / 1.499 / 1.399 €)
- precio vigente **1.499 €**, potencial **1.399 €**
- **falta 1 unidad** para el último tramo
- **queda 1 unidad** de stock
- cierra en **9 horas**
- 15 compradores dentro, 6 de ellos esperando a 1.499 €

O sea: **el próximo comprador desbloquea el mejor precio para todos y agota el stock a la vez.**
Su unidad vale 1.399 €, no 1.499 €.
**Estado.** J — extremo.
**Qué debería entender el usuario.** Que si compra ahora paga 1.399 €, no 1.499 €. Que es la
última unidad. Que quedan 9 horas.
**Qué queremos comprobar.** Si la interfaz **sigue siendo legible** cuando confluyen cuatro
condiciones. Y sobre todo: si el precio que se anuncia es el que va a pagar.
**Riesgo de UX.** Que enseñe 1.499 € (el precio del grupo hoy) en vez de 1.399 € (el precio con
su unidad dentro). Sería un error a favor del comprador, pero un error. O que tres avisos de
urgencia compitan y no se lea ninguno.
**Pone a prueba.** Todo a la vez: escalera de 4 tramos en móvil, precio proyectado frente a
precio vigente, stock de 1, cuenta atrás en horas, y la coherencia entre las cuatro cosas.

### G10 · Cámara Continental TPU 28"
**Situación.** Producto de 25,95 €. 20 compradores con 2, 3 y 4 unidades cada uno, 57 en total.
Segundo tramo conseguido. Al siguiente le faltan 63 unidades. **Único grupo sin envío incluido.**
**Estado.** Precio bajo, compra multiunidad.
**Qué debería entender el usuario.** Que aquí se compra por packs y que el ahorro por unidad es
de 12 €, pero el envío se paga aparte.
**Qué queremos comprobar.** Si la interfaz aguanta cifras pequeñas y cantidades grandes. Si el
tope de 10 unidades por comprador tiene sentido en un consumible. Y qué pasa con el envío cuando
`shipping_included = false`, que **no se ha visto nunca**.
**Riesgo de UX.** Que "ahorras 12 €" en un producto de 26 € no compense la fricción de un
checkout con tarjeta. Y que faltar 63 unidades desmotive en vez de motivar.
**Pone a prueba.** El selector de cantidad con números altos, el formato de precios de 2 cifras
con decimales, la ausencia de "envío incluido", el ahorro absoluto pequeño.

### G11 · Par de ruedas Zipp 303 S — **dos vendedores**
**Situación.** Dos pujas activas de vendedores distintos, con escaleras distintas:
- Dromosport: 1→869 €, 20→799 €
- Deacatlon: 1→849 €, 10→819 €, 30→749 €

La escalera pública es la **fusión** de ambas: 1→849, 10→819, 20→799, 30→749. Precio vigente
819 € (de Deacatlon). Y **el siguiente precio, 799 €, es de Dromosport.**
**Estado.** Competencia entre vendedores.
**Qué debería entender el usuario.** Que el precio baja porque hay vendedores compitiendo. O
quizá no debería: RULE-045 dice que el vendedor es anónimo hasta el cierre.
**Qué queremos comprobar.** Este es el corazón del modelo de Gropo — *competencia entre
vendedores* — y **nunca se ha visto en pantalla**. El stock que se enseña es el de la puja
ganadora (60), no la suma. El siguiente tramo lo pone otro vendedor.
**Riesgo de UX.** Que la escalera fusionada sea incomprensible. Que el usuario asuma que el stock
mostrado es el total disponible. Que si la puja ganadora cambia, el stock "salte" sin explicación.
**Pone a prueba.** La escalera fusionada, el anonimato del vendedor, de dónde sale el `max_stock`,
la coherencia cuando el siguiente tramo es de otro vendedor.

### G12 · Bicicleta gravel Specialized Diverge E5
**Situación.** Una petición sin ninguna puja. Nadie la ha atendido.
**Estado.** Sin vendedor.
**Qué debería entender el usuario.** Que alguien pidió esto y estamos buscando vendedor.
**Qué queremos comprobar.** Que la home **lo filtra y no aparece** (necesita puja para tener
precio). Alguien pidió un producto y su petición es invisible en toda la web.
**Riesgo de UX.** El que pidió el producto no tiene forma de ver que su petición existe. Y no hay
demanda visible que sirva para negociar con una marca — que era justo el argumento de
`/crear-peticion`.
**Pone a prueba.** El filtrado de la home, la ficha directa de un grupo sin precio, el circuito
completo de peticiones.
**Nota:** existe ya un caso real así en producción por accidente (`bf117565-…`).

### G13 · Culote Assos Mille GT GTO C2
**Situación.** Cerrado hace 2 días a 255 €. 14 compradores, todos pagados.
**Estado.** Cerrado con éxito.
**Qué debería entender el usuario.** Si compró: qué pasó, cuánto pagó y cuándo llega. Si llega
nuevo: que esto ya pasó y si habrá otro.
**Qué queremos comprobar.** El después. Toda la interfaz está diseñada para el antes.
**Riesgo de UX.** Que un grupo cerrado se vea igual que uno abierto con el botón apagado. Y que
no haya ninguna vía de "avísame si se repite", que es el momento de máxima intención de compra.
**Pone a prueba.** La ficha en estado cerrado, `/mis-grupos` para un comprador adjudicado, el
seguimiento del envío, la captación de demanda para la siguiente ronda.

### G14 · Chaqueta GOREWEAR Race Shakedry
**Situación.** Cancelado ayer: 5 unidades para una ejecución mínima de 12. Los 5 holds liberados.
**Estado.** Cancelado por no alcanzar el mínimo.
**Qué debería entender el usuario.** Que no se compró nada, que no se le ha cobrado y que su
retención ya está liberada.
**Qué queremos comprobar.** El peor momento de la experiencia. **Y hoy no está cubierto:**
`sendClosePaymentEmails` solo escribe a `instructed` y `paid`, así que a estos 5 **no les avisa
nadie** (P2-06). Su hold desaparece del banco sin una sola explicación.
**Riesgo de UX.** Un cargo que aparece y desaparece sin aviso es exactamente lo que genera una
disputa con el banco. Es el mismo razonamiento que justificó el botón de liberar (RULE-062).
**Pone a prueba.** La ficha de un grupo cancelado, `/mis-grupos` para un miembro liberado, la
comunicación del fracaso, la recuperación (¿reintentamos?).

### G15 · Pedales Favero Assioma Duo — **excedente**
**Situación.** 16 unidades pedidas para 12 de stock. 12 adjudicadas y pagadas a 579 €; **4 se
quedaron fuera** y siguen en `authorized`, sin resolver. El grupo está en `closing`, no en
`closed`.
**Estado.** Excedente.
**Qué debería entender el usuario.** Si entró: si le tocó o no. Si no le tocó: qué pasa con su
dinero.
**Qué queremos comprobar.** El estado `closing` existe en la base de datos y **no tiene diseño**.
Los 4 excedentes están en un limbo que se resuelve a mano.
**Riesgo de UX.** Cuatro personas con el dinero retenido, sin producto y sin información. El
stock libre calculado da **−4**: un número negativo que la interfaz no espera.
**Pone a prueba.** El estado `closing`, el stock negativo, la comunicación de "no te ha tocado",
`/mis-grupos` para un excedente.

---

## PERFILES DE COMPRADOR

Los perfiles no son datos: son **la lente con la que miras cada pantalla**. Cada uno muerde en un
grupo distinto. Recorre la web haciéndote la pregunta del perfil, no la tuya.

| Perfil | Su pregunta | Dónde muerde |
|--------|-------------|--------------|
| Llega por primera vez | *"¿Qué es esto y por qué el precio cambia?"* | Home → G01. El grupo más vacío es el peor sitio para entender el modelo, y es donde caerá mucho tráfico frío |
| Quiere el mejor precio posible | *"¿Cuánto puede llegar a bajar y qué tiene que pasar?"* | G07 (falta gente) y G10 (falta muchísima) |
| Quiere comprar ya, no ahorrar | *"¿Puedo llevármelo hoy y a cuánto?"* | G05 y G06: precio tope, sin espera. ¿Le queda claro que no gana nada esperando? |
| Espera a que baje | *"¿Y si no llega a mi precio?"* | G08 con tu sesión. Es el perfil peor atendido del producto |
| Necesita varias unidades | *"¿Me sale mejor por volumen? ¿Cuántas puedo pedir?"* | G10 (packs) y G06 (solo quedan 2) |
| Llega con el grupo casi lleno | *"¿Llego a tiempo?"* | G09: 1 unidad, 9 horas |
| Llega con muy poco stock | *"¿Quedan? ¿Y si me quedo fuera?"* | G06 y G09 |
| Su compra desbloquea un tramo | *"¿Me beneficia a mí o solo a los demás?"* | G03 (faltan 2) y G09 (falta 1). **La pregunta clave de todo el modelo** |
| Llega con el mejor precio ya hecho | *"¿Me he perdido algo? ¿Pago lo mismo?"* | G05 y G06 |
| Ya compró y el grupo cerró | *"¿Cuándo llega?"* | G13 |
| Estaba dentro y no salió | *"¿Y mi dinero?"* | G14 y G15 |

---

## GUION DE RECORRIDO

Hazlo en **móvil (375 px)** primero: ahí se decide el tráfico. Después repite en escritorio.

1. **Home con sesión cerrada.** Sin tocar nada: ¿entiendes qué vende esto y por qué el precio baja?
2. **G01** — el grupo vacío. ¿Crees que 289 € es tu precio?
3. **G07** — ¿te parece que este grupo va bien o va mal? ¿Por qué?
4. **G03** — ¿te dan ganas de comprar 2 en vez de 1? ¿Te lo han pedido?
5. **G09** — el extremo. ¿Cuánto pagarías tú si compras ahora? Compruébalo contra el checkout.
6. **G06** — ¿cuántas puedes comprar? ¿Te lo dice antes de rellenar el formulario?
7. **G05** — ¿por qué comprarías hoy y no mañana?
8. **G11** — ¿de dónde sale el precio? ¿Y el stock?
9. **G10** — ¿compensa? Mira el envío.
10. **Inicia sesión** y ve a **G08**, `/mis-grupos` y `/notificaciones`.
11. **G13, G14, G15** — el final del recorrido.
12. **G12** — búscalo en la home. No está. ¿Debería?

Las preguntas de evaluación, para cada pantalla, son las que definiste: entiendo qué veo, qué
pasa, cuál es el precio, cuál puedo conseguir, cuánto falta, qué ocurre si compro, qué debo
hacer; la jerarquía prioriza bien; el copy explica o hace ruido; los estados se comunican; no hay
contradicción entre precio, stock, demanda y tramos; falta visibilidad o sobra protagonismo; y si
me fío lo bastante como para pagar.

---

## LO QUE ESTE DATASET **NO** CUBRE

Por honestidad, para que la auditoría no dé por probado lo que no lo está:

- **Los flujos con dinero real.** Nadie puede completar una compra: los miembros son ficticios y
  Stripe sigue en modo test. Se audita lo que se ve, no lo que se cobra.
- **Los emails.** Ningún grupo ha disparado un correo. El circuito de comunicación
  (confirmación, aviso de bajada, cierre, cancelación) queda fuera.
- **El tiempo pasando.** Los grupos no evolucionan solos. No se puede ver una bajada de precio en
  vivo, ni Realtime, ni el confeti al cruzar un tramo, salvo que alguien se una de verdad.
- **La cuenta atrás de más de 14 días.** `JoinFlow` tiene una rama para eso
  (`URGENCY_WINDOW_DAYS`), pero `MAX_CLOSE_WINDOW_HOURS` = 6,5 días la hace **inalcanzable**. Es
  código muerto: no hay caso que la active.
- **El vendedor.** No hay panel de vendedor. Toda la auditoría es del lado comprador.
- **Accesibilidad con lector de pantalla.** Requiere pasada aparte.

---

## HALLAZGOS QUE YA SE VEN, ANTES DE EMPEZAR

Aparecieron al montar el dataset. Los tres primeros **ya están corregidos** (13 sep 2026); el
cuarto queda para la auditoría.

1. ~~**La tarjeta destacada de la home no pinta la foto.**~~ ❌ **FALSA ALARMA.** La foto sí
   carga. La captura se hizo antes de que terminara la carga diferida. El `<img>`, la URL y los
   props eran correctos desde el principio; el recorte `object-cover` también enseña el producto
   (comprobado simulándolo sobre la imagen real). **Lo que sí era cierto** es que esa foto —la
   del hero, lo primero que se ve— llevaba `loading="lazy"`, así que durante un instante hay un
   rectángulo de color plano donde debería estar el producto. Corregido: `eager` +
   `fetchPriority="high"`. Las de los carruseles siguen en diferido, que es donde toca.

2. **«Con 11 unidades más baja a 85 €» cuando faltaba 1.** ✅ Corregido. Ver `KNOWN_ISSUES.md`
   **P2-01c**: `GropoTargetSlider` medía la distancia entre **dos escalones de la escalera**
   (12 − 1 = 11) en vez de entre la **demanda real y el escalón** (12 − 11 = 1). Solo acertaba
   cuando la demanda caía justo encima del umbral del tramo vigente. Mismo error de fondo que
   P2-01b, en otro componente.

3. **Los nombres reales se cortaban en las tarjetas.** ✅ Corregido: dos líneas en vez de una en
   la tarjeta móvil, en el carrusel de escritorio y en la tarjeta de la home de escritorio. Los
   nombres de catálogo de verdad son largos ("Grupo Shimano 105 Di2 R7100", "Par de ruedas Zipp
   303 S") y no caben en una línea de 132 px. Queda igual en `MisGruposDesktop`, que es una fila
   de lista y no una tarjeta — decidir en la auditoría si también debe cambiar.

4. **Las fotos de producto sobre fondo blanco se oscurecen** con el degradado de la tarjeta. El
   degradado está pensado para foto ambiental; el catálogo real es producto recortado sobre
   fondo claro, y el resultado es turbio. **Sin tocar** — es criterio visual y lo decides tú.
