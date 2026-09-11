# VONDA — Estado completo y plan de arranque (handoff 28 jun 2026)

**Fecha de cierre de sesión:** 28 jun 2026
**Repo:** `/Users/benjamin/Desktop/kuorum` (Next.js 14 App Router · `src/` · `@/` → `src/`)
**GitHub:** `thedesignerux-lgtm/kuorum` · Supabase project: `xpktkuozspreuxucnguh`
**Reparto:** Claude = arquitecto/CTO (escribe el código y razona); Benjamin = manos + dashboards. Cowork edita archivos; **NO toca `.git/`** → git lo corre Benjamin en su Mac.

---

## Qué es

MVP de compra colectiva para ciclismo en España. El precio baja en vivo según entran compradores (por **unidades**). Cierre dominical 22:00 Europe/Madrid. Precio único de liquidación. **Vonda es merchant-of-record.** Motor de demanda efectiva (comprador "ahora" PMA=∞ / esperador PMA=X).

**Lanzamiento objetivo:** **domingo 5 de julio 2026** (movido desde el 28 jun, depende del vendedor real).

---

## 🟢 LO QUE SE HIZO EL 28 JUN — ENSAYO 3 COMPLETADO Y VERDE

**El money-critical que llevaba pendiente desde el 16 de junio, por fin ejecutado y validado de punta a punta con el motor de esperadores.**

### Pre-vuelo (las 4 lecturas, esta vez SÍ completadas)
1. ✅ Estado de las 5 funciones (firmas + permisos) — todas correctas, firma única, blindaje OK.
2. ✅ Grupos de test inventariados.
3. ✅ Cuerpo vivo de `close_group` leído (camino del esperador que no califica: paso 4, `target_price < v_settlement` → cancelled).
4. ✅ Camino de liberación en `stripe-capture.ts` confirmado (`cancelled` → libera hold).

### Montaje del ensayo
- Grupo clon `ENSAYO3_BORRAR` (UUID `582437b9-6e3e-4f60-9aa8-cd1b894dc7d1`), tramos `2→18 / 4→15 / 10→12`, mín 2, stock 50, stepped. Creado directo por SQL (grupo + bid).
- 4 joins reales con tarjeta test `4242…` desde `www.vonda.es` (vía webhook de producción):

| # | email | modo | qty | target | hold |
|---|---|---|---|---|---|
| A | test-ensayo3a | comprar | 2 | ∞ | 36€ |
| B | test-ensayo3b | esperar | 1 | 15 | 15€ |
| C | test-ensayo3c | esperar | 1 | 15 | 15€ |
| D | test-ensayo3d | esperar | 2 | 12 | 24€ |

> Nota: el plan original era B con qty 2. B aterrizó con qty 1 (Benjamin alternó cantidad en la UI y se envió 1). Se compensó añadiendo C (esperador@15 qty 1) para llevar la demanda al tramo de 15 a 4 y desbloquearlo. El test quedó igual de válido.

### Estado del motor antes de cerrar (verificado)
| Tramo | Requiere | Demanda efectiva | Desbloqueado |
|---|---|---|---|
| 18 € | 2 | 2 | ✓ |
| 15 € | 4 | 4 | ✓ |
| 12 € | 10 | 6 | ✗ |

Precio de liquidación = **15 €**.

### Cierre (botón admin → `closeGroup()` → `close_group` SQL + `captureGroupPayments` Stripe)
**Importante:** el cierre se hizo por el **botón del panel admin**, NO por SQL. `close_group` (SQL) sólo mueve estados en la BD; la captura/liberación real en Stripe la hace `captureGroupPayments` (TypeScript). Cerrar por SQL habría dejado los holds colgados.

### Resultado — VERDE, dinero al céntimo (BD + Stripe confirmados)

