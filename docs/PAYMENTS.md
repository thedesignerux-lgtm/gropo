# PAYMENTS.md — Gropo

> **Fuente de verdad del sistema de pagos.**
> Auditado el **6 de septiembre de 2026** contra el código en `main @ 7c49ef3` y contra la base
> de datos de producción.
>
> ❓ **LÍMITE DE ESTA AUDITORÍA:** esta sesión **no tiene acceso a la API de Stripe**.
> Todo lo relativo a la configuración del dashboard de Stripe (modo test/live, endpoints de
> webhook dados de alta, eventos suscritos, claves activas) está marcado **UNKNOWN** y
> **requiere consulta directa de producción**. Ver §12.
>
> **Este documento describe lo que el sistema HACE HOY. No propone soluciones.**

---

## 1. MODELO DE PAGO: HOLD-THEN-CAPTURE

Todo el sistema se apoya en **PaymentIntents con `capture_method: 'manual'`**.

```
1. Al unirse  → se AUTORIZA (retiene) un importe. No se cobra nada.
2. El grupo vive → el dinero sigue retenido en la tarjeta del comprador.
3. Al cierre  → se CAPTURA PARCIALMENTE final_price × quantity (siempre ≤ lo retenido).
                Stripe libera automáticamente la diferencia.
                O se CANCELA el PaymentIntent entero → liberación total.
```

**El hold de Stripe caduca a los 7 días.** De ahí toda la maquinaria de
`src/lib/closeWindow.ts` (ventana máxima de 156 h = 6,5 días), nacida del incidente documentado
en el propio fichero: *"incidente del cierre del 5 jul 2026: 3 capturas fallidas por holds de
7d+"*.

**Consecuencia de diseño:** el comprador **nunca paga más que su techo** y **nunca hay que
gestionar un reembolso**, porque nunca se cobra de más. Ver §11.

---

## 2. DÓNDE SE CREA UN PAYMENT INTENT — tres emisores

| Origen | Fichero:línea | `confirm` | `off_session` | `setup_future_usage` | `idempotencyKey` |
|---|---|---|---|---|---|
| **Checkout normal** | `src/app/api/join/create-intent/route.ts` | ❌ (lo confirma el cliente) | ❌ | `'on_session'` | ✅ `join-{sha256(payload)}` |
| **1-Click** | `src/app/api/checkout/lock/route.ts` | ✅ | `false` | `'on_session'` | ✅ `lock-{sha256(payload)}` |
| **Gropo Pulse (automático)** | `src/lib/pulse.ts:140` | ✅ | **`true`** | — | ✅ `pulse-{pledge_id}-{triggered_at}` |

Los tres construyen **la misma forma de `metadata`**, a propósito: así un único webhook sirve a
los tres caminos.

---

## 3. EL CONTRATO DE LA METADATA

```js
metadata: {
  group_id,           // uuid del grupo            ← OBLIGATORIO (guard del webhook)
  quantity,           // string
  buyer_name,
  buyer_email,
  buyer_phone,        // normalizado por prepare_join
  guaranteed_price,   // string
  join_mode,          // 'comprar' | 'esperar'
  target_price?,      // solo esperadores
  pulse_pledge_id?    // solo conversiones del Pulse
}
shipping: { name, phone, address: { line1, line2, city, state, postal_code, country:'ES' } }
```

**3 emisores · 1 consumidor** (`src/app/api/stripe/webhook/route.ts:63-84`).

> ⚠️ Añadir un campo obliga a tocar los **tres** emisores. Si uno se olvida, el miembro se crea
> con datos incompletos **sin fallar ruidosamente**.
>
> En la conversión del Pulse, `guaranteed_price` y `target_price` valen **ambos**
> `pledge.tier_price`, y `join_mode` es siempre `'esperar'`.

---

## 4. CÁLCULO DEL IMPORTE RETENIDO

| Modo | Importe |
|---|---|
| `comprar` | `prepare_join().guaranteed_price × quantity` — es decir, `compute_price(group, +quantity).best_price × quantity` (el **precio proyectado** con sus unidades dentro) |
| `esperar` | `target_price × quantity` |
| Pulse | `pledge.tier_price × quantity` |

**Validación server-authoritative del `target_price`** (`create-intent:60-77` y
`checkout/lock:67-79`): se llama a `tier_demand(group_id)` y se exige que el target esté
**exactamente** en la lista de precios devuelta. El cliente **no puede inventarse un PMA**.

