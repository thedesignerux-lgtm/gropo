# SECURITY.md — Gropo

> **Vulnerabilidades y controles de seguridad reales, verificados el 6 de septiembre de 2026**
> contra la base de datos de producción `xpktkuozspreuxucnguh` y el código en `main @ 7c49ef3`.
>
> **Este documento NO implementa soluciones.** La columna "solución potencial" es descriptiva,
> no una instrucción de cambio.

---

## 1. RESUMEN

| Severidad | Nº | Identificadores |
|---|---|---|
| 🔴 **CRITICAL** | 2 | SEC-01, SEC-02 |
| 🟠 **HIGH** | 2 | SEC-03, SEC-04 |
| 🟡 **MEDIUM** | 5 | SEC-05 … SEC-09 |
| 🔵 **LOW** | 4 | SEC-10 … SEC-13 |

---

## 2. 🔴 CRITICAL

### SEC-01 · Lectura y modificación de datos ajenos mediante (teléfono + email) desde `anon`

| Campo | Detalle |
|---|---|
| **Severidad** | 🔴 **CRITICAL** |
| **Archivos / funciones** | `public._profile_uid(text,text)` · `public.get_my_groups(text,text)` · `public.get_profile(text,text)` · `public.address_add(...)` · `public.address_update(...)` · `public.address_delete(text,text,uuid)` · `public.address_set_default(text,text,uuid)` · `public.radar_prefs_save(text,text,text[],numeric)` |
| **Causa** | Todas son `SECURITY DEFINER` (sortean RLS) **y tienen `EXECUTE` concedido al rol `anon`**. La identidad se resuelve por un par (teléfono, email) que viaja **como parámetro desde el cliente**, no desde la sesión. |

**Evidencia (verificada en vivo):**

`_profile_uid` — definición real en producción:
```sql
v_jwt_email := lower(nullif(trim(auth.jwt() ->> 'email'), ''));
if v_jwt_email is not null then
  select id into v_uid from public.users where lower(email) = v_jwt_email limit 1;
  return v_uid;                    -- ✅ con sesión: seguro, ignora los parámetros
end if;
-- Sin sesión: identidad estricta por tel + email.
v_phone := regexp_replace(coalesce(p_phone,''), '[\s\-\.]', '', 'g');
v_phone := regexp_replace(v_phone, '^\+34', '');
v_email := lower(trim(coalesce(p_email,'')));
if v_phone !~ '^[679][0-9]{8}$' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return null; end if;
select id into v_uid from public.users where phone = v_phone and lower(email) = v_email limit 1;
return v_uid;                      -- 🔴 sin sesión: cualquiera con el par entra
```

`has_function_privilege` sobre producción:
```
address_add        anon=true  authenticated=true  service_role=true
address_delete     anon=true  authenticated=true  service_role=true
address_set_default anon=true authenticated=true  service_role=true
address_update     anon=true  authenticated=true  service_role=true
get_my_groups      anon=true  authenticated=true  service_role=true
get_profile        anon=true  authenticated=true  service_role=true
radar_prefs_save   anon=true  authenticated=true  service_role=true
```

Confirmado además por el linter de Supabase (`get_advisors type=security`):
`anon_security_definer_function_executable` y
`authenticated_security_definer_function_executable` sobre esas 7 funciones.

> ⚠️ **Matiz importante — `get_my_groups` es el peor caso.**
> `get_my_groups` **NO usa `_profile_uid`**. Filtra directamente:
> ```sql
> WHERE u.phone = v_phone AND lower(u.email) = v_email
> ```
> Es decir: **no tiene camino de JWT en absoluto**. Ni siquiera con sesión activa se protege;
> siempre confía en los parámetros. Y devuelve, entre otros campos:
> ```sql
> CASE WHEN g.status='closed' AND gm.payment_status IN ('instructed','paid')
>      THEN (SELECT b.payment_info FROM bids b WHERE b.id = g.winner_bid_id)
>      ELSE NULL END AS payment_info
> ```
> → **los datos bancarios de transferencia del vendedor**.

**Ataque posible:**
Un `POST` sin autenticación a `https://<supabase-url>/rest/v1/rpc/get_profile` con la clave
publishable (pública por definición, embebida en el bundle JS) y el cuerpo
`{"p_phone":"6XXXXXXXX","p_email":"victima@correo.com"}`.
El teléfono y el email **no son secretos**: aparecen en firmas de email, redes sociales,
filtraciones de terceros o simplemente se conocen.

