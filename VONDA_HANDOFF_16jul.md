# HANDOFF — 16 jul 2026 · Vonda Pulse en el target slider + anclaje en Mi Radar

**Sesión de UI/display (Opus, sin ⚡).** No se tocó lógica money-critical (`compute_price`,
`close_group`/`join_group`, RLS). Todo desplegado a producción (`www.vonda.es`) y verificado
en vivo en el navegador. Rama `main`, último commit **`18211c2`**.

---

## 1. Qué se hizo (en orden)

### 1.1 Vonda Pulse dentro del `VondaTargetSlider` — 4 superficies · commit `25b94aa`
El Pulse en vivo (bruma de observadores, intención marcada difuminada, dinero condicional
morado en reverse-fill, anillos de "surge") vivía solo en `TierProgress`/`PulseBar`. Ahora
está también en el `VondaTargetSlider`.

- `VondaTargetSlider.tsx`: props opcionales `pulse?: TierPulse[]` y `glow?: 0|1|2|3`. Se
  replican las 4 capas del Pulse sobre el track (mapeando `units → detent.uds` en el sistema
  de posiciones 7%–93% del slider), reutilizando las clases CSS globales (`vonda-glow`,
  `vonda-marked`, `vonda-reverse-fill`) y `PulseRings`. `TierProgress` quedó intacto.
- `usePulse(groupId)` cableado en las 4 superficies (desactivado cuando el grupo está en su
  mejor precio, `nextTier`/`isComplete` nulo):
  - Home móvil → `GroupsGrid` → `DesktopProductCard`
  - Home desktop → `HomeDesktopView` → `HomeProductCard`
  - Ficha móvil → `GroupLiveSection`
  - Ficha desktop → `GroupDesktopView` → `GroupRightSidebar`
- **Dato:** `ProductCard.tsx` (con `WaveProgress`) es **código muerto** (no se importa en
  ningún sitio). La home móvil renderiza `DesktopProductCard`, no `ProductCard`.

### 1.2 Target slider con anclaje de precio en Mi Radar · commit `97dc984`
`PulseZone` (componente único de Mi Radar, compartido por móvil y desktop vía
`OpportunityCard`) pasó de `TierProgress` a `VondaTargetSlider`.

- `VondaTargetSlider.tsx`: props nuevas `onCommit(i)` (se dispara SOLO al soltar el thumb,
  para persistir sin llamar a la API en cada píxel del arrastre), `minIdx` (bloquea el thumb
  en los tramos anclables, de `curIdx` hacia los más baratos) y `disabled` (modo lectura).
  Retrocompatibles: las otras 4 superficies no las pasan.
- `PulseZone.tsx`: deriva `detents`/`curIdx`/`selIdx` del ancla (`mine`). `onCommit`:
  `i > curIdx` → `upsertPledge(precio, qty)`; `i == curIdx` → sin ancla (si había pledge en
  espera, lo retira). Mantiene la línea de estado ("Tu ancla", stepper, Quitar) y el
  `PulseAcceptModal`.

### 1.3 Bug de navegación al tocar los tramos (Mi Radar) — 4 iteraciones
Síntoma: al **clicar** un tramo, la tarjeta (envuelta en `<Link>`) navegaba al detalle del
producto en vez de anclar. El arrastre sí funcionaba; el click no.

- `626c7e5`: intento con `onClick` de React (`preventDefault`+`stopPropagation`). **No bastó.**
- `5d814da`: guarda con listener **nativo en fase de captura** vía `useEffect`, pero con
  dependencia `[disabled]`. **Seguía fallando.**
- **Causa raíz (diagnosticada en vivo con las Chrome tools en la propia producción):**
  el `onClick` de burbuja de React no ejecutaba el `preventDefault` (medido:
  `defaultPrevented=false` a nivel `document`), así que la navegación **nativa del `<a>`** de
  Next se disparaba. Y la guarda con `[disabled]` se auto-desactivaba: al soltar, `onCommit`
  → `upsertPledge` hacía `setBusy(true)` → `disabled=true` → el `useEffect` **quitaba la
  guarda una milésima antes del click**.
- `8c60be9` (**fix definitivo**): la guarda de click nativo se monta **una sola vez**
  (`useEffect` con deps `[]`) y **no se quita nunca**. Un click sobre el slider nunca navega.
  Verificado en vivo: el click real quedó interceptado y no navegó.

