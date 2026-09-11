# TECHNICAL_DEBT.md — Gropo

> Deuda técnica **documentada, no corregida**. Verificado el 6 de septiembre de 2026.
> Los defectos con impacto funcional están en `KNOWN_ISSUES.md`; aquí va lo estructural: lo que
> hace que el proyecto sea más caro y más arriesgado de cambiar.

---

## DT-01 · El código más crítico no está versionado en git 🔴

**Qué.** Toda la lógica de negocio vive en funciones PL/pgSQL desplegadas a mano. No hay
`supabase/migrations/`, ni Prisma, ni Drizzle, ni ningún runner. Los ficheros `supabase/*.sql`
son copias manuales y **7 de ellas están desfasadas**; una (`prepare_join.sql`) está corrupta.

**Coste.** Imposible hacer code review del código que mueve el dinero. Imposible reconstruir el
sistema desde el repositorio. Imposible saber qué cambió y cuándo. Cualquiera que lea el repo
sin consultar la BD razona sobre un algoritmo que ya no existe.

**Evidencia.** `ALGORITHM.md` §12 y `KNOWN_ISSUES.md` P1-01 / P1-02.

---

## DT-02 · Cero tests con dinero real en juego 🔴

**Qué.** Búsqueda exhaustiva de `*.test.*`, `*.spec.*` y configuraciones de Jest/Vitest/
Playwright/Cypress: **0 resultados**. `package.json` no tiene script `test`.

**Lo que existe en su lugar.** Ensayos manuales documentados en runbooks
(`ENSAYO_F3_runbook.md`, `ENSAYO_PULSE_runbook.md`), el script `supabase/test_close_group.sql`
y `CHECKLIST_PRODUCCION.md`. Todos requieren ejecución humana.

**Coste.** Cada cambio en `compute_price`, `close_group` o `confirm_join` es un salto de fe.
Los casos borde documentados en `ALGORITHM.md` (tiers vacío, todos esperadores, empate entre
pujas, `max_stock` intermedio) **no están cubiertos por nada**.

---

## DT-03 · Duplicación mobile / desktop (ADR-15)

**Qué.** Dos árboles de UI paralelos con `hidden lg:block` / `lg:hidden`. La misma lógica de
presentación existe dos veces:
`GroupLiveSection` ↔ `GroupRightSidebar` · `GroupsGrid` ↔ `HomeDesktopView` ·
`MisGruposMobile` ↔ `MisGruposDesktop` · `ProductCard` ↔ `DesktopProductCard`.

**Coste.** Cada cambio de comportamiento hay que hacerlo dos veces. Es el origen de la mayor
parte del código muerto (DT-04). Además todo el HTML de ambas variantes se envía al navegador.

**Acoplamiento raro derivado:** `/notificaciones` importa `useLadders`, `derive` y el tipo
`Membership` **desde `components/desktop/MisGruposDesktop.tsx`** — un componente de vista
desktop actuando como módulo de lógica compartida.

---

## DT-04 · 14 componentes huérfanos (~1.500 líneas)

Lista completa en `UX_AND_FLOWS.md` §9.2 y `KNOWN_ISSUES.md` P3-01.

**Coste.** Ruido en búsquedas y en el árbol de ficheros. Y algo peor: **`CLAUDE.md` los
presenta como "Archivos clave"** (`JoinModeSelector`, `TierDemandLadder`), de modo que una IA o
un desarrollador nuevo empezaría por leer código muerto.

---

## DT-05 · Ficheros gigantes

| Fichero | Líneas | Contenido |
|---|---|---|
| `src/app/grupo/[id]/unirme/JoinFlow.tsx` | **1036** | 2 componentes (`JoinFlow`, `InnerForm`) + 3 helpers (`CompactCountdown`, `fireConfetti`, `PayLogos`, `HowGropoRow`) + toda la lógica de checkout y todo el marcado de dos diseños |
| `src/app/favoritos/page.tsx` | 685 | "Mi Radar" completo |
| `src/components/PulseZone.tsx` | 474 | Toda la zona del Pulse |
| `src/app/perfil/page.tsx` | 473 | Perfil + CRUD de direcciones + Radar |
| `src/components/checkout/FastCheckoutModal.tsx` | 417 | Dos rutas de pago + 3DS + estados |
| `src/components/desktop/HomeDesktopView.tsx` | 442 | Home desktop con "cómo funciona" inline |
| `src/components/GropoTargetSlider.tsx` | 400 | Slider + lock + tooltips |

**Coste.** Difíciles de navegar; alto riesgo de romper algo colateral al modificar.

---

## DT-06 · Sin tipos de la base de datos

**Qué.** No hay `supabase gen types`. Todas las consultas son `supabase-js` sin tipar, con
`any` abundante (`as any`, `(b as any).min_execution`, `(group as any).product_spec`).
`.eslintrc.json` desactiva `@typescript-eslint/no-explicit-any` explícitamente.

