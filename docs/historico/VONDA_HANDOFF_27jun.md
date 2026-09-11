# VONDA — Estado completo y plan de arranque (handoff 27 jun 2026)

**Fecha de cierre de sesión:** 27 jun 2026
**Repo:** `/Users/benjamin/Desktop/kuorum` (Next.js 14 App Router · `src/` · `@/` → `src/`)
**GitHub:** `thedesignerux-lgtm/kuorum` · Supabase project: `xpktkuozspreuxucnguh`
**Reparto:** Claude = arquitecto/CTO (escribe el código y razona); Benjamin = manos + dashboards. Cowork edita archivos; **NO toca `.git/`** → git lo corre Benjamin en su Mac.

---

## Qué es

MVP de compra colectiva para ciclismo en España. El precio baja en vivo según entran compradores (por **unidades**). Cierre dominical 22:00 Europe/Madrid. Precio único de liquidación. **Vonda es merchant-of-record.** Motor de demanda efectiva (comprador "ahora" PMA=∞ / esperador PMA=X).

**Producto del primer grupo (inventado, sin vendedor real aún):** Continental GP5000 S TR 700x28c · PVP 79,95 € · tramos 10→74,90 / 25→69,90 / 50→64,90 / 100→59,90 · mín 10 uds · stock 120 · cláusula 75%.
**Lanzamiento objetivo:** domingo 28 jun 2026 (depende del vendedor real).

---

## 🟢 LO QUE SE HIZO EL 27 JUN — Ficha con motor PMA real

### Sesión larga de diseño + construcción. El problema raíz: la ficha vendía el target del usuario como destino cuando su entrada ya desbloqueaba un precio más barato (cascada de demanda PMA).

### Decisiones de producto cerradas (canónicas)

1. **Precio actual = tramo más barato YA desbloqueado** por la demanda firme, SIN contar al usuario que mira. Sale de `tier_demand`.
2. **Proyección:** cuando el usuario elige cantidad Q y modo, la ficha consulta `compute_price(grupo, Q, target)` y muestra el precio resultante R.
3. **Colapso esperar→comprar (A1):** si R ≤ target del usuario → CTA pasa de "Reservar" a **"Comprar ahora · R €"**. Aprobado también en JoinFlow (checkout).
4. **Banner de proyección (B sí):** verde "Con tus N uds, el grupo baja a R €" cuando la entrada desbloquea; neutro "sigue en X · faltan M" cuando no.
5. **Escalera = solo progreso del tramo actual** ("faltan N uds para X"), no recuentos de demanda por tramo (evita contradicción con el motor).
6. **Fuera la "Actividad del grupo"** con nombres inventados (Laura/Javier/etc) — V0 sin datos falsos.
7. **Reservas y firmes separados** en la columna derecha.
8. **Cancelación:** una vez dentro, no se cancela. Si fuerza, pierde fianza. La demanda comprometida no desaparece del cálculo. Cláusula 75% del vendedor.
9. **El hold sigue siendo PMA×qty** (techo de seguridad). No cambiamos el hold — solo dejamos de enseñar el hold como precio. El display muestra R (precio resultante), el hold es invisible.

### Archivos nuevos (3)
- `src/hooks/useTierDemand.ts` — hook reutilizable con realtime, deriva currentPrice/nextTier/missing
- `src/components/ProgressToNextPrice.tsx` — barra "Progreso hacia el siguiente precio"
- `src/app/api/group/[id]/summary/route.ts` — server-side firmes/reservas/maxStock (force-dynamic)

### Archivos reescritos (5)
- `TierDemandLadder.tsx` — usa hook, escalera horizontal con dots
- `JoinModeSelector.tsx` — proyección via quote, colapso esperar→comprar, pills sin "+N uds"
- `GroupLiveSection.tsx` — fuera mock-data, wired con useTierDemand + ProgressToNextPrice + proyección
- `GroupRightSidebar.tsx` — fuera código muerto, añadido resumen firmes/reservas + detalles + "por qué comprar"
- `GroupDesktopView.tsx` — fuera mock-data imports, waitingCount=12, legacy props

### Archivos modificados (2)
- `JoinFlow.tsx` — colapso esperar→comprar en checkout (targetReached → banner verde, CTA "Comprar ahora", displayPrice=R, hold sigue=target×qty)
- `mock-data.ts` — funciones marcadas @deprecated (siguen usadas por Home cards)

