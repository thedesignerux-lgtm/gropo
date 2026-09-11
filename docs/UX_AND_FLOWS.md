# UX_AND_FLOWS.md — Gropo

> Fuente de verdad de las pantallas, los flujos de usuario y los estados de interfaz.
> Verificado el 6 de septiembre de 2026 contra `main @ 7c49ef3`.

---

## 1. FLUJO PRINCIPAL DE COMPRA

| # | Paso del usuario | Ruta / componente | Qué ocurre en el backend |
|---|---|---|---|
| 1 | Abre la home | `/` → `src/app/page.tsx` (SSR, `force-dynamic`) | `groups WHERE status='open' AND is_demo=false`; **`tier_demand()` por CADA grupo** (`Promise.all`); `min_execution` mínimo por grupo; favoritos y sesión en paralelo |
| 2 | Toca un producto | `/grupo/[id]` (SSR) | `groups` + `compute_price()` + `tier_demand()` + `bids` de la ganadora + `COUNT(bids activas)` |
| 3 | Ve el precio bajar en vivo | `GroupLiveSection` / `GroupRightSidebar` + `useTierDemand` | Realtime sobre `events` → refetch de `/api/group/[id]/tier-demand` |
| 4 | Elige cantidad y precio objetivo | `GropoTargetSlider` + stepper | `/api/group/[id]/quote?units=N&target=T` → `compute_price(id, N, T)` |
| 5 | Pulsa el CTA | `→ /grupo/[id]/unirme?mode=…&target=…&qty=N` **o** `FastCheckoutModal` | — |
| 6 | Rellena datos | `JoinFlow` → `InnerForm` | Prefill desde `localStorage['vonda_user']` + RPC `get_profile(phone,email)` |
| 7 | Confirma | `POST /api/join/create-intent` | rate limit → `prepare_join` → validación del target → Customer → PaymentIntent manual |
| 8 | 3D Secure si aplica | `stripe.confirmPayment({redirect:'if_required'})` | Stripe autoriza el hold |
| 9 | **Stripe dispara el webhook** | `POST /api/stripe/webhook` | firma → `confirm_join` → fila `group_members` |
| 10 | Ve la confirmación | `/grupo/[id]/unido` → `PostCheckoutView` | 🔴 `JoinFlow` **redirige sin esperar** (ver §4.2) |
| 11 | Consulta sus grupos | `/mis-grupos` | sesión → `GET /api/my-groups` → `get_my_groups(phone, email)` |
| 12 | Domingo 21:00 UTC | cron | `close_group` → `captureGroupPayments` → `sendClosePaymentEmails` |
| 13 | Recibe el email | Resend | `paid` → confirmación de compra; `instructed` → instrucciones de transferencia |
| 14 | El admin genera la etiqueta | botón admin | `generateShippingLabels` → Sendcloud v3 |

---

## 2. RUTA ALTERNATIVA: 1-CLICK (`FastCheckoutModal`)

Montado globalmente por `CheckoutProvider` en el root layout. Cualquier vista lo abre con
`useCheckout().open({ groupId, productName, quantity, maxPricePerUnit, joinMode?, targetPrice? })`.

- **Ruta A — tarjeta nueva:** `create-intent` + `PaymentElement` + `confirmPayment`.
- **Ruta B — tarjeta guardada:** `POST /api/checkout/lock` (crea y confirma server-side).
  Si Stripe pide 3DS → `requires_action` + `clientSecret` → `stripe.handleNextAction` sin salir
  del modal.
- **Éxito:** `completeSuccess(piId)` hace **polling de hasta 18 s** contra
  `/api/join/status?pi=…`. Ver §4.1.

Precondiciones de la Ruta B: sesión · `users.stripe_customer_id` · PaymentMethod `card` ·
dirección previa en `group_members`. Si falta algo → `no_saved_card` / `no_shipping` /
`not_authenticated` y cae a la Ruta A.

---

## 3. PANTALLAS

