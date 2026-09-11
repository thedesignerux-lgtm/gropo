# HANDOFF — Sesión UI 16 jul 2026

Sesión 100% de UI/UX (sin tocar lógica money-critical: nada de compute_price, close_group, confirm_join, RLS ni SQL). Todo verificado con `npx tsc --noEmit` (EXIT 0) tras cada bloque. Git lo ejecuta Benjamin desde su terminal.

---

## 1. Resumen de lo hecho (en orden)

### 1.1 Ficha producto desktop — ajustes iniciales
- **Selector** (`GroupRightSidebar`): el tramo seleccionado pasó a **solo borde** (no relleno morado opaco).
- **Rebaja junto al precio** (`GroupCenterContent`): pill verde "Ahorras X €" al lado del precio (como móvil).

### 1.2 Rediseño ficha producto desktop (mockup "Casco Aero")
- `GroupDesktopView`: tarjeta blanca grande sobre fondo cálido `#F2EFE9`; header (Volver a Deporte / Compartir / Guardar-corazón), título grande + spec + pill naranja de cierre, 2 columnas, y sección a lo ancho **"Cuantos más, menos pagas"** + 3 pasos numerados + fila de confianza (Pago seguro · Sin compromiso · Devoluciones fáciles).
- `GroupCenterContent`: reducido a **una sola imagen** grande (placeholder lavanda si no hay `imageUrl`).
- `GroupRightSidebar`: card única que combina precio actual + siguiente, avatares, el selector y CTA.

### 1.3 VONDA TARGET SLIDER (lo central de la sesión)
Componente nuevo compartido: **`src/components/VondaTargetSlider.tsx`**.
- Raíl arrastrable (pointer events) con nodos por tramo (detents), marcador del precio actual (punto rojo), relleno con onda animada (`.ts-wave`) + proyección punteada al siguiente tramo (`.ts-pulse`), thumb con pill flotante "Máx · X €".
- **Confirmado** (selección ≥ precio actual) = morado `#6C4BF4`; **En espera** (tramo más barato/futuro = esperador) = naranja `#E8944A`.
- Props: `detents`, `curIdx`, `selIdx`, `onSelIdx`, `size` (`'mini' | 'full'`), `chrome` (`'none' | 'nudge' | 'full'`), `udsToNext`.
  - `chrome='none'`: solo slider (cards).
  - `chrome='nudge'`: slider + caja nudge (móvil 2d; el estado va fuera, en la cabecera de precio).
  - `chrome='full'`: encabezado "¿Cuál es el máximo que pagarías?" + chip de estado + nudge (ficha desktop).
- Keyframes `tsWave`/`tsPulse` añadidos a `globals.css` (con `prefers-reduced-motion`).

Aplicado en:
- **Ficha desktop** (`GroupRightSidebar`): el slider **sustituye al stepper PVP/HECHO/AHORA/META y al selector segmentado**. Ahora **sí se puede volver a un precio anterior** (arrastrar a tramos ya alcanzados). CTA morado (confirmado) / naranja (en espera).
- **Ficha móvil** (`GroupLiveSection`): reimplementada con el **layout 2d** — pill naranja de cierre, título, card fusionada (precio + pill "Ahorras" + PVP tachado + chip estado Confirmado/En espera + slider con nudge + avatares) y barra sticky inferior "Máx. X €" + CTA que cambia de color.
- **Cards home desktop** (`HomeProductCard`): card estilo board 1b (imagen + pill "Faltan X uds" + corazón, nombre, nota, precio + "luego X", "Ahorra X €", slider mini + CTA checkout directo).
- **Cards home móvil** (`DesktopProductCard`): sustituida la `PulseBar` por el target slider mini + CTA checkout directo.

### 1.4 Otros
- Móvil ficha: eliminadas las 2 barras muertas de abajo ("Cómo baja el precio" `TierDemandLadder` y "Progreso del grupo" `WaveProgress` con el falso slider).
- `HomeCardSlider.tsx` quedó como **re-export** de `VondaTargetSlider` (no se pudo borrar por permisos; no duplica lógica).
- `isAuthed` cableado desde `page.tsx` (servidor) → `HomeDesktopView`/`GroupsGrid` → cards, para decidir checkout modal vs `/unirme`.

