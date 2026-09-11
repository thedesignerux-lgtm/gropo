# BUSINESS_RULES.md — Gropo

> **Reglas de negocio DEMOSTRABLES.**
> Cada regla lleva `STATUS`, que describe lo que el código hace **hoy**, no lo que la
> documentación afirma.
>
> `IMPLEMENTED` · `PARTIALLY_IMPLEMENTED` · `NOT_IMPLEMENTED` · `HISTORICAL` · `UNKNOWN`
>
> Verificado el 6 de septiembre de 2026 contra `main @ 7c49ef3` y la base de datos de
> producción.

---

## 1. CANTIDAD E IDENTIDAD

### RULE-001 · Cantidad por comprador entre 1 y 10
- **SOURCE:** producto
- **IMPLEMENTATION:** `prepare_join` (`RAISE EXCEPTION 'Cantidad debe ser entre 1 y 10'`) ·
  CHECK `group_members_quantity_check (quantity >= 1)` ·
  CHECK `pulse_pledges_quantity_check (quantity >= 1 AND quantity <= 10)` ·
  clamp en `src/app/grupo/[id]/unirme/page.tsx:83` y en el stepper de `JoinFlow`
- **STATUS:** ✅ `IMPLEMENTED`
- **Nota:** la base de datos solo garantiza `>= 1` para `group_members`. El techo de 10 es
  lógica de aplicación.

### RULE-002 · Solo teléfonos españoles
- **SOURCE:** producto (mercado España)
- **IMPLEMENTATION:** normalización (`[\s\-\.]` y prefijo `^\+34`) + regex `^[679][0-9]{8}$` en
  `prepare_join`, `create_petition`, `_profile_uid`, `get_my_groups`; `src/lib/phone.ts` replica
  la normalización en el cliente
- **STATUS:** ✅ `IMPLEMENTED`
- **Nota:** el regex acepta también fijos que empiezan por 9.

### RULE-003 · Máximo 3 altas por teléfono en 1 hora
- **SOURCE:** antifraude
- **IMPLEMENTATION:** `prepare_join` paso 4
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-004 · Máximo 10 intentos de checkout por IP en 10 minutos
- **SOURCE:** antifraude
- **IMPLEMENTATION:** `check_rate_limit` desde `create-intent`, `checkout/lock`, `pulse/accept`
- **STATUS:** ⚠️ `PARTIALLY_IMPLEMENTED` — **fail-open**: si `check_rate_limit` falla, la
  petición continúa. Ver `SECURITY.md` SEC-04.

### RULE-005 · Máximo 5 peticiones por teléfono en 1 hora
- **SOURCE:** antifraude
- **IMPLEMENTATION:** `create_petition` (producción, v3)
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-006 · Una persona solo puede estar una vez en un grupo
- **SOURCE:** producto (implícita); presente en `supabase/prepare_join.sql` y
  `supabase/confirm_join.sql`
- **IMPLEMENTATION:** 🔴 **ninguna**. El check fue eliminado de ambas funciones en producción;
  no existe UNIQUE `(group_id, user_id)`; `create-intent` no usa `idempotencyKey`
- **STATUS:** 🔴 `NOT_IMPLEMENTED`
- **Evidencia:** 2 pares `(group_id, user_id)` duplicados en producción.
- Ver `KNOWN_ISSUES.md` P0-01.

### RULE-007 · Un teléfono identifica a un solo usuario
- **SOURCE:** implícita en `confirm_join`, que maneja la constraint `users_phone_key`
- **IMPLEMENTATION:** 🔴 **la constraint no existe**. Verificado en `pg_constraint`
- **STATUS:** 🔴 `NOT_IMPLEMENTED` (rama de código inalcanzable)
- **Evidencia:** 2 teléfonos duplicados en `users`.

### RULE-008 · La identidad de compra es el email
- **SOURCE:** implementación
- **IMPLEMENTATION:** `users_email_key` UNIQUE; `confirm_join` hace
  `INSERT ... ON CONFLICT (email) DO UPDATE`
- **STATUS:** ✅ `IMPLEMENTED`

