# API.md — Gropo

> **Fuente de verdad de la superficie de API.**
> Verificado el 6 de septiembre de 2026 contra `main @ 7c49ef3`.
> Todas las rutas viven bajo `src/app/`. Framework: Next.js 14 App Router.

---

## 1. TABLA MAESTRA

Leyenda de auth: **público** · **sesión** (cookie Supabase) · **firma** (Stripe) ·
**bearer** (`CRON_SECRET`) · **cookie admin** (`admin_auth`) · **cabecera** (`x-admin-secret`).

| # | Método | Path | Auth | Idempotente | Fichero |
|---|---|---|---|---|---|
| 1 | POST | `/api/join/create-intent` | público | 🔴 **NO** | `api/join/create-intent/route.ts` |
| 2 | POST | `/api/checkout/lock` | sesión | 🔴 NO | `api/checkout/lock/route.ts` |
| 3 | GET | `/api/checkout/prefill` | sesión (degrada) | ✅ | `api/checkout/prefill/route.ts` |
| 4 | GET | `/api/join/status` | público | ✅ | `api/join/status/route.ts` |
| 5 | GET | `/api/group/[id]/quote` | público | ✅ | `api/group/[id]/quote/route.ts` |
| 6 | GET | `/api/group/[id]/tier-demand` | público | ✅ | `api/group/[id]/tier-demand/route.ts` |
| 7 | GET | `/api/group/[id]/summary` | público | ✅ | `api/group/[id]/summary/route.ts` |
| 8 | GET | `/api/group/[id]/pulse` | opcional | ✅ | `api/group/[id]/pulse/route.ts` |
| 9 | POST | `/api/pulse/pledge` | sesión | ✅ (upsert) | `api/pulse/pledge/route.ts` |
| 10 | DELETE | `/api/pulse/pledge` | sesión | ✅ | idem |
| 11 | POST | `/api/pulse/accept` | sesión | ⚠️ crea un SetupIntent por llamada | `api/pulse/accept/route.ts` |
| 12 | POST | `/api/pulse/accept/complete` | sesión | ✅ | `api/pulse/accept/complete/route.ts` |
| 13 | POST | `/api/stripe/webhook` | **firma** | ✅ | `api/stripe/webhook/route.ts` |
| 14 | GET | `/api/cron/close-groups` | **bearer** | ✅ | `api/cron/close-groups/route.ts` |
| 15 | GET | `/api/cron/pulse` | **bearer** | ✅ | `api/cron/pulse/route.ts` |
| 16 | GET | `/api/my-groups` | sesión | ✅ | `api/my-groups/route.ts` |
| 17 | POST | `/api/email/close-payment` | **cabecera** | 🔴 NO (reenvía) | `api/email/close-payment/route.ts` |
| 18 | GET | `/admin/grupos/[id]/csv` | **cookie admin** | ✅ | `admin/grupos/[id]/csv/route.ts` |
| 19 | GET | `/admin/email-test` | **cookie admin** | ⚠️ envía email | `admin/email-test/route.ts` |
| 20 | GET | `/auth/callback` | — | ⚠️ tolerante a doble callback | `auth/callback/route.ts` |
| 21 | POST/GET | `/auth/signout` | — | ✅ | `auth/signout/route.ts` |

---

## 2. DETALLE POR ENDPOINT

### 1 · `POST /api/join/create-intent` ⚡
**Propósito:** crear el hold del checkout normal.

```jsonc
// Request
{ "group_id": "uuid", "quantity": 1,
  "name": "…", "email": "…", "phone": "…",
  "shipping": { "name","phone","line1","line2?","city","province","postal_code" },
  "join_mode": "comprar" | "esperar",     // opcional, default 'comprar'
  "target_price": 45 }                     // obligatorio si join_mode='esperar'

// Response 200
{ "clientSecret": "pi_…_secret_…" }        // ← SOLO esto. Nada del importe retenido.
// 400 { "error": "<mensaje del RAISE de Postgres o de validación>" }
// 429 { "error": "Demasiados intentos. Espera unos minutos y vuelve a intentarlo." }
// 500 { "error": "<err.message>" }        // ⚠️ puede filtrar detalles internos (SECURITY.md SEC-09)
```

