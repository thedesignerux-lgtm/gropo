import { createHash } from "crypto";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Falta STRIPE_SECRET_KEY en las variables de entorno");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * P0-04 · Clave de idempotencia derivada de los PARAMETROS REALES de la llamada.
 *
 * Stripe exige que una misma clave se use siempre con los mismos parametros; si
 * difieren, rechaza la peticion con un error. Una clave escrita a mano (grupo +
 * telefono + cantidad) no cumple esa invariante en cuanto algo del payload varia
 * por su cuenta — por ejemplo el `customer`, que para un invitado se crea nuevo
 * en cada intento. Derivandola del payload, "misma clave" y "mismos parametros"
 * no pueden contradecirse nunca:
 *   · peticion identica  -> misma clave  -> Stripe devuelve el MISMO objeto
 *   · peticion distinta  -> clave nueva  -> se crea uno nuevo, sin error
 */
export function idempotencyKeyFor(prefix: string, params: unknown): string {
  const hash = createHash('sha256').update(JSON.stringify(params)).digest('hex');
  return `${prefix}-${hash.slice(0, 48)}`;
}