---

## 2. GRUPOS Y CIERRE

### RULE-009 · Solo se puede entrar en grupos `open`
- **IMPLEMENTATION:** `prepare_join` paso 2 · `confirm_join` paso 3 (**bajo `FOR UPDATE`**) ·
  `pulse_pledge_upsert`
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-010 · Regla 6 — si no se alcanza el `min_execution`, el grupo no ejecuta
- **SOURCE:** especificación
- **IMPLEMENTATION:** `close_group` pasos 3c y 5 → `groups.status='cancelled'`, todos los vivos
  a `cancelled`, todas las `bids` activas a `outbid`
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-011 · Nunca se vende por encima del `max_stock` de la puja ganadora
- **IMPLEMENTATION:** guard en `prepare_join` paso 7 (optimista) · guard en `confirm_join`
  paso 6 (**bajo `FOR UPDATE`** — esta es la garantía real) · corte por `cum_qty` en
  `close_group` paso 6
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-012 · Precio único de liquidación
- **SOURCE:** especificación (*"todos pagan el N final"*)
- **IMPLEMENTATION:** un único `v_settlement` en el `UPDATE` de `close_group` paso 6
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-013 · Nadie paga más que su PMA
- **SOURCE:** especificación + ADR-09
- **IMPLEMENTATION:** `close_group` paso 4 (PMA universal) cancela a esperadores con
  `target_price < settlement` **y** a compradores con `guaranteed_price < settlement`;
  la captura es **parcial** (`amount_to_capture ≤` lo retenido)
- **STATUS:** ✅ `IMPLEMENTED`
- **Nota:** el efecto secundario es que un comprador puede quedar **fuera** del grupo si el
  precio final supera su `guaranteed_price`. Ver RULE-032.

### RULE-014 · Adjudicación FCFS por `join_order`
- **IMPLEMENTATION:** `close_group` paso 6, ventana
  `SUM(quantity) OVER (ORDER BY join_order ASC ...)` con corte `cum_qty <= max_stock`
- **STATUS:** ✅ `IMPLEMENTED`
- **Nota:** el corte es por filas completas: si un pedido no cabe entero, quedan fuera él **y
  todos los posteriores**. Sin reparto parcial ni relleno. ❓ No consta si es deliberado.

### RULE-015 · Cierre a las 22:00 de Europe/Madrid
- **SOURCE:** producto (*"cierre dominical 22:00 Europe/Madrid"*)
- **IMPLEMENTATION:** `madridCloseAtISO()` calcula el instante UTC correcto resolviendo el DST
  (20:00Z en verano, 21:00Z en invierno); el cron dispara a **`0 21 * * 0`**
- **STATUS:** ⚠️ `PARTIALLY_IMPLEMENTED` — el motor es correcto, pero el cron fijo hace que en
  **verano el cierre ocurra a las 23:00 Madrid** (1 h tarde). Decisión consciente por el límite
  del plan Hobby de Vercel; la propiedad que se protege es **no cerrar antes de las 22:00**.

### RULE-016 · La ventana de cierre no puede superar 6,5 días desde el hold vivo más antiguo
- **SOURCE:** incidente del 5-jul-2026 (3 capturas fallidas por holds de 7 d+)
- **IMPLEMENTATION:** `MAX_CLOSE_WINDOW_HOURS = 156` en `src/lib/closeWindow.ts`;
  `validateCloseWindow(closesAt, anchor?)` usado por `createGroup`, `updateGroup` y
  `addBidToGroup`
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-017 · Un grupo `open` con 0 pujas activas es una "Petición"
- **IMPLEMENTATION:** `src/lib/statusBadge.ts:23` — es un estado **de presentación**, no de BD
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-018 · Los grupos `is_demo` no aparecen en los listados públicos
- **IMPLEMENTATION:** filtro `.eq('is_demo', false)` en `src/app/page.tsx:15` y en las
  sugerencias de `/favoritos`. Accesibles por URL directa y visibles en el admin
- **STATUS:** ✅ `IMPLEMENTED`
- **Nota:** actualmente **no existe ningún grupo `is_demo=true`** en producción.

