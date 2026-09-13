# AI_HANDOFF.md — Gropo

> **ÚNICO punto de entrada operativo para una IA que va a continuar desarrollando Gropo.**
> Léeme primero: ningún otro documento de `docs/` sustituye a este como punto de partida.
> **No sustituyo a la documentación detallada**: doy el mapa, lo roto, lo que no
> debes asumir y cómo trabajar. El detalle está en los otros 14 documentos de `docs/`.
>
> Base: repo `main @ 7c49ef3` + base de datos de producción `xpktkuozspreuxucnguh`, auditada en
> vivo el **6 de septiembre de 2026**.


---

## ⚠️ ÚLTIMO ESTADO — 13 de septiembre de 2026

**Cutover de Stripe: PREPARADO PERO APLAZADO.** Decisión de Benjamin: faltan pruebas en modo test
y trabajo de UI. Producción **sigue en claves de test**. Detalle completo en `LAUNCH_CHECKLIST.md`
FASE 3, que incluye el estado verificado contra la API de Stripe.

Lo hecho: cuenta live comprobada (cobros y pagos habilitados, sin requisitos pendientes), datos
públicos y branding corregidos (antes decían "Vonda"), y **webhook live creado**
(`we_1UFA10An6mkRTl0ghhi4vdP9`), idéntico en URL, evento y versión de API al de test que pasó el
Ensayo 3. Está inerte mientras no haya `sk_live_`.

Lo que falta y **bloquea**: las claves live en Vercel **separando entornos** (hoy las tres
variables están en "Production and Preview": cambiar solo el valor haría que las URLs de
previsualización cobrasen dinero real), y darle al webhook de **test** su propio destino — hoy
apunta a producción y en cuanto producción use el `whsec_` live, toda prueba en test fallará la
firma **en silencio**.

**Marca:** wordmark nuevo (la "g" con punto naranja y sonrisa) en `public/logo.png` y
`public/logo-light.png`, recoloreado al token `#024947`. Los iconos, el favicon y la imagen de
Open Graph siguen siendo los anteriores, por decisión explícita.

---

# 1. PROJECT IDENTITY

**Gropo** — web app de **compra colectiva con precio dinámico descendente y liquidación única**,
para España. Nombres anteriores: *Vonda* (toda la documentación), *Kuorum* (repo y
`package.json`), *Grupeta*.

**Problema:** un comprador individual no mueve volumen de mayorista. Gropo agrega demanda
dispersa en el tiempo hasta alcanzarlo y traslada el descuento íntegro al comprador.

**Modelo:** merchant-of-record (cobra por Stripe, envía por Sendcloud).
❓ No existe ninguna columna, constante ni cálculo de comisión en el sistema (§11).

**Usuario:** ciclistas en España (el código no tiene dependencias de ciclismo salvo pesos por
defecto de Sendcloud y copys).

**Flujo:** ver el precio bajar en vivo → elegir cantidad y modo (comprar ya / esperar a un
precio) → **autorizar una retención** en tarjeta → el domingo el grupo cierra, se fija **un
precio único**, se captura solo ese importe o se libera el hold entero → envío.

**Stack:** Next.js 14 App Router · Supabase (PostgreSQL + Auth + Realtime) · Stripe (captura
manual) · Resend · Sendcloud v3 · Vercel · Tailwind.

**Estado real de producción:**
```
0 grupos 'open' · 1 grupo de prueba cancelado · 16 group_members · 0 pledges · 151 users
0 holds vivos ('authorized'/'instructed')
✅ 0 duplicados VIVOS (group_id,user_id) — índice uniq_member_per_group_alive desde 11-sep-2026
🟠 3 pares duplicados históricos, todos 'cancelled' y con 0 € capturados (el índice los ignora)
🟠 2 teléfonos repartidos entre varios users (P1-07 — la identidad es el email)
```
> Construido y ensayado, pero **no ha operado con dinero real fuera de los ensayos**, y el
> **multi-puja nunca ha corrido con más de una puja**.

---

# 2. CURRENT REALITY

**El repositorio y producción no coinciden.**
No hay sistema de migraciones (`supabase/migrations/` no existe): los `supabase/*.sql` son copias
manuales. **7 de 9 funciones están desfasadas.** **Producción es la fuente de verdad.**
La documentación histórica no representa el sistema actual.

| Función | Repositorio | Producción |
|---|---|---|
| `compute_price` | `(uuid,integer)` single-bid; `next_price` = "si entra 1 más" | `(uuid,integer,numeric)` **multi-puja**; `next_price` = **siguiente escalón real**, NULL si no hay |
| `close_group` | v1, PMA solo esperadores | **v2** multi-puja, **PMA universal** |
| `prepare_join` | **con** check de duplicado · **CORRUPTO, no parsea** | **sin** check de duplicado |
| `confirm_join` | **con** check de duplicado | **sin** él; maneja `users_phone_key`, **constraint que no existe** |
| `tier_demand` | single-bid | escalera **fusionada** con mínimo acumulado |
| `get_my_groups` | `(p_phone)` — 1 arg | `(p_phone, p_email)` — 2 args |
| `create_petition` | v1 | **v3** (anti-spam 5/h + upsert no destructivo) |
| `join_group` | referenciada por `revoke_join_group.sql` | **YA NO EXISTE** |

> ⚠️ Las cabeceras de `compute_price.sql` y `close_group.sql` dicen *"Definición VIVA
> sincronizada desde producción"*. **Son falsas desde el 22 de junio.**

Detalle: `ALGORITHM.md` §12 · `DATABASE.md` §9.

---

# 3. SYSTEM MAP

🔴 = crítico (un error aquí cobra mal a personas reales o rompe la seguridad).

