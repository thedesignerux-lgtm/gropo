# UX_AUDIT.md — Gropo

> **Auditoría de UX/UI completa.** 13 de septiembre de 2026.
>
> **Qué se auditó:** home y escaparate, ficha de grupo, flujo de unirme y checkout, y las páginas
> de confianza (`/como-funciona`, `/ayuda`), en **móvil (375 px) y escritorio (1440 px)**, contra
> `https://www.gropo.es` en producción.
>
> **Con qué criterio:** `PRODUCT_PRINCIPLES.md`. No es mi gusto: cada hallazgo cita el principio
> que incumple o el dato medido que lo demuestra.
>
> **Cómo se pudieron ver las pantallas:** producción no tenía ningún grupo renderizable — el único
> `open` no tiene puja, así que `page.tsx:53` lo descarta y la home sale vacía. Se creó un grupo
> **DEMO** (`d0000000-0000-4000-8000-0000000000a1`, `is_demo = true`, invisible en la home, solo
> por URL directa) con puja de cuatro tramos. **Borrarlo cuando ya no haga falta** (SQL al final).

---

## RESUMEN — los cinco que importan

1. 🔴 La web promete **tres veces** que puedes salir de un grupo y recuperar la retención al
   instante. **Esa función no existe en ninguna parte del producto.** ✅ *Copy corregido el
   13-sep; la baja autoservicio queda pendiente.*
2. 🔴 La ficha saluda a un visitante que no ha tocado nada con **"¡Estás dentro!"**. No lo está.
   ✅ *Resuelto el 13-sep.*
3. 🟠 **La ficha móvil es una versión mutilada de la de escritorio**: le falta la pregunta que
   define el producto, el precio siguiente, el selector de cantidad y los tres bloques de
   confianza. El tráfico de Instagram y TikTok es casi todo móvil. 🟠 *Resuelto en parte el
   13-sep.*
4. 🟠 El **CTA principal es un botón fantasma** — relleno al 8 %, con borde. Parece una acción
   secundaria. ✅ *Resuelto el 13-sep.*
5. 🟠 La home muestra **el mismo producto hasta cuatro veces** (destacado + tres carruseles).
   Con uno o dos grupos abiertos, que es el escenario de lanzamiento, se ve como un escaparate
   vacío disfrazado. ✅ *Resuelto el 13-sep.*

---

# 🔴 CRÍTICOS — el producto promete por escrito cosas que no hace

Estos no son problemas de diseño. Son afirmaciones sobre el dinero del cliente que el sistema no
puede cumplir. Van primero porque el coste de dejarlos es una reclamación, no una conversión
perdida.

## UX-01 · "Puedes salir de un grupo en cualquier momento" — esa función no existe

> ✅ **RESUELTO por la vía del copy — 13-sep-2026.** Decisión de Benjamin: corregir los tres textos
> ahora y dejar la funcionalidad de baja como trabajo posterior. El diagnóstico se conserva abajo
> porque explica por qué se tocó el copy.

**Dónde se promete**, tres veces:

| Sitio | Texto |
|---|---|
| `src/app/como-funciona/page.tsx:25` | *"Sin compromiso — Puedes salir de un grupo antes del cierre y se libera tu retención al instante."* |
| `src/app/ayuda/page.tsx:14` | *"¿Puedo salir de un grupo? — Sí, en cualquier momento antes del cierre. Al salir se libera tu retención al instante, sin coste."* |
| Ficha de escritorio, bloque de garantías | *"Sin compromiso · Únete gratis, compra cuando quieras"* |

**Qué hay en el código.** Búsqueda en todo `src/` de `salir`, `abandonar`, `revoke`,
`leave_group`, `cancelar`: **cero resultados** que sean una acción de usuario. No hay botón, ni
endpoint, ni server action, ni RPC. `supabase/revoke_join_group.sql` invoca `join_group`, una
función que **ya no existe** (`TECHNICAL_DEBT.md` DT-01).

**Consecuencia real.** El primer cliente que escriba *"quiero salirme"* te obliga a elegir entre
cancelar el PaymentIntent a mano en Stripe o incumplir por escrito lo que dice tu propia página
de ayuda. Y *"compra cuando quieras"* es directamente lo contrario del modelo: al autorizar
quedas comprometido hasta el cierre.

**Principio que incumple.** *Transparencia absoluta · nunca debe haber sorpresas.*

**Lo que se hizo.** Los tres textos, reescritos. El hueco de *"Sin compromiso"* no se rellenó con
una versión aguada: se sustituyó por la garantía más fuerte que el motor **sí** respalda —el
invariante INV-005, PMA universal en `close_group`— y que no estaba dicha en ninguna parte.

