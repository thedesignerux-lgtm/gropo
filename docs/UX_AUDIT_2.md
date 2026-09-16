# UX_AUDIT_2.md — Auditoría heurística sobre el dataset de pruebas

**Iniciada el 14 de septiembre de 2026**, contra producción a 375 px, usando los 15 grupos de
`UX_TEST_DATASET.md`. No confundir con `UX_AUDIT.md`, que es la auditoría del 13 de septiembre
(ya cerrada, 18 hallazgos).

**Método.** Recorrer cada pantalla con la pregunta del perfil de comprador que corresponda, no con
la del fundador. Para cada hallazgo: qué pasa, por qué importa, y en qué grupo se reproduce.
**Nada se ha corregido todavía** salvo lo que se indique expresamente.

Severidad: 🔴 crítico (miente o impide comprar) · 🟠 importante (confunde o frena) · 🟡 mejora.

---

## PARTE 1 · FICHA DE UN GRUPO NO ACTIVADO (G01) Y HOME

### 🔴 A-01 · La ficha de un grupo que todavía no existe era idéntica a la de uno que sí — ✅ CORREGIDO 14 sep 2026
**Reproducir:** `/grupo/dd000000-…-0001` — Casco Giro. 2 unidades, el primer tramo pide 5, la
ejecución mínima son 5.

Ese grupo **no puede ejecutarse hoy**: si cerrara ahora se cancelaría y nadie compraría nada. La
pantalla dice, en este orden:

| Elemento | Lo que dice | La realidad |
|---|---|---|
| Píldora de estado | **«Disponible»** con punto verde | No hay ningún tramo desbloqueado |
| Encabezado de precio | **«PRECIO ACTUAL · 289 €»** | Es el *fallback* de `compute_price`, el precio de un tramo **cerrado** |
| Badge verde | **«Ahorras 40,99 €»** | Un ahorro sobre un precio que nadie tiene garantizado |
| Nudge | **«Este precio ya está disponible»** | Falso, literalmente |
| Botón | **«Bloquear precio · 289 €»** | No hay precio que bloquear |

Cinco afirmaciones, las cinco en la misma dirección, las cinco falsas. Y ninguna es un bug de
código: el dato que falta es **`min_execution`**, que no aparece en ninguna parte de la ficha.

**Por qué es lo más grave de la auditoría.** El día del lanzamiento **todos** los grupos estarán
así: recién creados y vacíos. Esta pantalla no es un caso raro, es el estado por defecto del
catálogo el primer día. Y el comprador que se una creyendo que tiene 289 € asegurados descubrirá
lo contrario al cierre, cuando ya ha dado la tarjeta. Incumple el principio de *transparencia
absoluta: nunca debe haber sorpresas*.

**Lo que falta decir:** cuántas unidades necesita el grupo para salir adelante, cuántas lleva, y
que hasta llegar ahí no hay compra. `min_execution` ya viaja hasta el componente
(`grupo/[id]/page.tsx` lo pasa como `minExecution`); simplemente no se pinta.

**Corregido (14 sep 2026), opción «precio de salida + meta visible»** (decisión de producto de
Benjamin). Nuevo `src/lib/activation.ts` con una sola definición de «grupo activado»:

```ts
const firstTierUnits = Math.min(...tiers.map(t => t.minUnits))
const targetUnits    = Math.max(minExecution, firstTierUnits)
const activated      = committedUnits >= targetUnits
```

**Son dos condiciones, no una.** Un grupo arranca cuando tiene unidades para (1) desbloquear su
primer tramo —si no, `compute_price` devuelve el precio de un tramo cerrado— y (2) llegar a la
ejecución mínima —si no, al cerrar se cancela—. Para el comprador significan lo mismo, así que se
resuelven en un solo listón: el mayor de los dos.

*No se reutilizó `getActivationState`*: vive en `lib/mock-data.ts`, solo la usan componentes
huérfanos (A-34) y **solo mira la ejecución mínima**, ignorando si hay tramo desbloqueado — con lo
que en el Casco Giro habría dado el resultado correcto por casualidad.

Qué ve ahora ese comprador, en móvil y en escritorio:

| Dónde | Antes | Ahora |
|---|---|---|
| Píldora | «Disponible» + punto verde | **«Aún no activado»** en ámbar |
| Encabezado | «PRECIO ACTUAL» | **«PRECIO DE SALIDA»** |
| Badge verde | «Ahorras 40,99 €» | **no se pinta** (el PVP tachado se queda) |
| Nudge del slider | «Este precio ya está disponible…» | **«Este grupo aún no ha arrancado: faltan 3 unidades. Si sale adelante, este tramo se paga a 289 €. Si no, no se cobra nada.»** |
| — | *no existía* | **bloque de meta**: barra de progreso, «Faltan 3 unidades para que arranque», «2 / 5», y «si no llega, se cancela y no se cobra nada» |
| Botón | «Bloquear precio · 289 €» | **«Reservar mi plaza · Hoy 0 €»** |

**Verificado con los 12 grupos abiertos de producción:** 11 salen ACTIVADO y solo el Casco Giro
NO ACTIVADO, con «faltan 3» — que coincide exactamente con el `bool_or(unlocked) = false` que
devuelve `tier_demand` para ese grupo. Probados también los bordes: sin pujas, justo en el listón,
una unidad por debajo, tramo por encima de la ejecución mínima y al revés.

---

### 🔴 A-02 · La home no enseñaba ni el stock ni el tiempo del grupo destacado — ✅ CORREGIDO 14 sep 2026
**Reproducir:** home a 375 px, con el Shimano 105 Di2 (G09) destacado.

Ese grupo tiene **1 unidad de stock** y cierra en **9 horas**. La tarjeta destacada, que ocupa la
primera pantalla entera, **no menciona ninguna de las dos cosas**. Enseña precio, ahorro,
participantes y escalera de tramos.

Las dos únicas palancas de escasez del modelo —quedan pocas, queda poco tiempo— están ausentes
justo en el sitio de máxima atención. Y el comprador que pulse el botón se encontrará el tope de
unidades en 1 **después**, ya dentro del checkout.

La cabecera sí muestra una cuenta atrás global, **«Cierra Dom 22:00»**, que además contradice al
grupo que tiene debajo: cada grupo cierra a su hora, no todos el domingo.

**Corregido (14 sep 2026).** La tarjeta destacada lleva ahora una fila con las dos palancas:

- **«Quedan N unidades»** en ámbar, cuando quedan 5 o menos. Mismo umbral que el badge del
  checkout (A-12), para que la home y el checkout no se contradigan.
- **La cuenta atrás real del grupo**, con el `GroupCountdown` que ya existía.

Hizo falta traer dos datos que la home no cargaba: `max_stock` (se añadió al `select` de `bids`
que ya se hacía para `min_execution`, sin consulta nueva) y las unidades comprometidas.

> **Un detalle que casi me cuesta un número mal.** La home ya tenía `currentUnits`, pero **no sirve
> para restar stock**: es un valor de *display* recortado al tramo siguiente
> (`Math.min(nextLocked.minUnits - 1, …)`) para que la escalera de las tarjetas se lea bien.
> Usarlo habría **subestimado lo ocupado** y anunciado más stock del que hay — exactamente el error
> de P2-01. Se añadió `committedUnits` (el máximo de la demanda efectiva, que es la suma real de
> unidades vivas) y se restó de ahí.

**Y fuera el «Cierra Dom 22:00» de la cabecera.** Era una afirmación global falsa: de los 12 grupos
abiertos, **ninguno cerraba en domingo**, y nada en el sistema fuerza ese día — la fecha la elige el
admin (ver **P0-09**). Además contradecía a la tarjeta de debajo, que sí lleva el cierre real de su
grupo. La escasez se queda donde es cierta: en cada tarjeta.

---

### 🟠 A-03 · Se pedía la decisión antes de explicar el modelo — ✅ CORREGIDO 14 sep 2026
En la ficha, el orden de lectura es:

1. Precio
2. **«¿Cuál es el máximo que pagarías?»** + slider
3. Botón **«Bloquear precio»**
4. …y solo después, al hacer scroll: **«Cuantos más, menos pagas»**, con los tres pasos y el
   *«No pagas hasta que el grupo cierra»*

A un visitante que llega por primera vez se le pide fijar un precio máximo —una decisión que solo
tiene sentido si ya entiendes la compra colectiva— **antes** de explicarle cómo funciona. La
explicación existe y es buena; está en el sitio equivocado.

En la home pasa lo mismo: la primera pantalla es un slider de precios sobre un producto de
1.499 €, sin una sola línea de «qué es esto».

**Corregido (14 sep 2026).** Una línea justo encima de la pregunta, con el copy de Benjamin
adaptado a la densidad de cada pantalla —misma idea, distinto ritmo—, y sin mover el bloque
explicativo, que sigue abajo para quien quiera más:

| | |
|---|---|
| **Escritorio** | «El precio baja si el grupo crece. Tú marcas el máximo que pagarías.» |
| **Móvil** | «Cuantos más compramos, menos pagas. Tú marcas tu precio máximo.» |

La pregunta pasa a **«¿Cuál es el precio máximo que pagarías?»** (antes «¿Cuál es el máximo…?»), y
**en escritorio se añade: no tenía encabezado ninguno.** Se pedía la decisión sin llegar a
enunciarla.

**Lo que no se hizo, y por qué.** La propuesta incluía una segunda frase *debajo* del slider («Si
el grupo crece, tu precio puede bajar»). El nudge que ya hay ahí dice eso mismo **con los números
reales del grupo** —«Si te unes hoy pagas 219 €, y menos si el grupo sigue creciendo. Con 4
unidades más baja a 189 €»—, así que añadirla sería decir dos veces lo mismo, peor la segunda.
Va contra *«un dato aparece una sola vez»*. Si aun así se quiere, es un minuto.

**La home se queda como está**: ahí el slider va dentro de una tarjeta de producto con su contexto
alrededor, y la primera pantalla es un problema distinto —de posicionamiento, no de microcopy— que
merece su propia decisión.

---

### 🟠 A-04 · Tres vocabularios para la misma cosa — ✅ CORREGIDO 14 sep 2026
| Dónde | Cómo lo llama |
|---|---|
| Tarjeta destacada (home) | «15 **confirmados**» |
| Ficha de grupo | «2 **personas** en el grupo» |
| Escalera de tramos | «8 **uds**» |

Los tramos se desbloquean por **unidades**, no por personas: un comprador con 4 cámaras cuenta
como 4. En G10 hay 20 personas y **57 unidades**. Con el vocabulario actual, ese grupo diría «20
personas» junto a una escalera que habla de 50 uds, y el comprador no puede cuadrar los números.

Y «confirmados» es vocabulario de banco para algo que no ha ocurrido: nadie ha pagado.

**Corregido (14 sep 2026).** Decisión de Benjamin: **se dicen las dos cosas, cada una con su
nombre** — personas para la fuerza colectiva, unidades para lo que mueve el precio. El léxico
completo queda fijado en `PRODUCT_PRINCIPLES.md` §7.

Hizo falta traer un dato que no existía en la interfaz: el **conteo de personas**. Se cuenta en el
servidor (en la ficha y en la home, con los mismos estados de pago que `tier_demand`) y no con una
RPC nueva: el número cambia despacio y no merece otra superficie pública.

| Dónde | Antes | Ahora |
|---|---|---|
| Ficha | «2 personas en el grupo» (eran unidades) | «**20 personas** ya han pedido **57 unidades**» |
| Tarjeta | «15 confirmados» (eran unidades) | «20 compradores · 57 uds» |
| Escalera | «8 uds» | «8 uds» (sin cambio) y el tooltip pasa a «Faltan 3 uds» |

**Un ajuste sobre la propuesta, y conviene que conste.** Con los datos reales delante,
**en 4 de cada 6 grupos personas y unidades coinciden** —casi todo el mundo pide una unidad— y
«18 personas ya han pedido 18 unidades» es repetir el mismo número con dos nombres: justo lo que
este arreglo venía a quitar. Así que los dos datos salen **solo cuando de verdad son dos datos**;
si coinciden, se dice «18 personas en el grupo».

---

### 🟠 A-05 · El nombre del producto era ilegible en la mitad de las tarjetas — ✅ CORREGIDO 14 sep 2026
**Reproducir:** home, carruseles.

El nombre va en blanco sobre la foto, con un degradado oscuro por debajo. Pero el catálogo real es
**producto recortado sobre fondo claro**, y el degradado no basta: «Garmin Edge 840 Solar»,
«Bicicleta Orbea Orca M30» y «Par de ruedas Zipp 303 S» se leen mal o no se leen.

El degradado está diseñado para fotografía ambiental. Es el hallazgo nº 4 del dataset, y visto con
fotos reales **no es estética: es legibilidad**.

**Corregido (14 sep 2026), con los números calculados y no elegidos a ojo.** Medí el contraste del
blanco en el borde superior del nombre, sobre foto blanca, que es el peor caso real de este
catálogo:

| Degradado | Contraste | |
|---|---|---|
| El que había (`.80` → `.25@60 %`) | **1,62 : 1** | ilegible |
| Mi primer intento (`.90` → `.55` → `.18`) | **1,96 : 1** | **seguía fallando** |
| El aplicado (`.92` → `.72@62 %` → `.30@82 %`) | **5,89 : 1** | ✅ |

