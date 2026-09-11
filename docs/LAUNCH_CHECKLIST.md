# LAUNCH_CHECKLIST.md — Gropo

> **Procedimiento paso a paso para abrir pagos reales.** De modo test a modo live, sin romper
> nada ni exponer dinero.
>
> **Origen:** rescatado de `CHECKLIST_PRODUCCION.md` (11-jul-2026), rebrandeado a Gropo y
> actualizado el **11-sep-2026** con lo verificado ese día (webhook, `CRON_SECRET`, dominios).
>
> **Cómo leer esto:** cada paso dice quién lo hace — **[TÚ]** (Benjamin, en un panel o en la
> terminal) o **[CLAUDE]** (en el código o contra la base de datos). Sigue el orden. No saltes
> fases.

> ⚠️ **Regla de seguridad:** Claude **nunca** introduce claves, contraseñas ni datos de pago.
> Esos pasos los haces tú en el panel correspondiente. Claude te dice exactamente dónde y qué.
> **Nunca pegues el valor de una clave en el chat** — solo su prefijo (`sk_test_…`, `sk_live_…`).

**Datos del proyecto:**
- Repo local: `/Users/benjamin/Desktop/kuorum` · GitHub: `thedesignerux-lgtm/kuorum`
- Supabase project ID: `xpktkuozspreuxucnguh`
- **Producción: `https://www.gropo.es`** — SIEMPRE con `www`. El apex responde **308**, y Stripe
  **no sigue redirecciones** en los webhooks: un endpoint en el apex falla el 100 % de las
  entregas.
- `www.vonda.es` es un **alias del mismo proyecto de Vercel** (mismo código, mismas variables,
  misma base de datos). No es una aplicación distinta.

---

## ESTADO DE LOS BLOQUEANTES

| Bloqueante | Estado |
|---|---|
| **Ensayo con esperadores reales** (Gate G6 / "Ensayo 3") | 🔴 **PENDIENTE — bloqueante** |
| **Rotación de claves de Sendcloud** (expuestas en chat) | 🔴 **PENDIENTE — bloqueante de seguridad** |
| **Cutover de Stripe test → live** | 🔴 **PENDIENTE** |
| Vendedor real con tramos confirmados | 🔴 Pendiente |
| **Custom SMTP en Supabase Auth** | 🔴 Pendiente — el SMTP integrado limita a ~2-4 emails/h **para toda la app** |
| Webhook Stripe → Gropo | ✅ **Verificado 11-sep-2026** (ver `PAYMENTS.md` §12) |
| `CRON_SECRET` en Vercel | ✅ **Verificado 11-sep-2026** — el cierre automático está armado |
| Limpieza de datos de prueba en producción | 🟠 Parcial — grupo `TEST · Algoritmo precio` cancelado el 11-sep |

**Conclusión: NO abrir pagos reales** hasta cerrar los tres bloqueantes en rojo.

---

## FASE 0 — Pre-vuelo

- [ ] **[TÚ]** Comprobar que el proyecto compila para producción:
  ```
  cd /Users/benjamin/Desktop/kuorum
  npm run build
  ```
  Resultado esperado: *"Compiled successfully"* y una tabla de rutas, **sin** líneas en rojo. Si
  aparece un error, cópialo y se arregla antes de seguir.
- [ ] **[TÚ]** Confirmar que no quedan grupos de prueba visibles en la Home.
- [ ] **[CLAUDE]** Verificar visualmente las tres pantallas del smoke test: **home + ficha +
      unirme**. *(Lección del 7-jul: una revocación de permisos dejó el escaparate en blanco y
      solo se detectó mirando las tres.)*

---

## FASE 1 — Seguridad de la base de datos (money-critical)

- [ ] **[CLAUDE]** Verificar contra la BD viva que `close_group`, `confirm_join` y `prepare_join`
      solo puede ejecutarlas `service_role`, con `has_function_privilege`, y que **no hay
      sobrecargas duplicadas** en `pg_proc`.
- [ ] **[CLAUDE]** Revisar las políticas RLS de las tablas con datos sensibles (`bids`,
      `group_members`, `users`, `favorites`).
- [ ] **[TÚ]** Solo si Claude te lo indica: ejecutar en el SQL Editor de Supabase el bloque exacto
      que te pase para re-blindar permisos. **Nunca ejecutes SQL money-critical que no te haya
      dado por escrito.**

