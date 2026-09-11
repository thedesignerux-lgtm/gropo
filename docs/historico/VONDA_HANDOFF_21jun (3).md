# VONDA — Estado completo y plan de arranque (handoff 21 jun 2026)

**Fecha de cierre de sesión:** 21 jun 2026
**Repo:** `/Users/benjamin/Desktop/kuorum` (Next.js 14 App Router · `src/` · `@/` → `src/`)
**GitHub:** `thedesignerux-lgtm/kuorum` · Supabase project: `xpktkuozspreuxucnguh`
**Reparto:** Claude = arquitecto/CTO (escribe el código y razona); Benjamin = manos de Claude Code/Cowork + dashboards (Supabase/Stripe/Vercel). Benjamin no escribe código; ejecuta y aprueba.

---

## Qué es

MVP de compra colectiva para ciclismo en España. El precio baja en vivo según entran compradores (por **unidades**, no por compradores). Cierre dominical 22:00 Europe/Madrid. Todos pagan el mismo precio final de liquidación. **Vonda es merchant-of-record**.

**Producto real (inventado, sin vendedor real aún):** Continental GP5000 S TR 700x28c · PVP 79,95 € · tramos 10→74,90 / 25→69,90 / 50→64,90 / 100→59,90 · mín 10 uds · stock 120 · cláusula 75%.
**Lanzamiento objetivo:** domingo 28 jun 2026 (en revisión — ver "Bloqueador real").

---

## 🟢 EL HITO DE HOY: motor de demanda efectiva COMPLETO

Hoy se construyó y validó el mecanismo que diferencia a Vonda: el **"comprador condicionado"** (esperar a un precio). Vonda dejó de ser un grupo de compra simple para ser una **subasta de demanda colectiva**.

### Especificación canónica (FUENTE DE VERDAD — guardar en `docs/MOTOR_VONDA.md`)

**Semántica: "Esperar a X" = PMA (Precio Máximo Aceptado).** El usuario dice "X es el precio más alto que pago", NO "solo a X exacto".

- Comprar ahora → PMA = ∞ (acepta cualquier precio)
- Esperar a 69,90 → PMA = 69,90 (acepta 69,90 y más barato)
- Esperar a 64,90 → PMA = 64,90 (acepta 64,90 y más barato)

**Demanda efectiva de un tier T** = Σ unidades de miembros vivos con PMA ≥ precio(T).
**Tier desbloqueado** ⟺ demanda_efectiva(T) ≥ unidades_requeridas(T).
**Precio final** = el tier más barato desbloqueado.
**Liquidación**: cada miembro compra ⟺ precio_final ≤ su PMA; si no, libera el hold.
**NO existe `total_units` único** — cada tier tiene su demanda efectiva independiente.

Ejemplo validado: 31 compradores + 52 esperadores@59,90 → demanda(69,90)=31, demanda(64,90)=31, demanda(59,90)=83. Solo 69,90 se desbloquea (31≥25). **Precio final = 69,90.** Los 52 esperadores@59,90 liberan (59,90 < 69,90).

### Lo construido y verificado HOY

1. ✅ **Migración:** `group_members` + `join_mode` (text NOT NULL default 'comprar') + `target_price` (numeric NULL). Verificado en BD viva.
2. ✅ **`confirm_join` (11 args):** acepta `p_join_mode`/`p_target_price`, los inserta. Versión vieja de 9 args BORRADA (firma única confirmada). Persiste con `payment_status='authorized'`.
3. ✅ **Webhook** (`/api/stripe/webhook/route.ts`): pasa `p_join_mode`/`p_target_price` a la RPC (lee de metadata del PI). `tsc` limpio.
4. ✅ **create-intent:** ya guardaba `join_mode`/`target_price` en metadata con nombres correctos. Cadena E2E coherente: create-intent → metadata → webhook → confirm_join → BD.
5. ✅ **`compute_price` REESCRITA** (demanda efectiva por tier): aplicada en producción, firma única `compute_price(uuid,integer)`. Verificada: para grupos sin esperadores da el MISMO precio que antes (inocuo). Para el caso 31+52 da 69,90.
6. ✅ **`close_group` REESCRITA** (alineada con el motor): aplicada, firma única `close_group(uuid)`. Llama a `compute_price` para el precio final → vivo y cierre usan la MISMA lógica (descuadre eliminado).
   - Ajuste 1: esperador con `target_price NULL` → libera (dato corrupto, nunca cobrar).
   - Ajuste 2: guarda `gross_units` (bruto) + `total_units` (los que compran) en eventos y returns.
   - Mínimo de ejecución medido SOLO sobre compradores; si no se alcanza → **cancelación total** (grupo + todos cancelled).

