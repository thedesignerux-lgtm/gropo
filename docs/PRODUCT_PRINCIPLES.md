# PRODUCT_PRINCIPLES.md — Gropo

> **Doctrina de producto, UX y UX writing.** El criterio con el que se juzga cualquier pantalla,
> flujo o texto de Gropo.
>
> **Qué NO es:** no es una guía de estilos, no es el design system, no es un catálogo de
> componentes. `UX_AND_FLOWS.md` documenta las pantallas **que existen**; este documento define
> **con qué criterio se evalúan**.
>
> **Origen:** rescatado de `VONDA_PRODUCT_GUIDELINES.md` v1.0 (29-jun-2026), rebrandeado a Gropo
> el 11-sep-2026 y con la contradicción sobre los modos de compra resuelta (§3).
> Toda nueva funcionalidad, pantalla o flujo debería respetar estos principios.

---

## 1. LA VISIÓN

Gropo no es un e-commerce tradicional. Tampoco es una compra grupal clásica.

Es un sistema que coordina la demanda para conseguir el mejor precio posible para todos los
participantes.

**La complejidad pertenece al algoritmo. La simplicidad pertenece a la experiencia.**

El usuario nunca debería sentir que está utilizando un sistema complejo. Debería sentir que
únicamente está tomando una decisión muy sencilla:

> **"Este es el máximo que estoy dispuesto a pagar."**

Todo lo demás lo resuelve Gropo.

### La promesa

> **Nunca pagarás más de lo que tú mismo has decidido pagar. Y si el grupo consigue un precio
> mejor, pagarás automáticamente menos.**

Esta promesa debe estar presente en toda la experiencia. **Y está respaldada por el motor:** es
el invariante INV-005, implementado en `close_group` paso 4 (ADR-09, PMA universal) y en la
captura parcial. No es marketing: es una garantía técnica.

---

## 2. EL MODELO MENTAL

### El usuario NO debe pensar

- Estoy votando un precio.
- Estoy entrando en un grupo.
- Estoy reservando una plaza.
- Estoy ayudando a desbloquear un tramo.
- Estoy participando en una subasta.

Todo eso pertenece al funcionamiento interno.

### El usuario DEBE pensar

> Estoy indicando el precio máximo al que aceptaría comprar este producto.

Y después:

> El sistema buscará automáticamente el mejor precio posible para mí.

**Si el usuario necesita entender el algoritmo para comprar, el diseño ha fallado.**

### Cómo funciona realmente

El algoritmo trabaja con un concepto: el **Precio Máximo Aceptado (PMA)**. Cada comprador declara
el máximo que aceptaría pagar. Los compradores con precios más altos también cuentan para los
precios inferiores: la demanda es acumulativa. El sistema calcula continuamente cuál es el precio
más bajo capaz de reunir suficiente demanda.

El usuario nunca necesita conocer este cálculo. La interfaz solo comunica el resultado.

*(Detalle técnico del PMA y su asimetría entre el precio en vivo y el cierre: `ALGORITHM.md` §7.)*

---

## 3. UN MODELO, DOS ENTRADAS

> ⚠️ **Este apartado corrige el principio original.** La versión de junio afirmaba: *"No existen
> dos mecanismos. No existe Comprar y Reservar. Ambos son exactamente la misma operación."*
> El producto implementado **sí** tiene dos modos (`join_mode` = `comprar` / `esperar`), con
> `JoinModeSelector` y UI distinta. La formulación vigente es la siguiente.

**Existe un solo modelo económico: el usuario declara un techo de precio.**
Lo que existe son **dos formas de declararlo**:

| Entrada | Qué declara el usuario | Cómo se guarda |
|---|---|---|
| **Comprar ahora** | "Acepto el precio actual, y menos si baja" | `guaranteed_price` — el precio proyectado al unirse |
| **Esperar a un precio** | "Solo compro si baja hasta aquí" | `target_price` — el tramo elegido |

**No son dos mecanismos. Son dos maneras de responder a la misma pregunta.** En ambos casos el
usuario autoriza una retención, no paga; en ambos casos el sistema le cobrará el precio único de
liquidación; en ambos casos nunca pagará por encima de lo que declaró.

**Criterio de diseño que se deriva:** la UI debe hacer que los dos modos se lean como dos
respuestas a *"¿cuál es tu máximo?"*, no como dos productos distintos con dos flujos distintos.
Cuando una pantalla obligue al usuario a entender **por qué** existen dos botones, esa pantalla
está fallando este principio.

---

## 4. FILOSOFÍA DE DISEÑO