**Impacto:**
| Función | Lo que obtiene el atacante |
|---|---|
| `get_my_groups` | **Historial completo de pedidos** de la víctima: productos, cantidades, `guaranteed_price`, `final_price`, estado de pago, modo de compra, `target_price`, y el `payment_info` del vendedor |
| `get_profile` | **Perfil y todas las direcciones postales** de la víctima + sus preferencias de Radar |
| `address_add` | **Añadir** una dirección a la cuenta de la víctima |
| `address_update` | **Modificar** una dirección existente de la víctima |
| `address_delete` | **Borrar** direcciones de la víctima |
| `address_set_default` | **Cambiar su dirección predeterminada** |
| `radar_prefs_save` | Modificar sus preferencias |

🔴 **El vector más grave es `address_set_default` + `address_update`:** la dirección
predeterminada es la que precarga `JoinFlow` en el checkout y la base de la que se genera la
etiqueta de Sendcloud. **Manipularla permite redirigir un envío físico.**

**Estado de reconocimiento:** el propio fichero `supabase/profile_identity.sql` **documenta el
problema en su cabecera**:
> *"Un cliente podía pasar teléfono+email de OTRA persona y leer/editar sus datos (los params
> venían del cliente, no de la sesión). Ahora: `_profile_uid()` prioriza el email del JWT
> (autenticado → solo SUS datos, ignora params), y **solo cae al modo estricto tel+email para
> llamadas anónimas (retrocompatibilidad de páginas públicas SSR)**."*

Es decir: **el fallback anónimo es una decisión consciente de retrocompatibilidad**, no un
descuido. Sigue siendo explotable. `CLAUDE.md` lo lista como *"PENDIENTE (decisión aplazada):
unificación real de identidad… Eliminaría el teléfono como credencial y cerraría el acceso por
teléfono+email adivinados. ⚡ Money-critical + RLS"*.

**⚠️ El fix NO es un simple `REVOKE`.** Ocho puntos del código llaman a estas RPC **desde el
navegador con la clave anon** y romperían:
```
src/app/notificaciones/page.tsx:47   supabase.rpc('get_my_groups', {p_phone, p_email})
src/app/perfil/page.tsx:73           sb.rpc('get_profile', ...)
src/app/perfil/page.tsx:112          sb.rpc('radar_prefs_save', ...)
src/app/perfil/page.tsx:127          sb.rpc('address_set_default', ...)
src/app/perfil/page.tsx:133          sb.rpc('address_delete', ...)
src/app/perfil/page.tsx:149/150      sb.rpc('address_update' / 'address_add', ...)
src/app/perfil/page.tsx:156          sb.rpc('address_set_default', ...)
src/app/grupo/[id]/unirme/JoinFlow.tsx:791  supabase.rpc('get_profile', ...)
```
(Todos leen el par de `localStorage['vonda_user']`.)
`/api/my-groups` **sí** es seguro: verifica la sesión y saca el email del JWT antes de llamar a
la RPC — es el patrón que el resto no sigue.

**Solución potencial (descriptiva, NO implementar aquí):** enrutar esas 8 llamadas por
endpoints server-side que verifiquen la sesión (el patrón de `/api/my-groups`), y después
revocar `EXECUTE` a `anon`/`authenticated`; o hacer que `_profile_uid` devuelva `NULL` sin JWT y
dar a `get_my_groups` un camino de JWT.

---

### SEC-02 · Ausencia total de deduplicación de membresías

| Campo | Detalle |
|---|---|
| **Severidad** | 🔴 **CRITICAL** (integridad y abuso; también en `KNOWN_ISSUES.md` P0-01) |
| **Archivos / funciones** | `public.prepare_join` (producción) · `public.confirm_join` (producción) · tabla `group_members` · `src/app/api/join/create-intent/route.ts` |

**Causa (tres capas fallando a la vez):**
1. `prepare_join` **en producción no tiene** el check `IF EXISTS (... u.phone = v_phone) → 'Ya
   estás en este grupo'` que **sí está** en `supabase/prepare_join.sql`.
2. `confirm_join` **en producción no tiene** el check por `(phone OR email)` que **sí está** en
   `supabase/confirm_join.sql`. Lo sustituyó por un manejador de `unique_violation` que
   discrimina por `CONSTRAINT_NAME`, incluyendo una rama para **`users_phone_key`**.
3. **`users_phone_key` NO EXISTE en la base de datos.** Verificado en `pg_constraint`: sobre
   `users` solo hay `users_pkey`, `users_email_key`, `users_auth_id_key`.
   Y **no existe ningún UNIQUE `(group_id, user_id)`** en `group_members`.
4. `create-intent` no usa `idempotencyKey` de Stripe ni comprueba membresía previa.