| Sitio | Antes | Ahora |
|---|---|---|
| `como-funciona` | *Sin compromiso — Puedes salir de un grupo antes del cierre y se libera tu retención al instante.* | *Nunca pagas de más — Tú fijas el máximo que aceptas pagar y el sistema nunca lo supera. Si el grupo consigue un precio mejor, pagas menos automáticamente.* |
| `ayuda` (FAQ) | *Sí, en cualquier momento antes del cierre. Al salir se libera tu retención al instante, sin coste.* | *Al asegurar tu precio tu plaza queda comprometida hasta el cierre: es justo lo que permite a la marca conceder el descuento por volumen. Mientras tanto no se te cobra nada, y si el grupo no alcanza su objetivo la retención se libera entera. Si necesitas darte de baja, escríbenos antes del cierre y lo resolvemos contigo.* |
| Ficha escritorio | *Sin compromiso — Únete gratis, compra cuando quieras* | *Nunca pagas de más — Tú eliges tu precio máximo* |

La pregunta del FAQ **se mantiene** ("¿Puedo salir de un grupo?"): la gente la va a buscar, y es
mejor que encuentre la respuesta honesta a que no encuentre nada. La última frase promete
atención, no automatismo: cancelar un PaymentIntent a mano en Stripe es algo que sí puedes cumplir
con el volumen del MVP.

**Sigue pendiente (trabajo posterior):** la baja autoservicio. Botón en Mis grupos →
`paymentIntents.cancel` + marcar la fila. Ojo a la concurrencia: qué pasa si alguien se da de baja
mientras `close_group` está corriendo.

---

## UX-02 · "¡Estás dentro!" antes de que el usuario haya hecho nada

> ✅ **RESUELTO — 13-sep-2026.**

**Dónde.** `src/components/GropoTargetSlider.tsx:183-186`.

**Por qué pasa.** `confirmed = selIdx <= curIdx` (línea 141). Es decir: *"el tramo que hay
seleccionado en el slider ya está desbloqueado"*. **No tiene ninguna relación con ser miembro del
grupo.** Como el slider arranca en el tramo vigente, un visitante recién llegado —sin sesión, sin
haber tocado nada— lee:

> ✓ ¡Estás dentro! Aceptas pagar hasta 219 € y el grupo ya está en ese precio.

Verificado en producción sin sesión y sin membresía.

**Por qué es grave.** Dice dos cosas falsas: que está dentro y que ya ha aceptado pagar. Y deja
sin sentido el botón que hay justo debajo: si ya estoy dentro, ¿qué bloqueo? El mismo `confirmed`
alimenta el badge **"Confirmado"**, que refuerza la idea.

**Principio que incumple.** *El usuario nunca pierde el control* · *nunca debe haber sorpresas.*

**Lo que hace falta.** Separar dos conceptos que hoy comparten una variable: *"tu precio ya está
disponible"* (estado del tramo) y *"ya participas"* (membresía). El copy del primero no puede
hablar en pasado ni en primera persona del plural.

### Lo que se hizo

No se tocó la variable, se dejó de mentir con ella: el copy describe ahora **el estado del
precio**, que es lo que `confirmed` sabe de verdad.

| Estado | Antes | Ahora |
|---|---|---|
| Tramo disponible | *¡Estás dentro! Aceptas pagar hasta 219 € y el grupo ya está en ese precio. Si entran 4 uds más, bajaréis a 189 €.* | *Este precio ya está disponible. Si te unes hoy pagas 219 €, y menos si el grupo sigue creciendo. Con 4 unidades más baja a 189 €.* |
| Máximo por encima del actual | *Tu máximo es 219 €, pero gracias al grupo pagarás solo 189 €. ¡Estás dentro!* | *Tu máximo sería 219 €, pero el grupo ya está en 189 €: eso es lo que pagarías.* |
| Esperando un precio | *Reservas tu plaza como esperador: solo pagarás si…* | *Solo comprarías si el grupo baja a 189 €. Ahora está en 219 €, y cada persona que entra lo acerca.* |
| Badge (UX-11) | **Confirmado** | **Disponible** |

Todo pasa a condicional: *pagarías*, *comprarías*, *si te unes*. Ya no afirma participación ni
aceptación, y el botón de debajo recupera el sentido.

**Una corrección sobre la propuesta inicial.** Se planteó decir *"con 4 compras más"*, siguiendo
el ejemplo de `PRODUCT_PRINCIPLES.md` §5. **Sería inexacto:** lo que falta son **unidades**, y un
comprador puede pedir varias. Se dejó *"unidades"* — que no es jerga, solo español llano — en vez
de cambiar una abreviatura fea (`uds`) por un dato falso.

**"esperador"** desaparece del copy visible. Sigue en comentarios de código, que es su sitio.

---

## UX-03 · "Entrega gratis" es un texto fijo, no un cálculo

