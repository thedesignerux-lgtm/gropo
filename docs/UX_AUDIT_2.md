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

### 🔴 A-01 · La ficha de un grupo que todavía no existe es idéntica a la de uno que sí
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
(`grupo/[id]/page.tsx` lo pasa como `minExecution`); simplemente no se pinta. Las tarjetas de la
home **sí** tienen el concepto (`getActivationState` → `activated`, `unitsToActivate`); la ficha no.

---

### 🔴 A-02 · La home no enseña ni el stock ni el tiempo del grupo destacado
**Reproducir:** home a 375 px, con el Shimano 105 Di2 (G09) destacado.

Ese grupo tiene **1 unidad de stock** y cierra en **9 horas**. La tarjeta destacada, que ocupa la
primera pantalla entera, **no menciona ninguna de las dos cosas**. Enseña precio, ahorro,
participantes y escalera de tramos.

Las dos únicas palancas de escasez del modelo —quedan pocas, queda poco tiempo— están ausentes
justo en el sitio de máxima atención. Y el comprador que pulse el botón se encontrará el tope de
unidades en 1 **después**, ya dentro del checkout.

La cabecera sí muestra una cuenta atrás global, **«Cierra Dom 22:00»**, que además contradice al
grupo que tiene debajo: cada grupo cierra a su hora, no todos el domingo.

---

### 🟠 A-03 · Se pide la decisión antes de explicar el modelo
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

---

### 🟠 A-04 · Tres vocabularios para la misma cosa, y ninguno es «unidades»
| Dónde | Cómo lo llama |
|---|---|
| Tarjeta destacada (home) | «15 **confirmados**» |
| Ficha de grupo | «2 **personas** en el grupo» |
| Escalera de tramos | «8 **uds**» |

Los tramos se desbloquean por **unidades**, no por personas: un comprador con 4 cámaras cuenta
como 4. En G10 hay 20 personas y **57 unidades**. Con el vocabulario actual, ese grupo diría «20
personas» junto a una escalera que habla de 50 uds, y el comprador no puede cuadrar los números.

Y «confirmados» es vocabulario de banco para algo que no ha ocurrido: nadie ha pagado.

---

### 🟠 A-05 · El nombre del producto es ilegible en la mitad de las tarjetas
**Reproducir:** home, carruseles.

El nombre va en blanco sobre la foto, con un degradado oscuro por debajo. Pero el catálogo real es
**producto recortado sobre fondo claro**, y el degradado no basta: «Garmin Edge 840 Solar»,
«Bicicleta Orbea Orca M30» y «Par de ruedas Zipp 303 S» se leen mal o no se leen.

El degradado está diseñado para fotografía ambiental. Es el hallazgo nº 4 del dataset, y visto con
fotos reales **no es estética: es legibilidad**.

---

### 🟠 A-06 · El mismo producto aparece hasta tres veces en la misma pantalla
Con 14 grupos y tres carruseles de nueve, la repetición es matemáticamente inevitable. Hoy la
Orbea sale en «Cerca del siguiente precio» **y** en «Más han bajado hoy»; el Shimano está en la
destacada **y** en un carrusel. El catálogo parece más pequeño y menos cuidado de lo que es.

Además **«Más han bajado hoy» es una afirmación factual que no se sostiene**: ninguno de estos
grupos ha bajado hoy. Y «Gropos populares», ¿según qué?

---

### 🟡 A-07 · La mini-escalera de las tarjetas es ilegible
Bajo cada tarjeta de carrusel hay tres precios a **7,5 px** («449 € · 419 € · 389 €»). A ese
tamaño no se leen; ocupan espacio y añaden ruido sin comunicar nada. O crecen, o se van.

### 🟡 A-08 · Dos botones flotantes por tarjeta compiten con el producto
Compartir y favorito, 30 px cada uno, sobre una tarjeta de 132 px: ocupan casi la mitad del ancho
superior de la foto. Multiplicado por nueve tarjetas visibles, son 18 botones peleando con el
catálogo.

### 🟡 A-09 · Descuentos con y sin decimales en la misma fila
«−150,99 €» junto a «−347 €» y «−750 €». Es el comportamiento del helper (oculta los decimales si
el número es entero), pero en una fila de badges canta. Para un descuento, redondear a «−151 €» es
más legible y no engaña a nadie.

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

### 🟠 A-11c · El arreglo apagó la acción, pero la tarjeta sigue vendiendo — ABIERTO
Con el botón ya deshabilitado, en esa misma pantalla siguen leyéndose:

- **«PRECIO ACTUAL · 1499 €»** — no hay precio actual: el grupo está cerrado
- **«Ahorras 347 €»** — un ahorro sobre una compra que ya no se puede hacer
- **«¿Cuál es el máximo que pagarías?»** con el slider **todavía arrastrable**
- **«Este precio ya está disponible. Si te unes hoy pagas 1499 €… Con 1 unidad más baja a 1399 €»**

Es decir: se arregló **el estado y la acción**, no **el discurso**. Un grupo cerrado debería contar
otra cosa —qué pasó, a qué precio se quedó, y si habrá otra ronda— en vez de seguir invitando a
unirse con el botón apagado. Enlaza con A-13 (el subtítulo fijo que no consulta el estado) y con
el hueco de G13/G14: **nadie ha diseñado el después**.