```
USUARIO ▼ HOME src/app/page.tsx ── 🔴 tier_demand() × N grupos
        ▼ FICHA src/app/grupo/[id]/page.tsx ── 🔴 compute_price() · 🔴 tier_demand() · bids
        ▼ PRECIO EN VIVO  useTierDemand ◄ Realtime ◄ events   ·   usePulse ◄ polling 20 s
        ▼ JOIN  JoinFlow (1036 líneas)  ó  FastCheckoutModal (1-Click)
        ▼
🔴 POST /api/join/create-intent  [ó /api/checkout/lock]
     check_rate_limit() [FAIL-OPEN] · 🔴 prepare_join() · 🔴 tier_demand() [valida target_price]
        ▼
🔴 PAYMENT INTENT (capture_method:'manual') ── metadata = CONTRATO · 3 emisores → 1 consumidor
        ▼ STRIPE ── 3DS ──► requires_capture (HOLD, caduca a los 7 días)
        ▼ webhook payment_intent.amount_capturable_updated
🔴 POST /api/stripe/webhook  (firma · cuerpo crudo · guard metadata.group_id)
        ▼
🔴 confirm_join()  ── solo service_role
     ① idempotencia por PI · 🔴 ② PERFORM 1 FROM groups … FOR UPDATE ← EL LOCK CENTRAL
     ③ guard de stock · ④ INSERT group_members ('authorized')
     ⑤ UPDATE groups.current_price/next_price/total_units
     ⑥ INSERT events ──► latido de la UI en vivo
        ▼ ESTADO DEL GRUPO ── no-fatales: Resend · 🔴 runPulseTrigger() · notifyReachableWatchers()
        ▼ domingo 21:00 UTC (vercel.json)
🔴 GET /api/cron/close-groups [Bearer CRON_SECRET] ──► 🔴 closeGroup() (= botón del admin)
        ▼
🔴🔴 close_group()  ── LA FUNCIÓN MÁS CRÍTICA
     ① FOR UPDATE + guard de estado · ② status='closing'
     ③ selección de candidata (multi-puja · PMA universal)
     🔴 ④ liberar a quien no llegue al settlement con SU PMA
     ⑤ re-check min_execution · ⑥ adjudicar por join_order hasta max_stock
     ⑦ excedente → closed · closed+released · 🔴 ATRAPADO EN 'closing'
        ▼
🔴 captureGroupPayments()  ── FUERA de la transacción
     instructed → capture(final×qty) → paid   ·   cancelled → cancel() → released
        ▼ sendClosePaymentEmails() ──► generateShippingLabels() (manual, desde el admin)

PULSE:  watching → accepted (SetupIntent 0 €) → 🔴 pulse_check_and_lock() [advisory lock]
        → holding → 🔴 PaymentIntent off-session (idempotencyKey) → converted
        → el webhook lo trata como un ESPERADOR normal (metadata idéntica)
```

---

# 4. CRITICAL COMPONENTS

| NAME | TYPE | LOCATION | WHY IT MATTERS | DOC |
|---|---|---|---|---|
| `close_group` | Función SQL | producción `(uuid)` | **La más crítica**: a quién se cobra y a quién se libera | `ALGORITHM.md` §4 |
| `compute_price` | Función SQL | producción `(uuid,int,numeric)` | Precio mostrado **y** `guaranteed_price` retenido. 8 llamantes | `ALGORITHM.md` §1 |
| `confirm_join` | Función SQL | producción, 11 args | Crea la membresía; contiene el `FOR UPDATE` central | `ALGORITHM.md` §5 |
| `prepare_join` | Función SQL | producción `(uuid,text,int)` | Portero + `guaranteed_price`. **Sin lock**: optimista | `ALGORITHM.md` §3 |
| `tier_demand` | Función SQL | producción `(uuid)` | Escalera pública. **En el camino del dinero por dos vías** | `ALGORITHM.md` §2 |
| `pulse_check_and_lock` | Función SQL | producción `(uuid)` | Reserva las pledges que se cobran **off-session** | `ALGORITHM.md` §6 |
| `get_my_groups` | Función SQL | producción `(text,text)` | 🔴 Sin camino de JWT; expone pedidos y el banco del vendedor | `SECURITY.md` SEC-01 |
| `_profile_uid` | Función SQL | producción `(text,text)` | Identidad: JWT si hay sesión, **(tel,email) si no** | `SECURITY.md` SEC-01 |
| `address_add/update/delete/set_default` | Funciones SQL | producción | 🔴 `anon` puede **cambiar la dirección de envío ajena** | `SECURITY.md` SEC-01 |
| `create_petition` | Función SQL | producción v3 | Única escritura pública sin sesión | `SECURITY.md` SEC-05 |
| `groups` | Tabla | `public.groups` | `current_price`/`next_price`/`total_units` son **cachés** | `DATABASE.md` §3.1 |
| `group_members` | Tabla | `public.group_members` | El estado del dinero. **Sin UNIQUE `(group_id,user_id)`** | `DATABASE.md` §3.3 |
| `bids` | Tabla | `public.bids` | RLS **sin políticas** = opacidad del vendedor | `DATABASE.md` §3.2 |
| `POST /api/stripe/webhook` | Endpoint | `api/stripe/webhook/route.ts` | **Única vía de creación de miembros** | `PAYMENTS.md` §8 |
| `POST /api/join/create-intent` | Endpoint | `api/join/create-intent/route.ts` | Crea el hold. **Sin `idempotencyKey`; no devuelve `pi_id`** | `PAYMENTS.md` §2 |
| `POST /api/checkout/lock` | Endpoint | `api/checkout/lock/route.ts` | Hold 1-Click: crea **y confirma** server-side | `PAYMENTS.md` §6 |
| `GET /api/cron/close-groups` | Endpoint | `api/cron/close-groups/route.ts` | Dispara el cierre. **Falla cerrado sin `CRON_SECRET`** | `API.md` §14 |
| `captureGroupPayments` | TS | `src/lib/stripe-capture.ts:27` | Mueve el dinero real; reconcilia contra Stripe | `PAYMENTS.md` §11.1 |
| `runPulseTrigger` | TS | `src/lib/pulse.ts:57` | **Cobra off-session, sin el usuario delante** | `ALGORITHM.md` §6 |
| `closeGroup` | Server action | `admin/grupos/[id]/actions.ts:22` | Orquestador único del cierre (admin + cron) | `API.md` §3 |
| `withdrawBid` | Server action | `admin/grupos/[id]/actions.ts:140` | Retira una puja con rollback manual, **sin lock** | `BUSINESS_RULES.md` RULE-041 |
| `JoinFlow.tsx` | Componente | `grupo/[id]/unirme/JoinFlow.tsx` | Checkout principal. Espera al webhook (P0-03 ✅) · pedido congelado + reloj de 20 s (P0-06 mitigado) | `KNOWN_ISSUES.md` P0-03, P0-06 |
| `FastCheckoutModal.tsx` | Componente | `components/checkout/` | 1-Click. **Sí** hace confirmación honesta (18 s) | `PAYMENTS.md` §7.1 |
| `useTierDemand` | Hook | `src/hooks/useTierDemand.ts` | Realtime; su `nextTier` usa criterio **distinto** al motor | `TECHNICAL_DEBT.md` DT-07 |

---

# 5. BUSINESS MODEL IN ONE PAGE

*(Solo lo implementado. Lo que no existe, en §12.)*

**Grupo:** producto con fecha de cierre. `open → closing → closed | cancelled`. Un `open` con 0
pujas activas se muestra como **"Petición"**.

**Puja:** oferta de un vendedor — escalera de tramos + `min_execution` + `max_stock`. Puede haber
**varias activas**. El comprador **nunca ve pujas ni vendedores**.

