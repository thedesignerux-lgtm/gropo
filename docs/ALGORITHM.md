# ALGORITHM.md — Gropo

> **Fuente de verdad del motor de precios, adjudicación y cierre.**
> Auditado el **6 de septiembre de 2026** contra la base de datos de producción
> `xpktkuozspreuxucnguh` mediante `pg_get_functiondef`, `has_function_privilege` y `pg_proc`,
> y contra el repositorio en `main @ 7c49ef3`.
>
> **REGLA DE ESTE DOCUMENTO:** cuando la función desplegada en producción no coincide con el
> SQL del repositorio, **PRODUCTION IMPLEMENTATION = SOURCE OF TRUTH**. La versión del
> repositorio se documenta bajo `REPOSITORY` y se marca como `HISTORICAL`.
> Ver jerarquía completa en `PROJECT_KNOWLEDGE_PACK.md` § SOURCE OF TRUTH.

---

## 0. RESUMEN EJECUTIVO DEL ALGORITMO

```
Demanda efectiva a un precio P
  = Σ quantity de miembros VIVOS cuyo PMA ≥ P

Precio vigente
  = el tramo más barato (de la unión de tramos de todas las pujas activas)
    cuya demanda efectiva alcanza su min_units
  = si ninguno lo alcanza → el tramo base (menor min_units)

Precio de cierre (settlement)
  = el settlement de la puja ganadora, donde ganadora = primera por
    (elegible DESC, settlement ASC, created_at ASC)

Adjudicación
  = miembros vivos con PMA ≥ settlement, por join_order ascendente,
    mientras la suma acumulada ≤ max_stock de la puja ganadora

Todos los adjudicados pagan el MISMO settlement.
```

**Definición de "miembro VIVO" — constante que se repite en todo el motor:**
```sql
payment_status IN ('authorized','instructed','paid')
```

**Definición de PMA (precio máximo aceptado) — ⚠️ NO ES UNIFORME:**

| Contexto | `join_mode = 'comprar'` | `join_mode = 'esperar'` |
|---|---|---|
| `compute_price` (precio en vivo) | **∞** (cuenta a todos los precios) | `target_price` |
| `tier_demand` (escalera pública) | **∞** | `target_price` |
| `pulse_state` (vía `tier_demand`) | **∞** | `target_price` |
| **`close_group` (adjudicación)** | **`guaranteed_price`** | `target_price` |

> 🔴 **Esta asimetría es deliberada y es la sutileza más peligrosa del sistema.**
> Ver §4 (ADR-09) y `BUSINESS_RULES.md` RULE-009.

---

## 1. `compute_price`

### FILE / DATABASE FUNCTION
`public.compute_price` — **función de base de datos**.

### VERSION
**v3.1** (según `CLAUDE.md`, última modificación 21 jul 2026).

### SOURCE
`pg_get_functiondef` sobre producción, 6-sep-2026. **CURRENT PRODUCTION.**

```
SIGNATURE : compute_price(p_group_id uuid, p_extra_units integer DEFAULT 0,
                          p_extra_target numeric DEFAULT NULL)
RETURNS   : TABLE(best_price numeric, best_bid_id uuid, next_price numeric)
LANGUAGE  : plpgsql
VOLATILITY: STABLE
SECURITY  : DEFINER, SET search_path TO 'public'
GRANTS    : anon=TRUE  authenticated=TRUE  service_role=TRUE   (verificado en vivo)
OVERLOADS : 1 (ninguna sobrecarga duplicada — verificado en pg_proc)
```

### INPUTS
| Parámetro | Tipo | Significado |
|---|---|---|
| `p_group_id` | uuid | Grupo a evaluar |
| `p_extra_units` | integer (def. 0) | Unidades hipotéticas a añadir a la demanda ("¿qué pasa si entro yo con N?") |
| `p_extra_target` | numeric (def. NULL) | PMA de esas unidades hipotéticas. **NULL = comprador "ahora"** (cuentan en todos los tramos). Con valor = esperador (cuentan solo donde `precio_tramo ≤ p_extra_target`) |

### OUTPUTS
| Campo | Significado |
|---|---|
| `best_price` | Precio por unidad vigente |
| `best_bid_id` | Puja que aporta ese precio (o la del tramo base) |
| `next_price` | **Siguiente escalón REAL por debajo** del vigente. **NULL si el vigente ya es el más barato de toda la escalera** |

**Cero filas** si el grupo no tiene ninguna puja `active`.

### ALGORITHM (producción, literal)

```sql
-- (1) Guard
IF NOT EXISTS (SELECT 1 FROM bids b WHERE b.group_id = p_group_id AND b.status = 'active')
  THEN RETURN;   -- cero filas
END IF;

-- (2) live: miembros vivos
live := SELECT join_mode, target_price, quantity FROM group_members
        WHERE group_id = p_group_id
          AND payment_status IN ('authorized','instructed','paid');

-- (3) tiers: TODOS los tramos de TODAS las pujas activas  ← soporte multi-puja
tiers := SELECT b.id AS bid_id, b.created_at AS bid_created_at,
                (elem->>'min_units')::int, (elem->>'price')::numeric
         FROM bids b, jsonb_array_elements(b.tiers) AS elem
         WHERE b.group_id = p_group_id AND b.status = 'active';

-- (4) demanda por (puja, tramo)
tier_demand := SELECT t.*,
   COALESCE((SELECT SUM(l.quantity) FROM live l
             WHERE l.join_mode = 'comprar' OR l.target_price >= t.price), 0)
   + CASE WHEN p_extra_target IS NULL OR p_extra_target >= t.price
          THEN p_extra_units ELSE 0 END   AS base_demand
   FROM tiers t;

-- (5) tramo base (suelo)
base_tier := SELECT bid_id, price FROM tiers
             ORDER BY min_units ASC, price ASC, bid_created_at ASC LIMIT 1;

-- (6) tramo ganador
best := SELECT price, bid_id FROM tier_demand
        WHERE base_demand >= min_units
        ORDER BY price ASC, bid_created_at ASC LIMIT 1;

-- (7) salida
best_price  := COALESCE(best.price,  base_tier.price);
best_bid_id := COALESCE(best.bid_id, base_tier.bid_id);
next_price  := (SELECT MAX(t.price) FROM tiers t WHERE t.price < best_price);
```

### BUSINESS RULES implementadas
- RULE-010 (el precio publicado nunca sube al crecer la demanda) — parcialmente; la garantía
  fuerte de monotonía la aporta `tier_demand` (§2).
- RULE-012 (a igual precio gana la puja más antigua) — `ORDER BY ... bid_created_at ASC`.
- La definición de PMA en vivo: `comprar` = ∞.

### SIDE EFFECTS
**Ninguno.** `STABLE`, no escribe.

### CALLERS (verificados por búsqueda exhaustiva)

**SQL:**
| Función | Uso |
|---|---|
| `prepare_join` | ×2 — `best_bid_id` (validación) y `best_price` con `p_extra_units` (cálculo de `guaranteed_price`) |
| `confirm_join` | ×3 — `best_bid_id`, precio previo, precio nuevo + `next_price` |

**TypeScript:**
| Fichero | Uso |
|---|---|
| `src/app/api/group/[id]/quote/route.ts:17` | los 3 argumentos (`units`, `target`) |
| `src/app/grupo/[id]/page.tsx:28` | SSR ficha |
| `src/app/grupo/[id]/unirme/page.tsx:18` | SSR checkout |
| `src/app/grupo/[id]/unido/page.tsx:17` | SSR post-checkout |
| `src/app/admin/grupos/actions.ts:211` | `addBidToGroup` → refrescar caché |
| `src/app/admin/grupos/[id]/actions.ts:184` | `withdrawBid` → check de seguridad |