### Mostrar consecuencias, nunca mecánica

En lugar de explicar cómo funciona el algoritmo, mostramos qué significa para el usuario.

- ❌ "Se necesitan 6 unidades para activar este tramo."
- ✅ "Muy cerca." · "Faltan 6 compras."

### El sistema hace las matemáticas

Nunca obligamos al usuario a interpretar: *demanda efectiva*, *tiers*, *activaciones*,
*compradores acumulados*, `total_units`, `compute_price`. La UI transforma datos complejos en
decisiones simples.

### El precio es el protagonista

El producto vende un precio. No vende una comunidad, ni un algoritmo, ni una mecánica.

Todo componente debe responder a una pregunta: **¿ayuda al usuario a entender cuánto pagará?**
Si no lo hace, probablemente sobra.

### El usuario nunca pierde el control

El usuario decide su límite, cuándo comprar y cuántas unidades. El sistema únicamente optimiza el
resultado.

### Transparencia absoluta

El usuario siempre debe saber: el precio actual · el siguiente precio posible · qué ocurre si
compra · qué ocurre si espera · cuál es el máximo que pagará.

**Nunca debe haber sorpresas.**

---

## 5. PRINCIPIOS UX

### Una pantalla responde una pregunta

| Pantalla | Pregunta |
|---|---|
| Ficha de producto | ¿Cuál es el máximo que pagarías? |
| Checkout | ¿Confirmas este límite? |
| Grupo | ¿Cómo evoluciona el precio? |

Nunca responder varias preguntas a la vez.

### Un dato aparece una sola vez

La redundancia genera ruido. Cada dato importante tiene un único lugar.

### Reducir la carga cognitiva

Cada componente debe justificar su existencia. Antes de añadir un bloque: ¿reduce dudas? ¿ayuda a
decidir? ¿genera confianza? Si no, debe eliminarse.

### Mostrar progreso humano

Sustituir métricas técnicas por estados comprensibles. No *"faltan 6 unidades"*, sino
*"muy cerca"* o *"faltan 6 compras"*.

---

## 6. ARQUITECTURA DE INFORMACIÓN

La ficha de producto responde este orden mental:

1. ¿Cuánto pagaría hoy?
2. ¿Cuál es el siguiente descuento?
3. ¿Cuál es el máximo que quiero pagar?
4. ¿Qué ocurrirá después de comprar?

**Nada debe romper esta secuencia.**

### El selector de PMA

Es el corazón del producto. La interfaz representa diferentes precios máximos y su estado:

| Precio | Estado |
|---|---|
| 48,90 € | Disponible ahora |
| 44,90 € | Muy cerca |
| 41,90 € | A medio camino |
| 38,90 € | Objetivo final |

*(Cifras ilustrativas.)* El usuario elige su techo; el sistema decide cuándo ejecutar la compra.

---

## 7. UX WRITING

### Hablar como una persona

Nunca lenguaje de base de datos. Nunca lenguaje jurídico. Nunca lenguaje interno.

### Explicar beneficios, no características

- ❌ "Precio máximo garantizado."
- ✅ "Nunca pagarás más de lo que elijas."

### Reducir palabras

El usuario no lee: escanea. Cada palabra debe justificar su presencia.

### Vocabulario por contexto

- **Social:** unirse, participar, compartir, grupo, invitar.
- **Transaccional:** comprar, precio, máximo, pagar, ahorro.

---

### LÉXICO CERRADO — decidido el 14 de septiembre de 2026

> Fijado por Benjamin tras la auditoría (A-04 y A-31 de `UX_AUDIT_2.md`), donde se encontró que el
> producto usaba **tres nombres para el mismo número** y **dos verbos distintos** para la misma
> acción según el tamaño de la pantalla. Esto no es una guía de estilo: es la lista de palabras que
> se usan, y las que no.

**Una sola historia, de principio a fin:**

> Marcas tu máximo → aseguras tu plaza → el grupo crece → el precio baja → pagas el precio final.

| Concepto | Se dice | **Nunca** |
|---|---|---|
| La acción principal | **Asegurar** | ~~Bloquear~~, ~~Fijar~~, ~~Reservar~~ (mezclados) |
| El límite del comprador | **hasta X €** | ~~Máx. X €~~ (suelto) |
| Lo que elige en el slider | **precio máximo** | ~~límite~~, ~~tope~~ |
| Lo que acabará pagando | **precio final** | ~~precio de cierre~~ |
| Su situación tras comprar | **plaza asegurada** | ~~confirmado~~, ~~dentro~~ |

