# VONDA — HANDOFF 8 julio 2026

**Sesión:** 7–8 julio · G5 (admin multi-puja) + fixes UX ficha + G5.2 + G6 E2E
**Modelos:** Opus 4.6 (G5, UX) → **Fable 5** (G5.2 + G6, money-critical)
**Estado al cierre: MULTI-PUJA COMPLETO G0→G6. Maquinaria multi-vendedor verificada E2E con dinero real (test mode). Lista para lanzamiento 30 julio.**

---

## 1. Lo que se hizo

### G5 — Admin multi-puja (Opus 4.6) ✅
- **G5.1**: enum `bid_status` ampliado con `'withdrawn'` (migración `g5_add_withdrawn_to_bid_status_enum`). Vocabulario completo: `active`, `outbid`, `winner`, `declined`, `withdrawn`.
- **`grupos/actions.ts`**: `validateBidFields()` compartida (createGroup + addBidToGroup); guard "solo primera puja" ELIMINADO — `addBidToGroup` acepta pujas adicionales; validaciones nuevas: `min_execution ≤ max_stock` y `tier.min_units ≤ max_stock`; verifica grupo `open` antes de insertar; `next_price` se pone a NULL si compute_price no devuelve salto.
- **`grupos/[id]/actions.ts`**: nueva server action **`withdrawBid`** con guard §5.3 — retirada TENTATIVA (marca `withdrawn` → recalcula compute_price → compara contra `guaranteed_price` mínimo de miembros con holds vivos → ROLLBACK a `active` si el precio subiría). Bloquea retirar la única puja activa. Race window asumida (solo Benjamin usa el admin).
- **`AssignSellerForm.tsx`**: prop `isFirstBid` — primera puja pide fecha de cierre + PVP (datos del grupo); pujas adicionales NO (título "Añadir puja de otro vendedor").
- **`WithdrawBidButton.tsx`** (nuevo): confirmación en 2 pasos, error del guard inline.
- **`page.tsx` admin grupo**: form "Añadir puja" siempre visible en grupos `open`; badges de estado por puja (Activa/Ganadora/Superada/Rechazada/Retirada); botón "Retirar" solo con 2+ activas; contador "N activas"; pujas ordenadas por `created_at ASC`; **fix display**: miembros `released`/`cancelled` muestran "—" en precio/total y el pie solo suma cobrados.
- Commit `93c60e1`.

### Fixes UX ficha (Opus 4.6) ✅
- **Móvil** (commit `d1128a7`): `ProgressToNextPrice` acepta `selectedQuantity` — barra dos capas (real sólida + proyección `bg-brand/30`), "0 +N / M unidades", badge verde "¡Desbloqueáis X!"; `GroupLiveSection` construye CTA con `URLSearchParams` incluyendo `?qty=N`; `unirme/page.tsx` lee `searchParams.qty` (clamp 1–10) → `initialQuantity` a `JoinFlow`.
- **Escritorio** (commits posteriores): `TierDemandLadder` acepta prop opcional `selectedQuantity` (default 0, retrocompatible — móvil no lo pasa y queda idéntico): líneas entre nodos con proyección semitransparente, nodo pre-desbloqueado en `bg-brand/40` con check y "¡Lo desbloqueas!", "Faltan X" descuenta las uds seleccionadas; `GroupCenterContent` pasa `selectedQuantity={quantity}` a la escalera, CTA con `?qty=N`, tarjeta "Próximo descuento" añade "¡Con tus N uds se desbloquea!".
- **Lección de sesión**: móvil y escritorio son árboles de componentes SEPARADOS (`lg:hidden` vs `hidden lg:block`) — Benjamin miraba escritorio mientras el fix estaba solo en móvil. Todo fix de ficha debe cubrir AMBOS. Repetido el problema de descargas: verificar SIEMPRE con `ls -la` + `grep -c` que el archivo descargado es la versión nueva antes de copiar (Chrome añade "(2)" y no sobrescribe).

### G5.2 — `close_group` v2.1 (Fable 5) ✅
- Migración `g52_close_group_v21_outbid_on_regla6`: 2 bloques idénticos `UPDATE bids SET status='outbid' WHERE group_id=... AND status='active'` añadidos en los DOS caminos de Regla 6 (candidata no elegible + cinturón min_execution). Resto verbatim.
- El camino de excedente con segunda puja NO se toca (la 2ª queda `active` a propósito para resolución).
- `CREATE OR REPLACE` misma firma → permisos preservados. Verificado por OID: 1 sobrecarga, anon=false, authenticated=false, service_role=true, 2 bloques ★G5.2 presentes.
- Test sintético: grupo 2 pujas (min_exec 5) + 1 miembro 2 uds → close → `no_execution`, grupo `cancelled`, **ambas pujas `outbid`** ✅. Datos limpiados (gen_random_uuid, emails `test-g52-*@vonda.local`).