WCAG AA exige 4,5:1 para texto pequeño. **Mi primera propuesta no llegaba**, y lo habría dado por
bueno de no haberlo calculado: a ojo parecía suficiente. La `text-shadow` que también se añadió
ayuda a la percepción pero **no cuenta** para el contraste — eso lo tiene que dar el fondo.

**El arreglo de fondo sigue sobre la mesa:** sacar el nombre **fuera** de la foto, que es el patrón
estándar cuando el producto va recortado sobre fondo claro. Elimina el problema en vez de
taparlo, pero cambia la composición de la tarjeta y es decisión visual de Benjamin.

---

### 🟠 A-06 · El mismo producto aparecía hasta tres veces en la misma pantalla — ✅ CORREGIDO 14 sep 2026
Con 14 grupos y tres carruseles de nueve, la repetición es matemáticamente inevitable. Hoy la
Orbea sale en «Cerca del siguiente precio» **y** en «Más han bajado hoy»; el Shimano está en la
destacada **y** en un carrusel. El catálogo parece más pequeño y menos cuidado de lo que es.

Además **«Más han bajado hoy» es una afirmación factual que no se sostiene**: ninguno de estos
grupos ha bajado hoy. Y «Gropos populares», ¿según qué?

**Corregido (14 sep 2026), las dos mitades:**

1. **Los carruseles son disjuntos.** Cada grupo cae en el que mejor lo describe y no vuelve a
   salir: primero «cerca del siguiente precio» —la razón más accionable para entrar hoy—, luego el
   ahorro, y el resto por tamaño. El comentario de `CAROUSEL_MIN` ya decía que hacerlos disjuntos
   era el arreglo de fondo; esto es ese arreglo.
2. **Los títulos dicen el criterio real.** «Más han bajado hoy» → **«Los que más ahorran frente a
   tienda»** (que es lo que ordena: `savings`, no bajadas, y menos aún «hoy»). «Gropos populares» →
   **«Los que más gente ha reunido»**.

---

### 🟡 A-07 · La mini-escalera de las tarjetas es ilegible — ✅ CORREGIDO 15 sep 2026
Bajo cada tarjeta de carrusel hay tres precios a **7,5 px** («449 € · 419 € · 389 €»). A ese
tamaño no se leen; ocupan espacio y añaden ruido sin comunicar nada. O crecen, o se van.

**Decisión de Benjamin:** se van los números, se queda la barra. Agrandarlos a 10 px era la
otra opción, pero en una tarjeta de 132 px tres precios de cuatro cifras («1.849 €») se tocan
entre ellos. La barra y sus puntos ya dicen lo único que la tarjeta tiene que decir —el precio
baja por tramos y vamos por aquí— y el precio de verdad está justo encima a 14 px.
`src/components/GroupsGrid.tsx`.

### 🟡 A-08 · Dos botones flotantes por tarjeta compiten con el producto
Compartir y favorito, 30 px cada uno, sobre una tarjeta de 132 px: ocupan casi la mitad del ancho
superior de la foto. Multiplicado por nueve tarjetas visibles, son 18 botones peleando con el
catálogo.

### 🟡 A-09 · Descuentos con y sin decimales en la misma fila — ✅ CORREGIDO 15 sep 2026
«−150,99 €» junto a «−347 €» y «−750 €». Es el comportamiento del helper (oculta los decimales si
el número es entero), pero en una fila de badges canta. Para un descuento, redondear a «−151 €» es
más legible y no engaña a nadie.

**No era cosa del catálogo.** Comprobado en producción el 15 sep 2026: los PVP reales acaban en
,99 o ,95 (Garmin 599,99 €, Casco Giro 329,99 €, Zapatillas 159,99 €) y nuestros precios son
redondos, así que el ahorro nace con céntimos en 3 de los grupos abiertos y sin ellos en los
demás. Mientras haya PVP acabados en ,99 esto vuelve solo.

**Regla, decidida por Benjamin:** el ahorro se escribe redondeado al euro en TODAS las pantallas.
Vive en `src/lib/money.ts` (`fmtSaving`), una sola función importada en los **14 sitios** donde se
mostraba el ahorro: 12 vivos y 2 dentro de componentes huérfanos (`HomeProductCard`,
`DesktopProductCard`, en la lista de DT-04). Uno de los 14 —«Estás ahorrando», en el panel de
escritorio de Mis grupos— no salía al buscar «Ahorr» con mayúscula y habría quedado fuera; el
barrido final fue insensible a mayúsculas. `BestPriceReached` y `GroupLiveSection2c` también lo
muestran y NO se han tocado: son huérfanos ya documentados y no se renderizan en ninguna pantalla. Lo que se
COBRA (precio, total, envío, hold) no pasa por ahí y sigue exacto al céntimo; el PVP tachado que
acompaña al ahorro tampoco se redondea, porque es dato del vendedor. En el peor caso la cifra del
ahorro exagera en 1 céntimo (150,99 → 151 €); Benjamin lo aceptó explícitamente frente a la
alternativa de redondear hacia abajo, que nunca exagera pero regala hasta 99 céntimos de argumento.

### 🟡 A-10 · «Hoy 0 €» es el argumento más fuerte y está en 11 px gris
No pagar hoy es lo que separa a Gropo de una tienda normal. Aparece debajo del botón, en gris, en
el tamaño más pequeño de la pantalla.

---

## PARTE 2 · ESCASEZ (G09 y G06)

### 🔴 A-11 · Un grupo con el plazo vencido sigue vendiendo — ✅ CORREGIDO 14 sep 2026
**Reproducir:** `/grupo/dd000000-…-0009` — Shimano 105 Di2, con `closes_at` ya pasado.

En la **misma pantalla**, a la vez:
- Píldora naranja sobre la foto: **«Cerrado»**
- Píldora verde en la tarjeta de precio: **«Disponible»**
- Botón principal activo: **«Bloquear precio · 1499 €»**

Y no es solo la interfaz. Comprobado contra producción:

| Prueba | Resultado |
|---|---|
| `prepare_join` en G09 (`open`, plazo vencido) | **acepta** y devuelve `guaranteed_price: 1399` |
| `prepare_join` en G13 (`closed`) | rechaza: *«Grupo no disponible»* |
| Funciones que miran `closes_at` | **0** de 2 (`prepare_join`, `confirm_join`) |

El guard de `prepare_join` es `IF NOT FOUND OR v_group.status <> 'open'`. Protege por **estado**,
nunca por **fecha**. Así que entre el instante del cierre y el momento en que algo cambia el
estado, el grupo **sigue cobrando**.

**Cuánto dura esa ventana.** El cierre automático es un cron de Vercel (`vercel.json`):
`0 21 * * 0` — **domingos a las 21:00 UTC**. `madridCloseAtISO` fija `closes_at` a las 22:00 de
Madrid, que en verano son las **20:00 UTC**. Es decir: **una hora**, todos los domingos, en la que
el plazo ha vencido, la web dice «Cerrado» y el servidor acepta compras. Si el cron falla o Vercel
se salta una ejecución, la ventana pasa a ser de **siete días**.

**Honestidad sobre el caso de prueba:** parte de lo que se ve aquí es artefacto del dataset — puse
`closes_at` a +9 h en vez de a un domingo a las 22:00, que es lo que hace el formulario real. Pero
el agujero no depende de eso: existe igual en la ventana del domingo, y la contradicción
«Cerrado / Disponible / botón activo» se daría exactamente igual.

**El cron, por lo demás, está bien construido:** idempotente, autenticado con `CRON_SECRET`,
reutiliza el mismo `closeGroup()` que el botón del admin y avisa por email si algún cierre falla.
El problema no es el cron: es que **la fecha de cierre no es una regla que el servidor haga
cumplir**, solo una fecha que el cron consulta una vez por semana.

**Corregido (14 sep 2026).** Dos mitades:

1. **Servidor — la autoridad.** `prepare_join` trae ahora `closes_at` al RECORD y lo hace cumplir
   justo después del guard de estado:
   ```sql
   IF v_group.closes_at <= now() THEN
     RAISE EXCEPTION 'Este grupo ya ha cerrado y no admite nuevas compras';
   END IF;
   ```
   La función **no se reescribió**: el cambio se aplicó sobre `pg_get_functiondef` con dos
   sustituciones de texto y dos comprobaciones de aborto, así que el resto es byte a byte el
   mismo. No se tocó `close_group`, ni `compute_price`, ni el cron.

2. **Interfaz — `GroupLiveSection`.** `hasClosed` se calcula después de montar (como
   `GroupCountdown`, para no romper la hidratación) y con un intervalo, de modo que la pantalla se
   apaga sola si el plazo vence con la página abierta. La píldora pasa a **«Cerrado»** en gris, el
   botón queda deshabilitado con el texto **«Este grupo ya ha cerrado»**, y `handleCheckout` sale
   antes de abrir nada.

**Verificado contra producción:**

| Prueba | Antes | Ahora |
|---|---|---|
| `prepare_join` en G09 (vencido) | aceptaba, `guaranteed_price: 1399` | **rechaza** |
| `prepare_join` en G06, G02, G07 (vivos) | aceptaba | **sigue aceptando** |
| `prepare_join` en G06 pidiendo más del stock | rechazaba | **sigue rechazando** |
| `prepare_join` en G13 (`closed`) | rechazaba | **sigue rechazando** |

**Verificado en pantalla (14 sep 2026, 375 px).** La píldora de la tarjeta pasa a «Cerrado» y el
botón queda gris con «Este grupo ya ha cerrado».

> ⚠️ **Nota de método.** `hasClosed` se calcula **después de montar** —a propósito, para no romper
> la hidratación—, así que **el HTML que sirve el servidor sigue diciendo «Disponible»**. Es el
> navegador quien lo corrige al hidratar. Comprobar este arreglo con `curl` da un falso negativo:
> hay que mirarlo en un navegador. Se perdió un despliegue por no caer en ello.

### 🟠 A-11c · El arreglo apagó la acción, pero la tarjeta seguía vendiendo — ✅ CORREGIDO 14 sep 2026
Con el botón ya deshabilitado, en esa misma pantalla siguen leyéndose:

- **«PRECIO ACTUAL · 1499 €»** — no hay precio actual: el grupo está cerrado
- **«Ahorras 347 €»** — un ahorro sobre una compra que ya no se puede hacer
- **«¿Cuál es el máximo que pagarías?»** con el slider **todavía arrastrable**
- **«Este precio ya está disponible. Si te unes hoy pagas 1499 €… Con 1 unidad más baja a 1399 €»**

Es decir: se arregló **el estado y la acción**, no **el discurso**. Un grupo cerrado debería contar
otra cosa —qué pasó, a qué precio se quedó, y si habrá otra ronda— en vez de seguir invitando a
unirse con el botón apagado. Enlaza con A-13 (el subtítulo fijo que no consulta el estado) y con
el hueco de G13/G14: **nadie ha diseñado el después**.

**Corregido (14 sep 2026), en móvil y en escritorio.** Con el plazo vencido:

- «PRECIO ACTUAL» pasa a **«PRECIO AL CIERRE»** — no hay precio actual si no se puede comprar.
- El badge de ahorro **no se pinta**.
- La pregunta «¿Cuál es el máximo que pagarías?» y el slider **desaparecen**, y con ellos el nudge.
  En su lugar, un bloque que cuenta lo que pasó: **«Este grupo ya ha cerrado. Se quedó en 1499 €
  con 15 unidades. Ya no admite nuevas compras.»**
- En escritorio, el selector de cantidad también se oculta.

Sigue sin responderse **si habrá otra ronda**. Eso no es copy: es una decisión de producto que no
está tomada, y prefiero dejar el hueco visible antes que insinuar algo que el sistema no puede
cumplir.

### ❌ A-11b · «`confirm_join` no comprueba el estado del grupo» — **FALSO POSITIVO** (retirado 14 sep 2026)
> **Este hallazgo estaba mal. Lo retiro entero.**
>
> Escribí: *«Comprobado: **cero** referencias a `v_group.status` en `confirm_join`»*. La frase es
> literalmente cierta y completamente engañosa. `confirm_join` **no usa** una variable llamada
> `v_group` —esa es de `prepare_join`—, pero **sí comprueba el estado**, y lo hace mejor de lo que
> yo iba a proponer:
>
> ```sql
> -- RE-VALIDACIÓN (carrera hold→confirm) + candado de fila
> PERFORM 1 FROM groups WHERE id = p_group_id AND status = 'open' FOR UPDATE;
> IF NOT FOUND THEN
>   RETURN json_build_object('status', 'needs_release', 'reason', 'group_closed');
> END IF;
> ```
>
> Con `FOR UPDATE`, que es la garantía real contra la carrera con `close_group`. Y devolviendo
> `needs_release`, que es exactamente la salida que yo describía como «lo que habría que
> construir». Ya estaba construida.
>
> **El círculo está cerrado de punta a punta.** El webhook (`api/stripe/webhook/route.ts:93`)
> recibe ese `needs_release`, cancela el hold, y si la cancelación falla devuelve **500 para que
> Stripe reintente durante días** — con un comentario que explica que sin eso el cliente se
> quedaría una semana con el dinero retenido sin que nadie se entere.
>
> **Y la documentación ya lo decía.** `PROJECT_KNOWLEDGE_PACK.md`, INV-03: *«Un grupo cerrado no
> acepta miembros nuevos ✅ — `confirm_join` exige `status='open'` bajo el mismo `FOR UPDATE` que
> usa `close_group`»*. Escribí lo contrario sin contrastarlo con un documento que yo mismo había
> citado en otras partes de esta auditoría.
>
> **La causa del error:** busqué por el nombre de una variable en vez de por la condición. Un
> `grep` de `v_group.status` no encuentra `WHERE ... AND status = 'open'`.

