# PROJECT KNOWLEDGE PACK — Gropo

> **ANEXO ESTRUCTURAL de la documentación técnica del proyecto.**
>
> **No es el punto de entrada ni una fuente de verdad independiente.**
> El punto de entrada es **`AI_HANDOFF.md`**; este documento se lee después, como anexo.
>
> Auditoría realizada el **6 de septiembre de 2026** (segunda pasada) contra:
> - el repositorio local `/Users/benjamin/Desktop/kuorum` en **`main @ 7c49ef3`**
>   (working tree limpio, 0 commits sin subir, remoto `thedesignerux-lgtm/kuorum`);
> - la **base de datos de producción** `xpktkuozspreuxucnguh`, leída en vivo con
>   `pg_get_functiondef`, `has_function_privilege`, `pg_proc`, `pg_constraint`, `pg_indexes`,
>   `pg_policy`, `pg_type`/`pg_enum` y consultas de datos reales.
>
> Este documento **no repite** el contenido de los módulos. Reúne la jerarquía de fuentes, los
> invariantes, el mapa de dependencias y lo que no debe asumirse al abrir cualquiera de ellos.

---

## SOURCE OF TRUTH

**Jerarquía de fuentes de verdad. Ante cualquier contradicción, manda la fuente de mayor rango.**

| # | Fuente | Autoridad |
|---|---|---|
| **1** | **Base de datos, funciones y policies desplegadas en producción** | 🥇 **MÁXIMA.** Es donde vive la lógica de negocio de este proyecto |
| **2** | **Código actualmente desplegado** (lo que Vercel sirve) | Alta |
| **3** | **Código presente en el repositorio** (`main @ 7c49ef3`) | Alta — hoy coincide con (2): working tree limpio y 0 commits sin subir |
| **4** | **Migraciones y SQL históricos** (`supabase/*.sql`) | ⚠️ **BAJA. Son HISTORIA, no implementación** |
| **5** | **`CLAUDE.md`, `AGENTS.md` y los handoffs** | Baja — describen un producto llamado *Vonda* que hoy se llama *Gropo* |
| **6** | **Comentarios en el código** | Baja — varios están obsoletos (ver DISCREPANCIA-06) |
| **7** | **Suposiciones** | ❌ **Ninguna.** Si no se puede demostrar, se marca `UNKNOWN` |

### Regla explícita sobre el SQL histórico

> 🔴 **Los ficheros `supabase/*.sql` NO deben describirse como la implementación actual.**
> **No hay sistema de migraciones** (no existe `supabase/migrations/`, ni Prisma, ni Drizzle).
> Son copias manuales, y **7 de ellas están desfasadas**:
> `compute_price.sql`, `tier_demand.sql`, `prepare_join.sql` (además **corrupto**),
> `confirm_join.sql`, `close_group.sql`, `get_my_groups.sql` y `create_petition.sql`.
> `revoke_join_group.sql` referencia una función (`join_group`) que **ya no existe**.
> Solo `shipping_columns.sql` y `event_type_add_petition_created.sql` (DDL aditivo idempotente)
> siguen siendo coherentes.
>
> Detalle completo: `DATABASE.md` §9 y `ALGORITHM.md` §12.

### Cómo se documenta una contradicción en estos documentos

```
CURRENT PRODUCTION  → cómo funciona hoy (fuente de rango 1-2)
REPOSITORY          → qué hay en el código local (rango 3)
HISTORICAL          → qué había antes (rango 4-5)
DISCREPANCIES       → la diferencia, con su impacto y su gravedad
```
Cuando producción y repositorio difieren en una función SQL:
**PRODUCTION IMPLEMENTATION = SOURCE OF TRUTH.**

---

## LOS DOCUMENTOS

