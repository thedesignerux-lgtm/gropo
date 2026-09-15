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
| `/notificaciones` | `notificaciones/page.tsx` + **`lib/purchaseFeed.ts`** | Client | `/api/my-groups` (sesión) → `get_my_groups` (identidad local) + tabla `events` + `useLadders` | Cargando · tres estados vacíos distintos · «Ahora» / «Antes» |
| `/mensajes` | `mensajes/page.tsx` | Server | ninguno | **Estado vacío estático** ("Aún no tienes mensajes") |
| `/crear-peticion` | (293) | Client | `create_petition` RPC | Formulario |
| `/peticion` | (5 líneas) | Server | ninguno | 🔵 **Placeholder:** *"Crear petición — próximamente"* |
| `/login` | (138) | Client | `AuthPanel` | error `?error=auth` |
| `/como-funciona`, `/ayuda` | | Server | — | Estáticas |
| `/admin` | `admin/page.tsx` + `layout.tsx` | Server | `groups`, `bids` | `AdminLoginForm` sin cookie |
| `/admin/grupos/new` | (341) | Client | `createGroup` | Validación inline |
| `/admin/grupos/[id]` | (329) | Server | `groups`, `group_members`+`users`, `bids`+`users` | Badges de estado |

---

## 3-bis. LAS DOS SUPERFICIES DE SEGUIMIENTO — decidido el 14 de septiembre de 2026

> Decisión de producto de Benjamin, cerrando **A-16** y **A-22** de `UX_AUDIT_2.md`. Hasta ese día
> `/notificaciones` y `/mis-grupos` eran **la misma pantalla dos veces**: la primera pintaba una
> fila por membresía, siempre, con títulos en presente continuo («Tu plaza sigue asegurada»). Eso
> no es una notificación: es el estado, ya contado —y mejor— en la otra.

Cada una responde **una** pregunta, y no se pisan:

| | Pregunta que responde | Qué es |
|---|---|---|
| **`/mis-grupos`** | *¿En qué compras estoy y cuál es su estado **ahora**?* | Centro de gestión: producto, precio actual, unidades, progreso, próximo tramo, tiempo restante, estado del pago |
| **`/notificaciones`** | *¿Qué ha **cambiado** desde la última vez?* | Feed cronológico de actividad de compra colectiva |

### La regla de admisión del feed
**Si el evento no cambia nada en la compra del usuario, no entra.** No es un buzón: quedan fuera
las bienvenidas, la creación de cuenta, el perfil, el marketing genérico, las novedades de
producto, los mensajes corporativos y la actividad de otros usuarios que no le afecte.

### Los siete tipos, y de dónde sale cada uno
Cuatro son eventos reales que la base de datos ya guardaba en `events` desde el 29 de agosto; dos
son **estado vivo**, que no deja rastro histórico y hay que derivar en el momento de mirar.

| | Copy | Origen | ¿Histórico? |
|---|---|---|---|
| 🎯 | Nuevo precio desbloqueado — *el grupo ha alcanzado 12 unidades, ahora todos pagan 85 €* | `price_dropped` + el `member_joined` gemelo | sí |
| 🟢 | El precio ha bajado — *99 € → 85 €* | `price_dropped` sin gemelo | sí |
| 👥 | N compradores se han unido — *el grupo ya suma 18 unidades* | `member_joined`, agrupados por ventana de 6 h | sí |
| ⚡ | Estás cerca del siguiente precio — *faltan 2 unidades para 1749 €* | tramos + demanda **ahora** (≤ 3 uds) | **no** |
| ⏰ | Tu grupo cierra pronto — *quedan 3 horas* | `closes_at` **ahora** (< 24 h) | **no** |
| ✅ | Compra colectiva cerrada — *4 unidades, precio final 60 €* | `group_closed` con `result: 'closed'` | sí |
| ⚪ | El grupo se ha cerrado sin ejecutarse | `group_closed` con cualquier otro resultado | sí |

**Por qué 🎯 y 🟢 son dos.** Una bajada de precio **es** un tramo desbloqueado, pero el evento
`price_dropped` no guarda las unidades. El `member_joined` que la provocó se escribe en el **mismo
instante** y sí las trae: emparejándolos por timestamp se puede decir la frase completa. Sin
gemelo, se cae al mensaje corto en vez de inventarse un número.

