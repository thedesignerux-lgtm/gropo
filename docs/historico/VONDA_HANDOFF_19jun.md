# VONDA — Estado completo y plan de arranque (handoff 19 jun 2026)

**Fecha de cierre de sesión:** 19 jun 2026 (~17:50)
**Repo:** `/Users/benjamin/Desktop/kuorum` (Next.js 14 App Router · carpeta `src/` · `@/` → `src/`)
**GitHub:** `thedesignerux-lgtm/kuorum` · Supabase project: `xpktkuozspreuxucnguh`
**Reparto:** Claude = arquitecto/CTO (escribe el código y razona); Benjamin = manos de Claude Code + dashboards (Supabase/Stripe/Vercel). Benjamin no escribe código; ejecuta comandos y aprueba.

---

## Qué es

MVP de compra colectiva para ciclismo en España. El precio baja en vivo según entran compradores (por **unidades**, no por compradores). Cierre dominical 22:00 Europe/Madrid. Todos pagan el mismo precio final de liquidación. **Vonda es merchant-of-record** (cobra y paga al distribuidor por separado — NO es Stripe Connect/marketplace).

**Producto real del primer grupo:** Continental GP5000 S TR 700x28c · PVP 79,95 € · tramos 10→74,90 / 25→69,90 / 50→64,90 / 100→59,90 · mín 10 uds · stock 120 · cláusula 75%.
**Lanzamiento objetivo:** domingo 28 jun 2026.

---

## ✅ Lo que está construido y VERIFICADO

### Flujo de unirse con Stripe (hold → captura, probado E2E en producción)

1. **`prepare_join`** (SQL, `SECURITY DEFINER`) → valida (grupo abierto, teléfono ES, dedupe, rate-limit, guard de stock) y devuelve el **precio PROYECTADO** (`compute_price(group_id, qty)`). NO inserta.
2. **`/api/join/create-intent`** → crea PaymentIntent con `capture_method:'manual'`. Hold = precio proyectado × uds. Datos del comprador en metadata + shipping del PI. Devuelve solo `{clientSecret}`.
3. **Página `/grupo/[id]/unirme`** (`JoinFlow.tsx`) → Payment Element diferido, selector de cantidad, precio en vivo, confeti al cruzar tramo, Estados A/B, 3DS.
4. **Webhook `/api/stripe/webhook`** → escucha `payment_intent.amount_capturable_updated`, llama `confirm_join`, envía email de confirmación.
5. **`confirm_join`** (SQL, `SECURITY DEFINER`) → idempotente, re-valida, inserta miembro como `authorized`, recalcula caches, dispara eventos. **Duplicados manejados limpiamente** (check por teléfono OR email + `EXCEPTION WHEN unique_violation` → `needs_release`).
6. **Captura al cierre:** `closeGroup()` → `captureGroupPayments` (`src/lib/stripe-capture.ts`): `instructed` → captura parcial (final × qty ≤ hold); `cancelled` → cancela/libera; excedente (`authorized`) → intacto. Idempotente.

### Seguridad de funciones (verificado contra `pg_proc` el 19 jun)

| Función | Permisos | Estado |
|---|---|---|
| `join_group` | solo `postgres` + `service_role` | ✅ Cerrada (puerta trasera sin hold) |
| `prepare_join` | solo `postgres` + `service_role` | ✅ Blindada |
| `confirm_join` | solo `postgres` + `service_role` | ✅ Blindada |

`anon` y `authenticated` NO tienen EXECUTE sobre ninguna de las tres. Verificado con `pg_proc.proacl` — no por el handoff, por la BD real.

### Bug del duplicado → hold huérfano (arreglado 19 jun)

**Problema:** `confirm_join` chequeaba duplicados por teléfono, pero el índice único `uniq_member_per_group` está sobre `(group_id, user_id)` y el usuario se resuelve por email. Un reintento con mismo email pero teléfono distinto se colaba por el check → reventaba contra la constraint → 500 → hold huérfano en la tarjeta del comprador.

**Arreglo (en la BD, verificado con test directo):**
1. Check de duplicado ampliado a teléfono **OR** email.
2. Bloque `BEGIN...EXCEPTION WHEN unique_violation` envuelve todas las escrituras → cualquier choque devuelve `needs_release / duplicate` en vez de error crudo.
3. El webhook ya manejaba `needs_release` → cancela el PI → libera el hold → devuelve 200.

**Prueba:** dos llamadas a `confirm_join` con mismo email, distinto teléfono → 1ª `confirmed`, 2ª `needs_release/duplicate`. Antes era 500.

### Webhook de producción (validado E2E el 19 jun)

- **Endpoint:** `https://www.vonda.es/api/stripe/webhook` (endpoint `creative-harmony` en Stripe sandbox).
- **Evento suscrito:** `payment_intent.amount_capturable_updated` (1 solo evento).
- **Signing secret:** `whsec_…` configurado en Vercel (`STRIPE_WEBHOOK_SECRET`, Production + Preview).
- **Validación:** unión real con tarjeta test → miembro nació como `authorized` con PI real → email de confirmación llegó al buzón.
- **Hallazgo cazado:** el dominio `vonda.es` (sin www) redirige 308 a `www.vonda.es`. Stripe no sigue redirecciones → el webhook fallaba silenciosamente. Resuelto apuntando el endpoint a `www.vonda.es`.

