# VONDA — Handoff sesión 20 jul (Pulse notify + canAccept + AuthPanel)

**Fecha:** 20 julio 2026 · **Modelo:** Fable 5 · **Ámbito:** Pulse (emails), PulseZone, auth de cliente. Sin cambios en funciones money-critical SQL.

---

## Resumen de la sesión

1. **Aviso "ya sois suficientes"** (email a watchers del Radar) — revisado, corregido y terminado.
2. **PulseZone estado canAccept** — simplificado a una sola CTA con leyenda explicativa.
3. **AuthPanel** — login Google + magic link reutilizable; puertas de acceso en Mis grupos y Mi perfil.
4. **Grupo DEMO** creado en BD de producción para ver canAccept en local (borrar antes del dom 26).
5. `CLAUDE.md` actualizado (incluye cierre del handoff ⚠️ del lock: ya estaba resuelto en commits 450c777–dc14180 de la madrugada; el handoff era anterior a esos commits).

**TODO SIN COMMITEAR.** Comando al final.

---

## 1. pulse-notify (aviso por email)

**Archivos:** `src/lib/pulse-notify.ts` (nuevo) · `src/lib/emails/pulseReachable.ts` (nuevo) · enganches en webhook Stripe, `POST /api/pulse/pledge` y cron pulse.

Lógica: cuando un tramo pasa a alcanzable (`committed + accepted + watching >= min_units`, con recorte `price < mejor desbloqueado` — mismo criterio que `/api/group/[id]/pulse`), se envía email a cada pledge `watching` de ese tramo. Dedup atómico por `reachable_notified_price` (re-anclar a otro tramo re-habilita el aviso; mismo tramo jamás dos veces).

**Correcciones de esta sesión sobre el borrador previo:**
- **Claim después de resolver email** — antes un pledge sin email quedaba reclamado como "avisado" sin haberse enviado nada (irrecuperable). Ahora queda pendiente y el cron reintenta.
- **Paralelización** — resolución de emails (`auth.admin.getUserById`) y envíos Resend en `Promise.all`/`allSettled`. Corre dentro del POST del pledge, así que la latencia ya no crece con N watchers. Se mantiene el `await` (en Vercel una promesa suelta puede morir al responder).
- **Recorte de relevancia** — faltaba `price < currentMin`: sin él se podía avisar "bloquea a 20 €" con el grupo ya en 18 €.

Si el envío falla → se revierte el claim (best-effort) → red de seguridad del cron diario (~08:30 UTC).

## 2. PulseZone canAccept

- **Una sola CTA**: "Ya sois suficientes → Aceptar X". Eliminada la secundaria "Asegurar precio" (también del camino no-boxed; llevaba al precio vigente, no al anclado).
- **Slider oculto** en canAccept: el precio ya está elegido. Consecuencia asumida: no se puede re-anclar desde la card en este estado (decisión de producto validada por Benjamin).
- **Sin micro-interacción de candado** aquí: metía 1.8s de espera antes del modal y el "✓ Precio bloqueado" era falso (aún no hay tarjeta). Abre el modal directo.
- **Leyenda morada con proceso completo**: hoy 0 € → retención si se activa → cobro al cierre dominical. Coherente con el email.

Cadena de dinero completa (para copy futuro): SetupIntent 0 € (aceptar) → hold `capture_method: manual` (disparo pulse) → captura (close_group domingo). El email y la leyenda ya lo cuentan bien; revisar que el PulseAcceptModal también.

## 3. AuthPanel + puertas de acceso