| Documento | Es la fuente de verdad de… |
|---|---|
| **`AI_HANDOFF.md`** ⭐ | **ÚNICO punto de entrada. Léelo primero: identidad, realidad actual, mapa del sistema, invariantes y protocolo** |
| **`ALGORITHM.md`** ⭐ | El motor: `compute_price`, `tier_demand`, `prepare_join`, `confirm_join`, `close_group`, multi-puja, PMA, tramos, unidades, adjudicación |
| **`DATABASE.md`** | Esquema real: 11 tablas, 7 enums, 21 funciones, constraints, índices, RLS, relaciones, datos de producción |
| **`PAYMENTS.md`** | Hold-then-capture, los 3 emisores de PaymentIntent, el webhook, estados de pago, idempotencia, capturas, reembolsos |
| **`SECURITY.md`** | Vulnerabilidades clasificadas (2 CRITICAL, 2 HIGH, 5 MEDIUM, 4 LOW) y los controles que sí funcionan |
| **`API.md`** | Los 21 route handlers, los 10 server actions y las 9 RPC llamadas desde el navegador |
| **`BUSINESS_RULES.md`** | 60 reglas con `STATUS` demostrable (`IMPLEMENTED` / `PARTIALLY` / `NOT_IMPLEMENTED` / `HISTORICAL` / `UNKNOWN`) |
| **`UX_AND_FLOWS.md`** | Pantallas, flujos, estados de UI, y qué es lógica real frente a decoración |
| **`ARCHITECTURE.md`** | Cómo está montado el sistema y **por qué** (16 ADR), stack real, frontera de confianza |
| **`KNOWN_ISSUES.md`** | 28 problemas priorizados P0–P3, con evidencia |
| **`TECHNICAL_DEBT.md`** | 19 elementos de deuda estructural y su coste |
| **`CONTINUE_DEVELOPMENT.md`** | **Guía operativa: protocolo, comandos y checklist. Se aplica DESPUÉS de `AI_HANDOFF.md`** |

---

## QUÉ ES GROPO — EN 10 LÍNEAS

Plataforma web de **compra colectiva con precio dinámico descendente y liquidación única**, para
España. Los compradores se unen a un grupo; el precio baja por tramos conforme entra demanda
respaldada con dinero (retenciones de tarjeta); el grupo cierra en una fecha fija y **todos los
adjudicados pagan el mismo precio final**, aunque hayan entrado cuando el precio era más alto.

Gropo es **merchant-of-record**: cobra por Stripe y gestiona el envío por Sendcloud.
Stack: Next.js 14 App Router · Supabase (PostgreSQL + Auth + Realtime) · Stripe (captura manual)
· Resend · Sendcloud v3 · Vercel · Tailwind.

**Nombres:** el producto se llama **Gropo** (rebranding en el commit `c29eb2b`).
Nombres anteriores: **Vonda** (toda la documentación, y aún presente en URLs y remitentes),
**Kuorum** (nombre del repositorio y de `package.json`), **Grupeta** (alias histórico).

---

## CRITICAL SYSTEM MAP

Solo componentes y funciones **reales**. 🔴 = crítico (un error aquí cobra mal a personas
reales o rompe la seguridad).

```
                          USUARIO (navegador)
                                 │
                                 ▼
                    /  ──► src/app/page.tsx  (SSR)
                                 │  tier_demand() × N grupos
                                 ▼
                  PRODUCTO / GRUPO  ──► /grupo/[id]/page.tsx
                                 │  🔴 compute_price()   ← precio vigente
                                 │  🔴 tier_demand()     ← escalera pública fusionada
                                 │     bids (max_stock, min_execution de la ganadora)
                                 ▼
                    ┌────────────────────────────┐
                    │  PRECIO EN VIVO            │
                    │  useTierDemand ◄── Realtime│◄── events (INSERT)
                    │  usePulse ◄── polling 20 s │
                    └──────────────┬─────────────┘
                                   │
              JOIN  ──► /grupo/[id]/unirme  (JoinFlow, 1036 líneas)
                        ó FastCheckoutModal (1-Click)
                                   │
                                   ▼
                   🔴 POST /api/join/create-intent
                       │  check_rate_limit()            [FAIL-OPEN]
                       │  🔴 prepare_join()             ← guaranteed_price + guards
                       │  🔴 tier_demand()              ← valida target_price
                       │  stripe.customers.create/retrieve
                       ▼
                   🔴 PAYMENT INTENT  (capture_method:'manual')
                       │  metadata = CONTRATO de 3 emisores → 1 consumidor
                       ▼
                      STRIPE   ── 3D Secure ──►  requires_capture  (HOLD, caduca en 7 días)
                       │
                       │  webhook payment_intent.amount_capturable_updated
                       ▼
                   🔴 POST /api/stripe/webhook   (firma verificada, cuerpo crudo)
                       │  guard metadata.group_id
                       ▼
                   🔴 confirm_join()  ── SECURITY DEFINER, solo service_role
                       │  ① idempotencia por stripe_payment_intent_id
                       │  🔴 ② PERFORM 1 FROM groups ... FOR UPDATE  ← EL LOCK CENTRAL
                       │  ③ guard de stock (unidades comprometidas)
                       │  ④ INSERT group_members (payment_status='authorized')
                       │  ⑤ UPDATE groups.current_price / next_price / total_units
                       │  ⑥ INSERT events  ──────────────► latido de la UI en vivo
                       ▼
                   ESTADO DEL GRUPO  (groups + group_members)
                       │
                       │  ┌─ efectos no-fatales ─────────────────┐
                       │  │ Resend (confirmación)                │
                       │  │ 🔴 runPulseTrigger() ── si NO es Pulse│
                       │  │ notifyReachableWatchers()            │
                       │  └───────────────────────────────────────┘
                       ▼
              domingo 21:00 UTC · vercel.json  ──►  🔴 GET /api/cron/close-groups
                       │  Bearer CRON_SECRET  (falla cerrado)
                       ▼
                   🔴 closeGroup()  server action  (= el botón del admin)
                       ▼
                   🔴🔴 close_group()  ── LA FUNCIÓN MÁS CRÍTICA
                       │  ① SELECT ... FOR UPDATE + guard de estado (idempotente)
                       │  ② status = 'closing'
                       │  ③ selección de candidata (multi-puja, PMA universal)
                       │  ④ 🔴 liberar a todo el que no llegue al settlement con SU PMA
                       │  ⑤ re-check de min_execution
                       │  ⑥ adjudicar por join_order mientras cum_qty ≤ max_stock
                       │  ⑦ excedente → closed / closed+released / 🔴 ATRAPADO EN 'closing'
                       ▼
                   🔴 captureGroupPayments()  ── fuera de la transacción
                       │  instructed → stripe.capture(final × qty) → paid
                       │  cancelled  → stripe.cancel()             → released
                       ▼
                   sendClosePaymentEmails()  ── Resend
                       │  paid       → confirmación de compra
                       │  instructed → instrucciones de transferencia (48 h)
                       ▼
                   generateShippingLabels()  ── Sendcloud v3 (manual, desde el admin)
```

