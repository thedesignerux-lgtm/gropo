# CHECKLIST DE PRODUCCIÓN — Vonda

**Objetivo:** pasar Vonda de test a producción con pagos reales, sin romper nada ni exponer dinero.
**Cómo leer esto:** cada paso dice quién lo hace — **[TÚ]** (Benjamin, en un dashboard o terminal) o **[CLAUDE]** (yo, en el código). Sigue el orden. No saltes fases.

> ⚠️ **Regla de seguridad:** yo (Claude) **nunca** introduzco claves, contraseñas ni datos de pago. Esos pasos los haces tú en el dashboard correspondiente. Yo te digo exactamente dónde y qué.

**Datos del proyecto (referencia):**
- Repo local: `/Users/benjamin/Desktop/kuorum` · GitHub: `thedesignerux-lgtm/kuorum`
- Supabase project ID: `xpktkuozspreuxucnguh`
- Producción: `https://www.vonda.es` (SIEMPRE con `www`)
- Webhook Stripe producción: `https://www.vonda.es/api/stripe/webhook`

---

## FASE 0 — Pre-vuelo de la UI (lo que acabamos de tocar)

Esto NO es money-critical, pero conviene cerrarlo antes de desplegar.

- [ ] **[CLAUDE]** Verificar visualmente Mi Radar y Grupos Abiertos en el navegador (pendiente de que reconecte Chrome).
- [ ] **[TÚ]** En la terminal, comprobar que el proyecto compila para producción:
  ```
  cd /Users/benjamin/Desktop/kuorum
  npm run build
  ```
  Resultado esperado: termina con "Compiled successfully" y una tabla de rutas, **sin** líneas en rojo que digan "Failed to compile" o "Error". Si aparece un error, cópiamelo y lo arreglo.
- [ ] **[TÚ]** Confirmar que ya no quedan grupos de prueba visibles en la Home que no quieras enseñar a usuarios reales (ej. "TEST G4 Smoke").

---

## FASE 1 — Verificación de seguridad de la base de datos (money-critical)

Antes de tocar dinero real, confirmamos que las funciones críticas están blindadas.

- [ ] **[CLAUDE]** Verificar contra la BD viva que `close_group`, `confirm_join` y `prepare_join` solo puede ejecutarlas `service_role` (con `has_function_privilege`), y que no hay funciones duplicadas por sobrecarga.
- [ ] **[CLAUDE]** Revisar las políticas RLS de las tablas con datos sensibles (`bids`, `group_members`, `favorites`).
- [ ] **[TÚ]** Solo si te lo indico: ejecutar en el SQL Editor de Supabase el bloque exacto que te pase para re-blindar permisos. Nunca ejecutes SQL money-critical sin que te lo dé yo por escrito.

---

## FASE 2 — Ensayo 3: cierre con esperadores reales (BLOQUEANTE)

Es el pendiente crítico nº1 de tu `CLAUDE.md`. No se lanza sin esto en verde.

- [ ] **[CLAUDE]** Preparar el guion del ensayo: 1 grupo de test, compradores "ahora" + al menos 1 esperador con PMA, holds reales en Stripe (modo test), cierre manual, y verificación de capturas/liberaciones.
- [ ] **[TÚ]** Ejecutar en terminal/Stripe/Supabase los pasos que te dé, uno a uno.
- [ ] **[CLAUDE + TÚ]** Verificar las tres evidencias de siempre: capturas correctas por `guaranteed_price`/`target`, liberaciones por PMA, y estado final del grupo en la BD y en el dashboard de Stripe.

> Si el Ensayo 3 no sale perfecto, **paramos aquí**. Es el corazón del negocio.

---

## FASE 3 — Cutover de Stripe (test → live)

> ⚠️ A partir de aquí se mueve dinero real. Ve despacio.

### 3.1 Obtener las claves live
- [ ] **[TÚ]** Entra en `https://dashboard.stripe.com`. Arriba a la derecha, desactiva el interruptor **"Test mode"** (pasa a modo Live).
- [ ] **[TÚ]** Ve a **Developers → API keys**. Verás:
  - **Publishable key** que empieza por `pk_live_...`
  - **Secret key** que empieza por `sk_live_...` (pulsa "Reveal" para verla).
- [ ] **[TÚ]** Cópialas a un sitio seguro temporal (las pegarás en Vercel en el paso 3.3). **No me las pegues a mí por el chat.**

### 3.2 Crear el webhook de producción
- [ ] **[TÚ]** En Stripe (modo Live) ve a **Developers → Webhooks → Add endpoint**.
- [ ] **[TÚ]** En "Endpoint URL" pega exactamente: `https://www.vonda.es/api/stripe/webhook`
- [ ] **[TÚ]** En "Select events" añade como mínimo: `payment_intent.amount_capturable_updated` (es el evento que dispara `confirm_join`). Añade también `payment_intent.canceled` y `payment_intent.payment_failed` si te lo confirmo.
- [ ] **[TÚ]** Pulsa **Add endpoint**. Luego abre el endpoint recién creado y copia el **Signing secret** (empieza por `whsec_...`).

