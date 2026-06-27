export interface Tier {
  minUnits: number
  price: number
}

export interface GroupProduct {
  id: string
  name: string
  variant: string
  pvp: number
  currentUnits: number
  priceMode: 'stepped'
  tiers: Tier[]
  minExecution: number
  imageUrl?: string
}

export interface StepPricingResult {
  currentPrice: number
  currentTierMinUnits: number
  nextTier: Tier | null
  unitsToNext: number
}

/**
 * @deprecated Para la ficha de producto, usar useTierDemand hook en su lugar.
 * Esta función sigue siendo válida para las tarjetas del Home (ProductCard, DesktopProductCard).
 */
export function getStepPricing(tiers: Tier[], currentUnits: number): StepPricingResult {
  let idx = 0
  for (let i = 0; i < tiers.length; i++) {
    if (tiers[i].minUnits <= currentUnits) idx = i
  }
  const currentTier = tiers[idx]
  const nextTier = idx < tiers.length - 1 ? tiers[idx + 1] : null
  return {
    currentPrice: currentTier.price,
    currentTierMinUnits: currentTier.minUnits,
    nextTier,
    unitsToNext: nextTier ? nextTier.minUnits - currentUnits : 0,
  }
}

export interface Milestone {
  units: number
  price: number
}

/**
 * @deprecated Para la ficha de producto, usar useTierDemand + ProgressToNextPrice.
 * Sigue siendo válida para las tarjetas del Home.
 */
export function getMilestones(tiers: Tier[], minExecution: number): Milestone[] {
  if (tiers.length === 0) return []
  return [
    { units: minExecution, price: tiers[0].price },
    ...tiers.slice(1).map(t => ({ units: t.minUnits, price: t.price })),
  ]
}

export interface ActivationState {
  activated: boolean
  unitsToActivate: number
  nextTier: Tier | null
  unitsToNext: number
}

/**
 * @deprecated Para la ficha de producto, usar useTierDemand hook.
 * Sigue siendo válida para las tarjetas del Home.
 */
export function getActivationState(tiers: Tier[], totalUnits: number, minExecution: number): ActivationState {
  const step = tiers.length > 0 ? getStepPricing(tiers, totalUnits) : null
  return {
    activated: totalUnits >= minExecution,
    unitsToActivate: Math.max(0, minExecution - totalUnits),
    nextTier: step?.nextTier ?? null,
    unitsToNext: step?.unitsToNext ?? 0,
  }
}