### Rama paralela: GROPO PULSE (compra automática)

```
usuario con sesión marca un tramo no desbloqueado
   │ POST /api/pulse/pledge → pulse_pledge_upsert()   ← valida contra tier_demand
   ▼ watching
   │ POST /api/pulse/accept → SetupIntent 0 € (off_session)
   │ POST /api/pulse/accept/complete → verificación CONTRA STRIPE
   ▼ accepted
   │ 🔴 runPulseTrigger()
   │    🔴 pulse_check_and_lock()  ── pg_advisory_xact_lock + FOR UPDATE
   │       ¿committed + accepted ≥ min_units del tramo fireable más barato?
   ▼ holding
   │ 🔴 stripe.paymentIntents.create({off_session:true, confirm:true, idempotencyKey})
   ▼ converted ──► el webhook lo trata como un ESPERADOR normal (metadata idéntica)
```

---

## DO NOT ASSUME

Hechos peligrosos, todos verificados. **Cada línea de esta lista invalida una suposición
razonable.**

| ❌ No asumas | ✅ La realidad |
|---|---|
| El SQL del repositorio refleja producción | **7 de 9 funciones difieren.** `supabase/prepare_join.sql` **está corrupto y no parsea** |
| `CLAUDE.md` describe la realidad | Describe un producto llamado *Vonda*, con dominio `www.vonda.es`, y lista **dos componentes muertos como "Archivos clave"** |
| Una cabecera que dice *"Definición VIVA sincronizada desde producción"* es cierta | Las de `compute_price.sql` y `close_group.sql` lo dicen y **son falsas desde el 22 de junio** |
| El pago confirmado en el frontend significa que hay membresía | La membresía **la crea el webhook**, segundos después. `JoinFlow` muestra éxito **sin esperar** (P0-03) |
| Un `payment_intent` con éxito significa que el webhook se procesó | No. Puede devolver `needs_release` y **cancelar el hold** después de que el usuario vea "listo" |
| Existir como miembro implica ser miembro **único** | **No hay UNIQUE `(group_id, user_id)`** y los checks de duplicado fueron eliminados. **2 duplicados reales en producción** |
| El teléfono identifica a un usuario | **No existe `users_phone_key`.** `confirm_join` tiene una rama para esa constraint que es **código inalcanzable**. 2 teléfonos duplicados |
| La documentación describe funcionalidad implementada | La **cláusula del 75%** y el **precio fluido** están documentados y **NO existen en el código** |
| `groups.total_units` es el contador de unidades vendidas | Es **demanda firme al precio vigente**: fluctúa, **puede bajar** y puede ser **0 con 15 miembros vivos** |
| `join_mode='comprar'` significa PMA infinito | Solo en `compute_price`/`tier_demand`. En **`close_group` su techo es `guaranteed_price`** (ADR-09) |
| `next_price` es "el precio si entra uno más" | Desde la v3.1 es **el siguiente escalón real**, y **NULL** si el vigente ya es el más barato. Los copys de compartir **no se actualizaron** |
| `price_mode='fluid'` hace algo | **Ningún motor lee `price_mode`.** `compute_price_at_n` **no tiene llamantes**. Todo es `stepped` |
| RLS activada = datos protegidos | 7 funciones `SECURITY DEFINER` **abiertas a `anon`** sortean la RLS con (teléfono, email) (SEC-01) |
| `bids` sin políticas es un descuido | Es **deliberado**: implementa la opacidad del vendedor (D5) |
| El rate limiting protege | Es **fail-open**: si `check_rate_limit` falla, la petición **continúa** |
| El multi-puja está probado | El motor está completo, pero **nunca ha corrido con más de una puja**. Gate G6 pendiente |
| Un grupo siempre acaba en `closed` o `cancelled` | La rama "excedente con segunda puja" lo deja **atrapado en `closing`** sin salida (P1-04) |
| Si el checkout falla, el usuario se entera | Los cancelados y liberados **no reciben ningún email** (P2-06) |
| `/mensajes` y `/notificaciones` son placeholders | `/mensajes` sí es un estado vacío estático; **`/notificaciones` es funcional**. El placeholder real es **`/peticion`** |
| Existe una comisión de Gropo en el sistema | **No hay ninguna columna, constante ni cálculo de comisión.** ❓ `UNKNOWN` |
| Los tests validan los cambios | **No hay tests.** Ninguno |
| El cron cierra a las 22:00 Madrid siempre | `0 21 * * 0` UTC → puntual en invierno, **1 hora tarde en verano** |
| Revocar `EXECUTE` a `anon` arregla SEC-01 sin más | **Rompería 8 llamadas RPC directas** desde `/perfil`, `/notificaciones` y `JoinFlow` |

