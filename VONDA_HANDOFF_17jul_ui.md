# VONDA — Handoff sesión 17 jul (UI: Home desktop 1a + Mi Radar slider 8c)

**Fecha:** 17 julio 2026 · **Ámbito:** solo UI/display (no money-critical) · **Modelo:** Opus

## Resumen

Dos frentes en esta sesión:
1. **Home desktop** rediseñada al mockup **1a** (editorial).
2. **Mi Radar** (móvil y desktop): comportamiento del slider alineado al mockup **8c**, más
   correcciones de interacción y **latencia**.

Todo compila limpio (`npx tsc --noEmit` + `eslint` sin errores). **PENDIENTE DE PUSH** (ver
final).

---

## 1. Home desktop → diseño 1a

**Archivo:** `src/components/desktop/HomeDesktopView.tsx` (reescrito por completo)

Antes renderizaba el layout compacto "1b"; ahora replica el editorial 1a:

- **Navbar** propia: logo de marca (cuadrado morado con "v" + "Vonda"), nav (Explorar ·
  Mis grupos · Mi Radar · Cómo funciona), "Crea tu grupo" + avatar.
- **Hero** 2 columnas:
  - Izquierda: titular serif "Cuantos más seamos, *menos pagamos*" (Instrument Serif,
    "menos pagamos" en cursiva morada), subtítulo, buscador tipo card con botón circular
    morado, y 3 stats (grupos activos, ahorro medio %, "hasta desbloquear") calculadas de
    datos reales vía `getStepPricing`.
  - Derecha: **grupo destacado** (`FeaturedCard`) = primer producto, con badge "GRUPO
    DESTACADO", countdown, imagen grande, slider y CTA.
- **Categorías** con label + pills.
- **Grid** "Grupos abiertos" de 4 columnas (`GridCard`). El destacado se excluye del grid
  para no duplicarlo.
- Se factorizó la lógica compartida de tarjeta en un hook local `useCardState`.

> Nota de copy: la CTA de las tarjetas se alineó al mockup ("Bloquear precio · …") en
> HomeDesktopView; la lógica de checkout (comprar/esperar) es la misma de antes.

---

## 2. Mi Radar slider → mockup 8c (móvil + desktop)

**Archivos:**
- `src/components/VondaTargetSlider.tsx`
- `src/components/PulseZone.tsx`
- `src/app/favoritos/page.tsx` (activa `boxedLegend` en `OpportunityCard` desktop y
  `MobileRadarCard` móvil)

Ambas tarjetas comparten `PulseZone` → `VondaTargetSlider`, así que los cambios aplican a
las dos versiones a la vez.

### 2.1 VondaTargetSlider
- **Rastro naranja**: al anclar un tramo inferior no alcanzado (`anchorMode` +
  `selIdx > curIdx`) el track pinta líneas naranja de `curIdx → selIdx`. Sin ancla, track
  liso (nuevo prop de comportamiento interno; las home cards mantienen su preview morado
  porque no usan `anchorMode`).
- **Punto rojo eliminado** de toda la UI (antes marcaba el precio actual; era confuso). El
  tramo actual se lee por su nodo morado con ✓.
- **`hideThumb`** (nuevo prop): oculta el thumb en el estado deseleccionado; el track sigue
  siendo tappable.

### 2.2 PulseZone — nuevo modo `boxedLegend`
Reemplaza la línea de estado + CTA por las **tres leyendas en caja** del mockup:
- **Gris** "Toca un precio para anclar tu interés" → sin selección (y sin thumb).
- **Morada** "Este precio ya está disponible. ¡Desbloquéalo ahora!" + CTA sólida
  "Desbloquear precio a X €" → tramo actual tocado.
- **Naranja** "Faltan N uds para este tramo. Solo te avisaremos si este precio puede
  hacerse realidad." → tramo inferior anclado.
- **canAccept** ("ya sois suficientes"): integrado en caja con **UNA sola CTA** (se eliminó
  la CTA secundaria "Asegurar precio" que salía doble).
- Estados especiales conservados (converted "Precio activado", complete, holding, accepted,
  failed/error) siguen con su render propio.

### 2.3 Interacción + latencia (UI optimista)
- El toggle del ancla ya no espera el round-trip: **el thumb y la leyenda cambian al
  instante** y la llamada a `/api/pulse/pledge` (upsert/remove) va en segundo plano.
- Se quitó el `busy` que congelaba el slider y el fade de 300 ms del desanclado.
- Se usa `committedRef` (ref al ancla confirmada) para detectar el re-tap = desanclar, ya
  que `selIdx` se actualiza antes de que llegue `onCommit`.
- `sliderDisabled = complete || !markable` (ya no depende de la red).

---

## Verificación hecha
- `npx tsc --noEmit -p tsconfig.json` → limpio.
- `npx eslint` sobre PulseZone.tsx y VondaTargetSlider.tsx → limpio.
- No se ha probado E2E con dinero real (no aplica: es UI/display).

## Pendiente / próxima sesión
- **PUSH pendiente.** Comando dado a Benjamin:
  ```
  cd ~/Desktop/kuorum
  git add src/components/desktop/HomeDesktopView.tsx src/components/VondaTargetSlider.tsx src/components/PulseZone.tsx src/app/favoritos/page.tsx
  git commit -m "Home desktop 1a + Mi Radar slider 8c (rastro naranja, leyendas en caja, sin punto rojo, UI optimista)"
  git push origin main
  ```
- **Revisar visualmente en producción** (www.vonda.es) tras el deploy: home desktop 1a y
  Mi Radar (móvil + desktop), estados gris/morado/naranja y responsividad del slider.
- Detalle menor: badge "Faltan 1 unidades" → debería ser "unidad" en singular
  (`OpportunityCard` en `favoritos/page.tsx`).
- Datos DEMO fuerzan estados ("Estado A/C") en Mi Radar; recordar limpiarlos antes del
  lanzamiento (ya estaba en pendientes de CLAUDE.md).