| Ruta | Fichero | Tipo | Datos | Estados |
|---|---|---|---|---|
| `/` | `app/page.tsx` + `GroupsGrid` / `desktop/HomeDesktopView` | Server | grupos + `tier_demand` por grupo + favoritos + `isAuthed` | Vacío (grid vacío); **sin loading** (SSR); **sin error visible** (se traga y devuelve `[]`) |
| `/grupo/[id]` | `app/grupo/[id]/page.tsx` + `desktop/GroupDesktopView` / `GroupLiveSection` | Server + Client | `compute_price`, `tier_demand`, `bids`, `bidCount` | "Grupo no encontrado"; live vía Realtime |
| `/grupo/[id]/unirme` | `unirme/page.tsx` + **`JoinFlow.tsx` (1036 líneas)** | Server + Client | igual que la ficha | loading; error inline; scroll automático a campos incompletos; confeti al bajar de tramo |
| `/grupo/[id]/unido` | `unido/page.tsx` + `PostCheckoutView.tsx` (457) | Server + Client | `groups` + `compute_price` | Éxito, compartir, crear cuenta |
| `/mis-grupos` | `mis-grupos/page.tsx` | Client | `/api/my-groups` | `undefined` = comprobando sesión → `null` = `AuthPanel` → loading → error → lista |
| `/favoritos` ("Mi Radar") | `favoritos/page.tsx` (**685**) | Client | favoritos + `tier_demand` + `/pulse` | Vacío + sugerencias (excluye `is_demo`) |
| `/perfil` | `perfil/page.tsx` (473) | Client | `get_profile`, `address_*`, `radar_prefs_save` (RPC directas) | `AuthPanel` si no hay sesión |
| `/notificaciones` | `notificaciones/page.tsx` (97) | Client | **`supabase.rpc('get_my_groups')` directa** + `useLadders`/`derive` importados de `MisGruposDesktop` | Deriva avisos reales: `success`, `urgent`, `info`, `default` |
| `/mensajes` | `mensajes/page.tsx` | Server | ninguno | **Estado vacío estático** ("Aún no tienes mensajes") |
| `/crear-peticion` | (293) | Client | `create_petition` RPC | Formulario |
| `/peticion` | (5 líneas) | Server | ninguno | 🔵 **Placeholder:** *"Crear petición — próximamente"* |
| `/login` | (138) | Client | `AuthPanel` | error `?error=auth` |
| `/como-funciona`, `/ayuda` | | Server | — | Estáticas |
| `/admin` | `admin/page.tsx` + `layout.tsx` | Server | `groups`, `bids` | `AdminLoginForm` sin cookie |
| `/admin/grupos/new` | (341) | Client | `createGroup` | Validación inline |
| `/admin/grupos/[id]` | (329) | Server | `groups`, `group_members`+`users`, `bids`+`users` | Badges de estado |

---

## 4. ESTADOS DE CONFIRMACIÓN DEL CHECKOUT — 🔴 DOS COMPORTAMIENTOS