---

## FIRST THINGS TO CHECK

Cuando una IA nueva entre al proyecto, **en este orden**:

### 1 · Estado del repositorio
```bash
git status
git branch -vv
git log --oneline -20
git log origin/main..HEAD --oneline    # commits sin subir
```
**Referencia de esta auditoría:** `main @ 7c49ef3`, working tree limpio, 0 sin subir.
⚠️ **No ejecutes comandos de git que escriban.** Git lo corre Benjamin.

### 2 · Deriva producción ↔ repositorio
La comprobación **más importante** del proyecto. Para cada función crítica
(`compute_price`, `tier_demand`, `prepare_join`, `confirm_join`, `close_group`,
`get_my_groups`, `create_petition`), compara la definición viva con el fichero:
```sql
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = '<nombre>';
```
**Referencia:** al 6-sep-2026, **7 difieren**. Ver `ALGORITHM.md` §12.

### 3 · Funciones de base de datos: sobrecargas y permisos
```sql
SELECT p.oid::regprocedure AS firma,
       has_function_privilege('anon',          p.oid,'EXECUTE') AS anon,
       has_function_privilege('authenticated', p.oid,'EXECUTE') AS auth,
       has_function_privilege('service_role',  p.oid,'EXECUTE') AS svc
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' ORDER BY p.proname;
```
**Referencia:** 21 funciones, **ninguna sobrecarga duplicada**; las money-critical con
`anon=false` y `authenticated=false`.

### 4 · Migraciones
```bash
ls -d supabase/migrations 2>&1     # → No such file or directory
ls supabase/*.sql
```
**No hay sistema de migraciones.** Los `.sql` son copias manuales. Ver SOURCE OF TRUTH.

### 5 · Esquema, RLS y datos conocidos
```sql
-- RLS y políticas: ver CONTINUE_DEVELOPMENT.md § comandos
-- Problemas conocidos:
SELECT group_id, user_id, count(*) FROM group_members GROUP BY 1,2 HAVING count(*)>1;  -- ref: 2
SELECT phone, count(*) FROM users WHERE phone IS NOT NULL GROUP BY 1 HAVING count(*)>1; -- ref: 2
SELECT id, product_name FROM groups WHERE status='closing';                              -- ref: 0
SELECT group_id, count(*) FROM bids WHERE status='active' GROUP BY 1 HAVING count(*)>1;  -- ref: 0
```

