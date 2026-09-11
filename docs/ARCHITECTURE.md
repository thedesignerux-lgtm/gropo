# ARCHITECTURE.md — Gropo

> Fuente de verdad de la arquitectura. Verificado el 6 de septiembre de 2026 contra
> `main @ 7c49ef3`.
> Para el esquema ver `DATABASE.md`; para el motor ver `ALGORITHM.md`; para la API ver `API.md`.

---

## 1. PRINCIPIO CENTRAL

> **La verdad del negocio vive en PostgreSQL, no en TypeScript.**

`compute_price`, `tier_demand`, `prepare_join`, `confirm_join`, `close_group` y las funciones
`pulse_*` contienen toda la matemática de precios, la validación de negocio, el control de
concurrencia (`FOR UPDATE`, `pg_advisory_xact_lock`) y la idempotencia.

TypeScript hace **tres** cosas y solo tres:
1. Orquestar servicios externos que Postgres no puede llamar (Stripe, Resend, Sendcloud).
2. Autenticación y gestión de sesión.
3. Presentación.

**Corolario operativo:** no repliques matemática de precios en el cliente ni en el servidor
Node. Llama a la RPC.

---

## 2. DIAGRAMA REAL

```
                    NAVEGADOR (React Client Components)
    JoinFlow · FastCheckoutModal · PulseZone · GropoTargetSlider · GroupLiveSection
    Stripe.js (PaymentElement / confirmPayment / handleNextAction)
    supabase-js con clave anon → auth, Realtime sobre `events`, y 9 llamadas RPC directas
                                   │
        ┌──────────────────────────┼──────────────────────────────┐
        ▼                          ▼                              ▼
 SERVER COMPONENTS          ROUTE HANDLERS               SERVER ACTIONS
 (page.tsx, SSR)            (/api/**)                    (admin/**/actions.ts)
 supabaseAdmin              supabaseAdmin + Stripe SDK   supabaseAdmin + requireAdmin()
        │                          │                              │
        └──────────────────────────┴──────────────────────────────┘
                                   │
                    ═══════════════▼═══════════════
                     SUPABASE / POSTGRES
                     21 funciones SECURITY DEFINER
                     11 tablas con RLS
                    ═══════════════╤═══════════════
                                   │
        ┌──────────────┬───────────┴────────┬──────────────┐
        ▼              ▼                    ▼              ▼
     STRIPE         RESEND             SENDCLOUD      SUPABASE AUTH
  PaymentIntents   5 plantillas         API v3        Google OAuth
  (manual capture) + admin alert       etiquetas      + magic link
  SetupIntents
        │
        └── webhook `payment_intent.amount_capturable_updated`
            → POST /api/stripe/webhook → confirm_join() → group_members
```

---

## 3. DÓNDE OCURRE CADA OPERACIÓN

| Operación | Capa | Función / fichero | Transaccional | Idempotente |
|---|---|---|---|---|
| Precio en vivo | **Postgres** | `compute_price` | STABLE, sin escritura | n/a (pura) |
| Escalera pública | **Postgres** | `tier_demand` | STABLE | n/a |
| Validar entrada + `guaranteed_price` | **Postgres** | `prepare_join` | sin escritura | sí |
| Crear el hold | **Node** | `create-intent` / `checkout/lock` | no | 🔴 **NO** |
| Crear el miembro | **Postgres** (desde el webhook) | `confirm_join` | **sí** (`FOR UPDATE` + subtransacción) | ✅ **sí** |
| Cerrar y adjudicar | **Postgres** | `close_group` | **sí** (`FOR UPDATE` + guard de estado) | ✅ **sí** |
| Mover el dinero | **Node**, tras el cierre | `lib/stripe-capture.ts` | no (por miembro) | ✅ sí |
| Emails de cierre | **Node** | `lib/emails/sendClose.ts` | no | 🔴 **NO** |
| Etiquetas de envío | **Node** | `lib/shipping-sendcloud.ts` | no | ✅ sí (doble capa) |
| Disparo del Pulse | **Postgres (lock) + Node (Stripe)** | `pulse_check_and_lock` + `runPulseTrigger` | advisory lock transaccional | ✅ sí |
| Favoritos | **Postgres con RLS** | tabla `favorites`, cliente autenticado | no | sí |

---

## 4. FRONTERA DE CONFIANZA

- **`SUPABASE_SERVICE_ROLE_KEY`** se usa **solo** en `src/lib/supabase-admin.ts`, importado
  exclusivamente desde Server Components, route handlers y server actions.