- **`src/components/AuthPanel.tsx`** (nuevo): Google OAuth + magic link, props `title/subtitle/ctaLabel/icon/next/sentNote`. Única fuente de lógica auth de cliente. `/auth/callback` ya soportaba `?next=`.
- **`RadarAuthSheet.tsx`**: reescrito como envoltorio (portal + hoja) de AuthPanel. Sin lógica propia.
- **Mis grupos** (`src/app/mis-grupos/page.tsx`): sin sesión Supabase → AuthPanel a página completa. Con sesión: el email sale de la sesión (mostrado en gris, no editable), solo se pide teléfono la primera vez. `formEmail` eliminado.
- **Mi perfil** (`src/app/perfil/page.tsx`): sin sesión → AuthPanel. **"Cerrar sesión" ahora hace `auth.signOut()` real** (bug: antes solo borraba localStorage → imposible re-entrar). Email de sesión pisa el de localStorage.
- Detalle: se perdió el `autoFocus` del campo email en la hoja del Radar (decisión: evitaba abrir el teclado móvil de golpe; recuperable si Benjamin lo quiere).

**PENDIENTE ESTRUCTURAL (sesión propia, ⚡ Fable 5 + gates):** unificación real de identidad. `group_members` sigue sin vincular a `auth.users`; `get_my_groups`/`get_profile`/`address_*` van por teléfono+email (SECURITY DEFINER). El teléfono sigue siendo credencial adivinable. Plan: columna `auth_id` + backfill por email + reescritura de RPCs con `auth.uid()` + revisión RLS.

## 4. Grupo DEMO en producción (BORRAR antes del dom 26)

`aaaaaaaa-1111-4111-8111-111111111111` (`DEMO · Radar canAccept`): abierto, tramos 30 @1 / 28 @6 / 25 @12, **sin miembros ni holds** (riesgo económico nulo, visible en www.vonda.es). 12 uds watching a 25 € → `reachable=true` verificado contra `pulse_state` en BD viva. Benjamin (thedesignerux@gmail.com) tiene favorito + pledge sin pre-marcar → **recibirá el email real del cron ~08:30 UTC del 21** (verificar bandeja + diseño). Los 8 `demo_pulse_*` están pre-marcados (sus @vonda.test rebotarían en Resend).

SQL de borrado en `CLAUDE.md` → sección "Datos DEMO activos".

---

## Verificación hecha

- `npx tsc --noEmit` + `npx eslint` limpios sobre todos los archivos tocados.
- `pulse_state` del grupo DEMO consultado en BD viva: 25 € → watching 12/12, reachable=true; 28/30 € → false (correcto: anclas a 25 no cuentan para tramos caros).
- Columnas `reachable_notified_*` verificadas en `pulse_pledges`.
- NO probado: envío real del email (llegará solo con el cron del 21) · flujo visual canAccept en local (Benjamin tenía pendiente `npm run dev`) · login Google/email en las puertas nuevas.

## Próxima sesión

1. Revisar email del cron en la bandeja de Benjamin (diseño + copy).
2. Probar en local: card canAccept (móvil + desktop), puertas de acceso de Mis grupos y Perfil, cerrar sesión → re-entrar con Google.
3. Commit + push (comando abajo) y verificación visual en producción.
4. Borrar grupo DEMO antes del dom 26.
5. Valorar: explicación del proceso también en PulseAcceptModal · enlace "volver al grupo" bajo la CTA canAccept (salida al no poder re-anclar).
6. Pendientes críticos de siempre: cutover Stripe live, SMTP custom Resend en Supabase Auth, rotación claves Sendcloud, vendedor real.

## Commit pendiente (ACCIÓN DEL USUARIO)

```
cd ~/Desktop/kuorum
git add src/lib/pulse-notify.ts src/lib/emails/pulseReachable.ts src/app/api/cron/pulse/route.ts src/app/api/pulse/pledge/route.ts src/app/api/stripe/webhook/route.ts src/components/PulseZone.tsx src/components/AuthPanel.tsx src/components/RadarAuthSheet.tsx src/app/mis-grupos/page.tsx src/app/perfil/page.tsx CLAUDE.md VONDA_HANDOFF_20jul.md
git commit -m "Pulse: aviso 'ya sois suficientes' + canAccept con CTA unica + AuthPanel (login Google/email en Mis grupos y Perfil)"
git push origin main
```