### 1.4 Refinamiento de Mi Radar (feedback de Benjamin) · commit `18211c2`
Decisiones: **mantener el slider** pero adaptarlo, y **quitar** la CTA a Mis grupos.

- `VondaTargetSlider.tsx`: prop **`anchorMode`**. En Mi Radar:
  - **Oculta el tooltip "Máx · X €"** (el precio ya se ve en "Tu ancla: X €").
  - Muestra una **flecha de ancla** (▼ en color acento) sobre el tramo elegido cuando
    `selIdx > curIdx`.
- `PulseZone.tsx`: pasa `anchorMode`; la CTA del estado **`converted`** ya **no** navega a
  `/mis-grupos` — muestra confirmación estática **"✓ Precio activado"** (sin navegación).

**Verificado en producción (desktop):** sin tooltip, flecha visible en la tarjeta anclada,
tap ancla sin navegar. El mensaje "Ya participas en este grupo" al tocar es correcto (la
cuenta de prueba ya es miembro de los grupos DEMO).

---

## 2. Archivos tocados esta sesión
- `src/components/VondaTargetSlider.tsx` — Pulse (4 capas) + props `onCommit`/`minIdx`/
  `disabled`/`anchorMode` + guarda de click nativo (captura, deps `[]`) + flecha de ancla.
- `src/components/PulseZone.tsx` — usa `VondaTargetSlider` con anclaje + `anchorMode` + CTA
  "convertido" sin navegación a Mis grupos.
- `src/components/GroupLiveSection.tsx`, `desktop/GroupRightSidebar.tsx`,
  `desktop/DesktopProductCard.tsx`, `desktop/HomeProductCard.tsx` — cableado de `usePulse` +
  paso de `pulse`/`glow` al slider.

Todo con `tsc --noEmit` limpio y `next lint` sin warnings nuevos.

---

## 3. Pendiente / a verificar
- **Móvil:** Mi Radar usa el MISMO componente que desktop (`OpportunityCard → PulseZone →
  VondaTargetSlider`), así que la corrección del tap aplica igual, pero **no se pudo forzar el
  viewport móvil real** desde las herramientas (la ventana no bajaba del breakpoint `lg`).
  **Benjamin debe probar en el teléfono** `www.vonda.es/favoritos`: tocar un tramo debe
  anclar sin saltar al detalle.
- **CTA "Precio activado":** solo aparece cuando un pledge pasa a `converted`; no se pudo
  reproducir ese estado en la sesión (código desplegado, pendiente de ver con un pledge real).
- **Grupos DEMO:** la cuenta de prueba ya es miembro → sale "Ya participas". Para probar el
  anclaje limpio hace falta un grupo que se siga pero en el que NO se participe.

## 4. Lecciones nuevas (para no repetir)
- **Slider/control interactivo dentro de un `<Link>` de Next App Router:** el `onClick` de
  React NO frena de forma fiable la navegación nativa del `<a>` si hay re-renders de por medio
  (el arrastre llama `setState`). Solución: **listener nativo `click` en fase de captura**
  (`addEventListener('click', guard, true)`) que hace `preventDefault`+`stopPropagation`.
- **No gatear esa guarda con estado que cambia durante la interacción** (`disabled`/`busy`):
  el `setBusy(true)` del pledge la quitaba justo antes del click. Montar la guarda una vez
  (`useEffect` deps `[]`) y dejarla siempre.
- **Diagnóstico en vivo:** las Chrome tools sobre la sesión logueada de Benjamin fueron
  decisivas — leer `defaultPrevented` a nivel `document` y los `memoizedProps` del fiber
  reveló que el fallo no era "disabled" sino la carrera `busy → disabled → guarda retirada`.
- **`git add` no es `git commit`:** un `push` tras solo `add` da "Everything up-to-date" (no
  hay commit que subir). Y ojo con `.git/index.lock` colgado → `rm -f .git/index.lock`.

## 5. Pendiente crítico global (heredado, sin cambios esta sesión)
Cutover Stripe test→live · rotación claves Sendcloud · vendedor real con tramos · confirmar
Custom SMTP Resend en Supabase Auth · limpieza de grupos/usuarios DEMO y ensayos en producción
(§7 del handoff del 13 jul).
