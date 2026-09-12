# KNOWN_ISSUES.md — Gropo

> Lista priorizada de problemas **verificados** el 6 de septiembre de 2026 contra el código
> (`main @ 7c49ef3`) y la base de datos de producción.
>
> **P0** crítico · **P1** alto · **P2** medio · **P3** bajo.
> **Ningún problema de esta lista ha sido corregido.** Este documento no propone
> implementaciones; la columna "solución potencial" es descriptiva.

---

## ÍNDICE

| ID | Título | Prioridad | ¿Ha ocurrido ya? |
|---|---|---|---|
| P0-01 | Miembros duplicados: sin dedup en ninguna capa | ✅ resuelto | ✅ **Verificado 11-sep-2026** |
| P0-02 | Acceso a datos ajenos por (teléfono + email) desde `anon` | 🔴 P0 | ❓ desconocido |
| P0-03 | `JoinFlow` muestra éxito sin esperar al webhook | ✅ resuelto | ✅ **Verificado 12-sep-2026** |
| P0-04 | El PaymentIntent del checkout no es idempotente → holds duplicados | ✅ resuelto | ✅ **Verificado 11-sep-2026** |
| P0-05 | `CRON_SECRET` ausente de `.env.local`; **presente en Vercel** | ✅ resuelto | ✅ **Verificado 11-sep-2026** |
| P0-06 | El checkout se cuelga al tocar el selector de unidades | 🟠 no reproducible · mitigado | ⚠️ **Una vez, 11-sep-2026. No reproducible desde entonces** |
| P1-01 | Deriva producción ↔ repositorio en 5 funciones SQL | 🟠 P1 | ✅ Sí |
| P1-02 | `supabase/prepare_join.sql` está corrupto y no parsea | ✅ resuelto | ✅ **Verificado 11-sep-2026** |
| P1-03 | Multi-puja nunca ejecutada con dinero real (Gate G6) | 🟠 P1 | — |
| P1-04 | Grupo atrapado en `closing` (excedente con segunda puja) | 🟠 P1 | ❌ nunca ejecutado |
| P1-05 | Adjudicado sin email: sin instrucciones y sin alerta | 🟠 P1 | ❓ desconocido |
| P1-06 | Cero tests automatizados | 🟠 P1 | — |
| P1-07 | `users_phone_key` no existe: rama de código inalcanzable | 🟠 P1 | ✅ 2 teléfonos duplicados |
| P1-08 | Apple Pay y Google Pay se anuncian pero no funcionan | 🟠 P1 | ✅ **Sí, en producción** |
| P2-01 | El stock restante mostrado en el checkout sobreestima | 🟡 P2 | ❓ |
| P2-02 | Adjudicación sin relleno: un pedido grande bloquea a los posteriores | 🟡 P2 | ❌ (0 cierres) |
| P2-03 | `rate_limits` crece sin límite y no tiene primary key | 🟡 P2 | ❓ |
| P2-04 | Copy de compartir desactualizado tras el cambio de `next_price` | 🟡 P2 | ✅ Sí |
| P2-05 | PaymentIntents huérfanos por checkout abandonado | 🟡 P2 | ❓ |
| P2-06 | Nadie avisa a quien se queda fuera del grupo | 🟡 P2 | ❌ (0 cierres) |
| P2-07 | Rate limiting *fail-open* | 🟡 P2 | ❓ |
| P2-08 | La cookie de admin es el propio `ADMIN_SECRET` | 🟡 P2 | ❓ |
| P3-01 | 14 componentes huérfanos (~1.500 líneas) | 🔵 P3 | ✅ Sí |
| P3-02 | Rebranding Vonda → Gropo incompleto en runtime | 🔵 P3 | ✅ Sí |
| P3-03 | Precio fluido (`price_mode`) declarado y no implementado | 🔵 P3 | ✅ Sí |
| P3-04 | Cláusula del 75% documentada e inexistente | 🔵 P3 | ✅ Sí |
| P3-05 | Enums y columnas muertos | 🔵 P3 | ✅ Sí |
| P3-06 | `<html lang="en">` en una app en castellano | 🔵 P3 | ✅ Sí |
| P3-07 | `/api/my-groups`: fallback con hasta 51 round-trips | 🔵 P3 | ✅ Sí |
| P3-08 | `README.md` es el de `create-next-app` | 🔵 P3 | ✅ Sí |

---

## 🔴 P0 — CRÍTICO

### ✅ P0-01 · Miembros duplicados — RESUELTO (11-sep-2026)