### RULE-019 · Los grupos `cancelled` no son visibles públicamente
- **IMPLEMENTATION:** política RLS `groups_public_read USING (status <> 'cancelled')`
- **STATUS:** ✅ `IMPLEMENTED`

---

## 3. PRECIO Y TRAMOS

### RULE-020 · El precio se determina por demanda efectiva, no por número de compradores
- **IMPLEMENTATION:** `compute_price` y `tier_demand` — `Σ quantity` de miembros vivos cuyo PMA
  alcanza el precio del tramo
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-021 · El precio publicado nunca sube al crecer las unidades
- **SOURCE:** especificación (ADR-08)
- **IMPLEMENTATION:** mínimo acumulado en `tier_demand`
  (`MIN(price) WHERE min_units <= escalón`)
- **STATUS:** ✅ `IMPLEMENTED`
- **Nota:** el precio **sí puede subir** si miembros vivos se cancelan y la demanda baja. La
  regla protege contra el crecimiento de N, no contra su decrecimiento.

### RULE-022 · A igual precio gana la puja más antigua (D3)
- **IMPLEMENTATION:** `ORDER BY ... bid_created_at ASC` en `compute_price`;
  `ORDER BY eligible DESC, settlement ASC, created_at ASC` en `close_group`
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-023 · Tramos: `min_units` estrictamente creciente, `price` estrictamente decreciente, todo `min_units <= max_stock`
- **IMPLEMENTATION:** `validateBidFields` en `src/app/admin/grupos/actions.ts:36-59`
- **STATUS:** ⚠️ `PARTIALLY_IMPLEMENTED` — **solo en el server action del admin**. No hay CHECK
  constraint ni trigger en la base de datos; un `UPDATE` directo puede introducir una escalera
  incoherente.

### RULE-024 · `min_execution <= max_stock`
- **SOURCE:** especificación (Decisión G5-B)
- **IMPLEMENTATION:** `validateBidFields`
- **STATUS:** ⚠️ `PARTIALLY_IMPLEMENTED` (solo en el admin)

### RULE-025 · `target_price` debe ser un precio exacto de la escalera fusionada
- **IMPLEMENTATION:** validación server-authoritative contra `tier_demand()` en
  `create-intent:60-77` y `checkout/lock:67-79`
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-026 · El precio es retroactivo para todos los adjudicados
- **IMPLEMENTATION:** `close_group` escribe el mismo `final_price` a todos los `instructed`
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-027 · Precio fluido (interpolación lineal) según `price_mode`
- **SOURCE:** enum `price_mode`, columna `bids.price_mode NOT NULL DEFAULT 'fluid'`, función
  `compute_price_at_n`, selector en el formulario del admin
- **IMPLEMENTATION:** 🔴 **ninguna en el motor vigente.** `compute_price`, `tier_demand` y
  `close_group` **no leen `price_mode`**; `compute_price_at_n` **no tiene ningún llamante**
  (verificado en todo `src/` y en el cuerpo de las 21 funciones SQL)
- **STATUS:** 🔴 `NOT_IMPLEMENTED`
- **Consecuencia:** todos los tramos se comportan como `stepped`, sea cual sea el valor guardado.

---

## 4. PAGOS

### RULE-028 · La membresía solo existe si hay dinero autorizado en Stripe
- **SOURCE:** ADR-03 · `supabase/revoke_join_group.sql`: *"unirse SOLO puede ocurrir con tarjeta
  autorizada"*
