# VONDA — Estado completo y plan de arranque (handoff 29-30 jun 2026)

**Fecha de cierre de sesión:** 30 jun 2026 (~02:30)
**Repo:** `/Users/benjamin/Desktop/kuorum` (Next.js 14 App Router · `src/` · `@/` → `src/`)
**GitHub:** `thedesignerux-lgtm/kuorum` · Supabase project: `xpktkuozspreuxucnguh`
**Reparto:** Claude = arquitecto/CTO (escribe el código y razona); Benjamin = manos + dashboards. Cowork edita archivos; **NO toca `.git/`** → git lo corre Benjamin en su Mac.

---

## Qué es

MVP de compra colectiva para ciclismo en España. El precio baja en vivo según entran compradores (por **unidades**). Cierre dominical 22:00 Europe/Madrid. Precio único de liquidación. **Vonda es merchant-of-record.** Motor de demanda efectiva (comprador "ahora" PMA=∞ / esperador PMA=X).

**Lanzamiento objetivo:** domingo 5 de julio 2026 (depende del vendedor real).

---

## 🟢 LO QUE SE HIZO EL 29-30 JUN — Rediseño completo de la ficha (modelo PMA unificado)

Sesión larga de iteración de UI/UX guiada por capturas de pantalla y feedback directo de Benjamin, culminando en la adopción del **Vonda Product Experience Guidelines** (documento de principios de producto — ver abajo) y un mockup de referencia con el selector PMA unificado.

### Evolución del diseño (en orden cronológico)

1. **Bugs de display heredados del 28 jun arreglados:**
   - `ProgressToNextPrice` apuntaba al tramo equivocado (el más barato/lejano en vez del más cercano a desbloquear) → arreglado en `useTierDemand.ts` (nextTier ahora ordena por `missing` ascendente, con desempate por precio)
   - Cache de Next.js en `/api/group/[id]/tier-demand` y `/api/group/[id]/summary` → añadido `export const dynamic = 'force-dynamic'` + `export const revalidate = 0` en ambos endpoints
   - CTA/radio desalineados en colapso esperar→comprar → arreglado

2. **Rediseño desktop 3 columnas** (`GroupDesktopView`, `GroupCenterContent`, `GroupRightSidebar`): producto a la izquierda (sticky), pricing + escalera + selector en el centro, resumen a la derecha.

3. **Selector comprar/esperar → selector PMA unificado.** Cambio de paradigma tras feedback de Benjamin con mockup de referencia: de dos tarjetas ("Comprar ahora" / "Reservar") a **una sola lista de radio** con precios y etiquetas de viabilidad ("Disponible ahora", "Muy cerca (N compras)", "A medio camino", "Objetivo final"). Alineado con el documento de guidelines: *"No existen dos mecanismos. El usuario únicamente define un límite."*

4. **Filtro de tramos dominados** (múltiples iteraciones, en `TierDemandLadder.tsx` y `JoinModeSelector.tsx`): un tramo no se muestra si:
   - Es más caro o igual al precio actual (ya se paga menos) — excepto el tramo ancla al precio actual, que siempre se muestra
   - Hay otro tramo más barato que necesita igual o menos compras para desbloquear (evita mostrar "41,90€ faltan 5" junto a "38,90€ faltan 1", que confunde)

5. **Selector reactivo a la proyección:** cuando la entrada del usuario ya desbloquea un precio mejor, el selector se auto-filtra para mostrar solo esa opción (no tiene sentido ofrecer precios peores). Implementado con un `useEffect` que sincroniza `selectedPrice` con `projectedPrice` cuando este es mejor que `currentPrice`.

6. **CTA condicional:** `"Comprar (Máx. X€)"` cuando hay incertidumbre de precio (queda un próximo descuento), `"Comprar · X€"` cuando ya se alcanzó el mejor precio (sin "Máx.", sin ambigüedad).

7. **Copy actualizado a los Guidelines:** "Precio normal" / "Precio del grupo" / "Próximo descuento" (cabecera), "¿Cuál es el máximo que pagarías?" (selector), "Cómo baja el precio" (escalera), "Compras aseguradas" / "Compras en espera" (sidebar, antes "Ya compraron"/"Reservas"), "¿Por qué unirte?" con copy de beneficios no de mecánica.

8. **Botón "Compartir grupo"** añadido a la tarjeta de producto (izquierda), usa `navigator.share` con fallback a `clipboard.writeText`.

### Documento nuevo: VONDA_PRODUCT_GUIDELINES.md

Benjamin recibió una auditoría UX externa de alto nivel sobre el mockup de referencia y la convirtió en un documento canónico de principios de producto. **Guardado como archivo del proyecto.** Resumen de las reglas más operativas:

