# ENSAYO PULSE — Runbook E2E (Stripe test)

**Objetivo:** verificar el ciclo completo del Vonda Pulse con holds reales de Stripe test:
esperar en un precio → aceptar (tarjeta guardada, 0 €) → masa crítica → retención automática
→ miembro creado como esperador → precio baja para todos.

**Cuándo:** antes del lanzamiento (~26 jul). Duración estimada: 30–40 min.

---

## Preparación (ACCIÓN DEL USUARIO)

1. Abre Terminal y arranca el proyecto:
   ```
   cd ~/Desktop/kuorum
   npm run dev
   ```
   Deberías ver `Ready` y la URL `http://localhost:3000`.

2. En OTRA pestaña de Terminal, arranca el reenvío de webhooks:
   ```
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Deberías ver `Ready! You are using Stripe API Version...` y un `whsec_...`.
   ⚠️ Si el `whsec_` que muestra NO coincide con `STRIPE_WEBHOOK_SECRET` de tu `.env.local`,
   cópialo y actualiza la variable, luego reinicia `npm run dev`.

3. Pide a Claude que cree el grupo de ensayo `ENSAYO_PULSE` en la BD con estos tramos:
   `1 ud → 20 €, 5 uds → 15 €, 10 uds → 12 €`, min_execution 1, max_stock 100.
   (ACCIÓN DE CLAUDE: insert de grupo + puja activa, igual que en los ensayos F1/F2.)

## Ensayo (ACCIÓN DEL USUARIO, con Claude verificando cada paso en BD/Stripe)

4. Entra en `http://localhost:3000` con tu sesión (magic link).
5. Marca el grupo ENSAYO_PULSE como favorito (corazón) → ve a **Mi Radar**.
6. En la tarjeta: pulsa **"Esperar en un precio"** → elige **15 €** → cantidad **2**.
   ✔ Verás el chip naranja "Esperando en 15 €". Claude verifica: pledge `watching` en BD.
7. Con una SEGUNDA cuenta (otro navegador/incógnito + otro email de magic link),
   repite los pasos 5–6 con cantidad **3** y el mismo precio 15 €.
   ✔ La onda naranja del nodo de 15 € debe latir más fuerte (intensidad 2).
8. Cuenta 2: pulsa **"Hay grupo suficiente → Aceptar 15 €"**... 
   ⚠️ Todavía NO aparecerá: la masa (2+3=5) ya alcanza el tier, así que SÍ debe aparecer
   el botón morado en ambas cuentas. Acepta primero con la cuenta 2:
   rellena datos + tarjeta test `4242 4242 4242 4242` (cualquier fecha futura, CVC 123).
   ✔ Modal "Compromiso activado". Claude verifica: pledge `accepted` con payment_method.
   ✔ NO debe existir ningún PaymentIntent aún (0 € — solo SetupIntent).
9. Cuenta 1: acepta también (misma tarjeta test).
   ✔ Al completar, la masa se alcanza → disparo automático:
   - Claude verifica: ambos pledges `converted`, con `stripe_payment_intent_id`.
   - Stripe Dashboard → Payments: DOS PaymentIntents `requires_capture`
     (30 € y 45 € — tier 15 € × cantidades).
   - BD: dos `group_members` nuevos con `join_mode='esperar'`, `target_price=15`,
     `payment_status='authorized'`.
   - El precio del grupo baja a 15 € en la ficha para todos (Realtime).
   - En **Mis Grupos** de ambas cuentas aparece el producto.

## Prueba de fallo de tarjeta (opcional pero recomendada)

10. Repite con un tercer usuario usando la tarjeta `4000 0000 0000 0341`
    (falla al cobrar off-session): el pledge debe quedar `failed` y el resto intacto.

## Cierre del ensayo

11. Pide a Claude el borrado limpio: cancelar los PaymentIntents de test en Stripe
    (libera los holds) y eliminar el grupo ENSAYO_PULSE + pledges + members de test.
    ⚠️ Nunca borrar el grupo con holds vivos sin cancelarlos antes.

## Evidencias (las tres de siempre)

- [ ] Stripe Dashboard: holds creados solo tras la masa, importes correctos.
- [ ] BD: pledges `converted`, members `authorized` como esperadores target=15.
- [ ] UI: onda naranja → impulso morado → precio bajado + producto en Mis Grupos.
