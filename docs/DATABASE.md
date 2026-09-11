# DATABASE.md — Gropo

> **Fuente de verdad del esquema.**
> Leído en vivo el **6 de septiembre de 2026** del proyecto Supabase `xpktkuozspreuxucnguh`
> mediante `pg_class`/`pg_attribute`, `pg_constraint`, `pg_indexes`, `pg_policy`, `pg_trigger`,
> `pg_type`/`pg_enum` y `pg_proc`.
>
> **DATABASE PRODUCTION** = lo que está desplegado (esta sección manda).
> **DATABASE REPOSITORY** = los ficheros `supabase/*.sql` — **no son migraciones** y varios
> están desfasados (§9).

---

## 0. HECHO ESTRUCTURAL: NO HAY SISTEMA DE MIGRACIONES

Verificado: **no existe `supabase/migrations/`**, ni Prisma, ni Drizzle, ni ningún runner.
El repositorio contiene 13 ficheros `.sql` sueltos en `supabase/` (más un backup en
`Archivos a guardar/`), aplicados a mano en el SQL Editor de Supabase y sincronizados de vuelta
**de forma inconsistente**.

**Consecuencia:** el esquema y el código de negocio en PL/pgSQL **no están versionados en git**.
La única forma de conocer el estado real es consultar la base de datos.

---

## 1. INVENTARIO — DATABASE PRODUCTION

**11 tablas · 7 enums · 21 funciones · 0 triggers en `public` · 0 vistas materializadas.**

| Tabla | Filas (6-sep-2026) | RLS | Políticas |
|---|---|---|---|
| `groups` | 1 | ✅ | 1 (SELECT público) |
| `bids` | 1 | ✅ | **0** → deny-all |
| `group_members` | 15 | ✅ | **0** → deny-all |
| `users` | 151 | ✅ | **0** → deny-all |
| `pulse_pledges` | 0 | ✅ | 1 (SELECT propio) |
| `favorites` | 1 | ✅ | 3 (SELECT/INSERT/DELETE propios) |
| `events` | 17 | ✅ | 1 (SELECT público filtrado) |
| `user_addresses` | ❓ | ✅ | **0** → deny-all |
| `user_radar_prefs` | ❓ | ✅ | **0** → deny-all |
| `rate_limits` | ❓ | ✅ | **0** → deny-all |

> "deny-all" = ni `anon` ni `authenticated` pueden leer ni escribir **directamente por REST**.
> Todo acceso pasa por funciones `SECURITY DEFINER` o por `service_role` desde el servidor.
> **⚠️ Esto NO implica que los datos estén protegidos:** varias funciones `SECURITY DEFINER`
> están abiertas a `anon` y sortean la RLS. Ver `SECURITY.md`.

---

## 2. ENUMS — DATABASE PRODUCTION

| Enum | Valores (en orden) | Valores realmente escritos por el código |
|---|---|---|
| `group_status` | `open`, `closing`, `closed`, `cancelled` | los 4 |
| `bid_status` | `active`, `outbid`, `winner`, `declined`, `withdrawn` | 4 — **`declined` nunca** |
| `payment_status` | `pending`, `instructed`, `paid`, `cancelled`, `refund_due`, `authorized`, `captured`, `failed`, `auth_failed`, `released` | 6 — **`captured`, `failed`, `refund_due` nunca**; `pending` es el default pero ningún flujo lo produce; `auth_failed` solo aparece en el mapa de badges del admin |
| `pulse_status` | `watching`, `accepted`, `holding`, `converted`, `failed`, `expired`, `cancelled` | los 7 |
| `price_mode` | `fluid`, `stepped` | se **guarda** pero **ningún motor lo lee** (ver `ALGORITHM.md` §8) |
| `user_role` | `buyer`, `seller`, `admin` | los 3 |
| `event_type` | `member_joined`, `bid_placed`, `bid_improved`, `price_dropped`, `group_closed`, `petition_created` | 4 — **`bid_placed` y `bid_improved` nunca** |

---

## 3. TABLAS — DATABASE PRODUCTION

