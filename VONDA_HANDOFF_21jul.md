# VONDA — Handoff sesión 21 jul (galería DEMO + bugs display + next_price v2)

**Fecha:** martes 21 julio 2026 · **Modelo:** Fable 5 · **Ámbito:** datos DEMO, bugs de display, limpieza de holds, `compute_price` (solo `next_price`).

---

## ⚠️ LO PRIMERO AL ABRIR LA PRÓXIMA SESIÓN

**El commit de esta sesión NO está hecho.** Comando al final del documento. Verificar con `git status` antes de nada: si sale limpio, Benjamin ya lo ejecutó.

---

## Resumen de la sesión

1. **Verificado el email "ya sois suficientes"**: llegó a Benjamin. Salió el 20 jul 09:50 UTC por el camino inmediato del `POST /api/pulse/pledge` (no por el cron — el handoff del 20 esperaba el cron, pero el tramo ya era alcanzable al crear el pledge). El dedup atómico funcionó: el cron del 21 no reenvió nada.
2. **Fix bug hidratación** (ficha desktop): `GroupDesktopView` envolvía `<FavoriteButton>` en otro `<button>` → HTML inválido. `FavoriteButton` acepta ahora prop `label`; el envoltorio desaparece. Bonus: clicar "Guardar" ya activa el favorito.
3. **Fix "Precio bloqueado 0 €"** en Mi Radar: la query de `/favoritos` no pedía `current_price`/`final_price` → grupos cerrados caían a `Number(undefined ?? 0)` = 0 €, "Ahorras" inflado al PVP. Añadidos ambos campos; en cerrados manda `final_price` (precio de liquidación). Afectaba a TODOS los grupos cerrados de TODOS los usuarios.
4. **Fix CTA "Bloquear precio" sin ancla** (PulseZone): llevaba a `/grupo/[id]` (la ficha) en vez de a `/unirme`. Ahora va a `/grupo/[id]/unirme` con `qty` si >1. Verificada por Benjamin en local — **funcionó hasta el final: creó un hold real** (ver punto 6).
5. **`groups.is_demo`** (migración `add_is_demo_to_groups`) + filtro `eq('is_demo', false)` en home (`src/app/page.tsx`) y sugerencias del Radar (`src/app/favoritos/page.tsx`). Grupos demo accesibles por URL directa y en el admin.
6. **Galería de 10 grupos DEMO** en producción (ver sección en `CLAUDE.md` "Datos DEMO activos"): `d0d0d0d0-0000-4000-8000-0000000000{01..10}`, cada uno un caso de uso Radar/Pulse. Salvaguardas verificadas: `fireable=false` en todo `pulse_state`, `closes_at` 31 dic, pledges pre-marcadas (no emails a @vonda.test). Benjamin tiene favorito en los 10 + anclas en 03/04/05. El hold real que creó probando la CTA (160 € en DEMO 04) se canceló en Stripe (`requested_by_customer`) y la fila pasó a `released`; DEMO 04 restaurado a su estado diseñado (180 €, canAccept vía Radar).
7. **Limpieza de holds huérfanos**: los 4 miembros `instructed` sobre grupos cerrados verificados UNO A UNO contra la API de Stripe (los 4 `canceled`, capturable 0, recibido 0) → cerrados a `released`. Borrados también: grupos `DEMO · Casco Aero` y `DEMO · Zapatillas Carbon` (miembros 100% sintéticos `pi_demo_*`), 3 miembros sintéticos del `DEMO · GPS` (el grupo se queda, tenía un hold real ya resuelto) y el grupo `aaaaaaaa` del 20 jul (su closes_at era el 26: el cron lo habría cerrado). **Ya no hay NINGUNA fila en limbo**: todo group_members no-demo está en `paid` (29) o `released` (8).
8. **⚡ `compute_price` next_price v2** (gates completos, ver abajo).
9. **Acceso nuevo de Claude a Stripe** (MCP, solo lectura práctica): cuenta `Vonda sandbox`, modo test. Regla añadida a `CLAUDE.md` §7: verificar PaymentIntents contra Stripe ANTES de tocar `payment_status`; escrituras siguen requiriendo confirmación de Benjamin (el MCP además no expone cancelaciones — se hacen por curl desde el terminal de Benjamin).