> ✅ **RESUELTO — 13-sep-2026.** Decisión de Benjamin: **lo decide el vendedor al crear los
> tramos**, y en el MVP el precio siempre incluye el envío.

**Dónde.** Badge en el checkout, junto a "En stock". Ambos hardcodeados
(`UX_AND_FLOWS.md` §6 ya lo documenta).

De los dos, el peligroso es este: **es un compromiso económico**. No existe ninguna columna, tarifa
ni cálculo de portes en todo el sistema. Si algún envío acaba con gastos, lo has anunciado gratis
en el punto de pago.

`En stock` es más leve, pero tampoco consulta `max_stock`: puede anunciar existencias de un tramo
agotado.

> ✅ **El badge de stock, resuelto el 13-sep-2026.** Ahora sale de `max_stock − total_units`: con
> stock agotado muestra **Sin stock** y el CTA se deshabilita. Antes, además, el tope del selector
> era `Math.max(1, restante)`, así que con cero unidades **seguía dejando elegir 1**: el comprador
> rellenaba el formulario entero y `prepare_join` lo rechazaba al final.
>
> **No se muestra la cifra exacta a propósito.** `total_units` solo cuenta demanda firme
> (P2-01), así que sobreestima lo que queda: un "Quedan 3" podría ser un 1 real. Al sobreestimar,
> el estado "agotado" puede llegar tarde pero nunca antes de tiempo, y de lo que llegue tarde se
> encarga `prepare_join` en el servidor. Para enseñar la cifra hace falta cerrar P2-01 antes.

### Lo que se hizo

**Primero, quitarlo.** El badge escrito a mano desapareció de las tres variantes del checkout el
mismo día. Una promesa económica sin respaldo no espera a que exista la funcionalidad.

**Después, hacerlo real.** Columna nueva `bids.shipping_included` (boolean, `NOT NULL DEFAULT
false`) y casilla en los dos formularios del admin —crear grupo y asignar vendedor—:

> ☐ **Los precios incluyen el envío a península**
> Confírmalo con el vendedor antes de marcarlo. Si lo marcas, el comprador verá "Envío incluido"
> en el pago y no se le puede cobrar nada aparte.

El checkout lee ese valor de la puja que da el mejor precio y muestra **"Envío incluido"** solo si
está marcado. Si no, no muestra nada — que es lo honesto cuando no se sabe.

**Por qué `false` por defecto**, tanto en la base de datos como en el formulario, aunque la regla
del MVP diga que el precio siempre incluye el envío: si el valor por defecto fuese `true` y
alguien olvidara desmarcarlo, volveríamos a la promesa falsa. Al revés, el olvido solo cuesta un
badge que no aparece.

**Es solo display.** `shipping_included` no entra en `compute_price`, ni en `close_group`, ni en
el importe que se retiene o se captura. Se descartaron a propósito las dos alternativas que sí
habrían tocado el camino del dinero —un importe de portes, o envío gratis a partir de N
unidades—: ambas cambian lo que se retiene y lo que se cobra, y exigirían su propio ensayo antes
de ir a live.

**Regla de producto que queda fijada:** si un vendedor no puede incluir el envío, se renegocia el
precio del tramo. No se publica un grupo con el envío aparte mientras el checkout no tenga línea
de portes ni total.

---

## UX-04 · Apple Pay y Google Pay se anuncian en el checkout y no funcionan

> ✅ **El anuncio, retirado el 13-sep-2026.** ⚠️ **P1-08 sigue abierto**: las carteras siguen sin
> funcionar. Lo que se ha arreglado es dejar de prometerlas, no hacerlas funcionar.

Confirmado en la pantalla de pago: los logos `Pay` y `G Pay` aparecen bajo el botón. El dominio no
está registrado en Stripe (comprobado el 13-sep: la lista de *payment method domains* de la cuenta
live está **vacía**; en **test es UNKNOWN** — la clave de la integración no tiene permiso para
consultar `GetPaymentMethodDomains`).

### Y hay una segunda razón, independiente de Stripe

`PayLogos` es **marcado estático**: cuatro pills fijos que no le preguntan nada al Payment
Element. Eso falla aunque el dominio estuviera registrado:

- en **Android** se anunciaba Apple Pay, que en ese teléfono es imposible;
- en **Safari / iOS** se anunciaba Google Pay;
- **sin tarjeta guardada** no aparece ninguno de los dos, se registre lo que se registre.

O sea que en la mayoría de los casos la fila prometía, en el punto de pago, algo que el comprador
no iba a ver. Basta con esta razón para retirarla; la del dominio solo la agrava.

### Lo que se hizo

Fuera los dos pills de cartera. **Se quedan VISA y Mastercard**, que sí son ciertas siempre: el
Payment Element ofrece tarjeta en todos los casos.

