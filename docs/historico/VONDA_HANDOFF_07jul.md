# VONDA — HANDOFF 07 jul 2026

**Sesión:** lunes 6 jul → madrugada martes 7 jul (~05:30)
**Modelo:** Fable 5 (toda la sesión: auditoría de dinero + gates multi-puja + RLS)
**Cambio mayor de contexto: LANZAMIENTO MOVIDO AL 30 DE JULIO** (antes 12 jul). Sin productos de escaparate definidos aún.

---

## 1. Auditoría del cierre automático del 5 jul (checklist §4 del handoff anterior)

| # | Punto | Resultado |
|---|---|---|
| 1 | 3 GP5000 en `closed` a 38,90 / "De riada" `cancelled` | ✅ |
| 2 | Capturas | ⚠️ 12/15 correctas al céntimo (1 166,90 €). **3 fallaron: holds >7 días** |
| 3 | Capturas parciales (195,60→155,60 / 44,90→38,90) | ✅ |
| 4 | Emails | ❌ 0 confirmaciones a los que pagaron · ❌ sin email de petición cancelada · ✅ instrucciones de pago (3) · ✅ alerta admin |
| 5 | `winner_bid_id` coherente | ✅ |

### Incidente: expiración de holds a los 7 días (hallazgo más valioso del ensayo)

Stripe cancela autorizaciones de tarjeta a los **7 días exactos**. En el grupo `64455c3f`:

| Join | Antigüedad del hold al cierre | Resultado |
|---|---|---|
| 1–3 | 7d 9h · 7d 25min · 7d 8min | ❌ expirados |
| 4–5 | 6d 14h | ✅ capturados |

**Descubrimiento positivo:** el sistema NO falló en silencio. `captureGroupPayments` detectó los fallos, envió alerta al admin con los 3 PaymentIntents, y disparó automáticamente el **flujo de pago manual por transferencia** (email "Instrucciones de pago" con concepto `VONDA-6445-N` y plazo 48h) — la red de seguridad pre-Stripe seguía viva. Los 3 miembros quedaron en `instructed` esperando transferencia (dejados así como evidencia, es test).

---

## 2. Fixes desplegados esta sesión (commits en main)

- **`b25d43b`** — Email de **confirmación de compra** (`purchaseConfirmation.ts` + `sendPurchaseConfirmation` en resend.ts + bifurcación en `sendClose.ts`: `paid` → confirmación con `captured_amount` real; `instructed` → instrucciones de pago). También corregido el copy de la alerta admin ("reintenta cerrando" era consejo inútil con holds expirados).
- **`0b3b715`** — **Regla de ventana de 6,5 días** (`src/lib/closeWindow.ts`, 156h con margen de 12h sobre el límite de Stripe). Aplicada en los 3 caminos de servidor: `createGroup`, `addBidToGroup` (incl. fecha heredada), `updateGroup` (anclada al hold vivo más antiguo del grupo). **Verificada de punta a punta el 7 jul**: el admin rechazó una fecha a 10 días con el mensaje exacto del helper.
- **`70fe651` + `f7274fa`** (domingo 5) — Estado "mejor precio alcanzado" en la ficha: banner verde, `PriceJourney`, CTA above fold, sidebar simplificado, copy sin "Cancelación fácil".
- **`feat(d5)` ×2 (7 jul)** — ver §4 (G4).

**Pendiente de construir (detectado en auditoría):** email al peticionario cuando su grupo se cancela (Regla 6) y email a miembros **liberados** al cierre (esperadores no alcanzados y, ahora, caso María). Con decisión (b) la liberación bien comunicada es parte del trato.

---

## 3. Multi-puja: gates G0→G3 ejecutados y verificados

