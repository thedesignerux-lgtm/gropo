# VONDA — Estado y plan de arranque (handoff para nueva sesión)

**Fecha de cierre de sesión:** 17 jun 2026 (~11:00) · **Próxima sesión:** desde aquí
**Repo:** `/Users/benjamin/Desktop/kuorum` (Next.js 14 App Router · carpeta `src/` · `@/` → `src/`)
**Reparto:** yo = arquitecto/CTO (escribo el código y razono); tú = manos de Claude Code + dashboards (Supabase/Stripe/Vercel los ves solo tú). Tú no escribes código; ejecutas mis comandos y apruebas.

---

## Qué es

MVP de compra colectiva para ciclismo en España. El precio baja en vivo según entran compradores (por **unidades**, no por compradores). Cierre dominical 22:00 Europe/Madrid. Todos pagan el mismo precio final de liquidación. **Vonda es merchant-of-record** (cobra y paga al distribuidor por separado — NO es Stripe Connect/marketplace).

**Producto real del primer grupo:** Continental GP5000 S TR 700x28c · PVP 79,95 € · tramos 10→74,90 / 25→69,90 / 50→64,90 / 100→59,90 · mín 10 uds · stock 120 · cláusula 75%.
**Lanzamiento objetivo:** domingo 28 jun 2026.

---

## ✅ Lo que está construido y VERIFICADO (núcleo de dinero, terminado)

Flujo de unirse con Stripe (modelo **hold → captura**, todo probado E2E):

1. **`prepare_join`** (SQL) → valida (grupo abierto, teléfono ES, dedupe, rate-limit, guard de stock) y devuelve el **precio PROYECTADO** (`compute_price(group_id, qty)`) — el techo real del comprador. NO inserta.
2. **`/api/join/create-intent`** → crea PaymentIntent con `capture_method:'manual'`. **Hold = precio proyectado × uds** (= exactamente lo que muestra el botón). Datos del comprador viajan en metadata + shipping del PI. Devuelve solo `{clientSecret}`.
3. **Página `/grupo/[id]/unirme`** (`JoinFlow.tsx`) → Payment Element diferido, selector de cantidad (default 1), precio en vivo, confeti al cruzar tramo a la baja, Estados A/B, 3DS.
4. **Webhook `/api/stripe/webhook`** → escucha `payment_intent.amount_capturable_updated` (NO `succeeded`), llama `confirm_join`.
5. **`confirm_join`** (SQL) → idempotente, re-valida, inserta el miembro como `authorized` + campos Stripe + shipping, recalcula caches, dispara eventos (member_joined / price_dropped).
6. **Captura al cierre:** `closeGroup()` → `captureGroupPayments` (`src/lib/stripe-capture.ts`): adjudicados (`instructed`) → captura final × qty (parcial, ≤ hold, libera diferencia); `cancelled` → cancela/libera; excedente (`authorized`) → intacto. Idempotente (reconcilia contra estado del PI en Stripe).

**Pruebas pasadas:** join headless (miembro nace `authorized` con campos correctos) · **captura parcial probada** (retuvo 100 €, capturó 80 €, liberó 20 € — el bug más temido, capturar el hold completo, descartado) · idempotencia (sin doble cargo) · ensayo de navegador completo (Estados A/B, confeti, hold = total del botón = 144, no 160). Todo limpiado tras las pruebas.

**Decisión clave del hold (cerrada):** se retiene el **precio proyectado**, no el tramo 1. Es seguro (el final siempre ≤ proyectado, porque las unidades solo suben y las pujas no empeoran) y hace que la autorización en la tarjeta coincida con lo que ve el comprador → evita disputas por descuadre de extracto. **Ya aplicado en la BD y verificado.**

**UI oculta toda la mecánica bancaria.** Lista negra de términos en pantalla: *Retención, Reembolso, Autorización, Pre-autorización, Estimado, "Vonda de X €"*. El botón muestra solo "Pagar {total} €". La API no devuelve `hold_amount`/`auth_limit` al front.

**Modal legado retirado:** `JoinModal` borrado, botón de la ficha enlaza a `/grupo/[id]/unirme`, código muerto fuera, `tsc` limpio, sin miembros huérfanos.

**Nota:** `/api/email/join` fue borrado (recuperable de git; el patrón de Resend sobrevive en `close-payment`). El email de confirmación de unión se reconstruirá desde el webhook en el bloque de email.

---

## 🔢 Lo ÚNICO pendiente de la sesión anterior (micro-tarea tuya)

**Ejecutar el revoke de `join_group` en Supabase → SQL Editor** (si no lo corriste ya):

```sql
REVOKE EXECUTE ON FUNCTION public.join_group(uuid, text, text, text, integer)
  FROM PUBLIC, anon, authenticated;
```
Respuesta esperada: *"Success. No rows returned"*. Cierra `join_group` (puerta trasera sin hold; ya no la llama nadie).

---

## 📋 Plan de la próxima sesión (en orden)

### 1. 🔴 Blindar `confirm_join` + `prepare_join` (el agujero GRANDE — primer paso)
Por defecto `anon` tiene EXECUTE sobre `confirm_join`, que **inserta miembros**. Cualquiera con la publishable key podría llamarla por RPC con un `payment_intent_id` falso y crear un miembro **sin hold real**. Hay que revocarla (y `prepare_join` de paso), pero re-concediéndolas a `service_role` (el servidor las usa por ahí):

