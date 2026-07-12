// Regla de ventana de cierre — protección contra holds de Stripe expirados.
//
// POR QUÉ EXISTE: las autorizaciones de tarjeta en Stripe caducan a los 7 días
// exactos. Un miembro que se une el primer minuto de vida del grupo tiene el
// hold más antiguo al cierre. Si el grupo vive más de 7 días, ese hold estará
// muerto cuando close_group intente capturarlo (incidente del cierre del 5 jul
// 2026: 3 capturas fallidas por holds de 7d+). Límite: 6,5 días (156 h), con
// 12 h de margen sobre el límite de Stripe para absorber retrasos del cron.

export const MAX_CLOSE_WINDOW_HOURS = 156 // 6,5 días

/**
 * Instante UTC (ISO) que corresponde a las 22:00 de Europe/Madrid en la fecha
 * dada, ajustando automáticamente al cambio de hora (DST):
 *   verano (CEST, UTC+2) → 20:00 UTC · invierno (CET, UTC+1) → 21:00 UTC.
 * Sustituye al antiguo `${fecha}T20:00:00+00:00` fijo, que en invierno cerraba
 * a las 21:00 Madrid en vez de las 22:00.
 * @param dateStr fecha 'YYYY-MM-DD'
 */
export function madridCloseAtISO(dateStr: string): string {
  // Offset de Madrid ese día, medido a mediodía (lejos del borde del cambio de hora).
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid', timeZoneName: 'shortOffset',
  }).formatToParts(new Date(`${dateStr}T12:00:00Z`))
  const tz = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1' // "GMT+2" | "GMT+1"
  const offset = parseInt(tz.replace('GMT', ''), 10) || 1 // 2 (verano) | 1 (invierno)
  const utcHour = 22 - offset // 20 (verano) | 21 (invierno)
  return `${dateStr}T${String(utcHour).padStart(2, '0')}:00:00.000Z`
}

/**
 * Valida que una fecha de cierre esté dentro de la ventana segura.
 * @param closesAtIso fecha de cierre (ISO o parseable por Date)
 * @param anchorIso opcional: fecha del hold vivo más antiguo del grupo.
 *   Si se pasa, la ventana se mide desde ahí (no desde ahora) — un grupo
 *   con compradores dentro no puede extender su cierre más allá de lo que
 *   aguantan los holds ya creados.
 * @returns mensaje de error, o null si es válida
 */
export function validateCloseWindow(closesAtIso: string, anchorIso?: string): string | null {
  const closesAt = new Date(closesAtIso)
  if (isNaN(closesAt.getTime())) return 'Fecha de cierre inválida'

  const now = Date.now()

  if (closesAt.getTime() <= now) {
    return 'La fecha de cierre debe estar en el futuro'
  }

  // Ancla: el hold vivo más antiguo si existe (y es anterior a ahora); si no, ahora.
  let anchor = now
  if (anchorIso) {
    const a = new Date(anchorIso).getTime()
    if (!isNaN(a) && a < now) anchor = a
  }

  const diffHours = (closesAt.getTime() - anchor) / (1000 * 60 * 60)

  if (diffHours > MAX_CLOSE_WINDOW_HOURS) {
    const maxDate = new Date(anchor + MAX_CLOSE_WINDOW_HOURS * 60 * 60 * 1000)
    const fmt = new Intl.DateTimeFormat('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
    }).format(maxDate)
    const motivo = anchor < now
      ? `Motivo: hay compradores con holds de Stripe desde hace días y caducan a los 7; el cierre no puede superar ese límite.`
      : `Motivo: los holds de Stripe caducan a los 7 días y las capturas fallarían al cierre.`
    return `La fecha de cierre no puede superar el ${fmt}. ${motivo}`
  }

  return null
}