### 6 · Entorno
```bash
sed -E 's/=.*/=***/' .env.local                       # SOLO nombres, nunca valores
grep -rho "process\.env\.[A-Z_0-9]*" src | sort -u     # lo que el código necesita
```
**Referencia:** `.env.local` tiene **9** variables; el código usa **27**.
✅ **`CRON_SECRET` verificada presente en Vercel** (Production y Preview) el 11-sep-2026: el
cierre automático dominical está armado. Sigue ausente de `.env.local`, que es solo el entorno
local. Lo que hay en Vercel **no es verificable desde el repositorio**: hay que mirar el panel.

### 7 · Integración con Stripe — ✅ VERIFICADA (11-sep-2026)
Verificada en el dashboard de Stripe y en Vercel, y confirmada con una **compra real de extremo
a extremo**. Detalle completo y traza de la prueba en `PAYMENTS.md` §12.
- Modo **test / sandbox**. El cutover a **live sigue pendiente**.
- Destino de webhook: **`https://www.gropo.es/api/stripe/webhook`**
  (`we_1TjGhOA114rXo3Kahd7KyxWg`), activo y **el único dado de alta**.
- Escucha **un solo evento**: `payment_intent.amount_capturable_updated` — el correcto para
  captura manual.
- El `STRIPE_WEBHOOK_SECRET` de Vercel **corresponde a ese endpoint**.
- ⚠️ `www.vonda.es` sigue resolviendo, pero es un **alias del mismo proyecto de Vercel** que
  `gropo.es`: mismo código, mismas variables, misma base de datos. Por eso las entregas antiguas
  a ese dominio también creaban miembros correctamente.

### 8 · Webhooks
```bash
grep -rn "constructEvent\|stripe-signature" src   # → solo api/stripe/webhook/route.ts
```
**Hay exactamente un webhook entrante.** Sendcloud, Resend y Supabase no tienen callbacks.

### 9 · Tests
```bash
find . -path ./node_modules -prune -o \( -name "*.test.*" -o -name "*.spec.*" \) -print
grep '"test"' package.json
```
**Referencia: cero resultados.** Sustituto: `npm run build` (typecheck) y `npm run lint`.

### 10 · Problemas críticos conocidos
Leer `KNOWN_ISSUES.md` — al menos los **cuatro P0 activos**:
P0-01 miembros duplicados · P0-02 acceso a datos ajenos · P0-03 confirmación optimista en
`JoinFlow` · P0-04 PaymentIntent no idempotente.
(P0-05 `CRON_SECRET` quedó ✅ **resuelto** el 11-sep-2026.)

> ⚠️ **Nunca imprimas ni copies valores de variables de entorno, claves ni secretos.**

---

## DISCREPANCIAS DOCUMENTACIÓN ↔ CÓDIGO

| # | Discrepancia | Manda |
|---|---|---|
| 01 | Marca y dominio: la doc dice *Vonda* / `www.vonda.es`; el código dice **Gropo** / `.gropo.es` (con URLs y remitentes de `vonda.es` sin migrar) | CÓDIGO |
| 02 | `payment_status` tiene 3 valores que nadie escribe (`captured`, `failed`, `refund_due`) | CÓDIGO |
| 03 | `bid_status.declined` y `event_type.bid_placed`/`bid_improved` nunca se escriben | CÓDIGO |
| 04 | `price_mode='fluid'` **no está implementado** en el motor vigente | CÓDIGO |
| 05 | `confirm_join` maneja la constraint `users_phone_key`, **que no existe** | BD |
| 06 | `next_price` cambió de semántica (v2); los copys de compartir y el comentario de `/quote` **no** | CÓDIGO (motor) |
| 07 | El check de duplicado de `prepare_join` está en el fichero pero **no** en la función viva | **BD** |
| 08 | Ídem para `confirm_join` | **BD** |
| 09 | Cron: la doc de proyecto dice `0 20 * * 0`; `vercel.json` dice **`0 21 * * 0`** | `vercel.json` |
| 10 | `CLAUDE.md` lista como "Archivos clave" `JoinModeSelector` y `TierDemandLadder` (**ambos muertos**) y menciona `VondaTargetSlider`, fichero que **no existe** (es `GropoTargetSlider`) | CÓDIGO |
| 11 | Puerto local: la doc de proyecto dice 3001; el repo dice 3000; `package.json` usa el default **3000** | `package.json` |
| 12 | `supabase/get_my_groups.sql` define 1 argumento; producción tiene **2** | **BD** |
| 13 | `supabase/revoke_join_group.sql` revoca `join_group`, **función que ya no existe** | **BD** |
| 14 | `supabase/create_petition.sql` es v1; producción es **v3** (anti-spam 5/h + upsert no destructivo) | **BD** |
| 15 | La especificación dice *"pujas JAMÁS retirables"*; `withdrawBid` **sí** permite retirarlas | CÓDIGO |
| 16 | La especificación V0 menciona una *"cláusula de tolerancia del 75%"*; **no existe en el código** | CÓDIGO |
| 17 | `CLAUDE.md` dice que el transportista es `correos_express:paq24`; el default del código es **`sendcloud:letter`** (depende de una variable de entorno no verificable) | CÓDIGO + ❓ |