### 3.1 `groups`

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `product_name` | text | NO | — |
| `product_spec` | text | SÍ | — |
| `product_url` | text | SÍ | — |
| `image_url` | text | SÍ | — |
| `status` | `group_status` | NO | `'open'` |
| `closes_at` | timestamptz | NO | — |
| `current_price` | numeric | SÍ | — |
| `next_price` | numeric | SÍ | — |
| `final_price` | numeric | SÍ | — |
| `winner_bid_id` | uuid | SÍ | — |
| `total_units` | integer | NO | `0` |
| `created_by` | uuid | SÍ | — |
| `created_at` | timestamptz | NO | `now()` |
| `pvp` | numeric | SÍ | — |
| `is_demo` | boolean | NO | `false` |

**Constraints:** `groups_pkey (id)` · `groups_created_by_fkey → users(id)`
**Índices:** `groups_pkey` · `idx_groups_closes_at (closes_at)` · `idx_groups_status (status)`
**Triggers:** ninguno
**RLS:** habilitada.

| Política | Cmd | Roles | USING |
|---|---|---|---|
| `groups_public_read` | SELECT | `anon`, `authenticated` | `status <> 'cancelled'` |

Sin políticas de INSERT/UPDATE/DELETE → solo `service_role` escribe.

> ⚠️ **`winner_bid_id` NO tiene foreign key a `bids`.** Nada impide un uuid huérfano.
> `current_price`, `next_price` y `total_units` son **cachés derivadas** — ver `ALGORITHM.md` §10.

### 3.2 `bids`

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `group_id` | uuid | NO | — |
| `seller_id` | uuid | NO | — |
| `tiers` | jsonb | NO | — |
| `price_mode` | `price_mode` | NO | `'fluid'` |
| `min_execution` | integer | NO | — |
| `max_stock` | integer | NO | — |
| `status` | `bid_status` | NO | `'active'` |
| `bid_revisions` | jsonb | NO | `'[]'` |
| `created_at` | timestamptz | NO | `now()` |
| `improved_at` | timestamptz | SÍ | — |
| `payment_info` | text | SÍ | — |

**Constraints:** `bids_pkey (id)` · `bids_group_id_fkey → groups(id) ON DELETE CASCADE` ·
`bids_seller_id_fkey → users(id)` (sin cascade)
**Índices:** `bids_pkey` · `idx_bids_group (group_id)`
**RLS:** habilitada, **CERO políticas**.

> 🔒 La ausencia de políticas en `bids` **es intencionada**: implementa la decisión D5
> (opacidad total del vendedor). Ver `BUSINESS_RULES.md` RULE-014.
> ⚠️ `bid_revisions` e `improved_at` **nunca se escriben** desde ningún sitio del código.

### 3.3 `group_members`

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `group_id` | uuid | NO | — |
| `user_id` | uuid | NO | — |
| `quantity` | integer | NO | — |
| `guaranteed_price` | numeric | SÍ | — |
| `final_price` | numeric | SÍ | — |
| `join_order` | integer | NO | — |
| `payment_status` | `payment_status` | NO | `'pending'` |
| `created_at` | timestamptz | NO | `now()` |
| `stripe_payment_intent_id` | text | SÍ | — |
| `stripe_customer_id` | text | SÍ | — |
| `authorized_amount` | numeric | SÍ | — |
| `captured_amount` | numeric | SÍ | — |
| `shipping_name` / `_phone` / `_address_line1` / `_address_line2` / `_city` / `_province` / `_postal_code` | text | SÍ | — |
| `shipping_country` | text | SÍ | `'ES'` |
| `join_mode` | **text** | NO | `'comprar'` |
| `target_price` | numeric(10,2) | SÍ | — |
| `shipping_label_url` / `_tracking_code` / `_carrier` / `_parcel_id` | text | SÍ | — |
| `shipping_status` | text | NO | `'pending'` |

**Constraints:**
- `group_members_pkey (id)`
- `group_members_group_id_fkey → groups(id) ON DELETE CASCADE`
- `group_members_user_id_fkey → users(id)`
- `group_members_quantity_check CHECK (quantity >= 1)`

**Índices:**
- `group_members_pkey`
- `idx_members_group (group_id)`
- **`uniq_group_members_pi` UNIQUE (stripe_payment_intent_id)** ← clave de idempotencia de pagos

**RLS:** habilitada, **CERO políticas**.

