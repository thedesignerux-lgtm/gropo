/**
 * A-09 · Cómo se escribe un AHORRO en Gropo.
 *
 * El problema real, con datos de producción: los PVP de verdad acaban en ,99 o ,95
 * (Garmin 599,99 €, Casco Giro 329,99 €, Zapatillas 159,99 €) y nuestros precios son
 * redondos, así que el ahorro sale con céntimos en unos productos y sin ellos en otros.
 * En la misma fila del carrusel se leía «−150,99 €» junto a «−281 €» y «−750 €». No es
 * un dato del catálogo que se pueda limpiar: mientras haya PVP acabados en ,99 volverá.
 *
 * LA REGLA (decidida por Benjamin el 15 sep 2026): el ahorro se escribe redondeado al
 * euro en TODAS las pantallas. Es una cifra comparativa, no un importe que se cobra:
 *
 *   · Lo que se COBRA —precio, total, envío, importe del hold— sigue exacto al céntimo
 *     y no pasa por aquí. Esa autoridad es del servidor (PAYMENTS.md).
 *   · Lo que se COMPARA —«Ahorras X», «−X», «Ahorro vs PVP»— pasa por `fmtSaving`.
 *
 * El precio en tienda tachado que acompaña al ahorro NO se redondea: es un dato del
 * vendedor, no nuestro. Por eso en el checkout se lee «599,99 € · Ahorras 151 €»: los
 * dos números son verdad, y el que se paga —449 €— está justo encima, exacto.
 *
 * Una sola función, importada en todas partes, a propósito: tener el mismo cálculo
 * copiado en cada fichero es lo que produjo A-36 en la escalera de tramos.
 */
export function fmtSaving(n: number): string {
  if (!Number.isFinite(n)) return '0 €'
  return String(Math.max(0, Math.round(n))) + ' €'
}