---

**Lo que decía el hallazgo, para que se entienda qué se retira:** que si el grupo se cerraba
mientras alguien estaba a mitad del pago, el webhook crearía la membresía en un grupo ya liquidado,
dejando a ese comprador fuera del reparto y con el hold vivo. **No puede pasar.**

**Un matiz que sí es real, y que no es un fallo.** El guard mira `status`, no `closes_at`. Entre el
vencimiento del plazo y la pasada del cron —ahora como mucho un día, desde P0-09— el grupo sigue
`open`, así que un PaymentIntent creado **antes** del vencimiento todavía puede confirmarse. Eso es
**correcto**: ese comprador pagó dentro de plazo, el grupo sigue abierto y entra en la liquidación
normal. Rechazarlo por unos segundos de diferencia sería peor. Y no puede empezar nadie nuevo:
`prepare_join` sí mira `closes_at` desde A-11.

---

### 🔴 A-12 · «En stock» significaba lo mismo con 2 unidades que con 200 — ✅ CORREGIDO 14 sep 2026
**Reproducir:** `/grupo/dd000000-…-0006/unirme` — Gafas Oakley. **Quedan 2 de 20.**

El badge dice **«✓ En stock»**, idéntico al de cualquier otro grupo. La escasez es binaria: hay o
no hay. En ningún punto del checkout aparece que queden dos.

Y este grupo es el peor sitio para ocultarlo, porque **ya tiene el mejor precio desbloqueado**: no
queda ninguna palanca de precio, la única razón para decidir hoy es que se acaban — y es justo lo
que no se dice. El grupo con más urgencia real del catálogo es el que menos urgencia transmite.

El dato existe y es correcto: `remainingStock()` ya calcula 2, y el selector topa ahí
(verificado en P2-01). Solo se usa para **impedir**, nunca para **avisar**.

**Corregido (14 sep 2026).** El badge pasa a tener tres estados en vez de dos: «En stock»,
**«Quedan N unidades»** en ámbar por debajo de 5, y «Sin stock». En las gafas ahora dice
**«Quedan 2 unidades»**.

El umbral de 5 no es arbitrario: por debajo de ahí el número comunica urgencia real; por encima, un
número grande no aporta nada y además publica el inventario del vendedor sin necesidad.

De paso, el bloque estaba **copiado tres veces literalmente** en `JoinFlow` (tres variantes de
diseño del checkout). Ahora es un `<StockBadge>`, así que el próximo cambio de copy se hace una vez
y no tres.

---

### 🟠 A-13 · «Bajará si entran más compradores» cuando ya no podía bajar — ✅ CORREGIDO 14 sep 2026
Misma pantalla, separados por unos 40 px:

> **Precio de tu plaza** — *bajará si entran más compradores* — **89 €**
>
> **Mejor precio ya desbloqueado 🎉**

El subtítulo de la tarjeta de precio es un texto fijo que no consulta el estado. En los grupos
donde queda escalera es cierto; en G05 y G06, donde ya no queda, es falso y además choca con el
mensaje de la barra de progreso, que sí acierta.

**Corregido (14 sep 2026).** El subtítulo consulta `nextTier`: con escalera por delante sigue
diciendo «bajará si entran más compradores»; sin ella, **«es el mejor precio del grupo»**, que es
lo mismo que dice la barra 40 px más abajo.

---

### 🟡 A-14 · El ahorro estaba, pero donde no se mira — ✅ CORREGIDO 14 sep 2026

> **Corrección de este hallazgo.** Lo escribí como «**el ahorro no se calcula en ninguna parte**».
> **Era falso.** `savingsPerUnit` existe, se pasa al bloque de dinero y se pintaba como *«Ahorras X
> frente a tienda»*. Lo vi al ir a implementarlo. Baja de 🟠 a 🟡: no era una ausencia, era
> jerarquía.

Lo que sí pasaba: en la home cada tarjeta lleva un badge verde bien visible, y en el checkout el
ahorro iba en **12 px, alineado a la derecha y por debajo del párrafo legal**, al final del bloque.
El sitio donde menos se mira de toda la pantalla.

En G06 son 89 € frente a 197 €: un **55 %**. El argumento económico más fuerte del producto,
enterrado justo en la pantalla donde se firma.

**Corregido.** El ahorro sube a la fila inmediatamente siguiente al total, con el PVP tachado al
lado: «Precio en tienda ~~197 €~~ · **Ahorras 108 €**». Se multiplica por las unidades, igual que
el total, para que las tres cifras cuadren a la vista.

---

## PARTE 3 · DESPUÉS DE COMPRAR (`/mis-grupos`, `/notificaciones`, emails)

### 🔴 A-15 · El comprador invitado se quedaba sin rastro de su pedido — ✅ CORREGIDO 14 sep 2026
**Reproducir:** comprar sin crear cuenta, saltarse la invitación de la pantalla de éxito, y buscar
el pedido desde otro navegador o con los datos del navegador borrados.

Gropo usa el patrón **«compra primero, cuenta después»**, que es el correcto para no meter fricción
en el checkout. Y está bien implementado: `create-intent` no exige sesión, y `PostCheckoutView`
ofrece crear cuenta con un argumento razonable (*«para ver el precio en tiempo real, gestionar tus
reservas y recibir alertas»*).

El problema es lo que pasa si la saltan. **Y la mayoría la salta.**

| | |
|---|---|
| Compradores con compra viva **sin cuenta vinculada** | **26 de 28** (`users.auth_id is null`) |
| `/mis-grupos` | exige **sesión** de Supabase |
| `/notificaciones` | usa la **identidad local del navegador** (`readLocalIdentity` → `get_my_groups`) |
| Enlaces a la web en los emails transaccionales | **ninguno** |

Ese último punto es el que cierra la trampa. Comprobado en `joinConfirmation.ts`,
`purchaseConfirmation.ts` y `paymentInstructions.ts`: **cero `href`**. `SITE_URL` solo se usa para
pintar el logo (`brand.ts`). El único email con enlace es el del Pulse.

Así que el comprador invitado tiene **un único rastro**: el `localStorage` del navegador donde
compró. Cambia de móvil, o borra datos, y su pedido desaparece de su vista — **con el dinero
retenido en su tarjeta**.

**Lo más frustrante: la vía de recuperación ya existe y funciona.** `/api/my-groups` busca por
**email**, no por `auth_id`, así que si entrara con el mismo email que usó al comprar, vería sus
pedidos. **Nadie se lo dice nunca.** Ni la pantalla de éxito al saltarla, ni el email, ni la
pantalla de login («Entra para ver tus grupos» no menciona que valga el email de la compra).

**Coste de arreglarlo:** un enlace en los emails y una frase en el login. El mecanismo ya está.

**Corregido (14 sep 2026).** Exactamente eso:

1. **Los tres emails transaccionales llevan enlace.** Nuevo `emailTrackBlock()` en
   `lib/emails/brand.ts`, insertado en `joinConfirmation`, `purchaseConfirmation` y
   `paymentInstructions`, **en HTML y en texto plano**:

   > **¿Quieres ver cómo va tu pedido?**
   > Entra con el mismo email al que te hemos enviado este mensaje y verás tu grupo, el precio y el
   > estado de tu pago. No hace falta contraseña.
   > **[Ver mi pedido]** → `https://www.gropo.es/mis-grupos`

   No hace falta pasarle el email del comprador: el bloque viaja **dentro** del correo que se le
   manda, así que «el mismo email al que te hemos enviado este mensaje» siempre es exacto.

2. **El login lo dice.** «¿Ya has comprado en Gropo? Usa el mismo email de tu compra y verás tus
   pedidos.»

3. **La pantalla de `/mis-grupos` sin sesión también.** El subtítulo pasa de «Tus pedidos y su
   estado, en un sitio» a **«Usa el mismo email con el que compraste y verás tus pedidos, aunque no
   te hayas creado una cuenta»**.

**Verificado renderizando las tres plantillas:** cada una devuelve exactamente un `href` a
`https://www.gropo.es/mis-grupos` y el texto plano incluye la URL. Antes: cero `href` en las tres.

**Lo que sigue abierto de A-15:** el comprador invitado que borra los datos del navegador **y** no
guarda el email sigue sin rastro. Eso ya no es un fallo de comunicación sino el límite del patrón
«compra primero, cuenta después», y la salida sería un enlace firmado por pedido dentro del email
— scope nuevo, no corrección.

### 🟠 A-16 · Dos superficies para lo mismo — ✅ CERRADO 14 sep 2026 (identidad en A-21, propósito aquí)
`/mis-grupos` (sesión) y `/notificaciones` (identidad local) responden a la misma pregunta —*¿qué
he comprado y cómo va?*— con dos mecanismos que no se hablan. Un mismo comprador puede ver su
pedido en una y no en la otra según desde dónde entre, sin ninguna explicación.

Ver también DT-03: no es duplicación de UI, es duplicación de **concepto de identidad**.

### 🟡 A-17 · El rescate de `/api/my-groups` no podía funcionar — ✅ CORREGIDO 14 sep 2026
Si el registro de `users` no tiene teléfono, el endpoint cae a un plan B: cargar los **50
`group_members` más recientes de toda la plataforma** y recorrerlos haciendo una consulta de
usuario por fila, comparando emails.

Dos problemas: es un N+1 de hasta 50 consultas secuenciales, y está acotado a los 50 últimos
**globales** — con catálogo real, un comprador cuya compra no esté entre las 50 últimas de toda la
plataforma simplemente **no se encuentra**, sin error ni aviso. Hoy no se dispara casi nunca
(`prepare_join` normaliza y exige teléfono), pero es una trampa que empeora al crecer.

**Y al ir a arreglarlo resultó ser peor: el plan B no podía funcionar nunca.** Se entra en esa rama
solo si no hay teléfono, y eso ocurre en dos casos, los dos sin salida por ahí:

1. Existe un `users` con ese email **pero sin teléfono** → el bucle acabaría encontrando **esa
   misma fila**, con el mismo teléfono vacío.
2. **No existe** ningún `users` con ese email → el bucle compara emails de *otros* usuarios y no
   coincide jamás. Y no puede haber una segunda fila con el mismo email: `users_email_key` es
   UNIQUE (INV-14).

Es decir: 51 consultas para no encontrar nada, en el mejor de los casos.

**Corregido (14 sep 2026).** Fuera el bucle. Si no hay teléfono se devuelve la lista vacía con un
aviso en el log. **Comprobado en producción:** 39 usuarios sin teléfono y **ninguno con compras** —
`prepare_join` exige y normaliza el teléfono, así que todo el que compra lo tiene, y los que no son
cuentas creadas al iniciar sesión, sin pedidos que enseñar. La lista vacía es la respuesta
correcta, y ahora cuesta una consulta en vez de 51.

---

## PARTE 4 · `/mis-grupos` Y `/notificaciones` CON SESIÓN INICIADA

**Sesión usada:** `benxaque@gmail.com` / `612278765`, que es la cuenta con la que Benjamin probó
los tres holds reales del 13 de septiembre. Devuelve exactamente 5 membresías, verificado contra
producción con `get_my_groups('612278765','benxaque@gmail.com')`:

| Producto | Grupo | Mi pago | Precio |
|---|---|---|---|
| Bicicleta Orbea Orca M30 | `open` | **released** | 1749 € |
| Sillín Fizik Antares R3 | `open` | **authorized** (hold vivo) | 85 € |
| Gafas Oakley Sutro Lite | `open` | **released** | 89 € |
| TEST · Algoritmo precio | `cancelled` | cancelled | 60 € |
| TEST · Algoritmo precio | `cancelled` | cancelled | 100 € |

Es el mejor caso de prueba posible: **los tres estados personales** (retenido, liberado,
cancelado) sobre **grupos que siguen abiertos**. Y es justo ahí donde la pantalla se rompe.

---

### 🔴 A-18 · A un comprador liberado a mano se le dice que el grupo fracasó — ✅ CORREGIDO 14 sep 2026
**Reproducir:** `/mis-grupos` con esa sesión, tarjeta de las **Gafas Oakley**.

Estado real, comprobado en producción con `tier_demand`:

| min_units | precio | demanda efectiva | desbloqueado |
|---|---|---|---|
| 1 | 115 € | 14 | ✅ |
| 10 | 99 € | 14 | ✅ |
| 18 | **89 €** | 18 | ✅ |