**Coste.** El compilador no detecta un cambio de esquema. El bug documentado en `CLAUDE.md` del
21 jul (*"Precio bloqueado 0 €"* por un `select` que no pedía `current_price`/`final_price`) es
exactamente el tipo de error que unos tipos generados habrían evitado.

---

## DT-07 · Tres definiciones distintas de "siguiente tramo" y de "unidades"

| Definición | Dónde |
|---|---|
| `next_price = MAX(price) WHERE price < best_price` | `compute_price` (motor) |
| `nextTier` = el no desbloqueado con **menos unidades faltantes**, desempatando por precio | `src/hooks/useTierDemand.ts:61-68` |
| `nextLocked` = primer no desbloqueado con `minUnits > unlockedBase`; `currentUnits` = `min(nextLocked.minUnits − 1, max(unlockedBase, nextLocked.demand))` | `src/app/page.tsx:59-63` |

Y cuatro magnitudes de "unidades" (demanda efectiva, demanda firme, unidades comprometidas,
unidades adjudicadas — ver `ALGORITHM.md` §9).

**Coste.** Las tres coinciden en el caso simple y divergen en escaleras con huecos. Es una
fuente latente de inconsistencias de display.

**Agravante:** `src/lib/mock-data.ts` mantiene `getStepPricing`, `getMilestones` y
`getActivationState` marcados `@deprecated` — **matemática de precios replicada en el cliente**,
exactamente lo que la arquitectura prohíbe. Siguen importándose (al menos los tipos
`GroupProduct` y `Tier`).

---

## DT-08 · Cliente de Resend instanciado tres veces

| Fichero | Cómo |
|---|---|
| `src/lib/resend.ts:13` | `getResend()` con `FROM` propio |
| `src/app/api/stripe/webhook/route.ts:22-27` | `_resend` perezoso + `FROM` copiado |
| `src/lib/pulse-notify.ts:21,93` | `new Resend(apiKey)` + `FROM` copiado |

La constante `const FROM = process.env.RESEND_FROM ?? 'Gropo <no-reply@vonda.es>'` está
**duplicada literalmente en los tres**.

**Coste.** Cambiar el remitente exige tocar tres ficheros. `CLAUDE.md` lo lista como
*"Centralizar Resend client"* desde julio.

---

## DT-09 · Paleta de color fuera de Tailwind

`tailwind.config.ts` define `brand #6C3CE1` (dark `#5A2DC7`, light `#8B63E8`) y
`brand-green #0F9D58`. Pero el código usa hex inline que **no están en la configuración**:
`#6C4BF4` (el morado real de los rediseños de julio), `#FBFAF8`, `#ECEAF2`, `#e8890c`,
`#D6452B`, `#0F8A4D`, `#F4F0FE`, `#F5F3F9`, `#E6F5EC`…

**Coste.** Imposible cambiar la marca en un solo sitio. Dos morados distintos conviviendo.

---

## DT-10 · Sin capa de acceso a datos

**Qué.** Cada `page.tsx` arma sus propias consultas con `.select('col1, col2, …')` a mano.
No hay funciones compartidas de lectura de grupos, miembros o escaleras.

**Coste.** El mismo bug se repite por cada pantalla nueva. El caso documentado: la query de
`/favoritos` no pedía `current_price` ni `final_price` → los grupos cerrados caían al fallback
`Number(g.current_price ?? 0)` → **"Precio bloqueado 0 €"** y "Ahorras" inflado al PVP entero,
afectando a **cualquier** grupo cerrado de **cualquier** usuario.

---

## DT-11 · Sin categorías de producto

**Qué.** No existe columna `category` en `groups`.
- `src/app/grupo/[id]/page.tsx:161` hardcodea `"· Deporte"`.
- `user_radar_prefs.categories text[]` existe **sin nada que la alimente**.
- `CLAUDE.md`: *"getProductCategory() devuelve 'deporte' para todo. Cuando exista campo category
  en BD, mapear ahí"*.

**Coste.** Bloquea filtros, el Radar por categorías y las sugerencias personalizadas — es decir,
una funcionalidad ya a medio construir en la base de datos.

---

## DT-12 · Identidad dual `users` / `auth.users`

Ver `DATABASE.md` §6 y `ARCHITECTURE.md` §9.
**Coste.** Es la raíz de `SECURITY.md` SEC-01 (P0-02). El plan de unificación ya está escrito en
`CLAUDE.md` y clasificado como ⚡ money-critical + RLS, pero **la deuda sigue viva y cada nueva
página que llame a `get_profile`/`address_*` desde el cliente la agranda**.

---

## DT-13 · Sin monitorización de errores

**Qué.** No hay Sentry ni equivalente. Los únicos canales son `console.*` (visible en los logs
de Vercel) y `sendAdminAlert()` a `ADMIN_EMAIL` — que solo se dispara en dos sitios: fallos del
cron de cierre y fallos de captura.

