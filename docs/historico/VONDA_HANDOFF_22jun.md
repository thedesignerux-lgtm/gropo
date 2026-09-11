# VONDA — Estado y plan de arranque (handoff 22 jun 2026)

**Fecha de cierre de sesión:** 22 jun 2026
**Repo:** `/Users/benjamin/Desktop/kuorum` (Next.js 14 App Router · `src/` · `@/` → `src/`)
**GitHub:** `thedesignerux-lgtm/kuorum` · Supabase project: `xpktkuozspreuxucnguh`
**Reparto:** Claude = arquitecto/CTO (escribe el código y razona); Benjamin = manos + dashboards. Benjamin no escribe código; ejecuta y aprueba.

---

## Qué es

MVP de compra colectiva para ciclismo en España. El precio baja en vivo según entran compradores (por **unidades**, no por compradores). Cierre dominical 22:00 Europe/Madrid. Precio único de liquidación. **Vonda es merchant-of-record.**

**Producto del primer grupo (inventado, sin vendedor real aún):** Continental GP5000 S TR 700x28c · PVP 79,95 € · tramos 10→74,90 / 25→69,90 / 50→64,90 / 100→59,90 · mín 10 uds · stock 120 · cláusula 75%.
**Lanzamiento objetivo:** domingo 28 jun 2026 (depende del vendedor real — ver bloqueador).

---

## 🟢 LO QUE SE HIZO HOY (22 jun)

### 1. Sincronización del repo con producción (deuda peligrosa, saldada)

El repo iba POR DETRÁS de producción en tres funciones money-critical. Si alguien re-ejecutaba los `.sql` viejos, revertía el motor en silencio. **Resuelto.**

- Verificado contra `pg_proc`: las tres funciones tienen **firma única** (cero duplicados acechando):
  - `compute_price(uuid, integer)`
  - `close_group(uuid)`
  - `confirm_join(text,uuid,text,text,text,integer,numeric,numeric,jsonb,text,numeric)` — 11 args
- Extraídas las definiciones VIVAS con `pg_get_functiondef` y revisadas línea a línea (las tres son las versiones de **demanda efectiva por tier / PMA**, no las viejas planas). Sin bugs bloqueantes.
- Escritas a los archivos del repo vía `pbpaste` (el relevo de SQL largo por chat fallaba; clipboard→archivo es lossless).
- **Commit `50a75e1`** — solo 3 `.sql` (221+/260-), autor `Benjamin Perez Souto <benjaminperezsouto@gmail.com>`, push a `origin/main` ✓.

### 2. 🔴 Agujero de seguridad VIVO cazado y cerrado

Al verificar permisos (`has_function_privilege`) para que los archivos del repo reprodujeran el estado seguro, se descubrió que **`confirm_join` y `close_group` eran ejecutables por `anon` y `authenticated`** → invocables por internet vía la REST API de Supabase (`POST /rest/v1/rpc/...`) con la publishable key.

- **Causa:** el 21 jun, al pasar `confirm_join` de 9 a 11 args, cambió la firma → DROP + CREATE → la función nueva heredó `PUBLIC EXECUTE` por defecto. El blindaje del 17 jun quedó en la firma vieja (inexistente). `close_group` probablemente nunca se blindó.
- **Riesgo:** `confirm_join` inserta miembros (se podían fabricar miembros sin hold real); `close_group` captura pagos / adjudica / cancela (se podía forzar el cierre de cualquier grupo). En modo test → sin dinero real, pero era bloqueador duro pre-lanzamiento.
- **Arreglo aplicado en producción:**
  ```sql
  REVOKE EXECUTE ON FUNCTION public.confirm_join(...11 args...) FROM PUBLIC, anon, authenticated;
  GRANT  EXECUTE ON FUNCTION public.confirm_join(...11 args...) TO service_role;
  REVOKE EXECUTE ON FUNCTION public.close_group(uuid) FROM PUBLIC, anon, authenticated;
  GRANT  EXECUTE ON FUNCTION public.close_group(uuid) TO service_role;
  ```
- **Re-verificado:** `confirm_join` y `close_group` → `anon=false, authenticated=false, service_role=true`. ✓
- **Verificado que nada se rompió:** las 4 rutas de dinero (webhook→`confirm_join`, create-intent→`prepare_join`, admin closeGroup→`close_group`, cron→`closeGroup`→`close_group`) usan **todas** el cliente service-role (`supabaseAdmin` de `@/lib/supabase-admin`), nunca la anon key. El cron delega en `closeGroup()` de `admin/grupos/[id]/actions.ts` (no llama `close_group` directo).
- El candado quedó **escrito también en los archivos del repo** (bloque `REVOKE`/`GRANT` al final de cada `.sql`).

### 3. `compute_price` se queda ABIERTA (decisión correcta)

4 de 6 llamadas a `compute_price` usan la anon key — incluidas dos en componentes `'use client'` (navegador) para el precio en vivo (`GroupLiveSection`, `GroupDesktopView`) + dos páginas SSR. Cerrarla rompería el pricing público. Es inocua: `SECURITY DEFINER`, solo devuelve 3 escalares (`best_price`, `best_bid_id`, `next_price`), no expone filas de `group_members`. El archivo del repo lleva `GRANT ... TO anon, authenticated, service_role` (estado abierto explícito).

