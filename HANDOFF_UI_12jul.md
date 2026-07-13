# HANDOFF — Rediseño UI (sesión 12 jul 2026)

**Alcance de la sesión:** rediseño y cableado de las pantallas de comprador (Mi Radar, Grupos Abiertos/Home, Mis Grupos, Perfil), desktop **y** móvil, con un sistema visual unificado (sidebar oscuro en desktop, `BottomNav` en móvil, tarjetas nuevas). Más un arreglo de build bloqueante y el checklist de producción.

**Estado global:** todo compila (`tsc` + `npm run build` en verde). UI verificada en navegador. **No** se ha tocado la lógica money-critical (compute_price / close_group / confirm_join / RLS) — verificado contra la BD (ver §4). Sí se hizo el **fix DST del cierre** y se añadió backend de Perfil (direcciones + prefs). Para lanzar con pagos reales siguen pendientes el cutover a Stripe live y la rotación de Sendcloud — ver `CHECKLIST_PRODUCCION.md`.

---

## 1. Qué se hizo, pantalla por pantalla

### Mi Radar (`/favoritos`)
- Pasó de secciones rígidas a **Smart Feed** con densidad condicional: vacío → empty state con radar animado; 1 elemento → tarjeta + cross-selling; 2–4 → grid único sin títulos; ≥5 → divisores por categoría.
- Tarjeta nueva `OpportunityCard` (dentro de `page.tsx`) + `SecuredCard`.
- Nueva barra de tiers `src/components/TierProgress.tsx` (reemplaza `WaveProgress` **solo aquí**; `WaveProgress` sigue usándose en product cards y vistas de grupo).
- Estado **"Meta alcanzada"** (verde) para grupos abiertos que ya llegaron a su precio mínimo (sin siguiente tramo). Consistente con Home.
- Layout de dos paneles: sidebar oscuro full-height + columna de contenido con su barra superior. Tag "N oportunidades", chips Filtros/Ordenar.
- Móvil: grid a 1 columna ancho completo (`sm:` mantiene columnas fijas ~300px en desktop).

### Grupos Abiertos / Home (`/`)
- `src/components/desktop/DesktopProductCard.tsx` reescrita al diseño nuevo (badge de estado, producto, precio actual/siguiente, barra simple relleno+objetivo, avatares + actividad, "Ahorras X € respecto al PVP", CTA "Asegurar precio · X €" / "Entrar al precio mínimo" en Meta alcanzada, corazón favorito).
- `src/components/FavoriteButton.tsx`: nueva prop `icon="heart"` (default sigue siendo `bookmark`, no rompe otros usos).
- `src/app/page.tsx` + `src/lib/mock-data.ts`: se añadió `closesAt` (de `closes_at`) para el countdown.
- `HomeDesktopView.tsx` reestructurado a dos paneles (sidebar oscuro + contenido).
- Móvil: `GroupsGrid.tsx` usa `DesktopProductCard` a 1 columna (antes `ProductCard` en 2 columnas).

### Mis Grupos (`/mis-grupos`)
- `src/components/desktop/MisGruposDesktop.tsx` (nuevo): sidebar oscuro + grid de tarjetas (4 estados: **En curso / A punto / Meta alcanzada / No alcanzado**) + **drawer lateral** "Ver estado de tu plaza".
- Datos reales de `get_my_groups` (RPC money-critical **de solo lectura, no tocada**) enriquecidos con `tier_demand` (RPC anon) para la barra/unidades/próximo objetivo.
- **Fix importante:** el mapeo de estado usa los valores REALES del enum `payment_status` (`authorized` / `paid` / `instructed` / `released` / `cancelled`), no los `pending/instructed/paid` que asumía el tipo antiguo. El móvil viejo filtraba por `pending` y no mostraba nada — corregido.
- Móvil: `src/components/MisGruposMobile.tsx` (nuevo) reutiliza `useLadders` + `MgCard` + `Drawer` exportados desde `MisGruposDesktop`. 1 columna, mismo drawer.

### Perfil (`/perfil`)
- Página client responsive nueva (antes era un stub). 4 bloques: Datos de contacto (edición inline) · Método de pago (→ Stripe) · Dirección de envío (gestión atómica por fila vía menú de 3 puntos, sin botón global "Editar", toast bloqueante al borrar la predeterminada; **bottom sheet en móvil**) · Preferencias del Radar (chips + presupuesto inline + guardado instantáneo). Sidebar derecha: actividad + cierre de sesión con microcopy.
- Direcciones y preferencias **persisten en servidor** (RPCs). Formulario real de añadir/editar dirección.

