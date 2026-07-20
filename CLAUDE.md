# CLAUDE.md — Vonda MVP

## Qué es Vonda

MVP de compra colectiva para ciclismo en España. El precio baja en vivo según entran compradores (por unidades). Cierre dominical 22:00 Europe/Madrid. Precio único de liquidación. Vonda es merchant-of-record.

**Dominio clave:**
- *Tramos*: stepped price tiers por volumen (min_units → price)
- *Comprar ahora*: modo por defecto, PMA = ∞ (acepta cualquier precio)
- *Esperar a precio (esperador)*: el comprador fija un PMA (precio máximo aceptado) como techo
- *Demanda efectiva*: por tier, suma de units donde PMA ≥ price(tier)
- *Hold*: autorización Stripe (manual capture). Compradores = guaranteed_price × qty; esperadores = target_price × qty
- *close_group*: función SQL que adjudica el grupo, captura/libera holds según PMA

## Stack

Next.js 14 App Router (`src/`, alias `@/` → `src/`) · Supabase (PostgreSQL + RLS + Realtime + custom SQL functions) · Stripe (manual capture, PaymentIntents) · Sendcloud v3 (correos_express:paq24) · Resend (email transaccional) · Vercel (hosting + cron) · Tailwind CSS

## Repo y entorno

- **Repo local:** `/Users/benjamin/Desktop/kuorum`
- **GitHub:** `thedesignerux-lgtm/kuorum`
- **Supabase project ID:** `xpktkuozspreuxucnguh`
- **Producción:** `https://www.vonda.es` (SIEMPRE con `www` — Stripe y server-to-server fallan con el 308 del apex)
- **Localhost:** puerto 3000. `stripe listen` debe apuntar a `localhost:3000/api/stripe/webhook`
- **Git author:** `benjaminperezsouto@gmail.com`

## Roles

- **Benjamin (usuario):** fundador, product owner, ejecutor. NO escribe código. Ejecuta comandos de terminal, opera dashboards (Supabase, Stripe, Vercel). Necesita instrucciones paso a paso extremadamente detalladas para cualquier acción técnica.
- **Claude:** arquitecto/CTO, escribe todo el código y SQL. Diseña sistemas y razona decisiones.
- **Cowork/Claude Code:** edita archivos localmente. **NUNCA toca `.git/`** — git lo corre Benjamin desde su Mac terminal.

## Funciones SQL money-critical

| Función | Firma | Permisos |
|---|---|---|
| `compute_price` | `(uuid, integer, numeric)` | anon/auth/svc = true (abierta, el front la usa) |
| `close_group` | `(uuid)` | solo service_role |
| `confirm_join` | `(text,uuid,text,text,text,integer,numeric,numeric,jsonb,text,numeric)` — 11 args | solo service_role |
| `tier_demand` | `(uuid)` | anon/auth/svc = true (solo agregados) |
| `prepare_join` | `(uuid, text, integer)` | solo service_role |

**Reglas críticas para funciones SQL:**
- `CREATE OR REPLACE` con firma distinta crea un SEGUNDO overload, no reemplaza. Siempre verificar con `SELECT oid::regprocedure FROM pg_proc WHERE proname='...'` tras cualquier cambio.
- Cambiar firma (DROP + CREATE) resetea permisos a PUBLIC EXECUTE. Re-verificar y re-blindar siempre.
- Funciones money-critical deben estar bloqueadas a service_role. Verificar con `has_function_privilege`.

## Modelo de datos clave

### `group_members`
- `join_mode` text NOT NULL default 'comprar' · `target_price` numeric NULL
- Comprador "ahora" → `comprar` / NULL (PMA=∞). Esperador → `esperar` / X (PMA=X)
- Vivos (cuentan demanda) = `payment_status IN ('authorized','instructed','paid')`. Muertos = released/cancelled/auth_failed
- `total_units` = demanda firme al precio vigente: compradores "ahora" + esperadores con target_price >= current_price. Se recalcula entero (no incremental) en cada confirm_join.

### `bids`
- `tiers` jsonb: `[{min_units, price}]` ordenado ascendente
- `price_mode`: fluid (interpolación lineal) | stepped (escalones)
- `min_execution`, `max_stock` obligatorios

### Stripe
- Modo test · endpoint webhook → `https://www.vonda.es/api/stripe/webhook`
- Evento clave: `payment_intent.amount_capturable_updated` → trigger de `confirm_join`
- Holds duran ~7 días. Grupos de una semana completa arriesgan expiración de holds tempranos.

## Archivos clave

