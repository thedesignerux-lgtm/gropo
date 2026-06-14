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

export const groupProducts: GroupProduct[] = [
  {
    id: 'continental-gp5000',
    name: 'Cubierta Continental GP5000',
    variant: '700×25 · Carretera',
    pvp: 54.95,
    currentUnits: 14,
    priceMode: 'stepped',
    tiers: [
      { minUnits: 1,  price: 48.90 },
      { minUnits: 6,  price: 44.90 },
      { minUnits: 10, price: 41.90 },
      { minUnits: 15, price: 38.90 },
      { minUnits: 20, price: 36.50 },
    ],
  },
  {
    id: 'shimano-105-pd-r7000',
    name: 'Pedales Shimano 105 PD-R7000',
    variant: 'Carretera · Calas incluidas',
    pvp: 114.95,
    currentUnits: 18,
    priceMode: 'stepped',
    tiers: [
      { minUnits: 1,  price: 104.90 },
      { minUnits: 8,  price: 97.90  },
      { minUnits: 15, price: 89.90  },
      { minUnits: 30, price: 79.00  },
    ],
  },
  {
    id: 'giro-agilis-mips',
    name: 'Casco Giro Agilis MIPS',
    variant: 'Carretera · Ventilado',
    pvp: 105.00,
    currentUnits: 12,
    priceMode: 'stepped',
    tiers: [
      { minUnits: 1,  price: 94.90 },
      { minUnits: 6,  price: 86.90 },
      { minUnits: 12, price: 79.90 },
      { minUnits: 20, price: 69.00 },
    ],
  },
  {
    id: 'garmin-varia-rtl515',
    name: 'Luz trasera Garmin Varia RTL515',
    variant: 'Radar · 65 lúmenes',
    pvp: 174.90,
    currentUnits: 7,
    priceMode: 'stepped',
    tiers: [
      { minUnits: 1,  price: 159.90 },
      { minUnits: 8,  price: 149.90 },
      { minUnits: 15, price: 139.90 },
    ],
  },
]