### Páginas de navegación (antes daban 404, ahora reales)
- **`/como-funciona`** — explicación del modelo (5 pasos) + garantías + CTA. Contenido estático.
- **`/ayuda`** — FAQ desplegable (9 preguntas) + contacto. Client component (acordeón).
- **`/notificaciones`** — derivada de datos reales (`get_my_groups` + `tier_demand`): estados de tus grupos como avisos ("alcanzó la meta", "a punto de cerrar, faltan X", "retención liberada"). Empty state si no participas en ninguno.
- **`/mensajes`** — empty state honesto (no hay mensajería real todavía).

---

## 2. Componentes compartidos / reutilizables (clave)

- `src/components/desktop/HomeSidebar.tsx` — sidebar oscuro navy full-height, con logo, nav (item activo morado + badge de conteo opcional `activeCount`), y tarjeta promo con variante (`promo="radar"` en Mi Radar). Usado en Home, Mi Radar, Mis Grupos, Perfil. Es `hidden lg:flex` (solo desktop).
- `src/components/desktop/MisGruposDesktop.tsx` exporta: `useLadders(memberships)` (enriquecimiento tier_demand), `MgCard`, `Drawer`, `derive`, tipo `Membership`.
- `src/components/TierProgress.tsx` — barra de tiers data-driven (variantes hot/dropping/complete).

---

## 3. Datos: qué es REAL y qué es LOCAL/pendiente de backend

| Zona | Estado |
|---|---|
| Mi Radar, Home, Mis Grupos (tarjetas) | **Real** (Supabase: groups, bids, tier_demand, favorites, get_my_groups) |
| Perfil — nombre / email / teléfono | **Real** (localStorage `vonda_user`, la misma identidad que usa `get_my_groups`) |
| Perfil — direcciones | **Real** (tabla `user_addresses` + RPCs `get_profile` / `address_add` / `address_update` / `address_set_default` / `address_delete`, todas SECURITY DEFINER por teléfono+email). |
| Perfil — preferencias Radar (categorías/presupuesto) | **Real** (tabla `user_radar_prefs` + RPC `radar_prefs_save`). Persisten en servidor; falta que el motor del Radar las consuma para filtrar. |
| Perfil — edición de contacto | **Local** (actualiza localStorage; sin sync a `users`). Ojo: cambiar email/teléfono cambia qué grupos ve en Mis Grupos. |
| Perfil — "Tu actividad" (métricas) | **Placeholder** (valores de ejemplo). |
| Perfil — método de pago | Enlace a Stripe (sin last4 real). |
| Mis Grupos — drawer: timeline "Registro del grupo", filas Entrega/Pago/Notificaciones editables | **Fuera** (no hay log de eventos ni dirección/tarjeta estructuradas en el `Membership`). |

**Para hacerlas reales hará falta backend** (tablas + RPCs), tarea sensible por PII/pagos — no hecha en esta sesión.

---

## 4. Pendientes / follow-ups

**UI / copy (pequeños, para una pasada junta):**
- ✅ HECHO: bottom sheet del menú de direcciones en móvil.
- Perfil: **modal crítico** "esta dirección tiene un envío en camino" (grupo en Meta alcanzada) — necesita vincular dirección↔envío en datos, aún no existe.
- Detalles de copy varios que dejamos anotados a lo largo de la sesión.

**Backend:**
- ✅ HECHO: libreta de direcciones (`user_addresses`) + preferencias del Radar (`user_radar_prefs`) con sus RPCs. `/perfil` ya lee/escribe contra ellas.
- Pendiente: que el **motor del Radar** consuma `user_radar_prefs` para filtrar oportunidades.
- Pendiente: RPC de actualización de datos de **contacto** en `users` (hoy la edición de contacto es local).
- Pendiente: log de eventos por grupo (timeline del drawer de Mis Grupos) + exponer dirección/tarjeta en `get_my_groups` o RPC aparte.

