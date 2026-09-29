// Solo servidor: usa supabaseAdmin (service role). Nunca importar desde 'use client'.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getGroupCategorySlugs } from '@/lib/categories'

/**
 * Cuántos grupos abiertos y reales (no DEMO) hay en cada categoría.
 *
 * Una sola fuente para tres consumidores que tienen que estar de acuerdo:
 *   · /categorias           → qué categorías se muestran activas y cuáles «Próximamente»
 *   · /categorias/[slug]    → si la página es indexable (una categoría vacía NO lo es)
 *   · sitemap.xml           → qué categorías se anuncian a Google
 *
 * HOY: no existe `groups.category`; getGroupCategorySlugs() hace de mapper.
 * FUTURO: sustituir por un GROUP BY sobre la columna.
 */
export async function countOpenGroupsByCategory(): Promise<Map<string, number>> {
  const { data } = await supabaseAdmin
    .from('groups')
    .select('id')
    .eq('status', 'open')
    .eq('is_demo', false)

  const counts = new Map<string, number>()
  for (const g of data ?? []) {
    for (const slug of getGroupCategorySlugs(g.id as string)) {
      counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
  }
  return counts
}
