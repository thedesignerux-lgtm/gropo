// src/lib/brand-colors.ts
//
// Los dos colores que la ficha usa para distinguir los dos modos de compra.
// Estaban escritos a mano, idénticos, en tres componentes distintos
// (`GroupLiveSection`, `desktop/GroupRightSidebar`, `GropoTargetSlider`).
// Así es exactamente como se acabó teniendo dos morados y tres naranjas
// conviviendo sin que nadie lo decidiera — ver UX_AND_FLOWS.md §9-bis.
//
// Reflejan los tokens `brand` y `accent.dark` de `tailwind.config.ts`. Viven
// aquí y no como clases de Tailwind porque se aplican en estilos en línea
// calculados en tiempo de ejecución.

/** `brand` · #024947 — 10,26:1 sobre blanco. Modo "comprar ahora". */
export const BRAND = '#024947'

/** `accent.dark` · #B24A00 — 5,42:1 sobre blanco. Modo "esperar a un precio". */
export const ACCENT_DARK = '#B24A00'

/**
 * El color del modo activo.
 * @param confirmed true = el tramo elegido ya está desbloqueado (comprar ahora)
 */
export function modeAccent(confirmed: boolean): string {
  return confirmed ? BRAND : ACCENT_DARK
}