**Secuencia:**
1. `check_rate_limit('create-intent:<ip>', 10, 600)` — **fail-open**.
2. Validación de forma: `group_id`, `quantity`, `name`, `email`, `phone`, `shipping` obligatorios.
3. `prepare_join(group_id, phone, quantity)` → `guaranteed_price`, `phone` normalizado,
   `best_bid_id`, `product_name`, `product_spec`. Un `RAISE` se reenvía como 400.
4. Si `join_mode='esperar'`: `tier_demand(group_id)` y `target_price` debe estar **exactamente**
   en esa lista.
5. Customer de Stripe: reutiliza `users.stripe_customer_id` si hay sesión; si no, crea uno.
   **3 capas de degradación** (ver `PAYMENTS.md` §6).
6. `paymentIntents.create({amount, currency:'eur', capture_method:'manual', customer,
   setup_future_usage:'on_session', payment_method_types:['card'], description, shipping,
   metadata})`.
7. Devuelve `clientSecret`.

**Side effects:** crea un Customer y un PaymentIntent en Stripe; puede escribir
`users.stripe_customer_id`.
**🔴 No devuelve `pi_id`** — por eso `JoinFlow` no puede hacer el polling honesto
(`PAYMENTS.md` §7.2).

---

### 2 · `POST /api/checkout/lock` ⚡
**Propósito:** hold 1-Click con la tarjeta guardada. Crea **y confirma** el PaymentIntent
server-side.

```jsonc
// Request
{ "group_id": "uuid", "quantity": 1, "join_mode": "comprar"|"esperar", "target_price": 45 }

// Response
200 { "status": "ok", "pi_id": "pi_…" }
200 { "requires_action": true, "clientSecret": "…", "pi_id": "pi_…" }   // 3DS
400 { "error": "not_authenticated" | "no_saved_card" | "no_shipping" | "<mensaje>", "code"? }
401 { "error": "not_authenticated" }
429 { "error": "Demasiados intentos. Espera unos minutos." }
```

Requiere: sesión · `users.stripe_customer_id` · un PaymentMethod tipo `card` ·
una dirección previa en `group_members`. Traduce `StripeCardError` a castellano.

---

### 3 · `GET /api/checkout/prefill`
Prefill **read-only** del `FastCheckoutModal`. No mueve dinero ni crea nada.
```jsonc
{ "authenticated": true,
  "shipping": { "name","phone","line1","line2","city","province","postal_code","country" } | null,
  "payment":  { "brand","last4","wallet" } | null,
  "contact":  { "name","email","phone" } }
// o { "authenticated": false }
```
Un fallo al consultar Stripe se traga y devuelve `payment: null`.

---

### 4 · `GET /api/join/status?pi=pi_…`
```jsonc
{ "joined": true|false }
```
Valida forma (`pi.startsWith('pi_')`, longitud ≤ 100). Sin auth — ver `SECURITY.md` SEC-12.
**Consumidor único:** `FastCheckoutModal.completeSuccess()` (polling de 18 s).

---

### 5 · `GET /api/group/[id]/quote?units=N&target=T`
```jsonc
{ "pricePerUnit": 60, "nextPrice": 45 }     // nextPrice puede ser null
```
`units` se acota a `[0, 10]`. `target` opcional.
Llama a `compute_price(id, units, target)`.
> ⚠️ El comentario del fichero dice *"precio si entrara 1 unidad más"* para `nextPrice`
> — **obsoleto**: la semántica v2 es "siguiente escalón real". Ver `ALGORITHM.md` §1.

---

### 6 · `GET /api/group/[id]/tier-demand`
```jsonc
{ "tiers": [ { "minUnits": 20, "price": 45, "demand": 12, "unlocked": false }, … ] }
```
Orden: precio DESC. `dynamic = 'force-dynamic'`, `revalidate = 0`.
**Es la superficie pública de la escalera fusionada.** Consumido por `useTierDemand`.

---

### 7 · `GET /api/group/[id]/summary`
```jsonc
{ "firmUnits": 12, "reserveUnits": 3, "maxStock": 50 }
```
Clasifica los miembros vivos en firmes (`comprar`, o `esperar` con `target_price >= current_price`)
y reserva. `maxStock` sale de la puja `active` más antigua.