> 🔴 **NO EXISTE UNIQUE `(group_id, user_id)`.** Combinado con la eliminación de los checks de
> duplicado en `prepare_join` y `confirm_join` (ver `ALGORITHM.md` §3 y §5), nada impide que una
> misma persona sea miembro N veces del mismo grupo.
> **Evidencia en datos de producción: 2 pares `(group_id, user_id)` duplicados.**
> Ver `KNOWN_ISSUES.md` P0-01.
>
> ⚠️ **`join_mode` es `text` SIN CHECK constraint.** Un valor distinto de `'comprar'`/`'esperar'`
> no entra en ninguna rama del paso 4 de `close_group` (no se cancelaría) pero **sí** entra en el
> paso 6 (se adjudicaría) → se cobraría sin comprobar su PMA. Solo lo impide el código de
> aplicación.
>
> ⚠️ **`stripe_customer_id` está declarada pero nunca se escribe** en esta tabla (el Customer se
> persiste en `users.stripe_customer_id`).

### 3.4 `users`

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `email` | text | NO | — |
| `phone` | text | SÍ | — |
| `name` | text | SÍ | — |
| `role` | `user_role` | NO | `'buyer'` |
| `created_at` | timestamptz | NO | `now()` |
| `auth_id` | uuid | SÍ | — |
| `stripe_customer_id` | text | SÍ | — |

**Constraints:** `users_pkey (id)` · **`users_email_key` UNIQUE (email)** ·
**`users_auth_id_key` UNIQUE (auth_id)** · `users_auth_id_fkey → auth.users(id)`
**Índices:** los tres anteriores
**RLS:** habilitada, **CERO políticas**.

> 🔴 **NO EXISTE `users_phone_key`.** Consulta directa a `pg_constraint` sobre `users`: solo
> `users_pkey`, `users_email_key`, `users_auth_id_key`.
> **`confirm_join` (producción) contiene una rama `ELSIF v_constraint = 'users_phone_key'` que
> es CÓDIGO INALCANZABLE.**
> **Evidencia en datos: 2 teléfonos duplicados en `users`.**
> **La identidad real es el email**, no el teléfono.

### 3.5 `pulse_pledges`

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `group_id` | uuid | NO | — |
| `auth_id` | uuid | NO | — |
| `quantity` | integer | NO | `1` |
| `tier_price` | numeric | NO | — |
| `status` | `pulse_status` | NO | `'watching'` |
| `stripe_customer_id` / `stripe_payment_method_id` / `stripe_setup_intent_id` / `stripe_payment_intent_id` | text | SÍ | — |
| `buyer_name` / `buyer_email` / `buyer_phone` | text | SÍ | — |
| `shipping` | jsonb | SÍ | — |
| `accepted_at` / `triggered_at` | timestamptz | SÍ | — |
| `created_at` | timestamptz | NO | `now()` |
| `reachable_notified_at` | timestamptz | SÍ | — |
| `reachable_notified_price` | numeric | SÍ | — |

**Constraints:** `pulse_pledges_pkey` ·
`pulse_pledges_group_id_fkey → groups(id) ON DELETE CASCADE` ·
`pulse_pledges_auth_id_fkey → auth.users(id) ON DELETE CASCADE` ·
`pulse_pledges_quantity_check CHECK (quantity >= 1 AND quantity <= 10)` ·
`pulse_pledges_tier_price_check CHECK (tier_price > 0)`

**Índices:**
- `pulse_pledges_pkey`
- `pulse_pledges_group_status (group_id, status)`
- **`pulse_pledges_one_live` UNIQUE (group_id, auth_id) WHERE status IN ('watching','accepted','holding')**
  ← un solo compromiso vivo por usuario y grupo

**RLS:** habilitada.

| Política | Cmd | Roles | USING |
|---|---|---|---|
| `pulse_pledges_owner_select` | SELECT | `authenticated` | `auth.uid() = auth_id` |

Sin INSERT/UPDATE/DELETE → todas las escrituras van por RPC `service_role`.

> Nota: `pulse_pledges` cuelga de **`auth.users`**, no de `public.users`. Ver §7.

### 3.6 `favorites`

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| `auth_id` | uuid | NO | — |
| `group_id` | uuid | NO | — |
| `created_at` | timestamptz | NO | `now()` |

**Constraints:** `favorites_pkey (auth_id, group_id)` ·
`favorites_auth_id_fkey → auth.users(id) ON DELETE CASCADE` ·
`favorites_group_id_fkey → groups(id) ON DELETE CASCADE`
**Índices:** `favorites_pkey` · `idx_favorites_auth_id (auth_id)`
**RLS:** habilitada, **3 políticas**:

| Política | Cmd | USING / CHECK |
|---|---|---|
| `Users read own favorites` | SELECT | `auth.uid() = auth_id` |
| `Users insert own favorites` | INSERT | CHECK `auth.uid() = auth_id` |
| `Users delete own favorites` | DELETE | `auth.uid() = auth_id` |

> **Es la única tabla con RLS realmente funcional para el cliente.** `toggleFavorite`
> (`src/app/favoritos/actions.ts`) usa el cliente **autenticado**, no `supabaseAdmin`, y por
> tanto respeta estas políticas.

### 3.7 `events`

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `group_id` | uuid | SÍ | — |
| `type` | `event_type` | NO | — |
| `payload` | jsonb | SÍ | — |
| `created_at` | timestamptz | NO | `now()` |

**Constraints:** `events_pkey` · `events_group_id_fkey → groups(id) ON DELETE CASCADE`
**Índices:** `events_pkey` · `idx_events_group (group_id, created_at DESC)`
**RLS:** habilitada.

| Política | Cmd | Roles | USING |
|---|---|---|---|
| `allow_select_events_public_types` | SELECT | `anon`, `authenticated` | `type <> 'petition_created'` |

> 📡 **Es el canal de Realtime del frontend.** `src/hooks/useTierDemand.ts:38-46` se suscribe a
> `postgres_changes` INSERT sobre `public.events` filtrado por `group_id`, y refetchea la
> escalera ante `member_joined` o `price_dropped`. Esta política pública es **lo que hace que
> Realtime funcione para usuarios anónimos**.
> La exclusión de `petition_created` evita filtrar quién pidió qué.

### 3.8 `user_addresses`

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `user_id` | uuid | NO | — |
| `label` | text | SÍ | — |
| `line1` | text | **NO** | — |
| `line2` / `city` / `province` / `postal_code` | text | SÍ | — |
| `country` | text | NO | `'España'` |
| `is_default` | boolean | NO | `false` |
| `created_at` | timestamptz | NO | `now()` |

**Constraints:** `user_addresses_pkey` únicamente
**Índices:** `user_addresses_pkey` · `idx_user_addresses_user (user_id)`
**RLS:** habilitada, cero políticas.

> ⚠️ **`user_id` NO tiene foreign key a `users`.**
> ⚠️ Escrita por `confirm_join` (sync automático desde el checkout) y por las RPC `address_*`
> — **estas últimas accesibles por `anon` con (teléfono, email)**. Ver `SECURITY.md` P0-02.

### 3.9 `user_radar_prefs`

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| `user_id` | uuid | NO | — (PK) |
| `categories` | text[] | NO | `'{}'` |
| `max_price` | numeric | SÍ | — |
| `updated_at` | timestamptz | NO | `now()` |

**Constraints:** `user_radar_prefs_pkey (user_id)` únicamente. **Sin FK.**
**RLS:** habilitada, cero políticas.

> ⚠️ `categories` **no tiene nada que la alimente**: no existe columna `category` en `groups`.
> Ver `TECHNICAL_DEBT.md` DT-11.

### 3.10 `rate_limits`

| Columna | Tipo | NULL | Default |
|---|---|---|---|
| `key` | text | NO | — |
| `created_at` | timestamptz | NO | `now()` |

**Constraints:** **ninguna** — 🔴 **la tabla NO tiene primary key.**
**Índices:** `rate_limits_key_created_idx (key, created_at)`
**RLS:** habilitada, cero políticas.

> ⚠️ `check_rate_limit` solo purga la ventana **de la clave consultada**
> (`DELETE ... WHERE key = p_key AND created_at < ...`). Las claves que no se vuelven a
> consultar (IPs de un solo uso) **nunca se borran** → crecimiento monótono.
> Ver `KNOWN_ISSUES.md` P2-03.

---

## 4. FUNCIONES — DATABASE PRODUCTION

**21 funciones en `public`. Ninguna sobrecarga duplicada** (verificado en `pg_proc`).