```sql
REVOKE EXECUTE ON FUNCTION public.confirm_join(text, uuid, text, text, text, integer, numeric, numeric, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prepare_join(uuid, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_join(text, uuid, text, text, text, integer, numeric, numeric, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_join(uuid, text, integer)
  TO service_role;
```
⚠️ **Re-test OBLIGATORIO tras esto:** un join headless (create-intent → confirm con `pm_card_visa`) en una vonda desechable. Si el miembro sigue naciendo, el blindaje está bien; si no, la concesión a `service_role` quedó mal y el webhook estaría roto en silencio. **Esto toca seguridad → conviene máxima potencia (Fable 5 si está; si no, Opus 4.8).**

### 2. Env vars de producción en Vercel (para que el deploy y el cierre funcionen)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET` de **producción** (distinto del local; sale de crear el endpoint de webhook en Stripe Dashboard apuntando a la URL desplegada `/api/stripe/webhook`)
- `CRON_SECRET` (falta — sin él, el cron del domingo devuelve 401 y NO cierra el grupo)

### 3. Toggle manual de pago del admin (footgun)
`updatePaymentStatus` en `actions.ts` rota el estado pending→instructed→paid **solo por columna** — marcar "paid" a mano NO captura dinero real en Stripe. Rework del panel admin para que refleje el estado real de captura.

### 4. Dominio + DNS + Resend + rename a Vonda + email de confirmación (todo en una pasada)
- Dominio (tienes dominio + logo listos) → DNS: web a Vercel, emails a Resend.
- Verificar Resend (hoy bloquea emails a compradores reales).
- Rename completo Kuorum/Lunivo → **Vonda** (strings de UI; rutas/tablas internas `groups`/`group_id` si se decide).
- Reconectar el email de confirmación de unión desde el webhook (cuando Resend esté verificado, para no romper el webhook con errores de email).

---

## 🔧 Datos técnicos que la próxima sesión necesita

**Firmas de funciones (exactas):**
- `join_group(uuid, text, text, text, integer)`
- `prepare_join(uuid, text, integer)`
- `confirm_join(text, uuid, text, text, text, integer, numeric, numeric, jsonb)`

**Columna real del PaymentIntent:** `stripe_payment_intent_id` (¡NO `payment_intent_id`!).
**Enum `payment_status`:** pending, instructed, paid, cancelled, refund_due, **authorized, auth_failed, released**.

**`.env.local` (6 claves, prefijos verificados):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (sb_pub…), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_test…), `STRIPE_SECRET_KEY` (sk_test…), `SUPABASE_SERVICE_ROLE_KEY` (sb_sec…), `STRIPE_WEBHOOK_SECRET` (whsec…, local desde `stripe listen`).

**Stripe:** modo test · cuenta `thedesignerux@gmail.com` · configurada como "Non-recurring payments" (NO Connect) · CLI instalado y logueado · `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

**Archivos clave:**
`src/app/api/join/create-intent/route.ts` · `src/app/grupo/[id]/unirme/` (`JoinFlow.tsx`, `page.tsx`, `unido/page.tsx`) · `src/app/api/group/[id]/quote/route.ts` · `src/lib/provincias.ts` · `src/lib/stripe.ts` · `src/lib/supabase-admin.ts` · `src/app/api/stripe/webhook/route.ts` · `src/lib/stripe-capture.ts` · `src/app/admin/grupos/[id]/actions.ts` · `supabase/prepare_join.sql` · `supabase/confirm_join.sql` · `supabase/revoke_join_group.sql`.

---

## ⚠️ Edge cases anotados (no urgen, en el radar)
- **Excedente con 2ª puja:** un comprador sobrante podría acabar en un precio mayor a su hold → admin-manual en V0 (no afecta al flujo normal).
- **Diligencia de dinero:** confirmar `final × qty` en el primer cierre real.
- El cron en Vercel Hobby no es fiable → el **botón de cierre manual** es el método principal el Día D.

---

## 🧠 Reglas de proceso (cómo trabajamos)
- **Siempre reviso el código real de Claude Code antes de fiarme de un test E2E del núcleo de dinero** (así se cazaron: `payment_intent_id` vs `stripe_payment_intent_id`, Estados A/B invertidos, una migración que habría fallado).
- Supabase SQL Editor **ejecuta TODO el texto del editor** (vacíalo antes de pegar). `CREATE FUNCTION` devuelve "Success, no rows" = éxito.
- QA cada bloque antes del siguiente. Editar un `.sql` NO actualiza la BD: hay que re-ejecutar el `CREATE` en el SQL Editor.
- **Potencia del modelo:** núcleo financiero / seguridad (compute_price, close/join, RLS, blindaje de funciones) → Fable 5 si está disponible; si no, Opus 4.8. El resto, Opus por defecto.

---

**Primer paso al abrir la nueva sesión:** confirmar si el revoke de `join_group` ya se ejecutó. Luego arrancar por el **blindaje de `confirm_join` + `prepare_join` con su re-test** (punto 1).
