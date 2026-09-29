/**
 * Taxonomía de categorías de Gropo.
 *
 * DISEÑO GENERALISTA: las categorías definen la estructura del marketplace
 * entero, no solo ciclismo. Cada categoría tiene slug, nombre y descripción
 * SEO. Cuando una categoría NO tiene grupos abiertos, no aparece en el
 * catálogo ni en el sitemap (regla: cero páginas vacías).
 *
 * MIGRACIÓN PENDIENTE: hoy no existe columna `category` en `groups`. Todas
 * las queries usan la función `getGroupCategorySlugs()` que, hasta que se
 * añada la columna, devuelve ['ciclismo'] para todo. La arquitectura ya
 * está lista: cuando se añada `category TEXT` a `groups`, solo hay que
 * cambiar la query en la página de categoría y el mapper aquí.
 */

export interface Category {
  slug: string
  name: string
  /** Meta description para la página de categoría */
  description: string
  /** Heading largo para la página de categoría (H1) */
  heading: string
  /** Keywords adicionales de la categoría */
  keywords: string[]
}

/**
 * Catálogo completo de categorías.
 * Orden = orden de display en el índice y en el footer.
 */
export const CATEGORIES: Category[] = [
  {
    slug: 'ciclismo',
    name: 'Ciclismo',
    description:
      'Compra colectiva de material de ciclismo: bicicletas, componentes, equipamiento y accesorios al mejor precio. Cuantos más sois, menos pagáis.',
    heading: 'Material de ciclismo en compra colectiva',
    keywords: ['ciclismo', 'bicicletas', 'componentes ciclismo', 'equipamiento ciclismo'],
  },
  {
    slug: 'electronica',
    name: 'Electrónica',
    description:
      'Compra colectiva de electrónica: móviles, ordenadores, auriculares, gadgets y más. Agrupa tu demanda y paga menos.',
    heading: 'Electrónica en compra colectiva',
    keywords: ['electrónica', 'móviles', 'ordenadores', 'gadgets'],
  },
  {
    slug: 'hogar',
    name: 'Hogar',
    description:
      'Compra colectiva de productos para el hogar: electrodomésticos, muebles, decoración y más. Mejores precios comprando juntos.',
    heading: 'Productos para el hogar en compra colectiva',
    keywords: ['hogar', 'electrodomésticos', 'muebles', 'decoración'],
  },
  {
    slug: 'deporte',
    name: 'Deporte',
    description:
      'Compra colectiva de material deportivo: fitness, running, natación, outdoor y más. El precio baja según se une más gente.',
    heading: 'Material deportivo en compra colectiva',
    keywords: ['deporte', 'fitness', 'running', 'material deportivo'],
  },
  {
    slug: 'moda',
    name: 'Moda',
    description:
      'Compra colectiva de moda: ropa, calzado, accesorios y complementos. Compra en grupo y paga menos.',
    heading: 'Moda en compra colectiva',
    keywords: ['moda', 'ropa', 'calzado', 'accesorios'],
  },
  {
    slug: 'alimentacion',
    name: 'Alimentación',
    description:
      'Compra colectiva de alimentación: productos gourmet, ecológicos, suplementos y más. Descuentos por volumen comprando juntos.',
    heading: 'Alimentación en compra colectiva',
    keywords: ['alimentación', 'gourmet', 'ecológico', 'suplementos'],
  },
]

/** Mapa slug → Category para lookups rápidos */
export const CATEGORY_MAP = new Map(CATEGORIES.map(c => [c.slug, c]))

/**
 * Obtiene la categoría por slug.
 */
export function getCategory(slug: string): Category | undefined {
  return CATEGORY_MAP.get(slug)
}

/**
 * Devuelve los slugs de categoría de un grupo.
 *
 * HOY: sin columna `category` en BD, devuelve ['ciclismo'] para todo grupo.
 * FUTURO: leer de `groups.category` o de una tabla de relación.
 */
export function getGroupCategorySlugs(_groupId: string): string[] {
  return ['ciclismo']
}

/**
 * Slugs válidos para generateStaticParams.
 * Solo exportamos las que podrían tener contenido.
 */
export const CATEGORY_SLUGS = CATEGORIES.map(c => c.slug)
