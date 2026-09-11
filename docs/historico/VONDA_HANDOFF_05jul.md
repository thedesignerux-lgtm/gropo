# VONDA — HANDOFF 05 julio 2026

**Sesión:** sábado 5 jul (Fable 5) · **Anterior:** VONDA_HANDOFF_04jul.md
**Lanzamiento:** domingo 12 julio · **Esta noche 22:00 Madrid:** cierre automático por cron (opción A elegida)

---

## 1. TITULAR: sprint de endurecimiento COMPLETADO

H1, H2, H3, H4, H6 y H7 — todos aplicados y verificados con evidencia en BD/web vivas.
Multi-puja sigue pausada en G2, sin cambios (VONDA_MULTIBID_G2_PAUSADO.md).

---

## 2. Hecho en esta sesión

### H3 — `create_petition` v3 (cerrado)
- El upsert por email ya NO pisa `phone`/`name` de un usuario existente: `ON CONFLICT (email) DO UPDATE SET phone = COALESCE(users.phone, EXCLUDED.phone), name = COALESCE(users.name, EXCLUDED.name)` (solo rellena huecos).
- Bonus: el anti-spam se refuerza (no se puede rotar el teléfono de un email existente).
- Misma firma → permisos intactos. Verificado: 1 sobrecarga, anon/auth/service EXECUTE, `search_path=public`.
- Prueba funcional: usuario de laboratorio + petición-ataque con mismo email y datos distintos → el usuario conservó sus datos. Laboratorio limpiado (0/0/0).

### H2 — `get_my_groups` exige teléfono + email (cerrado)
- **BD:** nueva firma `get_my_groups(p_phone text, p_email text)`; el JOIN exige que ambos pertenezcan al mismo usuario; email normalizado (lower/trim); ante par incorrecto o formato inválido devuelve lista vacía (sin oráculo de enumeración). Nació con `SECURITY DEFINER`, `search_path=public` y permisos explícitos.
- Batería SQL: par correcto → 1; par con espacios/mayúsculas → 1; email equivocado → 0; email inválido → 0.
- **Web (commit `819f997`):** `JoinFlow.tsx` guarda name/email/phone en localStorage al completar el join (antes de confirmPayment, sobrevive a 3DS). `mis-grupos/page.tsx`: auto-carga solo con teléfono+email guardados; formulario de dos campos como fallback (también si la RPC devuelve vacío); mensaje único "No encontramos pedidos con esos datos"; guarda identidad al acertar. Ambas llamadas RPC con `{p_phone, p_email}`.
- Verificado en producción desde navegador real (auto-carga mostró las compras F1/F2 de Benjamin).
- **Firma vieja `get_my_groups(text)` DROPeada.** Verificación final: 1 sola sobrecarga, permisos correctos. El agujero de "conozco un teléfono → veo sus pedidos" ya no existe.

### H6 — Rate limiting en `create-intent` (cerrado)
- **Diseño:** contador en Supabase (válido entre instancias serverless de Vercel; en-memoria descartado; firewall Vercel es de plan Pro y estamos en Hobby).
- **BD:** tabla `rate_limits(key, created_at)` con índice, RLS activado sin políticas; función `check_rate_limit(p_key, p_max, p_window_seconds)` SECURITY DEFINER, EXECUTE **solo service_role** (revocado explícitamente de anon/authenticated — ver lección L2). Probada: con máx 2 → true, true, false.
- **Web:** en `src/app/api/join/create-intent/route.ts`, al principio del handler (antes de body y de Stripe): clave `create-intent:{IP}` (primera IP de x-forwarded-for), límite **10 por IP / 10 minutos**, fail-open si el check falla (log `rate_limit_check_failed`), respuesta 429 con mensaje en castellano si se supera. Commit `feat(api): rate limiting por IP en create-intent (H6)`.
- Verificado en producción: bombardeo de 12 POST vacíos → 10×400 + 2×429. Contador limpiado después.

### CRON_SECRET — rotado y verificado por Benjamin
- Benjamin rotó el secreto en Vercel (las variables sensibles no se pueden re-ver, solo sustituir), redesplegó y probó el endpoint con Bearer: el cron respondió y ejecutó un cierre real de prueba (visto también en logs de API de Supabase). **El cierre de esta noche no está en riesgo.**
- Recordatorio permanente: cambiar una env var en Vercel NO afecta a lo desplegado — siempre Redeploy después (ver L3).

### Misterio "página vieja" — resuelto (no era producción)
- Síntoma: mis-grupos mostraba la versión antigua en Chrome y Safari pese al deploy Ready.
- Diagnóstico definitivo por curl: el chunk `page-6a43134acb761904.js` servido por `www.vonda.es` contiene "Dinos tu tel..." → **producción era correcta**; era caché local de los navegadores de Benjamin (ambos con la página cacheada de las pruebas). Se rompió con `?v=2` y recarga forzada.
- Los logs de API confirmaron además el comportamiento viejo desde sus navegadores (RPC 200 con lista vacía → vista 0/0 = código antiguo).
- El punto pendiente "stale build / Cloudflare" del handoff del 4 jul queda **cerrado: falsa alarma**.