### 🐛 Bug real cazado en G6: `create-intent` validaba target contra UNA puja
- **Síntoma**: esperador a 14 € (precio de puja B) → "El precio objetivo no es válido".
- **Causa**: `src/app/api/join/create-intent/route.ts` validaba `target_price` contra `bids.tiers` de `prep.best_bid_id` (puja A: [18,15]) — resto mono-puja que G4 no migró.
- **Fix**: validar contra `rpc('tier_demand')` (escalera fusionada, coherente con D5). Todo lo demás intacto. Commit `fix(g6): validate esperador target against merged ladder, not single bid tiers`.
- El intento fallido NO dejó residuos (el error salta antes de crear el PaymentIntent).

### G6 — Ensayo E2E multi-puja (Fable 5) ✅
**Grupo `TEST G6 Multipuja`** (`75f3f67e-5428-40f5-bc35-a392dab80615`), PVP 100, cierre 12 jul (cerrado manualmente el 8):
- Puja A (Seller A, 1ª): 2→18 / 4→15, min_exec 2, max 20
- Puja B (Seller B, añadida con el **botón G5 en su primer uso real**): 3→14, min_exec 3, max 20
- Escalera fusionada pública verificada: **2→18 · 3→14** (el 15 de A absorbido por el 14 de B — D1). D5 verificado: cero rastro de vendedores en ficha.
- Uniones (tarjeta test, holds reales): m1 comprar 2 uds @18 (hold 36) · m2 **esperador target 14** (hold 14 — el camino que estaba roto) · m3 comprar 1 ud @14 (hold 14).
- Nota comportamiento correcto: la ficha PROYECTA — la unión 2 ya veía 14 € porque su propia unidad desbloqueaba el tramo.
- **Cierre por botón del panel. Resultado 6/6 literal**: grupo `closed` final 14.00, **B `winner`**, **A `outbid`**, 3 miembros `paid` a 14.00, capturas **28** (parcial de 36, 8 liberados) + **14** + **14** = 56 €. Stripe dashboard: 3 succeeded confirmados.

---

## 2. Decisiones de sesión
- Regla 6 marca pujas como `outbid` (no estado nuevo) — badge admin "Superada".
- Pujas adicionales NO tocan fecha de cierre ni PVP del grupo (solo la primera).
- Escritorio: el progreso dinámico vive en la escalera `TierDemandLadder` (decisión Benjamin), no en una barra nueva; la tarjeta "Próximo descuento" mantiene el texto simple.
- Cerrar por SQL solo grupos SINTÉTICOS sin holds; con holds reales SIEMPRE botón del panel (se mantiene).

## 3. Flecos / backlog (display, Opus 4.6)
1. **Latencia "X unidades confirmadas"** en carrito: compra muy seguida → webhook de la anterior no terminó al renderizar; dato correcto en BD. Valorar refetch/polling.
2. **"Vendedor verificado" no aparece en escritorio** (sí en móvil).
3. `compute_price.next_price` devuelve el precio actual cuando no hay salto inferior (la ficha usa `useTierDemand`, no afecta; solo cosmética del dato almacenado).
4. Carry-forward previos: `ProgressToNextPrice` con mejor precio alcanzado; `total_units=0` con solo esperadores; emails de liberación/petición cancelada; favoritos/perfil; productos reales del escaparate.

## 4. Estado de grupos de test
- `TEST G6 Multipuja` (`75f3f67e-...`): **closed**, 3 miembros paid — conservar como referencia del ensayo o limpiar más adelante (Stripe test).
- `TEST G4 Smoke` (`9cf168fc-...`): open, sin miembros, cron lo cerrará el 12 jul por Regla 6 → con G5.2 su puja quedará `outbid` limpiamente. Borrarlo antes desde admin si se prefiere.
- "Motor parapente": intocable (2 miembros reales de test).

## 5. Próximos pasos
1. **Ensayo 3** (⚡ Fable 5/Opus 4.8): close con esperadores reales que NO cualifican (verificar liberaciones). Grupo fresco, tiers 2→18/4→15/10→12.
2. Stripe live cutover (bloqueado por alta de empresa): 3 env vars + redeploy.
3. Auditoría RLS completa pre-live (⚡).
4. Backlog display (Opus 4.6).
5. Sendcloud: decisión de carrier pendiente del distribuidor.

## 6. Recordatorios de protocolo vigentes
- Potencia: Opus 4.6 por defecto; ⚡ Fable 5/Opus 4.8 solo para compute_price, close_group/join_group, RLS.
- Money-critical: propuesta → SQL completo a revisión → "Confirmo" → ejecución → verificación por OID + datos vivos → limpieza sintéticos.
- Tras cada archivo generado por Claude: descargar → `ls -la` + `grep -c` del marcador nuevo → copiar → `git diff --stat` → tsc → commit. Chrome renombra con "(2)": citar el nombre real en el `cp`.
