import type { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { SITE_URL } from '@/lib/site'
import { LEGAL_SLUGS } from '@/content/legal'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = []

  // ── Páginas estáticas ──
  entries.push(
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/como-funciona`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/ayuda`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  )

  // ── Páginas legales ──
  for (const slug of LEGAL_SLUGS) {
    entries.push({
      url: `${SITE_URL}/legal/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    })
  }

  // ── Grupos abiertos (páginas de producto) ──
  const { data: groups } = await supabaseAdmin
    .from('groups')
    .select('id, created_at')
    .eq('status', 'open')
    .eq('is_demo', false)
    .order('created_at', { ascending: false })

  for (const g of groups ?? []) {
    entries.push({
      url: `${SITE_URL}/grupo/${g.id}`,
      lastModified: g.created_at ? new Date(g.created_at) : new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    })
  }

  return entries
}