### 4. Webhook desplegado: `esperar-a-precio` ahora persiste en prod

`src/app/api/stripe/webhook/route.ts` tenía sin commitear el cambio que pasa `p_join_mode`/`p_target_price` a `confirm_join`. Sin desplegar, los esperadores caían al default (`comprar`/NULL) en producción.

- Diff revisado (2 líneas, limpio):
  ```js
  p_join_mode: m.join_mode || 'comprar',
  p_target_price: m.target_price != null ? Number(m.target_price) : null,
  ```
- Comprador "ahora" → `target_price` ausente = `undefined` → `null` (cero regresión). Esperador → `Number("64.90")`. Matiz inofensivo: un `""` daría `0`, pero `target_price` solo se consulta para esperadores y un `0` falla del lado seguro (libera, nunca cobra).
- **Commit `3bbc151`** — 1 archivo, 2 inserciones, push ✓. El deploy de Vercel mete el webhook nuevo en prod.
- **Pendiente de verificación empírica:** join real de esperador → confirmar que `target_price` aterriza. Va en el ensayo de cierre E2E.

### 5. Limpieza

- `src/app/favoritos/` (basura del BottomNav revertido) → borrado.
- `git status` final: **working tree clean**. `.claude/` ya estaba ignorado.
- Config local del repo: `user.email = benjaminperezsouto@gmail.com`, `user.name = Benjamin Perez Souto` (NO global). Resuelve el footgun del email para futuros commits.

---

## 🔴 EL BLOQUEADOR REAL (sin cambios)

**No hay vendedor real con tramos reales todavía.** Estado del distribuidor: **"sí condicionado"** — *"una vez que solucionemos el pago y el envío, me da los tiers"*. Pago ✅ (Stripe). Envío 🔴 (Sendcloud, no construido). El envío es la última puerta para arrancarle los tiers.

---

## 📋 PRÓXIMA SESIÓN: arrancar SENDCLOUD

**Decisión confirmada:** Sendcloud (no Packlink — Packlink PRO no tiene API). Multi-courier (SEUR, Correos, GLS…), tier gratis 50 etiquetas/mes.

### Primer paso (igual que con Stripe): crear la cuenta para tener las claves
- Crear cuenta Sendcloud (plan gratis).
- Conseguir las 3 env vars: `SENDCLOUD_PUBLIC_KEY`, `SENDCLOUD_SECRET_KEY`, `SENDCLOUD_SHIPPING_METHOD_ID`.
- **Al abrir la sesión, Claude debe buscar la documentación ACTUAL de la API de Sendcloud** (dónde están las claves, cómo se saca el shipping method id, requisitos del tier gratis) — no de memoria, puede haber cambiado.

### Arquitectura V0 (espejo de `stripe-capture.ts`)
```
close_group → captureGroupPayments → generateShippingLabels (NUEVO, no-fatal)
```
- **Migración nueva:** `group_members` + `shipping_label_url`, `shipping_tracking_code`, `shipping_carrier`, `shipping_parcel_id`, `shipping_status` (default 'pending').
- **`src/lib/shipping-sendcloud.ts`:** lee miembros instructed/paid, POST a Sendcloud `/api/v2/parcels` por miembro, guarda label_url + tracking + parcel_id. Idempotente vía `shipping_parcel_id`. Fallos → admin alert, no rompen el cierre.
- **Disparo:** botón manual admin "Generar etiquetas" (NO automático al cierre en V0).
- **Remitente** = dirección del distribuidor (placeholder para construir/probar; se fija cuando concrete).
- **Quién paga el envío:** decisión de negocio pendiente (define de quién es la cuenta Sendcloud).
- ⚡ **Opus 4.8** para la función (toca el flujo de cierre).

### NO en V0 (anti scope creep)
Tracking en vivo para comprador, portal de devoluciones, reglas multi-courier, tarifas en tiempo real, notificación automática de tracking al comprador.

---

## 🟡 OTROS PENDIENTES (no bloquean)

### Money-critical aún por probar
- **Ensayo de cierre manual E2E con Stripe real** (Nivel 2): grupo clon, holds reales test, verificar captura/liberación con esperadores + emails de cierre + que `target_price` persiste (verificación del webhook desplegado hoy). El cron en Vercel Hobby no es fiable → **botón de cierre manual = método principal el Día D.** ⚡ Opus 4.8.
- **Cutover Stripe test → live** (cuando haya empresa registrada): claves `live`, nuevo endpoint webhook en modo live con su `whsec_`, actualizar 3 vars en Vercel, redeploy, prueba con tarjeta real. ⚡ Opus 4.8.