**Para devolverlas** (queda escrito en el propio componente): registrar el dominio en Stripe —test
y live son listas separadas—, comprobar **en un móvil real** que la cartera aparece de verdad en
el Element, y solo entonces volver a añadir los pills. No al revés.

---

# 🟠 IMPORTANTES — cuestan conversión

## UX-05 · La ficha móvil es una versión mutilada de la de escritorio

> 🟠 **PARCIALMENTE RESUELTO — 13-sep-2026.** Ver "Lo que se hizo" al final de este apartado.

Este es el hallazgo con más impacto de negocio. Misma URL, mismo grupo, dos árboles de UI
distintos (`DT-03`). Texto real extraído de ambas:

| Elemento | Escritorio | Móvil |
|---|---|---|
| **"¿Cuál es el máximo que pagarías?"** | ✅ | ❌ |
| Precio **SIGUIENTE** visible | ✅ 189 € | ❌ |
| Selector de cantidad | ✅ | ❌ |
| "Pago 100 % seguro con Stripe" | ✅ | ❌ |
| Bloque "Cuantos más, menos pagas" | ✅ | ❌ |
| Los 3 pasos de cómo funciona | ✅ | ❌ |
| Pago seguro / Sin compromiso / Devoluciones | ✅ | ❌ |

La ficha móvil completa, de arriba abajo, es: foto, título, precio, slider, una frase y el botón.
**Nada más.** No hay descripción del producto, ni quién vende, ni cuándo llega, ni qué pasa si el
grupo no sale, ni una sola frase de las que `PRODUCT_PRINCIPLES.md` §7 llama *mensajes de
confianza*.

La pregunta *"¿Cuál es el máximo que pagarías?"* es literalmente el principio rector del producto
y **solo existe en escritorio**.

**Y hay una inversión que agrava lo anterior:** todo el contenido de confianza sí está… en el
**checkout**, o sea *después* de que el usuario haya decidido. Está donde ya no hace falta y falta
donde se decide.

### Lo que se hizo (13-sep-2026)

Los bloques *"Cuantos más, menos pagas"*, los tres pasos y la fila de confianza se extrajeron de
`desktop/GroupDesktopView` a un componente nuevo, **`src/components/GroupHowAndTrust.tsx`**, que
ahora renderizan **las dos vistas**. Una sola fuente: cambiar un texto ya no puede dejar móvil y
escritorio diciendo cosas distintas — era exactamente el coste de DT-03.

Y la pregunta **"¿Cuál es el máximo que pagarías?"** se añadió sobre el slider en móvil
(`GroupLiveSection`). Es el principio rector del producto y solo existía en escritorio.

**Dos cosas de la tabla que decidí NO copiar a móvil, y por qué:**

- **El precio SIGUIENTE como cifra etiquetada.** En móvil ese dato ya aparece dos veces: en la
  escalera del slider y en el texto de debajo (*"Si entran 4 uds más, bajaréis a 189 €"*). Una
  tercera incumpliría *un dato aparece una sola vez*. Si acaso sobra una de las dos que ya hay.
- **El selector de cantidad.** En escritorio existe porque la compra se resuelve en el panel
  lateral sin cambiar de página. En móvil el CTA lleva a `/unirme`, que **ya tiene** su stepper.
  Ponerlo también en la ficha duplicaría el control y abriría la puerta a que ambos se
  desincronicen.

**Una trampa que costó una regresión, anotada para la próxima.** Al colgar los bloques como
hermano posterior de `GroupLiveSection`, **la barra de compra dejó de quedarse fija**: una barra
`sticky bottom-*` se desancla en cuanto su posición natural en el flujo queda por encima del borde
inferior, y antes funcionaba solo porque era el último elemento de la página. Detectado al
verificar en producción y corregido pasando el contenido por la prop `belowContent`, de modo que
la barra siga siendo el último hijo. **Cualquier cosa que se añada a esa pantalla tiene que ir por
esa prop, no detrás del componente.**

**Sigue pendiente:** la ficha móvil no tiene descripción de producto ni información de envío. No es
un problema de paridad con escritorio —tampoco están ahí— sino un hueco de las dos.

---

## UX-06 · El CTA principal parece un botón secundario

> ✅ **RESUELTO — 13-sep-2026.** Ver "Lo que se hizo" al final del apartado.

**Dónde.** `src/components/GroupLiveSection.tsx:186-187`.

```
border: 2px solid #024947
background: #02494714   ← el teal al 8 % de opacidad
color: #024947
```

El botón que autoriza una retención en la tarjeta —la única acción que existe en la pantalla— está
pintado como un botón fantasma. Cualquier convención visual lee eso como acción secundaria. El
contraste del texto está bien (10,3:1); el problema es la **jerarquía**, no la accesibilidad.