### ⚠️ A-11b · `confirm_join` no comprueba el estado del grupo — ABIERTO
Comprobado: **cero** referencias a `v_group.status` en `confirm_join`. El guard de `prepare_join`
cierra la puerta de entrada, pero si el grupo se cierra —por el cron o a mano desde el admin—
**mientras alguien está a mitad del pago**, el webhook llamará a `confirm_join` y creará la
membresía en un grupo ya liquidado. Ese miembro queda fuera del reparto, sin `final_price`, sin
email de cierre, y con el hold vivo.

**No se ha tocado a propósito.** Rechazar sin más sería peor: el dinero ya está autorizado y el
comprador se quedaría con una retención sin membresía. La salida correcta es la que la función ya
tiene para otros casos: devolver `needs_release`, que hace que el webhook cancele el hold. Pero eso
es tocar el corazón de la idempotencia de pagos —la rama `unique_violation` que **jamás** debe
devolver `needs_release` para `uniq_group_members_pi`— y necesita su propia pasada y una prueba
real en modo test.

**Probabilidad real:** baja por el cron (haría falta más de una hora entre empezar el pago y
confirmarlo), **alta por el botón manual del admin**.

---

### 🔴 A-12 · «En stock» significa lo mismo con 2 unidades que con 200
**Reproducir:** `/grupo/dd000000-…-0006/unirme` — Gafas Oakley. **Quedan 2 de 20.**

El badge dice **«✓ En stock»**, idéntico al de cualquier otro grupo. La escasez es binaria: hay o
no hay. En ningún punto del checkout aparece que queden dos.

Y este grupo es el peor sitio para ocultarlo, porque **ya tiene el mejor precio desbloqueado**: no
queda ninguna palanca de precio, la única razón para decidir hoy es que se acaban — y es justo lo
que no se dice. El grupo con más urgencia real del catálogo es el que menos urgencia transmite.

El dato existe y es correcto: `remainingStock()` ya calcula 2, y el selector topa ahí
(verificado en P2-01). Solo se usa para **impedir**, nunca para **avisar**.

---

### 🟠 A-13 · «Bajará si entran más compradores» cuando ya no puede bajar
Misma pantalla, separados por unos 40 px:

> **Precio de tu plaza** — *bajará si entran más compradores* — **89 €**
>
> **Mejor precio ya desbloqueado 🎉**

El subtítulo de la tarjeta de precio es un texto fijo que no consulta el estado. En los grupos
donde queda escalera es cierto; en G05 y G06, donde ya no queda, es falso y además choca con el
mensaje de la barra de progreso, que sí acierta.

---

### 🟠 A-14 · El ahorro desaparece justo cuando hay que decidir
En la home, cada tarjeta lleva su badge verde: «Ahorras 347 €», «−150,99 €». En el checkout, el
PVP queda reducido a **«Precio tienda ~~197 €~~»** en gris, arriba, pequeño, y **el ahorro no se
calcula en ninguna parte**.

En G06 son 89 € frente a 197 €: un **55 %**. El argumento económico más fuerte del producto se
desvanece en la pantalla donde se firma.

---

## PARTE 3 · DESPUÉS DE COMPRAR (`/mis-grupos`, `/notificaciones`, emails)

### 🔴 A-15 · El comprador invitado se queda sin rastro de su pedido
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

### 🟠 A-16 · Dos superficies para lo mismo, con dos identidades distintas — ⬆️ ver **A-21** (demostrado, sube a 🔴)
`/mis-grupos` (sesión) y `/notificaciones` (identidad local) responden a la misma pregunta —*¿qué
he comprado y cómo va?*— con dos mecanismos que no se hablan. Un mismo comprador puede ver su
pedido en una y no en la otra según desde dónde entre, sin ninguna explicación.

Ver también DT-03: no es duplicación de UI, es duplicación de **concepto de identidad**.

### 🟡 A-17 · El rescate de `/api/my-groups` se degrada en silencio
Si el registro de `users` no tiene teléfono, el endpoint cae a un plan B: cargar los **50
`group_members` más recientes de toda la plataforma** y recorrerlos haciendo una consulta de
usuario por fila, comparando emails.

Dos problemas: es un N+1 de hasta 50 consultas secuenciales, y está acotado a los 50 últimos
**globales** — con catálogo real, un comprador cuya compra no esté entre las 50 últimas de toda la
plataforma simplemente **no se encuentra**, sin error ni aviso. Hoy no se dispara casi nunca
(`prepare_join` normaliza y exige teléfono), pero es una trampa que empeora al crecer.

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

### 🟠 A-19 · La barra de progreso se pone su propio listón cuando ya no queda escalera
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

---

### 🟠 A-20 · «5 activos» cuenta también lo cancelado y lo liberado
`MisGruposDesktop.tsx:121`:

```ts
const active = memberships.length
```

No filtra nada. Con esta sesión el encabezado dice **«5 activos»** cuando lo activo es **uno**: el
sillín. Los otros cuatro son dos liberados y dos cancelados. El único número de la pantalla que
resume la situación es el único que está mal.

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

### 🟠 A-22 · `/notificaciones` no es un feed de novedades, es `/mis-grupos` otra vez
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

---

### 🟡 A-23 · El botón «Comparte con un amigo» no hace nada
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

## PENDIENTE DE AUDITAR
G02 · G03 · G05 · G07 · G10 · G11 · G12 · G13 · G14 · G15,
**el checkout completo** y **la vista de escritorio** (ninguno necesita sesión).

`/mis-grupos` y `/notificaciones` con sesión: **auditados** (Parte 4, 14 sep 2026).