- El cliente anon (`src/lib/supabase.ts`, `src/lib/supabase-browser.ts`) usa la clave
  publishable y está sometido a RLS.
- ⚠️ **Pero el cliente anon puede llamar directamente por REST a las RPC con `EXECUTE` para
  `anon`.** Ver `SECURITY.md` SEC-01 y `API.md` §4. Ese es el hueco real de la frontera.

---

## 5. CLIENTES DE SUPABASE — cuatro, con propósitos distintos

| Fichero | Clave | Contexto | Nota |
|---|---|---|---|
| `src/lib/supabase-admin.ts` | **service_role** | Solo servidor | Bypass total de RLS |
| `src/lib/supabase.ts` | anon | Módulo compartido | Fuerza `cache: 'no-store'` en su `fetch` para escapar de la Data Cache de Next |
| `src/lib/supabase-server.ts` | anon | Server Components / handlers | `createServerClient` con cookies y `authCookieOptions(host)` |
| `src/lib/supabase-browser.ts` | anon | Cliente | `createBrowserClient` con `authCookieOptions(window.location.hostname)` |

---

## 6. RENDERIZADO

- **Dos árboles paralelos**, no un layout responsive único:
  `<div className="hidden lg:block">` (desktop) y `<div className="lg:hidden">` (mobile).
  Breakpoint **`lg` = 1024px**. Ambos se renderizan siempre en el HTML.
- Las páginas de datos declaran `export const dynamic = 'force-dynamic'` → sin caché.
- Los endpoints que usan el SDK de Stripe declaran `export const runtime = 'nodejs'`.

**Consecuencia:** duplicación masiva de lógica de presentación y la mayor parte del código
muerto del proyecto. Ver `TECHNICAL_DEBT.md` DT-03.

---

## 7. REALTIME

Un único canal, en `src/hooks/useTierDemand.ts:36-46`:
```ts
supabase.channel(`tier-demand-${groupId}-${Math.random().toString(36).slice(2)}`)
  .on('postgres_changes',
      { event:'INSERT', schema:'public', table:'events', filter:`group_id=eq.${groupId}` },
      (payload) => { if (ev.type==='member_joined' || ev.type==='price_dropped') load() })
```
Funciona porque `events` tiene una política RLS de `SELECT` para `anon`.
El sufijo aleatorio del nombre evita colisiones entre instancias del hook.

**`usePulse` NO usa Realtime:** hace **polling cada 20 s** contra `/api/group/[id]/pulse`.

**Cadena completa:** `confirm_join` inserta en `events` → Realtime → `useTierDemand` refetchea
`/api/group/[id]/tier-demand` → la escalera se actualiza en todos los navegadores abiertos.
Si se quitara ese `INSERT`, la UI en vivo dejaría de funcionar.

---

## 8. AUTENTICACIÓN

- **Google OAuth** y **magic link** vía Supabase Auth. UI unificada en
  `src/components/AuthPanel.tsx` (envuelto por `RadarAuthSheet` con portal).
- `src/middleware.ts` llama a `supabase.auth.getUser()` en **cada** request no estática, para
  refrescar el token y propagar cookies.
  Matcher: `['/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']`
- `src/lib/auth-cookie-domain.ts`: en hosts `gropo.es` / `*.gropo.es` las cookies llevan
  `domain: '.gropo.es'`, `sameSite: 'lax'`, `secure: true`. En previews de Vercel y en local,
  **sin dominio** (para no romperlas).
- `src/app/auth/callback/route.ts`: `exchangeCodeForSession` + **copia explícita de las cookies
  al redirect**; no borra cookies si falla (protege contra el doble callback
  *"State has already been used"*).
- `src/app/auth/signout/route.ts`: `signOut()` + **barrido de todas las cookies `sb-*`**, con y
  sin dominio.
- Trigger `handle_new_auth_user()` sobre `auth.users`: vincula por email un `public.users`
  existente o crea uno nuevo → permite que un **checkout de invitado** se adopte al registrarse
  después con el mismo email.

---

## 9. IDENTIDAD DUAL

Ver `DATABASE.md` §6 para el detalle. Resumen:

| | Identidad de COMPRA | Identidad de SESIÓN |
|---|---|---|
| Tabla | `public.users` (clave: `email`) | `auth.users` |
| Se crea | en `confirm_join`, **sin login** | al registrarse |
| Cuelgan | `group_members`, `bids`, `user_addresses`, `user_radar_prefs` | `favorites`, `pulse_pledges` |
| Puente | `users.auth_id` UNIQUE + FK, rellenado por `handle_new_auth_user()` |

