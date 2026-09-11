# VONDA — Estado completo y plan de arranque (handoff 24 jun 2026)

**Fecha de cierre de sesión:** 24 jun 2026
**Repo:** `/Users/benjamin/Desktop/kuorum` (Next.js 14 App Router · `src/` · `@/` → `src/`)
**GitHub:** `thedesignerux-lgtm/kuorum` · Supabase project: `xpktkuozspreuxucnguh`
**Reparto:** Claude = arquitecto/CTO (escribe el código y razona); Benjamin = manos + dashboards. Benjamin no escribe código; ejecuta y aprueba. Cowork edita archivos; **NO toca `.git/`** → git lo corre Benjamin en su Mac.

---

## Qué es

MVP de compra colectiva para ciclismo en España. El precio baja en vivo según entran compradores (por **unidades**). Cierre dominical 22:00 Europe/Madrid. Precio único de liquidación. **Vonda es merchant-of-record.** Motor de demanda efectiva (comprador "ahora" PMA=∞ / esperador PMA=X).

**Producto del primer grupo (inventado, sin vendedor real aún):** Continental GP5000 S TR 700x28c · PVP 79,95 € · tramos 10→74,90 / 25→69,90 / 50→64,90 / 100→59,90 · mín 10 uds · stock 120 · cláusula 75%.
**Lanzamiento objetivo:** domingo 28 jun 2026 (depende del vendedor real).

---

## 🟢 LO QUE SE HIZO EL 24 JUN (sesión maratón)

### 1. ✅ Ensayo de cierre E2E con dinero real (Ensayo 1) — VERDE

El money-critical que llevaba pendiente desde el 16 jun, por fin ejecutado.

- Grupo clon `TEST_CIERRE_BORRAR` (UUID `49b8cd29-fc87-4c0f-a7d4-ebc78e6f9cf3`) con tramos 2→18 / 4→15, mín 2, stock 50, stepped.
- **Join A** (test1@vonda.es, qty 2): hold 36 € (18×2, tramo 1). ✓
- **Join B** (test2@vonda.es, qty 2): hold 30 € (15×2, tramo desbloqueado por B). ✓
- Ambos confirmados como `authorized` con PI real en la BD. ✓
- **Cierre manual** (botón admin): ambos `paid`, `final_price = 15`, `captured_amount = 30`. ✓
- **Captura parcial** correcta: A tenía hold 36, se le capturó 30, Stripe liberó 6. El bug más temido (capturar hold completo) descartado con dinero real. ✓
- **Cero miembros en `authorized`** tras el cierre — la aserción central validada. ✓
- **Idempotencia** de `captureGroupPayments` confirmada. ✓

### 2. ✅ UI selector comprar/esperar (JoinModeSelector)

- Componente `src/components/JoinModeSelector.tsx`: dos radios ("Comprar ahora" / "Comprar cuando alcance:") + tira horizontal de pills con los tramos **por debajo del precio actual**.
- Enchufado en **desktop** (`GroupRightSidebar`) y **mobile** (`GroupLiveSection`), sobre el CTA.
- El pill seleccionado fija el `targetPrice`. Al pulsar el CTA, la URL lleva `?mode=esperar&target=X` → JoinFlow lo recoge → banner de esperar, botón "Reservar plaza", metadata al PI.
- **Cero cambios de backend** — JoinFlow ya aceptaba `joinMode`/`targetPrice` como props desde la URL.

### 3. ✅ Hold del esperador = target × qty (server-validado)

**Bug arreglado:** antes el hold de un esperador era `guaranteed_price × qty` (el precio proyectado actual), que no coincidía con su intención. Ahora:

- `create-intent` valida que `target_price` sea un tramo real de la puja ganadora (lee `bids.tiers` con `best_bid_id` de `prepare_join`). Si no existe → error. **Server-authoritative**: el front no decide el hold.
- Si `join_mode === 'esperar'`: `hold = target_price × qty` (el máximo que se le podría capturar).
- Si `join_mode === 'comprar'`: `hold = guaranteed_price × qty` (como antes).
- JoinFlow actualizado: en modo esperar, el resumen/subtotal/botón muestran `targetPrice` no el proyectado. El amountCents de Stripe Elements también usa el target.
- Footer dinámico: "Solo pagas si la vonda baja a tu precio objetivo. Si no, se libera sin cargo."

### 4. ✅ compute_price v3 — respeta el PMA de la entrada simulada

**Bug arreglado:** `p_extra_units` se sumaba a la demanda de todos los tiers a ciegas. Un esperador a 25.000 con qty 8 "desbloqueaba" el tramo de 28.000 (que ni siquiera aceptaría).

