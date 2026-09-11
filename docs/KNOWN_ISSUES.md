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
| P0-01 | Miembros duplicados: sin dedup en ninguna capa | 🔴 P0 | ✅ **Sí, 2 casos en producción** |
| P0-02 | Acceso a datos ajenos por (teléfono + email) desde `anon` | 🔴 P0 | ❓ desconocido |
| P0-03 | `JoinFlow` muestra éxito sin esperar al webhook | 🔴 P0 | ❓ desconocido |
| P0-04 | El PaymentIntent del checkout no es idempotente → holds duplicados | 🔴 P0 | ✅ **Consecuencia de P0-01** |
| P0-05 | `CRON_SECRET` ausente de `.env.local`; **presente en Vercel** | ✅ resuelto | ✅ **Verificado 11-sep-2026** |
| P1-01 | Deriva producción ↔ repositorio en 7 funciones SQL | 🟠 P1 | ✅ Sí |
| P1-02 | `supabase/prepare_join.sql` está corrupto y no parsea | 🟠 P1 | ✅ Sí |
| P1-03 | Multi-puja nunca ejecutada con dinero real (Gate G6) | 🟠 P1 | — |
| P1-04 | Grupo atrapado en `closing` (excedente con segunda puja) | 🟠 P1 | ❌ nunca ejecutado |
| P1-05 | Adjudicado sin email: sin instrucciones y sin alerta | 🟠 P1 | ❓ desconocido |
| P1-06 | Cero tests automatizados | 🟠 P1 | — |
| P1-07 | `users_phone_key` no existe: rama de código inalcanzable | 🟠 P1 | ✅ 2 teléfonos duplicados |
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

### P0-01 · Miembros duplicados: sin deduplicación en ninguna capa

**Problema.** La misma persona puede ser miembro N veces del mismo grupo.

**Archivos / funciones.**
- `public.prepare_join` (producción) — el check de duplicado **fue eliminado**.
- `public.confirm_join` (producción) — el check por `(phone OR email)` **fue eliminado**.
- Tabla `group_members` — **no existe UNIQUE `(group_id, user_id)`**.
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

### P0-03 · `JoinFlow` muestra la pantalla de éxito sin esperar al webhook

**Problema.** El checkout principal redirige a `/unido` inmediatamente tras
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

**Obstáculo técnico.** `create-intent` **no devuelve `pi_id`** (solo `clientSecret`), así que
`JoinFlow` no dispone del identificador que `/api/join/status` necesita.

**Solución potencial (descriptiva).** Devolver también `pi_id` desde `create-intent` y replicar
el bucle de `completeSuccess`.

---

### P0-04 · El PaymentIntent del checkout no es idempotente → holds duplicados

**Problema.** Ni `create-intent` ni `checkout/lock` usan `idempotencyKey` de Stripe.

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

### P1-01 · Deriva producción ↔ repositorio en 7 funciones SQL

**Problema.** Los ficheros `supabase/*.sql` **no son migraciones** y no reflejan lo desplegado.

| Función | Repositorio | Producción |
|---|---|---|
| `compute_price` | `(uuid, integer)`, single-bid, `next_price` v1 | `(uuid, integer, numeric)`, multi-puja, `next_price` v2 |
| `tier_demand` | single-bid, sin fusión | escalera fusionada con mínimo acumulado |
| `prepare_join` | con dedup, guard con `total_units`, **corrupto** | sin dedup, guard con unidades comprometidas |
| `confirm_join` | con dedup | sin dedup, discrimina `CONSTRAINT_NAME` |
| `close_group` | v1 single-bid, PMA solo esperadores | v2 multi-puja, **PMA universal** |
| `get_my_groups` | `(p_phone)` — **1 argumento** | `(p_phone, p_email)` — 2 argumentos |
| `create_petition` | v1 | v3 (anti-spam 5/h + upsert no destructivo) |

Además `supabase/revoke_join_group.sql` revoca `join_group(uuid,text,text,text,integer)`,
**función que ya no existe en `pg_proc`** (fue eliminada, no solo revocada).

**Impacto.** Cualquier persona o IA que lea el repositorio sin consultar la base de datos
**razonará sobre un algoritmo que ya no existe**. Reconstruir la BD desde estos ficheros
produciría un sistema funcionalmente distinto y peor.

**Ficheros que SÍ coinciden:** `shipping_columns.sql` y `event_type_add_petition_created.sql`
(DDL aditivo idempotente).

---

### P1-02 · `supabase/prepare_join.sql` está corrupto

**Problema.** En la línea 78 del fichero aparece:
```
$function$;R REPLACE FUNCTION public.prepare_join(
```
Un pegado roto que duplica el cuerpo completo. **El fichero no es SQL válido y no se puede
ejecutar.**

**Impacto.** Además de la deriva de P1-01, es un fichero irrecuperable tal cual: no sirve ni
como referencia histórica fiable.

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