**Money-critical (bloqueantes de lanzamiento real — ver `CHECKLIST_PRODUCCION.md`):**
- **Verificado esta sesión:** las funciones de dinero (`close_group`, `confirm_join`, `compute_price`, `prepare_join`, `tier_demand`) **no se han tocado** — las únicas migraciones de hoy son las 3 de Perfil. `close_group` sigue en la versión del 8 jul, `confirm_join` del 2 jul. Permisos correctos (solo `service_role` en las críticas). RLS activado en tablas sensibles. → No hace falta repetir el Ensayo 3 por cambios de esta sesión.
- Ensayo 3 (cierre con esperadores) — pendiente histórico si nunca se validó ese escenario concreto. Runbook listo en `ENSAYO_F3_runbook.md`. **Grupo de prueba `ENSAYO_F3_esperadores` creado en la BD** (id `23015632-5651-43f6-99ef-813a416e2991`) — **borrarlo** cuando ya no se use.
- Cutover Stripe test → live + rotación de claves Sendcloud.

**✅ HECHO esta sesión — fix DST del cierre:** `closes_at` ahora se calcula como las **22:00 reales de Madrid** (helper `madridCloseAtISO` en `lib/closeWindow.ts`, ajusta al cambio de hora: verano 20:00 UTC / invierno 21:00 UTC). Cron a `0 20,21 * * 0` (idempotente). Antes cerraba a las 21:00 Madrid en invierno. ⚠️ El cron 2×/domingo requiere Vercel **Pro** (en Hobby los crons son 1×/día).

**Deuda técnica:** ✅ quitadas variables/imports sin usar en `GroupSidebar`, `GroupLiveSection`, `GroupDesktopView`, `GroupCenterContent`. Pendiente: warnings `total`/`totalUnits` en `JoinFlow`/`JoinModeSelector` (flujo de pago, pasada dedicada), warnings de `<img>` (migrar a `next/image`), `WaveProgress` aún en 4 pantallas (migrar a `TierProgress` si se quiere unificar), `ProductCard.tsx` sin uso (borrable).

---

## 5. Notas de build / deploy

- **Fix de build (bloqueante) resuelto:** `src/app/api/stripe/webhook/route.ts` instanciaba el cliente Resend a nivel de módulo → rompía `next build` en "Collecting page data" si faltaba `RESEND_API_KEY`. Ahora es **perezoso** (`getResend()`), se crea en runtime. El envío ya estaba en `try/catch` no-fatal, el pago no depende de él.
- **Falta `RESEND_API_KEY` y `RESEND_FROM`** en `.env.local` → los emails transaccionales no se envían en local. Añadirlas en Vercel (Production) para producción.
- **No correr `npm run build` con `npm run dev` abierto:** comparten `.next` y el dev queda sirviendo la página sin estilos / en blanco. Solución: `Ctrl+C`, `rm -rf .next`, `npm run dev`.
- **Puerto dev actual: 3000** (el `CLAUDE.md` decía 3001 — actualizar si procede).
- **Producción siempre con `www`** (`https://www.vonda.es`).
- Git lo corre Benjamin desde su terminal; Claude no toca `.git/`.

---

## 6. Archivos tocados/creados esta sesión

Nuevos: `TierProgress.tsx`, `desktop/MisGruposDesktop.tsx`, `MisGruposMobile.tsx`, `app/perfil/page.tsx`, `app/como-funciona/page.tsx`, `app/ayuda/page.tsx`, `app/notificaciones/page.tsx`, `app/mensajes/page.tsx`, `CHECKLIST_PRODUCCION.md`, `ENSAYO_F3_runbook.md`, este handoff.
Modificados: `app/favoritos/page.tsx`, `desktop/HomeSidebar.tsx`, `desktop/HomeDesktopView.tsx`, `desktop/DesktopProductCard.tsx`, `FavoriteButton.tsx`, `app/page.tsx`, `lib/mock-data.ts`, `api/stripe/webhook/route.ts`, `app/mis-grupos/page.tsx`, `GroupsGrid.tsx`, `lib/closeWindow.ts` (helper DST), `vercel.json` (cron), `admin/grupos/new/page.tsx`, `admin/grupos/[id]/actions.ts`, y limpieza en `desktop/GroupSidebar.tsx` · `GroupLiveSection.tsx` · `desktop/GroupDesktopView.tsx` · `desktop/GroupCenterContent.tsx`.

**Migraciones nuevas en BD (producción):** `perfil_addresses_and_radar_prefs_tables`, `perfil_rpcs`, `perfil_address_update_rpc` (solo Perfil; ninguna toca dinero).

Referencia visual de diseños aprobados (prototipos HTML autocontenidos, en la carpeta de trabajo de Cowork): `mi-radar-prototipo.html`, `mis-grupos-prototipo.html`, `perfil-prototipo.html`.