- Nuevo parámetro `p_extra_target numeric DEFAULT NULL`. NULL = comprador ahora (cuenta para todos); valor X = esperador (cuenta solo para tiers con price ≤ X).
- **Firma nueva:** `compute_price(uuid, integer, numeric)`. Firma vieja `(uuid, integer)` dropeada explícitamente. **Firma única** verificada.
- **Permisos:** anon/authenticated/service_role = `true` (abierta a propósito, el front la usa).
- Probado con 3 casos SQL contra el grupo real Motor parapente (esperador 25k×8 → 30000 ✓, comprador ahora×8 → 28000 ✓, cierre sin args → 30000 ✓).
- **Quote actualizado** (`/api/group/[id]/quote`): ahora pasa `p_extra_target` al motor cuando el modo es esperar. JoinFlow envía `&target=X` en la URL del fetch del quote.

### 5. ✅ Banner JoinFlow gateado por modo

**Bug arreglado:** el banner "🎉 ¡Desbloqueado!" usaba la fórmula vieja client-side (`total_units + qty >= nextTier.minUnits`) ciega al PMA, y celebraba desbloqueos falsos para esperadores.

- En modo esperar: banner informativo neutro ("Reservas tu plaza a X/ud. Solo se confirma si la vonda baja a ese precio antes del cierre.").
- En modo comprar: lógica vieja conservada (correcta para compradores "ahora").

### 6. ✅ confirm_join — total_units = demanda firme al precio vigente (Nivel 1)

**Bug arreglado:** `total_units` se incrementaba a ciegas con `+= p_quantity` para todo miembro, inflando con esperadores fuera de precio. El grupo mostraba "8 unidades confirmadas" por un esperador a 25.000 cuando el precio era 30.000.

- `total_units` ahora se recalcula entero desde los miembros vivos: `SUM(quantity) WHERE join_mode='comprar' OR target_price >= v_new_price`. Ya no es incremental.
- Orden de operaciones corregido: insertar miembro → compute_price → escribir current_price → recalcular total_units.
- **Firma sin cambios** (11 args) → CREATE OR REPLACE puro, **no reseteó permisos**.
- **Permisos verificados:** `anon=false, auth=false, svc=true`. ✓
- total_units del grupo real recalculado manualmente: de 8 (inflado) a 0 (correcto). ✓
- **IMPORTANTE:** `close_group` NO usa `total_units` para nada del dinero (verificado línea a línea). El bug era puramente de display. El cierre recalcula todo desde los miembros vivos directamente.

### 7. ✅ tier_demand() — función SQL de demanda efectiva por tramo (Nivel 2)

- Nueva función `tier_demand(uuid)` → RETURNS TABLE (min_units, price, effective_demand, unlocked).
- Misma lógica de demanda que `compute_price` (una sola fuente de verdad).
- Abierta a anon/authenticated/service_role (solo devuelve agregados, sin datos personales).
- Probada con el grupo real Motor parapente: 4 filas, demanda solo en el tramo de 25.000 (8 uds), ningún tramo desbloqueado. ✓

### 8. ✅ TierDemandLadder — escalera de demanda en la ficha (Nivel 2)

- Endpoint `/api/group/[id]/tier-demand` (expone `tier_demand` al front).
- Componente `src/components/TierDemandLadder.tsx`: fetch + realtime (canal con nombre único para evitar colisión con otros canales de la ficha). Pinta cada tramo: precio, barra de progreso (demanda/requisito), "faltan N unidades dispuestas a este precio".
- **Reemplaza** la barra de tramos vieja (`TierBar`/`DesktopTierBar`) y el callout `NextTierCallout` en ambas vistas (desktop + mobile).
- Las funciones viejas (`DesktopTierBar`, `TierBar`, `NextTierCallout`) quedan sin usar en sus archivos (código muerto para limpiar).

### 9. ✅ CTA dinámico según modo (desktop)

- "Comprar ahora" → **"Comprar ahora · 30.000 €"** / "Reservo mi plaza al precio actual".
- "Esperar" con pill seleccionado → **"Unirme por X € máx."** / "Asegura tu compra a este precio o menos".
- Subtexto: "Sin cargos ahora. Cancela cuando quieras." vs "Sin compromiso · Puedes cambiar de opción después".

### 10. ✅ Logo Vonda

- `public/logo.png` (484KB, PNG). Desplegado en: header desktop (`GroupDesktopView`), página unirme, home desktop (`HomeDesktopView`), home mobile (`GroupsGrid`).

---

## Commits de la sesión del 24 jun

