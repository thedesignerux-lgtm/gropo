// Badge de estado de un grupo (solo presentación; no toca la BD).
//
// Regla de "petición": un grupo open con CERO pujas activas aún no tiene
// vendedor → se muestra en amarillo como "Petición". Con ≥1 puja activa
// es un grupo vivo normal → "Abierto" en verde. closing/closed/cancelled
// se muestran tal cual.

export interface Badge {
  label: string
  cls: string
}

const STATUS_BADGE: Record<string, Badge> = {
  open:      { label: 'Abierto',   cls: 'bg-green-100 text-green-700' },
  closing:   { label: 'Cerrando', cls: 'bg-orange-100 text-orange-700' },
  closed:    { label: 'Cerrado',   cls: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-100 text-red-600' },
}

const PETITION_BADGE: Badge = { label: 'Petición', cls: 'bg-yellow-100 text-yellow-700' }

export function resolveGroupBadge(status: string, activeBidCount: number): Badge {
  if (status === 'open' && activeBidCount === 0) return PETITION_BADGE
  return STATUS_BADGE[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
}
