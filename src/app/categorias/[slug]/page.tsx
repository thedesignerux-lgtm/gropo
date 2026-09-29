import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SITE_URL } from '@/lib/site'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { CATEGORY_SLUGS, getCategory, getGroupCategorySlugs } from '@/lib/categories'
import { countOpenGroupsByCategory } from '@/lib/category-counts'
import type { Tier } from '@/lib/mock-data'
import DesktopNavbar from '@/components/desktop/DesktopNavbar'
import BottomNav from '@/components/BottomNav'
import SiteFooter from '@/components/SiteFooter'
import Breadcrumbs from '@/components/Breadcrumbs'
import JsonLd from '@/components/seo/JsonLd'

export const dynamic = 'force-dynamic'

export function generateStaticParams() {
  return CATEGORY_SLUGS.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const cat = getCategory(params.slug)
  if (!cat) return {}

  // Una categoría sin grupos abiertos es una página vacía: se muestra al usuario
  // (con su «próximamente») pero no se ofrece a Google. Se indexa sola en cuanto
  // tenga el primer grupo, sin tocar código.
  const counts = await countOpenGroupsByCategory()
  const hasGroups = (counts.get(cat.slug) ?? 0) > 0

  return {
    ...(hasGroups ? {} : { robots: { index: false, follow: true } }),
    title: `${cat.name} — Compra colectiva de ${cat.name.toLowerCase()}`,
    description: cat.description,
    alternates: { canonical: `${SITE_URL}/categorias/${cat.slug}` },
    keywords: [...cat.keywords, 'compra colectiva', 'comprar en grupo', 'Gropo'],
    openGraph: {
      title: `${cat.name} — Compra colectiva en Gropo`,
      description: cat.description,
      url: `${SITE_URL}/categorias/${cat.slug}`,
      siteName: 'Gropo',
    },
  }
}

interface CategoryGroup {
  id: string
  name: string
  spec: string
  imageUrl?: string
  pvp: number
  bestPrice: number
  memberCount: number
  tiers: Tier[]
}

/**
 * Obtiene los grupos abiertos de una categoría.
 *
 * HOY: sin columna `category`, filtramos en JS con getGroupCategorySlugs().
 * FUTURO: .eq('category', slug) directo en la query.
 */