### Archivo peligroso REVERTIDO
- `supabase/compute_price.sql` — Cowork lo editó sin pedírselo (incluía un DROP FUNCTION). Revertido antes del commit. La función viva está correcta; el archivo del repo es la versión sincronizada del 22 jun.

### Verificaciones pasadas
- `tsc --noEmit` limpio ✓
- `compute_price` firma única `(uuid, integer, numeric)` con 2 defaults → llamada de 1 arg desde el browser funciona ✓
- Colapso esperar→comprar: esperar@27000 qty 8 con 8 ya a 25000 → R=25000, CTA "Comprar ahora · 25000" ✓
- Proyección verde: "Con tus 1 ud, el grupo baja a 25000 € para todos" ✓

### Commit
| Commit | Descripción |
|---|---|
| `7b312dd` | feat: ficha con motor PMA real (escalera, progreso, colapso esperar→comprar, proyección, resumen firmes/reservas) |

---

## 🔴 BUGS DE DISPLAY PENDIENTES (5 min cada uno, Opus 4.6)

### 1. "Reservas pendientes: 8 uds" → debería ser 14
El endpoint `/api/group/[id]/summary` devuelve 8 en vez de 14. Posible causa: la compra de 6 uds (benxaque@gmail.com) no se cuenta. Verificar la query del endpoint contra `group_members` real.

### 2. "8/16 unidades" en ProgressToNextPrice → debería ser 14/16
El componente parece leer de una fuente que no incluye al miembro nuevo. Debería leer de `tier_demand` (que devuelve demand=14 al tramo de 25000). Verificar si `ProgressToNextPrice` lee del hook `useTierDemand` o de `total_units` del grupo (que está en 0 por el bug de demanda firme).

### 3. total_units = 0 en la BD con 14 uds reales
`confirm_join` recalcula `total_units` como "demanda firme al precio vigente" (compradores ahora + esperadores con target ≥ current_price). Como current_price=30000 y ambos miembros son esperadores con targets < 30000, total_units=0. Técnicamente correcto por la definición del 24 jun, pero el punto ciego: si TODOS los miembros son esperadores, total_units nunca sube. Revisar si esto afecta al cierre (close_group NO usa total_units para dinero — verificado — pero sí afecta al display).

---

## 🔴 ENSAYO 3 — EL MONEY-CRITICAL MÁS IMPORTANTE (⚡ Opus 4.8)

**Cierre con esperadores reales en Stripe.** Lleva pendiente desde el 16 jun. Es lo que valida que el motor de PMA funciona con dinero real.

### Estado del grupo Motor parapente (datos reales en producción test)
- 2 miembros: 8 uds@25000 (esperador) + 6 uds@28000 (esperador)
- `tier_demand`: 0/4@30000, 6/8@28000, 6/12@27000, 14/16@25000
- `current_price`: 30000 (ningún tramo desbloqueado)
- Ambos `payment_status = authorized` con PI real en Stripe test

### ⚠️ OJO: este grupo NO sirve para el Ensayo 3
El Ensayo 3 necesita un cierre completo (captura/liberación). No queremos cerrar el grupo del Motor parapente (tiene datos de test de la sesión de display). Hay que crear un **grupo clon** con tramos baratos para el ensayo.

### Plan del ensayo (del handoff del 24 jun, sigue vigente)
- Grupo clon con tramos 2→18 / 4→15 / 10→12, mín 2, stock 50, stepped
- 3 joins: comprador "ahora" qty 2, esperador@15 qty 2 (califica), esperador@12 qty 2 (NO califica)
- Cerrar con botón manual
- Verificar: captura parcial A, captura total B, liberación total C, cero authorized colgados

### Pre-vuelo (las 4 lecturas que se pidieron al inicio de la sesión y no se completaron)
1. Estado de las 5 funciones (firmas + permisos)
2. Grupos de test a limpiar
3. Cuerpo vivo de `close_group` (para leer el camino del esperador que no califica)
4. `cat src/lib/stripe-capture.ts` (camino de liberación)

---

## 🟡 OTROS PENDIENTES (del handoff del 24 jun, sin cambios)