**Tramo:** `{min_units, price}`. Con varias pujas la escalera pública es la **fusión**: el precio
más barato ofrecido a cada nivel o por debajo, con **mínimo acumulado** (alcanzado un precio, la
curva publicada nunca vuelve a subir).

**Cuatro magnitudes de unidades — confundirlas es el error más peligroso:** *efectiva a P* = Σ de
vivos con PMA ≥ P → **desbloquea tramos** · *firme* = la efectiva al precio vigente →
**`groups.total_units`**, y **fluctúa** · *comprometidas* = Σ de **todos** los vivos → **guard de
stock** · *adjudicadas* = las que quedan `instructed` tras el corte por `max_stock`.

**Miembro vivo** = `payment_status IN ('authorized','instructed','paid')`.

**Modos:** *comprar ahora* (`target_price` NULL, retiene `guaranteed_price × qty`) ·
*esperar a precio* (`target_price = X`, retiene `X × qty`, compra solo si el final ≤ X).

**PMA — 🔴 no es uniforme:** en `compute_price`/`tier_demand` los `comprar` valen **∞**; en
`close_group` su techo es su **`guaranteed_price`**. Los `esperar` usan `target_price` en ambos.

**Precio:** `guaranteed_price` = precio **proyectado** con las unidades del comprador dentro. Es
un **techo**, no el precio. El *settlement* final es **retroactivo**: todos los adjudicados pagan
lo mismo.

**Cierre** (domingo; cron 21:00 UTC, el motor calcula las 22:00 Madrid): ① ganadora por
`(elegible, settlement más barato, más antigua)` · ② **liberar** a quien no llegue con su PMA ·
③ si restantes < `min_execution` → **no ejecuta** (Regla 6) · ④ **adjudicar** por `join_order`
hasta agotar `max_stock` · ⑤ **un solo vendedor sirve todo**.

**Pagos:** hold-then-capture. Se autoriza al unirse; al cerrar se captura parcialmente el precio
final o se cancela el hold. **Caduca a los 7 días** → un grupo no puede durar más de 6,5 días
desde su primer comprador. `authorized → instructed → paid` · o `→ cancelled → released`.

**Límites:** 1–10 uds por comprador · teléfono español · envíos solo a España · 3 altas por
teléfono/hora · 10 intentos por IP/10 min (*fail-open*).

---

# 6. CRITICAL INVARIANTS

**Ninguna modificación debería romperlas.** Las 🔴 **ya están rotas**: no las empeores.

| ID | Regla | Implementación | Estado | Riesgo si se rompe |
|---|---|---|---|---|
| INV-001 | Un PaymentIntent → un miembro máximo | UNIQUE `uniq_group_members_pi` | ✅ | Doble cobro |
| INV-002 | `quantity >= 1` | CHECK en BD | ✅ | Precios absurdos |
| INV-003 | Un grupo cerrado no acepta miembros | `status='open'` bajo el **mismo `FOR UPDATE`** que `close_group` | ✅ | Entradas tras fijar el precio |
| INV-004 | `close_group` surte efecto una vez | `FOR UPDATE` + guard de estado | ✅ | Doble captura |
| INV-005 | **Nadie paga más que su PMA** | `close_group` paso 4 + captura parcial | ✅ | Cobro por encima de lo prometido |
| INV-006 | Adjudicadas ≤ `max_stock` | Ventana `cum_qty` | ✅ | Vender lo inexistente |
| INV-007 | Comprometidas ≤ `max_stock` | Guard en `confirm_join` **bajo lock** | ✅ | **Overselling** |
| INV-008 | Mismo `final_price` para todos | Un único `v_settlement` | ✅ | Rompe la promesa del producto |
| INV-009 | Escalera monótona no creciente | Mínimo acumulado | ✅ | El precio subiría con más gente |
| INV-010 | `total_units >= 0` | `SUM` de cantidades ≥ 1 | ✅ | Progreso incoherente |
| INV-011 | Un pledge vivo por (grupo,usuario) | Índice parcial `pulse_pledges_one_live` | ✅ | Doble cargo off-session |
| INV-012 | El Pulse no cobra sin masa crítica | `pg_advisory_xact_lock` | ✅ | Cargos indebidos |
| INV-013 | El Pulse no cobra a quien ya es miembro | Rechazo en `pulse_pledge_upsert` | ✅ | Doble conteo y doble cobro |
| INV-014 | `users.email` único | `users_email_key` | ✅ | Se pierde la identidad de compra |
| INV-015 | Un `auth.users` → un `public.users` | `users_auth_id_key` | ✅ | Sesiones cruzadas |
| INV-016 | Precio mostrado = precio del hold | Todo pasa por `compute_price` | ✅ | Retener otro importe |
| INV-017 | El comprador no ve pujas ni vendedores | RLS de `bids` sin políticas | ✅ | Rompe la opacidad (D5) |
| INV-018 | Conteos del Pulse nunca al cliente | `intensityBucket()` | ✅ | Fuga de intención |
| INV-019 | Importe retenido nunca al cliente | Solo `clientSecret` | ✅ | Expone mecánica bancaria |
| **INV-020** | **Un usuario, una vez por grupo** | ❌ Sin UNIQUE ni checks | 🔴 **ROTA · 2 casos** | Doble cobro y doble envío; inflado de demanda |
| **INV-021** | **Un teléfono → un usuario** | ❌ `users_phone_key` **no existe** | 🔴 **ROTA · 2 casos** | Amplía la superficie explotable de (tel,email) |
| **INV-022** | **Ningún grupo atrapado en `closing`** | ❌ Rama 9B-b sin salida | 🔴 **ROTA (latente)** | Holds caducando sin resolución |
| INV-023 | Todo `instructed` cobra o recibe instrucciones | ⚠️ Sin email: `failed++` **sin alerta** | ⚠️ Parcial | Un adjudicado no sabe que debe pagar |
| INV-024 | Todo hold acaba capturado o liberado | ⚠️ PIs huérfanos; fallo de captura deja hold vivo | ⚠️ Parcial | Dinero retenido indefinidamente |
| INV-025 | Solo `service_role` en lo money-critical | `has_function_privilege` verificado | ✅ | Cualquiera cerraría grupos |
| INV-026 | Una definición por función | 21 funciones, 0 duplicadas | ✅ | Llamadas a la versión equivocada |
| **INV-027** | **Ningún dato personal ajeno accesible** | ❌ 7 `SECURITY DEFINER` abiertas a `anon` | 🔴 **ROTA** | Pedidos ajenos y **redirección de envíos** |
| INV-028 | La UI muestra el precio que se cobraría | ⚠️ Stock **sobreestimado**; copy de "1 más" falso | ⚠️ Parcial | Frustración y promesas incumplidas |