**Por qué ⚪ no dice la causa.** En producción hay cierres con `result: 'no_active_bids'` y otros
con solo `{reason: 'manual_cleanup'}` —una limpieza del admin— sin `result` ninguno. Decir «no se
alcanzó el volumen mínimo» sería inventarse el motivo, que es el error de A-18. Lo que sí se puede
afirmar siempre, y es lo que al comprador le importa: **no se le ha cobrado nada**.

### Lo que NO entra en el feed, a propósito
`bid_placed` y `bid_improved` son actividad de vendedores. No cambian la compra del usuario y
además revelarían la competencia entre pujas, **que el comprador nunca debe ver** (INV-17).

### «Desde la última vez»
La marca de visita vive en `localStorage` (`lib/lastSeen.ts`), no en la base de datos, y es
deliberado: el feed tiene que funcionar para el comprador **invitado**, que es la mayoría —26 de 28
con compra viva no tienen cuenta (A-15)—. Guardarlo en servidor exigiría identidad, que es justo lo
que ese comprador no tiene. El coste: la marca es por navegador; quien mire desde el móvil y luego
desde el portátil verá las novedades dos veces.

### Navegación
La pantalla **no tenía ninguna entrada**: ni en `BottomNav` ni en `DesktopNavbar`, y la campana de
la cabecera de la home llevaba a `/favoritos`. Ahora esa campana lleva a la actividad —que es lo
que un icono de campana significa— y el escritorio tiene la suya.

**Pendiente:** el contador de novedades. Saber si hay algo nuevo exige cargar membresías y eventos,
y eso no se le mete a la home sin un endpoint ligero propio. Sin él, la campana no promete nada que
no pueda cumplir.

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
| **Stock restante del stepper** | **REAL** | `JoinFlow.remainingStock()` resta `committed_units` (`group_committed_units`), la misma suma que usa `prepare_join`. Corregido 13 sep 2026, `KNOWN_ISSUES.md` P2-01 |
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

## 9-bis. SISTEMA DE COLOR — teal (12-sep-2026)

> La marca pasó de morado a teal. Los valores viven en `tailwind.config.ts`; **usa los tokens, no
> hexadecimales sueltos.** Es exactamente así como se llegó a tener dos morados, tres verdes y
> tres naranjas conviviendo sin que nadie lo decidiera.

| Token | Valor | Contraste con blanco | Para qué |
|---|---|---|---|
| `brand.dark` | `#013230` | 14,00:1 | hover, pressed |
| `brand` | `#024947` | **10,26:1** | color de acción |
| `brand.light` | `#04817E` | 4,72:1 | secundario |
| `brand.tint` | `#F0F7F7` | — | fondos |
| `brand.tint2` | `#DEEDEC` | — | bordes |
| `accent` | `#FF6A00` | 2,87:1 ❌ | solo como FONDO, con texto casi negro |
| `accent.dark` | `#B24A00` | 5,42:1 | naranja para TEXTO o borde sobre blanco |
| `brand-green` | `#0B7B44` | 5,34:1 | éxito y ahorro |

**La regla del naranja, que es la única que tiene truco:**
- **Fondo** → `accent` (`#FF6A00`) con texto casi negro → **6,58:1**
- **Texto o borde sobre blanco** → `accent.dark` (`#B24A00`) → **5,42:1**
- `accent` con texto claro **nunca**: 2,87:1, no pasa AA

Así el naranja se mantiene vivo como en el logo donde es una mancha de color, y solo se oscurece
donde tiene que leerse.

**Logos** (`public/`): `logo.png` es el wordmark; `logo-light.png` es su versión clara y hay que
usarla en cualquier fondo oscuro — el teal desaparece sobre el sidebar de escritorio;
`logo-mark.png` es el isotipo, para espacios cuadrados. El host canónico y el buzón de contacto
están centralizados en `src/lib/site.ts`.

**Lo que el rebranding arregló de paso:** cuatro elementos incumplían AA desde antes — el ahorro
en verde (3,51:1), el aviso "faltan N unidades" (2,62:1), el chip de objetivo (2,10:1) y los
bordes del selector de tramos. Los cuatro cumplen ahora.

