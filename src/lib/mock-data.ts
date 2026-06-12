export interface GroupProduct {
  id: string
  name: string
  variant: string
  currentPrice: number
  pvp: number
  currentUnits: number
  previousTierUnits: number
  nextTierUnits: number
  nextTierPrice: number
}

export const groupProducts: GroupProduct[] = [
  {
    id: "continental-gp5000",
    name: "Cubierta Continental GP5000",
    variant: "700×25 · Carretera",
    currentPrice: 38.90,
    pvp: 54.95,
    currentUnits: 14,
    previousTierUnits: 0,
    nextTierUnits: 20,
    nextTierPrice: 36.50,
  },
  {
    id: "shimano-105-pd-r7000",
    name: "Pedales Shimano 105 PD-R7000",
    variant: "Carretera · Calas incluidas",
    currentPrice: 89.90,
    pvp: 114.95,
    currentUnits: 18,
    previousTierUnits: 0,
    nextTierUnits: 30,
    nextTierPrice: 79.00,
  },
  {
    id: "giro-agilis-mips",
    name: "Casco Giro Agilis MIPS",
    variant: "Carretera · Ventilado",
    currentPrice: 79.90,
    pvp: 105.00,
    currentUnits: 12,
    previousTierUnits: 0,
    nextTierUnits: 20,
    nextTierPrice: 69.00,
  },
  {
    id: "garmin-varia-rtl515",
    name: "Luz trasera Garmin Varia RTL515",
    variant: "Radar · 65 lúmenes",
    currentPrice: 139.90,
    pvp: 174.90,
    currentUnits: 7,
    previousTierUnits: 0,
    nextTierUnits: 15,
    nextTierPrice: 129.00,
  },
]
