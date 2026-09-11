# VONDA — HANDOFF 9 julio 2026

**Sesión:** 9 julio · G5.2 + G6 E2E multi-puja + Auth magic link + Favoritos/Mi Radar
**Modelos:** Opus 4.6 (UX fixes, favoritos) → **Fable 5** (G5.2, G6) → **Opus 4.8** (debug favoritos escritorio)
**Estado al cierre: MULTI-PUJA G0→G6 COMPLETO. Auth magic link en producción. Favoritos/Mi Radar funcional en todas las vistas.**

---

## 1. Lo que se hizo

### G5.2 — `close_group` v2.1 (Fable 5) ✅
- Migración `g52_close_group_v21_outbid_on_regla6`: 2 bloques `UPDATE bids SET status='outbid' WHERE group_id=... AND status='active'` en los DOS caminos de Regla 6 (candidata no elegible + cinturón min_execution). Resto verbatim.
- Verificado por OID: 1 sobrecarga, anon=false, authenticated=false, service_role=true, 2 bloques ★G5.2 presentes.
- Test sintético: grupo 2 pujas + demanda insuficiente → close → ambas pujas `outbid`, grupo `cancelled` ✅. Datos limpiados.

### 🐛 Bug real cazado en G6: `create-intent` validaba target contra UNA puja
- **Síntoma**: esperador a 14 € (precio de puja B en escalera fusionada) → "El precio objetivo no es válido".
- **Causa**: `src/app/api/join/create-intent/route.ts` validaba `target_price` contra `bids.tiers` de `prep.best_bid_id` (puja A: [18,15]) — resto mono-puja que G4 no migró.
- **Fix**: validar contra `rpc('tier_demand')` (escalera fusionada, coherente con D5). Commit `fix(g6): validate esperador target against merged ladder, not single bid tiers`.

### G6 — Ensayo E2E multi-puja (Fable 5) ✅
**Grupo `TEST G6 Multipuja`** (`75f3f67e-5428-40f5-bc35-a392dab80615`), PVP 100, cerrado manualmente:
- Puja A (Seller A): 2→18 / 4→15, min_exec 2, max 20
- Puja B (Seller B, añadida con botón G5): 3→14, min_exec 3, max 20
- Escalera fusionada: **2→18 · 3→14** (15 de A absorbido por 14 de B — D1). D5 verificado.
- Uniones: m1 comprar 2uds @18 (hold 36) · m2 esperar target 14 (hold 14) · m3 comprar 1ud @14 (hold 14)
- **Cierre 6/6 literal**: grupo `closed` final 14.00, B `winner`, A `outbid`, 3 miembros `paid` a 14.00, capturas 28 (parcial) + 14 + 14 = 56 €. Stripe: 3 succeeded ✅

### Auth — Magic Link (Opus 4.6) ✅
- Desplegado por Cowork antes de esta sesión: `supabase-browser.ts`, `supabase-server.ts`, `middleware.ts`, `auth/callback/route.ts`, `login/page.tsx`, `useUser.ts`
- `@supabase/ssr` instalado, `auth_id` column en `public.users`, trigger `handle_new_auth_user()`
- Smoke test pasado: magic link → callback → sesión activa → usuario en Supabase Auth dashboard

### Favoritos / Mi Radar (Opus 4.6 → Opus 4.8) ✅
**BD:**
- Tabla `favorites` (PK `auth_id + group_id`, FK a `auth.users` + `groups`, cascade delete)
- RLS activo: 3 políticas (SELECT/INSERT/DELETE) con `auth.uid() = auth_id`
- 1 favorito verificado en producción

**Server actions** (`src/app/favoritos/actions.ts`):
- `toggleFavorite(groupId)`: verifica auth via cookie del server client, upsert/delete, revalidate `/favoritos`. Devuelve `{ favorited, error? }`.
- `getMyFavoriteIds()`: devuelve array de group_ids del usuario autenticado.

**FavoriteButton** (`src/components/FavoriteButton.tsx`):
- NO depende de `useUser` (eliminado para evitar conflicto "Multiple GoTrueClient" entre `supabase.ts` viejo y `supabase-browser.ts` nuevo)
- Auth check delegado a la server action → devuelve `not_authenticated` → redirige a `/login?next=...`
- Optimistic update + revert on error
- `useEffect` sincroniza `initialFavorited` con el estado local (fix del doble clic por desincronización hidratación/server)
- Props: `groupId`, `initialFavorited?`, `size?`, `className?`

**Integración en todas las vistas:**
- `ProductCard.tsx` (móvil): corazón en esquina inferior derecha de la imagen. Recibe `isFavorited` prop.
- `DesktopProductCard.tsx` (escritorio): corazón en esquina superior derecha de la imagen. Recibe `isFavorited` prop.
- `GroupLiveSection.tsx` (ficha móvil): `FavoriteButton` reemplaza el placeholder estático junto al CTA.
- `GroupDesktopView.tsx` (ficha escritorio): `FavoriteButton` en el header reemplaza el botón "Guardar" estático.
- `GroupsGrid.tsx` (móvil): acepta `favoriteIds` prop, construye Set, pasa `isFavorited` a cada `ProductCard`.
- `HomeDesktopView.tsx` (escritorio): acepta `favoriteIds` prop, construye Set, pasa `isFavorited` a cada `DesktopProductCard`. Icono corazón en header → enlaza a `/favoritos`.
- `page.tsx` (home): `fetchFavoriteIds()` ejecuta en paralelo con `fetchGroups()`, pasa a ambas vistas.

