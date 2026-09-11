# VONDA — Estado y plan de arranque (handoff 22 jun 2026 · sesión SENDCLOUD)

**Fecha de cierre de sesión:** 22 jun 2026 (sesión de tarde · Sendcloud)
**Repo:** `/Users/benjamin/Desktop/kuorum` (Next.js 14 App Router · `src/` · `@/` → `src/`)
**GitHub:** `thedesignerux-lgtm/kuorum` · Supabase project: `xpktkuozspreuxucnguh`
**Reparto:** Claude = arquitecto/CTO (escribe el código y razona); Benjamin = manos + dashboards. Benjamin no escribe código; ejecuta y aprueba. Cowork (Claude Code) edita archivos; **NO toca `.git/`** → todas las operaciones git las corre Benjamin en su terminal del Mac.

---

## Qué es

MVP de compra colectiva para ciclismo en España. El precio baja en vivo según entran compradores (por **unidades**). Cierre dominical 22:00 Europe/Madrid. Precio único de liquidación. **Vonda es merchant-of-record.** Motor de demanda efectiva (comprador "ahora" PMA=∞ / esperador PMA=X) ya construido en sesiones previas.

**Producto del primer grupo (inventado):** Continental GP5000 S TR 700x28c · PVP 79,95 € · tramos 10→74,90 / 25→69,90 / 50→64,90 / 100→59,90 · mín 10 uds · stock 120 · cláusula 75%.
**Lanzamiento objetivo:** domingo 28 jun 2026.

---

## 🟢 LO QUE SE HIZO HOY (sesión Sendcloud) — ENVÍO V0 CONSTRUIDO Y VALIDADO

El bloqueador que el distribuidor puso ("sin pago y sin envío no hay tiers") queda **funcionalmente resuelto**: pago ✅ (Stripe, sesiones previas) + **envío ✅ (Sendcloud, hoy)**.

### 1. Investigación de la API actual (no de memoria)
- **API v3, no v2** (v2 es legacy). Sendcloud recomienda v3 para integraciones nuevas.
- El "shipping method id" de v2 ya **no existe**: se sustituye por un `shipping_option_code` (string tipo `correos_express:paq24`), descubrible vía la Shipping options API.
- Endpoint de creación usado: **`POST /api/v3/shipments/announce-with-shipping-rules`** con `apply_shipping_rules:false` + `apply_shipping_defaults:false` (especificamos el option_code explícito → las reglas no pintan). Es **síncrono**: devuelve etiqueta + tracking en la misma respuesta.
- Auth: **Basic** (public key = usuario, secret = contraseña).

### 2. Cuenta Sendcloud
- Plan **Free** a nombre de Vonda, **tarifas de Sendcloud** (no contrato propio; optimización post-validación).
- "Gratis" = sin cuota de suscripción ni por etiqueta; **pagas el coste real del courier por envío**. El "50/mes" es solo para las etiquetas de prueba (`sendcloud:letter`).

### 3. 🔴 HALLAZGO IMPORTANTE: SEUR no está disponible
- En plan Free / tarifas Sendcloud, los carriers ES→ES disponibles son **Correos, Correos Express e InPost** (+ `sendcloud:letter` de prueba). **SEUR NO aparece** — vía Sendcloud exige contrato propio de SEUR + plan de pago.
- **Decisión pendiente con el distribuidor:** ¿"SEUR" es requisito duro, o vale un courier exprés? El análogo más cercano disponible hoy y gratis es **`correos_express:paq24`** (24h, tracked, firma, a domicilio, pide `to_telephone` que sí tenemos).
- **Clave:** el carrier es **un string de configuración**, no arquitectura. Cambiarlo = cambiar `SENDCLOUD_SHIPPING_OPTION_CODE`, cero código.

### 4. Migración (aplicada en prod + guardada en repo)
`group_members` + 5 columnas: `shipping_label_url`, `shipping_tracking_code`, `shipping_carrier`, `shipping_parcel_id` (todas text), `shipping_status` (text NOT NULL default `'pending'`). Aditiva e idempotente (`ADD COLUMN IF NOT EXISTS`). Guardada en **`supabase/shipping_columns.sql`** (repo↔prod sincronizados, sin deuda).

### 5. Módulo `src/lib/shipping-sendcloud.ts` (espejo de `stripe-capture.ts`)
- `generateShippingLabels(groupId)`: lee miembros `instructed`/`paid` (con join a `users` para el email), una llamada síncrona v3 por miembro, persiste `parcel_id` + `tracking` + `label_url` + `carrier` + `status='created'`.
- **Idempotente en 2 capas:** self-check por `shipping_parcel_id` (salta los que ya tienen) + `external_reference_id` = id del miembro (Sendcloud dedupe del lado servidor).
- **Aísla errores por miembro:** un fallo (dirección, carrier) no tumba al resto; se recoge en `failed[]`. Chequea `data.errors` aunque el HTTP sea 200 (en v3 los errores de carrier llegan con 200).
- Carrier por env (`SENDCLOUD_SHIPPING_OPTION_CODE`, default `sendcloud:letter`). Remitente con defaults placeholder en código.