El grupo está **abierto, con 18 unidades y el mejor tramo ya desbloqueado**. Es el grupo que mejor
va del catálogo. A este comprador lo sacó el admin con el botón de liberar (RULE-062), no el
mercado. Y la pantalla le cuenta esto:

| Dónde | Lo que dice |
|---|---|
| Badge de la tarjeta | **«No alcanzado»** con icono de aspa |
| Donde va el contador | **«Finalizado»** |
| Bloque financiero | **«ESTADO FINAL · No alcanzado»** |
| Bajo la barra | **«18 / 18 uds en el grupo»** · **«Objetivo no alcanzado»** |
| Drawer, titular fijo | **«Por qué no se alcanzó»** |
| Drawer, explicación fija | **«El grupo no llegó al volumen mínimo a tiempo.»** |

Seis afirmaciones, las seis falsas, y la última **inventa una causa**. El grupo sí llegó al volumen
mínimo; de hecho llegó al tramo más barato. Lo que pasó es otra cosa que nadie le cuenta.

**Causa exacta.** `derive()` (`MisGruposDesktop.tsx:69-78`) colapsa **dos ejes distintos** en una
sola variable:

```ts
if (ps === 'released' || ps === 'cancelled' || ps === 'auth_failed' || m.status === 'cancelled')
  state = 'noalc'
```

- Eje 1 — **mi pago**: `authorized` / `released` / `paid` / `cancelled`
- Eje 2 — **el grupo**: `open` / `closed` / `cancelled`

`released` (eje 1) y `cancelled` del grupo (eje 2) acaban en el mismo cajón, `noalc`, y a partir de
ahí toda la tarjeta —badge, tiempo, colores, copy, drawer— se pinta como si hubiera fracasado el
grupo. El drawer «Devolución» tiene el texto de la causa **escrito a mano en el componente**
(línea 330), sin consultar nada.

**Agravante: nadie se lo dice.** Comprobado en `admin/grupos/[id]/actions.ts`: `releaseMember`
**no envía ningún email**. Cero. El comprador se entera —mal— solo si entra a `/mis-grupos` con
sesión, y 26 de 28 compradores no tienen cuenta (A-15). En la práctica: se le quita la plaza, se
le suelta el dinero, y no se le comunica.

**Por qué importa más de lo que parece.** Liberar es la única salida que tiene el operador cuando
alguien quiere salirse (decisión de producto ya tomada: no hay baja autoservicio). O sea que este
camino **no es un caso raro: es el camino previsto**. Y hoy termina en una pantalla que miente.

**Corregido (14 sep 2026).** `derive()` ya no colapsa los dos ejes. Nuevo estado **`liberado`**:

```ts
const groupFailed = m.status === 'cancelled'
if (ps === 'released' || ps === 'cancelled' || ps === 'auth_failed') {
  state = groupFailed ? 'noalc' : 'liberado'
} else if (groupFailed) {
  state = 'noalc'
} else if (...)
```

La regla es: **`noalc` solo si `groups.status = 'cancelled'`**. Comprobado contra producción, hoy
hay liberaciones en grupos `open` (2) y `closed` (1) que siguen adelante; ninguna de las tres es un
fracaso del grupo.

Lo que ve ahora un comprador liberado en un grupo vivo:

| Dónde | Antes | Ahora |
|---|---|---|
| Badge | «No alcanzado» + aspa | **«Plaza liberada»** (azul informativo, no gris de fracaso) |
| Contador | «Finalizado» | **el tiempo real del grupo**, que sigue corriendo |
| Bloque financiero | «ESTADO FINAL · No alcanzado» | **«TU PLAZA · Liberada»** |
| Barra + «18 / 18 uds» | barra llena al 100 % | **sin barra** (no participa: no hay progreso suyo que medir) |
| Etiqueta derecha | «Objetivo no alcanzado» | **«El grupo sigue abierto»** |
| Línea de estado | «Retención liberada · Sin cargos» | «Retención anulada · Sin cargos realizados» |
| CTA | «Ver devolución» | **«Ver qué ha pasado»** |
| Panel, titular | «Por qué no se alcanzó» | **«Tu plaza liberada»** |
| Panel, causa | «El grupo no llegó al volumen mínimo a tiempo» | **«Tu plaza en este grupo se ha liberado, así que ya no participas en esta compra»** + «El grupo sigue abierto» + botón **«Ver el grupo»** |

**Nota de honestidad en el copy:** el sistema **no sabe** por qué se liberó la plaza (¿la pidió el
comprador? ¿lo sacó el operador?). Así que el texto no lo afirma: dice *«tu plaza se ha
liberado»*, nunca *«has salido»* ni *«te hemos sacado»*. Si algún día se guarda el motivo, ese es
el sitio donde ponerlo.

`auth_failed` entra en el mismo estado con su propio texto («Pago no confirmado» / «No pudimos
confirmar la autorización de tu tarjeta»), en vez de heredar el de fracaso del grupo como hasta
ahora.

El panel `noalc` se queda solo para el fracaso real, y su causa fija pasa a ser cierta por
construcción: *«El grupo se canceló sin llegar al volumen mínimo.»*

**Tabla de verdad verificada** (`derive()` ejecutada con las 11 combinaciones, incluidas las 8 que
existen hoy en producción):

| mi pago | grupo | estado |
|---|---|---|
| released | open | **liberado** ✅ cambia |
| released | closed | **liberado** ✅ cambia |
| released | cancelled | noalc (sin cambio) |
| cancelled | cancelled | noalc (sin cambio) |
| auth_failed | open | **liberado** ✅ cambia |
| authorized | open | encurso / apunto (sin cambio) |
| authorized | closing | encurso (sin cambio) |
| paid / instructed | closing, closed | meta (sin cambio) |

**Lo que NO se ha hecho y sigue abierto:** `releaseMember` **sigue sin enviar ningún email**. La
pantalla ya no miente, pero el comprador solo se entera si entra con sesión. Requiere plantilla
nueva en `src/lib/emails/` y decidir qué motivo se comunica — decisión de producto pendiente.

**A-18b · La notificación heredaba la misma mentira — ✅ CORREGIDO.** `buildNotis()` decía
«Retención liberada · no se alcanzó el objetivo» para cualquier `released`. Ahora distingue:
«Tu plaza se ha liberado · retención anulada, sin cargos» frente a «El grupo no salió adelante ·
no se alcanzó el objetivo, sin cargos».

---

### 🟠 A-19 · La barra de progreso se ponía su propio listón — ✅ CORREGIDO 14 sep 2026
`derive()`:

```ts
const target = nextTier ? Number(nextTier.min_units) : currentUnits || m.quantity || 1
const pct    = target > 0 ? Math.min(100, Math.round((currentUnits / target) * 100)) : 100
```

Si no hay tramo siguiente, **el objetivo pasa a ser el número actual**. De ahí salen el
**«18 / 18 uds»** y el **«100 % completado»** del drawer: no es «18 de las 18 que hacían falta»,
es «18 de las 18 que hay». Un denominador que se cumple siempre.

En un grupo que ya tiene el mejor precio esa barra no comunica nada, y encima choca de frente con
el «Objetivo no alcanzado» de A-18. Cuando no queda escalera lo honesto es decirlo —«Precio mínimo
alcanzado»— y quitar la barra, que es justo lo que hace la etiqueta de la derecha en los estados
normales (`d.nextObj == null ? 'Precio mínimo'`). El estado `noalc` se salta esa rama.

**Corregido (14 sep 2026).** `derive()` devuelve ahora `hasNextTier`, y sin tramo siguiente no se
pinta barra ni porcentaje: la tarjeta dice **«18 uds en el grupo»** y el panel **«18 uds en el
grupo · Mejor precio alcanzado»**.

**Verificado ejecutando `derive()` con los datos reales:**

| Grupo | Antes | Ahora |
|---|---|---|
| Gafas (todos los tramos abiertos) | «18 / 18 uds · 100 % completado» | **«18 uds · Mejor precio alcanzado»** |
| Sillín (queda un tramo) | «12 / 25 uds · 48 %» | «12 / 25 uds · 48 %» (sin cambio) |

---

### 🟠 A-20 · «5 activos» contaba también lo cancelado y lo liberado — ✅ CORREGIDO 14 sep 2026
`MisGruposDesktop.tsx:121`:

```ts
const active = memberships.length
```

No filtra nada. Con esta sesión el encabezado dice **«5 activos»** cuando lo activo es **uno**: el
sillín. Los otros cuatro son dos liberados y dos cancelados. El único número de la pantalla que
resume la situación es el único que está mal.

**Corregido (14 sep 2026).** Activo = hay algo en marcha: retención viva o pago pendiente
(`authorized` o `instructed`) en un grupo que no se ha cancelado. `paid` no cuenta: está terminado.
Con esta misma sesión, el encabezado pasa de **«5 activos» a «1 activo»**.

(Solo afecta a escritorio: `MisGruposMobile` no pinta contador — que es el problema simétrico, ver
A-22.)

---

### 🔴 A-21 · `/notificaciones` dice «Todo tranquilo por ahora» con un pago retenido vivo — ✅ CORREGIDO 14 sep 2026
Esto es A-16 demostrado, y sube de 🟠 a 🔴.

Con la **misma sesión iniciada**, en la misma máquina, al mismo tiempo:

- `/mis-grupos` → 5 grupos, uno con **85 € retenidos en la tarjeta**
- `/notificaciones` → **«Todo tranquilo por ahora»** y el botón «Explorar grupos»

Y debajo, la frase que remata: *«Cuando te unas a un grupo, aquí verás cómo baja el precio y
cuándo se cierra»*. Se ha unido a cinco.

**Causa.** `notificaciones/page.tsx:45` no mira la sesión de Supabase en ningún momento:

```ts
const u = readLocalIdentity()
if (u.phone && u.email) { supabase.rpc('get_my_groups', { p_phone: u.phone, p_email: u.email }) }
else { setLoaded(true) }          // ← sin identidad local: vacío, sin decir por qué
```

`/mis-grupos` va por `/api/my-groups`, que **sí** lee la cookie de sesión y resuelve el teléfono
desde `users`. Dos pantallas hermanas, dos mecanismos de identidad, y ni uno consulta al otro. El
`else` silencioso es lo peor: no hay error, no hay «inicia sesión», hay una pantalla feliz de
usuario nuevo.

El estado vacío está **bien diseñado y mal condicionado**: es correcto para quien no ha comprado
nunca, y es una mentira para todos los demás. Y es la superficie a la que un comprador iría
precisamente a mirar cómo va su retención.

**Corregido (14 sep 2026).** La carga pasa a tener tres escalones, en este orden:

1. **La sesión.** `fetch('/api/my-groups')` — el mismo endpoint que ya usa `/mis-grupos`, que lee
   la cookie, resuelve el teléfono desde `users` y llama a `get_my_groups`. Si devuelve
   membresías, se acabó.
2. **La identidad local.** Solo si no hay sesión, o si la sesión no devuelve nada, se usa
   `readLocalIdentity()` como hasta ahora. Así el comprador invitado sigue funcionando igual.
3. **Nadie.** Si no hay ninguna de las dos, `identified = false`.

Y el estado vacío deja de mentir según el escalón. Con identidad conocida y cero grupos, sigue
diciendo «Todo tranquilo por ahora», que es correcto. **Sin identidad**, ahora dice:

> **No sabemos cuáles son tus grupos**
> Si ya has comprado en Gropo, entra con el mismo email que usaste y verás tus grupos y sus
> retenciones.
> **[Entrar con mi email]** · Explorar grupos

Eso además ataca la mitad barata de **A-15**: la vía de recuperación por email existía y nadie la
comunicaba. Ahora se comunica al menos en esta pantalla. Falta hacerlo en los emails
transaccionales y en el propio login.

---

### 🟠 A-22 · `/notificaciones` no era un feed, era `/mis-grupos` otra vez — ✅ CORREGIDO 14 sep 2026
`buildNotis()` mapea **una notificación por membresía, siempre**. No hay eventos, ni fechas, ni
leído/no leído, ni nada que aparezca o desaparezca. Un comprador con 5 grupos verá para siempre
las mismas 5 filas, con títulos en presente continuo: *«Tu plaza sigue asegurada»*, *«El precio
sigue bajando mientras entra gente»*.

Eso no es una notificación: es un estado, y ya está —mejor contado— en la tarjeta de
`/mis-grupos`. La pantalla promete novedades y entrega un duplicado.

Es la otra cara de A-16: no sobra una pantalla, **falta decidir qué es cada una**. Una opción
razonable es que `/notificaciones` muestre solo lo que ha **cambiado** (bajó el tramo, quedan menos
de 24 h, se cerró, te liberamos) con marca de tiempo, y que el estado permanente viva solo en
`/mis-grupos`.

**Decidido e implementado (14 sep 2026).** Benjamin cerró la pregunta: se **mantiene**
`/notificaciones`, convertida en **Purchase Activity Feed**. Cada pantalla responde una pregunta y
no se pisan — `/mis-grupos` el estado actual, `/notificaciones` lo que ha cambiado. La
especificación completa —los siete tipos, de dónde sale cada uno y qué queda fuera— está en
`UX_AND_FLOWS.md` §3-bis, que es donde le toca vivir.