---

# 7. KNOWN CRITICAL BUGS

*(Extracto. Los 28 problemas, en `KNOWN_ISSUES.md`.)*

### ✅ P0-01 · Miembros duplicados — RESUELTO (11-sep-2026)
**REGLA DE PRODUCTO** 1 usuario + 1 grupo = **1 pedido único**. Sin ampliación de pedido ni
segunda participación. · **RESOLUTION** Migración `p001_one_membership_per_user_per_group`, en
orden obligatorio: (1) rama `already_member` en `confirm_join` → libera el hold sobrante;
(2) índice parcial `uniq_member_per_group_alive` sobre `(group_id,user_id)`; (3) rechazo por
teléfono en `prepare_join`, antes del hold. · **⚠ EL ORDEN NO ES OPCIONAL**: el índice sin la
rama convierte el bug en holds atascados 7 días. · **VERIFIED** 22/22 en BD sintética + compra
real en producción con segundo intento bloqueado. · **LIMIT** La identidad es el **email**: la
misma persona con dos emails son dos `user_id` → depende de P0-02. · **HISTÓRICO** 3 pares
duplicados (no 2), todos en un grupo de test, todos `cancelled`, **0 € cobrados de más**. ·
**RELATED** `KNOWN_ISSUES.md` P0-01 · `supabase/p001_unique_member_per_group.sql`

### 🔴 P0-02 · Acceso a datos ajenos por (teléfono + email) desde `anon`
**PROBLEM** 7 funciones `SECURITY DEFINER` abiertas a `anon` resuelven identidad con parámetros
del cliente. · **CURRENT** Un POST sin autenticar a `/rest/v1/rpc/get_profile` con un par
(tel,email) devuelve perfil y direcciones de esa persona. · **ROOT CAUSE** `_profile_uid` cae a
(tel,email) sin sesión — **deliberado**, documentado en `supabase/profile_identity.sql`;
`get_my_groups` **no tiene camino de JWT en absoluto**. · **IMPACT** Pedidos ajenos,
`payment_info` bancario del vendedor, y **cambio de la dirección de envío predeterminada** →
redirección de un paquete físico. · **LOCATION** `_profile_uid`, `get_my_groups`, `get_profile`,
`address_*`, `radar_prefs_save` · **STATUS** 🔴 Activo (en `CLAUDE.md` como *"decisión aplazada"*)
· **RELATED** `SECURITY.md` SEC-01

### ✅ P0-03 · El checkout principal muestra éxito sin esperar al webhook — RESUELTO (12-sep-2026)
**RESOLUCIÓN** commit `1185b83`: `JoinFlow` hace el mismo polling contra `/api/join/status` que
`FastCheckoutModal` (18 intentos de 1 s, estado `confirming`, botón *"Confirmando tu plaza…"*). ·
**EL OBSTÁCULO ERA FALSO** no hizo falta que `create-intent` devolviera `pi_id`: ya viaja dentro
del `clientSecret` (`String(cs).split('_secret')[0]`). Cero cambios en backend. ·
**LOCATION** `grupo/[id]/unirme/JoinFlow.tsx` · **STATUS** ✅ Resuelto ·
**RELATED** `PAYMENTS.md` §7

### ✅ P0-04 · PaymentIntent sin idempotencia — RESUELTO (11-sep-2026)
**RESOLUTION** Commits `015f467` y `7c9798e`. La clave **se deriva del payload real** (SHA-256 de
los parámetros enviados) con `idempotencyKeyFor()` en `src/lib/stripe.ts`, aplicada en
`create-intent` (PaymentIntent **y** `customers.create`) y en `checkout/lock`. · **POR QUÉ
DERIVADA** Una clave escrita a mano (`grupo+teléfono+cantidad`) **falló en producción**: para un
invitado `customers.create` generaba un Customer nuevo en cada intento, `piParams.customer`
cambiaba y Stripe rechazaba la segunda petición. Derivándola del payload, clave y parámetros no
pueden divergir. · **BONUS** El Customer idempotente elimina el goteo de un Customer nuevo por
intento de invitado. · **VERIFIED** Dos peticiones idénticas a `/api/join/create-intent`
devolvieron el mismo PI (`pi_3UEaFzA114rXo3Ka0trWudSg`). · **RELATED** `PAYMENTS.md` §10.2

### ✅ P0-05 · `CRON_SECRET` — RESUELTO (11-sep-2026)
**PROBLEM** No se sabía si `CRON_SECRET` estaba configurada en Vercel; el cron **falla cerrado**
(sin la variable devuelve 401 y no cierra nada). · **RESOLUCIÓN** Verificado en el panel de
Vercel el 11-sep-2026: **existe**, en Production y Preview, actualizada el 4-jul-2026. El cierre
automático dominical está armado y se dispara. · **LOCATION**
`api/cron/close-groups/route.ts:21-25` · **STATUS** ✅ **VERIFICADO** · **RELATED** §13 PV-05

### P1 (detalle en `KNOWN_ISSUES.md`)
| ID | Problema | Status |
|---|---|---|
| P1-01 | Deriva producción ↔ repositorio en 7 funciones | 🔴 Activo |
| P1-02 | `prepare_join.sql` **corrupto** (línea 78 `$function$;R REPLACE FUNCTION`) | 🔴 Activo |
| P1-03 | Multi-puja **nunca ejecutada con dinero real** (Gate G6) | ⚪ Fuera del MVP (12-sep) — un grupo, una puja |
| P1-04 | Grupo **atrapado en `closing`**; `second_price_at_n` siempre NULL | ⚪ Inalcanzable con una sola puja |
| P1-05 | Adjudicado sin email: sin instrucciones y **sin alerta** | 🟠 Activo |
| P1-06 | **Cero tests**; sin script `test` | 🟠 Estructural |
| P1-07 | `users_phone_key` **no existe** → código inalcanzable; 2 teléfonos duplicados | 🟠 Activo |

*(P2: stock sobreestimado · adjudicación sin relleno · `rate_limits` sin límite · copy de
compartir obsoleto · PIs huérfanos · nadie avisa a quien queda fuera · fail-open · cookie de
admin. P3: componentes huérfanos · rebranding · `price_mode` · 75% · enums muertos · `lang="en"`
· fallback de `/api/my-groups` · README.)*

---

# 8. SECURITY RED FLAGS

> **Hay riesgos de seguridad ACTIVOS en producción. No son teóricos.**