- **Modelo mental único:** el usuario solo declara "el máximo que pagaría" (PMA). No existen dos mecanismos (comprar/reservar) de cara al usuario — es una única lista de precios con estados de viabilidad.
- **Un dato aparece una sola vez** — nunca duplicar precio actual, próximo descuento, etc. en varios módulos.
- **Mostrar consecuencias, nunca mecánica** — "Muy cerca" en vez de "faltan 6 unidades para activar el tramo".
- **CTAs siempre descriptivos:** "Comprar (Máx. 48,90€)", nunca verbos genéricos.
- **Nunca exponer terminología interna:** tiers, demanda efectiva, compute_price, total_units no deben aparecer en la UI.
- Este documento **debe consultarse en cualquier sesión que toque UI/copy de la ficha de producto.**

### Archivos reescritos (29-30 jun)

- `src/components/JoinModeSelector.tsx` — reescrito completo: de dos tarjetas a lista de radio PMA, con auto-filtrado por proyección y filtro de dominados
- `src/components/TierDemandLadder.tsx` — filtro de tramos dominados, copy "Cómo baja el precio"
- `src/hooks/useTierDemand.ts` — `nextTier` ahora prioriza cercanía a desbloqueo (con desempate por precio), expone `refreshKey`
- `src/components/desktop/GroupCenterContent.tsx` — reescrito: labels nuevos, CTA condicional Máx./sin Máx.
- `src/components/desktop/GroupRightSidebar.tsx` — labels nuevos ("Compras aseguradas"/"Compras en espera"), guard de display para no superar `maxStock`
- `src/components/desktop/GroupDesktopView.tsx` — botón compartir en tarjeta de producto
- `src/app/api/group/[id]/tier-demand/route.ts` — `force-dynamic` + `revalidate=0`
- `src/app/api/group/[id]/summary/route.ts` — `force-dynamic` + `revalidate=0`, categorización de firm/reserve ahora considera si `target_price >= current_price` (un esperador cuyo target ya se alcanzó cuenta como "compra asegurada", no como "en espera")

### Verificaciones pasadas
- `tsc --noEmit` limpio tras cada tanda de cambios (multiple iteraciones esta sesión)
- Probado en vivo contra 3 grupos de test creados y descartados durante la sesión (`342cceb5...`, `68a3d73c...`, y uno adicional para el bug de stock)

---

## 🔴 BUG CRÍTICO ENCONTRADO (money-critical, sin aplicar — máxima prioridad próxima sesión)

### El guard de stock en `confirm_join` y `prepare_join` NO frena correctamente

**Descubierto:** Benjamin detectó un grupo de test (`8838d617-bddc-4bcc-8ad4-69461356defe`, "probando otra versd") con **29 unidades vendidas contra un stock máximo de 25**. El sidebar mostraba "Compras aseguradas: 29" con "Stock disponible: 25" — overselling real, no solo de display.

**Causa raíz (confirmada leyendo el cuerpo vivo de ambas funciones vía `pg_get_functiondef`):**

Tanto `prepare_join` como `confirm_join` comparan la nueva cantidad contra `groups.total_units`:
```sql
IF v_current_total + p_quantity > v_max_stock THEN ...
```

Pero desde el cambio del 24 jun, `total_units` **ya no representa "todas las unidades comprometidas"** — es la **"demanda firme al precio vigente"**: `SUM(quantity) WHERE join_mode='comprar' OR target_price >= current_price`. Cuando el precio baja y algunos esperadores dejan de calificar (su target queda por debajo del precio actual), `total_units` puede BAJAR aunque el número real de unidades comprometidas en la tabla `group_members` sea el mismo o mayor. El guard de stock, que debería ser un techo físico invariable, queda atado a una métrica que fluctúa con el precio — dejando pasar joins que deberían rechazarse.

**Por qué importa:** el stock físico no depende de qué precio califica cada comprador. Una unidad reservada (aunque sea un esperador que aún no calificó) ocupa una unidad de producto que el vendedor tiene que servir si al final del cierre esa persona compra. El guard debe ser conservador: contar **todas** las unidades de miembros vivos (`authorized`, `instructed`, `paid`), sin filtrar por modo o precio.

### Fix propuesto (discutido con Benjamin, NO aplicado — pendiente de confirmación y ejecución)

En ambas funciones, sustituir la fuente del guard:

```sql
-- ANTES (en prepare_join, usa v_group.total_units; en confirm_join, usa v_current_total leído de groups.total_units):
IF v_current_total + p_quantity > v_max_stock THEN ...

-- DESPUÉS — calcular unidades reales comprometidas directamente de group_members:
SELECT COALESCE(SUM(quantity), 0) INTO v_current_total
FROM group_members
WHERE group_id = p_group_id
  AND payment_status IN ('authorized','instructed','paid');

IF v_current_total + p_quantity > v_max_stock THEN ...
```