### Motor (terminar cuando haya vendedor con tramos reales)
- UI selector de PMA/tier (la pantalla diseñada, en morado #6C3CE1).
- "Cambiar de objetivo" en vivo (money-critical: re-evalúa demanda, posible reajuste de hold).

### Menores anotados
- `compute_price_at_n` quedó SIN USO (lo reemplazó `compute_price` en el cierre) — retirar/marcar obsoleto algún día.
- CHECK constraint de monotonía de tiers en BD (hoy solo se valida en TS del admin).
- Guard de `group_id` en el webhook (PI sin `metadata.group_id` → 200 sin llamar `confirm_join`).
- Página "unido" se fía del pago, no del webhook confirmado (añadir polling/redirect condicional).
- DST de `closes_at` (hoy `20:00 UTC` = 22:00 CEST verano, pero 21:00 CET invierno) — arreglar antes de octubre.
- Centralizar Resend (el webhook instancia su propio `new Resend()`).
- `confirm_join` dedupe latente: check por teléfono OR email, pero upsert de users `ON CONFLICT (email)` — dos personas con mismo teléfono → la 2ª rechazada. Aceptable V0.
- Excedente con 2ª puja: comprador sobrante podría acabar a precio > su hold → admin-manual V0.

---

## 🔧 DATOS TÉCNICOS DE REFERENCIA

**Funciones money-critical (verificadas en BD viva 22 jun, firma única, blindaje confirmado):**
- `compute_price(uuid, integer)` → demanda efectiva por tier. Permisos: anon/authenticated/service_role (ABIERTA, a propósito).
- `close_group(uuid)` → cierre alineado con el motor (llama a `compute_price`). Permisos: **solo service_role**.
- `confirm_join(text,uuid,text,text,text,integer,numeric,numeric,jsonb,text,numeric)` → 11 args. Permisos: **solo service_role**.

**Contrato `group_members`:**
- `join_mode` text NOT NULL default 'comprar' · `target_price` numeric NULL
- Comprador "ahora" → `comprar` / NULL (PMA=∞). Esperador → `esperar` / X (PMA=X).
- Vivos (cuentan demanda) = payment_status IN ('authorized','instructed','paid'). Muertos = released/cancelled/auth_failed.
- Índice único `uniq_member_per_group` sobre (group_id, user_id). Columna PI: `stripe_payment_intent_id`.

**Clientes Supabase:**
- `@/lib/supabase` → anon/publishable (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Usado por: páginas SSR de grupo, componentes cliente de precio en vivo.
- `@/lib/supabase-admin` → service-role (`SUPABASE_SERVICE_ROLE_KEY`). Usado por: webhook, create-intent, admin actions, cron, quote.

**Stripe:** modo test · sandbox "Vonda sandbox" · endpoint `creative-harmony` → `https://www.vonda.es/api/stripe/webhook` · 1 evento `payment_intent.amount_capturable_updated`.

**Archivos clave:** `src/lib/stripe-capture.ts` · `src/lib/shipping-sendcloud.ts` (a crear) · `src/app/api/stripe/webhook/route.ts` · `src/app/api/join/create-intent/route.ts` · `src/app/admin/grupos/[id]/actions.ts` · `src/app/api/cron/close-groups/route.ts` · `supabase/compute_price.sql` · `supabase/close_group.sql` · `supabase/confirm_join.sql` (los tres ya sincronizados con prod).

**Commits de hoy:**
| Commit | Descripción |
|---|---|
| `50a75e1` | sync: compute_price/close_group/confirm_join vivas de prod + blindaje service_role |
| `3bbc151` | webhook: pasar join_mode/target_price a confirm_join (persistir esperar-a-precio en prod) |

---

## 🧠 REGLAS DE PROCESO (críticas)

- **Verificar SIEMPRE contra la BD viva**, no contra handoffs ni memoria de Cowork. Leer `pg_proc`/`has_function_privilege`/`information_schema` antes de tocar permisos o firmas.
- **Cambiar la firma de una función (DROP+CREATE) RESETEA los permisos a PUBLIC EXECUTE.** Tras cualquier cambio de firma en función money-critical → re-verificar `has_function_privilege` y re-aplicar el blindaje. (Esta es la causa raíz del agujero de hoy.)
- **El sandbox de Cowork NO puede tocar `.git/`** (no puede borrar `index.lock` ni operar el índice). **Todas las operaciones de git las hace Benjamin en su terminal del Mac.** Cowork solo escribe/lee archivos del working tree.
- **Relevo de SQL largo:** no pasarlo por chat (se pierde). Usar `pbpaste > archivo` desde la query generadora del SQL Editor (clipboard→archivo, lossless).
- **www vs sin www:** todas las URLs de producción usan `www.vonda.es` (apex redirige 308, rompe server-to-server).
- **Git:** autor `benjaminperezsouto@gmail.com` (config local del repo ya fijada).
- **Potencia del modelo:** money-critical (compute_price, close_group, confirm_join, capturas, shipping, RLS) → Opus 4.8. UI/copy → Opus 4.6.
- **Anti scope creep:** Sendcloud se construye porque desbloquea al distribuidor (necesidad validada), pero solo el alcance V0. Nada de features V1 sin necesidad real.

---

**Primer paso al abrir la próxima sesión:** arrancar Sendcloud → Claude busca la doc actual de la API, Benjamin crea la cuenta (plan gratis) y consigue las 3 claves, y construimos migración + `shipping-sendcloud.ts` + botón admin.