**Evidencia en datos de producción:**
```
pares (group_id, user_id) duplicados en group_members : 2
teléfonos duplicados en users                          : 2
```

**Ataque posible / impacto:**
- **Inflado artificial de demanda:** un actor con varias tarjetas válidas puede crear N miembros
  en un grupo para desbloquear tramos baratos, y después dejar caducar los holds. Limitado solo
  por los rate limits (3/hora por teléfono, 10/10 min por IP, este último *fail-open*).
- **Doble cargo accidental:** un doble clic crea dos holds sobre la misma tarjeta y dos
  adjudicaciones → doble cobro y doble envío al cierre.
- **Suplantación parcial de identidad:** dos `users` pueden compartir teléfono; combinado con
  SEC-01, amplía la superficie de (teléfono, email) válidos.

**Solución potencial (descriptiva):** índice único parcial sobre
`(group_id, user_id) WHERE payment_status IN ('authorized','instructed','paid')`, restaurar el
check en `prepare_join`, y `idempotencyKey` en `create-intent`. Limpiar antes los duplicados
existentes. ⚡ Money-critical.

---

## 3. 🟠 HIGH

### SEC-03 · La cookie de administrador **es** el `ADMIN_SECRET`

| Campo | Detalle |
|---|---|
| **Severidad** | 🟠 HIGH |
| **Archivos** | `src/app/admin/actions.ts:16` · `src/lib/admin-auth.ts:8-15` · `src/app/admin/layout.tsx:6-8` |

**Evidencia:**
```ts
// admin/actions.ts
cookies().set('admin_auth', secret, {           // ← el VALOR es el propio secreto
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7,                     // 7 días
  path: '/admin',
});
// admin-auth.ts
if (secret && auth === secret) return null;     // comparación directa
```

**Causa:** no hay sesiones de administrador; la autenticación es "conoces la contraseña" y la
prueba se transporta en claro dentro de la cookie.

**Impacto:** cualquier fuga de esa cookie (backup del navegador, extensión maliciosa, log de un
proxy, acceso físico al equipo) entrega el **secreto maestro**, que además es el mismo que
protege `POST /api/email/close-payment` (cabecera `x-admin-secret`).
**El panel puede cerrar grupos y, con ello, capturar dinero real.**
No hay rotación, ni expiración del secreto, ni sesiones individuales, ni 2FA, ni registro de
auditoría de acciones del admin.

**Mitigantes existentes:** `httpOnly` (no accesible desde JS), `secure` en producción,
`sameSite: 'lax'`, `path: '/admin'` (limita a qué rutas lo envía el navegador; por eso
`/admin/email-test` y `/admin/grupos/[id]/csv` viven bajo `/admin`), `requireAdmin()` **falla
cerrado** si la variable no está configurada.

---

### SEC-04 · Rate limiting *fail-open*

| Campo | Detalle |
|---|---|
| **Severidad** | 🟠 HIGH |
| **Archivos** | `src/app/api/join/create-intent/route.ts:17-24` · `src/app/api/pulse/accept/route.ts:22-29` · `src/app/api/checkout/lock/route.ts:22` |

**Evidencia:**
```ts
if (rlError) {
  console.error('rate_limit_check_failed', rlError);   // ← se registra y SE CONTINÚA
} else if (allowed === false) {
  return NextResponse.json({...}, { status: 429 });
}
```
En `checkout/lock` la condición es `if (!rlError && allowed === false)` — mismo efecto.

**Causa:** decisión de diseño explícita, documentada en el comentario:
*"fail-open: un fallo del limitador nunca bloquea compras"*.

**Impacto:** si la tabla `rate_limits` deja de responder (o se satura — ver SEC-08), **el rate
limiting queda desactivado por completo** sin que nadie lo note. Amplifica SEC-02.

---

## 4. 🟡 MEDIUM

### SEC-05 · `create_petition` es escritura pública sin sesión

`create_petition(...)` es `SECURITY DEFINER` con `EXECUTE` para `anon`, y **crea filas en
`groups` y en `users`**. Es intencionado (es la única vía para que un anónimo pida un producto).

Controles reales verificados en la versión de producción (v3):
- Nombre de producto ≥ 2 caracteres; `quantity` entre 1 y 10.
- Teléfono español validado.
- **Anti-spam: máximo 5 peticiones por teléfono en 1 hora**, contadas uniendo
  `events.payload->>'user_id'` con `users`.