Debería ser sólido `brand` con texto blanco, que es exactamente el par que ya define
`tailwind.config.ts`.

**Además**, en esa pantalla el color se escribe a mano cuatro veces en vez de usar el token —
justo lo que `UX_AND_FLOWS.md` §9-bis advierte que produjo dos morados y tres naranjas.

### Lo que se hizo (13-sep-2026)

**Botón sólido** en las dos fichas, móvil (`GroupLiveSection`) y escritorio
(`GroupRightSidebar`): fondo del color del modo, texto blanco, sombra suave. Ambos pares cumplen
AA holgadamente — `#024947` sobre blanco da **10,26:1** y `#B24A00` da **5,42:1**.

El estado *"✓ Precio bloqueado"* se deja como está, en verde suave: ahí ya no hay acción que
ofrecer, es una confirmación, y el contraste entre el sólido de antes y el suave de después
refuerza que algo ha terminado.

**Los CTA de las tarjetas del escaparate NO se tocaron.** En una rejilla, el botón de cada tarjeta
es una acción entre muchas; ponerlos todos en teal sólido convertiría la home en un muro de color
y le quitaría énfasis justo a la pantalla donde el énfasis importa.

**Y el color, a una sola fuente.** La línea `const accent = confirmed ? '#024947' : '#B24A00'`
estaba copiada, idéntica, en **ocho** componentes. Ahora vive en `src/lib/brand-colors.ts`
(`BRAND`, `ACCENT_DARK`, `modeAccent()`), que refleja los tokens de `tailwind.config.ts`. Están
migrados los seis vivos; los dos restantes (`HomeProductCard`, `GroupLiveSection2c`) son huérfanos
documentados en §9.2 y no se tocan: editar código muerto solo añade ruido.

---

## UX-07 · La home enseña el mismo producto hasta cuatro veces

> ✅ **RESUELTO por umbral — 13-sep-2026.**

`GroupsGrid.tsx:63-72`: el destacado y los tres carruseles —*"Cerca del siguiente precio"*,
*"Más han bajado hoy"*, *"Gropos populares"*— se construyen todos sobre **el mismo array
`priced`**, solo que ordenado distinto. No hay ningún filtro que los haga disjuntos salvo excluir
el destacado del primero.

Con un grupo abierto, el usuario ve el mismo casco cuatro veces bajo cuatro titulares que sugieren
cuatro selecciones distintas. Con dos, igual. Ese es exactamente el escenario del lanzamiento.

**Principio que incumple.** *Un dato aparece una sola vez.*

**Lo que se hizo.** Constante `CAROUSEL_MIN = 6` en `GroupsGrid`. Por debajo de seis grupos
abiertos la home es **destacado + rejilla** ("Más grupos abiertos"); a partir de ahí vuelven los
tres carruseles. Ojo con el detalle que casi se cuela: al ocultar los carruseles había que
renderizar el resto de grupos en algún sitio, o desaparecían de la home.

**Lo que el umbral NO arregla:** por encima de seis, los tres carruseles siguen pudiendo repetir
producto, porque salen del mismo array. Hacerlos disjuntos sigue siendo el arreglo de fondo. El
umbral solo evita el caso ridículo, que es justo el del lanzamiento.

De paso, el **"Ver todas →"** de las cabeceras de carrusel era un `<span>` sin `onClick`: otro
falso botón. Retirado.

---

## UX-08 · El estado vacío de la home es lo que verá el tráfico frío

> ✅ **RESUELTO — 13-sep-2026.** Decisión de Benjamin: que esa pantalla capture la petición.

Hoy mismo, `https://www.gropo.es` en móvil muestra: titular, buscador, seis chips y —centrado en
mitad de la nada— *"No hay grupos abiertos"*. Nada más, y el resto de la pantalla en blanco.

Es la pantalla que ve alguien que llega desde un reel. No explica qué es Gropo, no ofrece ninguna
acción y no captura el interés (no hay "avísame", no hay "pide un producto").

El contraste de ese texto era **2,42:1** — corregido antes en esta misma sesión.

### Lo que se hizo

Componente nuevo, **`src/components/EmptyShowcase.tsx`**, compartido por la home móvil y la de
escritorio. Hace las tres cosas que esa pantalla no hacía:

1. **Explica el modelo** en una frase: *"Gropo junta a gente que quiere el mismo producto para
   conseguir el precio que da el volumen."*
2. **Da una acción real**: *"Pedir un producto"* → `/crear-peticion`, que ya existe y funciona.
   Crea el grupo sin puja y guarda nombre, email y teléfono.
3. **No deja marchar al visitante sin rastro.** Una visita sin catálogo deja demanda registrada,
   que es justo el argumento con el que se negocia con una marca.

