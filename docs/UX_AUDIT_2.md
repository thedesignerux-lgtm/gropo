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

## PENDIENTE DE AUDITAR
G02 · G03 · G05 · G07 · G08 (con sesión) · G10 · G11 · G12 · G13 · G14 · G15,
el checkout completo, `/mis-grupos`, `/notificaciones` y la vista de escritorio.