### Marca / Rename (completado 19 jun, commit `a7ac00f`)

Rename completo Kuorum/Lunivo/Grupeta → **Vonda** en 16 archivos (UI, emails, alertas internas, localStorage keys, CSS classes). Grep de verificación vacío — cero restos de nombres antiguos en `src/`.

### Email de confirmación de unión (reconectado 19 jun, commit `2b631a7`)

- Plantilla: `src/lib/emails/joinConfirmation.ts` (ya dice Vonda).
- Disparo: desde el webhook, en la rama `data?.status === 'confirmed'`, tras fetch del grupo para `product_name` + `closes_at`.
- No-fatal: envuelto en try/catch; un fallo de email no revierte la unión.
- **Probado:** email llegó al buzón real con precio actual, nombre de producto y fecha de cierre formateada.

### Resend + dominio

- Dominio `vonda.es` verificado en Resend (Status: Verified, provider: One.com, region: eu-west-1).
- FROM: `Vonda <no-reply@vonda.es>` (hardcoded en `src/lib/resend.ts` y en el webhook).
- `RESEND_API_KEY` en Vercel (Production + Preview).

### Toggle manual de pago del admin

`updatePaymentStatus` **eliminado** — confirmado con `grep -rn "updatePaymentStatus" src/` → vacío. El estado de pago es de solo lectura en el admin; solo lo cambian `confirm_join` (→ `authorized`) y `captureGroupPayments` (→ `paid`/`released`).

### Otras pruebas pasadas (sesiones anteriores, siguen vigentes)

- Captura parcial (retuvo 100 €, capturó 80 €, liberó 20 €).
- Idempotencia (sin doble cargo).
- Ensayo de navegador completo (hold = total del botón).
- TierBar proporcionalidad corregida.

---

## 🔧 Env vars de producción en Vercel (11 variables, todas en Production)

| Variable | Entorno | Estado |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Prod + Preview | ✅ |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Prod + Preview | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Prod + Preview | ✅ |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Prod + Preview | ✅ (test key `pk_test_…`) |
| `STRIPE_SECRET_KEY` | Prod + Preview | ✅ (test key `sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | Prod + Preview | ✅ (del endpoint `www.vonda.es`) |
| `CRON_SECRET` | Prod + Preview | ✅ |
| `ADMIN_SECRET` | Prod + Preview | ✅ |
| `RESEND_API_KEY` | Prod + Preview | ✅ |
| `ADMIN_EMAIL` | Prod + Preview | ✅ |
| `NEXT_PUBLIC_SITE_URL` | Production | ✅ `https://www.vonda.es` |

---

## 📋 Lo que queda por hacer (en orden de prioridad)

### 🔴 Antes del lanzamiento (28 jun)

1. **Cutover Stripe test → live.** Crear claves `live` (`pk_live_…`, `sk_live_…`), crear endpoint de webhook **en modo live** apuntando a `https://www.vonda.es/api/stripe/webhook` con su propio `whsec_…`, actualizar las 3 variables en Vercel (`PUBLISHABLE_KEY`, `SECRET_KEY`, `WEBHOOK_SECRET`), redeploy, y hacer una prueba real con tarjeta de verdad (cobro pequeño → reembolso). **⚡ Máxima potencia (toca dinero real).**

2. **Ensayo del cierre manual E2E** con un grupo clon (datos reales, puja real del GP5000). Verificar que `close_group` escribe `winner_bid_id` + `final_price`, que `captureGroupPayments` captura el importe correcto (`final_price × qty`), y que los emails de cierre se envían. El cron en Vercel Hobby no es fiable → **el botón de cierre manual es el método principal el Día D.**

3. **Verificar `captureGroupPayments`** solo procesa miembros `instructed` — confirmar que el admin close action cambia `authorized` → `instructed` correctamente antes de la captura.

4. **Mobile polish** en la ficha del grupo (espaciados, jerarquía, microcopys — territorio de Benjamin).

### 🟡 Mejoras anotadas (no bloquean lanzamiento)

5. **Guard de `group_id` en el webhook:** si un PI no tiene `metadata.group_id`, devolver 200 sin llamar a `confirm_join`. Evita errores infinitos si algún día se crean holds para otra cosa.

6. **Página "unido" se fía del pago, no del miembro confirmado.** La UI muestra éxito cuando el Payment Element completa, sin esperar al webhook. Si el webhook fallara, el usuario vería "unido" sin ser miembro. Añadir un guard (polling o redirect condicional) es mejora V1.

7. **DST del `closes_at`:** el admin calcula `closes_at` como `20:00 UTC`, que en CEST (verano) = 22:00 Madrid ✅, pero en CET (invierno) = 21:00 Madrid ✗. Arreglar antes de octubre (usar timezone-aware con `Europe/Madrid` en vez de offset fijo).

8. **Centralizar Resend:** el webhook instancia su propio `new Resend()` y define `FROM` localmente, duplicando `src/lib/resend.ts`. Refactor cosmético: exportar un helper `sendEmail()` desde `resend.ts`.

9. **`confirm_join` dedupe inconsistency (latente):** el check mira por teléfono OR email (arreglado), pero el upsert de `users` es `ON CONFLICT (email) DO UPDATE SET phone`. Si dos personas distintas comparten teléfono (improbable pero posible), el segundo sería rechazado como duplicado por teléfono. Aceptable para V0.

10. **Excedente con 2ª puja:** un comprador sobrante podría acabar en un precio mayor a su hold → admin-manual en V0.

11. **Borrar endpoint viejo** en Stripe (si queda alguno apuntando a `kuorum.vercel.app`; en la sesión del 19 jun solo existía el de `www.vonda.es`).

12. **Subdominio `kuorum.vercel.app`** sigue activo (comportamiento por defecto de Vercel). No es un problema funcional; se puede eliminar en Vercel → Settings → Domains si se quiere limpiar.

### 🔵 Post-validación (después del primer cierre real)

- Courier/logistics setup (SEUR, Sendcloud, Packlink) — semi-manual para el primer grupo, API en V1.
- Seller pipeline: al menos un distribuidor confirmado con tabla de tramos. Diego (Ciclored) es el contacto warm de mayor prioridad.
- Comisión de Vonda (V0 = 0% comisión).
- Analítica más allá de Vercel Analytics básico.

---

## 🔧 Datos técnicos de referencia

**Firmas de funciones (exactas, verificadas contra `pg_proc`):**
- `join_group(p_group_id uuid, p_name text, p_email text, p_phone text, p_quantity integer)`
- `prepare_join(p_group_id uuid, p_phone text, p_quantity integer)`
- `confirm_join(p_payment_intent_id text, p_group_id uuid, p_name text, p_email text, p_phone text, p_quantity integer, p_authorized_amount numeric, p_guaranteed_price numeric, p_shipping jsonb)`

**Índice único de miembros:** `uniq_member_per_group` sobre `(group_id, user_id)` — NO sobre teléfono.

**Columna del PaymentIntent:** `stripe_payment_intent_id` (¡NO `payment_intent_id`!).
**Enum `payment_status`:** pending, instructed, paid, cancelled, refund_due, authorized, auth_failed, released.

**Stripe:** modo test · cuenta `thedesignerux@gmail.com` · sandbox "Vonda sandbox" · endpoint `creative-harmony` → `https://www.vonda.es/api/stripe/webhook` · 1 evento: `payment_intent.amount_capturable_updated`.

**`.env.local` (7 claves):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_test…), `STRIPE_SECRET_KEY` (sk_test…), `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_WEBHOOK_SECRET` (whsec… local desde `stripe listen --forward-to localhost:3001/api/stripe/webhook`), `RESEND_API_KEY`.