**El copy promete exactamente lo mismo que la pantalla de éxito de la petición** —*"te avisamos
por email en cuanto encontremos un vendedor"*— y ni una palabra más. Es una intención de buscar,
no un compromiso de conseguirlo.

Contrastes: título `#1a1a1f` **16,62:1**, cuerpo `#57545e` **7,10:1**, botón blanco sobre `brand`
**10,26:1**.

**De paso, tres cosas más que colgaban de aquí:**

- En escritorio, sin ningún grupo, se apilaban **dos estados vacíos** — *"No hay grupos
  destacados"* arriba y *"No hay más grupos abiertos en esta categoría"* abajo. Ahora el hueco del
  destacado lleva el `EmptyShowcase` y la sección de rejilla no se renderiza.
- Ese segundo mensaje hablaba de *"esta categoría"*, que ya no existe.
- El buscador decía *"Busca un producto o categoría"*. Ahora, *"Busca un producto"*.

### Encontrado al hacerlo, no arreglado

En la cabecera de la rejilla de escritorio hay un **"Ordenar por: Recomendados"** que es un
`<span>` estático: parece un control de ordenación y no lo es. Mismo patrón que los chips y el
"Ver todas →". Pendiente.

---

# 🟡 CONSISTENCIA, COPY Y ACCESIBILIDAD

## UX-09 · Los filtros de categoría no filtran nada

> ✅ **RESUELTO retirándolos — 13-sep-2026.** Decisión de Benjamin: quitarlos hasta que haya
> catálogo que filtrar.

`GroupsGrid.tsx:44` declara `selectedCat`, línea 128 lo actualiza al pulsar… y **`filtered`
(línea 55) solo filtra por texto**. `selectedCat` no se lee en ningún sitio. Los seis chips
cambian de color y no hacen absolutamente nada.

No es un descuido menor: **no existe columna `category` en la base de datos**, así que no pueden
funcionar aunque se conecten.

*Falsos botones* está en la lista de `PRODUCT_PRINCIPLES.md` §8 de cosas a evitar.

Y la misma categoría inventada aparece dos veces más: `· Deporte` pegado a la ficha
(`grupo/[id]/page.tsx:161`) y **"← Volver a Deporte"** en el escritorio, un enlace de vuelta a un
sitio que no existe.

### En escritorio era peor de lo que decía este informe

Descubierto al ir a arreglarlo. `HomeDesktopView` **sí** filtraba, línea 74, usando
`getProductCategory(p)`… que es esto:

```ts
function getProductCategory(_product: GroupProduct): string {
  return 'deporte'
}
```

Devuelve `'deporte'` para todo. Es decir: en escritorio, pulsar cualquier chip que no fuera
*Todos* o *Deporte* **vaciaba el escaparate entero**. No era un botón inerte, era un botón que
rompía la home.

**Lo que se hizo.** Retirados los chips de las dos vistas, junto con `getProductCategory`, el
`· Deporte` de las dos fichas y la migaja falsa, que ahora dice *"← Volver a los grupos"* porque
es adonde lleva de verdad. Cuando exista catálogo real, esto vuelve con una columna `category` en
`groups` y su campo en el panel de admin — no con una función que devuelve una constante.

## UX-10 · El botón de la lupa no hace nada

`GroupsGrid.tsx:117-119`: `<button aria-label="Buscar">` sin `onClick`. La búsqueda ya es en vivo
según se teclea, así que el botón es decorativo. En móvil, pulsarlo debería al menos cerrar el
teclado.

## UX-11 · "Confirmado" / "En espera" es vocabulario bancario

> ✅ **RESUELTO — 13-sep-2026** junto con UX-02: ahora dice **Disponible**.

Etiqueta de estado en la ficha. *Confirmado* significa, para cualquiera que haya comprado por
internet, *"la transacción se ha completado"*. Aquí solo significa que el tramo elegido está
desbloqueado. Mismo origen que UX-02.

## UX-12 · El mismo dato, repetido

- **Checkout:** el ahorro aparece **tres veces** — "Precio tienda 289 €", "Ahorras 70 € frente al
  precio de tienda" y "Ahorras 70 € frente a tienda" en el subtotal.
- **Ficha de escritorio:** "Cierra dom 22:00 · Cierra en 7d 9h 43m" — la misma fecha dos veces
  seguidas, en dos formatos.

## UX-13 · El checkout habla de unidades, no de consecuencias

*"1 uds"*, *"4 uds"*, *"Faltan 3 unidades"*. `PRODUCT_PRINCIPLES.md` §5 pide lo contrario:
*"muy cerca"*, *"faltan 3 compras"*. Es mecánica del algoritmo asomando en la interfaz.

*(El bug de singular —"Tus 1 unidad", "1 uds"— sí está corregido, ver abajo.)*

## UX-14 · El checkout no tiene total