- `src/components/JoinModeSelector.tsx` — selector comprar/esperar con pills de tramos
- `src/components/TierDemandLadder.tsx` — escalera de demanda por tramo (realtime)
- `src/app/api/group/[id]/tier-demand/route.ts` — endpoint tier_demand
- `src/app/api/group/[id]/quote/route.ts` — quote con p_extra_target
- `src/app/api/join/create-intent/route.ts` — hold = target×qty para esperadores
- `src/app/grupo/[id]/unirme/JoinFlow.tsx` — flujo de unirse, display y banner gateado por modo
- `src/components/desktop/GroupDesktopView.tsx` — layout 2 columnas ficha producto (center + sidebar)
- `src/components/desktop/GroupCenterContent.tsx` — columna izquierda ficha: header, price ladder, detalles
- `src/components/desktop/GroupRightSidebar.tsx` — columna derecha ficha: selector precio por tiers, qty, CTA
- `src/components/desktop/DesktopNavbar.tsx` — navbar compartida todas las páginas desktop (pill nav + logo centrado)
- `src/components/desktop/HomeDesktopView.tsx` — home desktop: hero + search + category pills + carousels
- `src/components/desktop/HomeCarousel.tsx` — carousel horizontal con flechas
- `src/components/desktop/HomeProductCard.tsx` — tarjeta producto para carousels (Unsplash placeholders)
- `src/components/GroupLiveSection.tsx` — versión mobile ficha
- `supabase/compute_price.sql` — v3 con p_extra_target
- `supabase/confirm_join.sql` — total_units como demanda firme
- `supabase/close_group.sql` — cierre con liquidación PMA
- `supabase/tier_demand.sql` — demanda efectiva por tramo

## Reglas de proceso

1. **Verificar SIEMPRE contra la BD viva** — nunca confiar en handoffs ni en caché de sesión. Usar `pg_proc`, `has_function_privilege`, queries directas.
2. **SQL largo vía clipboard→archivo** (`pbpaste`), nunca por chat (se trunca).
3. **www obligatorio** en todas las URLs de producción.
4. **Git paths con brackets** (`src/app/admin/grupos/[id]/`) deben ir entre comillas en shell.
5. **Potencia de modelo:** money-critical (compute_price, close_group, confirm_join, RLS) → Opus 4.8 o Fable 5. UI/display → Opus 4.6.
6. **Sendcloud v3:** errores llegan con HTTP 200 (verificar `data.errors[]` en body). El sandbox de Claude Code no alcanza `panel.sendcloud.sc` — las llamadas Sendcloud las ejecuta Benjamin desde terminal.

## Estado actual (actualizar tras cada sesión)

### Completado
- Full Stripe hold-then-capture payment flow
- compute_price v3 con demanda efectiva y p_extra_target
- confirm_join 11-arg con idempotencia y dedup
- close_group con liquidación PMA (captura parcial verificada con dinero real)
- tier_demand + TierDemandLadder (realtime)
- JoinModeSelector (comprar ahora / esperar a precio)
- Sendcloud v3 shipping (correos_express:paq24)
- Transactional email via Resend
- Vercel cron cierre domingos (0 21 * * 0 UTC — límite plan Hobby: cierra 22:00 Madrid en invierno / 23:00 en verano, nunca ANTES de las 22:00; cron pulse respaldo 1×/día 08:30 UTC. Si se pasa a Pro: restaurar 0 20,21 * * 0 y */10)
- Admin panel con close manual, member table, CSV export
- Logo Vonda desplegado
- Ensayo 1 (cierre con dinero real, compradores "ahora") — VERDE
- Ensayo 3 (cierre con esperadores: capturas por PMA, parcial y liberación) — VERDE (13 jul)
- Ensayo E2E Vonda Pulse (pledge→aceptar→masa→conversión, fallo de tarjeta aislado, masa no consolidada) — VERDE (13 jul)
- Login con Google (OAuth via Supabase; magic link como fallback) — verificado en localhost 13 jul
- Fixes 13 jul: RadarAuthSheet con portal (bug clicks/hover), stepper cantidad PulseZone
- Fix bug esperador 15 jul: JoinFlow banner mostraba precio actual en vez de target; admin table ahora muestra target_price + authorized_amount para esperadores
- Fix ProgressToNextPrice mobile 15 jul: estado celebración "Mejor precio desbloqueado" cuando nextTier es null
- Rediseño ficha producto desktop 15 jul: layout 2 columnas (GroupDesktopView, GroupCenterContent, GroupRightSidebar). Sidebar con selector de precio por tiers radio pills, stepper, CTA
- Rediseño home desktop 15 jul: hero con search bar (card + botón purple circular), category pills, carousels horizontales por categoría (HomeCarousel, HomeProductCard con Unsplash placeholders)
- DesktopNavbar compartida 15 jul: pill nav (Explorar/Mis grupos/Mi Radar) + logo centrado + "Crea tu grupo". Aplicada a TODAS las páginas (home, favoritos, mis-grupos, como-funciona, perfil, notificaciones, mensajes, ayuda). HomeSidebar ya no se usa en ninguna página
- Rediseño completo UI 16-17 jul (mockups Vonda Marketplace.dc.html):
  - Home desktop (1b): header compacto propio (logo+search+countdown+CTA+avatar), grid 4 columnas de GridCard con gradient overlay + VondaTargetSlider mini, category chips, ordenación
  - Home mobile (8a): editorial serif headline, search bar purple, category chips scroll horizontal, MobileCard full-width con gradient + slider mini
  - Mi Radar mobile (8c): sticky header "GUARDADOS" monospace + "Mi Radar" serif + badge + filtros, MobileRadarCard compactas (thumbnail + info + PulseZone)
  - Detalle producto mobile (2d): hero fullscreen (aspect 1/0.78, dark bg, image opacity .88), botones circulares translúcidos (back/share/heart), gradient overlay con GroupCountdownBadge + nombre + spec, heroMode prop en GroupLiveSection
  - Detalle producto desktop (1c): galería grid 2×2 (main spanning 2 rows + 2 detail), panel compra con CTA outline style (border + bg suave + accent text), wrapper card con sombra profunda rgba(30,20,60,.35)
  - Componentes nuevos: GroupCountdownBadge.tsx, ImagePlaceholder inline en GroupDesktopView
  - Fonts: Instrument Serif añadida (var --font-instrument-serif) para headings editoriales mobile
  - Colores clave: bg mobile #FBFAF8, bg desktop #fff, card border #ECEAF2, brand #6C4BF4
  - GroupCenterContent.tsx ya no se importa (código muerto)
  - TODO PUSHEADO a origin/main (1b+8a en commits anteriores, 8c+2d+1c en push del 17 jul)