- **IMPLEMENTATION:** `confirm_join` se invoca **únicamente** desde
  `src/app/api/stripe/webhook/route.ts`; la función legada `join_group` **ya no existe** en la
  base de datos
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-029 · Un PaymentIntent produce como máximo un miembro
- **IMPLEMENTATION:** `IF EXISTS (... stripe_payment_intent_id = ...)` + índice UNIQUE
  `uniq_group_members_pi` + rama `unique_violation` que devuelve `already_processed`
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-030 · Nunca se cobra más de lo retenido
- **IMPLEMENTATION:** captura **parcial**
  `paymentIntents.capture(pi, {amount_to_capture: final_price*qty*100})`, siempre ≤ el importe
  autorizado
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-031 · Ante un dato corrupto, nunca cobrar
- **IMPLEMENTATION:** `close_group` paso 4 cancela también cuando `target_price IS NULL`
  (esperador) o `guaranteed_price IS NULL` (comprador)
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-032 · Si el precio final supera el `guaranteed_price` de un comprador, se le libera
- **SOURCE:** decisión §4.4 de la especificación multi-vendedor, resuelta como opción **(b)**
- **IMPLEMENTATION:** `close_group` paso 4, rama `join_mode='comprar'`
- **STATUS:** ✅ `IMPLEMENTED`
- **Nota:** la especificación **no se actualizó** para reflejar la decisión tomada.
  El comprador afectado **no recibe ningún email** explicándolo (`sendClosePaymentEmails` solo
  escribe a `instructed` y `paid`).

### RULE-033 · El importe retenido nunca se muestra al comprador
- **IMPLEMENTATION:** `create-intent` devuelve **solo** `clientSecret`
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-034 · Plazo de 48 h para la transferencia cuando la captura no fue posible
- **IMPLEMENTATION:** `src/lib/emails/sendClose.ts:62` — `Date.now() + 48*60*60*1000`
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-035 · Concepto de transferencia `GROPO-<4 primeros del uuid>-<join_order>`
- **IMPLEMENTATION:** `src/lib/emails/sendClose.ts:63,92`
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-036 · Reembolsos
- **SOURCE:** enum `payment_status` contiene `refund_due`
- **IMPLEMENTATION:** 🔴 **ninguna.** Cero llamadas a `stripe.refunds` en todo el repositorio;
  `refund_due` nunca se escribe ni se lee
- **STATUS:** 🔴 `NOT_IMPLEMENTED`

### RULE-037 · Cláusula de tolerancia del 75%
- **SOURCE:** especificación V0 (*"V0 SIN pagos integrados (pago directo al vendedor, cláusula
  de tolerancia del 75%)"*), citada en el project prompt
- **IMPLEMENTATION:** 🔴 **ninguna.** Búsqueda exhaustiva de `75%`, `0.75` y `tolerancia` en
  `src/` y `supabase/`: las únicas coincidencias son `origin: {y: 0.75}` (confeti de
  `JoinFlow.tsx:93`) y `clientWidth * 0.75` (`HomeCarousel.tsx:37`)
- **STATUS:** 🔴 `NOT_IMPLEMENTED`
- **Nota:** la premisa de la que colgaba (*"V0 SIN pagos integrados"*) también quedó superada:
  hoy hay pagos integrados con Stripe.

---

## 5. MULTI-PUJA

### RULE-038 · Un solo vendedor sirve todo el pedido (D2)
- **IMPLEMENTATION:** `close_group` selecciona una única `winner_bid_id`; el resto pasa a
  `outbid`
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-039 · El comprador nunca ve pujas ni vendedores (D5)
- **IMPLEMENTATION:** RLS de `bids` con **cero políticas**; `tier_demand` como única superficie
  pública de tramos; `/api/group/[id]/pulse` reduce a buckets
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-040 · Un vendedor puede pujar con el grupo abierto (D4, "pujas en caliente")
- **IMPLEMENTATION:** `addBidToGroup` sobre grupos `open`; seguro por construcción porque la
  fusión es un mínimo
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-041 · Una puja solo se retira si no perjudica a ningún miembro vivo (§5.3)
- **IMPLEMENTATION:** `withdrawBid` marca `withdrawn` tentativamente, recalcula
  `compute_price`, y hace **rollback a `active`** si el nuevo precio superaría el
  `guaranteed_price` mínimo de los miembros vivos
- **STATUS:** ⚠️ `PARTIALLY_IMPLEMENTED` — **sin lock**. El propio código lo admite:
  *"Race window despreciable: solo Benjamin usa el admin"*. Es una suposición operativa.