**Notas de implementación:**
- Mismo cambio en las dos funciones: `prepare_join` (para dar feedback temprano al usuario antes del hold de Stripe) y `confirm_join` (el guard que de verdad importa, porque es atómico dentro de la transacción de inserción del miembro).
- **Ninguna de las dos cambia de firma** (mismo nombre, mismos argumentos) → `CREATE OR REPLACE` NO debería resetear permisos, pero **re-verificar `has_function_privilege` tras aplicar** por disciplina (regla de oro del proyecto).
- Permisos actuales verificados 30 jun (antes de tocar nada): `prepare_join` y `confirm_join` → `anon=false, authenticated=false, service_role=true` en ambas. Correcto, no debería cambiar.
- **Considerar además un guard a nivel de `close_group`**: si por algún motivo el overselling ya ocurrió antes del fix (como en el grupo de test), el cierre debería, como mínimo, no agravarlo. No se ha auditado `close_group` para este caso — pendiente de revisión cuando se aplique el fix.
- **Limpiar el grupo de test** `8838d617-bddc-4bcc-8ad4-69461356defe` ("probando otra versd") después de aplicar y verificar el fix — tiene datos de overselling que no deben quedar en producción. Verificar holds vivos en Stripe antes de borrar (regla de oro: nunca borrar grupos con `authorized`/`instructed` sin confirmar el estado del PaymentIntent).

**⚡ Esta tarea afecta a lógica crítica de negocio o seguridad — usar Opus 4.8 (o Fable 5 si está disponible).**

### Plan de la próxima sesión para este bug
1. Confirmar con Benjamin el enfoque (contar TODAS las unidades vivas, no solo firmes) — ya discutido y parece correcto, pero confirmar antes de tocar.
2. Aplicar el cambio en `confirm_join` primero (el guard atómico real).
3. Verificar permisos tras el cambio.
4. Test: intentar un join que debería rechazarse por stock insuficiente, confirmar que `confirm_join` devuelve `needs_release/out_of_stock` y el webhook libera el hold correctamente.
5. Aplicar el mismo cambio en `prepare_join`.
6. Test: el frontend debería mostrar el error de stock insuficiente ANTES de crear el PaymentIntent (mejor UX que dejar que Stripe cree un hold que luego se libera).
7. Limpiar el grupo de test con overselling.
8. Considerar si el guard de display en `GroupRightSidebar` (cap a `maxStock`, aplicado esta sesión) sigue siendo necesario como capa de seguridad adicional, o si se puede quitar una vez el backend esté arreglado — **recomendación: dejarlo, es barato y es una capa extra de seguridad visual.**

---

## 🔴 BUGS DE DISPLAY PENDIENTES (menores, no bloquean)

Ninguno crítico detectado al cierre de esta sesión. La ficha quedó visualmente coherente tras las iteraciones. Vigilar en la próxima sesión de QA:
- Verificar que el filtro de tramos dominados se comporta bien con 2, 3 y 4 tramos (se probó principalmente con 4).
- Verificar que el auto-colapso del selector PMA no genera parpadeos en conexiones lentas (el debounce de 200ms del quote debería cubrir esto, pero no se probó explícitamente con throttling de red).

---

## 🟡 OTROS PENDIENTES (sin cambios de handoffs previos)

### Money-critical
- **Cutover Stripe test → live** (⚡ Opus 4.8, cuando la empresa esté registrada): claves `live`, endpoint webhook en modo live con su `whsec_`, 3 vars en Vercel, redeploy, prueba con tarjeta real.

### Seguridad / pre-producción
- Rotación de claves Sendcloud (el par actual salió en el chat durante la integración).
- `SENDCLOUD_FROM_*` reales cuando se concrete el distribuidor.
- Carrier real: `SENDCLOUD_SHIPPING_OPTION_CODE`.

### Motor
- "Cambiar de objetivo" en vivo (Nivel 3): money-critical, reautorización de holds. V1.

### Menores anotados (de handoffs previos, sin cambios)
- `compute_price_at_n` sin uso → retirar.
- CHECK constraint de monotonía de tiers en BD.
- Guard de `group_id` en webhook.
- Página "unido" con polling en vez de fiarse del Payment Element.
- DST de `closes_at` (`20:00 UTC` = 22:00 CEST verano, 21:00 CET invierno) → antes de octubre.
- Centralizar Resend.
- `confirm_join` dedupe latente (check por tel OR email, upsert `ON CONFLICT (email)`).
- Excedente con 2ª puja → admin-manual V0.