| Función | Firma | SecDef | Volat. | anon | auth | svc |
|---|---|---|---|---|---|---|
| `compute_price` | `(uuid,integer,numeric)` | ✅ | s | **✅** | **✅** | ✅ |
| `tier_demand` | `(uuid)` | ✅ | s | **✅** | **✅** | ✅ |
| `compute_price_at_n` | `(jsonb,text,integer)` | ❌ | i | **✅** | **✅** | ✅ |
| `prepare_join` | `(uuid,text,integer)` | ✅ | v | ❌ | ❌ | ✅ |
| `confirm_join` | `(text,uuid,text,text,text,integer,numeric,numeric,jsonb,text,numeric)` | ✅ | v | ❌ | ❌ | ✅ |
| `close_group` | `(uuid)` | ✅ | v | ❌ | ❌ | ✅ |
| `check_rate_limit` | `(text,integer,integer)` | ✅ | v | ❌ | ❌ | ✅ |
| `pulse_state` | `(uuid)` | ✅ | s | ❌ | ❌ | ✅ |
| `pulse_check_and_lock` | `(uuid)` | ✅ | v | ❌ | ❌ | ✅ |
| `pulse_pledge_upsert` | `(uuid,uuid,integer,numeric)` | ✅ | v | ❌ | ❌ | ✅ |
| `pulse_pledge_cancel` | `(uuid,uuid)` | ✅ | v | ❌ | ❌ | ✅ |
| `_profile_uid` | `(text,text)` | ✅ | v | ❌ | ❌ | ✅ |
| `get_my_groups` | `(text,text)` | ✅ | v | **🔴 ✅** | **🔴 ✅** | ✅ |
| `get_profile` | `(text,text)` | ✅ | v | **🔴 ✅** | **🔴 ✅** | ✅ |
| `address_add` | `(text,text,text,text,text,text,text,text)` | ✅ | v | **🔴 ✅** | **🔴 ✅** | ✅ |
| `address_update` | `(text,text,uuid,text,text,text,text,text,text)` | ✅ | v | **🔴 ✅** | **🔴 ✅** | ✅ |
| `address_delete` | `(text,text,uuid)` | ✅ | v | **🔴 ✅** | **🔴 ✅** | ✅ |
| `address_set_default` | `(text,text,uuid)` | ✅ | v | **🔴 ✅** | **🔴 ✅** | ✅ |
| `radar_prefs_save` | `(text,text,text[],numeric)` | ✅ | v | **🔴 ✅** | **🔴 ✅** | ✅ |
| `create_petition` | `(text,text,text,integer,text,text,text)` | ✅ | v | ✅ | ✅ | ✅ |
| `handle_new_auth_user` | `()` → trigger | ✅ | v | ✅ | ✅ | ✅ |

🔴 = combinación peligrosa (`SECURITY DEFINER` + ejecutable por `anon` + identidad resuelta por
teléfono+email). Ver `SECURITY.md`.

**Funciones money-critical correctamente blindadas** (`anon=false`, `authenticated=false`):
`prepare_join`, `confirm_join`, `close_group`, `check_rate_limit`, las cuatro `pulse_*`,
`_profile_uid`. ✅ Verificado con `has_function_privilege`.

**`compute_price` y `tier_demand` están abiertas a `anon` DELIBERADAMENTE** — el frontend las
usa para el precio en vivo. Solo devuelven escalares y agregados; no exponen filas de
`group_members` ni identidades.

### Funciones que YA NO EXISTEN
- **`join_group(uuid,text,text,text,integer)`** — la vía legada de unirse sin tarjeta.
  El fichero `supabase/revoke_join_group.sql` todavía la referencia, pero **la función no está
  en `pg_proc`**: fue eliminada, no solo revocada.

### Triggers
**Cero triggers en el esquema `public`.**
`handle_new_auth_user()` es un trigger sobre **`auth.users`** (esquema de Supabase Auth), fuera
de `public`. Vincula por email un `public.users` existente
(`UPDATE ... SET auth_id = NEW.id WHERE email = NEW.email AND auth_id IS NULL`) o crea uno nuevo.
❓ **UNKNOWN:** el trigger en sí no se ha inspeccionado en `auth.pg_trigger` (esquema no
consultado); solo su función.

---

## 5. RELACIONES

```
auth.users (Supabase Auth)
   │  1:1  users.auth_id UNIQUE + FK
   ▼
 users ──1:N──► group_members ──N:1──► groups ──1:N──► bids ──N:1──► users (role='seller')
   │                                     │  ▲
   │                                     │  └─ winner_bid_id (uuid, SIN FK)
   │ 1:N (SIN FK)                        │
   ▼                                     ├──1:N──► events
 user_addresses                          │
 user_radar_prefs (SIN FK)               ├──1:N──► pulse_pledges ──N:1──► auth.users
                                         └──1:N──► favorites ────────N:1──► auth.users
```