**Pendiente:** a 16 px el favicon no se lee, el isotipo tiene demasiado detalle para ese tamaño.
Y no existe SVG de los logos, solo PNG; hará falta el día que se haga BIMI.

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

---

## BARRA SUPERIOR DE ESCRITORIO (15 sep 2026)

Rehecha sobre el mockup de Benjamin («Gropo header.html»). Estructura del mockup, letra y
logo del producto.

| Elemento | Destino | Nota |
|---|---|---|
| Logo | `/` | `public/logo.png`, 1200×383, a 40 px de alto ocupa 125 px |
| Explorar | `/` | activo solo con `pathname === '/'` |
| Mis grupos | `/mis-grupos` | |
| Mi Radar | `/favoritos` | |
| Cómo funciona | `/como-funciona` | |
| Buscador | `/?q=…` | visible desde `xl` (1280 px) |
| Crea tu grupo | `/crear-peticion` | CTA naranja |
| Campana | `/notificaciones` | **única entrada** a la actividad de compra |
| Avatar | `/perfil` | |

**Lo que NO se copió del mockup, y por qué**

1. **Tipografía.** El mockup usa Outfit; el producto usa Geist / Space Grotesk / Instrument
   Serif. Decisión de Benjamin: estructura del mockup, letra actual.
2. **Enlaces.** El mockup lista «Productos · Cómo funciona · Comunidad · Mi Radar».
   «Comunidad» no existe como ruta y «Mis grupos» faltaba. Se mantienen los cuatro reales.