### RULE-042 · No se puede retirar la única puja activa
- **IMPLEMENTATION:** `withdrawBid` paso 3
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-043 · Las pujas son mejorables y JAMÁS retirables (+3% mínimo para desbancar)
- **SOURCE:** especificación V0, citada en el project prompt
- **IMPLEMENTATION:** 🔴 **ninguna, y contradicha por el código.** `withdrawBid` **sí** permite
  retirar. `validateBidFields` **no** exige mejorar; `addBidToGroup` acepta explícitamente una
  puja peor (*"Ninguna restricción de 'debe mejorar'… La fusión la neutraliza sola"*).
  `bids.improved_at` y `bids.bid_revisions` **nunca se escriben**.
  Búsqueda de `desbanc`, `1.03` y `+3%`: **cero coincidencias**
- **STATUS:** 🔴 `HISTORICAL` — regla de la especificación V0 abandonada al adoptar la fusión
  multi-puja.

### RULE-044 · El tramo 1 de toda puja debe ser ≤ el mejor precio público verificable del vendedor
- **SOURCE:** especificación V0
- **IMPLEMENTATION:** 🔴 ninguna. No existe ninguna verificación de precio público
- **STATUS:** 🔴 `NOT_IMPLEMENTED`

### RULE-045 · Anonimato del vendedor hasta el cierre
- **SOURCE:** especificación V0
- **IMPLEMENTATION:** RLS de `bids` sin políticas — el anonimato es **permanente**, no solo
  hasta el cierre. `bids.payment_info` se revela al comprador adjudicado a través de
  `get_my_groups` cuando el grupo está `closed`
- **STATUS:** ✅ `IMPLEMENTED` (más estricto que la regla original)

---

## 6. GROPO PULSE (compra automática)

### RULE-046 · Un esperador del Pulse solo puede fijar un tramo no desbloqueado y estrictamente por debajo del precio vigente
- **IMPLEMENTATION:** `pulse_pledge_upsert` valida contra `tier_demand`:
  `EXISTS (price = p_tier_price AND NOT unlocked)` y `p_tier_price < MIN(price WHERE unlocked)`
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-047 · Un miembro vivo no puede además tener un pledge del Pulse en el mismo grupo
- **IMPLEMENTATION:** `pulse_pledge_upsert` → *"Ya participas en este grupo: tu plaza ya está
  empujando el precio"*
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-048 · Un solo compromiso vivo por (grupo, usuario)
- **IMPLEMENTATION:** índice parcial UNIQUE `pulse_pledges_one_live` sobre `(group_id, auth_id)`
  `WHERE status IN ('watching','accepted','holding')`
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-049 · El Pulse solo cobra a los necesarios para completar el tramo, por orden de aceptación
- **IMPLEMENTATION:** `pulse_check_and_lock` — `needed = min_units − committed`, selección FIFO
  por `accepted_at ASC` hasta cubrir `needed`, bajo `pg_advisory_xact_lock`
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-050 · El Pulse no introduce lógica de dinero nueva
- **SOURCE:** invariante declarada en la cabecera de `src/lib/pulse.ts`:
  *"esta función NO toca compute_price / close_group / confirm_join"*
- **IMPLEMENTATION:** la conversión crea un PaymentIntent con la **misma forma de metadata** que
  el checkout normal; el webhook lo trata como un esperador cualquiera
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-051 · Un pledge sin tarjeta guardada nunca genera un cargo
- **IMPLEMENTATION:** `src/lib/pulse.ts:86-91` — si falta `stripe_customer_id` o
  `stripe_payment_method_id`, marca `failed` **sin llamar a Stripe**
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-052 · El aviso "ya sois suficientes" se envía una sola vez por tramo
- **IMPLEMENTATION:** claim atómico sobre `reachable_notified_price` **antes** de enviar;
  reversión del claim si el envío falla (`src/lib/pulse-notify.ts:126-157`)
- **STATUS:** ✅ `IMPLEMENTED`

---

## 7. ENVÍOS Y COMUNICACIÓN

