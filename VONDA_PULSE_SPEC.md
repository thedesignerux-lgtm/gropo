# VONDA PULSE — Especificación V1

**Fecha:** 12 julio 2026 · **Decisiones P1–P3 aprobadas por Benjamin** · **Redactada con Claude Fable 5**
**Lanzamiento:** ~26 julio (dos semanas)

---

## 0. Invariante de seguridad (innegociable)

> **Un grupo sin pledges se comporta EXACTAMENTE igual que hoy.**

El Pulse NO modifica `compute_price`, `close_group`, `confirm_join`, `prepare_join` ni `tier_demand`.
Verificado en G0: esas funciones solo cuentan miembros con `payment_status IN ('authorized','instructed','paid')`.
Un pledge sin hold ejecutado es invisible para el precio, la demanda efectiva y la adjudicación. Por construcción.

**Segunda ancla de seguridad:** cuando un pledge se convierte en retención, entra al sistema como
**esperador con `target_price` = precio del tier aceptado**, por el pipeline ya verificado
(PaymentIntent → webhook → `confirm_join`). Consecuencia: si la masa finalmente no se materializa
(tarjetas fallidas), `close_group` libera esos holds automáticamente — la mecánica actual, sin una
línea nueva de lógica de dinero.

---

## 1. Decisiones de producto aprobadas

| # | Decisión | Regla |
|---|---|---|
| P1 | Retención diferida | Al aceptar solo se guarda la tarjeta (SetupIntent, 0 €). La retención se dispara automáticamente para todos los aceptantes cuando la masa crítica se alcanza. |
| P2 | Masa = las suficientes | El disparo ocurre cuando `comprometidos + aceptaciones ≥ min_units` del tier. No hace falta que acepten todos los observadores. Quien llega tarde entra al precio nuevo por el flujo normal. |
| P3 | Pulse público solo intensidad | En tarjetas públicas la onda naranja expresa niveles discretos (0–3), nunca cifras. Coherente con opacidad D5. |
| P4 | Conversión como esperador (decisión técnica de Claude) | El miembro convertido entra con `join_mode='esperar'`, `target_price = tier aceptado`, hold = tier × qty. Garantiza: jamás paga más que el tier que aceptó, y si el tier no se consolida su hold se libera al cierre. |

**Escalera de compromiso (narrativa de producto):**
Radar (miro) → **Pulse: espero en un tier** (naranja) → **Acepto si somos masa** (tarjeta guardada, morado) → Retención automática al alcanzar masa → Mis Grupos (círculo sólido).

---

## 2. Modelo de datos (G1)

### 2.1 Tabla `pulse_pledges`

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| group_id | uuid FK groups | |
| auth_id | uuid FK auth.users | misma identidad que `favorites` |
| quantity | int ≥1 | |
| tier_price | numeric | precio del salto de la escalera FUSIONADA elegido (validado server-side contra `tier_demand`, igual que create-intent) |
| status | enum `pulse_status` | `watching → accepted → holding → converted` / `failed` / `expired` / `cancelled` |
| stripe_customer_id | text | reutiliza `users.stripe_customer_id` (Gate A2) |
| stripe_payment_method_id | text | del SetupIntent al aceptar |
| stripe_setup_intent_id | text | |
| stripe_payment_intent_id | text | del disparo (holding→converted) |
| buyer_name / buyer_email / buyer_phone | text | necesarios para `confirm_join` off-session |
| shipping | jsonb | idem |
| accepted_at / triggered_at | timestamptz | |
| created_at | timestamptz | |

- **RLS:** SELECT/DELETE solo `auth.uid() = auth_id`; INSERT/UPDATE solo vía servidor (service_role). Nada de esta tabla es legible públicamente.
- Único parcial: un pledge vivo (`watching/accepted/holding`) por (group_id, auth_id).

### 2.2 Estados

- `watching` — "Espero en este tier". Sin tarjeta. Alimenta la onda naranja.
- `accepted` — Pulsó Aceptar, tarjeta guardada (SetupIntent off_session). Alimenta el impulso morado. Cuenta para la masa.
- `holding` — El disparador lo tomó; PaymentIntent off-session en curso.
- `converted` — Hold autorizado; `confirm_join` creó el miembro (vía webhook). El producto pasa de Mi Radar a Mis Grupos.
- `failed` — Tarjeta rechazada/SCA en el disparo. No cuenta para la masa. El usuario puede volver a `accepted` con otra tarjeta.
- `expired` — El grupo cerró sin masa. `cancelled` — retirado por el usuario antes del disparo.

---

## 3. Algoritmo del Pulse

### 3.1 Semántica de conteo

Para un salto S de la escalera fusionada (`min_units M`, `price P`):

```
comprometidos(P) = effective_demand de tier_demand (ya existe, sin tocar)
aceptados(P)     = SUM(quantity) de pledges 'accepted' con tier_price >= P
latentes(P)      = SUM(quantity) de pledges 'watching' con tier_price >= P
                   + favoritos del grupo sin pledge (peso 1)
```

(Un pledge al tier P acepta implícitamente cualquier precio ≤ P — misma semántica que el PMA.)

### 3.2 Condición de disparo (P2)

```
DISPARA(S)  ⇔  comprometidos(P) + aceptados(P) >= M
```

El disparador toma el salto **más barato** que cumpla la condición (maximiza el beneficio del grupo)
y convierte los pledges `accepted` con `tier_price >= P`, los necesarios primero por `accepted_at`
(antigüedad — coherente con D3). Los sobrantes quedan `accepted` para el siguiente salto.

### 3.3 Concurrencia y idempotencia