**Archivos clave:**
`src/app/api/join/create-intent/route.ts` · `src/app/grupo/[id]/unirme/` (`JoinFlow.tsx`, `page.tsx`, `unido/page.tsx`) · `src/app/api/stripe/webhook/route.ts` · `src/lib/stripe-capture.ts` · `src/lib/stripe.ts` · `src/lib/supabase-admin.ts` · `src/lib/resend.ts` · `src/lib/emails/joinConfirmation.ts` · `src/lib/emails/sendClose.ts` · `src/lib/emails/paymentInstructions.ts` · `src/app/admin/grupos/[id]/actions.ts` · `src/app/api/cron/close-groups/route.ts` · `supabase/prepare_join.sql` · `supabase/confirm_join.sql`.

---

## 🧠 Reglas de proceso

- **Verificar contra la BD real, no contra el handoff ni resúmenes de Claude Code.** Leer `pg_proc`, `pg_constraint`, `pg_indexes` antes de tocar permisos o constraints. Leer el código fuente real antes de escribir arreglos.
- **Supabase SQL Editor ejecuta TODO el texto del editor** (vacíalo antes de pegar). Editar un `.sql` en disco NO actualiza la BD.
- **QA cada bloque antes del siguiente.**
- **Potencia del modelo:** núcleo financiero / seguridad → Opus 4.8 (o superior). UI / copy / polish → Opus 4.6.
- **www vs sin www:** `vonda.es` redirige 308 a `www.vonda.es`. Todas las URLs de producción (webhook, emails, OG, `NEXT_PUBLIC_SITE_URL`) deben usar `www.vonda.es`.
- **Git:** email del autor `benjaminperezsouto@gmail.com` (el issue del email inválido fue resuelto permanentemente).

---

## Commits de la sesión del 19 jun

| Commit | Descripción |
|---|---|
| `a7ac00f` | Rename Kuorum/Lunivo/Grupeta → Vonda (16 archivos) |
| `2b631a7` | Email de confirmación de unión desde webhook (no-fatal) |

---

**Primer paso al abrir la próxima sesión:** decidir si arrancamos por el **cutover test → live de Stripe** (punto 1) o por el **ensayo del cierre manual** (punto 2). Ambos son pre-lanzamiento.