`Math.round(holdPrice * quantity * 100)` → céntimos.

> 🔒 **El importe retenido NUNCA viaja al cliente.** `create-intent` devuelve **solo**
> `clientSecret`. Comentario literal (`create-intent:180`): *"la mecánica bancaria (importe
> retenido / límite de autorización) NUNCA viaja al front"*.
> `JoinFlow.tsx:172-175` calcula un `amountCents` propio **solo** para inicializar `<Elements>`,
> con `Math.max(50, ...)`; el importe real lo fija el servidor.

---

## 5. FLUJO COMPLETO — CHECKOUT NORMAL

```
NAVEGADOR                        SERVIDOR                          STRIPE
   │ POST /api/join/create-intent ──►│
   │                                 │ rpc check_rate_limit(ip,10,600)   [FAIL-OPEN]
   │                                 │ rpc prepare_join(group,phone,qty)
   │                                 │ rpc tier_demand   [solo si esperar]
   │                                 │ customers.retrieve/create ──────────►│
   │                                 │ paymentIntents.create ──────────────►│
   │ ◄──── { clientSecret } ─────────│                    (requires_payment_method)
   │
   │ elements.submit()
   │ stripe.confirmPayment({ redirect:'if_required' }) ───────────────────►│
   │                                                          [3DS si aplica]
   │                                                          → requires_capture
   │                                 │◄── webhook payment_intent.amount_capturable_updated ──│
   │                                 │ rpc confirm_join(11 args)
   │                                 │   → group_members(payment_status='authorized')
   │ window.location = /unido        │ resend / runPulseTrigger / notifyReachableWatchers
```

**Punto crítico:** la membresía **no existe** hasta que el webhook la crea.
En serverless eso tarda **segundos**.

---

## 6. FLUJO 1-CLICK (`FastCheckoutModal`)

Montado globalmente por `CheckoutProvider` en el root layout; cualquier vista lo abre con
`useCheckout().open({...})`.

- **Ruta A — tarjeta nueva / edición del acordeón:** `create-intent` + `PaymentElement` +
  `stripe.confirmPayment` (idéntica al checkout normal).
- **Ruta B — tarjeta guardada:** `POST /api/checkout/lock` crea **y confirma** el PaymentIntent
  server-side con el PaymentMethod por defecto del Customer (`confirm:true`,
  `off_session:false`).
  - `pi.status === 'requires_action'` → devuelve `{requires_action, clientSecret, pi_id}` y el
    cliente resuelve el 3DS con `stripe.handleNextAction` **sin salir del modal**.
  - `pi.status === 'requires_capture'` → `{status:'ok', pi_id}`.
  - `StripeCardError` → mensaje traducido: `expired_card` → *"Tu tarjeta ha caducado.
    Actualízala para asegurar la plaza."*; resto → *"Tu banco ha declinado la operación. Prueba
    con otra tarjeta."*

**Precondiciones de la Ruta B** (si falta alguna, cae a la Ruta A):
sesión activa · `users.stripe_customer_id` · al menos un PaymentMethod tipo `card` ·
una dirección de envío previa en `group_members` (`no_shipping`).

---

## 7. CONFIRMACIÓN DEL PAGO EN LA UI — 🔴 DOS COMPORTAMIENTOS DISTINTOS

### 7.1 `FastCheckoutModal` — confirmación HONESTA ✅
`src/components/checkout/FastCheckoutModal.tsx:250-271` (`completeSuccess`):
```ts
if (piId) {
  for (let i = 0; i < 18; i++) {
    const r = await fetch(`/api/join/status?pi=${encodeURIComponent(piId)}`);
    if ((await r.json())?.joined === true) break;
    await new Promise(res => setTimeout(res, 1000));
  }
}
setStatus('success');
setTimeout(() => onSuccess(), 1500);
```
Polling de hasta **18 segundos** esperando a que exista la fila `group_members`. Pasado ese
tiempo muestra el verde igualmente, con justificación explícita en el comentario: *"la retención
está aceptada y la membresía llega sí o sí (backend idempotente). NUNCA volvemos al botón
inicial, que daría la falsa impresión de que no pasó nada"*.

### 7.2 `JoinFlow` — confirmación OPTIMISTA 🔴
`src/app/grupo/[id]/unirme/JoinFlow.tsx:881-896`:
```ts
const { error: confirmError } = await stripe.confirmPayment({...});
if (confirmError) { setError(...); setLoading(false); return; }
window.location.href = `/grupo/${group.id}/unido`;
```
**Sin ninguna comprobación de que la membresía exista.**
Verificado: `grep -c "join/status" JoinFlow.tsx` → **0**.

