/**
 * Registro de documentos legales.
 *
 * El orden de este array es el orden del índice de /legal y el del footer. No es
 * alfabético a propósito: primero lo que necesita un comprador (qué compro, qué pasa
 * con mi dinero), después lo que necesita un vendedor, y al final lo institucional.
 * Un usuario que entra a /legal buscando «me han cobrado de más» no debería tener que
 * pasar por la política de propiedad intelectual para llegar a devoluciones.
 */
import type { LegalDoc } from '@/lib/legal'

import avisoLegal from './aviso-legal'
import terminos from './terminos'
import condicionesCompra from './condiciones-compra'
import devoluciones from './devoluciones'
import privacidad from './privacidad'
import cookies from './cookies'
import condicionesVendedores from './condiciones-vendedores'
import propiedadIntelectual from './propiedad-intelectual'
import productosProhibidos from './productos-prohibidos'
import reportarProblema from './reportar-problema'

export type LegalGroup = 'comprar' | 'vender' | 'plataforma'

export interface LegalEntry {
  doc: LegalDoc
  group: LegalGroup
}

export const LEGAL_ENTRIES: LegalEntry[] = [
  { doc: condicionesCompra, group: 'comprar' },
  { doc: devoluciones, group: 'comprar' },
  { doc: terminos, group: 'comprar' },
  { doc: condicionesVendedores, group: 'vender' },
  { doc: productosProhibidos, group: 'vender' },
  { doc: reportarProblema, group: 'vender' },
  { doc: avisoLegal, group: 'plataforma' },
  { doc: privacidad, group: 'plataforma' },
  { doc: cookies, group: 'plataforma' },
  { doc: propiedadIntelectual, group: 'plataforma' },
]

export const LEGAL_GROUP_LABEL: Record<LegalGroup, string> = {
  comprar: 'Comprar en Gropo',
  vender: 'Vender en Gropo',
  plataforma: 'La plataforma',
}

export const LEGAL_DOCS: LegalDoc[] = LEGAL_ENTRIES.map((e) => e.doc)

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug)
}

export const LEGAL_SLUGS: string[] = LEGAL_DOCS.map((d) => d.slug)