**CTA en las cuatro superficies de compra:** `Asegurar hasta 85 €`. Sin variantes.

Por qué no «Bloquear precio»: afirma que el precio queda fijado, y **el modelo entero consiste en
que puede bajar después**. Ya causó un problema real — el botón de escritorio llegó a decir
«✓ Precio bloqueado» antes de que existiera ningún cargo (A-30).

#### Personas ≠ unidades

**Los tramos se desbloquean por UNIDADES.** Un comprador con 4 cámaras es **1 persona y 4
unidades**. En producción, las cámaras tienen **20 personas y 57 unidades**: llamar «personas» a
las 57 hacía que el contador y la escalera no cuadraran nunca.

| Dónde | Formato |
|---|---|
| Ficha | «**20 personas** ya han pedido **57 unidades**» |
| Tarjeta de la home | «20 compradores · 57 uds» |
| Escalera y tooltips | «50 uds», «Faltan 3 uds» — se escanea, no se lee |
| Prosa y nudges | «unidades», completo |

**Cuando los dos números coinciden se dice solo uno.** Hoy pasa en 4 de cada 6 grupos, porque casi
todo el mundo pide una unidad: «18 personas en el grupo», no «18 personas ya han pedido 18
unidades». Repetir el mismo número con dos nombres es exactamente lo que este léxico viene a
quitar.

«**Confirmados**» queda prohibido: es vocabulario de banco para algo que **nadie ha pagado**.

**Nunca mezclar ambos registros en el mismo momento de decisión.**

### Reglas para CTAs

Nunca verbos genéricos (*Continuar, Aceptar, Enviar, Reservar, Confirmar*). El CTA describe
exactamente la acción:

- "Comprar (Máx. 48,90 €)"
- "Comprar si baja a 44,90 €"
- "Autorizar pago (Máx. 48,90 €)"

### Mensajes de confianza

Responder toda incertidumbre antes de que el usuario piense en ella:

- Nunca pagarás más de lo que elijas.
- Si el precio baja, pagarás automáticamente menos.
- No realizaremos ningún cargo hasta que se cumpla tu condición.
- Tu compra está protegida.

---

## 8. QUÉ DEBEMOS EVITAR

- Explicar demanda efectiva, tiers, activaciones, lógica SQL o compradores acumulados.
- Mostrar el mismo dato varias veces.
- Crear falsos botones.
- Copy negativo.
- Obligar al usuario a hacer cálculos.
- Terminología interna.

---

## 9. CRITERIOS PARA EVALUAR CUALQUIER DISEÑO NUEVO

1. ¿El usuario entiende cuánto pagará?
2. ¿El usuario entiende cuál es su límite?
3. ¿La pantalla genera confianza?
4. ¿Existe una única acción principal?
5. ¿Hay información repetida?
6. ¿Puede eliminarse algún componente sin perder comprensión?
7. ¿El copy comunica beneficios en lugar de mecánicas?
8. ¿La interfaz hace invisible la complejidad del algoritmo?

**Si alguna respuesta es negativa, el diseño todavía no está terminado.**

---

## 10. DÓNDE EL PRODUCTO SE APARTA HOY DE ESTOS PRINCIPIOS

Registrado por honestidad, no como plan de trabajo. Detalle en `KNOWN_ISSUES.md`.

| Principio | Desviación actual |
|---|---|
| *Transparencia absoluta · nunca debe haber sorpresas* | Un comprador puede quedar **fuera** del grupo al cierre si la liquidación supera su `guaranteed_price`, **y no recibe ningún email explicándolo** (P2-06) |
| *Mostrar consecuencias, nunca mecánica* | Los copys de compartir siguen diciendo *"si entra 1 más baja a X €"*, que es **falso** desde que cambió la semántica de `next_price` el 21-jul (P3-04) |
| *El usuario nunca pierde el control* | `JoinFlow` muestra éxito **antes** de que el webhook confirme: el usuario cree que compró cuando todavía puede no haber comprado (P0-03) |
| *Un dato aparece una sola vez* | Conviven **tres definiciones distintas** de "siguiente tramo" (`compute_price.next_price`, `useTierDemand`, `page.tsx`), que pueden divergir en escaleras con huecos (DT-07) |

---

## PRINCIPIO RECTOR

La mayor ventaja competitiva de Gropo no es su algoritmo.

**Es conseguir que un algoritmo complejo parezca increíblemente sencillo.**

Cuando el usuario piense:

> *"Solo he dicho cuánto quiero pagar y el sistema se ocupa del resto."*

habremos construido la experiencia correcta.