### 6. Server action + botón admin
- `generateLabels(groupId)` en `src/app/admin/grupos/[id]/actions.ts` (devuelve `{created, skipped, failed}`).
- `src/app/admin/grupos/[id]/GenerateLabelsButton.tsx` (componente cliente, mismo molde que `CloseGroupButton`, diálogo de confirmación, pinta el resultado).
- Sección "Generar etiquetas" en `page.tsx`, tras "Cerrar grupo". **Disparo manual (V0), no automático al cierre.**

### 7. Validación
- **Curl directo** (sendcloud:letter): contrato confirmado — `external_reference_id` va a nivel raíz ✓, etiqueta en `data.parcels[0].documents[].link` ✓, `tracking_number` ✓, `data.errors:[]` ✓, dimensiones aceptadas ✓.
- **Test E2E por el botón** (grupo+miembro `TEST_ENVIO_BORRAR`): antes `pending`/NULL → tras pulsar, `created` / carrier `sendcloud` / parcel_id / tracking / label_url poblados ✓. Idempotencia confirmada (segundo click = skipped). Datos de prueba a borrar con el CLEANUP (ver pendientes).

### 8. Commit
**`e6e37c8`** — `feat(envios): etiquetas Sendcloud v3 (modulo + boton admin + migracion)` — 5 archivos, 312 inserciones, push a `origin/main` ✓.

---

## 🔴 PARA PRODUCCIÓN DE ENVÍO (pase de "construido" a "real") — pasada única deliberada

1. **Carrier real:** decidir con el distribuidor (SEUR contrato propio + plan de pago vs `correos_express:paq24` gratis ya) → fijar `SENDCLOUD_SHIPPING_OPTION_CODE` en `.env.local` + Vercel.
2. **Dirección real del distribuidor** (remitente) → `SENDCLOUD_FROM_*` en Vercel (hoy son placeholders en el código).
3. **Rotación final de claves Sendcloud:** el par actual (`20e7153c…` + su secret en `.env.local`) **salió en el chat** → regenerar par limpio, meter en `.env.local` + Vercel, nunca más por chat. Meter también `SENDCLOUD_PUBLIC_KEY`/`SENDCLOUD_SECRET_KEY` en Vercel (Production + Preview) si no están ya.
4. **Descargar/entregar los PDFs al distribuidor:** `shipping_label_url` es un endpoint con Basic auth → para darle las etiquetas hay que fetchearlas con las claves (botón "descargar etiquetas" / zip). Cierra el bucle operativo. Pequeño follow-up.
5. **`house_number`:** hoy el número va embebido en `address_line_1` (sin campo separado) y la carta de prueba lo aceptó. Verificar con la **primera etiqueta real de Correos**; si el carrier lo exige, añadir parseo.
6. **CLEANUP del test** (si no se corrió ya):
   ```sql
   DELETE FROM group_members WHERE group_id IN (SELECT id FROM groups WHERE product_name = 'TEST_ENVIO_BORRAR');
   DELETE FROM groups WHERE product_name = 'TEST_ENVIO_BORRAR';
   DELETE FROM users WHERE email = 'test-envio@vonda.es';
   ```
   (Las 2 cartas de prueba en Sendcloud —parcels `674609666` y `674632083`— son inofensivas, 2 de las 50 gratis. Dejar o cancelar.)

---

## 🟡 PENDIENTES QUE SIGUEN ABIERTOS (de handoffs previos, no de hoy)

### Money-critical aún por probar
- **Ensayo de cierre manual E2E con Stripe real (Nivel 2):** grupo clon, holds reales test, verificar captura/liberación con esperadores + emails de cierre + que `target_price` persiste. El cron en Vercel Hobby no es fiable → **botón de cierre manual = método principal el Día D.** ⚡ Opus 4.8. *(Lleva pendiente desde el 16 jun — es el money-critical nunca ejecutado.)*
- **Cutover Stripe test → live** (cuando haya empresa registrada): claves `live`, endpoint webhook en modo live con su `whsec_`, 3 vars en Vercel, redeploy, prueba con tarjeta real. ⚡ Opus 4.8.