> ✅ **RESUELTO — 13-sep-2026.**

Hay *"Subtotal (1 ud) 219 €"* y justo debajo un CTA que dice *"Hoy 0 €"*. No hay línea de gastos
de envío ni línea de total. Para un checkout de comercio electrónico eso es una laguna de
confianza, y con el badge "Entrega gratis" (UX-03) sin respaldo, además es una laguna de
información precontractual.

**No soy abogado**, pero merece revisión: en España la venta a distancia exige mostrar el precio
total con impuestos y gastos antes de que el comprador quede vinculado, y anunciar un precio de
referencia ("Ahorras 70 € frente a tienda") tiene requisitos propios — hoy ese `pvp` es un campo
libre que teclea el admin, sin verificar contra ninguna fuente. **Lo del `pvp` sigue pendiente.**

### Lo que apareció al ir a arreglarlo: el hold no siempre coincide con lo que se muestra

Verificado con `compute_price` sobre un grupo desechable (tramos 219 € @1 · 189 € @4 · 159 € @8):

| Caso | Se muestra | Se retiene | ¿Coincide? |
|---|---|---|---|
| Comprar ahora | precio proyectado | el mismo | sí |
| Esperar, objetivo **no** alcanzado | el objetivo | el mismo | sí |
| **Esperar, objetivo ya alcanzado** | **el precio real** | **el objetivo (mayor)** | **no** |

El tercer caso es real: `holdPricePerUnit = isEsperar ? target : pricePerUnit` (techo de
seguridad), mientras que `displayPricePerUnit` pasa al precio real en cuanto `targetReached`. El
comprador ve 159 € y se le bloquean 189 €. **No se cobra de más** —al cierre se captura el precio
final y Stripe libera el resto, como demostró el Ensayo 3— pero desaparecen del saldo disponible
30 € que la pantalla no menciona.

> ⚠️ **Nota de método.** La primera versión de este hallazgo era **incorrecta**: se afirmó que el
> subtotal mostraba el precio proyectado (219 €) a un esperador. No es así — a `InnerForm` se le
> pasa `displayTotal`, no `total`. Se leyó la primera variable que encajaba con la sospecha en vez
> de seguir el dato hasta el punto de uso. Queda anotado porque el error es instructivo: en una
> pantalla de dinero, "he leído el código" no basta; hay que seguir cada número hasta donde se
> pinta.

### Lo que se hizo

Se descartó mostrar el importe retenido como número principal: en el tercer caso haría ver 189 €
a quien va a pagar 159 €, cambiando un desajuste por otro peor. El bloque de dinero queda así:

| Línea | Cuándo aparece |
|---|---|
| **Total** *(o "Tu precio máximo" si es un esperador sin objetivo alcanzado)* | siempre |
| **Envío · Incluido** | si el vendedor lo declaró (UX-03) |
| **Se retiene hoy** | **solo cuando el hold supera al total** — el tercer caso |
| Explicación de qué pasa hoy y qué pasa al cierre | siempre, adaptada a los tres casos |
| Ahorro frente a tienda | si lo hay, **una sola vez** |

El importe retenido sale de `effectiveAmount`, exactamente el mismo valor que viaja a Stripe, así
que no puede desincronizarse ni con el checkout ya en marcha (`frozenAmount`).

Y **"Subtotal" pasa a "Total"**: con el envío incluido en el precio no hay nada más que sumar, y
un "subtotal" sin total detrás invita a buscar una línea que no existe.

**El ahorro dejaba de estar dos veces en la misma pantalla:** se quitó el de la escalera y se
quedó el del bloque de dinero.

## UX-15 · El CTA del checkout mezcla los dos registros

*"Unirme al grupo (Hoy 0 €)"*. `PRODUCT_PRINCIPLES.md` §7 separa el vocabulario **social**
(unirse, participar, grupo) del **transaccional** (comprar, pagar, máximo) y prohíbe mezclarlos
*"en el mismo momento de decisión"*. El ejemplo que da el propio documento para este botón es
*"Autorizar pago (Máx. 48,90 €)"*.

## UX-17 · Cuatro falsos controles más, encontrados por el camino

> ✅ **RESUELTOS — 13-sep-2026.**

Buscando los chips aparecieron cuatro elementos más que parecen controles y no lo son. Van juntos
porque son el mismo defecto:

| Dónde | Qué era |
|---|---|
| Cabecera de carrusel (móvil) | *"Ver todas →"* — `<span>` sin `onClick` |
| Cabecera de rejilla (escritorio) | *"Ordenar por: Recomendados"* — `<span>` estático disfrazado de selector |
| Mi Radar | *"Filtros"* — `<button>` con hover y sin `onClick` |
| Mi Radar | *"Ordenar por: Mayor urgencia ↓"* — idem |