Lo que hizo falta averiguar antes de escribir nada: **los eventos ya existían**. `events` guarda
`member_joined`, `price_dropped` y `group_closed` desde el 29 de agosto, y su política RLS ya
permite leerlos desde el cliente (todo menos `petition_created`), así que el feed no abre ninguna
superficie nueva: lee la misma tabla que la ficha ya escucha en tiempo real.

Dos de los siete tipos —«estás cerca del siguiente precio» y «tu grupo cierra pronto»— **no son
eventos**: son estado vivo, no dejan rastro y se derivan al mirar. Van marcados aparte, bajo
«Ahora», porque son lo único sobre lo que el comprador todavía puede actuar.

**Verificado ejecutando la lógica contra los 24 eventos reales** de la cuenta de Benjamin, con
siete comprobaciones: que salen los siete tipos, que un grupo ajeno queda fuera, que las pujas de
vendedor no entran (INV-17), que una plaza liberada no genera avisos vivos, que tres entradas
seguidas se agrupan en una, que los vivos van primero, y que **un cierre sin `result` no se inventa
la causa** — ese último caso existe en producción y mi primera versión sí se la inventaba.

**Y algo que apareció de camino:** la pantalla **no tenía ninguna entrada de navegación**. Ni en la
barra inferior ni en la de escritorio, y la campana de la home llevaba a `/favoritos`. El feed
existía y no se podía llegar a él.

---

### 🟡 A-23 · El botón «Comparte con un amigo» no hacía nada — ✅ CORREGIDO 14 sep 2026
`MisGruposDesktop.tsx:284`:

```tsx
<button className="w-full rounded-xl py-3.5 ...">{I.share} Comparte con un amigo</button>
```

Sin `onClick`. Es el **único** botón del panel «Ver estado de tu plaza», el que sale en móvil y en
escritorio, y justo encima el propio panel pide compartir: *«Comparte tu enlace y baja el precio
para todos»*. El mecanismo ya está resuelto en otros tres sitios del código
(`PostCheckoutView.tsx`, `GroupDesktopView.tsx`, `RadarCardMenu.tsx`, todos con `navigator.share`
y copia al portapapeles). Aquí solo falta enchufarlo.

Que la palanca de crecimiento del modelo sea un botón muerto en la pantalla donde el comprador ya
está comprometido es, de todos los hallazgos pequeños, el más caro.

**Corregido (14 sep 2026).** `navigator.share` donde existe —móvil, que es donde se comparte— y
copia al portapapeles donde no, con el mismo patrón que ya usaban los otros tres sitios. Dos
detalles que no son cosméticos:

- **La URL sale de `SITE_URL`**, no de `window.location.origin`. El enlace que alguien comparte
  tiene que ser el canónico: es exactamente lo que se arregló el 12 de septiembre cuando los
  enlaces seguían apuntando a `vonda.es`.
- **Feedback obligatorio.** Copiar al portapapeles sin decirlo es invisible, y el usuario vuelve a
  pulsar creyendo que no ha funcionado. El botón pasa a «Enlace copiado» durante dos segundos.

---

### 🟡 A-24 · Datos de prueba dentro de la cuenta de un comprador
Dos tarjetas **«TEST · Algoritmo precio»** (grupos `a0000000-…-0001`, `cancelled` desde el 8 de
septiembre, sin imagen) aparecen en `/mis-grupos` como pedidos del usuario, con su placeholder gris
y su «Retención liberada · Sin cargos realizados».

Hoy solo lo ven las dos cuentas de Benjamin. Pero esas filas son `group_members` reales en la base
de datos de producción: **no hay ninguna separación entre datos de prueba y datos de cliente**. El
día que un test se ejecute con un email real, ese comprador verá el pedido. Conviene decidir un
convenio —prefijo de UUID reservado, o una columna `is_test`— y filtrarlo en `get_my_groups` antes
de que haya clientes de verdad.

**Comprobado en producción el 15 sep 2026.** El convenio **ya existe**: la columna se llama
`groups.is_demo` y RULE-018 la usa para excluir los grupos de prueba de la home y de las
sugerencias del Radar. El problema es que está a medias:

| | |
|---|---|
| `a0000000-…-0001` · `TEST · Algoritmo precio` | `cancelled`, **`is_demo = false`** ← el que se cuela en «Mis grupos» |
| `a0000000-…-0006` · `TEST · P0-06 diagnóstico` | `closed`, `is_demo = true` |
| `a0000000-…-0007` · `TEST · Ensayo 3 — esperadores` | `closed`, `is_demo = true` |

Y `get_my_groups` **no filtra `is_demo`** — verificado extrayendo la definición real de la función
con `pg_get_functiondef`, no leyendo el repositorio.

Así que el arreglo tiene dos mitades y **ninguna la puedo hacer solo**, porque las dos escriben en
producción:

1. Marcar `is_demo = true` en `a0000000-…-0001`. Un `UPDATE` de una columna no económica sobre un
   grupo de prueba ya cancelado.
2. Añadir el filtro a `get_my_groups`. Es una función `SECURITY DEFINER` viva: cambiarla es una
   migración.

**Y antes hay una pregunta de producto.** Si `get_my_groups` filtra los grupos de prueba, Benjamin
deja de ver sus propias compras de prueba en «Mis grupos», que es donde las comprueba. La
alternativa es no ocultarlas sino **etiquetarlas** («Pedido de prueba») y que un comprador real
nunca llegue a tener una. Son dos productos distintos; decide él.

**Nota de documentación.** `BUSINESS_RULES.md` afirmaba que «no existe ningún grupo `is_demo=true`
en producción». Hay dos. Corregido, y RULE-018 baja a `PARTIALLY IMPLEMENTED`.

**Decisión de Benjamin (15 sep 2026): aplazado.** No se toca producción por ahora. Es defendible
mientras las únicas cuentas afectadas sean las suyas. **Pero esto tiene que estar cerrado antes de
que exista el primer cliente real**, y no depende de que a alguien se le ocurra: el día que un
test corra con un email de verdad, ya es tarde. Queda en la lista de bloqueantes de lanzamiento.

---

### Lo que sí está bien en estas pantallas
No todo es hallazgo. Conviene dejarlo escrito para no «arreglarlo» por error:

- **Los números son correctos.** `currentUnits = max(effective_demand)` sí equivale a las unidades
  comprometidas del grupo (la demanda efectiva es máxima en el tramo más barato, donde entran
  todos), y `missing` cuadra: sillín 12 / 25 → faltan 13. Verificado contra `tier_demand`. No es
  otro caso de la familia P2-01.
- **El panel del hold es excelente.** «Mi compromiso 85 € / Estado actual 85 € / Próximo objetivo
  75 € · Faltan 13 uds», el escudo con *«Solo se cargará si el grupo alcanza el objetivo»* y el
  sello de Stripe con «Retención activa» explican el modelo mejor que cualquier pantalla previa a
  la compra. **Parte de esto debería estar antes de pagar, no después** (ver A-03).
- **El placeholder de imagen es el diseñado**, no una foto rota: `MgCard` pinta un icono gris
  cuando `image_url` es `null`. Lo que sobra son los grupos, no el icono.
- **El estado liberado se cuenta bien en la parte del dinero**: «Retención liberada · Sin cargos
  realizados» y, en el drawer, *«La retención de 89 € ha sido anulada»*. Lo que falla es todo lo
  que lo rodea (A-18).

---

## PARTE 5 · EL CHECKOUT COMPLETO (`/grupo/[id]/unirme`)

Auditado el 14 de septiembre de 2026 leyendo `JoinFlow.tsx` (1.235 líneas),
`api/join/create-intent/route.ts` y `lib/phone.ts`. El flujo del dinero —hold, idempotencia,
`prepare_join` como autoridad, reloj de seguridad de P0-06— **está bien construido y no se toca
aquí**. Todo lo que sigue ocurre antes: en el formulario.

### 🔴 A-25 · El email se validaba al LEER, no al escribir — ✅ CORREGIDO 14 sep 2026

> **Corrección de este hallazgo.** Lo escribí primero como «no se valida en ninguna capa».
> **Era falso**, y la realidad resultó ser peor. `get_my_groups` **sí** valida el formato — y
> cuando falla devuelve una lista vacía, en silencio. Lo encontré al ir a implementar el arreglo.

| Capa | Qué comprueba |
|---|---|
| `JoinFlow.handleSubmit` | solo `c.email.trim()` **no vacío** |
| El `<input type="email">` | **nada**: no está dentro de un `<form>`, así que el navegador nunca valida |
| `create-intent` | solo que el campo **exista** (`if (!email) …`) |
| `prepare_join` / `confirm_join` | normalizan y exigen el **teléfono**; el email no lo miran |
| **`get_my_groups`** | **sí valida**: `v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'` → **`{"groups": []}`** |
| **`_profile_uid`** | **sí valida**: mismo patrón → devuelve `null` |

El sistema conocía la regla. La aplicaba en el sitio equivocado —a la salida en vez de a la
entrada— y en vez de avisar, **devolvía vacío**. Comprobado en producción:

```sql
select get_my_groups('656789098', 'pepe');                    -- → {"groups": []}
select get_my_groups('656789098', 'thedesignerux@gmail.com'); -- → 5 grupos
```

En pantalla, esa lista vacía es literalmente *«Todo tranquilo por ahora»* y *«Aún no participas en
ningún grupo»*. Con el dinero retenido en la tarjeta. Es la misma familia que A-21: pantalla feliz,
dato ausente, ningún error.

Así que `pepe` o `pepe@gmial.com` entran, se guardan en `users.email` y se convierten en el
destinatario de todo. Y el email no es un dato de contacto cualquiera: es **la llave**.

- Es a donde va la confirmación de compra y las instrucciones de pago.
- `get_my_groups(phone, email)` exige que **coincidan los dos**. Un email mal escrito hace que
  `/mis-grupos` y `/notificaciones` no encuentren nunca ese pedido.
- Es la vía de recuperación de A-15, la única que tiene el comprador invitado.

Resultado de un solo carácter de más: **dinero retenido en la tarjeta, ningún email, y el pedido
invisible en las dos pantallas que existen para consultarlo.** Y el comprador no tiene forma de
enterarse, porque la ausencia de email es indistinguible de un correo que tarda.

**Hoy no ha pasado:** los 158 usuarios de producción tienen email con formato válido (0
inválidos, comprobado). Son Benjamin y datos demo. En un checkout móvil real, los errores de
tecleo en el email rondan el 1-2 %.

**Corregido (14 sep 2026).** Nuevo `src/lib/email.ts` con `isValidEmail` y `normalizeEmail`, y la
comprobación en las dos capas que importan:

1. **`create-intent`, que es la autoridad** — rechaza con 400 **antes** de crear el `PaymentIntent`.
   Ninguna dirección imposible llega a retener dinero.
2. **`JoinFlow`, para avisar antes de pagar** — el mensaje se pinta **junto al campo de email**, con
   el borde en rojo, `aria-invalid`, `aria-describedby` y el foco puesto ahí. No en el aviso global
   del final, que está detrás de la sección 3 mientras el submit hace scroll hacia arriba: ahí no se
   ve (A-26). El mensaje desaparece al corregir el campo.

**La regex es literalmente la misma que la de `get_my_groups`**, a propósito. Si el checkout fuera
más laxo quedaría una franja de emails que se aceptan al comprar y se rechazan al recuperar — el
mismo agujero con otra forma. Verificado con 16 casos, cliente contra SQL:

| Rechazan los dos | Aceptan los dos |
|---|---|
| `pepe` · `pepe@` · `@gmail.com` · `pepe@gmail` · `pepe@@gmail.com` · `pepe gonzalez@gmail.com` · vacío · espacios | `pepe@gmail.com` · `Pepe@Gmail.COM` · `  pepe@gmail.com  ` · `pepe.gonzalez+ofertas@correo.co.uk` · `a@b.c` · las tres cuentas reales de producción |

**Cero discrepancias.** Y comprobado que ninguno de los 158 usuarios existentes tiene un email que
el validador nuevo rechazaría: nadie se queda fuera.

Además se guarda el email **recortado** (`trim`). No es cosmético: la comparación del lado SQL es
`lower(u.email) = v_email` **sin `trim` en la columna**, así que un espacio pegado —lo normal al
pegar desde otra app— dejaba el pedido irrecuperable para siempre. No se aplica `lower` al guardar:
la comparación ya lo hace, y cambiar cómo se escriben los datos de producción es otro asunto.

**Lo que NO se ha hecho:** pedir el email dos veces para confirmarlo. Es una decisión de producto
—añade fricción justo donde menos interesa— y esto ya cubre lo que era un fallo.

---

### 🟠 A-26 · «Completa todos los campos» no decía cuál, y se pintaba donde no se ve — ✅ CORREGIDO 14 sep 2026
Ocho campos obligatorios —nombre, apellidos, email, teléfono, dirección, código postal, ciudad,
provincia— y **un solo booleano** para todos:

```ts
const missing = !c.nombre.trim() || !c.apellidos.trim() || … || !s.province;
if (missing) {
  datosRef.current?.scrollIntoView(...)          // sube a «1. Tus datos»
  setError("Completa todos los campos antes de continuar.")
}
```

