# HANDOFF — 13 jul 2026 · Ensayo Pulse E2E + Ensayo 3 (ambos VERDES)

**Sesión con Fable 5.** Los dos money-critical pendientes quedaron validados con holds reales de Stripe test. Próximas sesiones: Opus 4.6 salvo cutover Stripe live o retoques a compute_price / close_group / confirm_join / RLS.

---

## 1. Ensayo E2E Vonda Pulse — VERDE 🟢

Grupo `ENSAYO_PULSE` (tramos 20/15/12, min_execution 1, max_stock 100), 5 cuentas reales, borrado al final. Verificado contra BD y dashboard Stripe:

- **Camino feliz:** pledge → aceptar (SetupIntent 0 €, sin PI) → masa → PI off-session → webhook → confirm_join → miembro esperador `authorized` → precio 20→15 para todos.
- **Estado `accepted` en reposo:** tarjeta guardada, CERO PaymentIntent hasta la masa. ✔
- **Disparo multi-usuario:** dos pledges convertidos en el mismo ciclo (`triggered_at` idéntico, advisory lock). ✔
- **Fallo de tarjeta aislado (4000...0341):** pledge `failed` con PI rechazado registrado, SIN miembro creado, resto intacto. ✔
- **Masa no consolidada:** 10 comprometidos pero 9 reales tras el fallo → el precio NO bajó a 12 (se quedó en 15). La promesa "si la masa falla, nadie paga de más" funciona. ✔
- **`pulse_pledge_cancel`:** probado 3 veces, incluso desde `accepted`. ✔
- **Guard miembro-no-puja:** bloqueó correctamente a un miembro vivo ("Ya participas en este grupo"). ✔

## 2. Ensayo 3 — cierre con esperadores — VERDE 🟢

Grupo `ENSAYO_F3_esperadores` (100/80×3/60×5, min_execution 3), cierre manual desde admin en producción. Resultado idéntico a la predicción escrita ANTES de cerrar:

- Final **80 €** (demanda efectiva 3 ≥ 3).
- A (comprar, hold 100) → **captura parcial 80**. B y C (esperar 80, hold 80) → captura completa 80. D (esperar 60, hold 60) → **released, 0 €**.
- Grupo `closed`, `final_price 80.00`. Grupo borrado tras el ensayo.

## 3. Fixes de código de hoy (compilan, tsc verde — PENDIENTE COMMIT)

| Archivo | Fix |
|---|---|
| `src/components/RadarAuthSheet.tsx` | **Portal a body** + stopPropagation. Antes: `fixed` dentro de la tarjeta con `hover:-translate-y-0.5` → la hoja "bailaba" con el ratón y los clicks caían en el Link de la ficha (afectaba a todos los navegadores). + Botón **"Continuar con Google"**. |
| `src/app/login/page.tsx` | Botón **"Continuar con Google"** (signInWithOAuth, PKCE, callback existente). |
| `src/components/PulseZone.tsx` | **Stepper de cantidad visible en todo estado `watching`**. Antes `!canAccept` lo ocultaba si el tramo ya era alcanzable → imposible elegir >1 unidad. |

## 4. Google OAuth — FUNCIONANDO

- Google Cloud: proyecto Vonda, OAuth client "Vonda web". Origins: `http://localhost:3000` y `https://www.vonda.es`. Redirect URI: `https://xpktkuozspreuxucnguh.supabase.co/auth/v1/callback`.
- Supabase: provider Google activado con Client ID/Secret. Verificado E2E en localhost durante el ensayo.
- Lección: los enlaces de `admin/generate_link` NO sirven con el flujo PKCE de la app (redirigen a Site URL con tokens en fragmento que el callback `?code=` no consume).

## 5. Incidencia importante — SMTP de Supabase Auth

El SMTP integrado de Supabase limitó los magic links (`429 email rate limit exceeded`, ~2-4/hora PARA TODA LA APP). **Bloqueante de lanzamiento** para el login por email en producción.
→ Solución definida: **Custom SMTP con Resend** (smtp.resend.com:465, user `resend`, pass = API key, sender `acceso@vonda.es`) + subir rate limit a 100/h en Auth → Rate Limits. **CONFIRMAR si quedó configurado** (Google OAuth lo mitigó durante la sesión, pero el email sigue siendo el fallback).

## 6. Bugs/UX detectados (pendientes)

1. **ALTA (display, pre-lanzamiento):** al unirse como esperador con target 60 €, el flujo mostró retención de 80 € (el hold real fue 60 € — dinero correcto). La tabla de miembros del admin también muestra `guaranteed_price` (80) en vez del target/hold del esperador. Revisar aviso de retención en `JoinFlow` + columna Precio/Total del admin.
2. Quitar favorito no cancela el pledge del Pulse; al re-añadir reaparece el estado anterior. Decisión de producto pendiente.
3. V1.1: selector de cantidad también dentro de `PulseAcceptModal`.
4. `next_price` semántica: es "precio si entra UNA unidad más" (no "siguiente tramo") — intencional, documentado para no re-investigarlo.

## 7. Limpieza hecha / pendiente

**Hecho hoy:** ENSAYO_PULSE viejo + nuevo borrados (PIs cancelados primero) · ENSAYO_F3 borrado tras cierre verde · holds sueltos cancelados (28 € DEMO GPS, 18 € TEST A3).
**Pendiente (antes del domingo 19):** grupos DEMO (3, con miembros/PIs ficticios `pi_demo_*` — útiles para la pasada copy/UX del Pulse) · usuarios `demo_pulse_*@vonda.test` y favoritos/pledges · históricos `ENSAYO_F1`/`F2` cerrados · restos `instructed` del 28 jun (Cubierta Continental, holds ya expirados) · grupo TEST A3/G4 si queda.

## 8. Deploy a producción — ⚠️ ABIERTO, verificar lo primero en la próxima sesión

- Commits de hoy **pusheados** (75d1883 + ajuste de crons). PERO producción seguía sirviendo la versión vieja al cerrar la sesión.
- Causa raíz encontrada: `vercel.json` pedía crons por encima del plan **Hobby** (cierre 2×domingo + pulse cada 10 min) → **Vercel rechazaba el deploy entero**. Por eso ni `fba1fbe` (DST, 12 jul) ni `dac9ba1` (Pulse) llegaron nunca a producción — el último deploy real era `950b362`.
- Fix aplicado y pusheado: crons a límites Hobby → cierre `0 21 * * 0` (22:00 Madrid invierno / 23:00 verano, NUNCA antes de las 22:00) y pulse respaldo `30 8 * * *`. **Si se pasa a Pro: restaurar `0 20,21 * * 0` y `*/10`.**
- **VERIFICAR:** Vercel → Deployments → último deploy en Ready (será el PRIMER build de Vercel con el código Pulse — si Error, leer log) → `www.vonda.es/login` debe mostrar "Continuar con Google" → probar login Google en producción.
- Truco diagnóstico: el filtro "Status 6/7" de Deployments ocultaba los deploys en Error.

## 9. Pendiente crítico global

Verificar deploy (§8) · Cutover Stripe test→live · rotación claves Sendcloud · vendedor real con tramos confirmados · confirmar Custom SMTP Resend en Supabase Auth (§5) · limpieza test en producción (§7).