---

## INVARIANTES DEL SISTEMA

Cosas que **siempre** deberían ser ciertas. ✅ = el sistema la **garantiza** con un mecanismo;
🔴 = solo se **espera**, y está rota.

| # | Invariante | ¿Garantizada? | Mecanismo / hueco |
|---|---|---|---|
| INV-01 | Un PaymentIntent produce como máximo un miembro | ✅ | UNIQUE `uniq_group_members_pi` + rama `already_processed` |
| INV-02 | `quantity >= 1` | ✅ | CHECK `group_members_quantity_check` |
| INV-03 | Un grupo cerrado no acepta miembros nuevos | ✅ | `confirm_join` exige `status='open'` **bajo el mismo `FOR UPDATE`** que usa `close_group` |
| INV-04 | `close_group` tiene efecto una sola vez por grupo | ✅ | `FOR UPDATE` + guard de estado |
| INV-05 | Nadie paga más que su PMA | ✅ | `close_group` paso 4 + captura **parcial** |
| INV-06 | Las unidades adjudicadas nunca superan el `max_stock` | ✅ | ventana `cum_qty <= max_stock` |
| INV-07 | Las unidades comprometidas nunca superan el `max_stock` | ✅ | guard en `confirm_join` **bajo lock** |
| INV-08 | Todos los adjudicados tienen el mismo `final_price` | ✅ | un único `v_settlement` |
| INV-09 | La escalera pública es monótona no creciente en unidades | ✅ | mínimo acumulado en `tier_demand` |
| INV-10 | `total_units >= 0` | ✅ | es una `SUM` de cantidades ≥ 1 |
| INV-11 | Un solo pledge vivo por (grupo, usuario) | ✅ | índice parcial `pulse_pledges_one_live` |
| INV-12 | El Pulse no cobra sin masa crítica | ✅ | `pulse_check_and_lock` con advisory lock |
| INV-13 | El Pulse no cobra a quien ya es miembro | ✅ | rechazo en `pulse_pledge_upsert` |
| INV-14 | `users.email` es único | ✅ | `users_email_key` |
| INV-15 | Un `auth.users` mapea a un solo `public.users` | ✅ | `users_auth_id_key` |
| INV-16 | Precio mostrado y precio del hold salen de la misma función | ✅ | todo pasa por `compute_price` |
| INV-17 | El comprador nunca ve pujas ni vendedores | ✅ | RLS de `bids` sin políticas |
| INV-18 | Los conteos exactos del Pulse nunca llegan al cliente | ✅ | `intensityBucket` + fracciones |
| INV-19 | El importe retenido nunca llega al cliente | ✅ | `create-intent` devuelve solo `clientSecret` |
| INV-20 | **Un usuario aparece como máximo una vez en un grupo** | 🔴 **ROTA** | Sin UNIQUE ni checks. **2 duplicados en producción** |
| INV-21 | **Un teléfono identifica a un solo usuario** | 🔴 **ROTA** | `users_phone_key` no existe. **2 duplicados** |
| INV-22 | **Un grupo nunca queda atrapado en `closing`** | 🔴 **ROTA (latente)** | Rama 9B-b sin salida. Nunca ejecutada |
| INV-23 | Todo `instructed` acaba en `paid` o recibe instrucciones | ⚠️ Parcial | Sin email → `failed++` sin alerta (P1-05) |
| INV-24 | Todo hold acaba capturado o liberado | ⚠️ Parcial | PIs abandonados quedan huérfanos; fallo de captura deja `instructed` con hold vivo |
| INV-25 | Solo `service_role` ejecuta las funciones money-critical | ✅ | **Verificado con `has_function_privilege`** |
| INV-26 | Una sola definición por función (sin sobrecargas) | ✅ | **Verificado: 21 funciones, 0 duplicadas** |
| INV-27 | **Ningún dato personal ajeno es accesible sin autorización** | 🔴 **ROTA** | SEC-01 / P0-02 |
| INV-28 | La UI muestra un precio igual al que se cobraría | ⚠️ Con matices | El precio es correcto; el **stock restante sobreestima** y el copy de "1 más" es falso |