### Motor de esperadores (cuando haya vendedor con tramos reales)
- UI selector de PMA/tier (pantalla diseñada, morado #6C3CE1).
- "Cambiar de objetivo" en vivo (money-critical: re-evalúa demanda, posible reajuste de hold).

### Menores anotados
- `compute_price_at_n` sin uso (lo reemplazó `compute_price`) — retirar algún día.
- CHECK constraint de monotonía de tiers en BD (hoy solo en TS del admin).
- Guard de `group_id` en el webhook (PI sin `metadata.group_id` → 200 sin llamar `confirm_join`).
- Página "unido" se fía del pago, no del webhook confirmado (añadir polling).
- DST de `closes_at` (`20:00 UTC` = 22:00 CEST verano pero 21:00 CET invierno) — arreglar antes de octubre.
- Centralizar Resend (el webhook instancia su propio `new Resend()`).
- `confirm_join` dedupe latente (check por tel OR email, upsert `ON CONFLICT (email)`).
- Excedente con 2ª puja → admin-manual V0.

---

## 🔧 DATOS TÉCNICOS DE REFERENCIA — SENDCLOUD

**Endpoint:** `POST https://panel.sendcloud.sc/api/v3/shipments/announce-with-shipping-rules`
**Auth:** Basic (public:secret). **Test sin coste:** `shipping_option_code: "sendcloud:letter"` (50/mes).
**Respuesta:** etiqueta en `data.parcels[0].documents[]` (type `label`, `link` requiere auth para descargar) · `tracking_number` · `tracking_url` · **error de carrier llega con HTTP 200 en `data.errors[]`**.

**Carriers disponibles (Free, ES→ES):** Correos (`correos:standard`, `correos:premium`, …), Correos Express (`correos_express:paq24`, `:epaq24`, `:ecommerce`), InPost (`inpost_es:…`). **SEUR no disponible** sin contrato propio.

**Env vars (módulo):**
- `SENDCLOUD_PUBLIC_KEY`, `SENDCLOUD_SECRET_KEY` (en `.env.local`; **pendiente** en Vercel + rotación)
- `SENDCLOUD_SHIPPING_OPTION_CODE` (default en código `sendcloud:letter`; prod = carrier real)
- `SENDCLOUD_FROM_*` (NAME, COMPANY, ADDRESS_LINE1, HOUSE_NUMBER, CITY, POSTAL_CODE, COUNTRY, PHONE, EMAIL) — placeholders en código
- `SENDCLOUD_UNIT_WEIGHT_KG` (0.30), `SENDCLOUD_PACKAGING_WEIGHT_KG` (0.30); caja default 30×30×20 cm

**Contrato `group_members` (envío):** `shipping_name`, `shipping_phone`, `shipping_address_line1/2`, `shipping_city`, `shipping_province`, `shipping_postal_code`, `shipping_country` (default ES) — poblados por `confirm_join` desde el jsonb `p_shipping` (claves `name/phone/line1/line2/city/province/postal_code/country`). El **email** del comprador NO está aquí: vive en `users` (join por `user_id`).

**Archivos clave (envío):** `src/lib/shipping-sendcloud.ts` · `src/app/admin/grupos/[id]/GenerateLabelsButton.tsx` · `src/app/admin/grupos/[id]/actions.ts` (`generateLabels`) · `src/app/admin/grupos/[id]/page.tsx` · `supabase/shipping_columns.sql`.

---

## 🧠 REGLAS DE PROCESO (críticas)

- **Verificar SIEMPRE contra la BD viva / el código real**, no contra handoffs ni resúmenes de Cowork. Leer `pg_proc`/`information_schema`/el archivo fuente antes de tocar.
- **Al abrir sesión con API externa, Claude busca la doc ACTUAL** (no de memoria; hoy v2→v3 habría roto el plan si tirábamos de memoria).
- **Cambiar la firma de una función PostgreSQL (DROP+CREATE) resetea permisos a PUBLIC EXECUTE** → re-verificar `has_function_privilege` y re-blindar a `service_role` tras cada cambio de firma money-critical.
- **Cowork NO puede tocar `.git/`** → git lo corre Benjamin en el Mac. Rutas con corchetes (`[id]`) entre comillas en `git add` o bash las trata como glob.
- **Secrets NUNCA por el chat** → solo `.env.local` + Vercel. Si uno se expone, regenerar. En curls usar `$SENDCLOUD_SECRET_KEY`, no el valor literal.
- **SQL largo vía clipboard→archivo** (`pbpaste`), no por chat.
- **www vs sin www:** todas las URLs de prod usan `www.vonda.es` (apex redirige 308, rompe server-to-server).
- **Git:** autor `benjaminperezsouto@gmail.com` (config local ya fijada; si no, Vercel se salta el deploy).
- **Potencia del modelo:** money-critical (compute_price, close_group, confirm_join, capturas, **shipping**, RLS) → Opus 4.8. UI/copy → Opus 4.6. (Fable 5 con acceso suspendido por directiva de control de exportación.)
- **Anti scope creep:** solo el alcance V0; nada de features sin necesidad validada.

---

## Commits de la sesión

| Commit | Descripción |
|---|---|
| `e6e37c8` | feat(envios): etiquetas Sendcloud v3 (módulo + botón admin + migración) |

---

## ✅ Primer paso de la próxima sesión — elegir foco

El envío ya no es bloqueador técnico. Opciones, por orden de impacto:

1. **Volver al distribuidor** con "pago ✅ + envío ✅, te genero las etiquetas listas" → arrancar los **tiers reales**. Antes, cerrar con él la pregunta del **carrier** (SEUR de pago vs Correos Express gratis). Esto es lo que de verdad mueve el lanzamiento del 28 jun.
2. **Productionizar el envío** (la pasada única: carrier real + `SENDCLOUD_FROM_*` + rotación de claves + botón descargar PDFs).
3. **Ensayo de cierre manual E2E con Stripe real (Nivel 2)** — el money-critical que sigue sin ejecutarse. ⚡ Opus 4.8.
4. **Cutover Stripe test → live.** ⚡ Opus 4.8.