> ⚠️ **`close_group` NO llama a `compute_price`.** La v2 calcula su propio settlement por
> candidata. Ver §4.

### DEPENDENCIES
Tablas `bids` (`status`, `tiers`, `created_at`, `group_id`) y `group_members`
(`payment_status`, `join_mode`, `target_price`, `quantity`, `group_id`).

### EDGE CASES

| Caso | Comportamiento verificado |
|---|---|
| Sin pujas `active` | Cero filas. Los llamantes SSR caen a `groups.current_price`; `prepare_join` lanza `'No hay puja activa en este grupo'`; `confirm_join` devuelve `needs_release/no_bid` |
| `bids.tiers = '[]'::jsonb` | `tiers` vacío → `base_tier` vacío → **`best_price` = NULL**. **No hay guard.** Solo lo previene `validateBidFields` en el admin. `close_group` con settlement NULL tendría comportamiento indefinido |
| Todos los miembros son esperadores con target por debajo del tramo base | `base_demand` = 0 en todos → devuelve el tramo base (precio más caro) |
| Precio idéntico en dos pujas distintas | Gana la puja con `created_at` menor |
| `p_extra_units` supera el stock | La función **no conoce el stock**. El guard vive en `prepare_join`/`confirm_join` |
| El vigente ya es el tramo más barato | `next_price` = **NULL** |
| Un miembro vivo se cancela/libera | La demanda baja → **el precio puede SUBIR**. Nada lo impide |

### CONCURRENCY CONCERNS
Ninguna propia (es `STABLE`, sin escritura). **Pero:** cuando la llaman `confirm_join` o
`prepare_join`, la coherencia depende del `FOR UPDATE` sobre `groups` que toma `confirm_join`.
Dos lecturas concurrentes sin ese lock pueden ver estados distintos — es aceptable para display,
**no** para decisiones de stock.

### REPOSITORY
`supabase/compute_price.sql`.

```
SIGNATURE: compute_price(p_group_id uuid, p_extra_units integer DEFAULT 0)   ← 2 ARGUMENTOS
```
Cabecera del fichero: *"Definicion VIVA sincronizada desde produccion (pg_get_functiondef) el
22 jun 2026"*.

### HISTORICAL
La versión del repositorio (22 jun 2026):
- Selecciona **UNA sola puja** (`ORDER BY b.created_at ASC LIMIT 1`) → **sin multi-puja**.
- **No tiene `p_extra_target`** → no puede simular a un esperador.
- `next_price` = *"lo mismo, sumando 1 comprador 'ahora' más"* → **semántica v1**.

### DISCREPANCIES 🔴

| # | Repositorio (HISTORICAL) | Producción (ACTUAL) |
|---|---|---|
| 1 | 2 argumentos | **3 argumentos** (`p_extra_target`) |
| 2 | Una sola puja | **Todas las pujas activas fusionadas** |
| 3 | `next_price` = precio si entra 1 comprador más | **`next_price` = siguiente escalón real; NULL si no hay** |
| 4 | Sin `SET search_path` | **`SET search_path TO 'public'`** |

**Consecuencia #3 no corregida en la UI:** los copys de compartir siguen diciendo
*"Si entra 1 más baja a X €"*, lo cual es **falso** cuando faltan varias unidades.
Afecta a `src/components/HeroShareButton.tsx:16` (**vivo**), y a
`src/components/ShareButton.tsx:18` y `src/components/desktop/GroupSidebar.tsx:82`
(**ambos huérfanos**, ver `TECHNICAL_DEBT.md`).

---

## 2. `tier_demand`

### FILE / DATABASE FUNCTION
`public.tier_demand` — función de base de datos.

### VERSION
v2 (fusión multi-puja con mínimo acumulado). Sin número de versión propio en el código.

### SOURCE
`pg_get_functiondef` sobre producción. **CURRENT PRODUCTION.**

```
SIGNATURE : tier_demand(p_group_id uuid)
RETURNS   : TABLE(min_units integer, price numeric, effective_demand bigint, unlocked boolean)
VOLATILITY: STABLE · SECURITY DEFINER · SET search_path TO 'public'
GRANTS    : anon=TRUE  authenticated=TRUE  service_role=TRUE
ORDER     : price DESC (del más caro al más barato)
```

### INPUTS / OUTPUTS
Entrada: el grupo. Salida: la **escalera pública fusionada**, un escalón por precio distinto.

### ALGORITHM (producción, literal)

```sql
IF NOT EXISTS (pujas active) THEN RETURN; END IF;

live      := miembros vivos (igual que compute_price)
all_tiers := (mu, pr) de TODAS las pujas activas
steps     := SELECT DISTINCT mu FROM all_tiers
fused     := para cada s ∈ steps:
               f_price = (SELECT MIN(t.pr) FROM all_tiers t WHERE t.mu <= s.mu)
                         ← MÍNIMO ACUMULADO
dedup     := SELECT MIN(f_min_units), f_price FROM fused GROUP BY f_price
             ← colapsa escalones con precio idéntico al más barato de alcanzar
d         := para cada escalón:
               eff = Σ quantity de vivos con (join_mode='comprar' OR target_price >= f_price)
SELECT f_min_units, f_price, eff, eff >= f_min_units AS unlocked
ORDER BY f_price DESC;
```

### BUSINESS RULES implementadas
- **RULE-010 — monotonía:** el mínimo acumulado garantiza que la curva publicada **nunca sube**
  al crecer las unidades, aunque una puja se quede sin stock a niveles superiores (ADR-08).
- **RULE-014 — opacidad (D5):** es la **única** superficie pública de tramos. No devuelve
  `bid_id` ni `seller_id`.

### SIDE EFFECTS
Ninguno.

### CALLERS

**SQL:**
- `pulse_state(uuid)` → construye toda la escalera del Pulse sobre ella.
- `pulse_pledge_upsert(...)` → valida que el tramo elegido exista y no esté desbloqueado.

**TypeScript:**
- `src/app/api/group/[id]/tier-demand/route.ts:11` → `useTierDemand` → toda la UI de tramos.
- `src/app/api/join/create-intent/route.ts:60` → **validación del `target_price` del hold**.
- `src/app/api/checkout/lock/route.ts:67` → ídem.
- `src/app/page.tsx:39` → una llamada **por cada grupo** de la home.
- `src/app/grupo/[id]/page.tsx:37`, `src/app/grupo/[id]/unirme/page.tsx:26` → SSR.
- `src/components/desktop/MisGruposDesktop.tsx:97` → **desde el navegador con la clave anon**.

> 🔴 **`tier_demand` está en el camino del dinero por dos vías:** (a) valida el `target_price`
> con el que se calcula el importe del hold; (b) alimenta `pulse_state` → `fireable` →
> `pulse_check_and_lock` → **cargos off-session reales**.

### DEPENDENCIES
`bids`, `group_members`.

### EDGE CASES
| Caso | Comportamiento |
|---|---|
| Sin pujas activas | Cero filas → la UI muestra escalera vacía; `create-intent` rechaza el target con *"No se pudo validar el precio objetivo"* |
| Dos pujas con el mismo precio en escalones distintos | `dedup` los colapsa en el `min_units` menor |
| Una puja barata solo válida hasta cierto `max_stock` | **`tier_demand` NO consulta `max_stock`.** Publica el precio igualmente (ADR-08). La cobertura la garantiza la adjudicación |
| `min_execution` | **NO filtra la curva.** Es condición de adjudicación, no de precio |

