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
   instante. **Esa función no existe en ninguna parte del producto.**
2. 🔴 La ficha saluda a un visitante que no ha tocado nada con **"¡Estás dentro!"**. No lo está.
3. 🟠 **La ficha móvil es una versión mutilada de la de escritorio**: le falta la pregunta que
   define el producto, el precio siguiente, el selector de cantidad y los tres bloques de
   confianza. El tráfico de Instagram y TikTok es casi todo móvil.
4. 🟠 El **CTA principal es un botón fantasma** — relleno al 8 %, con borde. Parece una acción
   secundaria.
5. 🟠 La home muestra **el mismo producto hasta cuatro veces** (destacado + tres carruseles).
   Con uno o dos grupos abiertos, que es el escenario de lanzamiento, se ve como un escaparate
   vacío disfrazado.

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
hablar en pasado ni en primera persona del plural. **Es reescritura de mensaje: lo decides tú.**

---

## UX-03 · "Entrega gratis" es un texto fijo, no un cálculo

**Dónde.** Badge en el checkout, junto a "En stock". Ambos hardcodeados
(`UX_AND_FLOWS.md` §6 ya lo documenta).

De los dos, el peligroso es este: **es un compromiso económico**. No existe ninguna columna, tarifa
ni cálculo de portes en todo el sistema. Si algún envío acaba con gastos, lo has anunciado gratis
en el punto de pago.

`En stock` es más leve, pero tampoco consulta `max_stock`: puede anunciar existencias de un tramo
agotado.

---

## UX-04 · Apple Pay y Google Pay se anuncian en el checkout y no funcionan

Confirmado en la pantalla de pago: los logos `Pay` y `G Pay` aparecen bajo el botón. El dominio no
está registrado en Stripe (comprobado hoy: la lista de *payment method domains* de la cuenta live
está vacía). Ya es **P1-08**; lo repito porque el sitio donde aparece es el peor posible.

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

---

## UX-07 · La home enseña el mismo producto hasta cuatro veces

`GroupsGrid.tsx:63-72`: el destacado y los tres carruseles —*"Cerca del siguiente precio"*,
*"Más han bajado hoy"*, *"Gropos populares"*— se construyen todos sobre **el mismo array
`priced`**, solo que ordenado distinto. No hay ningún filtro que los haga disjuntos salvo excluir
el destacado del primero.

Con un grupo abierto, el usuario ve el mismo casco cuatro veces bajo cuatro titulares que sugieren
cuatro selecciones distintas. Con dos, igual. Ese es exactamente el escenario del lanzamiento.

**Principio que incumple.** *Un dato aparece una sola vez.*

Lo natural es que los carruseles solo se rendericen por encima de un umbral (¿4-5 grupos?) y que
por debajo la home sea una rejilla simple. **Es una decisión de escaparate: la dejo para ti.**

---

## UX-08 · El estado vacío de la home es lo que verá el tráfico frío

Hoy mismo, `https://www.gropo.es` en móvil muestra: titular, buscador, seis chips y —centrado en
mitad de la nada— *"No hay grupos abiertos"*. Nada más, y el resto de la pantalla en blanco.

Es la pantalla que ve alguien que llega desde un reel. No explica qué es Gropo, no ofrece ninguna
acción y no captura el interés (no hay "avísame", no hay "pide un producto").

El contraste de ese texto era **2,42:1** — ya corregido abajo. Lo que no he tocado es el contenido:
qué debe decir esa pantalla es tuyo.

---

# 🟡 CONSISTENCIA, COPY Y ACCESIBILIDAD

## UX-09 · Los filtros de categoría no filtran nada

`GroupsGrid.tsx:44` declara `selectedCat`, línea 128 lo actualiza al pulsar… y **`filtered`
(línea 55) solo filtra por texto**. `selectedCat` no se lee en ningún sitio. Los seis chips
cambian de color y no hacen absolutamente nada.

No es un descuido menor: **no existe columna `category` en la base de datos**, así que no pueden
funcionar aunque se conecten.

*Falsos botones* está en la lista de `PRODUCT_PRINCIPLES.md` §8 de cosas a evitar.

Y la misma categoría inventada aparece dos veces más: `· Deporte` pegado a la ficha
(`grupo/[id]/page.tsx:161`) y **"← Volver a Deporte"** en el escritorio, un enlace de vuelta a un
sitio que no existe.

## UX-10 · El botón de la lupa no hace nada

`GroupsGrid.tsx:117-119`: `<button aria-label="Buscar">` sin `onClick`. La búsqueda ya es en vivo
según se teclea, así que el botón es decorativo. En móvil, pulsarlo debería al menos cerrar el
teclado.

## UX-11 · "Confirmado" / "En espera" es vocabulario bancario

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

Hay *"Subtotal (1 ud) 219 €"* y justo debajo un CTA que dice *"Hoy 0 €"*. No hay línea de gastos
de envío ni línea de total. Para un checkout de comercio electrónico eso es una laguna de
confianza, y con el badge "Entrega gratis" (UX-03) sin respaldo, además es una laguna de
información precontractual.

**No soy abogado**, pero merece revisión: en España la venta a distancia exige mostrar el precio
total con impuestos y gastos antes de que el comprador quede vinculado, y anunciar un precio de
referencia ("Ahorras 70 € frente a tienda") tiene requisitos propios — hoy ese `pvp` es un campo
libre que teclea el admin, sin verificar contra ninguna fuente.

## UX-15 · El CTA del checkout mezcla los dos registros

*"Unirme al grupo (Hoy 0 €)"*. `PRODUCT_PRINCIPLES.md` §7 separa el vocabulario **social**
(unirse, participar, grupo) del **transaccional** (comprar, pagar, máximo) y prohíbe mezclarlos
*"en el mismo momento de decisión"*. El ejemplo que da el propio documento para este botón es
*"Autorizar pago (Máx. 48,90 €)"*.

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