- Sesión 19 jul — iteración diseño 1a:
  - Mobile detalle producto: eliminado A/B test (2c/2d), solo queda variante 2d (hero grande)
  - Mobile detalle producto: eliminado "Máx. XX€" redundante junto al CTA sticky
  - Home desktop (1a): HowItWorks 3 pasos integrado en columna izquierda del hero (bajo search bar), NO como sección separada. Heading → search → 1→2→3 step cards → benefit pills, todo en la mitad izquierda con grupo destacado a la derecha
  - Colores: todo naranja (#E8944A) eliminado de HowItWorks → reemplazado por morado (#6C4BF4). Paso 2 icono/badge, slider dot, caja "4 personas más", estrella paso 3, último benefit icon
  - Párrafo descriptivo del hero eliminado (heading directo a barra de búsqueda)
  - Placeholder search bar cambiado a "Busca tu producto"
  - Componente HowItWorks() eliminado como función standalone — contenido inline en el hero
  - StepCircle y BenefitRow reducidos de tamaño para caber en la columna izquierda
  - Código muerto añadido: GroupLiveSection2c.tsx, MobileVariantWrapper.tsx (ya no se importan)
  - VondaTargetSlider 19 jul: tooltip "Máx · X€" eliminado (redundante). Todos los tiers no alcanzados muestran "Faltan X" en naranja bold. Thumb bloqueado: no se puede seleccionar por debajo del tier actual (effectiveMin = max(minIdx, curIdx)). trackTop reducido (16/20px) tras eliminar burbuja
- Sesión 20 jul (madrugada) — micro-interacción lock COMPLETADA (commits 450c777, b9aa3db, dc14180):
  - VondaTargetSlider: tooltip naranja "Faltan X uds" sobre tier seleccionado (4s, edge-aware). Labels = unidades absolutas, tooltip = relativas.
  - ArrowsRing (4 triángulos en diagonales, giran 1 vuelta) + LockCenter (disco + candado, aparece al parar). `.lock-center-in` con delay 1s. Detección de transición via `wasLockedRef`.
  - lockPhase (0/1/2) en GroupRightSidebar y GroupLiveSection: spin 1s → CTA verde "✓ Precio bloqueado" → navigate a 1.8s. JoinFlow muestra el candado estático con `locked`.
  - Las flechas quedan quietas tras el giro (coincide con la imagen de referencia: candado rodeado de 4 flechas). NO se desvanecen.
- Sesión 20 jul — Pulse "ya sois suficientes" + PulseZone canAccept + puerta de acceso auth:
  - **pulse-notify** (`src/lib/pulse-notify.ts` + `src/lib/emails/pulseReachable.ts`): aviso por email a watchers cuando su tramo pasa a alcanzable (committed + accepted + watching >= min_units, con recorte price < mejor desbloqueado — mismo criterio que el endpoint público). Dedup atómico por `reachable_notified_price` en `pulse_pledges` (columnas ya en BD). Claim DESPUÉS de resolver email (sin email → queda pendiente para reintento del cron). Envíos en paralelo (Promise.allSettled). Si el envío falla se revierte el claim. Enganchado en: webhook Stripe (compra confirmada), POST /api/pulse/pledge (ancla nueva), cron pulse (red de seguridad diaria).
  - **PulseZone canAccept simplificado**: UNA sola CTA ("Ya sois suficientes → Aceptar X"), slider oculto (el precio ya está elegido; en canAccept no se puede re-anclar desde la card — decisión de producto), sin micro-interacción de candado (abriría el modal con 1.8s de espera y el "bloqueado" sería falso: aún no hay tarjeta). Leyenda morada con explicación del proceso: hoy 0 €, retención si se activa, cobro al cierre dominical. Eliminada CTA secundaria "Asegurar precio" también del camino no-boxed.
  - **AuthPanel.tsx** (nuevo): panel de login reutilizable (Google OAuth + magic link, prop `next` para volver a la página). Única fuente de la lógica auth de cliente. RadarAuthSheet ahora lo envuelve (hoja+portal sin lógica propia).
  - **Mis grupos**: puerta de acceso con AuthPanel si no hay sesión Supabase. El email sale SIEMPRE de la sesión (ya no se teclea; se muestra en gris). Solo se pide teléfono (una vez). Las RPC siguen siendo por teléfono+email por debajo.
  - **Mi perfil**: puerta de acceso con AuthPanel. "Cerrar sesión" ahora hace `auth.signOut()` real (antes solo borraba localStorage y era imposible volver a entrar). Email de sesión manda sobre localStorage.
  - PENDIENTE (decisión aplazada): unificación real de identidad — vincular `group_members` a `auth.users` (columna auth_id + backfill) y reescribir get_my_groups/get_profile/address_* con auth.uid(). Eliminaría el teléfono como credencial y cerraría el acceso por teléfono+email adivinados. ⚡ Money-critical + RLS → sesión propia con gates y Fable 5.

### Datos DEMO activos (borrar antes del cierre dom 26 jul)

Grupo `aaaaaaaa-1111-4111-8111-111111111111` (`DEMO · Radar canAccept`): abierto, tramos 30/28/25, SIN miembros ni holds (riesgo económico nulo, pero visible en producción). 9 pledges watching a 25 € (Benjamin sin pre-marcar → recibirá el email real del cron ~08:30 UTC; 8 demo_pulse_* pre-marcados para no enviar a @vonda.test). Borrado:
```sql
delete from pulse_pledges where group_id = 'aaaaaaaa-1111-4111-8111-111111111111';
delete from favorites    where group_id = 'aaaaaaaa-1111-4111-8111-111111111111';
delete from bids         where group_id = 'aaaaaaaa-1111-4111-8111-111111111111';
delete from groups       where id       = 'aaaaaaaa-1111-4111-8111-111111111111';
```

### Pendiente crítico
- Cutover Stripe test → live (pk_live, sk_live, webhook live, vars Vercel)
- Rotación claves Sendcloud (expuestas en chat durante desarrollo)
- Conseguir vendedor real con tramos confirmados
- Confirmar Custom SMTP (Resend) en Supabase Auth — el SMTP integrado limita a ~2-4 emails/h TODA la app (bloqueante para login por email en producción)
- Limpiar mock-data de la ficha (getActivationState, getMilestones, avatares hardcoded)
- Verificar login Google en www.vonda.es tras el deploy (origins ya incluyen producción)

### Pendiente menor
- Guard de group_id en webhook route
- Página "unido" basada en webhook confirmado (no solo Payment Element)
- Pulse UX: quitar favorito no cancela pledge (decisión de producto) · selector de cantidad en PulseAcceptModal
- Limpieza pendiente: grupos DEMO + usuarios demo_pulse_* + ENSAYO_F1/F2 históricos + restos instructed 28 jun (Cubierta) + grupo DEMO Radar canAccept (ver sección Datos DEMO)
- Centralizar Resend client (duplicado entre resend.ts y webhook)
- Dedup latente en confirm_join (check por tel OR email, upsert ON CONFLICT email)
- Código muerto: DesktopTierBar, TierBar, NextTierCallout, funciones mock-data.ts sin uso, HomeSidebar.tsx, GroupCenterContent.tsx (ya no se importan en ningún sitio)
- Grupos test en producción pendientes de limpieza
- HomeProductCard usa Unsplash placeholders hardcoded; getProductCategory() devuelve 'deporte' para todo. Cuando exista campo category en BD, mapear ahí