---

### 8 · `GET /api/group/[id]/pulse`
```jsonc
{ "steps": [ { "units": 20, "price": 45, "reached": false,
               "committed": 12, "marked": 0|1|2|3, "markedFraction": 0..2,
               "surge": false, "acceptedFraction": 0..1, "reachable": false } ],
  "glow": 0|1|2|3,
  "mine": { "tier_price": 45, "quantity": 1, "status": "watching" } | null }
```
Cabecera `Cache-Control: private, max-age=10`.
**Nunca expone cifras exactas de intención**: `intensityBucket()` reduce a 0–3 y el resto son
fracciones. Aplica el **recorte de relevancia** (fuera los escalones con precio ≥ al mejor ya
desbloqueado). `mine` solo con sesión.

---

### 9 / 10 · `POST` y `DELETE /api/pulse/pledge`
POST `{group_id, quantity, tier_price}` → `pulse_pledge_upsert`, y después
`notifyReachableWatchers(group_id)` (best-effort).
DELETE `{group_id}` → `pulse_pledge_cancel`.
Ambos exigen sesión (401 si no).

---

### 11 · `POST /api/pulse/accept`
`{group_id}` → verifica que exista un pledge `watching`/`accepted` del usuario, resuelve o crea
el Customer, y crea un **SetupIntent de 0 €** con `usage:'off_session'` y
`metadata:{group_id, auth_id, pulse_pledge_id}`.
Persiste `stripe_setup_intent_id` y `stripe_customer_id` en el pledge.
```jsonc
{ "clientSecret": "seti_…_secret_…" }
```
Rate limit `pulse-accept:<ip>` 10/600 (fail-open).

---

### 12 · `POST /api/pulse/accept/complete` ⚡
`{group_id, setup_intent_id, name, email, phone, shipping}`.
**Verificación server-authoritative contra Stripe:**
```ts
if (si.status !== 'succeeded' ||
    si.metadata?.auth_id !== user.id ||
    si.metadata?.pulse_pledge_id !== pledge.id ||
    !si.payment_method) → 400 "No se pudo verificar la tarjeta"
```
Luego marca el pledge `accepted` con tarjeta, contacto y envío, y llama a
`runPulseTrigger(group_id)`.
```jsonc
{ "accepted": true, "fired": bool, "converted": n, "failed": n }
```

---

### 13 · `POST /api/stripe/webhook` ⚡⚡
Ver `PAYMENTS.md` §8 para el detalle completo. Resumen:
`runtime='nodejs'` · cuerpo crudo · firma obligatoria ·
solo procesa `payment_intent.amount_capturable_updated` ·
guard `metadata.group_id` · `confirm_join` · cancelación tolerante ·
efectos posteriores no-fatales · 200 para todo lo demás.

---

### 14 · `GET /api/cron/close-groups` ⚡⚡
Auth: `Authorization: Bearer ${CRON_SECRET}` — **falla cerrado**
(`if (!process.env.CRON_SECRET || header !== expected) → 401`).
```
1. SELECT id, product_name FROM groups WHERE status='open' AND closes_at <= now()
2. Por cada grupo → closeGroup(id)   ← el MISMO server action que el botón del admin
3. Un fallo individual no aborta el lote
4. Si hubo fallos → sendAdminAlert() (best-effort)
```
```jsonc
{ "closed": ["uuid",…], "failed": [{"id","error"}], "checked": n }
```
Programado en `vercel.json`: **`0 21 * * 0`** (domingos 21:00 UTC).

---

### 15 · `GET /api/cron/pulse`
Auth: `Bearer CRON_SECRET`.
```
1. group_ids distintos con pledges 'accepted' → runPulseTrigger(gid)
2. expireDeadPledges()  → pledges vivos de grupos no 'open' pasan a 'expired'
3. group_ids distintos con pledges 'watching' → notifyReachableWatchers(gid)
```
```jsonc
{ "checked": n, "expired": n, "notified": n, "results": { "<gid>": {...} } }
```
Programado: **`30 8 * * *`** (diario 08:30 UTC).

---