### Money-critical
- **Cutover Stripe test → live** (cuando haya empresa registrada): claves live, endpoint webhook en modo live, 3 vars en Vercel, prueba con tarjeta real. ⚡ Opus 4.8.

### Motor
- **"Cambiar de objetivo" en vivo** (Nivel 3): money-critical, reautorización de holds. V1.

### Menores anotados
- Rotación claves Sendcloud (salieron en chat)
- `compute_price_at_n` sin uso → retirar
- CHECK constraint monotonía tiers en BD
- Guard de `group_id` en webhook
- Página "unido" con polling en vez de confiar en Payment Element
- DST de `closes_at` (20:00 UTC = 22:00 CEST, 21:00 CET) → antes de octubre
- Centralizar Resend
- `confirm_join` dedupe latente (check tel OR email, upsert ON CONFLICT email)
- Excedente con 2ª puja → admin-manual V0
- Limpiar grupos de test en producción

### Bloqueador de negocio
- **No hay vendedor real.** Pago ✅ + Envío ✅ (Sendcloud). Carrier pendiente (SEUR vs Correos Express).

---

## 🔧 DATOS TÉCNICOS DE REFERENCIA

### Funciones money-critical (verificadas 27 jun)
| Función | Firma | Permisos | Defaults |
|---|---|---|---|
| `compute_price` | `(uuid, integer, numeric)` | anon/auth/svc = true (abierta) | 2 defaults (p_extra_units=0, p_extra_target=NULL) |
| `close_group` | `(uuid)` | solo service_role | — |
| `confirm_join` | 11 args | solo service_role | — |
| `tier_demand` | `(uuid)` | anon/auth/svc = true (abierta) | — |
| `prepare_join` | `(uuid, text, integer)` | solo service_role | — |

### Contrato `group_members`
- `join_mode` text NOT NULL default 'comprar' · `target_price` numeric NULL
- Vivos = payment_status IN ('authorized','instructed','paid')
- `total_units` = demanda firme al precio vigente (compradores ahora + esperadores con target ≥ current_price) — punto ciego cuando todos son esperadores

### Grupo Motor parapente (test, producción Stripe sandbox)
- UUID: `9450351f-3330-4fa1-a9e8-cd0132cd8541`
- 2 miembros reales con PI: 8@25000 (benjaminperezsouto) + 6@28000 (benxaque)
- total_units=0 (bug de display), current_price=30000

### Archivos clave (nuevos/modificados 27 jun)
- `src/hooks/useTierDemand.ts`
- `src/components/ProgressToNextPrice.tsx`
- `src/components/TierDemandLadder.tsx`
- `src/components/JoinModeSelector.tsx`
- `src/components/GroupLiveSection.tsx`
- `src/components/desktop/GroupRightSidebar.tsx`
- `src/components/desktop/GroupDesktopView.tsx`
- `src/components/desktop/GroupCenterContent.tsx`
- `src/app/grupo/[id]/unirme/JoinFlow.tsx`
- `src/app/api/group/[id]/summary/route.ts`

---

## 🧠 REGLAS DE PROCESO

- **Verificar contra la BD viva** — no handoffs, no memoria de Cowork
- **Cowork editó `compute_price.sql` sin pedírselo** — revertido. Vigilar siempre el `git diff` antes de commitear
- **Cambiar firma de función PostgreSQL (DROP+CREATE) resetea permisos a PUBLIC** → re-verificar
- **www vs sin www:** `www.vonda.es` siempre
- **Git:** autor `benjaminperezsouto@gmail.com`
- **Potencia:** money-critical → Opus 4.8. Display → Opus 4.6
- **Anti scope creep:** la ficha se construyó porque representaba mal el motor. No se añadieron features nuevas.

---

## ✅ Primer paso de la próxima sesión

**Elegir foco:**
1. **Ensayo 3** (⚡ Opus 4.8) — el money-critical más importante antes del lanzamiento. Crear grupo clon, 3 joins con tarjeta test, cerrar, verificar captura/liberación con esperadores.
2. **Arreglar los 2 bugs de display** (Opus 4.6, 5 min cada uno) — reservas 8→14, progreso 8→14.
3. **Conseguir vendedor real** — el bloqueador de negocio que no es técnico.
