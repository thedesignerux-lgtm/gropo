// src/lib/local-identity.ts
//
// Identidad local del comprador: nombre, email y teléfono guardados en el
// navegador para no volver a pedirlos en cada formulario, y para que
// `/notificaciones` sepa por quién preguntar en `get_my_groups`.
//
// ⚠️ NO es una sesión. La sesión es la cookie de Supabase. Perder esto no
// echa a nadie: deja los formularios sin rellenar y las notificaciones vacías
// hasta que el comprador se vuelva a identificar.
//
// ── Por qué existe este módulo (UX-16) ─────────────────────────────────────
// La clave se llamaba `vonda_user`, el último resto de la marca antigua en
// runtime. Renombrarla a secas habría vaciado el prefill de todo el que ya la
// tuviera, así que se lee la vieja como respaldo y se reescribe en la nueva la
// primera vez: nadie pierde nada y la clave antigua deja de usarse sola.
//
// De paso, la lectura estaba copiada con su try/catch en seis ficheros, cada
// uno con su forma de fallar. Ahora hay una sola.

const KEY = 'gropo_user';
/** Nombre anterior. Se sigue leyendo para no perder el prefill de quien ya lo
 *  tenga. Se puede retirar cuando haya pasado tiempo suficiente desde el
 *  despliegue (los navegadores ya migrados no vuelven a tocarla). */
const LEGACY_KEY = 'vonda_user';

export interface LocalIdentity {
  name?: string;
  email?: string;
  phone?: string;
  /** Datos de la última compra: solo para rellenar la pantalla de confirmación. */
  quantity?: number;
  price?: number;
  address_line1?: string;
}

const EMPTY: LocalIdentity = {};

function parse(raw: string | null): LocalIdentity | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as LocalIdentity) : null;
  } catch {
    return null;
  }
}

/**
 * Devuelve la identidad guardada. Nunca lanza: si no hay nada, si el JSON está
 * corrupto o si el navegador tiene el almacenamiento bloqueado (modo privado,
 * cookies de terceros), devuelve un objeto vacío.
 */
export function readLocalIdentity(): LocalIdentity {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const current = parse(localStorage.getItem(KEY));
    if (current) return current;

    // Migración desde la clave antigua, una sola vez por navegador.
    const legacy = parse(localStorage.getItem(LEGACY_KEY));
    if (legacy) {
      try { localStorage.setItem(KEY, JSON.stringify(legacy)); } catch { /* sin espacio o bloqueado */ }
      return legacy;
    }
  } catch { /* localStorage inaccesible */ }
  return EMPTY;
}

/**
 * Guarda los campos indicados **fusionándolos** con lo que ya hubiera.
 *
 * Antes cada pantalla sobrescribía el objeto entero, así que editar el nombre
 * en el perfil borraba la cantidad y el precio de la última compra que había
 * guardado el checkout. Fusionar lo evita.
 */
export function saveLocalIdentity(patch: Partial<LocalIdentity>): void {
  if (typeof window === 'undefined') return;
  try {
    const next = { ...readLocalIdentity(), ...patch };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* mejor no guardar que romper el flujo */ }
}

/** Borra la identidad local. Limpia también la clave antigua. */
export function clearLocalIdentity(): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(KEY); } catch { /* ignorar */ }
  try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignorar */ }
}