---

## 3. ESTA NOCHE — cierre automático (domingo 5, 22:00 Madrid)

El cron cierra solo. Predicción exacta (foto tomada el 5 jul por la mañana):

| Grupo | Miembros | Unidades | Precio final esperado | Captura esperada |
|---|---|---|---|---|
| `342cceb5` GP5000 | 5 | 15 | 38.90 € | **583.50 €** |
| `68a3d73c` GP5000 | 5 | 15 | 38.90 € | **583.50 €** |
| `64455c3f` GP5000 | 5 | 31 | 38.90 € | **1 205.90 €** |
| "De riada en prueba" | 0 | — | — | Regla 6 → `cancelled` + email alerta |

- Escalera común 48.90/44.90/41.90/38.90 en 1/6/10/15; todos los esperadores con target ≥ 38.90 → todos califican; min_execution 6 cumplido; sin excedente (máx 50).
- **Total esperado en Stripe test: 2 372.90 €** en 15 capturas, incluidas **2 parciales**: hold 44.90 → captura 38.90; hold 167.60 → captura 155.60 (el resto lo libera Stripe).
- Este cierre hace de **Ensayo 3 de facto**: si la auditoría cuadra, el pre-vuelo de cierre queda esencialmente cubierto.

## 4. LUNES — checklist de auditoría ("Continual")

1. Los 3 grupos GP5000 en `closed` con `final_price = 38.90`; "De riada" en `cancelled`.
2. Los 15 miembros en `paid` con `captured_amount = quantity × 38.90` (cuadrar contra la tabla).
3. Stripe test dashboard: 15 capturas, incluidas las 2 parciales con los importes de arriba.
4. Emails de cierre enviados + email de alerta de la petición cancelada (Resend).
5. `total_units` y `winner_bid_id` coherentes en los 3 grupos; pujas en `winner`.
6. Escaparate vacío tras el cierre → **crear grupos frescos esta semana** para llegar poblados al día 12.

---

## 5. Lecciones nuevas (añadir al manual)

- **L1 — PostgREST cachea el esquema:** tras crear una función nueva, `NOTIFY pgrst, 'reload schema';` o la API puede no verla.
- **L2 — REVOKE FROM PUBLIC no basta en Supabase:** `anon` y `authenticated` reciben EXECUTE por privilegios por defecto del esquema; para bloquear una función a service_role hay que revocárselo **por nombre de rol** y verificar con `has_function_privilege`.
- **L3 — Env vars de Vercel se hornean por deploy:** cambiar una variable no afecta a lo ya desplegado; siempre Redeploy (sin build cache) después de rotarla.
- **L4 — Diagnóstico "¿qué build sirve producción?":** `curl` de la página → extraer el chunk `/_next/static/chunks/app/<ruta>/page-*.js` → `grep` de una cadena exclusiva de la versión nueva. Distingue en segundos caché local vs. stale build real.
- **L5 — Caché local del navegador engaña incluso "en privado"** si la ventana se reutiliza: probar con `?v=N` en la URL o recarga forzada (Cmd+Shift+R / Opción+Cmd+R) antes de sospechar de producción.

## 6. Pendientes (por orden)

1. **Lunes:** auditoría del cierre (checklist §4).
2. **Esta semana:** crear grupos reales para el escaparate del día 12.
3. Bugs de display (del 27 jun, siguen abiertos): `ProgressToNextPrice` con mejor precio alcanzado; `total_units = 0` con todo esperadores (display-only, `close_group` no lo usa para dinero).
4. **Stripe live cutover** (bloqueado por alta de empresa): 3 env vars + webhook live con su propio signing secret + transacción real de prueba. Recordar L3: Redeploy tras cambiar las vars.
5. Rotar credenciales de **Sendcloud** antes de producción.
6. Multi-puja: retomar en G2 cuando el lanzamiento respire (spec en VONDA_SPEC_MULTIBID.md + estado en VONDA_MULTIBID_G2_PAUSADO.md).
7. Opcional: añadir `CLAUDE.md` a `.gitignore` para limpiar `git status`.

## 7. Estado de referencia

- Último commit: `feat(api): rate limiting por IP en create-intent (H6)` sobre `819f997` (main, desplegado y verificado).
- Funciones tocadas hoy: `create_petition` (v3), `get_my_groups` (solo firma 2-args), `check_rate_limit` (nueva). Todas con permisos verificados por OID.
- Tabla nueva: `rate_limits` (RLS on, sin políticas).
- Cron: `0 20 * * 0` UTC, secreto nuevo verificado con cierre real incluido.