### ACTUALES
| Riesgo | Detalle |
|---|---|
| **RPC anónimo** | 7 funciones con `EXECUTE` para `anon`: `get_my_groups`, `get_profile`, `address_add/update/delete/set_default`, `radar_prefs_save` |
| **`SECURITY DEFINER`** | Esas 7 **sortean la RLS**: que las tablas la tengan activa **no protege** frente a ellas |
| **`get_my_groups`** | 🔴 El peor caso: filtra por `phone AND email` **sin ningún camino de JWT** |
| **Fallback de identidad** | `_profile_uid` usa el JWT si hay sesión; sin sesión cae a (tel,email) del cliente. **Deliberado**, por retrocompatibilidad SSR |
| **Direcciones** | `get_profile` devuelve **todas** las direcciones; `address_update`/`set_default` permiten **cambiar la predeterminada ajena** → **redirección de un envío físico** |
| **Pedidos y banco del vendedor** | `get_my_groups` expone precios, estados y `bids.payment_info` |
| **Cookie de admin = `ADMIN_SECRET`** | El valor **es** el secreto maestro (el mismo de `/api/email/close-payment`). Sin rotación, sin 2FA, sin auditoría |
| **Rate limiting fail-open** | Si `check_rate_limit` falla, la petición **continúa** |

> ⚠️ **El fix no es un `REVOKE` directo.** Hay **9 puntos de llamada** desde el navegador con la
> clave anon: 7 en `src/app/perfil/page.tsx` (73, 112, 127, 133, 149, 150, 156), 1 en
> `src/app/notificaciones/page.tsx:47`, 1 en `src/app/grupo/[id]/unirme/JoinFlow.tsx:791`.
> Todos leen el par de `localStorage['vonda_user']`. Revocar sin migrarlos rompe `/perfil`,
> `/notificaciones` y el prefill del checkout. El patrón correcto ya existe: **`/api/my-groups`**
> verifica la sesión y saca el email del JWT.

### HISTÓRICOS (cerrados)
`join_group` permitía crear miembros sin tarjeta → **función eliminada** · `bids` era legible
públicamente → RLS **sin políticas** + escalera fusionada · `create_petition` pisaba `phone`/`name`
ajenos → endurecimiento "H3" con `COALESCE` · cookies partidas apex/`www` → `.gropo.es` + barrido
de `sb-*`.

**Controles que SÍ funcionan** (no los rompas): firma del webhook con cuerpo crudo · service_role
aislada · money-critical con `anon=false` · `bids` ilegible · validación server-authoritative del
`target_price` · importe retenido nunca al cliente · SetupIntent verificado contra Stripe · cero
`dangerouslySetInnerHTML` · cero concatenación de SQL. → `SECURITY.md` §6.

---

# 9. PAYMENT RED FLAGS

**Tres emisores de PaymentIntent, misma forma de metadata** (a propósito: un solo webhook sirve a
los tres):

| Origen | Fichero | `confirm` | `off_session` | `idempotencyKey` |
|---|---|---|---|---|
| Checkout normal | `create-intent/route.ts:167` | ❌ | ❌ | 🔴 **NO** |
| 1-Click | `checkout/lock/route.ts:156` | ✅ | `false` | 🔴 **NO** |
| Pulse | `src/lib/pulse.ts:140` | ✅ | **`true`** | ✅ sí |

`capture_method:'manual'` autoriza sin cobrar y **caduca a los 7 días**; el importe lo calcula el
servidor y **nunca viaja al cliente**. El cliente llama a `confirmPayment` — **eso NO crea la
membresía**: el webhook escucha **solo** `payment_intent.amount_capturable_updated` (no
`succeeded`) y llama a `confirm_join`, que es quien **crea el miembro**.

**HAY protección en:** idempotencia de la membresía (`IF EXISTS` + UNIQUE + rama
`already_processed`, **nunca `needs_release`**) · concurrencia (`FOR UPDATE`) · reintentos
(**500 deliberado** si falla `cancel`) · capturas (por estado en BD + reconciliación con Stripe) ·
Pulse (advisory lock + `idempotencyKey` + verificación del SetupIntent).

**HAY protección, desde el 11-sep-2026, también en:** ✅ creación del PaymentIntent y del
Customer (`idempotencyKeyFor`, clave derivada del payload — P0-04) · ✅ dedup de membresía
(índice parcial `uniq_member_per_group_alive` + rama `already_member` que libera el hold — P0-01).

**HAY protección, desde el 12-sep-2026, también en:** ✅ `JoinFlow` espera al webhook antes de
cantar éxito (P0-03, polling 18 s, igual que `FastCheckoutModal`) · ✅ el pedido queda congelado
durante el checkout y `elements.submit()` tiene un límite de 20 s (P0-06 mitigado).

**NO la hay en:**
⚠️ PIs abandonados quedan huérfanos · ⚠️ `captureIdempotent` acepta un PI ya `succeeded` **sin
verificar el importe** · 🔴 **no existe ningún mecanismo de reembolso**.

---

# 10. DATABASE REALITY

> **Antes de modificar una función crítica de BD, comprueba la versión desplegada en producción.**
```sql
SELECT pg_get_functiondef(p.oid) FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' AND p.proname='<nombre>';
```

| Función | Args producción | Args repo | Diferencias relevantes |
|---|---|---|---|
| `compute_price` | `(uuid,integer,numeric)` | `(uuid,integer)` | Multi-puja · `p_extra_target` simula esperador · `next_price` = `MAX(price) WHERE price < best`, NULL si no hay |
| `tier_demand` | `(uuid)` | `(uuid)` | **Misma firma, algoritmo distinto**: fusión de todas las pujas con **mínimo acumulado** y dedup por precio |
| `prepare_join` | `(uuid,text,integer)` | igual | Producción **sin** check de duplicado; guard sobre **comprometidas** con `GREATEST`. Repo con check y guard sobre `total_units`. **Fichero CORRUPTO** |
| `confirm_join` | 11 args | 11 args | Producción **sin** check; `EXCEPTION` discrimina por `CONSTRAINT_NAME` (`users_phone_key` → **rama inalcanzable**) |
| `close_group` | `(uuid)` | `(uuid)` | **v2**: candidata con settlement propio · **PMA universal** · `bids → outbid` en Regla 6 · rama "excedente sin 2ª puja". Repo: **v1** |
| `get_my_groups` | `(text,text)` | `(text)` | Producción exige email y devuelve `join_mode`, `target_price`, `payment_info` |
| `create_petition` | 7 args **v3** | 7 args v1 | Anti-spam 5/h por teléfono · upsert **no destructivo** (`COALESCE`) |
| `join_group` | **NO EXISTE** | referenciada | Eliminada, no solo revocada |

**Coinciden:** `shipping_columns.sql` · `event_type_add_petition_created.sql`.