### 3.3 Poner las claves en Vercel
- [ ] **[TÚ]** Entra en `https://vercel.com` → proyecto de Vonda → **Settings → Environment Variables**.
- [ ] **[TÚ]** Localiza las variables de Stripe (probablemente `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` — te confirmo los nombres exactos leyendo el código antes de este paso).
- [ ] **[CLAUDE]** Leer `.env.local` y el código para darte los **nombres exactos** de las variables que hay que cambiar.
- [ ] **[TÚ]** Para cada una: edita el valor, pega la clave `..._live...` / `whsec_...`, y marca el entorno **Production**. Guarda.
- [ ] **[TÚ]** Redeploy: **Deployments → (último) → ⋯ → Redeploy** (para que tome las nuevas variables).

### 3.4 Prueba controlada en vivo
- [ ] **[TÚ]** Con una tarjeta real tuya y un importe mínimo, haz un "asegurar precio" completo en `https://www.vonda.es` y verifica en el dashboard de Stripe (Live) que aparece el hold.
- [ ] **[TÚ]** Cancela/libera ese hold desde Stripe para no cobrarte. Confírmame el resultado.

---

## FASE 4 — Rotación de claves de Sendcloud (BLOQUEANTE de seguridad)

Las claves actuales se expusieron durante el desarrollo → hay que rotarlas.

- [ ] **[TÚ]** Entra en `https://panel.sendcloud.sc` → **Settings → Integrations → API** (o "API keys").
- [ ] **[TÚ]** Genera un par de claves nuevo (Public + Secret). Guarda el antiguo por si acaso.
- [ ] **[CLAUDE]** Darte el nombre exacto de las variables de Sendcloud en Vercel.
- [ ] **[TÚ]** Actualiza esas variables en Vercel (Production) con las nuevas claves y **redeploy**.
- [ ] **[TÚ]** Elimina/desactiva las claves antiguas en Sendcloud.
- [ ] **[TÚ]** Prueba una etiqueta de envío real (correos_express:paq24). Recuerda: Sendcloud devuelve errores con HTTP 200 → hay que mirar `data.errors[]`. Esta llamada la haces tú desde tu terminal (mi sandbox no alcanza `panel.sendcloud.sc`).

---

## FASE 5 — Email transaccional (Resend)

- [ ] **[TÚ]** En `https://resend.com` confirma que el dominio `vonda.es` está **verificado** (DNS: SPF/DKIM en verde).
- [ ] **[CLAUDE]** Confirmar en el código que el remitente usa el dominio verificado y no un `onboarding@resend.dev` de prueba.
- [ ] **[TÚ]** Envía un email de prueba (ej. confirmación de unión) y verifica que llega y no cae en spam.

---

## FASE 6 — Limpieza pre-lanzamiento

- [ ] **[CLAUDE]** Retirar/mockear datos de prueba (`getActivationState`, `getMilestones`, avatares hardcoded, `mock-data.ts` sin uso) — pendiente menor de tu `CLAUDE.md`.
- [ ] **[CLAUDE]** Aplicar el fix de DST para `closes_at` (20:00 UTC = 22:00 CEST en verano pero 21:00 CET en invierno) para que el cierre dominical caiga siempre a las 22:00 Europe/Madrid.
- [ ] **[TÚ]** Borrar los grupos de test de la BD de producción (te doy el SQL exacto y te aviso de que es irreversible antes de ejecutarlo).
- [ ] **[TÚ]** Conseguir el primer vendedor real con sus tramos confirmados y crear su grupo.

---

## FASE 7 — Despliegue y smoke test final

- [ ] **[TÚ]** Desde tu terminal, subir el código a GitHub (tú controlas git; yo no toco `.git/`):
  ```
  cd /Users/benjamin/Desktop/kuorum
  git add -A
  git commit -m "Rediseño Mi Radar + cards Home + cutover producción"
  git push
  ```
- [ ] **[TÚ]** Vercel desplegará solo. Comprueba en **Deployments** que el build de Production termina en verde.
- [ ] **[TÚ]** Smoke test en `https://www.vonda.es`: cargar Home, Mi Radar, entrar en un grupo, iniciar (y cancelar) un asegurar-precio. Todo con `www`.
- [ ] **[CLAUDE + TÚ]** Revisar el cron de cierre dominical (`0 20 * * 0` UTC) y confirmar que apunta a la función correcta.

---

## Plan de reversión (si algo sale mal en vivo)

- **UI rota:** en Vercel → Deployments → busca el despliegue anterior estable → **⋯ → Promote to Production** (rollback inmediato).
- **Stripe da problemas:** vuelve a poner las variables en modo test en Vercel y redeploy; ningún hold nuevo se crea con claves test.
- **Emails/envíos fallan:** no bloquean el pago; se pueden reintentar. Prioriza que el flujo de dinero esté sano.

---

## Estado actual (resumen honesto)

| Bloque | Estado |
|---|---|
| UI Mi Radar + cards Home | Código en verde (typecheck), **falta verificación visual** y `npm run build` |
| Seguridad BD (RLS, permisos) | Por re-verificar contra BD viva |
| Ensayo 3 (esperadores) | **Pendiente — bloqueante** |
| Stripe live | Pendiente |
| Sendcloud (rotación claves) | **Pendiente — bloqueante seguridad** |
| Resend dominio | Por confirmar |
| Limpieza (mock, DST, grupos test) | Pendiente |

**Conclusión:** la UI puede desplegarse pronto (bajo riesgo). **Abrir pagos reales NO** hasta cerrar los tres bloqueantes: Ensayo 3, rotación de Sendcloud y cutover de Stripe verificado.