---

## FASE 2 — Ensayo con esperadores reales (BLOQUEANTE)

El gate G6 de la especificación multi-puja, que absorbe el antiguo "Ensayo 3". **No se lanza sin
esto en verde.**

- [ ] **[CLAUDE]** Preparar el guion: 1 grupo de test desechable, compradores "ahora" + al menos
      un esperador con PMA, holds reales en modo test, cierre manual desde el panel de admin, y
      verificación de capturas y liberaciones.
- [ ] **[TÚ]** Ejecutar los pasos, uno a uno.
- [ ] **[CLAUDE + TÚ]** Verificar las tres evidencias de siempre: capturas correctas por
      `guaranteed_price`/`target_price`, liberaciones por PMA, y estado final coherente en la BD
      **y** en el dashboard de Stripe.

> ⚠️ **Antes del ensayo, comprobar la edad de los holds.** Caducan a los **7 días** y la base de
> datos no se entera. El 5-jul-2026 tres de quince capturas fallaron por esto.
> ```sql
> SELECT join_order, created_at::date,
>        CASE WHEN now() - created_at > interval '7 days' THEN 'CADUCADO' ELSE 'vivo' END
> FROM group_members
> WHERE group_id = '<id>' AND payment_status IN ('authorized','instructed','paid')
> ORDER BY join_order;
> ```
> Existe red de seguridad —`captureGroupPayments` detecta el fallo, alerta al admin y dispara el
> flujo de pago manual por transferencia— pero un ensayo con holds muertos no demuestra nada.

> Si el ensayo no sale perfecto, **paramos aquí**. Es el corazón del negocio.

---

## FASE 3 — Cutover de Stripe (test → live)

> ⚠️ A partir de aquí se mueve dinero real. Ve despacio.

> 🔴 **Los endpoints de webhook de modo live son una lista SEPARADA de los de test.** Nada de lo
> verificado el 11-sep se hereda: el endpoint live es nuevo y tendrá **otro** `whsec_`.

### 3.1 · Obtener las claves live
- [ ] **[TÚ]** En `https://dashboard.stripe.com`, sal del entorno de pruebas (modo Live).
- [ ] **[TÚ]** **Developers → API keys**: copia la **Publishable key** (`pk_live_…`) y la
      **Secret key** (`sk_live_…`, pulsa "Reveal").
- [ ] **[TÚ]** Guárdalas en un sitio seguro temporal. **No las pegues en el chat.**

### 3.2 · Crear el webhook de producción
- [ ] **[TÚ]** En Stripe (modo Live) → **Developers → Webhooks → Add endpoint**.
- [ ] **[TÚ]** Endpoint URL, exactamente: `https://www.gropo.es/api/stripe/webhook`
- [ ] **[TÚ]** Eventos: **solo `payment_intent.amount_capturable_updated`**.
      *No añadas más.* El código ignora cualquier otro evento con un 200, así que suscribirlos
      solo crea la falsa impresión de que se están gestionando.
- [ ] **[TÚ]** Copia el **Signing secret** (`whsec_…`) del endpoint recién creado.

### 3.3 · Poner las claves en Vercel
- [ ] **[TÚ]** Vercel → proyecto → **Settings → Environment Variables**. Las variables son
      `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` y `STRIPE_WEBHOOK_SECRET`.
- [ ] **[TÚ]** Para cada una: edita el valor, pega la clave live, marca el entorno
      **Production** y guarda.
- [ ] **[TÚ]** **Redeploy** (Deployments → el último → ⋯ → Redeploy) para que tome las variables.

### 3.4 · Prueba controlada en vivo
- [ ] **[TÚ]** Con una tarjeta real tuya y un importe mínimo, completa un "asegurar precio" en
      `https://www.gropo.es` y verifica en Stripe (Live) que aparece el hold.
- [ ] **[CLAUDE]** Verificar en la BD que se creó la fila en `group_members` con el
      `stripe_payment_intent_id` correcto. *(Es la prueba definitiva: `confirm_join` no tiene
      ningún otro llamante.)*
- [ ] **[TÚ]** Cancela ese hold desde Stripe para no cobrarte.

---