| # | Modo | Hold | Capturado | payment_status | Esperado | ✓ |
|---|---|---|---|---|---|---|
| A | comprar 2 | 36€ | **30€** | paid | 30 (libera 6) | ✅ captura parcial |
| B | esperar@15 ×1 | 15€ | **15€** | paid | 15 | ✅ |
| C | esperar@15 ×1 | 15€ | **15€** | paid | 15 | ✅ |
| D | esperar@12 ×2 | 24€ | — | released | 0 / liberado | ✅ liberación total |

- **Grupo:** `status=closed`, `final_price=15`, `winner_bid_id` adjudicado, `total_units=4`.
- **Total capturado: 60€ · Total liberado: 30€.**
- **Cero `authorized` colgados.**
- **Benjamin confirmó los 4 PaymentIntents en el dashboard de Stripe** (modo test) — coinciden con la BD.

**Conclusión:** la captura parcial CON esperadores (el bug más temido) queda descartada con dinero real. El esperador que califica se cobra a su target; el que no califica se libera entero. **El motor de PMA está validado de punta a punta.**

### Limpieza de datos de prueba (28 jun)
Borrados 4 grupos terminales + 6 usuarios test, sin huérfanos (orden: events → members → bids → groups → users orphaned). Regla aplicada: **nunca borrar un grupo con holds vivos** (`authorized`/`instructed`).
- Borrados: `ENSAYO3_BORRAR`, `TEST_CIERRE_BORRAR`, `Probando otra vez`, GP5000 `20ab80c1` (cancelado vacío).
- Usuarios borrados: `test-ensayo3a/b/c/d@vonda.es`, `test1@vonda.es`, `test2@vonda.es` (sólo los huérfanos puros; cuentas de Benjamin `benxaque*`/`tradeando05` NO se tocaron).

---

## 🔴 PENDIENTE INMEDIATO — confirmar antes de borrar

### GP5000 `b1bdab3e-9b23-4700-9869-8ef3537a6b35` (closed, 6 miembros, 3 `instructed`)
Grupo viejo (datos inventados, época 21 jun). Está `closed` pero tiene **3 miembros en `instructed`** — estado no terminal: se adjudicaron pero `captureGroupPayments` nunca los capturó ni liberó. Si esos 3 holds siguieran vivos en Stripe, borrarlo los dejaría huérfanos.
- **Acción:** Benjamin mira esos 3 PI en Stripe. Los holds duran ~7 días → casi seguro **ya expirados** (grupo de hace >7 días). Si están expirados/cancelados → borrarlo con el mismo patrón de limpieza. Si por lo que sea siguen vivos → liberarlos antes de borrar.
- **Hallazgo de proceso anotado:** un grupo puede quedar `closed` con miembros `instructed` si la captura no llegó a correr. No es un bug del cierre actual (hoy A/B/C terminaron en `paid` correctamente), pero vigilar que cada cierre real complete la fase de captura.

---

## 🔴 BUGS DE DISPLAY PENDIENTES (Opus 4.6 — no tocan dinero, motor verificado correcto)

Cazados hoy durante el ensayo. **El motor calcula bien; son sólo de pantalla.** Lo más rápido y visible de cara al lanzamiento.