**Dos reglas de PL/pgSQL que ya causaron incidentes aquí:** `CREATE OR REPLACE` con firma
distinta crea una **SOBRECARGA**, no reemplaza · `DROP + CREATE` **resetea los permisos a
`PUBLIC EXECUTE`**.
**Verificado:** 21 funciones, **0 sobrecargas**; money-critical con `anon=false`.

---

# 11. OPEN PRODUCT DECISIONS

| # | Decisión abierta | Qué se sabe | Qué falta decidir |
|---|---|---|---|
| **OD-01** | **Margen / comisión de Gropo** | ❓ No existe ninguna columna, constante ni cálculo. El comprador paga el precio del tramo | El modelo de ingresos y dónde se materializa |
| **OD-02** | **Eliminación de los checks de duplicado** | Están en los `.sql`, no en producción. Sin comentario ni commit. La rama `users_phone_key` sugiere una constraint nunca creada | Si fue deliberado (¿"ampliar pedido"?) o una regresión |
| **OD-03** | **Adjudicación sin relleno** | El corte `cum_qty <= max_stock` es por filas completas: si un pedido no cabe entero, quedan fuera él **y todos los posteriores** | Si el FCFS estricto sin fraccionar es lo deseado |
| **OD-04** | **Comunicación a quien queda fuera** | Solo se escribe a `instructed` y `paid`. Los liberados **no reciben nada** | Si debe existir y con qué contenido |
| **OD-05** | **Excedente con segunda puja** | El grupo queda en `closing` esperando al admin, **sin UI ni función** para resolverlo | Qué debe pasar con el excedente |
| **OD-06** | **Transportista de Sendcloud** | Default del código: **`sendcloud:letter`**; `CLAUDE.md` dice `correos_express:paq24` | Cuál es el efectivo en producción |

---

# 12. NOT IMPLEMENTED

> **Mencionado en documentación o producto, pero NO existe en el código.** No lo implementes
> creyendo que ya está.

| Funcionalidad | Realidad verificada |
|---|---|
| **Cláusula de tolerancia del 75%** | 🔴 No existe. Buscados `75%`, `0.75`, `tolerancia`: solo confeti y carousel |
| **Precio fluido (`price_mode='fluid'`)** | 🔴 Ningún motor lee `price_mode`; `compute_price_at_n` **sin llamantes**. Todo es `stepped` |
| **Pujas mejorables y JAMÁS retirables (+3%)** | 🔴 Histórica y **contradicha**: `withdrawBid` sí retira; se aceptan pujas peores; `improved_at`/`bid_revisions` nunca se escriben |
| **Reembolsos** | 🔴 Cero llamadas a `stripe.refunds`; `refund_due` nunca se escribe |
| **Tramo 1 ≤ mejor precio público del vendedor** | 🔴 Ninguna verificación |
| **Teléfono único (`users_phone_key`)** | 🔴 La constraint no existe; hay código que la asume |
| **Dedup de membresía** | 🔴 Eliminado de producción, sin constraint sustituta |
| **Categorías de producto** | 🔴 No existe columna `category`; la ficha hardcodea `"· Deporte"` |
| **Historial público de pujas** | 🔴 `bid_placed`/`bid_improved` **nunca se insertan** |
| **Notificación a vendedores** | 🔴 No existe; los vendedores tienen email sintético y **no pueden iniciar sesión** |
| **Tests automatizados** | 🔴 Cero |
| **`/peticion`** | 🔵 Placeholder. La funcional es `/crear-peticion` |

---

# 13. PRODUCTION VERIFICATION REQUIRED

| # | Verificar | Dónde | Por qué |
|---|---|---|---|
| **PV-01** | Modo de Stripe (test/live) y claves activas | Stripe + Vercel | ✅ **VERIFICADO 11-sep-2026:** modo **test** (sandbox). El cutover a live sigue pendiente |
| **PV-02** | **URL del webhook dada de alta** | Stripe → Webhooks | ✅ **VERIFICADO 11-sep-2026:** `https://www.gropo.es/api/stripe/webhook` (`we_1TjGhOA114rXo3Kahd7KyxWg`), **único destino activo**, probado de extremo a extremo |
| **PV-03** | Eventos suscritos | Stripe | ✅ **VERIFICADO 11-sep-2026:** uno solo, `payment_intent.amount_capturable_updated` — el correcto para captura manual |
| **PV-04** | Que `STRIPE_WEBHOOK_SECRET` corresponde a ese endpoint | Stripe + Vercel | ✅ **VERIFICADO 11-sep-2026:** sí. Entrega en 200 + miembro creado; con firma inválida habría sido 400 |
| **PV-05** | **`CRON_SECRET` en Vercel** | Vercel | ✅ **VERIFICADO 11-sep-2026:** presente en Production y Preview (actualizada el 4-jul). El cierre automático está armado |
| **PV-06** | Las otras 17 variables ausentes de `.env.local` | Vercel | `RESEND_*`, `ADMIN_EMAIL`, `NEXT_PUBLIC_SITE_URL` y **las 12 de Sendcloud** |
| **PV-07** | Si `vonda.es` sigue resolviendo | DNS | ✅ **VERIFICADO 11-sep-2026:** sí resuelve, y es un **alias del MISMO proyecto de Vercel** que `gropo.es` (mismo código, mismas variables, misma BD). Su portada sirve una copia cacheada antigua. Los enlaces de los emails del Pulse siguen siendo deuda de rebranding |
| **PV-08** | Supabase Auth y **Custom SMTP** | Supabase | El SMTP integrado limita a ~2-4 emails/h **para toda la app** (bloqueante) |
| **PV-09** | Rotación de claves de Sendcloud | Sendcloud | *"Expuestas en chat"*, pendiente desde julio |
| **PV-10** | Declaración del trigger sobre `auth.users` | Supabase (`auth`) | Solo se auditó la función |
| **PV-11** | Contenido de `bids.payment_info` | Supabase | Datos bancarios; no leídos deliberadamente |

---

# 14. WHERE TO LOOK