### G0 — Anclaje al código real (4 hallazgos que corrigieron la spec)
1. **G1 no existía:** cero pujas en grupos abiertos; `createGroup` ya inserta `'active'`. G1 saltado.
2. **Vocabulario real:** el enum ya tiene `'outbid'` (no `'lost'` como proponía la spec). **Decisión A (Benjamin): adoptar `'outbid'`.** `'withdrawn'` queda para G5.
3. `close_group` v1 ya era semi-multi-puja (camino 9B-ii de excedente con segunda puja).
4. **`max_stock` NO participaba en el precio vivo** — meterlo (spec §3.1) habría roto D0. **Decisión B (Benjamin): `max_stock` fuera del precio publicado**; protección solo en adjudicación. El "mínimo acumulado" de §3.3 se vuelve innecesario (el mínimo de curvas no crecientes ya es no creciente). Contrapartida pendiente en G5: validación admin `min_units ≤ max_stock` por puja.

Líneas base de permisos registradas: `compute_price` anon✓/auth✓/service✓ · `close_group` solo service · `tier_demand` anon✓/auth✓/service✓.

### G2 — `compute_price` v2 (migración `compute_price_v2_multibid_fusion`)
Fusión D1 = `MIN(precio_b(N))` sobre pujas activas, sin cláusula de validez. Firma intacta (`p_extra_units`/`p_extra_target`), semántica de `next_price` "+1 unidad" intacta, guard de conjunto vacío intacto. Batería: regresión 1 puja idéntica bit a bit · fusión 2 pujas = cálculo manual (13€) · `max_stock` ignorado en precio · empate → antigua (D3) · puja peor en todo neutralizada (§5.2) · puja nueva solo baja el precio (D4). Higiene: 1 versión, permisos idénticos.

### §4.4 — Decisión (b) aprobada: PMA universal
**El comprar-ahora tiene PMA operativo = su `guaranteed_price`.** Si la liquidación supera su garantizado (solo posible con 2+ pujas cuando la puja que marcaba precio cae inelegible), se libera como un esperador no alcanzado: reembolso íntegro automático. Una sola regla económica; el punto fijo por candidata absorbe la cascada; con 1 puja es un no-op (D0). La opción (a) (vendedor absorbe vía 75%) se descartó: obligaría a un vendedor a sostener el precio de un competidor que no puede ver.

**Enmiendas de Benjamin (registradas):**
- *Settlement de candidata inelegible = precio de referencia para ranking/logging, no necesariamente ejecutable.*
- **Regla 9 (institucionalizada): adjudicación intra-pool = FCFS por `join_order`.** Un PMA alto no compra prioridad de stock.

### G3 + Gate R — `close_group` v2 (migración `close_group_v2_multibid_candidates_pma_universal`)
Cambios: paso 3 = evaluación por candidatas (punto fijo por puja con demanda PMA-universal: comprar cuenta si `guaranteed ≥ p`, esperar si `target ≥ p`; elegible si ≥ `min_execution`; gana la liquidación más barata, empate → antigua); paso 4 = liberación amplía a compradores con `guaranteed < liquidación`. Pasos 1,2,5–9 idénticos a v1 (claves jsonb intactas para la capa TS).
Batería: **Gate R** (réplica F1, 1 puja) idéntico al contrato v1 · M1 gana la barata elegible · **M2 caso María** (barata inelegible → gana la siguiente; María `cancelled` sin `final_price`) · M3 Regla 6 · M4 empate D3. Pujas `winner`/`outbid` correctas. Higiene ✅.
**Fleco cosmético para G5:** tras Regla 6, la puja queda `active` en grupo `cancelled` (comportamiento heredado de v1).

---

## 4. G4 — Opacidad D5 cerrada (BD + app + RLS)