**Cascadas ON DELETE:**
- `groups` → `bids`, `group_members`, `events`, `pulse_pledges`, `favorites` (todas CASCADE).
- `auth.users` → `favorites`, `pulse_pledges` (CASCADE).
- `users` → `bids.seller_id`, `group_members.user_id`: **sin cascade** → no se puede borrar un
  `users` con historial.
- `user_addresses` y `user_radar_prefs`: **sin FK** → no se limpian solas.

---

## 6. IDENTIDAD DUAL — el hecho de modelado más importante

Hay **dos identidades paralelas** que conviven:

| | Identidad de COMPRA | Identidad de SESIÓN |
|---|---|---|
| Tabla | `public.users` | `auth.users` |
| Clave | `email` (UNIQUE) | id de Supabase Auth |
| Se crea | en `confirm_join`, **sin necesidad de login** (checkout de invitado) | al registrarse (Google OAuth o magic link) |
| Cuelgan de ella | `group_members`, `bids`, `user_addresses`, `user_radar_prefs` | `favorites`, `pulse_pledges` |
| Puente | `users.auth_id` (UNIQUE, FK) — lo rellena `handle_new_auth_user()` |

**Consecuencias verificadas:**
- Un comprador invitado tiene `users` sin `auth_id`. Si luego se registra con el mismo email, el
  trigger "adopta" la fila y su historial aparece.
- **`get_my_groups` y las RPC `address_*` resuelven identidad por (teléfono, email)** porque el
  comprador de invitado no tiene sesión. **Ese es el origen de la vulnerabilidad P0-02.**
- El propio fichero `supabase/profile_identity.sql` documenta el problema y la solución parcial
  (`_profile_uid` prioriza el JWT cuando existe, y cae a teléfono+email **solo para llamadas
  anónimas, por retrocompatibilidad de páginas públicas SSR**).

---

## 7. ESTADO REAL DE LOS DATOS (6-sep-2026)

| Métrica | Valor |
|---|---|
| Grupos | **1** — `TEST · Algoritmo precio`, `status='open'`, `is_demo=false` |
| Grupos cerrados o cancelados | **0** |
| Pujas | **1** (`active`). Máximo de pujas activas en un grupo: **1** |
| `group_members` | **15**, **todos en `authorized`** (5 `comprar`, 10 `esperar`) |
| `pulse_pledges` | **0** |
| `favorites` | 1 |
| `users` | 151 (124 `buyer`, 26 `seller`, 1 `admin`) |
| `events` | 15 `member_joined`, 2 `price_dropped`, **0 `group_closed`** |
| **Teléfonos duplicados en `users`** | **2** 🔴 |
| **Pares `(group_id,user_id)` duplicados en `group_members`** | **2** 🔴 |

Detalle del único grupo:
```
tiers = [{1,100},{5,80},{10,60},{20,45}]   price_mode = stepped
min_execution = 3   max_stock = 50   pvp = 120
total_units = 12    current_price = 60    next_price = 45
closes_at = 2026-09-08 13:23:05 UTC
```

> ⚠️ Ese `closes_at` (martes 13:23 UTC) **no** sigue la regla de cierre dominical a las 22:00
> Madrid: es un grupo creado programáticamente para pruebas.
> **No existe ningún grupo real, ni ningún grupo cerrado, en la base de datos.**
> Los 10 grupos DEMO documentados en `CLAUDE.md` **ya no existen** (fueron borrados).

---

## 8. AVISOS DEL LINTER DE SUPABASE (`get_advisors`, 6-sep-2026)

| Nivel | Aviso | Afecta a |
|---|---|---|
| INFO | `rls_enabled_no_policy` | `bids`, `group_members`, `users`, `user_addresses`, `user_radar_prefs`, `rate_limits` — **es intencionado** en este diseño |
| WARN | `function_search_path_mutable` | `compute_price_at_n` (función muerta) |
| WARN | `anon_security_definer_function_executable` | `address_add`, `address_delete`, `address_set_default`, `address_update`, `compute_price`, `create_petition`, `get_my_groups`, `get_profile`, `handle_new_auth_user`, `radar_prefs_save`, `tier_demand` |
| WARN | `authenticated_security_definer_function_executable` | las mismas |
| WARN | `auth_leaked_password_protection` | **desactivada** en Supabase Auth |