**Origen del desfase:** los commits `b1e5229` *("fix: honest checkout confirmation - wait for
membership before success")* y `fc1ce4a` *("fix: checkout always reaches green success, tolerate
slow webhook")* implementaron el polling **solo en `FastCheckoutModal`**. `JoinFlow` — el
checkout de la página `/unirme`, que es la ruta principal desde la ficha de producto — se quedó
sin ese arreglo.

**Impacto:** si `confirm_join` devuelve `needs_release` (grupo cerrado, sin stock), el usuario
ya está viendo la pantalla de éxito mientras su hold se cancela.

**Obstáculo técnico para replicar el arreglo:** `create-intent` **no devuelve `pi_id`**
(verificado: solo devuelve `clientSecret`), así que `JoinFlow` no tiene el identificador que
`/api/join/status` necesita. Ver `KNOWN_ISSUES.md` P0-03.

---

## 8. EL WEBHOOK

### Configuración en código
`src/app/api/stripe/webhook/route.ts`

| Aspecto | Valor |
|---|---|
| Método | `POST` |
| Runtime | `nodejs` (declarado explícitamente — el SDK de Stripe no funciona en Edge) |
| Cuerpo | `await req.text()` — **CRUDO**, imprescindible para la firma |
| Validación | `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)` |
| Sin firma o sin secret | **400** |
| Firma inválida | **400** |
| Evento procesado | **`payment_intent.amount_capturable_updated`** — y **solo** ese |
| Cualquier otro evento | **200** `{received:true}` sin hacer nada |

> ⚠️ Con captura manual, el evento correcto es `amount_capturable_updated` (estado
> `requires_capture`), **NO** `payment_intent.succeeded` — `succeeded` solo llega tras la
> captura. Está documentado en la cabecera del fichero.

### Lógica

```
1. Verificar firma → 400 si falla
2. IF event.type !== 'payment_intent.amount_capturable_updated' → 200
3. Guard: IF !metadata.group_id → log + 200
      ("Un PI ajeno se ignora con 200 para que Stripe no lo reintente eternamente")
4. rpc confirm_join(pi.id, group_id, name, email, phone, qty,
                    pi.amount/100, guaranteed_price, shipping, join_mode, target_price)
5. IF error de RPC → 500   ← Stripe REINTENTARÁ. Seguro porque confirm_join es idempotente
6. Según data.status:
   · 'needs_release'    → paymentIntents.cancel(pi.id)
                          si falla: retrieve → si ya está 'canceled' → OK
                                             si no → 500 (Stripe reintenta durante días)
                          si metadata.pulse_pledge_id → pledge = 'failed'  (no-fatal)
   · 'confirmed'        → email de confirmación (no-fatal)
                          runPulseTrigger(group_id) SOLO si !metadata.pulse_pledge_id (no-fatal)
                          notifyReachableWatchers(group_id) (no-fatal)
   · 'already_processed'→ solo log
7. 200 { received: true }
```

**Razonamiento explícito del 500 en la cancelación fallida** (comentario en el código):
> *"Stripe REINTENTARÁ el webhook con backoff durante días. El reintento es seguro:
> `confirm_join` es idempotente, volverá a devolver `needs_release` y se reintentará la
> cancelación. Sin esto, un fallo puntual dejaría al cliente ~7 días con el dinero retenido y
> nadie se enteraría."*

**Guard anti-recursión:** `if (!m.pulse_pledge_id)` antes de `runPulseTrigger` — evita el bucle
webhook → trigger → PI → webhook.

### Otros webhooks
**No existe ningún otro webhook entrante en el sistema.** Verificado: Sendcloud se llama de
forma síncrona desde el admin y no tiene callback; Resend no tiene webhook de bounces;
no hay Supabase Edge Functions ni Database Webhooks.

---

## 9. ESTADOS DE PAGO

### 9.1 Máquina de estados de `group_members.payment_status`

```
        (la fila NO existe)
              │
              │  webhook amount_capturable_updated → confirm_join
              ▼
        ┌────────────┐
        │ authorized │  hold vivo en Stripe (requires_capture)
        └─────┬──────┘
              │
    ┌─────────┴──────────┐
    │                    │
close_group:         close_group:
PMA < settlement     adjudicado (cum_qty ≤ max_stock)
ó min_execution      + final_price fijado
no alcanzado
ó excedente sin 2ª puja
    │                    │
    ▼                    ▼
┌───────────┐      ┌────────────┐
│ cancelled │      │ instructed │
└─────┬─────┘      └──────┬─────┘
      │                   │
captureGroupPayments:  captureGroupPayments:
paymentIntents.cancel  paymentIntents.capture(final×qty)
      │                   │
      ▼                   ▼
┌──────────┐         ┌──────┐
│ released │         │ paid │
└──────────┘         └──────┘
```

**Estados terminales:** `released`, `paid`.
**`pending`** es el default de la columna pero **ningún flujo con Stripe lo produce** (todo
miembro nace `authorized`). Sería el estado de un miembro legado del V0 sin pagos.
**`captured`, `failed`, `refund_due`** existen en el enum y **nunca se escriben**.
**`auth_failed`** solo aparece en el mapa de badges del admin; ningún código lo escribe.

### 9.2 Estados del checkout en la UI

| Componente | Estados |
|---|---|
| `JoinFlow` | `loading` (bloquea el botón) · `error` (banner inline) · campos incompletos (scroll a `datosRef` + mensaje) · confeti al cruzar un tramo a la baja |
| `FastCheckoutModal` | `idle` → `processing` ("Reservando/Asegurando…") → `success` (botón verde, pausa 1,5 s, el sheet baja) → `error`. **Nunca vuelve de `processing` al botón inicial** |

---

## 10. IDEMPOTENCIA — MAPA COMPLETO

### 10.1 Dónde SÍ la hay

| Mecanismo | Ubicación | Protege contra |
|---|---|---|
| `IF EXISTS (... stripe_payment_intent_id = ...)` → `already_processed` | `confirm_join` paso 1 | Reentrega del mismo webhook |
| **UNIQUE `uniq_group_members_pi`** + rama `EXCEPTION` que devuelve `already_processed` | BD + `confirm_join` | Dos entregas **concurrentes** del mismo PI. **Nunca devuelve `needs_release`** — cancelar el hold de una membresía existente sería un desastre |
| `FOR UPDATE` sobre `groups` | `confirm_join` paso 3 | Overselling por altas simultáneas |
| Guard `status IN ('closed','cancelled','closing')` + `FOR UPDATE` | `close_group` paso 1 | Doble cierre |
| Operar **por estado en BD** (`instructed`→capturar, `cancelled`→liberar) | `captureGroupPayments` | Re-capturar al re-ejecutar el cierre |
| `captureIdempotent` / `cancelIdempotent`: si la llamada falla, **relee el PI** y acepta `succeeded`/`canceled` | `src/lib/stripe-capture.ts:71-89` | Divergencia BD ↔ Stripe |
| `shipping_parcel_id IS NULL` en el UPDATE + `external_reference_id` en Sendcloud | `src/lib/shipping-sendcloud.ts:134` | Etiquetas duplicadas |
| `pg_advisory_xact_lock(hashtext(group_id))` | `pulse_check_and_lock` | Disparos simultáneos del Pulse |
| `idempotencyKey: pulse-{pledge_id}-{Date.parse(triggered_at)}` | `src/lib/pulse.ts:141` | Doble PI del mismo disparo del Pulse |
| `UPDATE ... .or('reachable_notified_price.is.null,...neq.X')` antes de enviar | `src/lib/pulse-notify.ts:126` | Email "ya sois suficientes" duplicado |
| Filtro `status='open' AND closes_at<=now()` | cron de cierre | Recerrar un grupo |

### 10.2 Idempotencia del checkout ✅ (resuelto 11-sep-2026)

**Los dos emisores del checkout usan una `idempotencyKey` derivada del payload**
(`idempotencyKeyFor()` en `src/lib/stripe.ts` — SHA-256 de los parámetros enviados):

- `POST /api/join/create-intent` → prefijo `join`. También el `customers.create`, con prefijo
  `cust`.
- `POST /api/checkout/lock` → prefijo `lock`.

**Por qué derivada y no escrita a mano.** Stripe exige que una misma clave se use siempre con los
mismos parámetros. Una clave compuesta a mano (`grupo+teléfono+cantidad`) **falló en
producción**: para un invitado, `customers.create` generaba un Customer nuevo en cada intento,
`piParams.customer` cambiaba y Stripe rechazaba la segunda petición con *"Keys for idempotent
requests can only be used with the same parameters"*. Derivando la clave del payload, "misma
clave" y "mismos parámetros" no pueden contradecirse.

**Segunda barrera, independiente de Stripe:** el índice parcial `uniq_member_per_group_alive`
sobre `(group_id, user_id)`. Aunque llegaran dos PIs distintos, `confirm_join` devuelve
`needs_release / already_member` para el segundo y el webhook cancela ese hold.

**Mitigaciones adicionales que siguen vigentes:** rate limit de 10/10 min por IP (fail-open),
rate limit de 3/hora por teléfono en `prepare_join`, y el estado `loading` del botón.

**Verificado en producción:** dos peticiones idénticas a `/api/join/create-intent` devolvieron el
mismo PaymentIntent.

Ver `KNOWN_ISSUES.md` P0-01 y P0-04.

---

## 11. CAPTURA, CANCELACIÓN Y REEMBOLSOS

### 11.1 `captureGroupPayments(groupId)` — `src/lib/stripe-capture.ts:27`

Se ejecuta **después** de `close_group`, **fuera de la transacción**, desde
`closeGroup()` (`src/app/admin/grupos/[id]/actions.ts:38`).

```
Para cada group_members del grupo con stripe_payment_intent_id:
  · payment_status='instructed' Y final_price != null
      → captureIdempotent(pi, round(final_price * quantity * 100))
      → UPDATE payment_status='paid', captured_amount
  · payment_status='cancelled'
      → cancelIdempotent(pi)
      → UPDATE payment_status='released'
  · payment_status='authorized' (excedente sin resolver)
      → SIN TOCAR (lo resuelve el admin)
  Un fallo individual se recoge en summary.failed[] y NO aborta el bucle.
```

Si `summary.failed.length > 0` → `sendAdminAlert()` con el detalle y una nota operativa:
*"Si el motivo es un hold caducado (status canceled/expired), reintentar el cierre NO sirve: el
miembro ya ha recibido instrucciones de pago por transferencia."*

> ⚠️ `captureIdempotent` acepta un PI ya `succeeded` **sin verificar el importe capturado**.
> Si una ejecución previa capturó una cantidad distinta, no se detecta.

### 11.2 Camino alternativo: transferencia bancaria

Cuando la captura **no** es posible (típicamente hold caducado), el miembro se queda en
`instructed` y `sendClosePaymentEmails` le envía **instrucciones de transferencia**:
- `payment_info` **de la puja ganadora** (`bids.payment_info`), obtenido a través del último
  evento `group_closed` → `payload.winner_bid_id`.
- Concepto: **`GROPO-<4 primeros caracteres del uuid del grupo, en mayúsculas>-<join_order>`**.
- Plazo: **48 horas** (`Date.now() + 48*60*60*1000`).

Los miembros `paid` reciben en su lugar una confirmación de compra.

> 🔴 `sendClosePaymentEmails` cuenta `failed++` y hace `continue` si el usuario **no tiene
> email**, pero **no dispara ninguna alerta**. Un adjudicado puede no recibir nunca sus
> instrucciones de pago sin que nadie se entere. Ver `KNOWN_ISSUES.md` P1-05.

### 11.3 Reembolsos — **NOT_IMPLEMENTED**

**No existe ninguna llamada a `stripe.refunds` en todo el repositorio** (verificado).
El enum `payment_status` tiene un valor `refund_due` que **nadie escribe ni lee**.

El diseño evita la necesidad de reembolsos: como la captura es **parcial** y siempre
`≤ guaranteed_price × quantity`, nunca se cobra de más. Pero **no hay ningún mecanismo para
devolver dinero si algo sale mal después de capturar**.

---

## 12. CONFIGURACIÓN DE STRIPE — ✅ VERIFICADA (11-sep-2026)

Verificada en el dashboard de Stripe y en el panel de Vercel el **11 de septiembre de 2026**, y
confirmada con una **compra real de extremo a extremo** en el sandbox.

| Dato | Valor verificado |
|---|---|
| Modo | **Test / sandbox** (sandbox "Vonda sandbox", cuenta Gropo). El cutover a live **sigue pendiente** |
| Destino de webhook | **`https://www.gropo.es/api/stripe/webhook`** — id `we_1TjGhOA114rXo3Kahd7KyxWg`, activo, y **el único dado de alta** |
| Eventos suscritos | **Uno solo: `payment_intent.amount_capturable_updated`** — el correcto para captura manual |
| `STRIPE_WEBHOOK_SECRET` | **Corresponde a ese endpoint.** Demostrado por comportamiento, no por comparación manual de secretos |
| Claves en Vercel | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, las tres en Production, en modo test |
| Tasa de error de las entregas | **0 %** |

### Prueba de extremo a extremo — 11-sep-2026, 16:24 UTC

```
16:24:43  payment_intent.created                    pi_3UEXFnA114rXo3Ka0yRH4oKS · 6000 · capture_method manual
16:24:44  payment_intent.amount_capturable_updated  evt_3UEXFnA114rXo3Ka04qFlUDQ
16:24:45  group_members                             join_order 16 · authorized · guaranteed_price 60
16:24:45  events                                    member_joined · total_units 12 → 13
```

`confirm_join` **no tiene ningún otro llamante en el sistema**, así que la fila en
`group_members` demuestra que la firma se validó, que el código se ejecutó y que la RPC escribió.
Es una prueba más fuerte que un evento de prueba sintético, que no lleva `metadata.group_id` y
por diseño se ignora con 200.

> ⚠️ **`www.vonda.es` sigue resolviendo**, pero es un **alias del mismo proyecto de Vercel** que
> `www.gropo.es`: mismo código, mismas variables, misma base de datos. Por eso las entregas
> antiguas al endpoint de `vonda.es` también creaban miembros correctamente. Su portada sirve una
> copia cacheada antigua; las rutas de API son dinámicas y no se cachean.

**Lo que sigue sin verificar:**
1. El cutover a modo **live**: claves `sk_live_`/`pk_live_`, endpoint de webhook en modo live con
   su propio `whsec_`, y prueba controlada con tarjeta real.
2. Los endpoints de modo live son una lista **separada** de los de test: crear el de live no
   reutiliza nada de lo verificado aquí, y su secreto de firma será distinto.

---

## 13. VARIABLES DE ENTORNO RELACIONADAS CON PAGOS

| Variable | ¿En `.env.local`? | Uso |
|---|---|---|
| `STRIPE_SECRET_KEY` | ✅ | `src/lib/stripe.ts` — **lanza una excepción al importar si falta** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | `JoinFlow.tsx:30`, `FastCheckoutModal` |
| `STRIPE_WEBHOOK_SECRET` | ✅ | verificación de la firma del webhook |
| `CRON_SECRET` | ❌ no — pero **sí en Vercel** | autoriza `/api/cron/close-groups`. ✅ Verificada en Vercel el 11-sep-2026 (Production y Preview): el cierre automático está armado |

Ver `PROJECT_KNOWLEDGE_PACK.md` § FIRST THINGS TO CHECK.

---

## 14. RESUMEN DE COMPORTAMIENTO ANTE FALLOS

| Escenario | Comportamiento REAL verificado |
|---|---|
| Webhook duplicado | `already_processed`. Sin efectos |
| Webhook duplicado **en paralelo** | `unique_violation` sobre `uniq_group_members_pi` → `already_processed`. **Nunca libera el hold** |
| Webhook con `group_id` ausente | 200, ignorado |
| Webhook con `group_id` inválido | La RPC falla → **500 → Stripe reintenta durante días** |
| El usuario reintenta pagar | Nuevo PaymentIntent → **nuevo miembro** (§10.2) |
| Abandono **antes** de autorizar | PI en `requires_payment_method`. Nunca llega el webhook → no hay miembro. **El PI queda huérfano en Stripe; no hay limpieza** |
| Abandono **después** de autorizar | El webhook crea el miembro igualmente. Correcto |
| Tarjeta rechazada | `confirmPayment` devuelve error; no hay hold ni miembro |
| Grupo cerrado entre el hold y el webhook | `needs_release/group_closed` → hold cancelado |
| Stock agotado entre el hold y el webhook | `needs_release/out_of_stock` → hold cancelado |
| Fallo al cancelar el hold | Relee el PI; si ya está `canceled` → OK; si no → **500 para forzar reintento** |
| Hold caducado antes del cierre | La captura falla → `sendAdminAlert` → el miembro queda `instructed` y recibe instrucciones de transferencia |
| El frontend dice una cosa y Stripe otra | **Stripe manda.** `captureGroupPayments` reconcilia releyendo el PI |
| Reembolso necesario | 🔴 **Sin mecanismo** |
| `JoinFlow` muestra éxito y el hold se acaba liberando | 🔴 **Ocurre**. Ver §7.2 |