### Validación (test de lógica SQL, 3 casos, todos ✓)

- **Caso 1:** comprador 30 + esperador@64,90 qty 25 → precio 64,90, ambos instructed. ✓
- **Caso 2:** comprador 31 + esperador@59,90 qty 20 → precio 69,90, comprador instructed, esperador CANCELLED, gross=51/total=31. ✓
- **Caso 3:** comprador 8 + esperador@59,90 qty 20 → ningún tier (8<25), precio base 74,90, esperador libera, compradores 8<10 mín → CANCELACIÓN TOTAL, ambos cancelled. ✓

Grupo de prueba `TEST_MOTOR_BORRAR` borrado tras los tests.

### ⚠️ Lo que FALTA del motor (no urgente, pendiente)

- 🔴 **Test Nivel 2 (Stripe real):** los 3 casos validaron la máquina de ESTADOS, no el dinero. Falta probar que `captureGroupPayments` captura/libera holds reales en Stripe al cerrar con esperadores. Va en el ensayo de cierre E2E. ⚡ Opus 4.8.
- 🟡 **UI del selector de PMA/tier** (Fase 4): la pantalla que Benjamin diseñó (escalera de precios, 3 filas comprando/esperando, selector "Comprar cuando alcance: [tier ▾]", "cambiar objetivo"). Hoy "esperar" vive en el front pero la UI de elegir tier no está construida. Va en MORADO (#6C3CE1), el mockup está en verde Kuorum (antiguo).
- 🟡 **"Cambiar de objetivo" en vivo** (Fase 3): acción money-critical (re-evalúa demanda, posible reajuste de hold). Vista en el mockup ("Javier cambió su objetivo a 37€").
- 🟡 **CHECK constraint de monotonía de tiers en BD** (hoy solo se valida en TypeScript del admin). No bloquea; el motor es robusto a tiers desordenados vía MIN(). V1.

---

## 🔴 EL BLOQUEADOR REAL (más importante que el código)

**No hay vendedor real.** El producto GP5000 y sus tramos son inventados. Ninguna tienda ha aceptado la mecánica todavía.

- Un distribuidor ya dijo: **"sin pagos centralizados y sin envíos, no es viable"** (proceso manual). Esto valida Stripe (✅ hecho) y define el siguiente bloqueador: **envíos automáticos**.
- **Benjamin llama el lunes 22** a más tiendas. Diego (Ciclored) es el contacto warm de mayor prioridad (de handoffs previos).
- **El motor de esperadores NO es lo que cierra al vendedor.** Lo que lo cierra es: cobro centralizado (✅) + envío automático (🔴 no construido).

---

## 📦 Envíos: arquitectura Sendcloud (DISEÑADA, no construida)

**Decisión: Sendcloud, no Packlink.** Packlink PRO **no tiene API** → descartado. Sendcloud tiene API, cubre SEUR (lo que pidió el distribuidor), es multi-courier (no te casas con SEUR), y tiene tier gratis (50 etiquetas/mes).

**Multi-courier confirmado:** una integración → varios couriers (SEUR, Correos, GLS, DHL…) eligiendo por reglas. No te atas a ninguno.

### Arquitectura (espejo de stripe-capture.ts)

```
close_group → captureGroupPayments → generateShippingLabels (NUEVO, no-fatal)
```

- **Nueva función** `src/lib/shipping-sendcloud.ts`: lee miembros instructed/paid, POST a Sendcloud `/api/v2/parcels` por miembro, guarda label_url + tracking + parcel_id. Idempotente vía `shipping_parcel_id`. Fallos → admin alert, no rompen el cierre.
- **Migración nueva:** `group_members` + `shipping_label_url`, `shipping_tracking_code`, `shipping_carrier`, `shipping_parcel_id`, `shipping_status` (default 'pending').
- **Env vars:** `SENDCLOUD_PUBLIC_KEY`, `SENDCLOUD_SECRET_KEY`, `SENDCLOUD_SHIPPING_METHOD_ID`.

### Decisiones pendientes (dependen del distribuidor concreto)

1. **Remitente** = dirección del distribuidor (él empaqueta), no Vonda.
2. **Disparo:** recomendado botón manual admin "Generar etiquetas" en V0 (no automático al cierre).
3. **Quién paga el envío:** decisión de negocio (¿margen Vonda o distribuidor?). Define de quién es la cuenta Sendcloud.
4. **Handoff de PDFs al distribuidor:** V0 = Vonda genera y se los pasa (email/carpeta); acceso directo es V1.

### NO en V0 (anti scope creep)
Tracking en vivo para comprador, portal devoluciones, multi-courier con reglas, tarifas en tiempo real, notificación automática de tracking al comprador.

### Construcción: 1-2 días, SOLO cuando un distribuidor diga "sí, probemos". ⚡ Opus 4.8 para la función.

---

## 🎨 UI / Desktop (avanzado esta sesión)

- ✅ **Desktop Ficha de grupo** (3 columnas: nav tabs | contenido | sidebar precio+tier+CTA) — en producción. 4 componentes en `src/components/desktop/`. Realtime, 6 tabs funcionales, "esperar a precio" enchufado al front.
- ✅ **Desktop Inicio** — en producción.
- ✅ **Email de confirmación** — funcional con diseño Vonda (logo, tarjetas, morado). Ilustración de cesta pendiente (hueco reservado).
- 🟡 Mobile polish pendiente (territorio Benjamin).
- 🟡 BottomNav: se revirtió un cambio de Cowork que añadía tabs V1 (Favoritos/Alertas/Perfil). Existe `src/app/favoritos/` sin trackear (basura, se puede borrar).

---

## 📋 PRIORIDADES (en orden)

### 🔴 Para conseguir vendedor (lo que de verdad importa)
1. **Llamadas a tiendas (lun 22).** Argumento: "cobro centralizado con Stripe (hecho) + envío automático vía Sendcloud/SEUR (tú solo empaquetas y pegas la etiqueta lista)".
2. **Integración Sendcloud** — solo tras un "sí". 1-2 días.

### 🔴 Para el cierre a prueba de balas
3. **Ensayo de cierre manual E2E con Stripe real** (Nivel 2): grupo clon, holds reales test, verificar captura/liberación en Stripe + emails de cierre. ⚡ Opus 4.8.

### 🟡 Motor (terminar cuando haya vendedor con tramos reales)
4. UI selector de PMA/tier (la pantalla diseñada, en morado).
5. "Cambiar de objetivo" en vivo.

### 🟡 No bloquean
6. Cutover Stripe test→live (cuando haya empresa registrada).
7. CHECK constraint monotonía tiers. Guard `group_id` webhook. Página "unido" con polling. DST `closes_at`. Centralizar Resend.

### ⚠️ DEUDA PELIGROSA — sincronizar archivos del repo con producción
Producción va POR DELANTE del repo en TRES funciones. Si alguien re-ejecutara los `.sql` del repo, REVERTIRÍA el trabajo del 21 jun en silencio. Traer las versiones vivas (`pg_get_functiondef`) a los archivos:
- `supabase/compute_price.sql` (repo = total plano viejo; prod = demanda efectiva)
- `supabase/close_group.sql` (repo = viejo; prod = alineado con motor)
- `supabase/confirm_join.sql` (repo nunca actualizado con la versión de 11 args + dedup email)
Además: `compute_price_at_n` quedó SIN USO (lo reemplazó compute_price en el cierre). No estorba; retirar o marcar obsoleto algún día.

---

## 🔧 Datos técnicos de referencia

**Funciones money-critical (todas verificadas en BD viva 21 jun):**
- `compute_price(uuid, integer)` → demanda efectiva por tier. Firma única.
- `close_group(uuid)` → cierre alineado con motor. Firma única.
- `confirm_join(text,uuid,text,text,text,integer,numeric,numeric,jsonb,text,numeric)` → 11 args. Firma única.
- `compute_price_at_n(jsonb,text,integer)` → ya NO lo usa close_group (lo reemplazó compute_price). Sigue vivo por si algo lo llama.

**Contrato de datos `group_members`:**
- `join_mode` text NOT NULL default 'comprar' · `target_price` numeric NULL
- Comprador "ahora" → join_mode='comprar', target_price NULL (PMA=∞)
- Esperador → join_mode='esperar', target_price=X (PMA=X)
- **Vivos** (cuentan para demanda) = payment_status IN ('authorized','instructed','paid')
- **Muertos** = released, cancelled, auth_failed
- Índice único: `uniq_member_per_group` sobre (group_id, user_id)
- Columna PI: `stripe_payment_intent_id` (NO `payment_intent_id`)

**Stripe:** modo test · sandbox "Vonda sandbox" · endpoint `creative-harmony` → `https://www.vonda.es/api/stripe/webhook` · 1 evento `payment_intent.amount_capturable_updated`.

**Grupos abiertos en producción AHORA (datos inventados, sin validez):**
- GP5000 (b1bdab3e…6b35): 6 miembros, 43 uds, 69,90. Es el del "lanzamiento".
- "Probando otra vez" (00b0ac89…7009): 58,00.

**Archivos clave:** `src/lib/stripe-capture.ts` · `src/lib/shipping-sendcloud.ts` (a crear) · `src/app/api/stripe/webhook/route.ts` · `src/app/api/join/create-intent/route.ts` · `src/app/admin/grupos/[id]/actions.ts` · `src/components/desktop/` · `supabase/compute_price.sql` · `supabase/close_group.sql` · `supabase/confirm_join.sql`.

---

## 🧠 Reglas de proceso (críticas)

- **Verificar SIEMPRE contra la BD viva**, no contra resúmenes ni memoria de Cowork. Hoy Cowork afirmó que las columnas no existían cuando SÍ existían (leía un análisis viejo). Re-consultar `pg_proc`/`information_schema` antes de cada cambio.
- **Tras CREATE OR REPLACE con firma nueva → verificar firma única** (`SELECT oid::regprocedure FROM pg_proc WHERE proname=...`). Si hay 2, DROP la vieja.
- **Money-critical (compute_price, close_group, confirm_join, capturas, RLS) → Opus 4.8.** UI/copy → Opus 4.6.
- **Cowork ejecuta; Claude razona y escribe prompts.** Marcar siempre a Benjamin con claridad qué copiar/pegar (bloque entre ``` ```), qué es explicación.
- **www vs sin www:** todas las URLs de producción usan `www.vonda.es` (apex redirige 308, rompe server-to-server).
- **Git:** autor `benjaminperezsouto@gmail.com`.
- **Anti scope creep:** no construir nada sin necesidad real validada. El motor de esperadores fue una decisión consciente de Benjamin (camino B), no scope creep — pero Sendcloud NO se construye sin un "sí" de distribuidor.

---

**Primer paso al abrir la próxima sesión:** decidir el foco según resultado de las llamadas del lunes.
- Si hay distribuidor interesado → construir integración Sendcloud.
- Si no → ensayo de cierre E2E con Stripe real (Nivel 2 del motor), o UI del selector de tier.