---

## 2. Archivos tocados

**Nuevos**
- `src/components/VondaTargetSlider.tsx` — slider compartido.

**Modificados**
- `src/app/globals.css` — keyframes `tsWave`/`tsPulse`.
- `src/app/page.tsx` — `fetchIsAuthed()` + pasa `isAuthed`.
- `src/components/desktop/GroupDesktopView.tsx` — layout ficha desktop.
- `src/components/desktop/GroupCenterContent.tsx` — imagen única.
- `src/components/desktop/GroupRightSidebar.tsx` — card con slider `chrome="full"`.
- `src/components/desktop/HomeDesktopView.tsx` — pasa `isAuthed`.
- `src/components/desktop/HomeProductCard.tsx` — card board 1b + slider + checkout.
- `src/components/desktop/HomeCardSlider.tsx` — re-export de VondaTargetSlider.
- `src/components/desktop/DesktopProductCard.tsx` — card home móvil con slider + checkout (client).
- `src/components/GroupLiveSection.tsx` — ficha móvil layout 2d.
- `src/components/GroupsGrid.tsx` — pasa `isAuthed`.

**Lógica del CTA (común a fichas y cards)**
- `confirmed` (selIdx ≤ curIdx) + `authed` → `useCheckout().open({ ..., maxPricePerUnit: selectedPrice })` (modal 1-Click).
- `confirmed` + no auth → `/grupo/[id]/unirme`.
- esperar (selIdx > curIdx) → `/grupo/[id]/unirme?mode=esperar&target=<precio>`.

---

## 3. Decisiones / interpretaciones tomadas (confirmar si procede)

1. **Slider seleccionado en color intenso**: el mockup "Casco Aero" mostraba el pill del selector segmentado en morado intenso = igual que la CTA; luego se pidió "solo borde" y se aplicó a desktop+móvil antes de migrar al slider.
2. **"Vonda Pulse" en móvil**: Pulse (`PulseZone`) vive en Mi Radar/favoritos, no en la ficha. Se interpretó como conservar la animación de pulso del slider + CTA que cambia de color. **El layout 2d final quitó el CTA de dos fases y el selector de cantidad en móvil** (cantidad queda en 1; se ajustaría en checkout). → Confirmar si se quiere recuperar la cantidad en móvil.
3. **Copy "En espera"**: el diseño original decía "te estás quedando fuera / sube tu PMA"; se cambió a copy fiel al modelo Vonda (esperador válido: "Reservas tu plaza como esperador: solo pagarás si el grupo baja a X").

---

## 4. Pendiente / a validar en vivo (www.vonda.es, pantalla ancha + móvil)

- **Arrastre del slider vs scroll**: verificar que arrastrar el thumb no choque con el scroll horizontal de los carruseles (desktop) ni el scroll vertical de la página (móvil). Si molesta, valorar `touch-action`/`pointer-capture`.
- **Tamaño cards**: home desktop card = `w-[300px]`; validar en carrusel.
- **Cantidad en móvil 2d**: actualmente fija a 1 (ver decisión 3.2).
- **Datos reales**: los detents salen de `product.tiers` (RPC `tier_demand`); `curIdx` por precio actual / unidades. Placeholders Unsplash siguen en las cards hasta que exista imagen/categoría real en BD.
- Recordatorio general del proyecto (sigue vigente): cutover Stripe test→live, rotación claves Sendcloud, Custom SMTP Resend en Supabase Auth, limpieza de grupos/usuarios demo antes del domingo.

---

## 5. Diseño de referencia

Archivo del diseño: `Rediseño página Vonda tipo Airbnb.zip` (subido esta sesión). Boards relevantes: **1b** (home marketplace cards), **1c/1d** (detalle desktop), **2d** (detalle móvil). El componente `VondaTargetSlider.dc.html` del zip fue la base del slider React.

_Handoff generado 16 jul 2026._
