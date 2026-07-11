# VONDA — HANDOFF 10 julio 2026 (parte 2 · Gate A3)

**Sesión:** Checkout 1-Click — FastCheckoutModal ubicuo + triggers de ficha + endpoint de hold silencioso
**Modelo:** Opus 4.8 (money-critical)
**Estado al cierre:** **Fase A del 1-Click COMPLETA y verificada end-to-end con dinero de test real.** Falta Fase C (Radar) y el ticket dedicado.

---

## 1. Lo que se hizo (Gate A3 + A3.money)

### Diseño cerrado (decisiones de Benjamin)
- **"Asegura tu precio"** como título (no "Confirma tu bloqueo" — "bloqueo" evoca fraude bancario). El verbo "Bloquear" sí se mantiene en el botón (acción de trading).
- **Precio como HERO centrado** ("PRECIO MÁXIMO GARANTIZADO" → 41,90 € grande → "↓ Nunca pagarás más.").
- **Éxito INLINE en el botón** (state morphing, sin pantalla nueva): idle → "◯ Asegurando tu precio…" (morado) → "✓ ¡Precio asegurado!" (verde solo el botón) → 1,5 s → el sheet baja + toast + `router.refresh()`. Evita la "ceguera de cambio".
- **Modal ubicuo** (Radar + ficha): montado UNA vez en el root layout vía **Context nativo** (`CheckoutProvider` + `useCheckout()`), no Zustand.
- **1-Click real** con tarjeta guardada: acordeón cerrado, texto plano (Visa ···· 4242); el PaymentElement (pesado) solo se monta al pulsar "Editar". Copy: "Guardamos tu tarjeta de forma segura…".
- **Stripe Elements embebido** (no Checkout hosted). Edición de tarjeta = acordeón inline.
- Copy seguridad: "No realizaremos ningún cargo hoy. Solo pagas si el grupo se completa." · `aria-live` en el botón.

### Componentes / archivos
- `src/components/checkout/CheckoutProvider.tsx` (NUEVO) — Context + hook `useCheckout()` + toast global + `router.refresh()` en éxito. Montado en `src/app/layout.tsx`.
- `src/components/checkout/FastCheckoutModal.tsx` (NUEVO) — bottom sheet mobile / modal desktop, backdrop+blur, slide-up, ESC, scroll-lock, prefill fetch, acordeones envío/pago, máquina de estados inline, safe-area iOS, truncado dirección.
- `src/app/api/checkout/lock/route.ts` (NUEVO, ⚡ money) — hold 1-Click: create-intent + confirmación server-side con el PM por defecto, en una llamada. Maneja `no_saved_card`/`no_shipping` (400 → el modal cae a formulario), `StripeCardError` (rechazada/caducada), **3DS** (`requires_action` + clientSecret → el modal usa `handleNextAction`), éxito (`requires_capture`). Misma metadata que create-intent → el webhook crea el miembro.
- Triggers: `src/components/GroupLiveSection.tsx` (móvil) y `src/components/desktop/GroupCenterContent.tsx` (escritorio, props `name/spec/imageUrl` añadidas y pasadas desde `GroupDesktopView.tsx`). "Bloquear precio": logueado → modal; invitado → `/unirme`. Modo esperar → `/unirme`. Copy "Comprar" → "Bloquear precio".

### Verificación end-to-end (dinero test real)
- Grupo de test creado para poder probar sin colisionar con dedup: **`98d1bc92-6bf1-4fcc-90f0-8e22b000155c`** (TEST A3 1-Click, tiers 1→18 / 4→15, min_exec 1, max 20). **⚠️ LIMPIAR luego.**
- Benjamin pulsó "Bloquear precio" → modal 1-Click → confirmó SIN teclear nada.
- BD viva confirma: `group_member` creado, `payment_status=authorized`, hold **18 €**, PI asociado, `shipping="Rua do Ensino"` **traído del prefill** (no tecleado). 1-Click probado.
- ⚠️ Queda un **hold de test de 18 € abierto** en Stripe sobre ese grupo (modo test — se libera al cancelar o por Regla 6 al cierre).

---

## 2. Git
- Commits previos ya en GitHub: `663e671` (La Ola) + `3cbd904` (Fase A A1/A2).
- **A3 pendiente de commit** (comando entregado en chat; Benjamin lo corre):
  ```
  git add src/components/checkout/ src/app/api/checkout/lock/route.ts src/app/layout.tsx src/components/GroupLiveSection.tsx src/components/desktop/GroupCenterContent.tsx src/components/desktop/GroupDesktopView.tsx
  git commit -m "feat(checkout): Gate A3 1-Click - FastCheckoutModal ubicuo + triggers ficha + endpoint lock (hold silencioso con tarjeta guardada)"
  ```
  Confirmar si se hizo. `git push` opcional (despliega el 1-Click a producción; Stripe sigue en test).
- Claude NO ejecuta git (crea `.git/index.lock` que el Mac no puede borrar). Si reaparece: `rm -f /Users/benjamin/Desktop/kuorum/.git/index.lock`.

---

## 3. Próximos pasos
1. **Commit + (opcional) push de A3.**
2. **Fase C — Radar "precio bloqueado"** (frame 6): variante de la OpportunityCard + disparar el modal desde la tarjeta de Mi Radar (el `useCheckout` ya es ubicuo, solo falta el trigger + el estado verde tras compra).
3. **El Ticket dedicado** (frame 1 como `/ticket/[id]`): resguardo aislado inmutable, si aún se quiere (el modal ya cubre el flujo de bloqueo).
4. **Limpieza:** grupo de test `98d1bc92` + su hold de 18 €.
5. Backlog previo: unificar clientes Supabase browser; 404s (`/notificaciones`, `/mensajes`, etc.); `/perfil` y `/mis-grupos`; Stripe live cutover (bloqueado por alta empresa).

---

## 4. Entorno / notas
- `next dev` arranca en **:3000** (no 3001). Alinear `stripe listen` y Supabase Redirect URLs (`http://localhost:3000/**`) al mismo puerto.
- Prefill 1-Click depende de tener tarjeta guardada en el Customer (`cus_UrEUorVsAd1S7l`) — verificable en `GET /api/checkout/prefill` (logueado).
- Protocolo de potencia: Opus 4.6 por defecto; ⚡ Fable 5 / Opus 4.8 para compute_price, close_group/join_group, RLS y flujos de pago (create-intent, checkout/lock).
