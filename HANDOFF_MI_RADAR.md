# HANDOFF: Mi Radar — Rediseño pendiente

**Fecha:** 10 julio 2026
**Modelo anterior:** Opus 4.6
**Modelo requerido:** Opus 4.8 o Fable 5 (diseño complejo de UI)
**Estado:** La implementación actual NO coincide con el mockup. Necesita rehacerse.

---

## QUÉ SE QUIERE

Benjamin tiene un mockup de alta fidelidad para la página "Mi Radar" (`/favoritos`). El mockup muestra un dashboard de oportunidades de compra colectiva con una estética premium tipo "mercado vivo".

### Mockup de referencia

El mockup (que Benjamin compartió como screenshot en la conversación anterior) muestra:

### Layout general
- **Header completo**: Logo Vonda + buscador + CountdownChip + bookmark + avatar (HECHO ✅)
- **Sidebar izquierda**: HomeSidebar con "Mi Radar" resaltado en violeta (HECHO ✅)
- **Fondo**: #F7F9FC (HECHO ✅)
- **Grid 3 columnas** con gap generoso entre tarjetas (PARCIAL — las tarjetas se renderizan pero la ola está mal)

### Secciones
1. 🔥 **Necesitan tu atención** — "Ver todas (5) >"
2. ⬇️ **Han bajado recientemente** — "Ver todas (4) >"
3. 🔒 **Plaza asegurada** — "Ver todas (3) >"
4. 📦 **Historial** — "Ver todas (6) >"

Todas usan el mismo grid de 3 columnas (NO 50/50 para las últimas dos).

### La tarjeta (OpportunityCard) — ESTRUCTURA del mockup

```
+----------------------------------------------------------+
|  🔥 ATENCIÓN    Faltan 5 unidades                      ⋮ |
|  🕒 2d 14h restantes                                     |
|                                                          |
|          ╭─────╮                                         |
|     ╭───╯      ╰───╮         ╭──╮                        |
|  ──╯                ╰───────╯    ╰─────────── (línea)    |
|  ████████████████████████░░░░░░░░░░░░░░░░░ (área rellena)|
|                                                          |
|  41,90 €              ↓              38,90 €             |
|                                                          |
|  ┌────────────────────────────────────────┐               |
|  │           BLOQUEAR PRECIO             │               |
|  └────────────────────────────────────────┘               |
|                                                          |
|  ─────────────────────────────────────────                |
|  [IMG] Continental GP5000 S TR                            |
|        700x25 · Tubeless Ready · Carretera                |
+----------------------------------------------------------+
```

### El problema principal: LA OLA

La ola actual es un `WaveProgress` con función seno que genera picos agresivos tipo "dientes de sierra". El mockup muestra algo COMPLETAMENTE diferente:

1. **Forma**: Curva suave tipo AREA CHART / stock price chart. Colinas ondulantes orgánicas, NO picos repetitivos de seno.
2. **Relleno**: Gradient vertical — sólido abajo, más claro arriba (no horizontal como ahora). Es un AREA FILL debajo de la curva.
3. **Dot**: Punto circular en el borde de la curva donde termina el progreso (donde el relleno se detiene).
4. **Background**: La parte sin rellenar es un gris muy claro con la misma forma de curva pero en color muted.
5. **Proporción**: La ola ocupa ~30% de la altura de la tarjeta. En el mockup se ve grande y prominente, no fina.
6. **Sin ejes**: NO hay etiquetas de precio ni unidades dentro del área de la ola (el UX Senior review lo confirmó).
7. **Colores por categoría**:
   - Naranja (gradient) para "Necesitan tu atención"
   - Violeta/brand (gradient) para "Han bajado recientemente"  
   - Verde para "Plaza asegurada"
   - Gris para "Historial"

### Colores de borde de tarjeta (del mockup)
- Hot: borde naranja sutil (border-2 border-orange-200)
- Dropping: borde violeta sutil
- Secured: borde verde sutil  
- History: borde gris, tarjeta en grayscale + opacity reducida, SIN CTA

### Precio
El mockup muestra dos formatos:
1. **Grupos abiertos con next tier**: `41,90 €    ↓    38,90 €` (precio actual a la izquierda, flecha abajo centrada, precio siguiente a la derecha en verde)
2. **Grupos sin next tier / cerrados**: `74,90 €    ↓    69,90 €` (precio original → precio final)
3. **Historial**: muestra "Ahorro conseguido: 34,95 €" en verde

### CTA
- "Bloquear precio" — ancho completo
- Naranja para hot, violeta para dropping, verde para secured
- Sin CTA para historial

### Product footer
- Separado por border-top gris fino
- Thumbnail 40×40 rounded + nombre truncado + spec en gris
- SIN ⋮ en el footer (solo arriba)

---

## ARCHIVOS CLAVE

| Archivo | Qué hace |
|---|---|
| `src/app/favoritos/page.tsx` | Página Mi Radar — data fetching + UI completa |
| `src/components/WaveProgress.tsx` | Componente de ola — NECESITA REESCRITURA TOTAL |
| `src/components/RadarCardMenu.tsx` | Menú ⋮ kebab (compartir/eliminar) — OK |
| `src/components/desktop/HomeSidebar.tsx` | Sidebar navegación — ya integrado |
| `src/components/CountdownChip.tsx` | Chip countdown — ya integrado |
| `src/app/favoritos/actions.ts` | Server actions: toggleFavorite, getMyFavoriteIds |

## LO QUE FUNCIONA (no tocar)

- Data fetching de fetchRadar() — correcto, trae groups + bids + tier_demand
- Categorización (hot/dropping/secured/history) — lógica correcta
- RadarCardMenu — funciona bien
- Layout con sidebar + header — estructura correcta
- Server actions de favoritos — estables
- Responsive breakpoints (3 col desktop, 2 tablet, 1 mobile)

## LO QUE HAY QUE REHACER

1. **WaveProgress.tsx** — Reescribir completamente. Debe generar una curva smooth tipo area chart, NO picos de seno. Usar cubic bezier con puntos de control orgánicos. El relleno debe ser gradient vertical (sólido abajo → translúcido arriba). Consultar el mockup.

2. **OpportunityCard** (dentro de page.tsx) — Ajustar la composición para que coincida exactamente con el wireframe del mockup. La ola debe ser más grande (height 64-80px), el bloque de precio debe usar el formato "current ↓ next" centrado.

3. **Verificación visual** — Comparar contra el mockup en el navegador.

## REVIEW UX SENIOR (directrices aprobadas)

- Ola = ticker emocional, sin ejes ni etiquetas
- Un solo ⋮ por tarjeta (arriba a la derecha)
- Grid 3 columnas uniforme para TODAS las secciones
- Historial en grayscale sin CTA
- aria-hidden="true" en SVGs decorativos
- Contraste >4.5:1 en botones con texto blanco
- text-overflow: ellipsis en nombres largos de producto

## DATOS DE TEST

Solo hay 1 grupo en la BD de test: "TEST G4 Smoke" con:
- PVP: 100€, precio actual: 15-18€, next: 15€
- max_stock: 20, total_units: 0
- Status: open
- El grupo cae en categoría "dropping" (no hot) porque missing > 8

Para ver más categorías, Benjamin tendría que añadir el grupo a favoritos y tener grupos en distintos estados.
