# VONDA — HANDOFF 10 julio 2026

**Sesión:** 10 julio · La Ola (perfil orgánico) + El Ticket (diseño + Fase A del checkout 1-Click)
**Modelos:** Opus 4.8 (todo — incluye money-critical A2)
**Estado al cierre:** La Ola rediseñada. El Ticket definido y prototipado (mobile). **Fase A del checkout 1-Click COMPLETA y verificada contra Stripe/BD viva (A1 + A2).**

---

## 1. Lo que se hizo

### La Ola — perfil orgánico (WaveProgress.tsx)
- `makeProfile` pasó de **suma de senos** (se veía periódico / dientes de sierra) a un **random-walk con momentum** (velocidad con damping + mean-reversion + rebote suave en los bordes). Determinista por `seed` (hash DJB2 + LCG) → estable en SSR/hidratación.
- Ajuste tras feedback de Benjamin: **más movimiento** (impulso 0.34, damping 0.74, rebote 0.6). Curvas tipo ticker bursátil, irregulares.
- Aprobado visualmente vía preview inline. Resto del componente (Catmull-Rom, gradient vertical, dot, 4 colores, 80px) intacto.

### El Ticket — diseño (mockup de 6 frames aportado por Benjamin)
Decisiones de producto cerradas:
- **El Ticket = lenguaje visual de tarjeta-ticket** (bordes perforados, recibo) que envuelve el flujo de bloqueo + estados. No es solo una URL de recibo.
- 6 frames: (1) pre-bloqueo, (2) verificando, (3) asegurada inline, (4) confirmación full, (5) acción requerida/error, (6) Radar "precio bloqueado".
- **Arquitectura de datos: híbrido con prefill.** Stripe = bóveda (Customer + tarjeta guardada); Supabase solo inyecta el último envío (desde `group_members`, sin CRUD nuevo).
- **Stripe Elements embebido** (no Checkout hosted) — mantiene la metáfora del ticket y reutiliza el `PaymentElement` actual.
- **FastCheckoutModal "Confirma tu bloqueo"** (bottom sheet) purgado: precio máximo + producto + envío/pago prefill + CTA. FUERA: ola, urgencia, selector de cantidad. Editar = acordeón inline (no vista nueva).
- Copy: botón "BLOQUEAR POR X€"; carga "Asegurando tu precio…"; nota "Guardamos tu tarjeta de forma segura para tus próximas compras".
- **Prototipo mobile de alta fidelidad:** `design/el-ticket-prototype.html` (6 frames, La Ola real embebida). Aprobado.

### Fase A — Checkout 1-Click (money-critical) ✅ VERIFICADO
**Gate A1 (aditivo, sin dinero):**
- Columna `users.stripe_customer_id` (text, nullable) — **aplicada a BD viva** (migración `a1_add_stripe_customer_id_to_users`).
- Endpoint `GET /api/checkout/prefill` (read-only): con sesión activa devuelve `shipping` (último `group_members`), `payment` (last4/brand/wallet desde Stripe) y `contact`. Degrada limpio (sin sesión → `authenticated:false`; sin compra → `shipping:null`; sin Customer → `payment:null`).

**Gate A2 ⚡ (`create-intent` + `JoinFlow`):**
- `create-intent` deja de crear un Customer desechable siempre: **reutiliza/persiste** el Customer del usuario autenticado (`users.stripe_customer_id`) con `setup_future_usage: 'on_session'`.
- **Degradación elegante en 3 capas:** (1) fallo sesión/BD → invitado; (2) fallo de persistencia → best-effort, no bloquea; (3) Customer `resource_missing` → reintento con Customer fresco.
- La reutilización 1-Click depende de **persistir el Customer** (authUserId), no del flag → regla "solo autenticados" intacta aunque el flag aplique también a invitados (tarjeta a Customer desechable inerte).

**Bug cazado y resuelto:** Stripe Elements en modo diferido exige que cliente y servidor usen el MISMO `setup_future_usage`. Faltaba en el `Elements` del `JoinFlow` (cliente `null` vs servidor `on_session`) → error de confirmación. Fix: `setup_future_usage: 'on_session'` en ambos lados.

**Verificación (Benjamin, login + 2 compras reales test-mode 4242):**
- 1ª compra autenticada → persistió `cus_UrEUorVsAd1S7l` (la columna estaba NULL tras A1 → escrito por A2).
- 2ª compra → `stripe_customer_id` **sin cambios** + **1 customer distinto en toda la tabla** → reutilización probada, sin duplicados.

---

## 2. Estado de archivos (working tree, SIN commitear)
- `src/components/WaveProgress.tsx` — La Ola orgánica (+ v3 previo sin commitear)
- `src/app/favoritos/page.tsx` — Mi Radar v3 (previo)
- `src/app/api/join/create-intent/route.ts` — A2 (money-critical)
- `src/app/grupo/[id]/unirme/JoinFlow.tsx` — A2 cliente (setup_future_usage)
- `src/app/api/checkout/prefill/route.ts` — A1 (nuevo)
- `design/el-ticket-prototype.html` — prototipo (nuevo)
- `.claude/`, `HANDOFF_MI_RADAR.md` — untracked (NO commitear .claude/)

Comandos de commit propuestos entregados en el chat. Git lo corre Benjamin.

---

## 3. Flecos / próximos pasos

### Fase A restante (checkout 1-Click)
- **Gate A3:** construir `FastCheckoutModal` (bottom sheet purgado + acordeones inline). Safe-area iOS en el CTA; truncar dirección larga.
- **Gate A4:** estados de transición del ticket (verificando "Asegurando tu precio…" / asegurada / error) cableados a la respuesta real; el botón se transforma in situ.
- **Capstone pendiente:** abrir `http://localhost:3000/api/checkout/prefill` logueado → confirmar que `payment` ya devuelve `visa/4242`.

### Fase B / C
- **B:** Ticket (frame 1) poblado desde el 200 OK del bloqueo.
- **C:** variante Radar "precio bloqueado" (frame 6) sobre la OpportunityCard existente.

### Entorno / operación
- **Puerto:** `next dev` arranca en **3000** (el script no fuerza 3001). Alinear `stripe listen`, redirect URL y login al mismo puerto.
- **Supabase Auth:** añadido `http://localhost:3000/**` a Redirect URLs (para magic link en local).

### Backlog previo aún vigente
- Unificar clientes Supabase browser (matar `supabase.ts`, warning "Multiple GoTrueClient").
- 404s: `/notificaciones`, `/mensajes`, `/como-funciona`, `/ayuda`, `/api/group/tier-demand` (sin id).
- `total_units=0` con solo esperadores (display). "Vendedor verificado" ausente en escritorio.
- Páginas `/perfil`, `/mis-grupos`. Stripe live cutover (bloqueado por alta empresa).

---

## 4. Protocolo de potencia vigente
- Opus 4.6: por defecto (UI, APIs, CRUD, QA, bugs).
- ⚡ Fable 5 / Opus 4.8: solo `compute_price`, `close_group`/`join_group`, RLS. (A2 se hizo con Opus 4.8 por tocar create-intent/Stripe.)

## 5. Verificación money-critical (protocolo)
Toda función/flujo de dinero: propuesta → confirmación explícita de Benjamin → ejecución → verificación contra Stripe/BD viva. A2 siguió el ciclo completo (diff revisado antes de aplicar, hold real verificado).