Es la raíz de `SECURITY.md` SEC-01.

---

## 10. TAREAS PROGRAMADAS

`vercel.json`:
```json
{"crons":[
  {"path":"/api/cron/close-groups","schedule":"0 21 * * 0"},
  {"path":"/api/cron/pulse",       "schedule":"30 8 * * *"}
]}
```
Vercel los invoca con `Authorization: Bearer $CRON_SECRET`.
El cron de cierre **no contiene lógica propia**: invoca `closeGroup()`, el mismo server action
que el botón del admin (ADR-11).

---

## 11. DECISIONES DE ARQUITECTURA (ADR)

Formato: **DECISIÓN → MOTIVO → IMPLEMENTACIÓN → CONSECUENCIAS.**

### ADR-01 · La lógica de negocio vive en PostgreSQL
**Motivo:** atomicidad real y una sola fuente de verdad del precio.
**Consecuencias:** ✅ correctitud y concurrencia sólidas. ❌ El código más crítico **no está
versionado en git** (ver `KNOWN_ISSUES.md` P1-01). ❌ Difícil de testear.

### ADR-02 · Hold-then-capture con `capture_method: 'manual'`
**Motivo:** el precio final no se conoce hasta el cierre.
**Consecuencias:** ✅ el comprador nunca paga de más; ✅ no hacen falta reembolsos.
❌ **Los holds caducan a 7 días** → toda la maquinaria de `closeWindow.ts`.

### ADR-03 · La membresía la crea el WEBHOOK, no el cliente
**Motivo:** que nadie pueda "unirse" sin dinero autorizado. `join_group`, la vía legada, **fue
eliminada de la base de datos**.
**Consecuencias:** ✅ imposible falsificar demanda. ❌ Latencia de segundos → de ahí el polling
de `/api/join/status` (y el bug P0-03, que es su ausencia en `JoinFlow`).

### ADR-04 · `stripe_payment_intent_id` UNIQUE como clave de idempotencia
**Consecuencias:** ✅ nunca se duplica un miembro **por el mismo PI**. ❌ No impedía dos PIs
distintos del mismo usuario (P0-04) — cerrado el 11-sep-2026 por dos vías: `idempotencyKey`
derivada del payload en los dos emisores, y el índice parcial `uniq_member_per_group_alive`
sobre `(group_id, user_id)`, que es la barrera final independientemente del PI.

### ADR-05 · `total_units` = demanda FIRME, no contador de stock
**Motivo:** nació de un bug de overselling real (comentario en `confirm_join`).
**Consecuencias:** ✅ sin overselling. ❌ Semántica contraintuitiva: puede **bajar** y ser 0 con
15 miembros. ❌ El display tiene que derivar sus propias unidades, y `JoinFlow:115` sigue
usándolo mal (P2-01).

### ADR-06 · Ventana de cierre máxima de 6,5 días
**Motivo:** *"incidente del cierre del 5 jul 2026: 3 capturas fallidas por holds de 7d+"*.
**Consecuencias:** ✅ ningún hold caduca antes del cierre. ❌ Un grupo no puede durar una semana
completa desde su primer comprador.

### ADR-07 · La escalera fusionada como única superficie pública (D5)
**Motivo:** con multi-puja, exponer `bids` revelaría tramos y stock a la competencia.
**Implementación:** `tier_demand()` + **RLS de `bids` sin políticas**.
**Consecuencias:** ✅ resuelve opacidad y el fleco de la auditoría RLS. ❌ El front no puede leer
`max_stock`/`min_execution` salvo por SSR con `supabaseAdmin`.

### ADR-08 · Mínimo acumulado en la escalera (`F*(N) = MIN(F(1..N))`)
**Motivo:** garantizar *"más gente = nunca peor"* aunque una puja se quede sin stock arriba.
**Alternativa descartada (7-jul-2026, "Decisión B"):** que `max_stock` participara en el **precio
publicado**, como pedía la especificación multi-puja §3.1. Se descartó porque habría roto D0 —la
invariante de que con una sola puja el resultado es idéntico a v1— y porque la cobertura ya la
garantiza la adjudicación. La protección por stock vive **solo** en el cierre.
**Consecuencias:** ✅ monotonía. ❌ El precio publicado es una promesa de "mejor caso" — de ahí
ADR-09.