3. **Contraste.** El CTA del mockup es texto blanco sobre naranja: **2,87:1**, no pasa AA
   (calculado). Se aplica la regla que ya estaba en `tailwind.config.ts`: fondo `accent` con
   texto casi negro, **6,04:1**. El subrayado del activo es un elemento gráfico y AA le pide
   3:1; `accent` (#FF6A00) da 2,79:1, así que ahí va **#EC5600** (3,46:1).
4. **Botón «Entrar» con el nombre del usuario.** Necesita que la barra consulte la sesión, cosa
   que hoy no hace. Queda el avatar. **Pendiente.**

**El buscador tenía que ir a algún sitio.** Antes vivía solo dentro de la home y filtraba en
cliente. En una barra global tiene que funcionar desde cualquier página, así que envía a
`/?q=…` y `HomeDesktopView` lee ese parámetro (`useSearchParams`, seguro porque la página es
`force-dynamic`). Estando ya en la home, la URL cambia sin remontar el componente: por eso hay
un `useEffect` que sincroniza. Sin esto sería otro control con aspecto de hacer algo — el error
de A-35.

**Presupuesto de anchura**, comprobado con aritmética en los puntos donde puede romperse:

| Viewport | Disponible | Usado | Sobra |
|---|---|---|---|
| 1024 px (sin buscador) | 960 | 844 | 116 |
| 1280 px (aparece el buscador) | 1176 | 1096 | 80 |
| 1920 px | 1176 | 1096 | 80 |

Por debajo de 1024 px esta barra no se renderiza: las páginas la envuelven en
`hidden lg:block` y en móvil manda `BottomNav`.

**Sin verificar:** nadie la ha mirado todavía en un navegador.

---

## TRANSICIONES DEL MENÚ (15 sep 2026)

### La pantalla en blanco de «Mis grupos»

**Causa raíz: dos viajes de red en serie y un marco que se iba con ellos.**

`/mis-grupos` es un componente de cliente. Al montar hacía
`supabase.auth.getUser()` —viaje a Supabase, que además refresca el token— y **mientras
tanto devolvía una pantalla completa con tres puntos, sin barra de navegación**. Por eso
desaparecía todo. Solo cuando eso volvía lanzaba `fetch('/api/my-groups')`, el segundo
viaje; durante él la lista estaba vacía y la vista de escritorio anunciaba «Aún no
participas en ningún grupo» a alguien que sí participa.

Tres estados, dos de ellos falsos. `/como-funciona` y `/favoritos` iban fluidas porque
pintan su barra en el primer render y no encadenan peticiones.

**Corregido.** `/api/my-groups` **ya resuelve la sesión en el servidor** desde las
cookies y devuelve 401 si no hay ninguna: preguntárselo antes al navegador era preguntar
dos veces lo mismo. Ahora se lanza esa única petición al montar y su código de estado
decide la pantalla (401 → entrar, 200 → tus grupos). El nombre del usuario, que es
decorativo, se pide en paralelo y aparece cuando llega. Las tres ramas pintan la barra, y
mientras carga hay tarjetas esqueleto en vez de una afirmación falsa.

**No se usó** ni un retardo ni una animación de entrada: eso habría tapado el problema.

### El temblor horizontal del menú

**Causa raíz: el peso tipográfico del enlace activo.** El enlace activo pasaba de peso
500 a 600 y la negrita ocupa más, así que al entrar en «Explorar» —el primero de los
cuatro— los otros tres se desplazaban a la derecha.

**Medido en Chromium**, posición X de cada enlace según cuál esté activo:

| | Explorar | Mis grupos | Mi Radar | Cómo funciona | Máximo |
|---|---|---|---|---|---|
| Antes, activo «Mis grupos» | 289 | 372,86 | 480,88 | 569,73 | |
| Antes, activo «Explorar» | 289 | 377,86 | 479,22 | 568,08 | **5 px** |
| Después, en ambos casos | 289 | 377,86 | 485,88 | 577,23 | **0 px** |

**Corregido** reservando siempre la anchura de la negrita: dos copias de la etiqueta
apiladas en la misma celda de rejilla, la invisible en peso 600 fijando la anchura. La
negrita se conserva porque es el refuerzo no cromático del estado activo. Funciona con
cualquier tipografía porque la mide el navegador.

**La barra de scroll no era la causa, y se comprobó.** Era el sospechoso obvio, pero con
barras flotantes —macOS, que es donde trabaja Benjamin, y el móvil— no hay salto:
`gutter:auto` da X=100 tanto en página corta como larga. Y `scrollbar-gutter: stable`
habría estrechado el sitio 15 px igualmente (X=92,5), a cambio de nada. Descartado, con
la medición escrita en `globals.css` por si aparece en Windows o Linux.

### Segunda tanda: las escaleras viajaban aparte

Quitada la cadena de peticiones, quedaba una segunda espera menos visible pero igual de real:
recibidos los pedidos, el navegador lanzaba **un `tier_demand` por cada grupo abierto**. Por eso
las tarjetas aparecían primero y los números —«faltan N uds», la barra de progreso— se
rellenaban después.

Medido antes de tocar nada: `get_my_groups` tarda **0,24 ms** y `tier_demand` **4,7 ms**
(`EXPLAIN ANALYZE` sobre producción). La base de datos no era el problema; lo eran las idas y
vueltas.

**Corregido:** `/api/my-groups` trae las escaleras con los pedidos, en paralelo y desde el mismo
centro de datos. Encarece la respuesta unos milisegundos y ahorra una tanda entera en el
cliente; las tarjetas se pintan completas en una sola pasada. `useLadders` acepta esa siembra y
solo pide lo que falte, así que la vía de identidad local y la suscripción en vivo siguen
funcionando igual.

### Y una afirmación que sobraba

Mientras la escalera no había llegado, la tarjeta anunciaba **«Precio mínimo»** — porque «no hay
tramo siguiente» y «todavía no sé nada de este grupo» se calculaban igual. Es el mismo error que
A-36 en pequeño: afirmar lo que no se sabe. `derive` distingue ahora los dos casos con
`ladderKnown`, y sin escalera la tarjeta deja el hueco en blanco en vez de inventarse un estado.

### El mismo patrón, en `/perfil`

Benjamin, después de dar por buena «Mis grupos»: «al darle al icono de perfil, por una
milésima la pantalla queda en blanco».

**Era el mismo fallo, en la última pantalla que lo tenía.** `/perfil` devolvía una pantalla
completa con tres puntos y **sin barra de navegación** mientras `getUser()` viajaba a la red.

Y aquí se ve por qué «Cómo funciona» y «Mi Radar» siempre fueron fluidas: son **componentes de
servidor**. Next mantiene la página anterior a la vista hasta que la nueva está lista, así que
no hay ningún estado vacío en el navegador. Las dos que parpadeaban eran las dos que comprueban
la sesión desde el cliente.

**Corregido con dos cambios.**

1. **El marco se queda.** La rama de espera pinta la barra, el fondo y un esqueleto con la
   silueta del perfil. Ya no hay nada que «desaparezca».
2. **Dos preguntas en vez de una.** `getSession()` lee del almacenamiento local y responde en
   el mismo instante; `getUser()` va a la red y sigue siendo la autoridad. La local **solo
   adelanta el caso positivo**: si dice que hay sesión, el perfil se pinta ya. Si dijera que no,
   no se adelanta nada, porque enseñar «entra en tu perfil» y cambiarlo un instante después
   sería peor que esperar.

No relaja ninguna seguridad: decide **qué pantalla se enseña**, no a qué datos se accede — eso
lo autoriza el servidor en cada petición.

**Las seis combinaciones, comprobadas:**

| Sesión local | Servidor | Quién llega antes | Resultado |
|---|---|---|---|
| sí | sí | local | perfil |
| sí | sí | red | perfil |
| sí | **no** (caducada) | local | **entrar** |
| sí | **no** | red | **entrar** |
| no | sí (recién entrado) | local | perfil |
| no | no | — | entrar |

La respuesta local **nunca resucita una sesión muerta**: la guarda es `prev === undefined`, así
que solo rellena el hueco, nunca sobrescribe lo que ya dijo el servidor.

**Ya no queda ninguna pantalla completa sin barra en todo el producto** (comprobado: cero
apariciones del marcador `···` en `src/app/`).

---

## P1-10 · «Ver estado de tu plaza», lo que el panel no contaba (15 sep 2026)

Medio panel estaba vacío. Lo que le faltaba no era relleno: eran datos que el sistema ya tiene
y que el comprador necesita **justo ahí**, porque es la pantalla a la que vuelve días después de
comprar.

### Lo añadido

**Tu pedido.** Cantidad, precio máximo y **fecha y hora exacta de cierre** en hora peninsular.
Antes solo había «2d 07h restantes»: una cuenta atrás transmite urgencia pero no sirve para
organizarse.

**Qué pasa al cerrar**, los tres desenlaces:

1. Precio final ≤ tu máximo → se cobra el precio final, que puede ser más bajo.
2. Precio final > tu máximo → tu compra **no se ejecuta**, se libera la retención, sin cargo.
3. El grupo no sale adelante → tampoco se cobra nada.

**Por qué esto importa más de lo que parece.** El caso 2 es RULE-032, y ese comprador **no recibe
ningún email**: `sendClosePaymentEmails` solo escribe a `instructed` y `paid`. Este panel es
literalmente el único sitio donde puede enterarse de que eso puede pasarle.

### Dos errores encontrados al construirlo

**1. «Tu plaza está asegurada hasta 85 €» es ambiguo con varias unidades.** `guaranteed_price`
es POR UNIDAD, pero la frase se lee como el total. En producción **25 de 184 membresías piden más
de una unidad, y una pide 10**: para esa persona la pantalla decía 85 € cuando su techo real son
850 €. No es hipotético. Corregido en la tarjeta y en el panel con «por unidad» cuando procede.
No se calcula un total, porque el importe retenido puede incluir gastos de envío y eso no viaja
en `get_my_groups`: inventarlo sería justo el error que esta pantalla debe evitar.

**2. El techo se leía del campo equivocado para quien espera a un precio.** `close_group` paso 4
—comprobado sobre la **función viva**, no sobre el repositorio— cancela con campos distintos
según el modo: `target_price` para `esperar`, `guaranteed_price` para `comprar`. El panel leía
siempre `guaranteed_price`. Hoy coinciden en las 27 membresías «esperar» de producción, así que
el número salía bien **por casualidad**, no por corrección. `derive` lee ahora el campo que manda
en cada caso.

### Verificado

Las tres frases se comprobaron contra la misma regla que ejecuta el servidor, transcrita del
`pg_get_functiondef` de producción, en 12 aserciones: en el techo exacto se compra (la
comparación es estricta), un céntimo por encima se queda fuera, y por debajo se compra más
barato. Incluido el caso en que los dos campos divergieran: con el campo equivocado el panel
prometería comprar a 119 € y el cierre lo cancelaría.

**Sin verificar:** el aspecto en pantalla. Nadie lo ha mirado todavía en un navegador.
