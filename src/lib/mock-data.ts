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

// Hitos de la barra: el primero es la ACTIVACIÓN (min_execution unidades al
// precio del tramo 1); el resto, las bajadas de precio de los tramos siguientes.
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

// Estado de activación + siguiente tramo, compartido entre la ficha y la tarjeta.
export function getActivationState(tiers: Tier[], totalUnits: number, minExecution: number): ActivationState {
  const step = tiers.length > 0 ? getStepPricing(tiers, totalUnits) : null
  return {
    activated: totalUnits >= minExecution,
    unitsToActivate: Math.max(0, minExecution - totalUnits),
    nextTier: step?.nextTier ?? null,
    unitsToNext: step?.unitsToNext ?? 0,
  }
}
