// A-25 · El email es la LLAVE del pedido, no un dato de contacto más.
//
// `get_my_groups(phone, email)` exige que coincidan LOS DOS, así que un email mal
// escrito deja al comprador con el dinero retenido, sin correo de confirmación y
// con su pedido invisible en /mis-grupos y /notificaciones — sin ninguna forma de
// darse cuenta, porque «no me llega el email» es indistinguible de «tarda».
//
// Lo que había hasta el 14-sep-2026 era PEOR que no validar: el sistema comprobaba
// el formato, pero AL LEER en vez de AL ESCRIBIR, y en silencio.
//
//   entrada  — `create-intent` solo miraba que el campo existiera; `prepare_join` y
//              `confirm_join` no lo miran (solo normalizan el teléfono); el <input
//              type="email"> no está dentro de un <form>, así que el navegador
//              tampoco lo valida. Un `pepe` entraba y se guardaba en `users.email`.
//   lectura  — `get_my_groups` SÍ valida (`v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'`)
//              y ante un email con mala forma devuelve `{"groups": []}`: lista
//              VACÍA, sin error. `_profile_uid` hace lo mismo devolviendo null.
//
// Es decir: el pedido existía, el dinero estaba retenido, y las dos pantallas donde
// consultarlo mostraban el estado de «no tienes nada». Comprobado en producción.
//
// LA REGEX ES LA MISMA QUE LA DE `get_my_groups`, a propósito. Si esta fuera más
// laxa quedaría una franja de emails que el checkout acepta y la recuperación
// rechaza — exactamente el agujero que esto viene a cerrar. Si algún día se cambia
// una, hay que cambiar la otra.
//
// Deliberadamente permisivo por lo demás: esto NO intenta decidir si una dirección
// existe —eso no se puede saber sin mandarle un correo— sino descartar lo que es
// seguro que no puede entregarse. Rechazar de más en un checkout es peor que dejar
// pasar de menos: un cliente legítimo bloqueado es una venta perdida.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Minúsculas y sin espacios alrededor, igual que el `lower(trim(p_email))` de
 * `get_my_groups`. El trim importa de verdad: la comparación del lado SQL es
 * `lower(u.email) = v_email` **sin trim en la columna**, así que un email guardado
 * con un espacio pegado (lo normal al pegar desde otra app) no vuelve a encontrarse.
 */
export function normalizeEmail(raw: string): string {
  return (raw || '').trim().toLowerCase()
}

/** ¿Tiene forma de dirección entregable? No dice si existe. */
export function isValidEmail(raw: string): boolean {
  const e = normalizeEmail(raw)
  // Sin mínimo propio: la regex ya exige a@b.c. Poner uno más alto crearía justo la
  // franja que el comentario de arriba dice evitar. El máximo de 254 es el límite
  // real de una dirección; por encima no es entregable en ningún caso.
  if (e.length > 254) return false
  return EMAIL_RE.test(e)
}