| Question | Read this first |
|---|---|
| Precio, adjudicación y cierre | **`docs/ALGORITHM.md`** |
| Base de datos: tablas, constraints, RLS, funciones | `docs/DATABASE.md` |
| Pagos: holds, webhook, idempotencia | `docs/PAYMENTS.md` |
| Seguridad: vulnerabilidades y controles | `docs/SECURITY.md` |
| Reglas de negocio realmente implementadas | `docs/BUSINESS_RULES.md` |
| Endpoints, server actions y RPC de cliente | `docs/API.md` |
| Pantallas, flujos, qué es real y qué decoración | `docs/UX_AND_FLOWS.md` |
| Cómo está montado y **por qué** (16 ADR) | `docs/ARCHITECTURE.md` |
| Qué está roto y con qué prioridad | `docs/KNOWN_ISSUES.md` |
| Qué hace el proyecto caro de cambiar | `docs/TECHNICAL_DEBT.md` |
| **Con qué criterio se juzga una pantalla, un flujo o un copy** | **`docs/PRODUCT_PRINCIPLES.md`** |
| Cómo pasar a pagos reales, paso a paso | `docs/LAUNCH_CHECKLIST.md` |
| Panorama, invariantes, dependency map, DO NOT ASSUME | `docs/PROJECT_KNOWLEDGE_PACK.md` |
| **Protocolo, comandos y checklist** | **`docs/CONTINUE_DEVELOPMENT.md`** |

**Rutas reales:** checkout `grupo/[id]/unirme/JoinFlow.tsx` · 1-Click `components/checkout/` ·
webhook `api/stripe/webhook/route.ts` · holds `api/join/create-intent` y `api/checkout/lock` ·
captura `lib/stripe-capture.ts` · cierre `admin/grupos/[id]/actions.ts` · crons `api/cron/` ·
Pulse `lib/pulse.ts` · ventana y DST `lib/closeWindow.ts` · envíos `lib/shipping-sendcloud.ts` ·
emails `lib/emails/` · guard admin `lib/admin-auth.ts` · Supabase `lib/supabase*.ts` · cookies
`lib/auth-cookie-domain.ts` y `middleware.ts` · escalera `hooks/useTierDemand.ts` ·
**SQL histórico (no es producción)** `supabase/*.sql`. (Todo bajo `src/`.)

---

# 15. DEVELOPMENT PROTOCOL

**BEFORE CODING** ① Entiende el cambio; si es ambiguo, **pregunta antes de tocar nada**.
② Identifica las reglas de negocio afectadas (`BUSINESS_RULES.md`). ③ Lee la documentación
relevante (§14). ④ **Localiza la implementación real**: para SQL, extrae la definición de
producción (§10). ⑤ **Comprueba la deriva** producción ↔ repositorio. ⑥ **Identifica las
invariantes** (§6) y di cuáles podrías romper. ⑦ **Identifica dependencias**: § DEPENDENCY MAP
del `PROJECT_KNOWLEDGE_PACK.md` + búsquedas reales; para una función SQL, búscala **también
dentro del cuerpo de las otras 20**. ⑧ Si toca `compute_price`, `tier_demand`, `prepare_join`,
`confirm_join`, `close_group`, `pulse_*`, RLS o Stripe → **es money-critical**: avisa con ⚡,
presenta la propuesta y **espera confirmación explícita**.

**DURING CODING** El cambio mínimo seguro · no reescribas código no relacionado · **no inventes
reglas de negocio** (si hace falta una decisión de producto, pregunta con ejemplos numéricos) ·
no cambies UX en silencio · **no cambies la semántica de los pagos** sin análisis de idempotencia
· **no cambies constraints sin comprobar los datos existentes** (hoy hay 2 duplicados de
`(group_id,user_id)` y 2 de teléfono: **una constraint nueva fallaría**) · **no asumas que las
migraciones históricas son la verdad de producción**.

**AFTER CODING**
```bash
npm run build   # typecheck de facto: falla ante errores de TypeScript
npm run lint
```
**Tests: ❌ no existen.** Sustitúyelos por consultas SQL de verificación con datos reales antes y
después, y un guion de QA manual para Benjamin. Revisa el diff (`git status`/`git diff`, **solo
lectura**). **Si tocaste una función SQL: re-extráela con `pg_get_functiondef` y actualiza el
fichero de `supabase/`** — es la única forma de no agrandar la deriva. Verifica sobrecargas y
permisos con `pg_proc` + `has_function_privilege`. Explica ficheros cambiados y riesgos (§16 H).

---

# 16. AI RESPONSE PROTOCOL

**A. UNDERSTAND** ¿Qué quiere conseguir? ¿Comportamiento, presentación o regla de negocio?
**B. LOCATE** ¿Qué lo controla? ¿TypeScript o SQL? (Aquí la lógica de negocio suele estar en
PostgreSQL.)
**C. IMPACT** Llamantes, invariantes, seguridad, concurrencia, dinero.
**D. VERIFY** ¿Lo local coincide con producción? **Extrae la definición viva.**
**E. PLAN** El cambio mínimo. Money-critical → propuesta primero, ejecución tras confirmación.
**F. IMPLEMENT** Solo lo necesario.
**G. VALIDATE** `npm run build`, `npm run lint`, verificación SQL, guion de QA manual.
**H. REPORT** Por separado: qué cambió · dónde (fichero y línea) · por qué · **qué NO cambió**
(y qué decisiones de producto detectaste pero no tomaste) · riesgos y qué no pudiste verificar ·
qué comprobaciones ejecutaste.

**Cómo trabaja Benjamin:** no escribe código. Dale **comandos exactos para copiar y pegar**, dile
dónde hacer clic y qué debería ver. **Distingue siempre `ACCIÓN DEL USUARIO` de `ACCIÓN DE LA
IA`.** Escribe **en castellano**. Avísale antes de cualquier acción que pueda romper producción,
perder datos o generar costes. **Nunca toques `.git/`.**

---

# 17. NEVER DO THIS

1. No asumas que `supabase/*.sql` es producción — 7 de 9 desfasados, uno corrupto.
2. No asumas que `CLAUDE.md` describe la realidad — habla de *Vonda* y lista dos componentes
   muertos como "Archivos clave".
3. No te fíes de una cabecera que diga *"Definición VIVA sincronizada desde producción"*.
4. **No implementes nada de §12 sin que te lo pidan.**
5. **No añadas ni elimines constraints sin analizar los datos existentes** — un UNIQUE sobre
   `(group_id,user_id)` **fallaría hoy**.
6. No cambies el flujo de pago sin analizar Stripe y la idempotencia (§9).
7. No cambies el precio sin leer `ALGORITHM.md` entero, incluida la asimetría del PMA.
8. No toques una `SECURITY DEFINER` sin entender sus llamantes, incluidos los del navegador.
9. **No revoques `EXECUTE` a `anon` sin migrar antes los 9 puntos de llamada.**
10. **No arregles un bug creando otro.** Ejemplo real: restaurar el check de duplicado en
    `confirm_join` sin cuidado podría hacer que devuelva `needs_release` ante un
    `uniq_group_members_pi` → **cancelaría el hold de una membresía existente**.
11. No hagas refactors grandes cuando se te pidió un cambio concreto.
12. **No quites el `PERFORM 1 FROM groups … FOR UPDATE` de `confirm_join`** — es lo único que
    evita el overselling.
