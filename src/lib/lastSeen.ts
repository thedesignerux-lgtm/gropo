/**
 * «Desde la última vez que estuve aquí» — la marca de visita de `/notificaciones`.
 *
 * Vive en el navegador, no en la base de datos, y es una decisión deliberada: el feed
 * tiene que funcionar para el comprador INVITADO, que es la mayoría —26 de 28 con
 * compra viva no tienen cuenta (A-15)—. Guardarlo en servidor exigiría identidad, que
 * es justo lo que ese comprador no tiene.
 *
 * El coste: la marca es por navegador. Quien mire desde el móvil y luego desde el
 * portátil verá las novedades dos veces. Para un feed de actividad es un coste
 * razonable; para algo que hubiera que marcar como leído de verdad, no lo sería.
 */
const KEY = 'gropo_notifs_last_seen'

export function readLastSeen(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null   // modo privado, o almacenamiento bloqueado: se trata como primera visita
  }
}

export function markSeen(at: Date = new Date()): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, at.toISOString())
  } catch {
    /* sin almacenamiento: el feed sigue funcionando, solo que todo se ve nuevo */
  }
}
