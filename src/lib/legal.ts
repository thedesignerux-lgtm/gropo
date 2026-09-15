/**
 * Documentos legales de Gropo — tipos y utilidades.
 *
 * POR QUÉ SON DATOS Y NO JSX. Estos textos los va a revisar un abogado y los va a
 * editar Benjamin varias veces antes del lanzamiento. Si viven dentro de componentes
 * React, cada corrección de una coma obliga a tocar código. Como estructura tipada se
 * editan solos, se pueden auditar con un script y se pueden exportar el día que haya
 * que mandárselos a alguien.
 *
 * Tampoco se añade una librería de markdown: el formato que necesitan estos textos
 * —párrafos, listas, tablas simples— cabe en cuatro tipos, y una dependencia menos es
 * una dependencia menos que mantener.
 */

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'note'; text: string }
  | { type: 'table'; head: string[]; rows: string[][] }

export interface LegalSection {
  /** Número visible («1», «12»). Vacío para secciones sin numerar. */
  n?: string
  title?: string
  blocks: LegalBlock[]
}

export interface LegalDoc {
  slug: string
  /** Título de la página y del <h1>. */
  title: string
  /** Una línea que dice de qué va, para el índice y la metadescripción. */
  summary: string
  /** Bloques introductorios, antes de la primera sección numerada. */
  intro?: LegalBlock[]
  sections: LegalSection[]
}

/**
 * Marcador de dato pendiente. Los textos vienen con `[●]`, `[RAZÓN SOCIAL]`,
 * `[EMAIL]`… porque la sociedad todavía no está constituida.
 *
 * Esto NO es cosmético: una página legal con huecos no cumple su función —la LSSI pide
 * información identificativa real— y además da peor impresión que no tenerla. Por eso
 * se detectan automáticamente y las páginas que los contengan se marcan `noindex`.
 * Cuando Benjamin rellene los datos, el `noindex` desaparece solo. No hay que acordarse
 * de nada.
 */
const PLACEHOLDER = /\[(●|[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 /·.-]{2,})\]/

function blockText(b: LegalBlock): string {
  switch (b.type) {
    case 'p':
    case 'note':
      return b.text
    case 'list':
      return b.items.join(' ')
    case 'table':
      return [...b.head, ...b.rows.flat()].join(' ')
  }
}

/** ¿Este documento todavía tiene huecos por rellenar? */
export function hasPlaceholders(doc: LegalDoc): boolean {
  const todo = [...(doc.intro ?? []), ...doc.sections.flatMap((s) => s.blocks)]
  if (doc.sections.some((s) => s.title && PLACEHOLDER.test(s.title))) return true
  return todo.some((b) => PLACEHOLDER.test(blockText(b)))
}

/** Cuántos huecos quedan, para poder medir el avance sin leerse los diez documentos. */
export function countPlaceholders(doc: LegalDoc): number {
  const g = new RegExp(PLACEHOLDER.source, 'g')
  const todo = [...(doc.intro ?? []), ...doc.sections.flatMap((s) => s.blocks)]
  return todo.reduce((n, b) => n + (blockText(b).match(g)?.length ?? 0), 0)
}