13. **No confundas `groups.total_units` con un contador de stock.**
14. **No hagas que `close_group` use `compute_price`** — la v2 usa PMA universal.
15. **No elimines el `INSERT INTO events` de `confirm_join`** — es el latido de la UI en vivo.
16. No añadas un campo a la metadata del PaymentIntent tocando un solo emisor: **son tres**, y un
    olvido falla en silencio.
17. No "limpies" el código muerto de paso (14 componentes) salvo que sea el encargo.
18. **No arregles los P0 sin que te lo pidan** — están documentados para que la decisión sea
    consciente.
19. **No imprimas ni copies valores de variables de entorno, claves ni secretos.**
20. **No ejecutes comandos de git que escriban.** Git lo corre Benjamin.

---

# 18. CURRENT PRIORITY

> Orden tomado literalmente de `KNOWN_ISSUES.md` (P0 → P3) y de los `STATUS` de
> `BUSINESS_RULES.md`. **No he decidido yo qué arreglar primero.**

| Priority | Issue | Why | Status | Dependencies |
|---|---|---|---|---|
| — | P0-01 Miembros duplicados | Rompía INV-020: doble cobro, doble envío | ✅ **RESUELTO** 11-sep-2026 | Ninguna |
| P1 | P0-06 Checkout colgado al cambiar la cantidad | Atrapaba al comprador en "Procesando…" | 🟠 **No reproducible** (7 configuraciones, 12-sep) · **síntoma mitigado** `ed80b1c` | Causa UNKNOWN. Ver `KNOWN_ISSUES.md` P0-06 antes de tocarlo: cuatro hipótesis ya descartadas |
| P0 | P0-02 Acceso a datos ajenos | Rompe INV-027; redirección de envíos | 🔴 Activo | Migrar antes los **9 puntos de llamada** |
| — | P0-03 Éxito sin esperar al webhook | El usuario creía que compró y no compró | ✅ **RESUELTO** 12-sep-2026 (`1185b83`) | Ninguna |
| — | P0-04 PaymentIntent sin idempotencia | Era la causa directa de P0-01 | ✅ **RESUELTO** 11-sep-2026 | Ninguna |
| — | P0-05 `CRON_SECRET` en Vercel | Sin ella los grupos no se cerrarían | ✅ **RESUELTO** 11-sep-2026 | Ninguna |
| P1 | P1-01 Deriva producción ↔ repo (quedan **5**) | Se razona sobre un algoritmo inexistente | 🟠 Parcial — `prepare_join` y `confirm_join` sincronizados 11-sep | Ninguna |
| — | P1-02 `prepare_join.sql` corrupto | No parseaba ni como referencia | ✅ **RESUELTO** 11-sep-2026 | Ninguna |
| — | P1-03 Multi-puja sin ensayo real (G6) | Sin validación empírica | ⚪ **FUERA DEL MVP** (decisión 12-sep) | Reabrir antes de permitir 2 pujas activas |
| — | P1-04 Grupo atrapado en `closing` | Holds caducando sin salida | ⚪ Inalcanzable con una puja activa | **OD-05** · reabrir con multi-puja |
| P1 | P1-05 Adjudicado sin email ni alerta | Nunca sabe que debe pagar | 🟠 Activo | Ninguna |
| P1 | P1-06 Cero tests | Sin red de seguridad con dinero real | 🟠 Estructural | Ninguna |
| P1 | **P1-08 Apple Pay / G Pay anunciados y no operativos** | Se muestran logos de métodos que no funcionan: conversión y confianza | 🔴 Activo | Registrar el dominio en Stripe |
| P1 | P1-07 `users_phone_key` inexistente | Rompe INV-021; la rama que lo cita en `confirm_join` es **código muerto** | 🟠 Activo | Ninguna (P0-01 ya no depende de él) |
| P2 | P2-01…P2-08 | Stock sobreestimado · sin relleno · `rate_limits` · copy obsoleto · PIs huérfanos · nadie avisa · fail-open · cookie de admin | 🟡 Activos | P2-02 → **OD-03**; P2-06 → **OD-04** |
| P3 | P3-01…P3-08 | Huérfanos · rebranding · `price_mode` · 75% · enums muertos · `lang="en"` · fallback · README | 🔵 Cosméticos | Ninguna |

**Bloqueantes de negocio declarados** (no son bugs): cutover Stripe test → live · rotación de
claves Sendcloud · conseguir un vendedor real · **Custom SMTP en Supabase Auth**.

---

# 19. FINAL HANDOFF SUMMARY

## IF YOU ONLY REMEMBER 10 THINGS

1. **La base de datos de producción es la fuente de verdad.** No hay migraciones; **7 de 9
   funciones SQL del repositorio están desfasadas** y `prepare_join.sql` está corrupto.
2. **`PERFORM 1 FROM groups … FOR UPDATE` en `confirm_join` es el lock central del sistema.** Es
   lo único que evita el overselling, y es el mismo que toma `close_group`.
3. **El PMA no es uniforme:** `compute_price` cuenta `comprar` a **todos** los precios;
   `close_group` usa su **`guaranteed_price`** como techo. Deliberado, y la sutileza más
   peligrosa del proyecto.
4. **`groups.total_units` NO es un contador de stock.** Es demanda firme al precio vigente:
   fluctúa, **puede bajar**, y puede ser **0 con 15 miembros vivos**.
5. **La membresía la crea el webhook de Stripe, nunca el cliente.** Un pago confirmado en el
   frontend **no** significa que exista membresía — y `JoinFlow` no espera a comprobarlo.
6. **No hay deduplicación de membresías en ninguna capa.** **Ya hay 2 duplicados reales**: una
   constraint nueva fallaría hoy.
7. **Hay una vulnerabilidad activa:** 7 funciones `SECURITY DEFINER` abiertas a `anon` permiten
   leer pedidos ajenos y **cambiar la dirección de envío de otra persona**. Revocar sin más rompe
   9 puntos de llamada del frontend.
8. **La cláusula del 75% y el precio fluido NO existen en el código**, aunque la documentación y
   la base de datos sugieran lo contrario. Consulta §12 antes de dar algo por implementado.
9. **No hay tests.** `npm run build` y `npm run lint` es todo. Sustitúyelos por verificación SQL
   contra datos reales y un guion de QA manual.
10. **Producción está prácticamente vacía:** 1 grupo de prueba, 0 cierres, 15 miembros todos en
    `authorized`. El **multi-puja nunca ha corrido con más de una puja**.

---

*Siguiente lectura: **`docs/CONTINUE_DEVELOPMENT.md`** (protocolo) y **`docs/ALGORITHM.md`**
(el motor).*