### CONCURRENCY CONCERNS
Ninguna propia. Al usarse para validar el `target_price` en `create-intent`, existe una ventana
teórica entre la validación y la creación del PaymentIntent en la que la escalera podría cambiar
(p. ej. si el admin añade una puja). El impacto es acotado: la fusión solo baja precios, y
`close_group` reevalúa todo al cierre.

### REPOSITORY
`supabase/tier_demand.sql`.

### HISTORICAL
La versión del repositorio lee **una sola puja**
(`WHERE b.group_id = ... AND b.status='active' ORDER BY b.created_at ASC LIMIT 1`) y devuelve
sus tramos tal cual, **sin fusión, sin mínimo acumulado y sin dedup**.

### DISCREPANCIES 🔴
| Repositorio (HISTORICAL) | Producción (ACTUAL) |
|---|---|
| Una puja | **Todas las pujas activas** |
| Sin mínimo acumulado | **`MIN(price) WHERE mu <= s`** |
| Sin dedup por precio | **`GROUP BY f_price`** |
| Sin `SET search_path` | **`SET search_path TO 'public'`** |

---

## 3. `prepare_join`

### FILE / DATABASE FUNCTION
`public.prepare_join` — función de base de datos.

### VERSION
Sin versión declarada. **La versión viva difiere del fichero en dos puntos sustantivos.**

### SOURCE
`pg_get_functiondef` sobre producción. **CURRENT PRODUCTION.**

```
SIGNATURE : prepare_join(p_group_id uuid, p_phone text, p_quantity integer)
RETURNS   : json
SECURITY  : DEFINER · SET search_path TO 'public'
GRANTS    : anon=FALSE  authenticated=FALSE  service_role=TRUE   ← BLINDADA (verificado)
```

### INPUTS
grupo, teléfono en crudo, cantidad.

### OUTPUTS
```json
{ "phone": "<normalizado>", "guaranteed_price": <numeric>,
  "best_bid_id": "<uuid>", "product_name": "...", "product_spec": "..." }
```
O **excepción** con mensaje en castellano, que `create-intent` reenvía al usuario con HTTP 400.

### ALGORITHM (producción, en orden)

```
1. IF p_quantity < 1 OR p_quantity > 10
      → RAISE 'Cantidad debe ser entre 1 y 10'
2. Cargar grupo; IF NOT FOUND OR status <> 'open'
      → RAISE 'Grupo no disponible'
3. Normalizar teléfono: quitar [\s\-\.] y prefijo ^\+34
   IF NOT ~ '^[679][0-9]{8}$'
      → RAISE 'Teléfono no válido (formato español: 9 dígitos empezando por 6, 7 o 9)'
4. Rate limit: COUNT(group_members JOIN users) con u.phone = v_phone
   AND gm.created_at > now() - interval '1 hour'  >= 3
      → RAISE 'Demasiados intentos, espera un momento'
5. SELECT best_bid_id FROM compute_price(p_group_id)
   IF NULL → RAISE 'No hay puja activa en este grupo'
6. v_max_stock := bids.max_stock de esa puja
7. v_committed_units := Σ quantity de miembros VIVOS del grupo
                        (sin filtrar por modo ni por precio)
   IF v_committed_units + p_quantity > v_max_stock
      → RAISE 'Stock insuficiente: solo quedan % unidades disponibles',
              GREATEST(v_max_stock - v_committed_units, 0)
8. v_guaranteed_price := compute_price(p_group_id, p_quantity).best_price
   ← PRECIO PROYECTADO incluyendo sus propias unidades
9. RETURN json
```

### BUSINESS RULES implementadas
RULE-001 (1–10), RULE-002 (teléfono ES), RULE-003 (3/hora), RULE-005 (grupo `open`),
RULE-007 (no vender por encima de `max_stock`).

### SIDE EFFECTS
**Ninguna escritura.** Solo lecturas y excepciones.

### CALLERS
- `src/app/api/join/create-intent/route.ts:35`
- `src/app/api/checkout/lock/route.ts:52`

### DEPENDENCIES
`groups`, `group_members`, `users`, `bids`, `compute_price`.

### EDGE CASES
| Caso | Comportamiento |
|---|---|
| Teléfono con `+34`, espacios, guiones o puntos | Se normaliza antes de validar |
| Teléfono fijo que empieza por 9 | **Aceptado** (el regex permite `[679]`) |
| Stock justo agotado por otro comprador concurrente | Puede pasar el check aquí y ser rechazado luego en `confirm_join` bajo `FOR UPDATE` → hold liberado. **Comportamiento correcto y esperado** |
| Grupo sin `max_stock` | Imposible: la columna es `NOT NULL` |
| El usuario YA es miembro del grupo | 🔴 **NO SE DETECTA** — ver DISCREPANCIES |

### CONCURRENCY CONCERNS
🔴 **`prepare_join` NO toma ningún lock.** Su guard de stock es una foto sin garantías.
La correctitud real la aporta `confirm_join`, que repite el guard **bajo `FOR UPDATE`**.
`prepare_join` es una **primera línea de defensa optimista**, no una garantía.

### REPOSITORY
`supabase/prepare_join.sql` — **155 líneas**.

> 🔴 **EL FICHERO ESTÁ CORRUPTO Y NO ES SQL VÁLIDO.**
> En la línea 78 aparece `$function$;R REPLACE FUNCTION public.prepare_join(` — un pegado roto
> que duplica el cuerpo completo de la función. **No parsea. No se puede ejecutar.**

### HISTORICAL
Además de estar corrupto, el cuerpo del fichero difiere de producción:
```sql
-- Dedupe por teléfono dentro del grupo     ← ESTE BLOQUE NO EXISTE EN PRODUCCIÓN
IF EXISTS (
  SELECT 1 FROM group_members gm JOIN users u ON u.id = gm.user_id
  WHERE gm.group_id = p_group_id AND u.phone = v_phone
) THEN RAISE EXCEPTION 'Ya estás en este grupo'; END IF;
```
Y el guard de stock del fichero usa `v_group.total_units` (la columna desnormalizada) en vez de
la suma de unidades comprometidas, y sin `GREATEST`.

### DISCREPANCIES 🔴

| # | Repositorio (HISTORICAL) | Producción (ACTUAL) | Gravedad |
|---|---|---|---|
| 1 | Fichero corrupto, no parsea | Función válida y desplegada | Documental |
| 2 | **Check de duplicado por teléfono** | **ELIMINADO** | 🔴 **Ver `KNOWN_ISSUES.md` P0-01** |
| 3 | Guard de stock con `groups.total_units` | Guard con Σ unidades comprometidas de vivos | Producción es **correcta**; el fichero contiene el bug de overselling ya arreglado |
| 4 | Sin `GREATEST(...)` | `GREATEST(v_max_stock - v_committed_units, 0)` | Evita mostrar negativos |
| 5 | Sin `SET search_path` | `SET search_path TO 'public'` | Seguridad |