---

## DEPENDENCY MAP — qué se rompe si tocas cada pieza

### `compute_price` — el nodo más conectado
```
compute_price
 ├─ SQL: prepare_join (×2)  ·  confirm_join (×3)
 ├─ API: /api/group/[id]/quote
 ├─ SSR: grupo/[id]/page.tsx · unirme/page.tsx · unido/page.tsx
 ├─ ACT: addBidToGroup · withdrawBid
 └─ DEP: bids(status,tiers,created_at) + group_members(payment_status,join_mode,target_price,quantity)
```
Cambiar su **firma** rompe 8 llamantes y **crea una sobrecarga** en vez de reemplazar.
⚠️ **`close_group` NO lo llama** (la v2 calcula su propio settlement).

### `tier_demand` — está en el camino del dinero por DOS vías
```
tier_demand
 ├─ SQL: pulse_state → pulse_check_and_lock → runPulseTrigger → 🔴 CARGOS OFF-SESSION
 ├─ SQL: pulse_pledge_upsert (validación del tramo)
 ├─ API: /tier-demand → useTierDemand → toda la UI de tramos
 ├─ API: 🔴 create-intent y checkout/lock → VALIDAN EL target_price DEL HOLD
 └─ SSR: page.tsx (×N grupos) · grupo/[id] · unirme  ·  cliente: MisGruposDesktop
```

### `close_group`
```
close_group ◄─ closeGroup() ◄─ CloseGroupButton (admin)
                           ◄─ /api/cron/close-groups
  escribe: groups · group_members · bids · events
  habilita: captureGroupPayments · sendClosePaymentEmails · generateShippingLabels
```

### `confirm_join`
```
confirm_join ◄─ SOLO api/stripe/webhook
  escribe: users · group_members · user_addresses · groups(caché) · events
  🔴 su INSERT en `events` es el LATIDO de la UI en vivo (Realtime → useTierDemand)
```

### Constantes transversales
- **`payment_status IN ('authorized','instructed','paid')`** aparece en 10+ sitios. Añadir un
  estado obliga a revisarlos todos.
- **`bids.status = 'active'`** filtra en `compute_price`, `tier_demand`, `close_group`,
  `/summary`, `page.tsx`, `grupo/[id]/page.tsx`, `withdrawBid`, `statusBadge`.
- **La `metadata` del PaymentIntent**: 3 emisores, 1 consumidor. Añadir un campo obliga a tocar
  los tres; si uno se olvida, **falla en silencio**.
- **`groups.total_units`**: escritor único (`confirm_join`), 6 lectores, uno de ellos incorrecto
  (`JoinFlow:115`).

### Dependencias externas
| Servicio | Si cae… |
|---|---|
| **Supabase** | Todo cae |
| **Stripe** | No se puede comprar; **no llegan webhooks → no se crean miembros**; el cierre no captura |
| **Vercel Cron** | Los grupos no cierran solos → hay que cerrarlos a mano |
| **Resend** | Nadie recibe emails. Todo lo demás sigue (los envíos son no-fatales) |
| **Sendcloud** | No hay etiquetas. Cero impacto en el dinero |

---

## ESTADO DEL PROYECTO — 6 DE SEPTIEMBRE DE 2026

### Datos de producción
| Métrica | Valor |
|---|---|
| Grupos | **1** (`TEST · Algoritmo precio`, `open`) · 0 cerrados · 0 cancelados |
| Pujas | 1 activa · máximo por grupo: **1** |
| `group_members` | 15, **todos `authorized`** (5 `comprar`, 10 `esperar`) |
| `pulse_pledges` | 0 |
| `users` | 151 (124 buyer, 26 seller, 1 admin) |
| `events` | 15 `member_joined`, 2 `price_dropped`, **0 `group_closed`** |
| 🔴 Duplicados | 2 pares `(group_id,user_id)` · 2 teléfonos |