**Coste.** Fallos silenciosos. Ejemplos reales de rutas que se tragan errores:
- `src/app/page.tsx:18-21` — si falla la consulta de grupos, hace `console.error` y devuelve
  `[]` → **la home aparece vacía**, indistinguible de "no hay grupos".
- `useTierDemand` y `usePulse` — `catch {}` vacío (*"el pulse es decorativo, nunca rompe la
  página"*).
- `sendClosePaymentEmails` — cuenta `failed++` sin avisar a nadie (P1-05).

---

## DT-14 · Documentación desfasada

11 discrepancias catalogadas entre documentación y realidad (ver
`PROJECT_KNOWLEDGE_PACK.md` § DISCREPANCIAS). Las más caras:
- `CLAUDE.md` describe un producto llamado **Vonda** con dominio `www.vonda.es`; el producto se
  llama **Gropo** y el dominio de cookies es `.gropo.es`.
- `CLAUDE.md` lista como "Archivos clave" **dos componentes muertos**, y menciona un fichero
  (`VondaTargetSlider`) que **no existe**.
- Las cabeceras de `supabase/compute_price.sql` y `close_group.sql` dicen *"Definición VIVA
  sincronizada desde producción"* y **ya no lo son**.

---

## DT-15 · `price_mode` a medio implementar

Enum + columna con default `'fluid'` + función `compute_price_at_n` + selector en el admin,
pero **ningún motor lee `price_mode`** y `compute_price_at_n` **no tiene llamantes**.

**Coste.** Cuatro artefactos sugieren una funcionalidad que no existe. Una IA que lea la BD
concluiría razonablemente que el precio fluido funciona.

---

## DT-16 · Rebranding incompleto en runtime

`src/lib/pulse-notify.ts:22` → `BASE_URL = 'https://www.vonda.es'` (enlaces de los emails).
Remitente por defecto `Gropo <no-reply@vonda.es>` en tres ficheros.
`envios@vonda.es` en los defaults de Sendcloud.
Clave `localStorage['vonda_user']` en 9 puntos.
`package.json` → `"name": "kuorum"`.

**Coste.** Cada email enviado lleva el rebranding a medias.

---

## DT-17 · `.env.local` incompleto (9 de 27 variables)

Faltan `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `ADMIN_EMAIL`, `NEXT_PUBLIC_SITE_URL` y
las 12 de Sendcloud.

**Coste.** El entorno local no reproduce producción: los crons devuelven 401 siempre, los emails
lanzan y degradan en silencio, y las etiquetas usarían los defaults de placeholder
(`"Gropo Envios (test)"`, `Carrer de Prova 1`, `sendcloud:letter`).
Escalado a P0-05 en `KNOWN_ISSUES.md` porque **no se sabe si también faltan en Vercel**.

---

## DT-18 · Dos ficheros de instrucciones para agentes

`CLAUDE.md` (21,5 KB) y `AGENTS.md` (21,4 KB) en la raíz, con contenido casi idéntico y sin
mecanismo de sincronización.

**Coste.** Divergencia garantizada a medio plazo.

---

## DT-19 · Endpoints y artefactos temporales desplegados

- `/admin/email-test` — marcado *"Endpoint TEMPORAL de prueba de Resend"* en su propio
  comentario, con datos hardcodeados. Sigue en producción.
- `design/el-ticket-prototype.html` — prototipo hi-fi suelto en la raíz.
- `.env.local.save` y `.env.local.save.save` — copias de seguridad del `.env` en el árbol de
  trabajo (gitignored, pero presentes en disco).
- `Archivos a guardar/add_stripe_payment_fields.sql` — backup local.
- 7 ficheros `VONDA_HANDOFF_*.md` + 4 handoffs/runbooks más en la raíz del repositorio.

---

## RESUMEN DE COSTE

| Deuda | Impacto en velocidad | Impacto en riesgo |
|---|---|---|
| DT-01 SQL sin versionar | Alto | 🔴 **Muy alto** |
| DT-02 Sin tests | Medio | 🔴 **Muy alto** |
| DT-12 Identidad dual | Bajo | 🔴 Alto (es SEC-01) |
| DT-13 Sin monitorización | Bajo | 🟠 Alto |
| DT-03 Duplicación mobile/desktop | 🟠 Alto | Bajo |
| DT-05 Ficheros gigantes | 🟠 Alto | Medio |
| DT-06 Sin tipos de BD | Medio | Medio |
| DT-07 Tres definiciones de "siguiente" | Bajo | Medio |
| DT-10 Sin capa de datos | Medio | Medio |
| DT-14 Documentación desfasada | 🟠 Alto | Medio |
| DT-11 Sin categorías | Medio (bloquea features) | Bajo |
| DT-15 `price_mode` a medias | Bajo | Medio (induce a error) |
| DT-04, DT-08, DT-09, DT-16, DT-17, DT-18, DT-19 | Bajo | Bajo |
