/**
 * La escalera de precios, en un solo sitio.
 *
 * POR QUÉ EXISTE ESTE FICHERO. El 15-sep-2026 Benjamin mandó cuatro capturas del
 * mismo producto —las zapatillas Shimano RC503— donde cada pantalla decía una cosa
 * distinta. La ficha: «faltan 8 uds para 99 €». Mis grupos, del mismo grupo y al mismo
 * tiempo: «22 / 20 uds · Faltan 0 uds · 100 % completado».
 *
 * Los datos de producción en ese momento:
 *
 *   tramo 119 € (≥  1 ud)  → demanda efectiva  8  → DESBLOQUEADO
 *   tramo  99 € (≥ 20 uds) → demanda efectiva 12  → bloqueado
 *   tramo  85 € (≥ 45 uds) → demanda efectiva 22  → bloqueado
 *
 * LA REGLA QUE SE INCUMPLÍA. `min_units` de un tramo se compara contra la demanda
 * efectiva DE ESE MISMO TRAMO. No contra el total de unidades comprometidas.
 *
 * Son cantidades distintas y no se pueden mezclar. La demanda efectiva a 99 € son las
 * unidades de quienes aceptan pagar 99 € o más: 12. Las 22 unidades comprometidas
 * incluyen además a quienes solo compran si baja a 85 €, que a 99 € no cuentan. Por eso
 * un grupo puede tener 22 unidades dentro y aun así no desbloquear el tramo de 20: no
 * son las 20 unidades correctas.
 *
 * La ficha lo hacía bien (`useTierDemand`). Mis grupos restaba el total comprometido,
 * daba 20 − 22 = −2 → 0, y anunciaba el 100 % de un tramo que el servidor marcaba como
 * bloqueado. Es una afirmación económica falsa en la pantalla donde el comprador
 * comprueba su dinero: si ese grupo cerrase ahí, el precio seguiría siendo 119 €.
 *
 * Era DT-07 —tres definiciones distintas de «siguiente tramo» y de «unidades»— cobrando
 * su precio. Ahora hay una, y vive aquí.
 *
 * El servidor sigue siendo la autoridad: `unlocked` viene de `tier_demand`, nunca se
 * recalcula en el cliente comparando números.
 */

export interface LadderTier {
  minUnits: number
  price: number
  /** Demanda efectiva A ESTE PRECIO. Distinta en cada tramo. */
  demand: number
  /** Lo dice el servidor. No se deduce comparando `demand` con `minUnits`. */
  unlocked: boolean
}

/**
 * Las filas de `tier_demand` llegan en dos formas según por dónde entren: en
 * `snake_case` si vienen de la RPC directa (Mis grupos) y en `camelCase` si pasan por
 * `/api/group/[id]/tier-demand` (la ficha). Aquí se aceptan las dos y se sale siempre
 * con la misma.
 */
export function normalizeLadder(rows: readonly unknown[] | null | undefined): LadderTier[] {
  if (!Array.isArray(rows)) return []
  return rows
    // Una fila nula o no-objeto tumbaba la función entera, y con ella la pantalla donde
    // el comprador consulta su dinero. Se descarta, no se rompe.
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map((r) => {
      const o = r
      const minUnits = Number(o.minUnits ?? o.min_units ?? 0)
      const price = Number(o.price ?? 0)
      const demand = Number(o.demand ?? o.effective_demand ?? 0)
      return {
        minUnits: Number.isFinite(minUnits) ? minUnits : 0,
        price: Number.isFinite(price) ? price : 0,
        demand: Number.isFinite(demand) ? demand : 0,
        unlocked: Boolean(o.unlocked),
      }
    })
    .filter((t) => t.price > 0)
}

/**
 * El precio vigente: el más barato de los tramos desbloqueados. Si no hay ninguno
 * desbloqueado —un grupo recién abierto— es el más caro de la escalera, que es lo que
 * pagaría quien entrase ahora.
 */
export function currentLadderPrice(tiers: readonly LadderTier[]): number {
  if (tiers.length === 0) return 0
  const unlocked = tiers.filter((t) => t.unlocked)
  return unlocked.length > 0
    ? Math.min(...unlocked.map((t) => t.price))
    : Math.max(...tiers.map((t) => t.price))
}

/**
 * Unidades comprometidas en el grupo, todas, sin filtrar por precio.
 *
 * Es el máximo de la columna de demanda porque el tramo más barato admite a todo el
 * mundo: quien acepta pagar 119 € también acepta 85 €, y el objetivo de un esperador
 * siempre es un precio de la escalera. Coincide con `group_committed_units` en el
 * servidor.
 *
 * SIRVE PARA: cuánta gente hay dentro, cuánto stock queda.
 * NO SIRVE PARA: medir la distancia a un tramo. Para eso está `ladderProgress`.
 */
export function committedUnits(tiers: readonly LadderTier[]): number {
  return tiers.length > 0 ? Math.max(...tiers.map((t) => t.demand)) : 0
}

export interface LadderProgress {
  /** El tramo al que se aspira, o null si ya está el precio mínimo. */
  next: LadderTier | null
  /** Unidades que faltan para desbloquearlo. 0 si no hay tramo siguiente. */
  missing: number
  /** Unidades que ya cuentan PARA ESE TRAMO. El numerador honesto. */
  reached: number
  /** Umbral del tramo. El denominador honesto. */
  target: number
  /** Porcentaje del camino hecho hacia ese tramo. */
  pct: number
}

/**
 * Hacia qué tramo va el grupo y cuánto le falta.
 *
 * `next` es el tramo bloqueado más barato de alcanzar entre los que están por debajo
 * del precio actual: se ordena por unidades que faltan y, a igualdad, por precio. Un
 * tramo más barato pero mucho más lejos no es el «siguiente» que espera el comprador.
 */
export function ladderProgress(tiers: readonly LadderTier[]): LadderProgress {
  const price = currentLadderPrice(tiers)
  const next =
    [...tiers]
      .filter((t) => !t.unlocked && t.price < price)
      .sort((a, b) => {
        const ma = Math.max(0, a.minUnits - a.demand)
        const mb = Math.max(0, b.minUnits - b.demand)
        if (ma !== mb) return ma - mb
        return a.price - b.price
      })[0] ?? null

  if (!next) {
    return { next: null, missing: 0, reached: committedUnits(tiers), target: 0, pct: 100 }
  }

  // Aquí está la regla: el umbral del tramo contra la demanda DE ESE TRAMO.
  const reached = Math.min(next.demand, next.minUnits)
  const missing = Math.max(0, next.minUnits - next.demand)
  const pct = next.minUnits > 0 ? Math.min(100, Math.round((reached / next.minUnits) * 100)) : 100

  return { next, missing, reached, target: next.minUnits, pct }
}
