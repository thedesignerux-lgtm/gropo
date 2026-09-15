# LEGAL.md — Paquete legal de Gropo

**Estado:** BORRADOR OPERATIVO. Implementado en producto, **no validado jurídicamente**.
**Última actualización:** 15 septiembre 2026.

Este documento describe qué existe hoy en el código, qué falta y en qué orden hay que
cerrarlo. No es un documento jurídico ni sustituye a un abogado.

---

## 1. Arquitectura contractual elegida

```
VENDEDOR PROFESIONAL
   publica producto + stock + tramos + condiciones
        ↓
      GROPO
   agrega demanda · gestiona el grupo · facilita el pago
        ↓
   COMPRADORES (consumidores)
```

- **Gropo** = operador de marketplace / intermediario tecnológico.
- **Vendedor** = parte vendedora del contrato de compraventa.
- **Comprador** = consumidor.

Esta posición tiene una ventaja grande: Gropo no se convierte en vendedor de los productos.
Pero **declararlo en los textos no basta**. La operativa real de facturación, cobro, Stripe
Connect, liquidaciones, atención al cliente y devoluciones tiene que ser coherente con ella, y
eso hoy es **UNKNOWN** (ver §5).

---

## 2. Qué hay implementado

### Contenido
`src/content/legal/` — diez documentos como **datos tipados**, no JSX:

| Slug | Documento | Grupo |
|---|---|---|
| `condiciones-compra` | Condiciones de Compra | comprar |
| `devoluciones` | Devoluciones, Reembolsos y Desistimiento | comprar |
| `terminos` | Términos y Condiciones de Uso | comprar |
| `condiciones-vendedores` | Condiciones para Vendedores Profesionales | vender |
| `productos-prohibidos` | Productos y Contenidos Prohibidos | vender |
| `reportar-problema` | Reportar un problema (canal DSA) | vender |
| `aviso-legal` | Aviso Legal | plataforma |
| `privacidad` | Política de Privacidad | plataforma |
| `cookies` | Política de Cookies | plataforma |
| `propiedad-intelectual` | Política de Propiedad Intelectual | plataforma |

**Por qué son datos y no componentes.** Estos textos los va a editar Benjamin y los va a
corregir un abogado, varias veces. Como estructura tipada se editan sin tocar lógica, se pueden
auditar con un script y se pueden exportar el día que haya que mandárselos a alguien. No se ha
añadido ninguna dependencia de markdown: cuatro tipos de bloque (`p`, `list`, `note`, `table`)
cubren lo que estos textos necesitan.

### Modelo y utilidades
`src/lib/legal.ts` — tipos (`LegalDoc`, `LegalSection`, `LegalBlock`) y **detección automática
de huecos** (`hasPlaceholders`, `countPlaceholders`).

### Rutas
- `/legal` — índice agrupado en «Comprar», «Vender», «La plataforma». Marca como *Borrador* cada
  documento con huecos.
- `/legal/[slug]` — documento. `generateStaticParams` sobre los diez slugs.

### Puntos de acceso
- **Pie de página** (`src/components/SiteFooter.tsx`) en `/`, `/ayuda`, `/como-funciona`,
  `/legal` y `/legal/[slug]`. Acceso permanente, que es lo que pide la LSSI.
- **Checkout** (`JoinFlow`): bloque `LegalRow` con la obligación de pago y enlaces a Condiciones
  de compra, Devoluciones y Privacidad; más una línea de aceptación pegada al botón. Información
  precontractual, antes de quedar vinculado.

### noindex automático
Mientras un documento contenga un hueco (`[RAZÓN SOCIAL]`, `[NIF]`, `[FECHA]`, `[●]`…),
`generateMetadata` devuelve `robots: { index: false, follow: false }`.

Esto **no es cosmético**: una página legal incompleta posicionada en Google es peor que no
tenerla. Y se apaga sola cuando los datos estén puestos — nadie tiene que acordarse de nada.

Estado a 15 sep 2026: **44 huecos**, los diez documentos en `noindex`.

---

## 3. Verificación

```bash
npx tsc --noEmit                    # limpio
npx next lint --file <ficheros>     # limpio
```