### Bloqueador de negocio
- **No hay vendedor real.** Pago ✅ + Envío ✅ (Sendcloud). Falta cerrar al distribuidor y meter sus tramos reales.

---

## 🔧 DATOS TÉCNICOS DE REFERENCIA

### Funciones money-critical (verificadas en BD viva 30 jun)
| Función | Firma | Permisos |
|---|---|---|
| `compute_price` | `(uuid, integer, numeric)` — 2 defaults | anon/auth/svc = true (abierta) |
| `close_group` | `(uuid)` | solo service_role |
| `confirm_join` | 11 args | solo service_role — **guard de stock roto, ver arriba** |
| `tier_demand` | `(uuid)` | anon/auth/svc = true (abierta) |
| `prepare_join` | `(uuid, text, integer)` | solo service_role — **guard de stock roto, ver arriba** |

### Contrato `group_members`
- `join_mode` text NOT NULL default 'comprar' · `target_price` numeric NULL
- Vivos (cuentan demanda Y deberían contar para stock) = `payment_status IN ('authorized','instructed','paid')`. Muertos = released/cancelled/auth_failed.
- `total_units` en `groups` = demanda firme al precio vigente (NO el total de unidades comprometidas — este es precisamente el bug de esta sesión).

### Grupos en producción / test conocidos
- **Motor parapente** `9450351f-...` — borrado esta sesión (se limpió).
- **Continental GP5000 S TR** original `b1bdab3e-...` — borrado en sesión previa.
- Varios grupos de test creados y usados durante las iteraciones del 29-30 jun (`342cceb5...`, `68a3d73c...`) — verificar si quedan restos, limpiar si están terminales sin holds vivos.
- **`8838d617-bddc-4bcc-8ad4-69461356defe`** ("probando otra versd") — **contiene el caso de overselling (29/25 uds), NO borrar hasta aplicar y confirmar el fix del guard de stock.** Útil como caso de test para verificar el fix.

### Stripe
Modo test · sandbox "Vonda sandbox" · endpoint `creative-harmony` → `https://www.vonda.es/api/stripe/webhook` · 1 evento `payment_intent.amount_capturable_updated`.

### Archivos clave (UI, tocados 29-30 jun)
- `src/components/JoinModeSelector.tsx`
- `src/components/TierDemandLadder.tsx`
- `src/hooks/useTierDemand.ts`
- `src/components/desktop/GroupCenterContent.tsx`
- `src/components/desktop/GroupRightSidebar.tsx`
- `src/components/desktop/GroupDesktopView.tsx`
- `src/app/api/group/[id]/tier-demand/route.ts`
- `src/app/api/group/[id]/summary/route.ts`

### Archivos clave (pendientes de tocar, guard de stock)
- `supabase/prepare_join.sql`
- `supabase/confirm_join.sql`

### Documento de referencia nuevo
- **VONDA_PRODUCT_GUIDELINES.md** — subido como archivo del proyecto. Consultar para cualquier trabajo de UI/copy en la ficha de producto o pantallas nuevas.

---

## 🧠 REGLAS DE PROCESO (sin cambios, reafirmadas esta sesión)

- **Verificar contra la BD viva** — no handoffs, no memoria de Cowork. Esta sesión el bug de overselling se confirmó leyendo `pg_get_functiondef` en vivo, no asumiendo del código del repo.
- **Cambiar firma de función PostgreSQL (DROP+CREATE) resetea permisos a PUBLIC** → re-verificar. El fix pendiente del guard de stock NO cambia firma, pero se re-verifica igual.
- **El cierre real va por el botón admin, NUNCA por SQL.**
- **Nunca borrar grupos con holds vivos** (`authorized`/`instructed`) sin confirmar el estado del PaymentIntent en Stripe primero.
- **www vs sin www:** `www.vonda.es` siempre.
- **Git:** autor `benjaminperezsouto@gmail.com`.
- **Potencia:** money-critical (compute_price, close_group, confirm_join, prepare_join, capturas, RLS) → Opus 4.8. Display/UI/copy → Opus 4.6.
- **Anti scope creep:** el rediseño de la ficha respondía a un problema real de representación del motor + un mockup de referencia validado por Benjamin. No se añadieron features nuevas fuera de eso.

---

## ✅ Primer paso de la próxima sesión

**⚡ Arreglar el guard de stock en `confirm_join` y `prepare_join` (Opus 4.8).** Es money-critical y ya está diagnosticado y con fix propuesto — solo falta confirmar, aplicar, verificar permisos, y testear con el grupo `8838d617-...` como caso de prueba.

Tras el fix:
1. Limpiar el grupo de test de overselling.
2. Seguir con cutover Stripe test→live o vendedor real, según prioridad de negocio.