## FASE 4 — Rotación de claves de Sendcloud (BLOQUEANTE de seguridad)

Las claves actuales se expusieron durante el desarrollo.

- [ ] **[TÚ]** `https://panel.sendcloud.sc` → **Settings → Integrations → API**. Genera un par
      nuevo (Public + Secret). Guarda el antiguo por si acaso.
- [ ] **[TÚ]** Actualiza `SENDCLOUD_PUBLIC_KEY` y `SENDCLOUD_SECRET_KEY` en Vercel (Production) y
      **redeploy**.
- [ ] **[TÚ]** Elimina o desactiva las claves antiguas en Sendcloud.
- [ ] **[TÚ]** Prueba una etiqueta de envío real (`correos_express:paq24`).
      ⚠️ **Sendcloud devuelve errores con HTTP 200** — hay que mirar `data.errors[]` en el cuerpo.
      Esta llamada la haces tú desde tu terminal: el sandbox de Claude no alcanza
      `panel.sendcloud.sc`.

---

## FASE 5 — Email transaccional

- [ ] **[TÚ]** En `https://resend.com`, confirma que el dominio **`gropo.es`** está verificado
      (SPF/DKIM en verde).
- [ ] **[CLAUDE]** Confirmar en el código que el remitente usa el dominio verificado.
      🔴 **Hoy los valores por defecto siguen apuntando a `vonda.es`** en `resend.ts`,
      `pulse-notify.ts`, el webhook y `shipping-sendcloud.ts`. Ver `TECHNICAL_DEBT.md`.
- [ ] **[TÚ]** Envía un email de prueba y verifica que llega y no cae en spam.
- [ ] **[TÚ]** **Supabase Auth → Custom SMTP.** El SMTP integrado limita a ~2-4 emails/h para
      toda la app: con eso, el login por email se rompe en cuanto haya tráfico real.

---

## FASE 6 — Limpieza pre-lanzamiento

- [ ] **[CLAUDE]** Retirar los datos simulados de la ficha (`getActivationState`, `getMilestones`,
      avatares hardcoded, `mock-data.ts` sin uso).
- [ ] **[CLAUDE]** Aplicar el fix de DST para `closes_at`: el cron está en `0 21 * * 0` UTC, que
      son las 23:00 en Madrid en verano pero las 22:00 en invierno.
- [ ] **[TÚ]** Borrar los grupos de test de la BD de producción. Claude te dará el SQL exacto y te
      avisará antes de que es irreversible.
      ⚠️ **Regla de oro: verificar los holds en Stripe ANTES de tocar nada en la BD.**
- [ ] **[TÚ]** Conseguir el primer vendedor real con sus tramos confirmados y crear su grupo.
      ⚠️ El cierre debe respetar la **ventana de 6,5 días** (ADR-06): un grupo no puede durar más
      que la caducidad del hold de su primer comprador.

---

## FASE 7 — Despliegue y smoke test final

- [ ] **[TÚ]** Subir el código a GitHub desde tu terminal (**el git lo llevas tú; Claude no toca
      `.git/`**):
  ```
  cd /Users/benjamin/Desktop/kuorum
  git add -A
  git commit -m "..."
  git push
  ```
- [ ] **[TÚ]** Vercel desplegará solo. Comprueba que el build de Production termina en verde.
- [ ] **[TÚ]** Smoke test en `https://www.gropo.es`: **home + ficha + unirme**, y un
      asegurar-precio que después cancelas. Todo con `www`.
- [ ] **[CLAUDE + TÚ]** Revisar que el cron dominical apunta a la función correcta y que
      `CRON_SECRET` sigue en su sitio.

---

## PLAN DE REVERSIÓN

| Qué falla | Qué hacer |
|---|---|
| **UI rota** | Vercel → Deployments → el anterior estable → ⋯ → **Promote to Production**. Rollback inmediato |
| **Stripe da problemas** | Vuelve a poner las variables en modo test en Vercel y redeploy. Ningún hold nuevo se crea con claves test |
| **Emails o envíos fallan** | No bloquean el pago; se pueden reintentar. Prioriza que el flujo de dinero esté sano |
| **Capturas fallidas por holds caducados** | El sistema alerta al admin y dispara el flujo de pago manual por transferencia (plazo 48 h). Precedente real: 5-jul-2026 |