> ❓ **UNKNOWN:** no se ha podido determinar si la eliminación del check de duplicado (#2) fue
> deliberada o una regresión. No hay comentario, commit ni documento que lo explique, y el
> `ELSIF v_constraint = 'users_phone_key'` de `confirm_join` sugiere que se pretendía delegar en
> una constraint de base de datos **que nunca se creó** (ver §5 DISCREPANCIES).

---

## 4. `close_group`

### FILE / DATABASE FUNCTION
`public.close_group` — función de base de datos. **La función más crítica del sistema.**

### VERSION
**v2** (multi-puja + PMA universal). El propio cuerpo lleva marcadores `[identico a v1]`,
`(v2)`, `★ G5.2` que documentan qué cambió respecto a v1.

### SOURCE
`pg_get_functiondef` sobre producción. **CURRENT PRODUCTION.**

```
SIGNATURE : close_group(p_group_id uuid)
RETURNS   : jsonb
SECURITY  : DEFINER · SET search_path TO 'public'
GRANTS    : anon=FALSE  authenticated=FALSE  service_role=TRUE   ← BLINDADA (verificado)
```

### INPUTS
El grupo a cerrar.

### OUTPUTS
```json
{"result": "already_closed" | "already_cancelled" | "already_closing"
          | "no_active_bids" | "no_execution" | "closed" | "surplus",
 "settlement_price": …, "total_units": …, "gross_units": …,
 "adjudicated_units": …, "surplus_units": …, "surplus_released": …,
 "winner_bid_id": …, "second_bid_id": …, "second_price_at_n": null,
 "min_required": …}
```

### ALGORITHM (producción, paso a paso)

#### Paso 1 — Lock e idempotencia
```sql
SELECT * INTO v_group FROM groups WHERE id = p_group_id FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Grupo % no encontrado', p_group_id; END IF;
IF v_group.status IN ('closed','cancelled','closing')
   THEN RETURN jsonb_build_object('result', 'already_' || v_group.status); END IF;
```

#### Paso 2 — Marca de proceso
```sql
UPDATE groups SET status = 'closing' WHERE id = p_group_id;
```

#### Paso 3 — Selección de la puja ganadora (v2)
Una única consulta que evalúa **cada puja activa como candidata independiente**, con dos
`CROSS JOIN LATERAL`:

```sql
-- s.settlement — precio de referencia de la candidata b
COALESCE(
  (SELECT MIN((e->>'price')::numeric)
   FROM jsonb_array_elements(b.tiers) e
   WHERE ( SELECT COALESCE(SUM(gm.quantity),0)
           FROM group_members gm
           WHERE gm.group_id = p_group_id
             AND gm.payment_status IN ('authorized','instructed','paid')
             AND (  (gm.join_mode='comprar' AND gm.guaranteed_price >= (e->>'price')::numeric)
                 OR (gm.join_mode='esperar'  AND gm.target_price     >= (e->>'price')::numeric) )
         ) >= (e->>'min_units')::int),
  (SELECT (e->>'price')::numeric FROM jsonb_array_elements(b.tiers) e
   ORDER BY (e->>'min_units')::int ASC, (e->>'price')::numeric ASC LIMIT 1)
) AS settlement

-- d.buying_units — demanda que respalda ese settlement
SELECT COALESCE(SUM(gm.quantity),0) FROM group_members gm
WHERE gm.group_id = p_group_id
  AND gm.payment_status IN ('authorized','instructed','paid')
  AND (  (gm.join_mode='comprar' AND gm.guaranteed_price >= s.settlement)
      OR (gm.join_mode='esperar'  AND gm.target_price     >= s.settlement) )

eligible := COALESCE(d.buying_units,0) >= b.min_execution

-- ranking
ORDER BY eligible DESC, s.settlement ASC, b.created_at ASC LIMIT 1
```

> 🔴 **Aquí aparece el PMA UNIVERSAL:** los compradores `'comprar'` **NO** son PMA=∞.
> Su techo es su `guaranteed_price`. Esto difiere de `compute_price` **a propósito** (ADR-09).

#### Paso 3b — Sin puja activa
```
UPDATE groups SET status='cancelled'
UPDATE group_members SET payment_status='cancelled' WHERE vivo
INSERT events (group_closed / no_active_bids)
RETURN {result:'no_active_bids'}
```

#### Paso 3c — Ninguna candidata elegible → **Regla 6**
```
UPDATE groups SET status='cancelled'
UPDATE group_members SET payment_status='cancelled' WHERE vivo
UPDATE bids SET status='outbid' WHERE status='active'     ← ★ G5.2, nuevo en v2
INSERT events (group_closed / no_execution)
RETURN {result:'no_execution', gross_units, min_required}
```

#### Paso 4 — Liquidación por PMA universal
```sql
UPDATE group_members SET payment_status = 'cancelled'
WHERE group_id = p_group_id AND payment_status IN ('authorized','instructed','paid')
  AND ( (join_mode='esperar' AND (target_price     IS NULL OR target_price     < v_settlement))
     OR (join_mode='comprar' AND (guaranteed_price IS NULL OR guaranteed_price < v_settlement)) );
```
**`NULL` siempre libera** — regla explícita del comentario original: *"dato corrupto también
libera, nunca cobrar"*.

#### Paso 5 — Mínimo de ejecución "de cinturón"
Vuelve a sumar los vivos (ya sin los cancelados en el paso 4). Si `< min_execution` de la
ganadora → mismo camino que Regla 6 (cancelar todo + `bids → outbid`).

#### Paso 6 — Adjudicación por stock (FCFS)
```sql
UPDATE group_members gm SET final_price = v_settlement, payment_status = 'instructed'
FROM ( SELECT id FROM (
         SELECT id, SUM(quantity) OVER (ORDER BY join_order ASC
                     ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_qty
         FROM group_members
         WHERE group_id = p_group_id
           AND payment_status IN ('authorized','instructed','paid')
       ) sub WHERE sub.cum_qty <= v_winning_bid.max_stock ) adj
WHERE gm.id = adj.id;
```
> ⚠️ En v2 este paso **ya no filtra por precio**: los que no llegaban fueron cancelados en el
> paso 4. (En v1 sí filtraba, porque el paso 4 solo tocaba esperadores.)

#### Paso 7 — Excedente y desenlace
`v_surplus := v_buying_units - v_adj_units`

| Rama | Condición | Efecto |
|---|---|---|
| **9A — cierre limpio** | `surplus = 0` | `groups.status='closed'`, `current_price=final_price=settlement`, `winner_bid_id`; puja → `winner`, resto activas → `outbid`; evento `closed`. `RETURN {result:'closed'}` |
| **9B-a — excedente SIN segunda puja** | `surplus > 0` y no hay otra `active` | Los `authorized` restantes → `cancelled`; `groups.status='closed'`; puja → `winner`; evento con `surplus_released:true`. `RETURN {result:'closed', surplus_released:true}` |
| **9B-b — excedente CON segunda puja** | `surplus > 0` y existe otra `active` | ⚠️ **`groups.status` se queda en `'closing'`**; el excedente permanece `authorized`; puja → `winner`; **`second_price_at_n` se devuelve SIEMPRE `NULL`** (`v_second_price := NULL;` — la valoración de la segunda puja **no está implementada**). `RETURN {result:'surplus'}` |

#### Manejo de errores
```sql
EXCEPTION WHEN OTHERS THEN RAISE;
```
Re-lanza. Todo el cuerpo es una transacción → un fallo revierte el cierre completo.
Las llamadas a Stripe ocurren **después y fuera** de esta transacción (ver `PAYMENTS.md`).

### BUSINESS RULES implementadas
RULE-006 (Regla 6), RULE-007 (`max_stock`), RULE-008 (precio único), RULE-009 (PMA universal),
RULE-011 (FCFS por `join_order`), RULE-012 (desempate por antigüedad), RULE-013 (un solo
vendedor sirve todo).

### SIDE EFFECTS
Escribe en `groups` (`status`, `current_price`, `final_price`, `winner_bid_id`),
`group_members` (`payment_status`, `final_price`), `bids` (`status`) y `events`.
**Habilita** (no ejecuta) las capturas de Stripe, los emails de cierre y las etiquetas de envío.

### CALLERS
- `src/app/admin/grupos/[id]/actions.ts:28` → `closeGroup()` server action.
  - Invocado por `CloseGroupButton.tsx` (botón del admin).
  - Invocado por `src/app/api/cron/close-groups/route.ts:48` (cron dominical).
- **No hay ningún otro llamante.**

### DEPENDENCIES
`groups`, `group_members`, `bids`, `events`. **No usa `compute_price`.**

### EDGE CASES
| Caso | Comportamiento |
|---|---|
| Grupo ya cerrado/cancelado/cerrando | `already_*`, sin efectos. **Idempotente** |
| Grupo inexistente | `RAISE EXCEPTION` |
| Sin pujas activas | Todo cancelado |
| `target_price` NULL en un esperador | **Cancelado** (nunca cobrar) |
| `guaranteed_price` NULL en un comprador | **Cancelado** |
| `join_mode` con un valor distinto de `comprar`/`esperar` | 🔴 **No entra en ninguna rama del paso 4** → no se cancela; **sí** entra en el paso 6 (que ya no filtra por modo) → **se le adjudicaría y cobraría sin comprobar su PMA**. Nada en la BD lo impide (`join_mode` es `text` sin CHECK) |
| Un miembro grande no cabe en el stock | Queda fuera **él y todos los posteriores** (el corte es por `cum_qty` de filas completas, sin reparto parcial ni relleno) |
| Excedente con segunda puja | 🔴 Grupo **atrapado en `closing`**, sin salida automatizada. **Nunca ejecutado en producción** (máximo de pujas activas por grupo: 1) |
| `bids.tiers = '[]'` en la ganadora | `settlement` NULL → comportamiento indefinido. Sin guard |
| `max_stock` NULL en la ganadora | `RAISE EXCEPTION 'La puja ganadora (%) no tiene max_stock definido'`. Imposible hoy (columna `NOT NULL`) |

### CONCURRENCY CONCERNS
- `SELECT ... FOR UPDATE` sobre `groups` serializa cierres concurrentes.
- **El mismo lock** es el que toma `confirm_join`, de modo que una unión y un cierre nunca se
  solapan: o el miembro entra antes del cierre, o `confirm_join` ve `status <> 'open'` y libera
  el hold.
- El cron y el botón de admin pueden dispararse a la vez: el segundo recibe `already_closing`.

### REPOSITORY
`supabase/close_group.sql` — cabecera: *"Definicion VIVA sincronizada desde produccion
(pg_get_functiondef) el 22 jun 2026"*. **Ya no lo es.**

### HISTORICAL — la v1 del fichero
- Calcula el precio final llamando a **`compute_price(p_group_id)`**, no por candidatas.
- Elige la puja como `best_bid_id` de `compute_price` → **implícitamente una sola puja**.
- **Liquidación por PMA solo para esperadores** (`AND join_mode = 'esperar'`).
- El paso 5 mide `min_execution` **solo sobre los que compran**
  (`AND (join_mode='comprar' OR target_price >= v_settlement)`).
- El paso 6 **sí filtra por precio** en la ventana de adjudicación.
- **No** marca `bids → outbid` en el camino de Regla 6.
- La rama de excedente **no tiene** el caso "sin segunda puja": siempre deja el grupo en
  `closing`.

### DISCREPANCIES 🔴

| # | Repositorio v1 (HISTORICAL) | Producción v2 (ACTUAL) | Impacto |
|---|---|---|---|
| 1 | Precio final vía `compute_price` | **Settlement por candidata, con su propia demanda** | Multi-puja real |
| 2 | PMA solo para esperadores | **PMA UNIVERSAL**: cancela también `comprar` con `guaranteed_price < settlement` | 🔴 **Cambia a quién se le cobra** |
| 3 | Sin `bids → outbid` en Regla 6 | **Sí** (★ G5.2) | Consistencia de estados |
| 4 | Excedente siempre deja `closing` | **Rama nueva:** sin segunda puja → libera el excedente y **cierra** | Menos grupos colgados |
| 5 | Paso 6 filtra por precio | Paso 6 no filtra (ya se canceló en el paso 4) | Equivalente |
| 6 | Sin `SET search_path` | `SET search_path TO 'public'` | Seguridad |

---

## 5. `confirm_join`

### FILE / DATABASE FUNCTION
`public.confirm_join` — función de base de datos.

### VERSION
**11 argumentos** (v3 según `CLAUDE.md`). La versión viva difiere del fichero.

### SOURCE
`pg_get_functiondef` sobre producción. **CURRENT PRODUCTION.**

```
SIGNATURE : confirm_join(p_payment_intent_id text, p_group_id uuid, p_name text,
                         p_email text, p_phone text, p_quantity integer,
                         p_authorized_amount numeric, p_guaranteed_price numeric,
                         p_shipping jsonb, p_join_mode text DEFAULT 'comprar',
                         p_target_price numeric DEFAULT NULL)
RETURNS   : json
SECURITY  : DEFINER · SET search_path TO 'public'
GRANTS    : anon=FALSE  authenticated=FALSE  service_role=TRUE   ← BLINDADA (verificado)
```

### INPUTS
Todo lo necesario para materializar un miembro. **Proviene íntegramente de la `metadata` y del
objeto `shipping` del PaymentIntent de Stripe** — ver `PAYMENTS.md`.

### OUTPUTS
| Respuesta | Significado | Qué hace el webhook |
|---|---|---|
| `{status:'already_processed'}` | Ya existe un miembro con ese PI | Nada. **No libera** |
| `{status:'needs_release', reason:'group_closed'\|'no_bid'\|'out_of_stock'\|'duplicate'\|'phone_in_use'}` | No se puede crear | **Cancela el PaymentIntent** |
| `{status:'confirmed', new_total_units, new_price}` | Miembro creado | Email + `runPulseTrigger` + `notifyReachableWatchers` |

### ALGORITHM (producción, en orden)

```
 1. IF EXISTS (group_members WHERE stripe_payment_intent_id = p_payment_intent_id)
       → RETURN already_processed                            ← idempotencia de entrada
 2. Normalizar teléfono
 3. PERFORM 1 FROM groups WHERE id = p_group_id AND status='open' FOR UPDATE
       IF NOT FOUND → RETURN needs_release/group_closed      ← ★ EL LOCK CLAVE
 4. SELECT best_bid_id FROM compute_price(p_group_id)
       IF NULL → RETURN needs_release/no_bid
 5. v_max_stock := bids.max_stock
 6. v_current_total := Σ quantity de miembros VIVOS (sin filtrar modo ni precio)
       IF v_current_total + p_quantity > v_max_stock
          → RETURN needs_release/out_of_stock
 7. v_old_price := compute_price(p_group_id).best_price
 8. BEGIN  (bloque con manejador de excepciones)
      a. INSERT INTO users (email, phone, name, role) VALUES (...,'buyer')
         ON CONFLICT (email) DO UPDATE SET phone = v_phone, name = p_name
         RETURNING id
      b. v_join_order := COALESCE(MAX(join_order),0) + 1  del grupo
      c. INSERT INTO group_members (...) VALUES (..., 'authorized', ...)
      d. SYNC de dirección → user_addresses
         · solo si p_shipping->>'line1' no está vacío
         · dedup por (line1, postal_code) para ese user_id
         · is_default = true si es su primera dirección
      e. SELECT best_price, next_price FROM compute_price(p_group_id)
         UPDATE groups SET current_price, next_price
      f. UPDATE groups SET total_units = (
           Σ quantity de vivos WHERE join_mode='comprar' OR target_price >= v_new_price )
         ← RECALCULADO ENTERO, no incremental
      g. INSERT INTO events (member_joined) {name_inicial, quantity, new_price, total_units}
      h. IF v_new_price < v_old_price → INSERT INTO events (price_dropped)
    EXCEPTION WHEN unique_violation:
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME
      · 'uniq_group_members_pi' → RETURN already_processed   ← NUNCA liberar
      · 'users_phone_key'       → RETURN needs_release/phone_in_use
      · otra                    → RAISE
 9. RETURN confirmed
```

### BUSINESS RULES implementadas
RULE-005, RULE-007, RULE-022 (la membresía solo existe con dinero autorizado),
RULE-023 (un PI = un miembro).

### SIDE EFFECTS
`users` (upsert), `group_members` (insert), `user_addresses` (insert condicional),
`groups` (`current_price`, `next_price`, `total_units`), `events` (1 o 2 inserts).

> ⚠️ **El `INSERT INTO events` es el latido de la UI en vivo.** `useTierDemand` se suscribe por
> Realtime a los INSERT sobre `events`. Si se quitara, la escalera dejaría de actualizarse sola
> en todos los navegadores abiertos.

### CALLERS
**Uno solo:** `src/app/api/stripe/webhook/route.ts:63`.

### DEPENDENCIES
`groups`, `group_members`, `users`, `user_addresses`, `bids`, `events`, `compute_price`.

### EDGE CASES
| Caso | Comportamiento |
|---|---|
| Reentrega del mismo webhook | `already_processed` (paso 1) |
| Dos entregas **concurrentes** del mismo PI | El paso 1 no basta; salta `uniq_group_members_pi` → `already_processed`. **Nunca `needs_release`** |
| Grupo cerrado entre el hold y el webhook | `needs_release/group_closed` → hold cancelado |
| Stock agotado entre el hold y el webhook | `needs_release/out_of_stock` → hold cancelado |
| Email ya existente | `ON CONFLICT (email) DO UPDATE` → **pisa `phone` y `name`** del usuario existente |
| Teléfono ya usado por otro email | 🔴 **Se crea un segundo `users` con el mismo teléfono.** La rama `users_phone_key` es inalcanzable |
| El mismo usuario se une por segunda vez con otro PI | 🔴 **Se crea un segundo `group_members`** |
| `p_shipping` sin `line1` | No sincroniza dirección; el miembro se crea igual |

### CONCURRENCY CONCERNS
- **`PERFORM 1 FROM groups ... FOR UPDATE` es el mecanismo central de todo el sistema.**
  Serializa todos los `confirm_join` del mismo grupo, de modo que el guard de stock del paso 6
  siempre ve la suma ya escrita por la transacción anterior. **Sin ese lock hay overselling.**
- El bloque `BEGIN ... EXCEPTION` crea un subtransacción: un `unique_violation` no aborta la
  llamada entera.
- El índice UNIQUE `uniq_group_members_pi` es la red de seguridad final.

### REPOSITORY
`supabase/confirm_join.sql`.

### HISTORICAL — el fichero contiene
```sql
-- duplicado por teléfono O email (la identidad se resuelve por email)
IF EXISTS (
  SELECT 1 FROM group_members gm JOIN users u ON u.id = gm.user_id
  WHERE gm.group_id = p_group_id AND (u.phone = v_phone OR u.email = p_email)
) THEN RETURN json_build_object('status','needs_release','reason','duplicate'); END IF;
```
y un manejador de excepciones simple:
```sql
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('status','needs_release','reason','duplicate');
```

### DISCREPANCIES 🔴

| # | Repositorio (HISTORICAL) | Producción (ACTUAL) | Impacto |
|---|---|---|---|
| 1 | **Check de duplicado por (teléfono OR email)** | **ELIMINADO** | 🔴 **P0-01: miembros duplicados** |
| 2 | `unique_violation` → siempre `needs_release/duplicate` | Discrimina por `CONSTRAINT_NAME`; `uniq_group_members_pi` → `already_processed` | Producción es **más correcta**: evita cancelar un hold cuya membresía ya existe |
| 3 | — | Rama `users_phone_key` → `needs_release/phone_in_use` | 🔴 **CÓDIGO INALCANZABLE** |
| 4 | Sin comentarios sobre el lock | Mismos mecanismos | — |

> 🔴 **DISCREPANCIA #3 verificada contra la base de datos:** la constraint `users_phone_key`
> **no existe**. Consulta a `pg_constraint` sobre `users`: solo `users_pkey`, `users_email_key`
> y `users_auth_id_key`. Esa rama nunca se ejecuta, y **el teléfono no es único**.
> Evidencia en datos: **2 teléfonos duplicados** en `users` a fecha de la auditoría.

---

## 6. MULTI-BID (multi-puja)

### CURRENT PRODUCTION
El motor **soporta multi-puja de extremo a extremo**:

| Componente | Estado |
|---|---|
| `compute_price` — fusión de mínimos con desempate por antigüedad | ✅ Implementado |
| `tier_demand` — escalera fusionada con mínimo acumulado y dedup | ✅ Implementado |
| `close_group` v2 — selección de candidata, elegibilidad por puja | ✅ Implementado |
| `bids` ilegible por el cliente (RLS sin políticas) | ✅ Implementado — garantiza D5 |
| Admin "Añadir puja" (`addBidToGroup`) | ✅ Implementado |
| Admin "Retirar puja" (`withdrawBid`) con check de seguridad §5.3 | ✅ Implementado |

### Vocabulario de estados
| Estado en el enum `bid_status` | ¿Se escribe? | Dónde |
|---|---|---|
| `active` | ✅ | default; `createGroup`, `addBidToGroup`, rollback de `withdrawBid` |
| `winner` | ✅ | `close_group` ramas 9A y 9B |
| `outbid` | ✅ | `close_group` (Regla 6 y ramas de cierre) |
| `withdrawn` | ✅ | `withdrawBid` |
| `declined` | ❌ **nunca** | — |

> ⚠️ La especificación V1 multi-vendedor pedía el estado **`lost`**. La implementación usa
> **`outbid`**. Son el mismo concepto con otro nombre.

### `withdrawBid` — algoritmo real
`src/app/admin/grupos/[id]/actions.ts:140`
```
1. La puja debe existir, estar 'active' y pertenecer al grupo
2. El grupo debe estar 'open'
3. COUNT(bids active del grupo) > 1        ← no se puede retirar la única
4. UPDATE bids SET status='withdrawn'      ← TENTATIVO
5. newPrice := compute_price(groupId).best_price
6. minGuaranteed := MIN(guaranteed_price) de miembros vivos
   IF newPrice > minGuaranteed
      → UPDATE bids SET status='active'    ← ROLLBACK manual
      → devolver error explicativo
7. UPDATE groups SET current_price, next_price
```
⚠️ **Sin lock.** El propio código lo admite: *"Race window despreciable: solo Benjamin usa el
admin"*. Es una **suposición operativa**, no una garantía técnica.

### `addBidToGroup` — validaciones
`src/app/admin/grupos/actions.ts:144`. Usa `validateBidFields` (compartido con `createGroup`):
`tiers.length >= 1`; `min_execution <= max_stock`; por tramo `min_units >= 1`, `price > 0`,
`min_units` estrictamente creciente, `price` estrictamente decreciente, `min_units <= max_stock`.
**Explícitamente NO exige mejorar la oferta:** *"Ninguna restricción de 'debe mejorar': una puja
peor en todos los niveles es legal (simplemente nunca aporta el mínimo). La fusión la neutraliza
sola."*

### EDGE CASES multi-puja
| Caso | Comportamiento |
|---|---|
| Puja nueva con el grupo abierto ("en caliente", D4) | Seguro: la fusión es un mínimo → el precio solo baja o se mantiene |
| Puja peor en todos los niveles | Legal; nunca aporta el mínimo |
| Empate de settlement entre candidatas | Gana `created_at` menor (D3) |
| Ganadora sin stock para toda la demanda | Excedente → ver `close_group` paso 7 |
| Excedente **con** segunda puja activa | 🔴 Grupo atrapado en `closing`; `second_price_at_n` siempre NULL |

### DATOS DE PRODUCCIÓN (6-sep-2026)
```
bids totales por status:  active = 1
máximo de pujas activas en un mismo grupo:  1
```
> 🔴 **La maquinaria multi-puja NUNCA se ha ejecutado con más de una puja ni con dinero real.**
> El **Gate G6** de la especificación (ensayo E2E multi-puja con holds reales) **está pendiente**.
> Ver `KNOWN_ISSUES.md` P1-03.

### REPOSITORY / HISTORICAL
Los ficheros `supabase/compute_price.sql`, `tier_demand.sql` y `close_group.sql` corresponden a
la etapa **single-bid** anterior. **No describen el sistema actual.**

---

## 7. PMA — PRECIO MÁXIMO ACEPTADO

### Definición operativa
El techo por unidad que un miembro acepta pagar.

### CURRENT PRODUCTION — dónde vive
| Modo | Columna | Valor |
|---|---|---|
| `esperar` | `group_members.target_price` numeric(10,2) | El tramo elegido |
| `comprar` | `group_members.guaranteed_price` numeric | El precio proyectado en el momento de unirse |

### Cómo se calcula `guaranteed_price`
`prepare_join` paso 8: `compute_price(p_group_id, p_quantity).best_price` — el precio que habría
**si el comprador ya estuviese dentro con sus unidades**. Es siempre ≤ el precio actual y, en un
grupo que solo crece, ≥ el precio final. Sirve como techo honesto.

### Cómo se valida `target_price`
Server-authoritative, en **dos** endpoints:
- `src/app/api/join/create-intent/route.ts:60-77`
- `src/app/api/checkout/lock/route.ts:67-79`

Ambos llaman a `tier_demand(group_id)` y exigen que `target_price` esté **exactamente** en la
lista de precios devuelta. **El cliente no puede inventarse un PMA arbitrario.**

Para el Pulse, la validación es más estricta (`pulse_pledge_upsert`): el tramo debe existir,
**no estar desbloqueado** y ser **estrictamente menor** que el precio vigente.

### La asimetría (🔴 crítica)
```
compute_price / tier_demand / pulse_state:
    comprar → PMA = ∞          (cuenta a todos los precios)

close_group paso 3 y paso 4:
    comprar → PMA = guaranteed_price
```

**Consecuencia real:** si el precio de cierre acaba siendo **superior** al `guaranteed_price` de
un comprador "ahora" (posible si miembros vivos se cancelan y la demanda baja, o por el caso
borde de `max_stock` de ADR-08), **ese comprador es cancelado en el paso 4 y su hold se libera**.
No se le cobra de más — pero se queda fuera del grupo sin haber hecho nada mal, **y no recibe
ningún email explicándolo** (`sendClosePaymentEmails` solo escribe a `instructed` y `paid`).

Esto corresponde a la decisión §4.4 de la especificación multi-vendedor, resuelta en el código
como **opción (b)**. La especificación **no se actualizó** para reflejarlo.

### Cómo se traduce el PMA a dinero
| Modo | Importe retenido |
|---|---|
| `comprar` | `guaranteed_price × quantity` |
| `esperar` | `target_price × quantity` |
| Conversión del Pulse | `pledge.tier_price × quantity`, con `guaranteed_price = target_price = tier_price` |

---

## 8. PRICE TIERS

### CURRENT PRODUCTION — formato
`bids.tiers` jsonb: `[{"min_units": int, "price": number}, ...]`.

### Validación
**Únicamente en el server action del admin** (`validateBidFields`,
`src/app/admin/grupos/actions.ts:36-59`). **No hay ningún CHECK constraint ni trigger en la base
de datos.** Un `UPDATE` directo por SQL puede introducir una escalera incoherente.

### Ejemplo REAL de producción (6-sep-2026)
Grupo `TEST · Algoritmo precio` — único grupo existente:
```json
tiers        : [{"min_units":1,"price":100},{"min_units":5,"price":80},
                {"min_units":10,"price":60},{"min_units":20,"price":45}]
price_mode   : "stepped"
min_execution: 3
max_stock    : 50
pvp          : 120
total_units  : 12       current_price: 60      next_price: 45
```
Coherente con el motor: 12 ≥ 10 desbloquea el tramo de 60 €; el siguiente escalón real por debajo
es 45 €.

### Cómo se determina el tramo actual
**No** es "unidades vendidas ≥ min_units", sino **demanda efectiva** a ese precio.
Contraejemplo demostrativo (12 unidades vivas, 10 de ellas esperadores con target 45 €):

| Tramo | Demanda efectiva | ¿Desbloqueado? |
|---|---|---|
| 1 → 100 € | 2 (solo los "ahora") | ✅ (2 ≥ 1) |
| 5 → 80 € | 2 | ❌ |
| 10 → 60 € | 2 | ❌ |
| 20 → 45 € | 12 | ❌ (12 < 20) |

**Precio vigente: 100 €** con 12 unidades vivas, y `total_units` valdría **2**.

### `price_mode` — ⚠️ NO IMPLEMENTADO en el motor vigente

| Elemento | Estado |
|---|---|
| Enum `price_mode` con `fluid`/`stepped` | Existe |
| Columna `bids.price_mode NOT NULL DEFAULT 'fluid'` | Existe |
| Selector en el formulario del admin | Existe y guarda el valor |
| Función `compute_price_at_n(jsonb, text, integer)` que implementa la interpolación lineal | Existe en la BD |
| **Llamantes de `compute_price_at_n`** | **CERO** — verificado en todo `src/` y en el cuerpo de todas las funciones SQL |
| `compute_price` / `tier_demand` / `close_group` leen `price_mode` | **NO. Ninguna.** |

> 🔴 **En el sistema vigente TODOS los tramos se comportan como `stepped`, sea cual sea el valor
> de `price_mode`.** El modo `fluid` está **NOT_IMPLEMENTED**.
> `compute_price_at_n` es `IMMUTABLE`, `SECURITY INVOKER`, con `search_path` **mutable**
> (lo marca el linter de Supabase) y ejecutable por `anon`.

### Qué ocurre en cada evento
| Evento | Efecto sobre el precio |
|---|---|
| Entra un comprador "ahora" con N uds | Suma N a **todos** los tramos → el precio solo baja o se mantiene |
| Entra un esperador con target T | Suma N solo a los tramos con `price <= T` |
| Se compran varias unidades | Cuentan **por unidades, no por compradores** |
| Un miembro vivo se cancela o libera | La demanda baja → **el precio puede SUBIR** |
| Se añade una puja | La fusión es un mínimo → el precio solo baja o se mantiene |
| Se retira una puja | `withdrawBid` hace rollback si el precio superaría algún `guaranteed_price` vivo |
| Un pago falla | El miembro **nunca llega a existir** → cero impacto |

### Retroactividad
**El precio es totalmente retroactivo.** Todos los adjudicados pagan `groups.final_price`, sea
cual sea el precio del momento en que se unieron.

---

## 9. QUANTITY, GROUP UNITS Y LAS CUATRO MAGNITUDES

Confundir estas cuatro magnitudes es el error más peligroso posible en este código base.

| Magnitud | Fórmula exacta | Dónde se usa |
|---|---|---|
| **Demanda efectiva a P** | `Σ qty` de vivos con `join_mode='comprar' OR target_price >= P` | Desbloquear tramos: `compute_price`, `tier_demand` |
| **Demanda firme** (= efectiva al precio vigente) | lo mismo con `P = current_price` | **`groups.total_units`**, display de progreso |
| **Unidades comprometidas** | `Σ qty` de **todos** los vivos, sin filtrar modo ni precio | **Guard de stock**: `prepare_join`, `confirm_join`; `gross_units` en `close_group` |
| **Unidades adjudicadas** | `Σ qty` de los que quedan en `instructed` tras el corte por `max_stock` | Reparto real, `captureGroupPayments` |

### 🔴 `groups.total_units` NO es un contador de stock
Comentario literal en `confirm_join` (producción):
> *"total_units es 'demanda firme al precio vigente' y fluctúa con el precio — no sirve como
> techo de stock; ese era el bug de overselling."*

**`total_units` puede BAJAR**, e incluso ser **0 con 15 miembros vivos**, si todos son
esperadores con `target_price` por debajo del precio vigente.

**Escritor único:** `confirm_join` paso 8f, **recalculado entero** (no incremental) para que
nunca se desincronice.

**Lectores:** `src/app/page.tsx` (fallback), `grupo/[id]/page.tsx`, `unirme/page.tsx`,
`unido/page.tsx`, admin, `prepare_join` (lo selecciona pero **ya no lo usa** como techo), y
🔴 **`src/app/grupo/[id]/unirme/JoinFlow.tsx:115`**:
```ts
const remaining = group.max_stock > 0 ? Math.max(1, group.max_stock - group.total_units) : 10;
```
→ **sobreestima el stock disponible** cuando hay esperadores por debajo del precio vigente.
El servidor lo corrige después en `prepare_join`, así que **no es un fallo de dinero**, sino de
UX (el usuario rellena todo el formulario y es rechazado al final).
Ver `KNOWN_ISSUES.md` P2-01.

### Límites de cantidad
- `1 <= quantity <= 10` por comprador: `prepare_join` (excepción), CHECK
  `group_members_quantity_check (quantity >= 1)`, CHECK de `pulse_pledges` (1..10), clamp en
  `unirme/page.tsx:83` y en el stepper de `JoinFlow`.
- **La BD solo garantiza `>= 1`.** El techo de 10 es lógica de aplicación.

---

## 10. CURRENT PRICE, PROJECTED PRICE, FINAL PRICE

| Concepto | Definición | Fuente de verdad | Caché |
|---|---|---|---|
| **Precio vigente** | `compute_price(group).best_price` | La función | `groups.current_price` |
| **Precio proyectado** | `compute_price(group, N, T).best_price` — con las unidades del comprador dentro | La función | ninguna |
| **`guaranteed_price`** | El precio proyectado congelado al unirse | `group_members.guaranteed_price` | metadata del PaymentIntent |
| **Siguiente precio** | `MAX(price) WHERE price < best_price`, NULL si no hay | La función | `groups.next_price` |
| **Precio final (settlement)** | El settlement de la puja ganadora al cierre | `groups.final_price` == `group_members.final_price` | — |

### Quién actualiza las cachés
`groups.current_price` / `next_price` los escriben: `confirm_join` (cada alta), `close_group`
(al cerrar), `addBidToGroup`, `withdrawBid`, y `createGroup` (valores iniciales
`tiers[0].price` / `tiers[1]?.price`).
**Son cachés derivadas.** Ante cualquier duda, `compute_price` manda.

### ⚠️ Tres definiciones distintas de "siguiente tramo" conviviendo
1. **`compute_price.next_price`** → `MAX(price) WHERE price < best_price`.
2. **`src/hooks/useTierDemand.ts:61-68`** → el tramo no desbloqueado por debajo del actual con
   **menos unidades faltantes**, desempatando por precio. **Criterio distinto.**
3. **`src/app/page.tsx:59-63`** → `nextLocked` = primer tramo no desbloqueado con
   `minUnits > unlockedBase`, y un `currentUnits` de display
   `min(nextLocked.minUnits − 1, max(unlockedBase, nextLocked.demand))`.

Las tres son coherentes en el caso simple y pueden divergir en escaleras con huecos.
Ver `TECHNICAL_DEBT.md` DT-07.

---

## 11. ADJUDICACIÓN — resumen operativo

```
Entrada  : grupo con status='open' y closes_at <= now()
Proceso  : close_group() §4
Salida   : cada miembro vivo queda en 'instructed' (adjudicado, con final_price)
           o en 'cancelled' (liberado)
Después  : captureGroupPayments() mueve el dinero → 'paid' / 'released'
```

**Criterio de reparto:** FCFS estricto por `join_order` ascendente, suma acumulada por filas
completas, sin fraccionar pedidos y **sin relleno** (si un pedido no cabe entero, quedan fuera
él y todos los posteriores).
❓ **UNKNOWN:** no consta si la ausencia de relleno es deliberada. No hay comentario que lo
explique. Ver `KNOWN_ISSUES.md` P2-02.

---

## 12. TABLA RESUMEN — PRODUCCIÓN vs REPOSITORIO

| Función | Firma en PRODUCCIÓN | Firma en el REPO | ¿Coinciden? |
|---|---|---|---|
| `compute_price` | `(uuid, integer, numeric)` | `(uuid, integer)` | 🔴 **NO** |
| `tier_demand` | `(uuid)` fusión multi-puja | `(uuid)` single-bid | 🔴 **NO** (misma firma, algoritmo distinto) |
| `prepare_join` | `(uuid, text, integer)` sin dedup | `(uuid, text, integer)` con dedup, **fichero corrupto** | 🔴 **NO** |
| `confirm_join` | 11 args, sin dedup, discrimina constraint | 11 args, con dedup | 🔴 **NO** |
| `close_group` | `(uuid)` v2 multi-puja + PMA universal | `(uuid)` v1 single-bid | 🔴 **NO** |
| `get_my_groups` | `(text, text)` | `(text)` — 1 argumento | 🔴 **NO** |
| `create_petition` | `(text,text,text,int,text,text,text)` v3 (anti-spam 5/h, upsert no destructivo) | v1 | 🔴 **NO** |
| `join_group` | **NO EXISTE** | `revoke_join_group.sql` la referencia | 🔴 Función eliminada |
| `shipping_columns.sql` | columnas presentes | DDL aditivo idempotente | ✅ Coherente |
| `event_type_add_petition_created.sql` | valor presente en el enum | DDL aditivo idempotente | ✅ Coherente |
| `profile_identity.sql` | `_profile_uid`, `get_profile`, `address_*` presentes | coincide en estructura | ⚠️ No comparado línea a línea |

**Verificación de integridad de `pg_proc`:** 21 funciones en el esquema `public`,
**ninguna sobrecarga duplicada**. Permisos de las money-critical correctos.