> **REGLA DE PRODUCTO FIJADA:** 1 usuario + 1 grupo = **1 pedido único**. No existe ampliación
> de pedido ni segunda participación. Si algún día se permite ampliar, será una decisión de
> producto nueva y **no** debe resolverse creando una segunda fila.
>
> **RESOLUCIÓN** — migración `p001_one_membership_per_user_per_group`, en este orden:
> 1. `confirm_join` — rama `ELSIF v_constraint = 'uniq_member_per_group_alive'` →
>    `needs_release / already_member`, para que el webhook cancele el hold sobrante.
> 2. Índice `uniq_member_per_group_alive` sobre `(group_id, user_id)` **parcial**
>    (`WHERE payment_status IN ('authorized','instructed','paid')`).
> 3. `prepare_join` — rechazo por **teléfono** antes de crear el hold.
>
> ⚠ **El orden no es opcional.** Crear el índice sin la rama de `confirm_join` convierte este
> bug en uno peor: la `unique_violation` cae en `ELSE→RAISE`, el webhook devuelve 500, Stripe
> reintenta indefinidamente y el hold **nunca se cancela** (7 días de dinero retenido).
>
> **VERIFICADO** 22/22 pruebas sobre BD sintética (incluido `INSERT` directo saltándose
> `confirm_join` → rechazado por el índice) + prueba real en producción: compra con tarjeta de
> test y segundo intento bloqueado con el mensaje correcto, 1 fila, 0 duplicados.
>
> **LÍMITE CONOCIDO.** La identidad se resuelve por **email** (`ON CONFLICT (email)`). La misma
> persona con dos emails distintos son dos `user_id` y el índice los ve como legítimos.
> `prepare_join` tapa parcialmente ese hueco comprobando por teléfono. El cierre real depende de
> la unificación de identidad → **P0-02**.
>
> Los **3 pares duplicados históricos** (no 2, como decía esta ficha) están todos en el grupo
> de test `a0000000-…-000000000001`, todas las filas en `cancelled` y con `captured_amount = 0`:
> el mecanismo era real, pero **nunca cobró de más a nadie**. El índice parcial los ignora.

**Problema (histórico).** La misma persona puede ser miembro N veces del mismo grupo.

**Archivos / funciones.**
- `public.prepare_join` (producción) — el check de duplicado **fue eliminado**.
- `public.confirm_join` (producción) — el check por `(phone OR email)` **fue eliminado**.
- Tabla `group_members` — **no existía UNIQUE `(group_id, user_id)`** (hoy sí: `uniq_member_per_group_alive`).
- `src/app/api/join/create-intent/route.ts` — no comprueba membresía previa.

**Causa.** Tres capas fallando a la vez. Los checks **sí están** en
`supabase/prepare_join.sql` y `supabase/confirm_join.sql`, pero las versiones desplegadas no los
tienen. `confirm_join` los sustituyó por un manejador de `unique_violation` que discrimina por
`CONSTRAINT_NAME`, con una rama para `users_phone_key`… **constraint que nunca se creó**
(ver P1-07).

**Impacto.**
- Doble clic → dos holds sobre la misma tarjeta → dos miembros → **doble cobro y doble envío**
  al cierre.
- **Inflado artificial de la demanda** para desbloquear tramos baratos (limitado solo por los
  rate limits, uno de ellos *fail-open*).
- Rompe el invariante INV-20.

**Evidencia.**
```sql
SELECT count(*) FROM (SELECT group_id, user_id FROM group_members
                      GROUP BY 1,2 HAVING count(*) > 1) d;   -- → 2
```

**Solución potencial (descriptiva).** Índice único parcial sobre
`(group_id, user_id) WHERE payment_status IN ('authorized','instructed','paid')`;
restaurar el check en `prepare_join`; `idempotencyKey` en `create-intent`. Limpiar antes los
duplicados existentes. ⚡ Money-critical: requiere gate, propuesta y confirmación explícita.