- **`tier_demand` v2** (migración `tier_demand_v2_multibid_fusion`): fusión con dedup — tramos dominados invisibles, mismo contrato de salida. Regresión 1 puja idéntica; fusión de 3 pujas = cálculo manual, sin rastro de cuántas pujas hay.
- **App (commits `feat(d5)`):** `grupo/[id]/page.tsx`, `unirme/page.tsx` y **`page.tsx` (home)** migrados a `supabaseAdmin` + escalera vía `tier_demand`. `maxStock` mostrado = el de la puja del mejor precio actual. `minExecution` era dato muerto en la ficha (se mantiene fluyendo, no se pinta). `GroupLiveSection`: copy fijo "Vendedor verificado" sin contar pujas (D5).
- **Bug arreglado de rebote:** la ficha trataba la respuesta de `compute_price` como objeto (es array) → `best_price` siempre `undefined`; la página vivía del `current_price` cacheado. Ahora lee `rpc[0]` y muestra precio vivo real.
- **RLS sellada** (migraciones `g4_revoke_bids_public_read_d5_opacity` + `g4_revoke_bids_table_grants_defense_in_depth`): política `bids_public_read` eliminada + `REVOKE SELECT FROM anon, authenticated` (defensa en profundidad). Estado final verificado: 0 políticas, RLS activo, `anon`/`auth` sin SELECT, `service_role` intacto. Reversión documentada en la migración.
- **Incidente durante G4 (resuelto):** el escaparate quedó en blanco tras la revocación — la home usaba un **embed** `bids(...)` que la búsqueda de `.from('bids')` no detectó. Fix inmediato. **Lección: buscar también `bids(` y `!inner`; smoke test = SIEMPRE 3 pantallas (home + ficha + unirme).**

**Grupo de prueba vivo:** `TEST G4 Smoke` (`9cf168fc`), cierra 12 jul 22:00 por cron → sin miembros caerá por Regla 6 a `cancelled` (inofensivo). Borrarlo antes desde admin si molesta en el escaparate.

---

## 5. Estado del plan de gates

G0 ✅ · G1 saltado (verificado vacío) · G2 ✅ · GR ✅ · G3 ✅ · G4 ✅ · **G5 pendiente** · **G6 pendiente**

**G5 (admin, sirve Opus 4.6):** botón "Añadir puja" en `admin/grupos/[id]` + validaciones: `min_units ≤ max_stock` por puja (decisión B), retirada `withdrawn` con guard §5.3, limpiar fleco de puja `active` huérfana tras Regla 6. Recordar: el enum `bid_status` necesita `'withdrawn'` (hoy: active/winner/outbid + los legacy que hubiera).
**G6 (Fable 5/Opus 4.8):** ensayo E2E multi-puja estilo F1/F2 — grupo real en test, 2 pujas, holds reales de Stripe, cierre por panel admin (encadena capturas), verificación en dashboard + emails (ahora incluye confirmación de compra). Sustituye/absorbe al "Ensayo 3" pendiente del handoff anterior.

---

## 6. Backlog fuera de multi-puja

1. Productos reales del escaparate (sin definir; cierres deben respetar ventana 6,5d)
2. Página de favoritos · página de perfil (Opus 4.6)
3. Email a liberados al cierre + email de petición cancelada
4. Stripe live cutover (sigue bloqueado por alta de empresa)
5. Display bugs conocidos: el de `ProgressToNextPrice` quedó resuelto por el estado best-price del 5 jul; `total_units=0` con solo esperadores sigue pendiente (display, no dinero)
6. V1 post-lanzamiento: cobro off-session (`setup_future_usage`) para eliminar la restricción de 7 días

## 7. Lecciones nuevas de esta sesión

- Los embeds PostgREST (`tabla(...)`) no aparecen buscando `.from('tabla')` — buscar ambos patrones siempre.
- "N archivos editados" de Cowork incluye su contabilidad interna — `git status` es la única verdad (esta vez fue falsa alarma).
- `execute_sql` con varias sentencias devuelve solo el último resultado — verificar pasos intermedios por separado.
- UUIDs sintéticos: solo hex (`u1`/`b1` no valen).
- `git diff` no acepta `--no-pager` como opción propia — `GIT_PAGER=cat git diff`.
- El enum real manda: intentar `'lost'` falló contra `bid_status` — el vocabulario del código ensayado gana al de la spec.
- Foto pre-migración ANTES de aplicar, siempre — sin grupos vivos, sandbox sintético con status que lo oculte del público o cierre lejano.