> **No existe ningún grupo real ni ningún cierre en la base de datos.** Los 10 grupos DEMO
> descritos en `CLAUDE.md` fueron borrados.

### Qué está terminado, a medias y pendiente
Detalle completo en `BUSINESS_RULES.md` §9 y `KNOWN_ISSUES.md`. Resumen:

**✅ Terminado y verificado:** flujo Stripe hold-then-capture (ensayo con dinero real VERDE) ·
`compute_price` v3.1 · `confirm_join` con idempotencia doble · `close_group` v2 con PMA universal
· `tier_demand` fusionada · cron de cierre + alerta al admin · panel de admin completo · 5 emails
transaccionales · Sendcloud v3 · login Google + magic link · favoritos con RLS real ·
**Gropo Pulse completo** (ensayo E2E VERDE) · aviso "ya sois suficientes" con dedup atómico ·
perfil con direcciones · rediseño completo de UI · post-checkout.

**🟨 A medias:** multi-puja (motor completo, **Gate G6 sin ejecutar**) · confirmación honesta del
checkout (solo en `FastCheckoutModal`) · limpieza de `mock-data` · semántica de `next_price` en
los copys · unificación de identidad · rebranding Vonda → Gropo.

**⬜ Pendiente:** cutover Stripe test → live · rotación de claves de Sendcloud · vendedor real ·
Custom SMTP en Supabase Auth (**bloqueante**) · categorías de producto · reembolsos · tests.

**🧪 Existe pero sin uso:** `compute_price_at_n` + `price_mode='fluid'` · `bids.improved_at` y
`bid_revisions` · valores muertos de los enums · 14 componentes huérfanos · `/admin/email-test`
· `/peticion` (placeholder).

### Roadmap implícito — con evidencia en el código
`user_radar_prefs(categories, max_price)` + `radar_prefs_save` → Radar por categorías, **a la
espera de una columna `category` en `groups`** · `event_type.bid_placed/bid_improved` →
historial público de pujas nunca implementado · `bids.bid_revisions`/`improved_at` → pujas
mejorables (abandonado) · `payment_status.refund_due` → reembolsos previstos ·
`price_mode='fluid'` → precio interpolado · `/mensajes` y `/notificaciones` en la navegación →
mensajería in-app · `bids.payment_info` + emails de transferencia → camino de pago alternativo
heredado del V0, hoy vivo como fallback.

**Sin evidencia alguna** (no asumir): app nativa (explícitamente descartada), pagos que no sean
tarjeta, multi-divisa, envío internacional, i18n, marketplace self-service, suscripciones.

---

## LÍMITES DE ESTA AUDITORÍA

**Requiere consulta directa de producción** (actualizado el 11-sep-2026 — los ✅ ya se han
verificado desde entonces):
1. ✅ **Stripe — VERIFICADO el 11-sep-2026:** modo, endpoint de webhook, evento suscrito, secreto
   de firma y claves. Ver `PAYMENTS.md` §12. Queda solo el cutover a **modo live**.
2. **Variables de entorno en Vercel** (18 de 27 ausentes en `.env.local`).
   ✅ De ellas, `CRON_SECRET` verificada **presente en Vercel** el 11-sep-2026.
3. ✅ **`vonda.es` — VERIFICADO:** resuelve, y es un **alias del mismo proyecto de Vercel** que
   `gropo.es`.
4. Configuración de **Supabase Auth** (proveedores, URLs de redirección, SMTP).
5. Contenido de `bids.payment_info` (datos bancarios del vendedor) — no leído deliberadamente.
6. La **declaración** del trigger sobre `auth.users` (solo se inspeccionó su función).

**❓ UNKNOWN — no determinable desde el código:**
- El **margen o comisión de Gropo**: no existe ninguna columna, constante ni cálculo.
- Si la eliminación de los checks de duplicado en `prepare_join`/`confirm_join` fue **deliberada
  o una regresión**.
- Si la ausencia de "relleno" en la adjudicación (`cum_qty <= max_stock` por filas completas) es
  **deliberada**.

**Ficheros no auditados línea a línea:** `supabase/profile_identity.sql` (sí su estructura y su
cabecera), `seed.sql`, `seed_groups.sql`, `test_close_group.sql`.

---

*Punto de entrada del proyecto: **`AI_HANDOFF.md`**.*
*Protocolo y comandos para modificar el proyecto: **`CONTINUE_DEVELOPMENT.md`**.*
*Para entender el motor: **`ALGORITHM.md`**.*