❓ **UNKNOWN:** no consta si la eliminación de los checks fue deliberada (¿permitir "ampliar
pedido"?) o una regresión. No hay comentario, commit ni documento que lo explique.

---

### P0-02 · Acceso a pedidos y direcciones ajenos por (teléfono + email) desde `anon`

**Problema.** Siete funciones `SECURITY DEFINER` ejecutables por el rol `anon` resuelven la
identidad con un par (teléfono, email) que llega **como parámetro desde el cliente**.

**Archivos / funciones.** `_profile_uid`, `get_my_groups`, `get_profile`, `address_add`,
`address_update`, `address_delete`, `address_set_default`, `radar_prefs_save`.

**Impacto.** Lectura del historial de pedidos y de todas las direcciones postales de cualquier
persona cuyo teléfono y email se conozcan; y **modificación de su dirección de envío
predeterminada**, que es la que precarga el checkout y la base de la etiqueta de Sendcloud →
**redirección de un envío físico**.

**Evidencia.** `has_function_privilege` en vivo + el linter de Supabase
(`anon_security_definer_function_executable`). Detalle completo en `SECURITY.md` SEC-01.

**Contexto que impide un `REVOKE` directo.** Ocho puntos del código llaman a estas RPC
**desde el navegador con la clave anon** (`notificaciones/page.tsx`, `perfil/page.tsx` ×7,
`JoinFlow.tsx`). Revocar sin migrarlos antes rompe esas páginas.

**Reconocido en la documentación.** `supabase/profile_identity.sql` describe el problema y
declara el fallback anónimo como **retrocompatibilidad consciente**. `CLAUDE.md` lo lista como
*"PENDIENTE (decisión aplazada): unificación real de identidad"*.

**Solución potencial (descriptiva).** Migrar las 8 llamadas a endpoints server-side que
verifiquen la sesión (patrón de `/api/my-groups`), y después revocar `EXECUTE` a
`anon`/`authenticated`. ⚡ Money-critical + RLS.

---

### ✅ P0-03 · `JoinFlow` muestra la pantalla de éxito sin esperar al webhook — RESUELTO (12-sep-2026)

> **RESOLUCIÓN** — commit `1185b83`. `JoinFlow` hace ahora el mismo polling contra
> `/api/join/status` que `FastCheckoutModal`: hasta 18 intentos de 1 s antes de redirigir, con un
> estado propio (`confirming`, botón *"Confirmando tu plaza…"*) que impide volver al botón inicial
> mientras tanto. Agotado el margen se continúa igualmente, porque la retención **sí** está
> aceptada y devolver al comprador al punto de partida sería una mentira peor.
>
> **EL OBSTÁCULO TÉCNICO NO EXISTÍA.** No hizo falta tocar `create-intent` para que devolviera
> `pi_id`: el identificador ya viaja dentro del `clientSecret`
> (`String(clientSecret).split('_secret')[0]`), que es como `FastCheckoutModal` lo obtiene desde
> julio. Cero cambios en backend y cero contratos de API rotos.

**Problema (histórico).** El checkout principal redirige a `/unido` inmediatamente tras
`stripe.confirmPayment`, sin comprobar que la membresía exista.

**Archivo.** `src/app/grupo/[id]/unirme/JoinFlow.tsx:896`
```ts
window.location.href = `/grupo/${group.id}/unido`;
```
Verificado: `grep -c "join/status" JoinFlow.tsx` → **0**.

**Causa.** Los commits `b1e5229` (*"fix: honest checkout confirmation - wait for membership
before success"*) y `fc1ce4a` implementaron el polling contra `/api/join/status` **solo en
`FastCheckoutModal.completeSuccess()`**. `JoinFlow` — la ruta principal desde la ficha de
producto — se quedó sin el arreglo.

**Impacto.** Si `confirm_join` devuelve `needs_release` (grupo cerrado, sin stock), el usuario
ya está viendo la pantalla de éxito mientras su hold se cancela. Es exactamente el bug que esos
commits pretendían cerrar.

**Obstáculo técnico (creído, y falso).** Se dio por hecho que `create-intent` **no devolvía
`pi_id`** y que por tanto `JoinFlow` no tenía el identificador que `/api/join/status` necesita.
El `pi_id` estaba todo el tiempo dentro del `clientSecret`.

---

### ✅ P0-04 · PaymentIntent no idempotente — RESUELTO (11-sep-2026)

> **RESOLUCIÓN** — commits `015f467` y `7c9798e`. La clave de idempotencia **se deriva del
> payload real** (SHA-256 de los parámetros enviados), mediante `idempotencyKeyFor()` en
> `src/lib/stripe.ts`. Aplicada en `create-intent` (PaymentIntent **y** `customers.create`) y en
> `checkout/lock`.
>
> **POR QUÉ DERIVADA Y NO ESCRITA A MANO.** El primer intento usó una clave compuesta a mano
> (`grupo + teléfono + cantidad`) y **falló en producción**: Stripe exige que una misma clave se
> use siempre con los mismos parámetros, y para un **invitado** `customers.create` generaba un
> Customer nuevo en cada intento → `piParams.customer` cambiaba → Stripe rechazaba la segunda
> petición con *"Keys for idempotent requests can only be used with the same parameters"*.
> Protegía el dinero por accidente, rompiendo el checkout. Derivando la clave del payload,
> "misma clave" y "mismos parámetros" no pueden contradecirse nunca.
>
> Efecto lateral positivo: el `customers.create` idempotente elimina un defecto anterior — cada
> intento de compra de un invitado creaba un Customer nuevo en Stripe.
>
> **VERIFICADO en producción:** dos peticiones idénticas a `/api/join/create-intent` devolvieron
> el mismo PaymentIntent (`pi_3UEaFzA114rXo3Ka0trWudSg`).

**Problema (histórico).** Ni `create-intent` ni `checkout/lock` usan `idempotencyKey` de Stripe.

**Archivos.** `src/app/api/join/create-intent/route.ts:167` ·
`src/app/api/checkout/lock/route.ts:156`.
(Contraste: `src/lib/pulse.ts:141` **sí** usa `idempotencyKey: pulse-{pledge}-{triggered_at}`.)

**Impacto.** Un doble submit crea dos PaymentIntents distintos → dos holds reales sobre la misma
tarjeta. Como tienen PIs distintos, `uniq_group_members_pi` no los detecta y `confirm_join` crea
dos miembros (ver P0-01).

**Mitigaciones existentes.** Rate limits (uno *fail-open*) y el estado `loading` que deshabilita
el botón durante la petición.

---

### ✅ P0-05 · `CRON_SECRET` — RESUELTO (11-sep-2026)

> **Resolución.** Verificado en el panel de Vercel el 11-sep-2026: `CRON_SECRET` **existe**, en
> Production y Preview, actualizada el 4-jul-2026. El cierre automático dominical está armado y
> se dispara. Sigue ausente de `.env.local`, que es solo el entorno de desarrollo local.
> Se conserva la ficha porque el mecanismo de "falla cerrado" y el impacto descrito siguen
> siendo exactos si algún día se borrara la variable.

**Problema (histórico).** El cron de cierre **falla cerrado**:
```ts
if (!process.env.CRON_SECRET || req.headers.get('authorization') !== expected)
  return new NextResponse('Unauthorized', { status: 401 })
```
Sin esa variable, **los grupos no se cierran nunca automáticamente**.

**Evidencia.** `.env.local` contiene 9 variables; el código usa **27**. Faltan `CRON_SECRET`,
`RESEND_API_KEY`, `RESEND_FROM`, `ADMIN_EMAIL`, `NEXT_PUBLIC_SITE_URL` y las 12 de Sendcloud.

**Impacto si falta también en Vercel.** Los grupos vencidos permanecen `open`; los holds
caducan a los 7 días sin capturarse; nadie recibe emails; las etiquetas saldrían con el
remitente de placeholder (`"Gropo Envios (test)"`, `Carrer de Prova 1`, `envios@vonda.es`) y con
`shipping_option_code = 'sendcloud:letter'` — **no** `correos_express:paq24` como afirma
`CLAUDE.md`.

**STATUS:** ✅ **RESUELTO el 11-sep-2026** — `CRON_SECRET` verificada presente en Vercel.

---

## 🟠 P1 — ALTO

### P1-01 · Deriva producción ↔ repositorio en 5 funciones SQL

**Problema.** Los ficheros `supabase/*.sql` **no son migraciones** y no reflejan lo desplegado.

| Función | Repositorio | Producción |
|---|---|---|
| `compute_price` | `(uuid, integer)`, single-bid, `next_price` v1 | `(uuid, integer, numeric)`, multi-puja, `next_price` v2 |
| `tier_demand` | single-bid, sin fusión | escalera fusionada con mínimo acumulado |
| ~~`prepare_join`~~ | ✅ **sincronizado 11-sep-2026** | espejo del cuerpo vivo |
| ~~`confirm_join`~~ | ✅ **sincronizado 11-sep-2026** | espejo del cuerpo vivo |
| `close_group` | v1 single-bid, PMA solo esperadores | v2 multi-puja, **PMA universal** |
| `get_my_groups` | `(p_phone)` — **1 argumento** | `(p_phone, p_email)` — 2 argumentos |
| `create_petition` | v1 | v3 (anti-spam 5/h + upsert no destructivo) |

Además `supabase/revoke_join_group.sql` revoca `join_group(uuid,text,text,text,integer)`,
**función que ya no existe en `pg_proc`** (fue eliminada, no solo revocada).

**Impacto.** Cualquier persona o IA que lea el repositorio sin consultar la base de datos
**razonará sobre un algoritmo que ya no existe**. Reconstruir la BD desde estos ficheros
produciría un sistema funcionalmente distinto y peor.

**Ficheros que SÍ coinciden:** `shipping_columns.sql`, `event_type_add_petition_created.sql`
(DDL aditivo idempotente) y, desde el 11-sep-2026, `prepare_join.sql`, `confirm_join.sql` y
`p001_unique_member_per_group.sql`.

**Quedan 5 con deriva:** `compute_price`, `tier_demand`, `close_group`, `get_my_groups`,
`create_petition`.

---

### ✅ P1-02 · `supabase/prepare_join.sql` corrupto — RESUELTO (11-sep-2026)

> **RESOLUCIÓN.** El fichero se ha reescrito por completo como espejo del cuerpo vivo en
> producción, con cabecera que indica la fecha y cómo comparar con `pg_get_functiondef`.
> Ya es SQL válido y ejecutable.

**Problema (histórico).** En la línea 78 del fichero aparece:
```
$function$;R REPLACE FUNCTION public.prepare_join(
```
Un pegado roto que duplica el cuerpo completo. **El fichero no es SQL válido y no se puede
ejecutar.**

**Impacto.** Además de la deriva de P1-01, es un fichero irrecuperable tal cual: no sirve ni
como referencia histórica fiable.

---

### 🟠 P0-06 · El checkout se cuelga al tocar el selector de unidades — NO REPRODUCIBLE, MITIGADO

> **ESTADO (12-sep-2026).** Ocurrió una vez, en producción, el 11-sep. **No se ha vuelto a
> reproducir en siete configuraciones distintas.** La causa sigue siendo **UNKNOWN**. El síntoma
> está mitigado (commit `ed80b1c`), pero mitigar no es arreglar: si vuelve a aparecer, esta
> sección es el punto de partida y hay que empezar por lo que ya está descartado.
>
> **Siete configuraciones probadas el 12-sep, ninguna se colgó:**
>
> | # | Configuración | `elements.submit()` |
> |---|---|---|
> | 1 | Página aislada, cambio de importe, sin tarjeta | 26 ms |
> | 2 | Página aislada, cambio de importe, **con tarjeta** | 33 ms |
> | 3 | `/unirme` real, sin tarjeta, tras cambiar la cantidad | 41 ms |
> | 4 | `/unirme` real, **con tarjeta**, tras cambiar la cantidad | 37 ms · siguió a `create-intent` |
> | 5 | `update()` disparado **con `submit()` en vuelo** (0 / 10 / 200 ms) | 54 / 53 / 34 ms |
> | 6 | Doble `update()` por **cruce de tramo** (200 € → 160 €, confeti incluido) | 44 ms |
> | 7 | **Build de producción sobre HTTPS** (preview de Vercel), grupo abierto real, cruce de tramo, tarjeta real | **compra completada de extremo a extremo** |
>
> **Hipótesis descartadas con evidencia — no volver a plantearlas sin datos nuevos:**
>
> 1. ~~`capture_method` / `setup_future_usage` en snake_case son claves inválidas~~ →
>    **son válidas**: `@stripe/stripe-js` v9.8 declara ambas grafías en `StripeElementsOptionsMode`.
> 2. ~~`<Elements>` recibe un cambio de opción no soportado~~ → **no ocurre**:
>    `extractAllowedOptionsUpdates` (react-stripe-js v6.6, `dist/react-stripe.js:299`) compara con
>    igualdad profunda y solo pasa `{amount}`. Por eso nunca apareció el warning esperado.
> 3. ~~`submit()` se cuelga después de `update({amount})`~~ → configuraciones 1-4 y 6.
> 4. ~~Carrera: el quote actualiza el importe con `submit()` en vuelo~~ → configuración 5.
>
> **Dato que descarta el "se arregló por el camino":** el commit `1185b83` (P0-03) solo añadió
> polling **después** de `confirmPayment`. El camino del cliente hasta `create-intent` es idéntico
> al que estaba vivo el 11-sep. Es el mismo código, y no se cuelga.
>
> **MITIGACIÓN aplicada** (commit `ed80b1c`, `JoinFlow.tsx`):
> - **El pedido se congela** al pulsar el botón: el importe que ve Stripe deja de seguir al precio
>   en vivo (`frozenAmount`) y el selector de unidades se deshabilita (`checkoutBusy`). Cierra por
>   construcción cualquier discrepancia entre lo que Stripe cree y lo que el servidor cobra.
> - **Reloj de seguridad de 20 s** sobre `elements.submit()`: si no responde, el botón vuelve con
>   un mensaje claro en lugar de dejar al comprador atrapado. Seguro por construcción — ocurre
>   antes de `create-intent`, así que no existe ninguna retención y reintentar no puede duplicar
>   nada.
>
> **Qué falta por probar si reaparece:** móvil real · modo *esperar* · doble pulsación rápida del
> botón · sesión de navegador con Stripe.js cacheado o extensiones activas.

**Descripción original del 11-sep-2026:**

**Problema.** En `/grupo/[id]/unirme`, si el usuario **cambia la cantidad** antes de comprar, al
pulsar el botón el checkout se queda en *"Procesando…"* indefinidamente (>1 minuto observado) y
**no llega a salir ninguna petición del navegador**.

**Evidencia — experimento controlado del 11-sep-2026.** Tres intentos consecutivos del mismo
usuario sobre el mismo grupo:

| # | Pantalla | Tocó el selector | Resultado |
|---|---|---|---|
| 1 | `/unirme` | **Sí** | 🔴 **Colgado.** Cero filas en `rate_limits`: `create-intent` nunca se llamó |
| 2 | Panel rápido (1-Click) | — | ✅ OK · `checkout-lock` a las 23:07:43 → miembro 3 s después |
| 3 | `/unirme` | **No** | ✅ OK · `create-intent` a las 23:11:27 → miembro 3 s después |

Misma pantalla y mismo código en 1 y 3. La única variable es haber tocado el selector.
Una vez la petición llega al servidor, todo tarda **3 segundos**: el problema es **íntegramente
del lado del navegador, antes de enviar nada**.

**Localización.** El único paso entre pulsar el botón y la llamada a `create-intent` es
`await elements.submit()` en `JoinFlow.tsx` (`handleSubmit`, tras `setLoading(true)`).

**Sospecha (NO CONFIRMADA).** `src/app/grupo/[id]/unirme/JoinFlow.tsx:673`

```tsx
const elementsOptions = useMemo(() => ({ mode, amount: amountCents, currency,
  capture_method, setup_future_usage, paymentMethodTypes, appearance }), [amountCents]);
<Elements stripe={stripePromise} options={elementsOptions}>
```

Cambiar la cantidad recrea el objeto de opciones. `mode`, `currency`, `capture_method`,
`setup_future_usage` y `paymentMethodTypes` son **inmutables** tras crear la instancia; el
importe se cambia con `elements.update({ amount })`.

❓ **UNKNOWN.** Al reproducirlo con la consola abierta **NO apareció** ningún
`Unsupported prop change` de Stripe.js. La hipótesis **no está confirmada** y no debe
implementarse un arreglo basándose en ella sin más evidencia.

**Siguiente paso de diagnóstico.** Pulsar `+` con la consola abierta y observar **si el
formulario de la tarjeta parpadea, se queda en blanco o se recarga**. Eso distingue entre
"Stripe se reinicializa mal" y "el problema está en otro sitio".

**Impacto.** Bloquea por completo la compra en el camino principal con un gesto que hace
cualquier comprador normal: elegir cuántas unidades quiere. **Bloquea el Ensayo 3 / Gate G6**:
con varias personas reales uniéndose, sería el primer punto de caída.

---

### P1-08 · Apple Pay y Google Pay se anuncian en el checkout pero no funcionan

**Problema.** El pie del checkout muestra los logos de **VISA · Mastercard · Apple Pay · G Pay**,
pero los dos monederos están **inoperativos**: el dominio no está registrado ni verificado en
Stripe.

**Evidencia.** Consola de producción en `/unirme`, 11-sep-2026:
```
[Stripe.js] You have not registered or verified the domain, so the following
payment methods are not enabled in the Payment Element: – apple_pay
Unable to download payment manifest "https://www.google.com/pay"   (×2)
```

**Impacto.** Anunciar un método de pago que no funciona es peor que no anunciarlo: el comprador
que busca Apple Pay no lo encuentra y abandona. Afecta a conversión y a confianza, justo en la
pantalla donde más importan.

**Solución potencial (descriptiva).** Registrar y verificar el dominio en Stripe
(*Payment method domains*), o retirar esos dos logos del pie hasta que esté hecho.
Ver `LAUNCH_CHECKLIST.md`.

---

### P1-03 · La maquinaria multi-puja nunca se ha ejecutado con dinero real

**Problema.** Todo el motor multi-puja está implementado (`compute_price`, `tier_demand`,
`close_group` v2, `addBidToGroup`, `withdrawBid`, RLS de `bids`) pero **nunca ha corrido con más
de una puja**.

**Evidencia.**
```sql
SELECT MAX(c) FROM (SELECT count(*) c FROM bids WHERE status='active' GROUP BY group_id) x;  -- → 1
```
El **Gate G6** de la especificación (ensayo E2E multi-puja con holds reales) está pendiente.

**Impacto.** Los caminos multi-puja de `close_group` — selección de candidata, elegibilidad por
puja, ramas de excedente — **no tienen ninguna validación empírica**.

---

### P1-04 · Grupo atrapado permanentemente en `closing`

**Problema.** `close_group` rama 9B-b: si hay excedente **y** existe una segunda puja activa, el
grupo se queda en `status='closing'` a propósito (esperando decisión del admin), pero
**no existe ninguna UI, endpoint ni función para resolverlo**.

**Archivo.** `public.close_group`, rama final.

**Detalles.**
- `closeGroup()` re-ejecutado devuelve `already_closing`.
- `withdrawBid` solo opera sobre grupos `open`.
- `second_price_at_n` se devuelve **siempre `NULL`** (`v_second_price := NULL;` — la lógica de
  valorar la segunda puja no está implementada).
- El excedente permanece `authorized` → **holds vivos que caducarán a los 7 días**.

**Mitigante.** Nunca se ha ejecutado (consecuencia de P1-03).

---

### P1-05 · Un adjudicado sin email no recibe instrucciones y nadie se entera

**Archivo.** `src/lib/emails/sendClose.ts:71`
```ts
const email: string | undefined = u?.email
if (!email) { failed++; continue }
```

**Impacto.** Un miembro `instructed` debe hacer una transferencia en 48 h. Si no tiene email, no
la recibe. `closeGroup` solo registra el resultado por consola y **no dispara `sendAdminAlert`**
para este caso (solo lo hace para fallos de captura).

---

### P1-06 · Cero tests automatizados

**Evidencia.** Búsqueda exhaustiva de `*.test.*`, `*.spec.*`, `jest.config*`, `vitest.config*`,
`playwright.config*` en todo el repositorio (excluyendo `node_modules`): **0 resultados**.
`package.json` no tiene script `test`.

**Lo que existe en su lugar.** Ensayos manuales documentados en runbooks
(`ENSAYO_F3_runbook.md`, `ENSAYO_PULSE_runbook.md`), el script manual
`supabase/test_close_group.sql`, y `CHECKLIST_PRODUCCION.md`.

**Impacto.** El sistema mueve dinero real y no hay red de seguridad automatizada. Cualquier
cambio en las funciones SQL puede alterar el precio o la adjudicación sin que nada lo detecte.

---

### P1-07 · `users_phone_key` no existe: rama de código inalcanzable

**Problema.** `confirm_join` (producción) contiene:
```sql
ELSIF v_constraint = 'users_phone_key' THEN
  RETURN json_build_object('status','needs_release','reason','phone_in_use');
```
**Esa constraint no existe.** `pg_constraint` sobre `users` devuelve únicamente `users_pkey`,
`users_email_key` y `users_auth_id_key`.

**Impacto.** El teléfono **no es único**; dos `users` distintos pueden compartirlo. El upsert es
`ON CONFLICT (email)`, así que un usuario B con el teléfono de A simplemente crea otra fila.
Amplía la superficie de pares (teléfono, email) válidos para P0-02.

**Evidencia.** 2 teléfonos duplicados en `users`.

---

## 🟡 P2 — MEDIO

### P2-01 · El stock restante mostrado en el checkout sobreestima
`src/app/grupo/[id]/unirme/JoinFlow.tsx:115`
```ts
const remaining = group.max_stock > 0 ? Math.max(1, group.max_stock - group.total_units) : 10;
```
`total_units` es demanda **firme** (fluctúa con el precio), no unidades comprometidas. Con
esperadores por debajo del precio vigente, `total_units` es mucho menor que lo realmente
comprometido. **El servidor lo corrige en `prepare_join`**, así que no es un fallo de dinero:
el usuario rellena todo el formulario y es rechazado al final con *"Stock insuficiente"*.

### P2-02 · Adjudicación sin relleno
`close_group` paso 6: el corte es `cum_qty <= max_stock` evaluado por filas completas. Si el
siguiente miembro no cabe entero, quedan fuera **él y todos los posteriores**, aunque alguno
pidiera 1 unidad y cupiese.
❓ **UNKNOWN** si es deliberado (FCFS estricto sin fraccionar pedidos es defendible) o un
descuido. No hay comentario que lo aclare.

### P2-03 · `rate_limits` crece sin límite y no tiene primary key
`check_rate_limit` solo purga la ventana **de la clave consultada**. Las claves de un solo uso
nunca se borran. La tabla no tiene PK (verificado en `pg_constraint`). Combinado con P2-07
(*fail-open*), la degradación puede acabar desactivando el rate limiting.

### P2-04 · Copy de compartir desactualizado tras el cambio de `next_price`
`src/components/HeroShareButton.tsx:16` (**componente vivo**):
> `"🚴 ${productName} a ${bestPrice}€ (PVP ${pvp}€). Si entra 1 más baja a ${nextPrice}€..."`

Con la semántica v2, `next_price` es el **siguiente escalón real**, que puede requerir varias
unidades. La promesa es **falsa**. Los otros dos sitios con el mismo copy
(`ShareButton.tsx:18`, `desktop/GroupSidebar.tsx:82`) son **componentes huérfanos**.
También el comentario de `src/app/api/group/[id]/quote/route.ts:32` está obsoleto.

### P2-05 · PaymentIntents huérfanos por checkout abandonado
Un PI creado por `create-intent` que nunca se confirma queda en `requires_payment_method`
indefinidamente en Stripe. **No hay limpieza.** Sin impacto para el comprador (no hay hold).

### P2-06 · Nadie avisa a quien se queda fuera del grupo
`sendClosePaymentEmails` filtra `.in('payment_status', ['instructed','paid'])`. Por tanto **no
reciben ninguna comunicación**:
- Los esperadores cuyo `target_price` no se alcanzó (hold liberado).
- Los compradores cancelados por RULE-032 (precio final por encima de su `guaranteed_price`).
- Todos los miembros de un grupo cancelado por Regla 6.

Su hold desaparece sin explicación. Es el peor momento de la experiencia y no está cubierto.

### P2-07 · Rate limiting *fail-open*
Ver `SECURITY.md` SEC-04. Decisión consciente
(*"un fallo del limitador nunca bloquea compras"*), pero significa que tumbar `rate_limits`
desactiva el rate limiting.

### P2-08 · La cookie de admin es el propio `ADMIN_SECRET`
Ver `SECURITY.md` SEC-03. El panel puede cerrar grupos y mover dinero real; no hay rotación,
expiración del secreto, sesiones individuales, 2FA ni auditoría.

---

## 🔵 P3 — BAJO

### P3-01 · 14 componentes huérfanos (~1.500 líneas)
Verificado buscando cada nombre en todo `src/` excluyendo su propio fichero:
`BestPriceReached`, `CountdownChip`, `GroupLiveSection2c`, **`JoinModeSelector`**,
`MobileVariantWrapper`, `PriceJourney`, `ShareButton`, **`TierDemandLadder`**,
`desktop/GroupCenterContent`, `desktop/GroupSidebar`, `desktop/HomeCardSlider`,
`desktop/HomeCarousel`, `desktop/HomeProductCard`, `desktop/HomeSidebar`.

⚠️ **`CLAUDE.md` lista `JoinModeSelector` y `TierDemandLadder` como "Archivos clave".**
Ambos son código muerto. `CLAUDE.md` también menciona `VondaTargetSlider`, fichero que **no
existe**: el real es `GropoTargetSlider.tsx`.

### P3-02 · Rebranding Vonda → Gropo incompleto en runtime
El commit `c29eb2b` rebrandeó *"UI, emails, componentes, CSS"* declarando explícitamente
*"dominio y claves intactos"*. Restos verificados:
- `src/lib/pulse-notify.ts:22` → `const BASE_URL = 'https://www.vonda.es'`
- `src/lib/resend.ts:11`, `src/app/api/stripe/webhook/route.ts:27`, `pulse-notify.ts:21` →
  remitente por defecto `Gropo <no-reply@vonda.es>`
- `src/lib/shipping-sendcloud.ts:24` → `envios@vonda.es` por defecto
- Clave `localStorage['vonda_user']` en 9 puntos del código
- `package.json` → `"name": "kuorum"`; repositorio GitHub `thedesignerux-lgtm/kuorum`
- Toda la documentación (`CLAUDE.md`, `AGENTS.md`, 7 `VONDA_HANDOFF_*.md`)

El dominio real, deducido de `src/lib/auth-cookie-domain.ts`, es **`gropo.es`**.

### P3-03 · Precio fluido declarado y no implementado
Enum `price_mode`, columna con default `'fluid'`, función `compute_price_at_n` y selector en el
admin — pero **ningún motor lee `price_mode`** y `compute_price_at_n` **no tiene llamantes**.
Todos los tramos se comportan como `stepped`. Ver `BUSINESS_RULES.md` RULE-027.

### P3-04 · Cláusula del 75% documentada e inexistente
Búsqueda de `75%`, `0.75` y `tolerancia` en `src/` y `supabase/`: solo
`origin: {y: 0.75}` (confeti) y `clientWidth * 0.75` (carousel).
Ver `BUSINESS_RULES.md` RULE-037.

### P3-05 · Enums y columnas muertos
- `payment_status`: `captured`, `failed`, `refund_due` nunca se escriben. `pending` es el default
  pero ningún flujo lo produce. `auth_failed` solo aparece en el mapa de badges del admin.
- `bid_status`: `declined` nunca se escribe.
- `event_type`: `bid_placed` y `bid_improved` nunca se insertan.
- Columnas declaradas y nunca escritas: `bids.improved_at`, `bids.bid_revisions`,
  `group_members.stripe_customer_id`.
- Tablas sin foreign key: `user_addresses.user_id`, `user_radar_prefs.user_id`,
  `groups.winner_bid_id`.

### P3-06 · `<html lang="en">` en una app íntegramente en castellano
`src/app/layout.tsx:40`. Las plantillas de email **sí** usan `<html lang="es">`.
Problema de accesibilidad (lectores de pantalla).

### P3-07 · `/api/my-groups`: fallback con hasta 51 round-trips
`src/app/api/my-groups/route.ts:27-54`. Si no encuentra teléfono por email, lee los 50
`group_members` más recientes de toda la tabla y consulta `users` por cada uno. No es un fallo
de seguridad (compara contra el email del JWT), pero es O(n) innecesario.

### P3-08 · `README.md` es el de `create-next-app`, sin tocar
El README del proyecto no describe el proyecto.

---

## PROBLEMAS QUE **NO** EXISTEN (verificado, para evitar falsos positivos)

| Sospecha razonable | Verificación |
|---|---|
| Sobrecargas duplicadas de funciones SQL | ❌ **No hay.** 21 funciones en `public`, ningún nombre repetido en `pg_proc` |
| Funciones money-critical accesibles por `anon` | ❌ **No.** `close_group`, `confirm_join`, `prepare_join`, `check_rate_limit`, `pulse_*` verificadas: `anon=false`, `authenticated=false` |
| SQL injection | ❌ No hay concatenación de SQL en ningún sitio |
| XSS por `dangerouslySetInnerHTML` | ❌ Cero ocurrencias en todo el repositorio |
| Secretos commiteados | ❌ `.gitignore` cubre `.env*.local` y `*.save`; ninguno está rastreado |
| Guard de `group_id` ausente en el webhook | ❌ **Sí existe** (`webhook/route.ts:58`). Lo que falta es validar el **formato/existencia** del uuid, no su presencia |
| Miembros en limbo (`instructed` sobre grupos cerrados) | ❌ No hay ninguno: los 15 `group_members` están todos en `authorized` y no existe ningún grupo cerrado |
| `/admin/email-test` sin protección | ❌ **Sí está protegido** por la cookie `admin_auth` |
| `/mensajes` y `/notificaciones` son placeholders vacíos | ⚠️ **Parcialmente falso.** `/mensajes` sí es un estado vacío estático; **`/notificaciones` es funcional**: deriva avisos reales de `get_my_groups` + `tier_demand`. `/peticion` **sí** es un placeholder (*"próximamente"*) |