## ⚡ next_price v2 — detalle (money-critical, cerrado en verde)

- **Antes:** `MIN(price) WHERE base_demand + 1 >= min_units` ("precio con una unidad más") → el SIGUIENTE de la ficha solo difería del actual cuando faltaba exactamente 1 ud.
- **Ahora:** `MAX(price) FROM tiers WHERE price < precio_vigente` (siguiente salto REAL de la escalera fusionada), **NULL** si el mejor precio ya está desbloqueado (decisión de Benjamin).
- `best_price` y `best_bid_id` **intactos** — regresión contra baseline de los 10 grupos DEMO: idénticos.
- `CREATE OR REPLACE` con la misma firma `(uuid,integer,numeric)` → permisos conservados. Verificado post-cambio: 1 overload, anon/auth/service_role = true.
- Migración: `compute_price_next_price_v2`. `groups.next_price` refrescado en todos los abiertos.
- `close_group` no usa `next_price` → cero impacto en adjudicación.

## Verificación hecha

- `npx tsc --noEmit` + eslint limpios en todos los archivos tocados (solo warnings preexistentes de `<img>`).
- Benjamin verificó en local: error de hidratación desaparecido, CTA "Bloquear precio" llega a `/unirme` y completa el flujo (hold real creado y luego cancelado), email del Pulse recibido con buen diseño.
- BD viva: pulse_state de los 10 DEMO (fireable=false en 33 filas), permisos compute_price, estados de group_members.
- Stripe: 5 PaymentIntents verificados por API (4 huérfanos + el de la prueba de Benjamin).

## NO verificado (pendiente de Benjamin)

- Card canAccept del DEMO 04 (móvil + desktop) — la CTA "Ya sois suficientes → Aceptar 160 €".
- Puertas de acceso AuthPanel en `/mis-grupos` y `/perfil`; cerrar sesión → re-entrar con Google. (El fallo de login Google en local era la Redirect URL de Supabase sin comodín `?next=`; Benjamin la arregló en el dashboard pero el ciclo completo logout→login no se ha probado.)
- Fichas DEMO 07 y 09 con `next_price` NULL llegando de BD por primera vez (favoritos muestra celebración, ficha cae al precio actual — debería, pero verlo).

## Próxima sesión

1. `git status` → si hay cambios sin commitear, ejecutar el commit de abajo.
2. Verificación visual en producción tras el deploy (la home estará VACÍA: no hay grupos abiertos no-demo — es esperado, no un bug).
3. Los tres puntos "NO verificado" de arriba.
4. Copy de compartir: ShareButton/HeroShareButton/GroupSidebar dicen "Si entra 1 más baja a X€" — con next_price v2 pueden faltar N uds. Cambiar a "El grupo puede bajar a X€" o similar. Display puro.
5. Pendientes críticos de siempre: cutover Stripe live, SMTP custom Resend, rotación claves Sendcloud, **vendedor real** (sin él la home seguirá vacía), unificación de identidad (⚡ sesión propia).
6. Los grupos DEMO no caducan (31 dic) — borrarlos cuando dejen de ser útiles con el SQL de `CLAUDE.md` § Datos DEMO.

## Commit pendiente (ACCIÓN DEL USUARIO)

```
cd ~/Desktop/kuorum
git add CLAUDE.md VONDA_HANDOFF_21jul.md src/app/page.tsx src/app/favoritos/page.tsx src/components/FavoriteButton.tsx src/components/desktop/GroupDesktopView.tsx src/components/PulseZone.tsx
git commit -m "Fix boton anidado ficha desktop + precio bloqueado 0 EUR en Mi Radar + CTA Bloquear precio sin ancla + groups.is_demo con filtro en listados"
git push origin main
```

(Las migraciones `add_is_demo_to_groups` y `compute_price_next_price_v2` ya están aplicadas en Supabase; no viajan en el commit.)