Dos problemas, y el segundo es peor que el primero:

1. **No dice cuál falta.** Con ocho campos y el que falla siendo casi siempre la provincia —el
   único `<select>`, y el último— el comprador tiene que revisarlos todos a ojo.
2. **El mensaje se pinta al final del formulario**, después de la sección «3. Pago seguro», pero
   el código acaba de hacer **scroll hasta arriba**. Es decir: la pantalla salta al principio y el
   aviso se queda fuera de vista, detrás de tres secciones y del footer fijo. El comprador ve que
   algo se mueve y que no pasa nada más.

Lo correcto es marcar el campo que falla, poner el mensaje junto a él y llevar el foco ahí
(`ref.focus()`, no solo `scrollIntoView`). El `role="alert"` ya está puesto; lo que falta es que
el mensaje esté donde se mira.

**Corregido (14 sep 2026).** Se revisan los ocho campos y se marca **cada uno** que falla, con su
mensaje debajo, borde rojo, `aria-invalid` y `aria-describedby`. El foco va al **primero en orden
de pantalla** —que es lo que anuncia un lector de pantalla y lo que abre el teclado del móvil— y el
mensaje de un campo desaparece en cuanto se corrige.

«Completa todos los campos» → **«Falta tu nombre»**, **«Falta el código postal»**, **«Elige tu
provincia»**… El aviso global se reserva para lo que sí es global: fallos de Stripe, de red y
rechazos del servidor.

---

### 🟠 A-27 · Ocho campos sin etiqueta y sin autocompletado — ✅ CORREGIDO 14 sep 2026 (parcial)
Todos los campos usan **solo `placeholder`**: ni `<label>`, ni `id`/`htmlFor`, ni un solo
`autoComplete`.

Tres consecuencias, en orden de coste:

1. **El autorrelleno del móvil no funciona.** Sin `autocomplete="given-name"`, `"family-name"`,
   `"email"`, `"tel"`, `"address-line1"`, `"postal-code"`, `"address-level2"`,
   `"address-level1"`, ni iOS ni Android ni el navegador ofrecen rellenar la dirección. Son ocho
   campos tecleados a mano en una pantalla pequeña, en el punto de máxima fricción del embudo.
   Es el hallazgo de esta parte con efecto más directo sobre la conversión.
2. **Al escribir, la etiqueta desaparece.** Es el defecto conocido del placeholder-como-etiqueta:
   al revisar el formulario antes de pagar, el comprador ve ocho cajas con texto y ninguna dice
   qué es cada cosa.
3. **Accesibilidad.** Un lector de pantalla anuncia el placeholder de forma inconsistente según
   navegador; sin `<label>` asociada no hay nombre accesible fiable (WCAG 3.3.2). El resto del
   checkout sí cuida esto —los botones de cantidad llevan `aria-label`, el error lleva
   `role="alert"`—, lo que hace pensar que es un descuido, no una decisión.

Hay un matiz a favor del diseño actual: el checkout **precarga** nombre, teléfono, email y
dirección de quien ya compró antes (`readLocalIdentity` + `get_profile`), y lo avisa con *«Tu
dirección guardada · puedes editarla»*. Eso está bien resuelto. Pero solo cubre al comprador
recurrente; el primero, que es el que importa para crecer, teclea los ocho campos.

**Corregido (14 sep 2026) — y digo *parcial* a propósito.** Nuevo componente `Field` con `id`,
`<label>` asociada y el `autoComplete` que le toca a cada campo: `given-name`, `family-name`,
`email`, `tel-national` (+ `type="tel"`), `address-line1`, `postal-code`, `address-level2` y
`address-level1`.

Eso arregla los puntos **1 y 3**: el autorrelleno del móvil funciona y cada campo tiene nombre
accesible.

**El punto 2 sigue abierto**, y es deliberado: la etiqueta va en `sr-only`, así que al escribir
sigue sin verse qué es cada caja. Hacerla visible cambia la altura del formulario y el aspecto de
la pantalla, y **eso es criterio visual de Benjamin, no mío**. Queda propuesto, no hecho.

---

### 🟠 A-28 · El checkout no menciona términos, privacidad ni desistimiento — ⚠️ MITAD DE PRODUCTO CERRADA 15 sep 2026
**Comprobado:** cero apariciones de «términos», «condiciones», «privacidad», «desistimiento»,
«RGPD», «aceptas» o «al continuar» en todo el flujo de checkout (`unirme/` y `components/checkout/`).

En esa pantalla el comprador entrega nombre, apellidos, email, teléfono y dirección postal
completa, y autoriza una retención en su tarjeta. No hay un enlace legal, ni una casilla, ni una
línea que diga qué se hace con esos datos.

No soy abogado y no voy a decir qué exige la ley española en este caso. Lo que sí puedo afirmar es
lo que hay: **nada**. Y que esto se junta con **L-03 / RULE-063** (el derecho de desistimiento en
una compra colectiva, que ya estaba pendiente de consulta). Son la misma visita al abogado, y es
una de las pocas cosas de esta auditoría que **bloquea el lanzamiento**, no la conversión.

Lo que el checkout sí hace bien, y conviene no perderlo al añadir lo legal: explica la mecánica
del dinero en el momento justo, con tres variantes según el modo — *«Hoy no se te cobra nada:
retenemos X en tu tarjeta y al cierre se cobra el precio final, que puede ser menor»*, *«Solo
pagas si el gropo baja a tu precio objetivo»*, *«El grupo ya alcanzó tu precio objetivo…»*. Esa
honestidad es el activo del producto.

**Lo hecho el 15 de septiembre.** Existen diez documentos legales en `src/content/legal/`, una
ruta `/legal/[slug]` que los pinta, un índice en `/legal`, un pie de página en las pantallas
públicas y, en el checkout, un bloque con la obligación de pago y enlaces a Condiciones de compra,
Devoluciones y Privacidad, más una línea de aceptación pegada al botón. El comprador ya no firma
a ciegas: puede leer bajo qué condiciones lo hace.

**Lo que NO se ha cerrado, y hay que decirlo claro.** Los textos son un borrador. Llevan huecos
(`[RAZÓN SOCIAL]`, `[NIF]`, `[FECHA]`…) porque la sociedad todavía no está constituida, y las
páginas se marcan `noindex` automáticamente mientras los tengan. La mitad jurídica de A-28 sigue
abierta y sigue bloqueando el lanzamiento: hacen falta un abogado español y, antes que él, cuatro
respuestas que solo puede dar Benjamin (razón social, quién emite la factura, cómo está montado
Stripe Connect, y quién asume devoluciones y contracargos). Ver `docs/LEGAL.md`.

La baja de 🔴 a 🟠 mide exactamente eso: ya no falta *nada*, falta la validación.

---

## PARTE 6 · LA VISTA DE ESCRITORIO

Móvil y escritorio son **dos árboles de UI separados** (DT-03). Esta parte audita el de
escritorio, que hasta ahora no se había mirado. El resultado se resume en una frase: **no es una
versión ancha del móvil, es una versión distinta y más antigua**.

### 🔴 A-29 · El panel de compra de escritorio recibía tres datos y no usaba ninguno — ✅ CORREGIDO 14 sep 2026
`GroupRightSidebar` es la tarjeta de compra de la ficha en escritorio. Su `interface Props`
declara `pvp`, `maxStock` y `closesAt`, y `GroupDesktopView` se los pasa. Pero la función
**no los desestructura**:

```ts
export default function GroupRightSidebar({
  groupId, name, spec, imageUrl, tiers,      // ← faltan pvp, maxStock y closesAt
}: Props) {
```

Tres props muertas, y dos de ellas son reglas de negocio. Lo que provoca cada una:

**1. Sin `closesAt` → A-11 sigue vivo en escritorio.** El arreglo del 14 de septiembre —píldora
«Cerrado», botón deshabilitado, `handleCheckout` con salida temprana— se hizo **solo en
`GroupLiveSection`, que es el móvil**. En escritorio no hay `hasClosed`, no hay píldora de estado,
y el único `disabled` de la CTA es la animación (`lockPhase > 0`). **Un grupo con el plazo vencido
sigue ofreciendo «Bloquear precio · 1499 €» en pantalla grande.**

El servidor sí protege: `prepare_join` rechaza desde el mismo día. Así que no se puede cobrar. Pero
la pantalla vende y el rechazo llega después de pulsar, en forma de error. Es exactamente la
contradicción que A-11 vino a quitar, intacta en la mitad del producto.

*Esto es un fallo mío:* al cerrar A-11 verifiqué el móvil y di el hallazgo por cerrado sin
comprobar que existía un segundo árbol de UI para la misma pantalla.

**2. Sin `maxStock` → el selector de cantidad topa en 10 fijo.**

```ts
onClick={() => setQuantity(q => Math.min(10, q + 1))}
```

En las gafas quedan 2 unidades (A-12) y en escritorio se pueden pedir 10. El checkout sí respeta el
stock (`remainingStock`, P2-01) y `prepare_join` rechaza en servidor, así que no se vende lo que no
hay — pero el comprador elige 10, pulsa, y el sistema le dice que no. Es el mismo error de P2-01,
en el árbol que no se revisó.

**3. Sin `pvp` → en escritorio no existe el ahorro.** Ni precio tachado ni «Ahorras X». El
argumento económico más fuerte del producto está en la home y en la ficha móvil, y desaparece en
la ficha de escritorio. Empalma con A-14.

**Corregido (14 sep 2026).** Las tres props se reciben y se usan:

| | Antes | Ahora |
|---|---|---|
| `closesAt` | ignorado | **`hasClosed`** con el mismo patrón que `GroupLiveSection` —se calcula tras montar para no romper la hidratación, y con intervalo para apagarse solo—. Píldora **«Cerrado»**, encabezado que pasa a «Precio al cierre», el bloque «Siguiente» desaparece, el slider y el selector se deshabilitan y la CTA queda gris con **«Este grupo ya ha cerrado»** |
| `maxStock` | selector topado en **10 fijo** | tope real: `maxStock − unidades comprometidas`, acotado a 10. Si no queda nada, CTA **«Sin unidades disponibles»** |
| `pvp` | ignorado | precio tachado + **«Ahorras X»**, como en móvil |

**Verificado con los datos reales de producción:**

| Grupo | `max_stock` | Comprometidas | Tope antes | Tope ahora |
|---|---|---|---|---|
| Gafas Oakley | 20 | 18 | **10** | **2** ✅ (coincide con A-12) |
| Sillín Fizik | 50 | 12 | 10 | 10 (sin cambio, correcto) |
| Shimano 105 Di2 | — | — | CTA activa | **«Este grupo ya ha cerrado»** ✅ |

La autoridad sigue siendo `prepare_join`: esto solo evita **pedir** lo que ya no existe.

De paso, la variable que cuenta el grupo se llamaba `totalParticipants` y **no son personas: son
unidades** (es el máximo de la demanda efectiva, que en el tramo más barato equivale a la suma de
`group_committed_units`). Se ha renombrado a `committedUnits` para que el siguiente no se
confunda. El copy visible sigue diciendo «personas» — eso es **A-04**, que sigue abierto.

---

### 🔴 A-30 · «✓ Precio bloqueado» aparecía 800 ms antes de que existiera nada — ✅ CORREGIDO 14 sep 2026
Al pulsar la CTA de escritorio, `handleBuy` hace esto:

```ts
setLockPhase(1)                                  // 0 ms   — flechas girando
setTimeout(() => setLockPhase(2), 1000)          // 1000 ms — la CTA dice «✓ Precio bloqueado»
setTimeout(() => { /* abrir checkout o navegar */ }, 1800)   // 1800 ms — recién empieza
```

En el segundo 1,0 el botón afirma que el precio está bloqueado. En ese instante no hay hold, no hay
`PaymentIntent`, no hay membresía, no se ha llamado a nada: el comprador **ni siquiera ha visto el
formulario de pago**. La confirmación llega 800 ms antes que el primer byte de la operación.

Es el mismo error que **P0-03** —«JoinFlow muestra éxito sin esperar al webhook»—, que se dio por
resuelto el 12 de septiembre. Y choca de frente con el principio del propio proyecto: *nunca
mostrar una confirmación económica que el sistema todavía no puede garantizar*.

> ⚠️ **Corrección (14 sep 2026).** Escribí que en móvil esto ya estaba corregido por P0-03. **Era
> falso.** P0-03 corrigió `JoinFlow`, que es el **checkout**; la **ficha** móvil
> (`GroupLiveSection`) tenía el mismo `lockPhase` con los mismos 1.000 y 1.800 ms, y el mismo
> «✓ Precio bloqueado». Lo encontré al ir a implementar A-01 en ese archivo. Corregido en los dos.

Además de mentir, **cuesta 1,8 segundos** de espera fabricada en la pantalla de máxima intención de
compra. La animación no está esperando a nada: es un temporizador.

**Corregido (14 sep 2026).** Fuera `lockPhase` y los dos `setTimeout`. La acción arranca **en el
clic**; queda un `busy` que solo sirve para lo que debe servir: impedir el doble clic. El botón ya
no afirma nada que no haya ocurrido —dice «Abriendo…» mientras navega— y **«✓ Precio bloqueado» ha
desaparecido**, porque en esa pantalla nunca hubo nada bloqueado.