### 4.1 `FastCheckoutModal` — honesto ✅
`idle` → `processing` ("Reservando/Asegurando…") → **polling hasta 18 s contra
`/api/join/status`** → `success` (botón verde, pausa 1,5 s, el sheet baja) → el provider muestra
el toast "¡Precio asegurado!" y hace `router.refresh()`.
**Nunca vuelve de `processing` al botón inicial** (comentario: *"daría la falsa impresión de que
no pasó nada"*).

### 4.2 `JoinFlow` — optimista 🔴
`stripe.confirmPayment` → si no hay error → `window.location.href = '/grupo/[id]/unido'`
**sin ninguna comprobación**. Ver `KNOWN_ISSUES.md` P0-03.

---

## 5. ESTADOS DE UI

### 5.1 Badge del grupo (`src/lib/statusBadge.ts`)
| Estado | Condición |
|---|---|
| **"Petición"** (amarillo) | `status='open'` **y** `activeBidCount === 0` |
| **"Abierto"** (verde) | `status='open'` con ≥1 puja |
| **"Cerrando"** (naranja) | `status='closing'` |
| **"Cerrado"** (gris) | `status='closed'` |
| **"Cancelado"** (rojo) | `status='cancelled'` |

### 5.2 Badges de pago en el admin (`admin/grupos/[id]/page.tsx:13-21`)
`Pendiente` · `Autorizado` · `Instruido` · `Pagado` · `Liberado` · `Cancelado` ·
`Autorización fallida`
⚠️ `auth_failed` tiene badge pero **ningún código lo escribe**.

### 5.3 Badges de puja (`page.tsx:23-29`)
`Activa` · `Ganadora` · `Superada` · `Rechazada` · `Retirada`
⚠️ `declined` ("Rechazada") tiene badge pero **nunca se escribe**.

### 5.4 Cuenta atrás (`CompactCountdown`, `JoinFlow.tsx:59`)
- Más de **`URGENCY_WINDOW_DAYS = 14`** días → *"Próximo domingo"* en gris `#6B6B76`.
- Dentro de la ventana → `Xd Yh` en morado `#6C4BF4`.
- Último día → **rojo `#D6452B`**.
Razón explícita: *"un contador de 155d mata el FOMO y invita a procrastinar"*.

### 5.5 Estados del Pulse (`/api/group/[id]/pulse` → `usePulse`)
Por escalón: `reached` · `committed` (cifra real de demanda efectiva) ·
`marked` (bucket **0–3** de quién marcó **exactamente** ese tramo) ·
`markedFraction` (`min(2, marked/needed)`, puede superar 1) ·
`surge` (hay tarjetas aceptadas empujando) ·
`acceptedFraction` (`min(1, accepted/needed)`) ·
`reachable` (`committed + accepted + watching >= min_units`) → **gatea el CTA "Ya sois
suficientes"**.
`glow` de grupo: bucket 0–3 de observadores totales en el escalón más barato.
`intensityBucket`: `0→0`, `1-2→1`, `3-5→2`, `>5→3`.

**Recorte de relevancia** (en el endpoint y en `pulse-notify`): se elimina todo escalón con
precio ≥ al mejor ya desbloqueado — *"nadie espera un precio peor que el vigente"*.

### 5.6 Micro-interacción del candado
`lockPhase` 0/1/2 en `GroupRightSidebar` y `GroupLiveSection`: giro de 1 s de `ArrowsRing`
(4 triángulos en diagonal) → CTA verde "✓ Precio bloqueado" → navegación a los 1,8 s.
`JoinFlow` muestra el candado estático con la prop `locked`.
Respeta `prefers-reduced-motion` (confeti y animaciones del Pulse en `globals.css`).

---

## 6. QUÉ ES LÓGICA REAL Y QUÉ ES DECORACIÓN

| Elemento de UI | Naturaleza | Detalle |
|---|---|---|
| **Precio mostrado** | **REAL** | Siempre de `compute_price` (SSR) o `/quote` (cliente). Nunca calculado en el cliente |
| **Escalera de tramos** | **REAL** | `tier_demand` |
| **"Faltan N unidades para bajar a X €"** | **REAL con caveat** | `useTierDemand` calcula su propio `nextTier` ordenando por **unidades faltantes**, criterio **distinto** al de `compute_price.next_price` |
| **Barra de progreso proyectada** (`JoinFlow`) | **DISPLAY** | `posOf(units)` interpola entre tramos; el precio subyacente sí es real |
| **`currentUnits` de la home** | **DERIVADO** | `page.tsx:59-63` construye un número de display: `min(nextLocked.minUnits − 1, max(unlockedBase, nextLocked.demand))`. **No es la demanda real ni `total_units`** |
| **Stock restante del stepper** | **REAL pero SESGADO** | `JoinFlow:115` usa `total_units` → **sobreestima**. Ver `KNOWN_ISSUES.md` P2-01 |
| **Confeti** | Decoración | Solo al cruzar un tramo a la baja, una vez por cruce |
| **Cuenta atrás** | Display con umbral de 14 días |
| **"Ahorras X €"** | Display | `pvp − precio`. `pvp` es un campo libre que teclea el admin: **no verificado contra ninguna fuente** |
| **Glow / rings del Pulse** | **DISPLAY sobre datos reales** | Buckets deliberadamente imprecisos |
| **CTA "Ya sois suficientes"** | **REAL** | Gateado por `reachable` calculado en servidor |
| **Badge "En stock"** (`JoinFlow`) | 🔵 **HARDCODEADO** | Texto fijo; no consulta `max_stock` |
| **Badge "Entrega gratis"** | 🔵 **HARDCODEADO** | No existe ningún cálculo de portes en el sistema |
| **Categoría "· Deporte"** | 🔵 **HARDCODEADA** | `grupo/[id]/page.tsx:161`. No existe columna `category` en la BD |
| **`getActivationState` / `getMilestones`** | **DISPLAY DEPRECADO** | `src/lib/mock-data.ts`, marcados `@deprecated`. `CLAUDE.md`: *"Pendiente crítico: limpiar mock-data de la ficha"* |
| **Cantidad máxima 10** | **REAL** | Validada en `prepare_join` y por CHECK en `pulse_pledges` |

---

## 7. FLUJO DE "MI RADAR" / GROPO PULSE

```
[usuario con sesión marca un tramo no desbloqueado]
        │ POST /api/pulse/pledge → pulse_pledge_upsert
        ▼
    watching ──── DELETE /api/pulse/pledge → cancelled
        │
   [acepta el precio]
        │ POST /api/pulse/accept → SetupIntent 0 € (usage:'off_session')
        │ el cliente confirma la tarjeta
        │ POST /api/pulse/accept/complete → verificación contra Stripe → accepted
        ▼
    accepted
        │ runPulseTrigger → pulse_check_and_lock (advisory lock)
        │ ¿committed + accepted >= min_units del tramo más barato fireable?
        ▼
    holding  ──► PaymentIntent off-session (hold real) ──► converted
        │                                                     │
        └──► fallo de tarjeta / sin tarjeta / estado raro ──► failed
                                                              │
    [el webhook crea el miembro como ESPERADOR con target = tier aceptado]

    [el grupo deja de estar 'open'] ──► expireDeadPledges() ──► expired
```

**Disparadores de `runPulseTrigger`:** (1) inline en `/api/pulse/accept/complete`;
(2) el webhook tras una compra confirmada que **no** venga del Pulse (guard
`if (!m.pulse_pledge_id)` para evitar recursión); (3) el cron diario de las 08:30 UTC.

**Estado actual:** **0 filas en `pulse_pledges`.** Implementado y ensayado (VERDE, 13 jul),
sin demanda latente viva en producción.

---

## 8. FLUJO DE PETICIÓN

`/crear-peticion` → `supabase.rpc('create_petition', {...})` **desde el navegador** →
crea un `groups` **sin puja**, con `created_by` = el peticionario y un `closes_at` provisional
(próximo domingo 22:00 Madrid) → evento `petition_created` (excluido de la política pública de
`events`).
Cuando el admin carga la primera puja con `addBidToGroup`, se envía el email `petitionMatched`
al `created_by`.

⚠️ `/peticion` (sin "crear-") es un **placeholder** distinto: *"Crear petición — próximamente"*.

---

## 9. COMPONENTES

### 9.1 Vivos y relevantes
`GropoTargetSlider` (400) · `TierProgress` (307) · `WaveProgress` (267) · `PulseZone` (474) ·
`PulseAcceptModal` (223) · `PulseBar` · `PulseRings` · `GroupsGrid` (389) ·
`GroupLiveSection` (194, prop `heroMode`) · `ProductCard` (158) · `FavoriteButton` (119, prop
opcional `label`) · **`AuthPanel` (175 — única fuente de la lógica de login de cliente)** ·
`RadarAuthSheet` (portal) · `RadarCardMenu` · `MisGruposMobile` · `BottomNav` (111) ·
`GroupCountdown` · `GroupCountdownBadge` · `HeroShareButton` · `HowGropoSheet` ·
`ProgressToNextPrice` (94) · `checkout/CheckoutProvider` · `checkout/FastCheckoutModal` (417) ·
`desktop/DesktopNavbar` · `desktop/HomeDesktopView` (442) · `desktop/GroupDesktopView` (174) ·
`desktop/GroupRightSidebar` (197) · `desktop/DesktopProductCard` (206) ·
`desktop/MisGruposDesktop` (340, **exporta `useLadders` y `derive`**, reutilizados por
`/notificaciones`).

### 9.2 Huérfanos — 14 componentes, ~1.500 líneas
Verificado buscando cada nombre en todo `src/` excluyendo su propio fichero:
`BestPriceReached` · `CountdownChip` · `GroupLiveSection2c` (153) · **`JoinModeSelector` (178)** ·
`MobileVariantWrapper` · `PriceJourney` (81) · `ShareButton` · **`TierDemandLadder` (123)** ·
`desktop/GroupCenterContent` · `desktop/GroupSidebar` (169) · `desktop/HomeCardSlider` ·
`desktop/HomeCarousel` · `desktop/HomeProductCard` (165) · `desktop/HomeSidebar` (139).

⚠️ **`CLAUDE.md` lista `JoinModeSelector` y `TierDemandLadder` como "Archivos clave".** Son
código muerto: su funcionalidad se reimplementó en `GropoTargetSlider`, `GroupRightSidebar` y
`JoinFlow`. `CLAUDE.md` también menciona `VondaTargetSlider`, fichero que **no existe**.

---

## 10. CONVENCIONES DE UX OBSERVADAS

- **Todo en castellano**, tuteando.
- El comprador ve **precio de producto**, nunca mecánica bancaria (`create-intent` devuelve solo
  `clientSecret`).
- Errores inline, en lenguaje llano, sin jerga técnica.
- Respeto de `prefers-reduced-motion` en confeti y animaciones del Pulse.
- Nunca se muestran cifras exactas de intención en el Pulse (buckets y fracciones).
- Los `RAISE EXCEPTION` de Postgres están **escritos para el usuario final** y se muestran tal
  cual (*"Stock insuficiente: solo quedan 3 unidades disponibles"*).
- Paleta: `tailwind.config.ts` define `brand #6C3CE1` y `brand-green #0F9D58`, pero el código
  usa además muchos hex inline (`#6C4BF4`, `#FBFAF8`, `#ECEAF2`, `#e8890c`, `#D6452B`,
  `#0F8A4D`, `#F4F0FE`) introducidos en los rediseños de julio. Ver `TECHNICAL_DEBT.md` DT-09.
- `<html lang="en">` en `layout.tsx:40` pese a ser una app en castellano (las plantillas de
  email **sí** usan `lang="es"`).