| Commit | Descripción |
|---|---|
| (varios) | feat: selector comprar ahora / esperar a precio (UI) |
| `366bb27` | fix: esperador retiene target × qty (no proyectado), UI alineada |
| (varios) | fix: quote respeta PMA del esperador (p_extra_target) |
| (varios) | fix: banner esperar no celebra desbloqueo falso |
| (varios) | fix: total_units = demanda firme al precio vigente |
| (varios) | feat: tier_demand() + TierDemandLadder en ficha |
| `97ae0a9` | feat: escalera de demanda por tramo en ficha (nivel 2) |
| (varios) | fix: canal realtime único en TierDemandLadder |
| (varios) | feat: CTA dinámico según modo |
| (varios) | feat: logo Vonda en header desktop, unirme, home desktop/mobile |

---

## 🔴 PENDIENTES CRÍTICOS (antes del 28 jun)

### 1. ⚡ Ensayo 3 — cierre con esperadores reales en Stripe

**El money-critical más importante que queda.** Hoy tocamos `compute_price` (firma nueva), `confirm_join` (recálculo de total_units), y creamos `tier_demand`. Cada pieza está verificada en aislamiento. Pero el cierre completo con un esperador real con tarjeta test **aún no se ha ejercido**. El Ensayo 1 (hoy) validó compradores "ahora"; falta el motor de esperadores con dinero real.

**Plan del ensayo:**
- Grupo clon con tramos baratos (reutilizar el modelo 2→18 / 4→15).
- 3 joins: un comprador "ahora" (qty 2), un esperador al tramo de 15 (qty 2, califica), un esperador al tramo de... algún precio inalcanzable (no califica).
- Cerrar con el botón manual.
- Verificar en Stripe: (a) comprador "ahora" captura parcial a final×qty ✓; (b) esperador que califica, hold = target×qty, captura ≤ hold ✓; (c) esperador que NO califica, hold liberado = $0 cobrado ✓.
- Verificar en la BD: cero `authorized` colgados, `total_units` coherente.
- ⚡ **Opus 4.8** (money-critical).

### 2. Limpiar mock-data de la ficha

La ficha muestra **dos verdades opuestas**: la escalera nueva (real) + datos mock del centro (inventados). Contradicción visible:
- "12 esperando 28.000 €" (mock) vs la escalera que dice 0/8 a ese tramo (real).
- "Laura se unió", "Javier cambió", "Marta", mensajes, avatares — todo mock. Hay que quitarlo.
- Fuente: `getActivationState`/`getMilestones` de `mock-data.ts`, y datos hardcoded en `GroupCenterContent.tsx` / `GroupDesktopView.tsx`.
- **Riesgo:** si un comprador real ve números contradictorios, pierde confianza.

### 3. Cutover Stripe test → live

Claves `live` (`pk_live_…`, `sk_live_…`), endpoint webhook en modo live con su `whsec_`, 3 vars en Vercel, redeploy, prueba con tarjeta real. ⚡ Opus 4.8.

### 4. Rotación de claves Sendcloud

El par actual salió en el chat durante el desarrollo → regenerar, meter en `.env.local` + Vercel, nunca más por chat.

### 5. Conseguir vendedor real

El bloqueador de negocio. Pago ✅ + Envío ✅ (Sendcloud). La pregunta del carrier (SEUR vs Correos Express) sigue pendiente con el distribuidor. Carrier = string de configuración, cero código.

---

## 🟡 PENDIENTES NO URGENTES

### Motor (cuando haya vendedor con tramos reales)
- **Nivel 3: "Cambiar de objetivo" en vivo** — money-critical (reautorización de holds). V1.
- UI selector de límite en la ficha estilo mockup (el radio-list de precios). Se puede construir sin el cambio de objetivo (solo manda al flujo de unirse con el target elegido).

### Menores anotados (siguen vivos de handoffs previos)
- `compute_price_at_n` sin uso → retirar algún día.
- CHECK constraint monotonía tiers en BD (hoy solo en TS del admin).
- Guard de `group_id` en webhook (PI sin `metadata.group_id` → 200 sin llamar `confirm_join`).
- Página "unido" se fía del pago, no del webhook confirmado (polling).
- DST de `closes_at` (`20:00 UTC` = 22:00 CEST verano, 21:00 CET invierno) — arreglar antes de octubre.
- Centralizar Resend (webhook instancia su propio `new Resend()`).
- `confirm_join` dedupe latente (check por tel OR email, upsert `ON CONFLICT (email)`).
- Excedente con 2ª puja → admin-manual V0.
- Código muerto: `DesktopTierBar`, `TierBar`, `NextTierCallout`, funciones de `mock-data.ts` ya no usadas en la ficha.
- Grupos de test en producción pendientes de limpieza: `TEST_CIERRE_BORRAR`, `TEST_UI_BORRAR`, Motor parapente con esperador de prueba.

---

## 🔧 DATOS TÉCNICOS DE REFERENCIA