---

### 🟠 A-31 · Dos vocabularios completos para el mismo producto — ✅ CORREGIDO 14 sep 2026 (el CTA)
No son matices de redacción; son palabras distintas para las mismas cosas, en las dos mitades del
mismo producto:

| La misma idea | Escritorio | Móvil |
|---|---|---|
| La acción principal | **«Bloquear precio · 85 €»** | **«Asegurar hasta 85 €»** / «Fijar límite en…» |
| El grupo destacado | «Grupo destacado» | «★ Gropo destacada» (además cambia de género) |
| Ir a la home | «Explorar» | «Inicio» |
| El ahorro | «Ahorra 40 €» | «Ahorras 40 €» |
| La rejilla de grupos | «Grupos abiertos» | «Más grupos abiertos» |
| Cuánta gente hay | «12 personas en el grupo» | «12 confirmados» |
| Volver atrás | «← Volver a los grupos» | solo un icono |

Y hay cosas que existen en una mitad y no en la otra:

- **«¿Cuál es el máximo que pagarías?»** —la pregunta rectora del producto— **solo está en
  móvil**. El slider de escritorio no tiene encabezado. El comentario del código en
  `GroupLiveSection.tsx:176` afirma lo contrario («solo existía en escritorio»): la documentación
  del propio código está al revés de la realidad.
- El **estado del grupo** («Disponible» / «En espera» / «Cerrado») solo existe en móvil.
- En móvil la ficha **no tiene selector de cantidad**: fija `quantity: 1`. En escritorio sí lo hay.
  La misma pantalla ofrece decisiones distintas según el tamaño del navegador.
- **«Pago 100 % seguro con Stripe»** solo aparece en escritorio.

Esto es DT-03 cobrándose su precio: cada arreglo de copy hay que hacerlo dos o tres veces, y los
hallazgos de esta auditoría —A-01, A-04, A-12, A-13— habrá que corregirlos por duplicado.

**Corregido (14 sep 2026) — el CTA, que es lo que más pesa.** Decisión de Benjamin: **fuera
«Bloquear precio» de todo el producto**, y una sola jerarquía —Acción: *asegurar* · Límite: *hasta
X €* · Concepto: *precio máximo* · Resultado: *precio final* · Estado: *plaza asegurada*—. El
léxico queda fijado en `PRODUCT_PRINCIPLES.md` §7 para que no vuelva a divergir.

`Asegurar hasta 85 €` es ahora el mismo texto en las **cuatro** superficies de compra (ficha móvil,
ficha escritorio, tarjeta de la home, Mi Radar), y desaparecen «Bloquear precio · X», «Bloquear
precio · Máx. X» y «Fijar límite en X».

El motivo de fondo no es la consistencia: **«bloquear» afirma que el precio queda fijado, y el
modelo entero consiste en que puede bajar después.** Ese verbo ya causó un problema real, el
«✓ Precio bloqueado» de A-30.

**Sigue abierto el resto de A-31:** «Explorar» vs «Inicio», «Grupo destacado» vs «★ Gropo
destacada», «Ahorra» vs «Ahorras», «Grupos abiertos» vs «Más grupos abiertos», y el selector de
cantidad que existe en escritorio y no en móvil. Son de navegación y de estructura, no del flujo de
compra.

---

### 🟠 A-32 · El checkout no tiene vista de escritorio — ✅ CORREGIDO 15 sep 2026
`/grupo/[id]/unirme` y `/grupo/[id]/unido` se pintan en una columna de **512 px centrada**
(`max-w-md lg:max-w-lg`), sin barra de navegación, en una pantalla de 1.440. También `/login` y
`/crear-peticion`, y la rama sin sesión de `/mis-grupos`.

Que el checkout sea de una columna es defendible —reduce distracción—, pero hoy no es una decisión
de diseño: es la ausencia de una. La barra de acción queda fija abajo del **viewport completo**,
lejísimos del formulario; el resumen del pedido y el formulario no pueden verse a la vez, cuando en
escritorio cabrían en dos columnas; y no hay navegación para volver.

Es la pantalla donde se firma, y es la menos trabajada de las dos versiones.

**Una corrección a este hallazgo.** «No hay navegación para volver» es **falso**: la cabecera de
`unirme/page.tsx` tiene una flecha atrás con `aria-label="Volver al gropo"` que enlaza a
`/grupo/[id]`. La escribí sin comprobarla. Es la misma familia de error que las tres afirmaciones
de ausencia del día 14 — ver la lección 2 al final de este documento.

**Lo hecho.** En `lg` el contenedor pasa de 512 px a 1.040 y `JoinFlow` reparte el contenido en
dos columnas: formulario y pago a la izquierda, producto y progreso del grupo a la derecha, ambos
visibles a la vez. La barra de acción deja de estar fija al borde inferior del viewport y pasa a
ser **pegajosa dentro de su columna**, siempre junto a los campos que se están rellenando. En
móvil no hay rejilla y todo queda exactamente como estaba.

El diff son clases de Tailwind y tres `<div>` de colocación: **ni una línea de la lógica de
dinero cambia**. Comprobado con `git diff` línea a línea.

**Lo que NO se ha tocado, a propósito.** `/grupo/[id]/unido` sigue en una columna de 512 px. Es
un justificante, no un formulario: una sola columna es la forma correcta de leerlo. `/login`,
`/crear-peticion` y la rama sin sesión de `/mis-grupos` siguen igual; son pantallas de un solo
campo y no tienen el problema que tenía el checkout.

**Sin verificar:** nadie lo ha mirado todavía en un navegador de escritorio real. El riesgo es
visual, no funcional, pero es criterio de Benjamin.

---

### 🟡 A-33 · Avatares inventados — ✅ CORREGIDO 15 sep 2026
`GroupRightSidebar` pinta los participantes así:

```ts
const AVATAR_LETTERS = ['A', 'B', 'C']
```

Tres círculos con las letras A, B y C, y un «+17». No son personas: son constantes. Nadie se llama
A. Con un grupo de verdad detrás, inventar identidades para adornar la prueba social es
exactamente el tipo de detalle que un comprador desconfiado detecta, y contradice la transparencia
que el resto del producto se ha ganado. O se usan iniciales reales, o se cuenta el número y ya.

**Estaba en tres sitios, no en uno.** Al ir a corregirlo apareció el mismo `['A', 'B', 'C']` en
`GroupRightSidebar` (escritorio), en `GroupLiveSection` (ficha móvil) y en `GroupsGrid` (tarjetas
de la home). Este documento solo había visto el primero. **Tercera vez** que un hallazgo estaba
vivo en más árboles de UI de los que decía el hallazgo.

Y en las tarjetas era peor: las tres letras se pintaban **siempre**, incluso con el grupo vacío.
Prueba social de cero personas.

**Lo hecho.** Un componente único, `GroupPeopleGlyph`, con un símbolo anónimo de grupo. No afirma
identidades, y con cero personas no se pinta nada. La frase de al lado ya dice el número real
—«N personas ya han pedido M unidades»— así que no se pierde información: se pierde el adorno
falso. Además el recuento de avatares del panel de escritorio se calculaba con **unidades** y no
con personas (A-04 otra vez); al desaparecer, desaparece el error.

---

### 🟡 A-34 · Seis de los doce componentes de escritorio no los usa nadie — 📋 VERIFICADO Y DOCUMENTADO 15 sep 2026
710 líneas sin una sola referencia en todo `src/`: `DesktopProductCard` (207), `HomeProductCard`
(165), `GroupSidebar` (169), `HomeSidebar` (139), `HomeCarousel` (74), `GroupCenterContent` (23).

`GroupSidebar` es el más llamativo: implementa pestañas de **Conversación, Participantes,
Historial, Preguntas y Alertas** que no existen en el producto. Es un diseño anterior que quedó en
el repositorio.

No es urgente, pero sí es una trampa: cualquiera —persona o IA— que abra `DesktopProductCard.tsx`
para arreglar una tarjeta estará editando código muerto. Merece una nota en `TECHNICAL_DEBT.md` o
un borrado limpio.

**Verificado componente a componente el 15 sep 2026:** los seis tienen cero importaciones. La
única aparición de `DesktopProductCard` fuera de su fichero es un **comentario** en
`src/lib/mock-data.ts:42`. Documentado en `TECHNICAL_DEBT.md` DT-04, con el comando exacto de
borrado. **No lo he borrado yo**: borrar ficheros del repositorio es una decisión de Benjamin y él
ejecuta git.

---

### 🟡 A-35 · Dos controles que parecían lo que no son — ✅ CORREGIDO 14 sep 2026
- **La lupa de la búsqueda** (`HomeDesktopView.tsx:95`, y el mismo patrón en móvil en
  `GroupsGrid.tsx:128`) es un `<button>` sin `onClick`. No hace nada; el filtrado ocurre al
  teclear. Es decorativo, pero parece pulsable.
- **La CTA de las tarjetas de «Mis grupos»** («Ver estado de tu plaza →») es un `<div>` con
  aspecto de botón. Funciona porque el `onClick` está en la tarjeta entera, pero **no se puede
  alcanzar con el tabulador** ni se anuncia como botón. Un usuario de teclado no tiene forma de
  abrir el panel.

**Corregido (14 sep 2026).** La CTA pasa a ser un `<button>` real, con foco visible; el clic en
cualquier parte de la tarjeta sigue funcionando igual, porque el evento burbujea. Y la lupa, en vez
de desaparecer, hace lo único coherente con su aspecto: **llevar el foco al campo de búsqueda**.

---

## HALLAZGO POSTERIOR · 15 de septiembre de 2026

### 🔴 A-36 · El mismo grupo decía cosas distintas en cada pantalla — ✅ CORREGIDO 15 sep 2026
Benjamin mandó cuatro capturas de las **Zapatillas Shimano RC503** tomadas a la vez. Lo que decía
cada superficie:

| Pantalla | Qué decía |
|---|---|
| Ficha (escritorio) | «13 personas ya han pedido **22 unidades**» · «Con **8 unidades** más baja a 99 €» |
| Tarjeta de la home | «↓ Faltan **8 uds**» |
| Mis grupos (tarjeta) | «**22 / 20** uds en el grupo» · «**Faltan 0 uds**» · dos tramos marcados como conseguidos |
| Panel «Ver estado de tu plaza» | «Faltan **0 uds**» · «**100 % completado**» · barra llena |

Y al lado de ese 100 %, en la misma tarjeta: «Estado actual **119 €**». Es decir, la pantalla
anunciaba un tramo conseguido y el precio de ese tramo no se aplicaba.

**Los datos reales de producción en ese momento** (`tier_demand`):

| Tramo | Umbral | Demanda efectiva | Servidor |
|---|---|---|---|
| 119 € | ≥ 1 ud | 8 | **desbloqueado** |
| 99 € | ≥ 20 uds | **12** | bloqueado |
| 85 € | ≥ 45 uds | 22 | bloqueado |

**La causa.** `min_units` de un tramo se compara contra la demanda efectiva **de ese mismo
tramo**. `MisGruposDesktop.derive()` lo comparaba contra el **total de unidades comprometidas**:

```ts
const currentUnits = Math.max(...ladder.map(t => t.effective_demand))   // 22
const missing = Math.max(0, nextTier.min_units - currentUnits)          // 20 − 22 → 0   ✗
```

Son dos cantidades distintas. Las 22 unidades comprometidas incluyen a quien solo compra si baja
a 85 €; a 99 € esa gente no cuenta, y por eso la demanda a 99 € son 12. Un grupo puede tener 22
unidades dentro y no desbloquear un tramo de 20: no son las 20 unidades correctas.

La ficha lo hacía bien —`useTierDemand` restaba `nextTier.minUnits − nextTier.demand` = 8—. Dos
implementaciones de la misma cuenta, una mal. **Era DT-07 cobrando su precio**, y lo introduje yo
al cerrar A-19/A-20.

**Y no eran dos, eran tres.** Al buscar hasta agotar apareció una tercera copia con el mismo
error en `purchaseFeed.ts`: el aviso «Estás cerca del siguiente precio» restaba también el total
comprometido, así que en los grupos con esperadores daba 0 y **el aviso no se disparaba nunca**.
Un fallo silencioso: no enseñaba nada mal, simplemente no enseñaba. También la escribí yo, en la
tanda del feed. Las tres usan ahora `@/lib/ladder`.

**Por qué es 🔴 y no cosmético.** Es una afirmación económica falsa en la pantalla donde el
comprador consulta su dinero. Ese comprador tiene un compromiso de 85 €; si el grupo cerrase con
el precio en 119 €, su compra **no se ejecutaría** (RULE-032). La pantalla le decía «100 %
completado».

**Lo hecho.** La derivación se extrae a **`src/lib/ladder.ts`**, una sola definición que usan la
ficha y Mis grupos. `unlocked` sigue viniendo del servidor: nunca se deduce comparando números en
el cliente. De paso:

- «22 / 20 uds **en el grupo**» → «12 / 20 uds **para 99 €**». El numerador y el denominador son
  ahora del mismo tramo, y el texto dice de qué tramo habla.
- La barra de progreso recibía las unidades totales y pasaba de largo un nodo que el servidor
  marcaba como bloqueado. Ahora mide contra el tramo al que se aspira.
- «Reserva a 85 €» desaparece: no está en el léxico cerrado (A-31) y repetía el mismo número que
  la línea del escudo justo debajo. Queda «En espera» / «Compra directa», que es lo único que ese
  texto aportaba.
- El aviso de la ficha pasa a decir «Faltan 8 unidades **a este precio** para bajar a 99 €»
  (decisión de Benjamin, 15-sep). Tres palabras que resuelven la aparente contradicción con las
  «22 unidades» sin explicar todo el modelo ni quitar la prueba social.

**Verificado** ejecutando la derivación contra las filas reales de ese grupo: precio actual 119 €,
22 unidades comprometidas, siguiente tramo 99 €, faltan 8, 60 % del camino. Más los casos límite
—escalera agotada, grupo vacío, RPC que devuelve basura—. La última prueba encontró un fallo de
verdad: una fila nula tumbaba la función entera, y con ella la pantalla. Corregido.

**Sin verificar:** nadie ha mirado las cuatro pantallas en un navegador después del arreglo. El
cálculo sí está verificado contra los datos reales; lo que falta es el ojo.

---

## HALLAZGO POSTERIOR · 15 de septiembre de 2026 (tarde)

### 🔴 A-37 · La ficha enseña un techo que el servidor no va a grabar
**Lo encuentra Benjamin mirando la ficha con 8 unidades en el selector.** Su observación fue
visual —«este tramo ya estaría desbloqueado a 99, con lo que el anterior no sería seleccionable»—
pero debajo había un fallo de dinero.

**Qué hace el servidor.** `prepare_join` NO guarda como techo el tramo que marcas en la ficha.
Guarda esto (extraído con `pg_get_functiondef` sobre producción, 15-sep-2026):

```sql
SELECT best_price INTO v_guaranteed_price
FROM compute_price(p_group_id, p_quantity);
```

Es decir, el precio proyectado **con tus unidades ya contadas**. Comprobado en vivo sobre las
Zapatillas Shimano (demanda 12 en el tramo de 20 unidades):

| Tu cantidad | `compute_price` | Techo que graba el servidor |
|---|---|---|
| 7 | 119 € | 119 € |
| **8** | **99 €** | **99 €** |

**Qué enseñaba la ficha con esas mismas 8 unidades:** «PRECIO ACTUAL 119 €», «SIGUIENTE 99 €»,
la tarjeta de 119 € marcada como «Tu opción actual» y el botón **«Asegurar hasta 119 €»**. Ninguno
de los cuatro era cierto: el techo grabado habría sido 99 y la retención en la tarjeta, 99 × 8 =
792 €, no 952 €.

**Por qué importa más allá de la coherencia.** El techo decide quién compra: `close_group` paso 4
cancela al comprador cuyo `guaranteed_price` sea menor que el settlement (RULE-013). Un botón que
promete «hasta 119 €» y graba 99 está describiendo mal el riesgo que asume el comprador.

**Está vivo hoy**, no es teórico. Precio con 1 unidad frente a con N, en los grupos abiertos:

| Grupo | 1 ud | 2 uds | 10 uds |
|---|---|---|---|
| Garmin Edge 840 Solar | 449 € | **419 €** | 419 € |
| Zapatillas Shimano | 119 € | 119 € | **99 €** (desde 8) |
| Par de ruedas Zipp 303 S | 819 € | 819 € | **799 €** |
| Bicicleta Orbea Orca M30 | 1849 € | 1849 € | **1749 €** |
| Casco Giro Aries | 289 € | 289 € | **259 €** |
| Maillot Castelli | 49,95 € | 49,95 € | **42,95 €** |

En el Garmin basta con pedir **2 unidades** para que la ficha mienta.

**CORREGIDO en escritorio** (`GroupRightSidebar` + `TierChooser`). El suelo de lo elegible deja de
ser `curIdx` —el precio del grupo— y pasa a ser `floorIdx`, el tramo al que entrarías con tus
unidades dentro, preguntado al MISMO endpoint que usa el checkout (`/api/group/[id]/quote` →
`compute_price`), sin reimplementar la matemática de tramos en el navegador. Con eso:

- los tramos por encima del suelo se colapsan a su precio y dejan de ser elegibles;
- el tramo que abren tus unidades se marca **«Lo abres tú»** y queda seleccionado;
- el botón dice el techo real;
- el panel cuenta TODO contigo dentro (titular, frase y barra), que antes iban a dos velocidades:
  «Faltan 23» a dos centímetros de «22 + 8 / 45», que dice 15;
- y los tres hablan del MISMO tramo. Segundo aviso de Benjamin, sobre la primera corrección: el
  titular decía «Con 7 unidades entraríais a 99 €» y la barra debajo enseñaba «23 + 7 / 45», que
  es el tramo de 85 €. Cuando tus unidades abren un tramo, la barra es la de ESE tramo y sale
  completa —«13 + 7 / 20»—, que es justo la prueba de que lo abres.

**ABIERTO en móvil.** `GroupLiveSection` tiene el mismo `curIdx` sin cotización y el mismo
«Asegurar hasta X». Hoy no falla porque la cantidad está fija en 1 y **ningún grupo abierto cambia
de precio con 1 unidad** (comprobado arriba). Es un fallo latente: el día que el Garmin llegue a
una unidad del tramo, o el día que el móvil tenga selector de cantidad (A-31), se activa solo.

---

## RESUMEN DE LA AUDITORÍA

**37 hallazgos** sobre 6 partes (recuento verificado sobre este mismo documento).
Estado a 14 de septiembre de 2026:

| Severidad | Total | Corregidos | Abiertos |
|---|---|---|---|
| 🔴 crítico | 12 | **11** — A-01, A-02, A-11, A-12, A-15, A-18 (con A-18b), A-21, A-25, A-29, A-30 y A-37 (en escritorio; abierto en móvil) | **0** — A-28 baja a 🟠: producto hecho, falta abogado |
| 🟠 importante | 14 | **13** — A-03, A-04, A-05, A-06, A-11c, A-13, A-16, A-19, A-20, A-22, A-26, A-27 y A-31 (estos dos, en parte) | 1 |
| 🟡 mejora | 11 | **6** — A-07, A-09, A-14, A-17, A-23, A-35 | 5 |
| ⚠️ a la espera | 1 — A-11b | 0 | 1 (no tocado a propósito) |

*(A-14 pasó de 🟠 a 🟡 al comprobarse que el ahorro sí se calculaba.)*

**32 de 38 cerrados** (15 sep: A-32, A-33, A-07, A-09 y A-37 en escritorio). Lo que queda, por lo que hace falta para
cerrarlo:

| Hace falta | Hallazgos |
|---|---|
| **Un abogado** | A-28 (los diez textos de `src/content/legal/` son borrador), y con él L-02 / L-03 / RULE-063 |
| **Una decisión de producto tuya** | A-27 (¿etiqueta visible en el formulario?), A-05 (¿el nombre fuera de la foto?), A-24 (¿los grupos de prueba se ocultan en «Mis grupos» o se etiquetan?) |
| **Un comando tuyo** | A-34 (710 líneas huérfanas: comando exacto en `TECHNICAL_DEBT.md` DT-04) |
| **Tu ojo en una pantalla grande** | A-32 (hecho, sin mirar todavía en escritorio real) |
| **Cosmética menor** | A-08 (dos botones flotantes por tarjeta), A-10 («Hoy 0 €» en 11 px gris) |
| **Nada — vocabulario que sigue divergiendo** | A-31 (resto): navegación, «Ahorra/Ahorras», el selector de cantidad que solo existe en escritorio |

**Ya no queda ninguna deuda de dinero abierta de esta auditoría.** A-11b, que era la última, resultó
ser un falso positivo (ver más abajo).

---

## LOS TRES TEMAS DE FONDO

Por debajo de los hallazgos sueltos, la auditoría encontró tres cosas, y las tres explican por qué
aparecen una y otra vez:

1. **Nadie había diseñado el después.** El grupo cerrado, el grupo cancelado, la plaza liberada, el
   comprador que se queda fuera: el producto estaba construido entero para el momento de entrar.
   A-11c, A-15, A-16, A-18, A-22, P2-06. *Cerrado en su mayor parte el 14 de septiembre.*
2. **Dos árboles de UI que se habían separado.** No era duplicación de código: es que contaban
   cosas distintas, y los arreglos llegaban solo a uno de los dos. DT-03, A-29, A-30, A-31.
3. **La escasez y la activación existían en los datos y no en la pantalla.** `min_execution`,
   `max_stock` y `closes_at` se calculaban bien, se hacían cumplir en el servidor, y no se
   enseñaban: solo servían para **impedir**, nunca para **avisar**. A-01, A-02, A-12, A-29.
   *Cerrado.*

---

## DOS LECCIONES DE MÉTODO

*(Actualizadas el 15 de septiembre: la segunda pasó de tres casos a cinco.)*

### 1 · «Ya está arreglado» no vale sin comprobar los dos árboles
Tres veces en el mismo día di por bueno un arreglo que solo existía en la mitad del producto:

| Se creía | La realidad |
|---|---|
| A-11 corregido | solo en móvil; escritorio siguió vendiendo un grupo cerrado |
| A-30 nuevo, solo de escritorio | el mismo `lockPhase` estaba en la ficha móvil |
| `maxStock` / `minExecution` ignorados solo en `GroupRightSidebar` | `GroupLiveSection` **también** los declaraba sin desestructurar |

Es **DT-03** cobrando su precio. La regla operativa: **al cerrar cualquier hallazgo de ficha, home
o mis-grupos, comprobar los dos componentes antes de marcarlo** — y si una prop se declara y no se
usa, sospechar que en el gemelo pasa lo mismo.

### 2 · Una afirmación de ausencia exige buscar hasta agotar
**Cinco veces** escribí que algo no existía, y las cinco veces existía:

| Escribí | La realidad |
|---|---|
| A-25 · «el email no se valida en ninguna capa» | `get_my_groups` **sí** lo valida… al leer, devolviendo lista vacía en silencio. Peor de lo que yo decía, pero no lo que yo decía |
| A-14 · «el ahorro no se calcula en ninguna parte» | `savingsPerUnit` existía y se pintaba; estaba mal **colocado**, no ausente |
| A-11b · «`confirm_join` no comprueba el estado del grupo» | **Sí lo comprueba**, con `FOR UPDATE` y devolviendo `needs_release`. Y `PROJECT_KNOWLEDGE_PACK.md` ya lo tenía registrado como INV-03 garantizada |
| A-32 · «no hay navegación para volver» en el checkout | La cabecera siempre tuvo su flecha atrás, con `aria-label="Volver al gropo"` |
| A-03 · «en escritorio el slider no tenía NINGÚN encabezado» | `GropoTargetSlider` con `chrome="full"` **ya pintaba uno**. Al añadir el mío, la pregunta salió **dos veces y con dos redacciones distintas**, y así estuvo en producción hasta que Benjamin lo vio en una captura el 15-sep |

Las cinco las descubrí **al ir a implementar el arreglo o después**, no al escribir el hallazgo. La
quinta es la más cara: **llegó a producción**. Las otras cuatro solo costaron tiempo.

**El patrón del error, idéntico las cinco veces:** buscar por una FORMA —el nombre de una variable,
un archivo concreto, una cadena— y concluir una AUSENCIA GENERAL. `grep v_group.status` no
encuentra `WHERE status = 'open'`; buscar validación de email en `src/lib/` no encuentra una regex
dentro de una función SQL; buscar el ahorro en la tarjeta de precio no lo encuentra al final del
bloque de dinero.

**Antes de escribir «no existe»: buscar la capacidad, no la implementación que uno espera, y
contrastar con la documentación que ya la tenga registrada.** Si la duda persiste, **UNKNOWN**.

**Y una regla nueva, del caso A-03:** antes de añadir un texto a una pantalla, **leer lo que ya
pinta el componente que va debajo**. `GropoTargetSlider` recibía `chrome="full"`, y ese nombre no
dice que incluya un encabezado: hay que abrirlo. Añadir copy sin mirar al vecino produce
duplicados que el typecheck no ve, el lint no ve y solo aparecen con el navegador abierto.

Corregido en origen, no en la superficie: `chrome` juntaba dos decisiones independientes —el
encabezado y la píldora de estado— así que una pantalla que ya escribe su propia pregunta tenía que
elegir entre repetirla o quedarse sin píldora. Ahora existe `chrome="status"`, que da la píldora
sin el título.

---

## `/notificaciones` vs `/mis-grupos` — DECIDIDO E IMPLEMENTADO (14 sep 2026)

Estaba planteado aquí como la decisión pendiente más importante. **Benjamin la tomó:** se mantiene
`/notificaciones`, convertida en un **Purchase Activity Feed** orientado solo a cambios en las
compras del usuario. La especificación vive en `UX_AND_FLOWS.md` §3-bis; el detalle de la
implementación, en A-22.