### 16 · `GET /api/my-groups`
Exige sesión (401 sin `user.email`). Busca `users.phone` por el **email del JWT** y llama a
`get_my_groups(phone, email)`. Después trae en paralelo la escalera de cada grupo abierto.
```jsonc
{ "groups": [ { member_id, quantity, guaranteed_price, final_price, payment_status,
                join_mode, target_price, group_id, product_name, product_spec, image_url,
                status, closes_at, current_price, payment_info } ],
  // Añadido el 15-sep-2026. Clave = group_id, solo grupos `open`.
  // Un grupo cuyo `tier_demand` falle NO aparece: el navegador lo pedirá él.
  "ladders": { "<group_id>": [ { min_units, price, effective_demand, unlocked } ] } }
```
✅ **Es el patrón seguro:** el email nunca viene del cliente.

**Por qué las escaleras viajan aquí.** Antes el navegador recibía los pedidos y entonces
lanzaba un `tier_demand` por cada grupo abierto: una segunda tanda de idas y vueltas, y por eso
las tarjetas aparecían primero y los números —«faltan N uds», la barra— se rellenaban después.
Esa consulta cuesta **4,7 ms** en el servidor (medido con `EXPLAIN ANALYZE`) y va en paralelo
desde el mismo centro de datos: encarece esta respuesta unos milisegundos y ahorra una tanda
entera en el cliente.

`ladders` es un campo **nuevo y opcional**: quien no lo lea sigue funcionando igual, y
`useLadders` pide solo las escaleras que no hayan venido servidas.

**401 significa «no hay sesión», y las pantallas lo usan como tal.** `/mis-grupos` ya no
pregunta antes a Supabase desde el navegador: lanza esta petición y decide con el código de
estado. Si algún día este endpoint dejara de devolver 401 sin sesión, esa pantalla se rompería.

> **Corregido el 15-sep-2026:** este apartado describía un *fallback* que leía los 50
> `group_members` más recientes de toda la tabla con una consulta extra por cada uno. **Ya no
> existe**: se retiró al cerrar A-17 —era además inalcanzable— y hoy la ausencia de teléfono
> devuelve directamente la lista vacía, que es la respuesta correcta.

> ⚠️ `users.phone` no tiene índice: hoy son 158 filas y da igual, pero esta ruta filtra por ahí
> en cada carga. Con volumen real, mirar aquí.

---

### 17 · `POST /api/email/close-payment`
Auth: cabecera `x-admin-secret` == `ADMIN_SECRET`.
`{groupId}` → `sendClosePaymentEmails(groupId)`.
```jsonc
{ "ok": true, "attempted": n, "sent": n, "failed": n }
```
🔴 **No idempotente:** re-ejecutarlo **reenvía** todos los emails.
El propio comentario del fichero dice: *"Por ahora reutiliza ADMIN_SECRET; al construir el cron
lo cambiaremos a CRON_SECRET"* — **no se cambió**.

---

### 18 · `GET /admin/grupos/[id]/csv`
Auth: cookie `admin_auth`. Exporta
`#, Nombre, Teléfono, Email, Cantidad, Precio final (€), Total (€), Estado pago`.
Precio unitario = `final_price ?? guaranteed_price`.

---

### 19 · `GET /admin/email-test?to=…`
Auth: cookie `admin_auth`. Envía un email de confirmación de prueba con datos **hardcodeados**
("Cubierta Continental GP5000", 41,90 €) y un `closesAt` calculado al próximo domingo 22:00
**hora local del servidor** (`closes.setHours(22,0,0,0)` — no usa `madridCloseAtISO`).
Marcado como **TEMPORAL** en su propio comentario. Ver `SECURITY.md` SEC-13.

---

### 20 · `GET /auth/callback?code=…&next=…&intent=…`
`exchangeCodeForSession(code)` y **copia explícitamente las cookies de sesión a la respuesta de
redirect** (sin eso el navegador no las recibía).
Si el intercambio falla → `302 /login?error=auth` **sin borrar cookies** (comentario: un segundo
callback con *"State has already been used"* por doble submit borraría la sesión buena).

---

### 21 · `POST` (y `GET`) `/auth/signout`
`supabase.auth.signOut()` (best-effort) + **barrido de todas las cookies `sb-*`**, con y sin
`domain: '.gropo.es'`. Motivo documentado: fragmentos huérfanos `sb-<ref>-auth-token.0/.1`
impedían reconstruir la sesión → bucle de "entra para ver tus grupos".
```jsonc
{ "ok": true }
```