**Página Mi Radar** (`src/app/favoritos/page.tsx`):
- Server component: redirige a `/login` si no autenticado
- Fetcha favoritos del usuario → datos de grupos → escalera fusionada para precios en vivo
- RadarCards con: badge urgencia/mejor precio, imagen, nombre, precio actual vs PVP, countdown, corazón (toggle para quitar)
- Estado vacío con CTA "Explorar grupos"
- Desktop: layout con header + contenido centrado
- Móvil: layout con BottomNav

**BottomNav** (`src/components/BottomNav.tsx`):
- 4 tabs: Inicio, Mi Radar, Mis grupos, Perfil
- Mi Radar usa icono corazón, enlaza a `/favoritos`
- z-30 para estar por encima de otros stickys

---

## 2. Problemas encontrados y resueltos

### "Multiple GoTrueClient instances" warning
- **Causa**: conviven dos clientes Supabase browser — `supabase.ts` (viejo, `@supabase/supabase-js`, usado por `useTierDemand` para Realtime) y `supabase-browser.ts` (nuevo, `@supabase/ssr`, para auth).
- **Impacto**: `useUser` hook se quedaba en `loading=true` indefinidamente → FavoriteButton no respondía al clic.
- **Solución aplicada**: eliminar `useUser` del FavoriteButton y delegar auth check a la server action (que lee la cookie directamente via `supabase-server.ts`).
- **Solución pendiente (backlog)**: unificar a un solo cliente browser singleton. El warning sigue apareciendo pero no bloquea funcionalidad actualmente. Es una bomba de relojería para la sesión auth.

### Descarga de archivos desde Claude
- **Patrón recurrente**: Chrome renombra archivos duplicados con "(2)", las descargas a veces traen versiones viejas cacheadas, y archivos con el mismo nombre de distintas carpetas se confunden.
- **Solución adoptada**: usar `cat > archivo << 'ENDFILE'` por terminal para archivos nuevos/completos. Para diagnóstico: siempre `ls -la` + `grep -c "marcador_nuevo"` antes de copiar.

### Doble clic en FavoriteButton
- **Causa**: `initialFavorited` del servidor no se sincronizaba con el state del componente tras la hidratación.
- **Fix**: `useEffect(() => setFavorited(initialFavorited), [initialFavorited])`.

---

## 3. Estado de grupos de test
- `TEST G6 Multipuja` (`75f3f67e-...`): **closed**, 3 miembros paid, B winner, A outbid — referencia del ensayo E2E
- `TEST G4 Smoke` (`9cf168fc-...`): open, sin miembros, cron lo cerrará el 12 jul por Regla 6 → su puja quedará `outbid` (G5.2)
- "Motor parapente": intocable (miembros reales de test)

---

## 4. Flecos / backlog

### Prioridad alta
1. **Unificar clientes Supabase browser**: matar `supabase.ts` y migrar `useTierDemand` a usar `supabase-browser.ts` (singleton). Elimina el warning "Multiple GoTrueClient" y previene desincronización de sesión auth.
2. **404s en consola**: `/notificaciones`, `/mensajes`, `/como-funciona`, `/ayuda`, `/api/group/tier-demand` (sin group_id) — rutas referenciadas pero no creadas.
3. **Ficha escritorio — corazón en ficha**: está en el header de `GroupDesktopView`, funciona pero no recibe `initialFavorited` (siempre monta vacío). Para que arranque relleno, la ficha debería fetchear favoritos del usuario.

### Prioridad media
4. Emails de liberación al cierre + petición cancelada
5. Latencia "X unidades confirmadas" en carrito (webhook no terminó al renderizar)
6. `total_units=0` con solo esperadores (display)
7. "Vendedor verificado" no aparece en escritorio

### Prioridad baja / V2
8. Perfil (`/perfil`) — página por crear
9. Mis grupos (`/mis-grupos`) — página por crear
10. Productos reales del escaparate
11. Stripe live cutover (bloqueado por alta de empresa)

---

## 5. Protocolo de potencia vigente
- Opus 4.6: por defecto para todo (UI, APIs, CRUD, QA, bugs)
- ⚡ Fable 5 / Opus 4.8: solo para compute_price, close_group/join_group, RLS
- Claude avisa con ⚡ cuando la tarea toca esos componentes

## 6. Briefing de diseño recibido
- Benjamin compartió el "Briefing de Diseño de Producto UI" durante la sesión
- Nomenclatura adoptada: "Mi Radar" (no "Favoritos"), "Bloquear precio" (no "Comprar"), "Plaza asegurada"
- Prohibido: "Comprar", "Pagar", "Favoritos", "Carrito", "Checkout"
- Entidades clave: "La Ola" (wave motion), "El Ticket" (smart ticket)
- El briefing guía el diseño futuro; la implementación actual usa la nomenclatura pero no incluye aún las animaciones wave ni el smart ticket