De la lista de `anon_security_definer`, **`compute_price` y `tier_demand` son aceptables por
diseño** (solo agregados). Las demás requieren revisión — ver `SECURITY.md`.

---

## 9. DATABASE REPOSITORY — los ficheros `supabase/*.sql`

**13 ficheros. No son migraciones. No hay orden ni numeración. Varios están desfasados.**

| Fichero | Líneas | ¿Coincide con producción? | Nota |
|---|---|---|---|
| `compute_price.sql` | 77 | 🔴 **NO** | 2 args, single-bid. Ver `ALGORITHM.md` §1 |
| `tier_demand.sql` | ~50 | 🔴 **NO** | single-bid, sin fusión |
| `prepare_join.sql` | 155 | 🔴 **NO + CORRUPTO** | línea 78: `$function$;R REPLACE FUNCTION`, cuerpo duplicado, **no parsea** |
| `confirm_join.sql` | 162 | 🔴 **NO** | contiene el check de duplicado que producción **ya no tiene** |
| `close_group.sql` | 165 | 🔴 **NO** | v1 single-bid, sin PMA universal |
| `get_my_groups.sql` | 66 | 🔴 **NO** | define `get_my_groups(p_phone)` — **1 argumento**; producción tiene 2 |
| `create_petition.sql` | 80 | 🔴 **NO** | v1; producción es v3 (anti-spam 5/h + upsert no destructivo con `COALESCE`) |
| `revoke_join_group.sql` | 22 | 🔴 **Obsoleto** | revoca `join_group(uuid,text,text,text,integer)`, **función que ya no existe** |
| `profile_identity.sql` | 173 | ⚠️ **Coherente en estructura** | define `_profile_uid`, `get_profile`, `address_*`. Su cabecera **documenta la vulnerabilidad P0-02 y la decisión de dejar el fallback anónimo** |
| `shipping_columns.sql` | 8 | ✅ | DDL aditivo idempotente; las columnas están en producción |
| `event_type_add_petition_created.sql` | 15 | ✅ | DDL aditivo idempotente; el valor está en el enum |
| `seed.sql` | 140 | n/a | siembra manual |
| `seed_groups.sql` | 131 | n/a | siembra manual |
| `test_close_group.sql` | 198 | n/a | script de prueba manual |
| `Archivos a guardar/add_stripe_payment_fields.sql` | — | n/a | backup local, gitignored |

> 🔴 **Reconstruir la base de datos aplicando estos ficheros produciría un sistema
> funcionalmente distinto y peor:** single-bid, con checks de duplicado que ya no existen, con
> `get_my_groups` de 1 argumento (rompería `/api/my-groups`), con `create_petition` sin
> anti-spam, y con un fichero que ni siquiera parsea.

---

## 10. CÓMO CONSULTAR EL ESTADO REAL

Comandos seguros (solo lectura) para verificar el esquema desde cualquier cliente SQL con acceso
al proyecto:

```sql
-- Definición real de una función
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = '<nombre>';

-- Sobrecargas y permisos
SELECT p.oid::regprocedure AS firma,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
       has_function_privilege('service_role',  p.oid, 'EXECUTE') AS svc
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = '<nombre>';

-- Constraints de una tabla
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint WHERE conrelid = 'public.<tabla>'::regclass;

-- Índices
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = '<tabla>';

-- RLS y políticas
SELECT c.relname, c.relrowsecurity, pol.polname, pol.polcmd::text,
       pg_get_expr(pol.polqual, pol.polrelid)     AS using_expr,
       pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy pol ON pol.polrelid = c.oid
WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1;

-- Detectar duplicados conocidos
SELECT group_id, user_id, count(*) FROM group_members GROUP BY 1,2 HAVING count(*) > 1;
SELECT phone, count(*) FROM users WHERE phone IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
```

> ⚠️ Tras **cualquier** `CREATE OR REPLACE` con firma distinta se crea una **SOBRECARGA**, no un
> reemplazo. Tras **cualquier** `DROP + CREATE` los permisos vuelven a `PUBLIC EXECUTE`.
> Re-verificar siempre con las dos primeras consultas.