---

## 3. SERVER ACTIONS (no son endpoints HTTP, pero son superficie de escritura)

| Acción | Fichero | Auth | Efecto |
|---|---|---|---|
| `adminLogin` | `admin/actions.ts:6` | contraseña == `ADMIN_SECRET` | Emite la cookie `admin_auth` |
| `adminLogout` | `admin/actions.ts:27` | — | Borra la cookie |
| `createGroup` | `admin/grupos/actions.ts:61` | `requireAdmin()` | Inserta `groups` + `bids`; rollback manual borrando el grupo si falla la puja |
| `addBidToGroup` | `admin/grupos/actions.ts:144` | `requireAdmin()` | Inserta `bids`; recalcula precios; email `petitionMatched` si es la primera puja |
| `closeGroup` ⚡⚡ | `admin/grupos/[id]/actions.ts:22` | `requireAdmin()` | `close_group` + `captureGroupPayments` + `sendClosePaymentEmails` |
| `updateGroup` | `admin/grupos/[id]/actions.ts:79` | `requireAdmin()` | Edita el grupo; valida la ventana de cierre contra el hold vivo más antiguo |
| `generateLabels` | `admin/grupos/[id]/actions.ts:123` | `requireAdmin()` | Sendcloud |
| `withdrawBid` | `admin/grupos/[id]/actions.ts:140` | `requireAdmin()` | Retira una puja con check de seguridad y rollback manual |
| `toggleFavorite` | `favoritos/actions.ts` | sesión (cliente autenticado, **respeta RLS**) | Inserta/borra en `favorites` |
| `getMyFavoriteIds` | `favoritos/actions.ts` | sesión | Lee `favorites` |

**`requireAdmin()`** (`src/lib/admin-auth.ts`) acepta **dos** credenciales:
la cookie `admin_auth == ADMIN_SECRET`, **o** `Authorization: Bearer ${CRON_SECRET}`
(así el cron puede invocar `closeGroup` sin cookie). **Falla cerrado.**

---

## 4. RPC LLAMADAS DIRECTAMENTE DESDE EL NAVEGADOR (clave anon)

Superficie que **no pasa por ningún endpoint propio** y por tanto no tiene validación de sesión
del lado del servidor de Gropo:

| Fichero:línea | RPC | Nota |
|---|---|---|
| `src/app/notificaciones/page.tsx:47` | `get_my_groups` | 🔴 con (teléfono, email) de `localStorage` |
| `src/app/perfil/page.tsx:73` | `get_profile` | 🔴 |
| `src/app/perfil/page.tsx:112` | `radar_prefs_save` | 🔴 |
| `src/app/perfil/page.tsx:127,156` | `address_set_default` | 🔴 |
| `src/app/perfil/page.tsx:133` | `address_delete` | 🔴 |
| `src/app/perfil/page.tsx:149,150` | `address_update` / `address_add` | 🔴 |
| `src/app/grupo/[id]/unirme/JoinFlow.tsx:791` | `get_profile` | 🔴 prefill de dirección |
| `src/app/crear-peticion/page.tsx:72` | `create_petition` | Por diseño (anónimo) |
| `src/components/desktop/MisGruposDesktop.tsx:97` | `tier_demand` | Seguro (solo agregados) |

Las marcadas 🔴 son las de `SECURITY.md` SEC-01 y explican por qué revocar el `EXECUTE` a `anon`
rompería la aplicación sin migrar antes estas 8 llamadas.

---

## 5. CONVENCIONES DE LA API

- **Errores en castellano**, pensados para mostrarse tal cual al usuario.
- Los `RAISE EXCEPTION` de PL/pgSQL se propagan como `error.message` y se devuelven con **400**.
- **500** se usa deliberadamente en el webhook para forzar el reintento de Stripe.
- Los endpoints de datos declaran `dynamic = 'force-dynamic'` y, algunos, `revalidate = 0`.
- Los que usan el SDK de Stripe declaran `runtime = 'nodejs'`.
- **Ningún endpoint usa un validador de esquema** (no hay Zod ni equivalente): la validación de
  forma es manual y la de negocio vive en SQL.