1. **`ProgressToNextPrice` apunta al tramo equivocado.** Muestra "Faltan N uds para 12€" (el tramo más barato/lejano) en vez del **siguiente tramo más cercano** (15€, donde sólo falta 1). La escalera "Metas de precio" justo debajo SÍ lo calcula bien ("15€ · Faltan 1") → el dato está disponible, el componente elige mal el tramo. (Es el bug #1+#2 del handoff del 27 jun.)

2. **CTA/radio con números desalineados + colapso a medias.** Al elegir esperar@15 y colapsar a "comprar ahora": el radio muestra "Comprar ahora · 18€" (precio actual estático) mientras el CTA muestra "15€" → confunde. Y en un caso el modo saltó a comprar pero el botón seguía diciendo "Reservar plaza · 15€ máx." en vez de "Comprar ahora · 15€". Wiring del CTA a medias en `JoinModeSelector` / la ficha.

3. **La ficha no refresca en vivo al entrar un miembro nuevo.** Tras un join, la pantalla seguía mostrando el estado anterior (precio, "X unidades en el grupo", "Compradores firmes/Reservas") hasta refrescar manual. Los contadores quedaban además inconsistentes entre sí (ej. "Participantes 4" con "4 unidades" y precio 18). Revisar el canal realtime de la ficha / `useTierDemand` y los componentes de resumen.

> Recordatorio del 27 jun aún vigente: `total_units` en la BD puede ser 0 si TODOS los miembros son esperadores con target < current_price (definición de "demanda firme al precio vigente"). `close_group` NO usa `total_units` para dinero (verificado) — sólo display.

---

## 🟡 OTROS PENDIENTES (para el lanzamiento del 5 jul)

### Money-critical
- **Cutover Stripe test → live** (⚡ Opus 4.8, cuando la empresa esté registrada): claves `live`, endpoint webhook en modo live con su `whsec_`, 3 vars en Vercel, redeploy, prueba con tarjeta real (cobro pequeño → reembolso).

### Seguridad / pre-producción
- **Rotación de claves Sendcloud** (el par actual salió en el chat durante la integración → regenerar, meter en `.env.local` + Vercel, nunca más por chat).
- `SENDCLOUD_FROM_*` reales (hoy placeholders) cuando se concrete el distribuidor.
- Carrier real: `SENDCLOUD_SHIPPING_OPTION_CODE` (SEUR contrato propio de pago vs `correos_express:paq24` gratis). Es string de config, cero código.

### Motor
- **"Cambiar de objetivo" en vivo** (Nivel 3): money-critical, reautorización de holds. V1.

### Menores anotados (de handoffs previos)
- `compute_price_at_n` sin uso → retirar.
- CHECK constraint de monotonía de tiers en BD (hoy sólo en TS del admin).
- Guard de `group_id` en webhook (PI sin `metadata.group_id` → 200 sin llamar `confirm_join`).
- Página "unido" con polling en vez de fiarse del Payment Element.
- DST de `closes_at` (`20:00 UTC` = 22:00 CEST verano, 21:00 CET invierno) → antes de octubre.
- Centralizar Resend (webhook instancia su propio `new Resend()`).
- `confirm_join` dedupe latente (check por tel OR email, upsert `ON CONFLICT (email)`).
- Excedente con 2ª puja → admin-manual V0.

### Bloqueador de negocio (lo que de verdad mueve el lanzamiento)
- **No hay vendedor real.** Pago ✅ + Envío ✅ (Sendcloud). Falta cerrar al distribuidor (decisión de carrier pendiente) y meter sus tramos reales.

---

## 🔧 DATOS TÉCNICOS DE REFERENCIA

### Funciones money-critical (verificadas en BD viva 28 jun)
| Función | Firma | Permisos |
|---|---|---|
| `compute_price` | `(uuid, integer, numeric)` — 2 defaults (`p_extra_units=0`, `p_extra_target=NULL`) | anon/auth/svc = true (abierta) |
| `close_group` | `(uuid)` | solo service_role |
| `confirm_join` | 11 args | solo service_role |
| `tier_demand` | `(uuid)` | anon/auth/svc = true (abierta) |
| `prepare_join` | `(uuid, text, integer)` | solo service_role |

### Lógica de `close_group` (resumen, leída hoy línea a línea)
1. Lock + idempotencia (si ya closed/cancelled/closing → return).
2. `status='closing'`.
3. Precio final vía `compute_price` (sin args → tramo más barato desbloqueado).
4. Liberar esperadores con `target_price IS NULL OR target_price < settlement` → `cancelled`.
5. Mínimo de ejecución medido SOLO sobre los que compran (`comprar` OR `target>=settlement`). Si no llega → cancelación total.
6. Adjudicación por stock sobre el pool de compradores, por `join_order`.
7. Excedente → 9A cierre limpio (surplus=0) / 9B excedente con 2ª puja.

### Contrato `group_members`
- `join_mode` text NOT NULL default 'comprar' · `target_price` numeric NULL
- Vivos (cuentan demanda) = `payment_status IN ('authorized','instructed','paid')`. Muertos = released/cancelled/auth_failed.
- Índice único `uniq_member_per_group` sobre `(group_id, user_id)`. Columna PI: `stripe_payment_intent_id`.
- Columnas de dinero: `authorized_amount` (hold), `captured_amount` (capturado real al cierre).
- `total_units` = demanda firme al precio vigente (no incremental; recalculado en cada `confirm_join`).

### Grupos en producción AHORA (tras limpieza)
- **Motor parapente** `9450351f-3330-4fa1-a9e8-cd0132cd8541` — OPEN, 4 miembros, 4 holds `authorized` vivos. Datos de prueba del motor. **NO tocar / NO usar para ensayos** (crear clon).
- **Continental GP5000 S TR** `b1bdab3e-9b23-4700-9869-8ef3537a6b35` — CLOSED, 6 miembros, 3 `instructed` (ver pendiente inmediato).

### Stripe
Modo test · sandbox "Vonda sandbox" · endpoint `creative-harmony` → `https://www.vonda.es/api/stripe/webhook` · 1 evento `payment_intent.amount_capturable_updated`.

### IDs útiles
- Benjamin user: `7aaa12dd-42bd-4bb9-b3fb-c6d9d8e54da6`

### Archivos clave (display bugs a tocar)
- `src/hooks/useTierDemand.ts`
- `src/components/ProgressToNextPrice.tsx`
- `src/components/JoinModeSelector.tsx`
- `src/components/TierDemandLadder.tsx`
- `src/components/GroupLiveSection.tsx`
- `src/components/desktop/GroupRightSidebar.tsx`
- `src/components/desktop/GroupDesktopView.tsx`
- `src/app/api/group/[id]/summary/route.ts`
- `src/lib/stripe-capture.ts` (referencia del camino de captura/liberación)

---

## 🧠 REGLAS DE PROCESO

- **Verificar contra la BD viva** — no handoffs, no memoria de Cowork. La pantalla puede estar stale; la BD es la verdad (hoy la ficha mostraba 18€ cuando el motor ya daba 15€).
- **El cierre real va por el botón admin, NUNCA por SQL** — `close_group` (SQL) sólo mueve estados; `captureGroupPayments` (TS) toca Stripe. Cerrar por SQL deja holds colgados.
- **Nunca borrar grupos con holds vivos** (`authorized`/`instructed`) — deja holds huérfanos en Stripe.
- **Cambiar firma de función PostgreSQL (DROP+CREATE) resetea permisos a PUBLIC** → re-verificar.
- **Cowork editó `compute_price.sql` sin pedírselo (con un DROP)** — vigilar `git diff` antes de commitear.
- **www vs sin www:** `www.vonda.es` siempre (apex redirige 308, rompe server-to-server).
- **Git:** autor `benjaminperezsouto@gmail.com`.
- **Potencia:** money-critical → Opus 4.8. Display → Opus 4.6.
- **Anti scope creep:** sólo alcance V0.

---

## ✅ Primer paso de la próxima sesión

El money-critical gordo (Ensayo 3) está VERDE. Quedan, por orden de impacto cara al lanzamiento del 5 jul:

1. **Confirmar y limpiar el GP5000 `b1bdab3e`** (mirar sus 3 holds `instructed` en Stripe).
2. **Arreglar los 3 bugs de display** (Opus 4.6, rápidos y muy visibles): ProgressToNextPrice tramo equivocado, CTA/radio desalineados, ficha no refresca en vivo.
3. **Cutover Stripe test → live** (⚡ Opus 4.8) cuando la cuenta esté verificada.
4. **Rotación de claves Sendcloud.**
5. **Vendedor real** — el bloqueador de negocio.
