# Vonda Product Experience Guidelines

## Principios de Producto, UX/UI y UX Writing

**Versión 1.0**

---

# Propósito del documento

Este documento define los principios que deben guiar el diseño de Vonda.

No es una guía de estilos.
No es un Design System.
No es una guía de copy.

Es el documento que define cómo debe pensar el producto.

Toda nueva funcionalidad, pantalla o flujo deberá respetar estos principios.

---

# La visión del producto

Vonda no es un e-commerce tradicional.
Tampoco es una compra grupal clásica.

Es un sistema inteligente que coordina la demanda para conseguir el mejor precio posible para todos los participantes.

La complejidad pertenece al algoritmo.
La simplicidad pertenece a la experiencia de usuario.

El usuario nunca debería sentir que está utilizando un sistema complejo.
Debería sentir que únicamente está tomando una decisión muy sencilla.

> **"Este es el máximo que estoy dispuesto a pagar."**

Todo lo demás lo resuelve Vonda.

---

# La promesa de producto

> **Nunca pagarás más de lo que tú mismo has decidido pagar. Y si el grupo consigue un precio mejor, pagarás automáticamente menos.**

Esta promesa debe estar presente en toda la experiencia.

---

# El modelo mental

## El usuario NO debe pensar

- Estoy votando un precio.
- Estoy entrando en un grupo.
- Estoy reservando una plaza.
- Estoy ayudando a desbloquear un tramo.
- Estoy participando en una subasta.

Todo eso pertenece al funcionamiento interno.

## El usuario DEBE pensar

> Estoy indicando el precio máximo al que aceptaría comprar este producto.

Y después:

> El sistema buscará automáticamente el mejor precio posible para mí.

Si el usuario necesita entender el algoritmo para comprar, el diseño ha fallado.

---

# Cómo funciona realmente el producto

El algoritmo trabaja con un concepto:

**Precio Máximo Aceptado (PMA)**

Cada comprador declara el máximo que aceptaría pagar.

Los compradores con precios más altos también cuentan para los precios inferiores.
La demanda es acumulativa.
El sistema calcula continuamente cuál es el precio más bajo capaz de reunir suficiente demanda.

El usuario nunca necesita conocer este cálculo.
La interfaz solo comunica el resultado.

---

# Filosofía de diseño

## Mostrar consecuencias, nunca mecánica

En lugar de explicar cómo funciona el algoritmo, mostramos qué significa para el usuario.

No: "Se necesitan 6 unidades para activar este tramo."
Sí: "Muy cerca." o "Faltan 6 compras."

## El sistema hace las matemáticas

Nunca obligamos al usuario a interpretar: demanda efectiva, tiers, activaciones, compradores acumulados, total_units, compute_price.

La UI transforma datos complejos en decisiones simples.

## El precio es el protagonista

El producto vende un precio.
No vende una comunidad. No vende un algoritmo. No vende una mecánica.

Todo componente debe responder a una pregunta:

> ¿Ayuda al usuario a entender cuánto pagará?

Si no lo hace, probablemente sobra.

## El usuario nunca pierde el control

El usuario decide: su límite, cuándo comprar, cuántas unidades comprar.
El sistema únicamente optimiza el resultado.

## Transparencia absoluta

El usuario siempre debe saber:
- cuál es el precio actual
- cuál es el siguiente precio posible
- qué ocurrirá si compra
- qué ocurrirá si espera
- cuál es el máximo que pagará

Nunca debe haber sorpresas.

---

# Principios UX

## Una pantalla responde una pregunta

- Ficha de producto → "¿Cuál es el máximo que pagarías?"
- Checkout → "¿Confirmas este límite?"
- Grupo → "¿Cómo evoluciona el precio?"

Nunca responder varias preguntas a la vez.

## Un dato aparece una sola vez

La redundancia genera ruido. Cada dato importante tiene un único lugar.

## Reducir la carga cognitiva

Cada componente debe justificar su existencia. Antes de añadir un bloque: ¿Reduce dudas? ¿Ayuda a decidir? ¿Genera confianza? Si no, debe eliminarse.

## Mostrar progreso humano

Sustituir métricas técnicas por estados comprensibles.
No: "Faltan 6 unidades." Sí: "Muy cerca." o "Faltan 6 compras."

---

# Arquitectura de información

La ficha de producto responde este orden mental:

1. ¿Cuánto pagaría hoy?
2. ¿Cuál es el siguiente descuento?
3. ¿Cuál es el máximo que quiero pagar?
4. ¿Qué ocurrirá después de comprar?

Nada debe romper esta secuencia.

---

# Arquitectura del selector PMA

El selector representa el corazón del producto.

**No existen dos mecanismos.** No existe "Comprar" y "Reservar".
Ambos son exactamente la misma operación.
El usuario únicamente define un límite.

La interfaz solo representa diferentes precios máximos:

| Precio | Estado |
|---|---|
| 48,90 € | Disponible ahora |
| 44,90 € | Muy cerca |
| 41,90 € | A medio camino |
| 38,90 € | Objetivo final |

El sistema decide cuándo ejecutar la compra.

---

# Estrategia de UX Writing

## Hablar como una persona

Nunca lenguaje de base de datos.
Nunca lenguaje jurídico.
Nunca lenguaje interno.

## Explicar beneficios

No: "Precio máximo garantizado."
Sí: "Nunca pagarás más de lo que elijas."

## Reducir palabras

El usuario no lee. Escanea. Cada palabra debe justificar su presencia.

## Vocabulario por contexto

**Social:** unirse, participar, compartir, grupo, invitar.
**Transaccional:** comprar, precio, máximo, pagar, ahorro.

Nunca mezclar ambos registros en el mismo momento de decisión.

---

# Reglas para CTAs

Nunca verbos genéricos (Continuar, Aceptar, Enviar, Reservar, Confirmar).

El CTA describe exactamente la acción:
- "Comprar (Máx. 48,90 €)"
- "Comprar si baja a 44,90 €"
- "Autorizar pago (Máx. 48,90 €)"

---

# Reglas para mensajes de confianza

Responder toda incertidumbre antes de que el usuario piense en ella:

- Nunca pagarás más de lo que elijas.
- Si el precio baja, pagarás automáticamente menos.
- No realizaremos ningún cargo hasta que se cumpla tu condición.
- Tu compra está protegida.

---

# Qué debemos evitar

- Nunca explicar: demanda efectiva, tiers, activaciones, lógica SQL, compradores acumulados.
- Nunca mostrar el mismo dato varias veces.
- Nunca crear falsos botones.
- Nunca utilizar copy negativo.
- Nunca obligar al usuario a hacer cálculos.
- Nunca utilizar terminología interna.

---

# Criterios para evaluar cualquier nuevo diseño

- ¿El usuario entiende cuánto pagará?
- ¿El usuario entiende cuál es su límite?
- ¿La pantalla genera confianza?
- ¿Existe una única acción principal?
- ¿Hay información repetida?
- ¿Puede eliminarse algún componente sin perder comprensión?
- ¿El copy comunica beneficios en lugar de mecánicas?
- ¿La interfaz hace invisible la complejidad del algoritmo?

Si alguna respuesta es negativa, el diseño todavía no está terminado.

---

# Principio rector

La mayor ventaja competitiva de Vonda no es su algoritmo.
Es conseguir que un algoritmo complejo parezca increíblemente sencillo.

Cuando el usuario piense:

> "Solo he dicho cuánto quiero pagar y el sistema se ocupa del resto."

habremos construido la experiencia correcta.