- `pulse_check_and_lock(group_id)` — RPC service_role: `pg_advisory_xact_lock(hash(group_id))`,
  evalúa 3.2, marca los elegidos `holding` con `FOR UPDATE`, devuelve la lista. Doble llamada = segunda vacía.
- Se invoca: tras cada `accept`, tras cada `confirm_join` de miembro normal (la demanda comprometida también
  acerca la masa), y por cron de respaldo cada 10 min.

### 3.4 Ejecución del disparo (Node, `/api/pulse/trigger`)

Para cada pledge `holding`:

```
PaymentIntent off-session: amount = tier_price × qty, capture_method='manual',
customer + payment_method guardados, off_session=true, confirm=true,
metadata IDÉNTICA a create-intent con join_mode='esperar', target_price=tier_price,
guaranteed_price=tier_price  →  el webhook existente hace el resto (confirm_join,
email, recálculo de precio del grupo). CERO código nuevo aguas abajo.
```

- Éxito → `converted` (el webhook crea el miembro; Realtime propaga; "automáticamente baja el precio para todos").
- Fallo (`card_declined`, `authentication_required`) → `failed` + notificación para reintentar con otra tarjeta.
  Los demás holds del lote NO corren peligro: son esperadores; si el tier no llega, se liberan al cierre (§0).

### 3.5 Expiración

Al cierre del grupo, el cron `close-groups` (capa app, no SQL de dinero) marca `watching/accepted → expired`.
`close_group` no se toca.

---

## 4. Superficie pública (G3) — `/api/group/[id]/pulse`

Servidor (service_role), agregado, cacheado ~10 s. Por salto de la escalera fusionada:

```
{ units, price, reached, isTarget,
  intensity: 0|1|2|3,   // naranja: latentes(P) en buckets 0 / 1–2 / 3–5 / 6+
  surge: boolean }      // morado: hay 'accepted'/'holding' vivos hacia ese salto
```

Nunca viajan al cliente: conteos exactos, identidades, tier elegido por otros, nada de `bids`.

---

## 5. UI (G4–G5)

### 5.1 Componente visual

`TierProgress` gana prop opcional `pulse?: PulseStep[]`:
- **Onda naranja** (`intensity > 0`): anillos concéntricos expansivos en el nodo del tier, amplitud/frecuencia
  según nivel 1–3. CSS puro, `motion-reduce` la sustituye por glow estático.
- **Impulso morado** (`surge`): pulso que viaja por el track hacia el nodo + halo morado en el nodo.
- **Solidificación**: al alcanzarse, el nodo pasa al círculo relleno existente (sin animación nueva: es el estado actual).

`DesktopProductCard` (barra simple de un solo objetivo): anillo de pulso alrededor del círculo objetivo,
naranja o morado según estado. Sin números (P3).

### 5.2 Dónde aparece

Todas las tarjetas con barra de progreso: **Home/Grupos Abiertos** (`DesktopProductCard`, ambas vistas),
**Mi Radar** (`OpportunityCard` → `TierProgress`), **Mis Grupos** (`MgCard`). Móvil y desktop
(recordar: árboles de componentes separados).

### 5.3 Flujo "Esperar en este tier" (Mi Radar / ficha)

1. Usuario con el producto en Mi Radar elige un salto de la escalera → pledge `watching`. Requiere sesión (magic link).
2. Cuando `pulse_state` indica masa alcanzable para su tier, su tarjeta en Mi Radar muestra el CTA
   **"Aceptar este precio"** (+ aviso en `/notificaciones`).
3. Aceptar → modal: datos de envío + tarjeta (Stripe Elements sobre SetupIntent `usage='off_session'`, 0 € hoy) →
   `accepted`. Copy: "No se retiene nada ahora. Solo si el grupo alcanza el precio de X €, retendremos X € × cantidad."
4. Disparo → conversión → el producto aparece en Mis Grupos. Mi Radar lo muestra como asegurado.

**Copy prohibido intacto:** nada de "tiers/demanda"; en UI el pledge es "Esperar en este precio" y
la aceptación "Aceptar este precio".

---

## 6. Plan de gates

| Gate | Contenido | Verificación |
|---|---|---|
| G0 ✅ | Fuente viva leída: compute_price, tier_demand, create-intent, webhook, esquema | hecho 12 jul |
| G1 | Migración `pulse_pledges` + enum + RLS + RPCs (`pledge_upsert`, `pledge_cancel`, `pulse_state`, `pulse_check_and_lock`) | SELECTs + `has_function_privilege` + prueba RLS con `SET LOCAL ROLE anon` |
| G2 | `/api/pulse/accept` (SetupIntent) + `/api/pulse/trigger` + hook en webhook/cron | prueba con Stripe test: aceptar → disparo → hold visible en dashboard |
| G3 | `/api/group/[id]/pulse` agregado | respuesta sin datos sensibles, prueba como anon |
| G4 | UI Pulse en TierProgress + 3 superficies × (móvil+desktop) | revisión visual navegador |
| G5 | Flujo pledge/accept end-to-end en Mi Radar | prueba manual |
| G6 | Regresión (grupo sin pledges = idéntico) + batería: disparo exacto en umbral, tarjeta fallida recalcula, tardío entra normal, expiración al cierre + E2E estilo F1/F2 con holds reales de test | las tres evidencias de siempre |

Protocolo money-critical en G1, G2 y G6: propuesta → confirmación explícita de Benjamin → ejecución → verificación.

## 7. No-objetivos (V2+)

- Notificaciones usuario→usuario ("estoy listo si tú lo estás") — el sistema notifica cambios de estado, no personas.
- Pledges anónimos sin cuenta; múltiples pledges por usuario en el mismo grupo; edición de cantidad post-aceptación.
- Pulse en la página del vendedor/admin (solo lectura básica de conteos en admin, si acaso).