- **Upsert no destructivo** (endurecimiento "H3" documentado en el propio código):
  ```sql
  ON CONFLICT (email) DO UPDATE
    SET phone = COALESCE(users.phone, EXCLUDED.phone),
        name  = COALESCE(users.name,  EXCLUDED.name)
  ```
  con el comentario: *"en conflicto de email NO se pisan phone/name del usuario existente…
  Evita que cualquiera que conozca un email sobrescriba los datos de contacto de ese usuario."*

> ⚠️ Contraste: **`confirm_join` SÍ pisa** (`DO UPDATE SET phone = v_phone, name = p_name`).
> Ahí el pisado está respaldado por un pago autorizado, pero la asimetría es real y no está
> documentada en ningún sitio salvo aquí.

**Impacto residual:** creación masiva de grupos-petición basura (limitada a 5/hora por
teléfono), y enumeración de emails existentes por diferencia de comportamiento.

---

### SEC-06 · Sin límite de participaciones por persona → inflado de demanda

Consecuencia directa de SEC-02. Se documenta aparte porque el vector de abuso es distinto:
**manipular el precio público** de un grupo, no solo duplicar un pedido.

---

### SEC-07 · `next.config.mjs` permite imágenes de cualquier host HTTPS

```js
images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] }
```
**Impacto:** superficie SSRF del optimizador de imágenes de Next.js abierta a cualquier host
`https`. El riesgo real hoy es **bajo** porque `image_url` solo lo teclea el administrador, pero
el optimizador es un servicio que hace peticiones salientes con una URL controlable.

---

### SEC-08 · `rate_limits` crece sin límite y no tiene primary key

`check_rate_limit` solo purga la ventana **de la clave consultada**:
```sql
DELETE FROM rate_limits WHERE key = p_key AND created_at < now() - make_interval(secs => p_window_seconds);
```
Las claves que no se vuelven a consultar (IPs de un solo uso) **nunca se borran**.
La tabla **no tiene primary key** (verificado en `pg_constraint`).
**Impacto:** degradación progresiva del rate limiting → combinado con SEC-04 (*fail-open*),
puede acabar desactivándolo.

---

### SEC-09 · Fuga de mensajes internos en respuestas 500

`src/app/api/join/create-intent/route.ts:188` y `src/app/api/checkout/lock/route.ts:184`:
```ts
return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 });
```
Devuelven al cliente el `message` de una excepción no controlada, que puede provenir de Stripe o
de Postgres. **Impacto:** revelación de detalles de implementación (nombres de constraints,
estructura de errores del proveedor).

---

## 5. 🔵 LOW

### SEC-10 · `compute_price_at_n` — `search_path` mutable y ejecutable por `anon`
Función **muerta** (cero llamantes verificados), `SECURITY INVOKER`, `IMMUTABLE`, **sin
`SET search_path`**. Marcada por el linter como `function_search_path_mutable`.
Riesgo real bajo por ser `SECURITY INVOKER`, pero es superficie innecesaria.

### SEC-11 · Protección de contraseñas filtradas desactivada en Supabase Auth
Linter: `auth_leaked_password_protection` — *"Leaked password protection is currently disabled"*.
Impacto acotado: el login principal es Google OAuth + magic link.

### SEC-12 · `/api/join/status?pi=…` expone un booleano por PaymentIntent
```ts
if (!pi || !pi.startsWith('pi_') || pi.length > 100) return NextResponse.json({ joined: false });
```
Sin autenticación. Mitigado por el propio comentario del código: *"los PI ids no son
adivinables"* (son identificadores opacos de alta entropía) y por la validación de forma.

### SEC-13 · Endpoint temporal `/admin/email-test` desplegado
`src/app/admin/email-test/route.ts` — marcado *"Endpoint TEMPORAL de prueba de Resend"* en su
propio comentario, con datos hardcodeados. **Está correctamente protegido** por la cookie
`admin_auth`, pero permite enviar un email a **cualquier dirección** indicada en `?to=`, lo que
lo convierte en un vector de abuso de la reputación del dominio si el secreto se filtra.

---

## 6. CONTROLES DE SEGURIDAD QUE **SÍ** FUNCIONAN

Verificados en vivo, para no perderlos en un futuro refactor:

| Control | Evidencia |
|---|---|
| **Verificación de firma del webhook** | `stripe.webhooks.constructEvent(rawBody, sig, secret)`; 400 sin firma o sin secret; cuerpo leído con `req.text()` |
| **Service role key aislada** | Solo en `src/lib/supabase-admin.ts`; importado exclusivamente desde servidor |
| **Funciones money-critical blindadas** | `close_group`, `confirm_join`, `prepare_join`, `check_rate_limit`, las cuatro `pulse_*` y `_profile_uid`: `anon=false`, `authenticated=false`, `service_role=true`. **Verificado con `has_function_privilege`** |
| **Sin sobrecargas duplicadas** | 21 funciones en `public`, ningún nombre repetido en `pg_proc` |
| **`bids` ilegible por el cliente** | RLS activa, **cero políticas** → opacidad total del vendedor (D5) |
| **`group_members`, `users`, `user_addresses`, `user_radar_prefs`, `rate_limits`** | RLS activa, cero políticas → sin acceso REST directo |
| **`favorites`** | RLS con 3 políticas correctas (`auth.uid() = auth_id`), usadas por un cliente autenticado |
| **`events`** | RLS que **oculta `petition_created`** al público |
| **`groups`** | RLS que oculta los `cancelled` |
| **Validación server-authoritative del `target_price`** | `create-intent:60-77` y `checkout/lock:67-79` contra `tier_demand()` |
| **El importe retenido nunca llega al cliente** | `create-intent` devuelve solo `clientSecret` |
| **Verificación del SetupIntent contra Stripe** | `pulse/accept/complete:43-51` comprueba `status`, `metadata.auth_id`, `metadata.pulse_pledge_id` y `payment_method`. No confía en el front |
| **Conteos exactos del Pulse nunca salen al cliente** | `intensityBucket()` reduce a 0–3; fracciones en vez de cifras |
| **Guard del cron** | `Bearer CRON_SECRET`, **falla cerrado** si la variable no existe |
| **`search_path` fijado** | Todas las funciones vivas relevantes tienen `SET search_path TO 'public'` (excepto `compute_price_at_n`, muerta) |
| **Sin SQL injection** | No hay concatenación de SQL. Todo es `supabase-js` parametrizado o RPC tipada. Única excepción de forma: `expireDeadPledges` concatena uuids **procedentes de la propia BD**, no de entrada de usuario |
| **Sin XSS** | React escapa por defecto; **cero `dangerouslySetInnerHTML`** en todo el repositorio (verificado) |
| **CSRF** | Server Actions de Next 14 con protección propia; los endpoints con efectos exigen sesión, firma o secreto |
| **Cookies de sesión** | `domain: '.gropo.es'`, `sameSite: 'lax'`, `secure: true` en producción; sin dominio en previews y local |
| **Signout robusto** | `/auth/signout` barre **todas** las cookies `sb-*`, con y sin dominio |
| **Callback OAuth tolerante** | No borra cookies si el intercambio falla, para no destruir una sesión buena tras un doble callback |
| **Secretos fuera de git** | `.gitignore` cubre `.env*.local` y `*.save`; verificado que `.env.local`, `.env.local.save` y `.env.local.save.save` no están rastreados |

---

## 7. PENDIENTES DE SEGURIDAD DECLARADOS EN LA DOCUMENTACIÓN

Recogidos de `CLAUDE.md`, **no verificables desde el código**:

| Pendiente | Estado |
|---|---|
| **Rotación de las claves de Sendcloud** — *"expuestas en chat durante desarrollo"* | ❓ **UNKNOWN**, presuntamente pendiente |
| **Cutover Stripe test → live** | ❓ UNKNOWN |
| **Custom SMTP (Resend) en Supabase Auth** — el SMTP integrado limita a ~2-4 emails/hora para toda la aplicación | ❓ UNKNOWN. `CLAUDE.md` lo marca como **bloqueante** |
| **Unificación de identidad** (`group_members` → `auth.users`) | Pendiente. Es el fix de fondo de SEC-01 |

---

## 8. QUÉ REQUIERE CONSULTA DIRECTA DE PRODUCCIÓN

Esta auditoría **no ha podido verificar**:

1. **Stripe:** modo (test/live), endpoints de webhook dados de alta, eventos suscritos, claves
   configuradas en Vercel. No hay acceso a la API de Stripe en esta sesión.
2. **Variables de entorno en Vercel:** 18 de las 27 que el código usa **no están** en
   `.env.local`, incluidas `CRON_SECRET`, `RESEND_API_KEY`, `ADMIN_EMAIL` y las 12 de Sendcloud.
3. **Si `vonda.es` sigue resolviendo** y si el webhook de Stripe apunta a un dominio vivo.
4. **Configuración de Supabase Auth:** proveedores activos, URLs de redirección permitidas,
   SMTP.
5. **Contenido real de `bids.payment_info`** (datos bancarios del vendedor) — no se ha leído.
6. **El trigger sobre `auth.users`**: solo se ha inspeccionado la función
   `handle_new_auth_user()`, no su declaración de trigger en el esquema `auth`.
