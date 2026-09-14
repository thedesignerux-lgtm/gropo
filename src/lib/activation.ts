// ¿Puede este grupo ejecutarse hoy? — A-01
//
// Un grupo recién creado NO puede comprar nada, y hasta el 14-sep-2026 su ficha era
// idéntica a la de uno que sí: «PRECIO ACTUAL · 289 €», «Ahorras 40,99 €», «Este
// precio ya está disponible» y un botón «Bloquear precio». Las cuatro afirmaciones
// falsas a la vez. El día del lanzamiento TODOS los grupos estarán así, o sea que no
// es un caso raro: es el estado por defecto del catálogo el primer día.
//
// El dato que faltaba es `min_execution`. Llegaba hasta los dos componentes de ficha
// como prop… y ninguno de los dos lo desestructuraba, igual que `maxStock` (ver A-29).
//
// DOS CONDICIONES, no una. Un grupo arranca cuando tiene unidades suficientes para:
//   1. desbloquear su primer tramo  → si no, `compute_price` devuelve su *fallback*,
//      que es el precio de un tramo todavía cerrado;
//   2. alcanzar la ejecución mínima de la puja → si no, al cerrar se cancela.
// Para el comprador significan lo mismo —hoy no hay compra— así que se resuelven en
// un solo listón: el mayor de los dos.
//
// Hoy en producción divergen poco porque casi todas las pujas abren su primer tramo
// en 1 unidad y ponen el listón en `min_execution` (6, 8, 10, 30…). El Casco Giro es
// la excepción: primer tramo en 5 y `min_execution` 5, con 2 unidades dentro.
//
// NO se reutiliza `getActivationState` de `lib/mock-data.ts`: vive en un archivo de
// datos de prueba, solo la usan componentes huérfanos (ver A-34) y mira únicamente la
// ejecución mínima, ignorando si hay tramo desbloqueado.

export interface ActivationTier {
  minUnits: number
  /** ¿Ya alcanzado? Viene de `tier_demand.unlocked`, que lo calcula el servidor. */
  unlocked?: boolean
}

export interface Activation {
  /** ¿Puede este grupo comprar hoy? */
  activated: boolean
  /** Unidades totales que hacen falta para arrancar. 0 si no hay pujas. */
  targetUnits: number
  /** Cuántas faltan. 0 cuando ya está activado. */
  unitsToActivate: number
}

export function getActivation(
  tiers: ActivationTier[],
  committedUnits: number,
  minExecution: number,
): Activation {
  // Sin pujas no hay grupo que activar ni precio que enseñar.
  if (!tiers || tiers.length === 0) {
    return { activated: false, targetUnits: 0, unitsToActivate: 0 }
  }

  const firstTierUnits = Math.min(...tiers.map(t => Number(t.minUnits) || 0))
  const targetUnits = Math.max(Number(minExecution) || 0, firstTierUnits)
  const units = Number(committedUnits) || 0

  return {
    activated: units >= targetUnits,
    targetUnits,
    unitsToActivate: Math.max(0, targetUnits - units),
  }
}