async function fetchCategoryGroups(categorySlug: string): Promise<CategoryGroup[]> {
  const { data } = await supabaseAdmin
    .from('groups')
    .select('id, product_name, product_spec, pvp, image_url, current_price')
    .eq('status', 'open')
    .eq('is_demo', false)
    .order('created_at', { ascending: false })

  if (!data) return []

  const groups: CategoryGroup[] = []

  for (const row of data) {
    const slugs = getGroupCategorySlugs(row.id)
    if (!slugs.includes(categorySlug)) continue

    // Tiers
    const { data: ladder } = await supabaseAdmin.rpc('tier_demand', { p_group_id: row.id })
    const tiers: Tier[] = (Array.isArray(ladder) ? ladder : []).map((t: any) => ({
      minUnits: Number(t.min_units),
      price: Number(t.price),
    }))

    // Member count
    const { count } = await supabaseAdmin
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', row.id)
      .in('payment_status', ['authorized', 'instructed', 'paid'])

    const currentPrice = Number(row.current_price ?? row.pvp)

    groups.push({
      id: row.id,
      name: row.product_name as string,
      spec: (row.product_spec ?? '') as string,
      imageUrl: (row.image_url as string | null) ?? undefined,
      pvp: Number(row.pvp ?? 0),
      bestPrice: currentPrice,
      memberCount: count ?? 0,
      tiers,
    })
  }

  return groups
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const cat = getCategory(params.slug)
  if (!cat) notFound()

  const groups = await fetchCategoryGroups(params.slug)

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: cat.heading,
    description: cat.description,
    url: `${SITE_URL}/categorias/${cat.slug}`,
    isPartOf: { '@type': 'WebSite', name: 'Gropo', url: SITE_URL },
    ...(groups.length > 0
      ? {
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: groups.length,
            itemListElement: groups.map((g, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `${SITE_URL}/grupo/${g.id}`,
              name: g.spec ? `${g.name} — ${g.spec}` : g.name,
            })),
          },
        }
      : {}),
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
      <JsonLd data={collectionLd} />
      <div className="hidden lg:block">
        <DesktopNavbar />
      </div>

      <main className="w-full max-w-[920px] mx-auto px-4 lg:px-10 pt-6 lg:pt-10 pb-14">
        <Breadcrumbs
          items={[
            { label: 'Gropo', href: '/' },
            { label: 'Categorías', href: '/categorias' },
            { label: cat.name, href: `/categorias/${cat.slug}` },
          ]}
        />

        <h1 className="text-[26px] lg:text-[34px] font-extrabold tracking-tight text-neutral-900 leading-tight">
          {cat.heading}
        </h1>
        <p className="text-[15px] text-neutral-500 mt-3 leading-relaxed max-w-[620px]">
          {cat.description}
        </p>

        {groups.length > 0 ? (
          <section className="mt-8">
            <p className="text-[13px] font-semibold text-neutral-400 uppercase tracking-wide mb-4">
              {groups.length} {groups.length === 1 ? 'grupo abierto' : 'grupos abiertos'}
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map(g => {
                const discount = g.pvp > 0
                  ? Math.round(((g.pvp - g.bestPrice) / g.pvp) * 100)
                  : 0
                return (
                  <Link
                    key={g.id}
                    href={`/grupo/${g.id}`}
                    className="bg-white border border-neutral-200 rounded-2xl overflow-hidden hover:border-brand/40 hover:shadow-sm transition-all group"
                  >
                    {/* Imagen */}
                    <div className="aspect-[4/3] bg-neutral-100 overflow-hidden">
                      {g.imageUrl ? (
                        <img
                          src={g.imageUrl}
                          alt={g.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-brand/10 to-brand/5 flex items-center justify-center">
                          <span className="text-4xl opacity-30">📦</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <h2 className="text-[15px] font-bold text-neutral-900 group-hover:text-brand transition-colors leading-snug">
                        {g.name}
                      </h2>
                      {g.spec && (
                        <p className="text-[12px] text-neutral-400 mt-0.5 truncate">{g.spec}</p>
                      )}
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-[17px] font-extrabold text-neutral-900">
                          {g.bestPrice.toFixed(0)} €
                        </span>
                        {discount > 0 && (
                          <>
                            <span className="text-[13px] text-neutral-400 line-through">
                              {g.pvp.toFixed(0)} €
                            </span>
                            <span className="text-[12px] font-bold text-emerald-600">
                              -{discount}%
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-[12px] text-neutral-400 mt-1.5">
                        {g.memberCount} {g.memberCount === 1 ? 'persona' : 'personas'} en el grupo
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ) : (
          <section className="mt-10 text-center py-12 bg-white border border-neutral-200 rounded-2xl">
            <p className="text-[15px] text-neutral-500">
              Todavía no hay grupos abiertos en esta categoría.
            </p>
            <p className="text-[13px] text-neutral-400 mt-2">
              Gropo es un marketplace en crecimiento. Los grupos de {cat.name.toLowerCase()} llegarán pronto.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-brand font-semibold text-[14px] mt-4 hover:underline"
            >
              Ver todos los grupos abiertos
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </section>
        )}

        {/* ── Internal linking ── */}
        <section className="mt-14">
          <h2 className="text-lg font-bold text-neutral-800 mb-4">
            Más categorías de compra colectiva
          </h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_SLUGS.filter(s => s !== params.slug).map(s => {
              const other = getCategory(s)
              if (!other) return null
              return (
                <Link
                  key={s}
                  href={`/categorias/${s}`}
                  className="text-[13px] font-medium text-neutral-600 bg-white border border-neutral-200 rounded-full px-3.5 py-1.5 hover:border-brand/40 hover:text-brand transition-colors"
                >
                  {other.name}
                </Link>
              )
            })}
          </div>
        </section>

        <p className="text-center text-[13px] text-neutral-400 mt-10">
          <Link href="/que-es-gropo" className="text-brand font-semibold hover:underline">
            Qué es Gropo
          </Link>
          {' · '}
          <Link href="/como-funciona" className="text-brand font-semibold hover:underline">
            Cómo funciona
          </Link>
          {' · '}
          <Link href="/categorias" className="text-brand font-semibold hover:underline">
            Todas las categorías
          </Link>
        </p>
      </main>

      <SiteFooter />
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