### Funciones money-critical (verificadas en BD viva 24 jun)

| Función | Firma | Permisos | Estado |
|---|---|---|---|
| `compute_price` | `(uuid, integer, numeric)` | anon/auth/svc = **true** (abierta) | ✅ v3, firma única |
| `close_group` | `(uuid)` | solo **service_role** | ✅ blindada |
| `confirm_join` | `(text,uuid,text,text,text,integer,numeric,numeric,jsonb,text,numeric)` — 11 args | solo **service_role** | ✅ blindada, total_units arreglado |
| `tier_demand` | `(uuid)` | anon/auth/svc = **true** (abierta) | ✅ nueva |
| `prepare_join` | `(uuid, text, integer)` | solo **service_role** | ✅ blindada |

### Contrato `group_members`
- `join_mode` text NOT NULL default 'comprar' · `target_price` numeric NULL
- Comprador "ahora" → `comprar` / NULL (PMA=∞). Esperador → `esperar` / X (PMA=X).
- Vivos (cuentan demanda) = payment_status IN ('authorized','instructed','paid'). Muertos = released/cancelled/auth_failed.
- Índice único `uniq_member_per_group` sobre (group_id, user_id). Columna PI: `stripe_payment_intent_id`.

### Contrato `total_units` (NUEVO — 24 jun)
`total_units` ya NO es "todas las unidades de miembros vivos". Ahora es **demanda firme al precio vigente**: compradores "ahora" (siempre cuentan) + esperadores con `target_price >= current_price`. Se recalcula entero (no incremental) en cada `confirm_join`, después de calcular `v_new_price`.

### Stripe
Modo test · sandbox "Vonda sandbox" · endpoint `creative-harmony` → `https://www.vonda.es/api/stripe/webhook` · 1 evento `payment_intent.amount_capturable_updated`.

### Archivos clave (nuevos/modificados hoy)
- `src/components/JoinModeSelector.tsx` — selector comprar/esperar con pills
- `src/components/TierDemandLadder.tsx` — escalera de demanda por tramo (realtime)
- `src/app/api/group/[id]/tier-demand/route.ts` — endpoint para tier_demand
- `src/app/api/group/[id]/quote/route.ts` — ahora pasa p_extra_target
- `src/app/api/join/create-intent/route.ts` — hold = target×qty para esperadores
- `src/app/grupo/[id]/unirme/JoinFlow.tsx` — display usa targetPrice, banner gateado
- `src/components/desktop/GroupRightSidebar.tsx` — TierDemandLadder + CTA dinámico
- `src/components/GroupLiveSection.tsx` — TierDemandLadder + JoinModeSelector
- `supabase/compute_price.sql` — v3 con p_extra_target
- `supabase/confirm_join.sql` — total_units recalculado como demanda firme
- `supabase/tier_demand.sql` — nueva función
- `public/logo.png` — logo Vonda

---

## 🧠 REGLAS DE PROCESO (actualizadas)

- **Verificar SIEMPRE contra la BD viva** (`pg_proc`, `has_function_privilege`, `information_schema`), no contra handoffs ni memoria de Cowork.
- **Cambiar la firma de una función (DROP+CREATE) resetea permisos a PUBLIC EXECUTE** → re-verificar + re-blindar.
- **CREATE OR REPLACE sin cambio de firma NO resetea permisos** → verificar igualmente por disciplina.
- **Firma duplicada:** tras cualquier cambio, comprobar `SELECT oid::regprocedure FROM pg_proc WHERE proname=...`. Si hay 2, DROP la vieja.
- **Cowork frecuentemente dice "hecho" sin hacerlo** → verificar con grep/cat antes de desplegar.
- **Cowork NO toca `.git/`** → git lo corre Benjamin en el Mac.
- **SQL largo vía clipboard→archivo** (`pbcopy`/`pbpaste`), no por chat.
- **www vs sin www:** todas las URLs de prod usan `www.vonda.es`.
- **Git:** autor `benjaminperezsouto@gmail.com`.
- **Potencia:** money-critical → Opus 4.8 (Fable 5 suspendido). UI/copy → Opus 4.6.
- **Anti scope creep:** el Nivel 3 (cambiar objetivo en vivo) se pospuso conscientemente — incluye reautorización de holds, que es su propio proyecto money-critical.

---

## ✅ Primer paso de la próxima sesión

**Ensayo 3** (cierre con esperadores reales en Stripe). ⚡ Opus 4.8. Es el money-critical que valida todo el motor tocado hoy con dinero real. Hacerlo con cabeza fresca, no al final de una sesión larga.

Tras el Ensayo 3:
- Limpiar mock-data de la ficha.
- Cutover Stripe test → live (si la cuenta está verificada).
- Rotación claves Sendcloud.