Script de estructura (duplicados, secciones vacías, recuento de huecos): compilar
`src/content/legal/index.ts` con esbuild y recorrer `LEGAL_ENTRIES`. Resultado: 0 problemas
estructurales, 175 secciones en total.

**No verificado:** render en navegador real. Las páginas son server components sin estado, así
que el riesgo es bajo, pero nadie las ha mirado todavía en producción.

---

## 4. Lo que NO está hecho (y bloquea el lanzamiento)

1. **Los textos son borrador.** Están redactados sobre el modelo de negocio real de Gropo, pero
   ningún abogado español los ha revisado.
2. **Faltan los datos de la sociedad.** 44 huecos.
3. **No hay panel de cookies.** La Política de Cookies describe categorías y consentimiento, pero
   no existe el mecanismo que lo recoge. Si Gropo solo usa cookies estrictamente necesarias hoy,
   puede ser correcto; **hay que comprobarlo**, no suponerlo.
4. **No hay onboarding de vendedor con verificación de identidad.** El DSA obliga a recabar y
   verificar razonablemente los datos del comerciante **antes** de dejarle publicar.
5. **La ficha de producto no identifica al vendedor.** Hoy el comprador no ve «Vendido por X».
   Con la arquitectura de §1, eso es una pieza de cumplimiento, no un adorno.
6. **No hay página de transparencia del ranking.** El Radar ordena por cercanía al siguiente
   tramo, actividad y otros factores; la normativa de consumo pide informar de los principales
   parámetros.

---

## 5. Las cuatro preguntas que solo puede responder Benjamin

Sin estas respuestas, ni el abogado ni yo podemos cerrar los textos, porque **la documentación
legal debe describir la realidad**, no al revés.

1. **Razón social y estructura jurídica** de Gropo.
2. **Quién emite la factura** al comprador: ¿el vendedor, Gropo, ambos?
3. **Cómo está configurado Stripe Connect exactamente:**
   - ¿Qué tipo de cuenta conectada tiene cada vendedor?
   - ¿Quién es responsable del pago frente a Stripe?
   - ¿Quién recibe inicialmente los fondos?
   - ¿Quién recibe el contracargo? ¿Quién hace el reembolso?
   - ¿Quién aparece como comercio en el extracto de la tarjeta?
   - ¿Qué mecanismo sostiene la autorización durante hasta 7 días?
4. **Quién asume contractualmente** devoluciones, contracargos y atención al cliente.

> La 3 es la más importante. Si Stripe está montado de forma incompatible con «Gropo es
> intermediario», hay que **corregir la operativa o los textos** — no publicar y confiar.

Y una quinta, para antes del lanzamiento: **obligaciones DSA de marketplace**, incluida la
verificación de identidad del vendedor y la información que debe mostrarse al consumidor.

---

## 6. Decisiones de producto ya tomadas

- **Gastos de envío**: los paga el comprador salvo que el vendedor los incluya o los ofrezca
  gratis (decisión de Benjamin, sep 2026).
- **Devolución no gratuita por defecto**: en un desistimiento, los costes directos de devolución
  los asume el consumidor salvo que el vendedor decida cubrirlos. Compatible con la regla legal
  **siempre que se informe previamente** — y se informa, en `devoluciones` §12.
- **Cuidado con el matiz**: el coste de la **entrega ordinaria inicial** sí se reembolsa en un
  desistimiento. No es lo mismo que el coste de devolución. Están separados a propósito en
  `devoluciones` §12 y §14.
- **Vocabulario**: los documentos dicen «precio máximo», no «PMA». El léxico cerrado
  (`PRODUCT_PRINCIPLES` §7) prohíbe las siglas internas en cualquier superficie que vea el
  comprador, y un documento legal es donde peor sienta una sigla sin explicar.

---

## 7. Orden recomendado para cerrarlo

1. Constituir la sociedad → rellenar los 44 huecos → el `noindex` desaparece solo.
2. Auditar Stripe Connect y responder las cuatro preguntas de §5.
3. Ajustar los textos a lo que diga esa auditoría (o ajustar la operativa).
4. Revisión por un abogado español especializado en consumo y marketplaces.
5. Construir lo de §4: panel de cookies, onboarding de vendedor, «Vendido por» en la ficha,
   transparencia del ranking.