Los dos de Mi Radar son los peores: son `<button>` de verdad, con estado hover, así que invitan a
pulsarlos más que los otros. Los cuatro, retirados.

---

## UX-18 · La cabecera anunciaba el cierre del domingo sin ningún grupo abierto

> ✅ **RESUELTO — 13-sep-2026.**

*"Cierra Dom 22:00"* estaba fijo en la cabecera móvil. Con cero grupos abiertos —el estado de hoy—
anunciaba el cierre de nada, justo encima de un mensaje que dice que no hay grupos. Ahora solo
aparece cuando hay algo que cierre.

---

## UX-16 · `localStorage` sigue guardando `vonda_user`

Verificado en el navegador contra producción. Es el último resto de marca antigua en runtime
(P3-02). **No lo he tocado**: renombrar la clave desloguea a todos los que la tengan. Requiere
código de migración, no un reemplazo.

---

# ✅ CORREGIDO EN ESTA SESIÓN

Cuatro defectos claros, sin cambio de mensaje ni de modelo. `npx tsc --noEmit` limpio.

| # | Qué | Dónde |
|---|---|---|
| 1 | **`<html lang="en">` → `lang="es"`.** Toda la app está en castellano; los lectores de pantalla la leían con voz inglesa. Era P3-06 | `src/app/layout.tsx` |
| 2 | **Singular roto.** *"Tus 1 unidad desbloquea"* → *"Tu unidad desbloquea"*; *"1 uds"* → *"1 ud"* en los tres steppers | `JoinFlow.tsx` |
| 3 | **Contraste de los estados vacíos.** `text-neutral-400` daba **2,42:1** sobre `#FBFAF8` — AA pide 4,5:1. Ahora `#6B6B76`, **5,05:1**, el mismo gris que ya usa la cabecera | `GroupsGrid.tsx` |
| 4 | **La "V" del avatar era la inicial de Vonda**, escrita a mano en móvil y en escritorio. Sustituida por un icono de persona con `aria-label`, en vez de inventar una inicial que no tenemos | `GroupsGrid.tsx`, `desktop/DesktopNavbar.tsx` |

---

# LO QUE ESTÁ BIEN

Para no dar la impresión de que todo está mal, y para no “arreglarlo” por error más adelante:

- **`/como-funciona` y `/ayuda` están bien escritas** — claras, sin jerga, con el orden correcto.
  El problema no es su calidad: es que prometen una función que no existe (UX-01) y que su
  contenido no llega a la ficha móvil, que es donde se decide.
- **El checkout de escritorio y móvil es sólido**: campos ordenados en tres bloques numerados,
  provincia como lista cerrada, 3D Secure explicado antes de que asuste, errores en lenguaje llano.
- **La escalera de tramos es dato real**, no decoración: viene de `tier_demand`.
- **El titular "Cuantos más seamos, menos pagamos"** comunica el modelo en seis palabras. Es lo
  mejor que hay en la home.
- **La paleta teal cumple AA** en todos los pares que se usan hoy.

---

# LO QUE NECESITO QUE DECIDAS TÚ

Por orden de urgencia:

1. **UX-01 · "Puedes salir de un grupo".** ¿Implementamos la baja o corregimos los tres textos?
   Mientras no se resuelva, hay una promesa escrita que el sistema no cumple.
2. **UX-02 · "¡Estás dentro!".** ¿Cómo quieres que hable esa frase cuando el usuario todavía no ha
   entrado? Necesito tu voz, no la mía.
3. **UX-05 · La ficha móvil.** ¿Llevamos a móvil los bloques de confianza y la pregunta del
   máximo? Es el cambio con más recorrido de conversión de toda la lista.
4. **UX-03 · "Entrega gratis".** ¿Es una promesa real que quieres mantener (y entonces hay que
   calcular portes) o la quitamos hasta que exista?
5. **UX-07 y UX-09 · Carruseles y chips de categoría.** Ambos son escaparate: ¿los ocultamos
   mientras no haya catálogo, o los conectamos?

---

# LIMPIEZA

El grupo DEMO creado para poder auditar. Bórralo cuando ya no lo necesites:

```sql
delete from bids   where group_id = 'd0000000-0000-4000-8000-0000000000a1';
delete from groups where id       = 'd0000000-0000-4000-8000-0000000000a1';
```

No aparece en la home (`is_demo = true`) ni en las sugerencias del Radar, y no tiene miembros ni
holds asociados: borrarlo no afecta a nada.

Aparte, sigue habiendo un grupo `open` real llamado **"probando otra versd"**
(`bf117565-…`) sin puja, sin imagen y sin precio. Hoy no se ve porque `page.tsx:53` descarta los
grupos sin tramos, pero en cuanto alguien le cargue una puja aparecerá en el escaparate.