### RULE-053 · Envíos solo a España
- **IMPLEMENTATION:** `country: 'ES'` en todos los PaymentIntents; `PROVINCIAS_ES` en el
  formulario; `shipping_country` con default `'ES'`; validación de teléfono español
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-054 · Las etiquetas de envío se generan manualmente desde el admin, no al cerrar
- **SOURCE:** comentario de `src/lib/shipping-sendcloud.ts:4`: *"Disparo: botón admin manual
  'Generar etiquetas' (NO automático al cierre en V0)"*
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-055 · Una etiqueta por miembro adjudicado, sin duplicados
- **IMPLEMENTATION:** doble capa — `if (m.shipping_parcel_id) continue` + `UPDATE ... .is(
  'shipping_parcel_id', null)` en BD, y `external_reference_id = member.id` en Sendcloud
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-056 · Solo reciben email de cierre los miembros `instructed` y `paid`
- **IMPLEMENTATION:** `sendClosePaymentEmails` filtra
  `.in('payment_status', ['instructed','paid'])`
- **STATUS:** ✅ `IMPLEMENTED`
- **Consecuencia no cubierta:** los `cancelled`/`released` (esperadores que no alcanzaron su
  precio, compradores liberados por RULE-032) **no reciben ninguna comunicación**.

### RULE-057 · Un adjudicado sin email queda sin instrucciones y sin alerta
- **IMPLEMENTATION:** `src/lib/emails/sendClose.ts:71` → `if (!email) { failed++; continue }`.
  `closeGroup` solo registra el resultado por consola; **no dispara `sendAdminAlert`** para este
  caso
- **STATUS:** ⚠️ Comportamiento real, no una regla deseada. Ver `KNOWN_ISSUES.md` P1-05.

### RULE-058 · La cuenta atrás solo se muestra si faltan 14 días o menos
- **SOURCE:** UX, comentario literal: *"un contador de 155d mata el FOMO y invita a
  procrastinar"*
- **IMPLEMENTATION:** `URGENCY_WINDOW_DAYS = 14` en `JoinFlow.tsx:55`; por encima muestra
  *"Próximo domingo"*
- **STATUS:** ✅ `IMPLEMENTED`

---

## 8. MODELO DE NEGOCIO

### RULE-059 · Gropo es merchant-of-record
- **SOURCE:** `CLAUDE.md`
- **IMPLEMENTATION:** cobra por Stripe con su propia cuenta y genera los envíos por Sendcloud
- **STATUS:** ✅ `IMPLEMENTED`

### RULE-060 · Margen / comisión de Gropo
- **SOURCE:** —
- **IMPLEMENTATION:** 🔴 **no existe ninguna columna, constante ni cálculo de comisión** en la
  base de datos ni en el código. El comprador paga exactamente el precio del tramo de la puja
- **STATUS:** ❓ `UNKNOWN` — no determinable desde el código.

---

## 9. RESUMEN POR ESTADO

| STATUS | Reglas |
|---|---|
| ✅ `IMPLEMENTED` (44) | 001, 002, 003, 005, 008, 009, 010, 011, 012, 013, 014, 016, 017, 018, 019, 020, 021, 022, 025, 026, 028, 029, 030, 031, 032, 033, 034, 035, 038, 039, 040, 042, 045, 046, 047, 048, 049, 050, 051, 052, 053, 054, 055, 056, 058, 059 |
| ⚠️ `PARTIALLY_IMPLEMENTED` (5) | 004 (fail-open), 015 (cron 1 h tarde en verano), 023 (solo admin), 024 (solo admin), 041 (sin lock) |
| 🔴 `NOT_IMPLEMENTED` (6) | **006** (dedup de membresías), **007** (teléfono único), **027** (precio fluido), **036** (reembolsos), **037** (cláusula del 75%), **044** (tramo 1 ≤ mejor precio público) |
| 🔴 `HISTORICAL` (1) | **043** (pujas mejorables y no retirables) |
| ❓ `UNKNOWN` (1) | **060** (margen de Gropo) |
| ⚠️ Comportamiento observado, no regla deseada (1) | 057 |