### ADR-09 · PMA universal en el cierre (decisión §4.4 resuelta como "(b)")
**Motivo:** si el precio final sube por encima de lo prometido, no se puede cobrar de más.
**Implementación:** `close_group` paso 4 cancela también a los `comprar` con
`guaranteed_price < settlement`.
**Alternativa descartada (7-jul-2026, opción "(a)" de §4.4):** que el **vendedor absorbiera** la
diferencia. Se descartó porque obligaría a un vendedor a sostener el precio de un competidor al
que ni siquiera puede ver (D5, opacidad). La opción (b) deja **una sola regla económica**, y con
una única puja es un no-op.
**Enmienda registrada en la misma decisión:** el settlement de una candidata **inelegible** es
precio de referencia para ranking y logging, **no necesariamente ejecutable**.
**Consecuencias:** ✅ **el `guaranteed_price` es un techo inviolable**. ❌ Un comprador puede
quedar fuera sin haber hecho nada mal, **y sin recibir aviso** (P2-06).
❌ **Asimetría deliberada** con `compute_price` — la sutileza más peligrosa del sistema.

### ADR-10 · Los efectos externos van FUERA de la transacción de cierre
**Motivo:** no se puede hacer rollback de una captura de Stripe.
**Consecuencias:** ✅ un fallo de Stripe no revierte el cierre; re-ejecutar reintenta.
❌ Estados intermedios visibles (`instructed` con hold vivo).

### ADR-11 · El cron reutiliza el server action del admin
**Implementación:** `requireAdmin()` acepta cookie `admin_auth` **o** `Bearer CRON_SECRET`.
**Consecuencias:** ✅ cero divergencia manual/automático. ❌ Dos credenciales para el mismo guard.

### ADR-12 · Cron dominical a las 21:00 UTC
**Motivo:** límite de frecuencia del plan Hobby de Vercel.
**Consecuencias:** ✅ **nunca cierra antes** de las 22:00 Madrid. ❌ En verano cierra 1 h tarde.
`CLAUDE.md` deja escrita la vuelta atrás: *"Si se pasa a Pro: restaurar `0 20,21 * * 0`"*.

### ADR-13 · Checkout de invitado (sin login obligatorio)
**Motivo:** minimizar fricción; el bucle de crecimiento son enlaces de WhatsApp.
**Consecuencias:** ✅ conversión. ❌ Identidad dual y la autorización por (teléfono, email)
de SEC-01.

### ADR-14 · El Pulse NO introduce lógica de dinero nueva
**Motivo:** invariante declarada en `src/lib/pulse.ts`.
**Implementación:** el disparo crea un PaymentIntent con la **misma forma de metadata** que el
checkout normal.
**Consecuencias:** ✅ el Pulse no puede romper el motor ni el cierre. ❌ Cobra off-session sin el
usuario delante.

### ADR-15 · Dos árboles de UI (mobile / desktop)
**Motivo:** los rediseños de julio partieron de mockups distintos por plataforma.
**Consecuencias:** ✅ libertad de diseño. ❌ Duplicación y código muerto.

### ADR-16 · Cookies de auth con dominio `.gropo.es`
**Motivo:** el ida y vuelta de OAuth saltaba entre apex y `www` y perdía la sesión.
**Consecuencias:** ✅ login estable. ❌ Vincula el código al dominio por constante.

---

## 12. STACK

Versiones reales de `package.json`:

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router) | `14.2.35` (exacta) |
| Lenguaje | TypeScript | `^5` — `strict: true`, `paths: {"@/*": ["./src/*"]}` |
| UI | React / React DOM | `^18` |
| CSS | Tailwind CSS | `^3.4.1` |
| BD / Auth / Realtime | `@supabase/supabase-js` `^2.108.1`, `@supabase/ssr` `^0.12.0` | |
| Pagos | `stripe` `^22.2.1`, `@stripe/stripe-js` `^9.8.0`, `@stripe/react-stripe-js` `^6.6.0` | |
| Email | `resend` `^6.12.4` | |
| Envíos | Sendcloud API v3 vía `fetch` | sin SDK |
| Hosting | Vercel | + 2 crons |
| Extra | `canvas-confetti` `^1.9.4` | confeti al cruzar un tramo |
| Tipografías | Geist VF + Geist Mono (locales), Instrument Serif + Space Grotesk (Google) | |

**Lo que NO se usa** (para no asumir): sin librería de validación (Zod/Yup); sin gestor de
estado global (el único contexto es `CheckoutProvider`); sin librería de componentes (SVGs
inline a mano); sin data-fetching library (`fetch` + `useEffect`); sin analytics; sin storage de
ficheros (las imágenes son URLs externas); **sin tests**; **sin ORM ni tipos generados**.
