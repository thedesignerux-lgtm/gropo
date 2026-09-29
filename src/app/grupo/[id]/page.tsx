import type { Metadata } from 'next'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { SITE_URL } from '@/lib/site'
import { getGroupCategorySlugs, getCategory } from '@/lib/categories'
import type { Tier } from '@/lib/mock-data'
import JsonLd from '@/components/seo/JsonLd'
import Breadcrumbs from '@/components/Breadcrumbs'
import HeroShareButton from '@/components/HeroShareButton'
import FavoriteButton from '@/components/FavoriteButton'
import BottomNav from '@/components/BottomNav'
import GroupLiveSection from '@/components/GroupLiveSection'
import GroupDesktopView from '@/components/desktop/GroupDesktopView'
import GroupCountdownBadge from '@/components/GroupCountdownBadge'
import GroupHowAndTrust from '@/components/GroupHowAndTrust'

export const dynamic = 'force-dynamic'

/* ── SEO: Metadata dinámica por producto ── */
export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('product_name, product_spec, pvp, image_url, current_price, status, is_demo')
    .eq('id', params.id)
    .single()

  if (!group) {
    return { title: 'Grupo no encontrado' }
  }

  const name = group.product_name as string
  const spec = ((group as any).product_spec ?? '') as string
  const pvp = Number((group as any).pvp ?? 0)
  const currentPrice = Number(group.current_price ?? pvp)
  const imageUrl = (group as any).image_url as string | null
  const discount = pvp > 0 ? Math.round(((pvp - currentPrice) / pvp) * 100) : 0

  const fullName = spec ? `${name} — ${spec}` : name
  const title = discount > 0
    ? `${name} desde ${currentPrice.toFixed(0)} € (-${discount}%) · Compra colectiva`
    : `${name} · Compra colectiva en Gropo`
  const description = `Compra ${fullName} en grupo y ahorra. ${
    discount > 0
      ? `Precio actual: ${currentPrice.toFixed(2)} € (PVP ${pvp.toFixed(2)} €, -${discount}%). `
      : ''
  }Únete al grupo y el precio baja para todos. Cuantos más sois, menos pagáis.`

  const url = `${SITE_URL}/grupo/${params.id}`

  // Solo los grupos abiertos y reales merecen índice. Los DEMO son una galería
  // interna (accesibles por URL) y los cerrados ya no se pueden comprar: se
  // quedan fuera del índice pero se siguen sus enlaces.
  const indexable = (group as any).status === 'open' && (group as any).is_demo !== true

  return {
    title,
    description,
    alternates: { canonical: url },
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      type: 'website',
      title: fullName,
      description,
      url,
      siteName: 'Gropo',
      ...(imageUrl ? { images: [{ url: imageUrl, alt: fullName }] } : {}),
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title: fullName,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  }
}

async function fetchGroup(id: string) {
  const { data: group, error } = await supabaseAdmin
    .from('groups')
    .select(`
      id, product_name, product_spec, pvp, image_url,
      total_units, current_price, next_price, closes_at, status
    `)
    .eq('id', id)
    .single()

  if (error || !group) return null

  let bestPrice = Number(group.current_price)
  let nextPrice = Number((group as any).next_price ?? group.current_price)
  let bestBidId: string | null = null
  const { data: rpc } = await supabaseAdmin.rpc('compute_price', { p_group_id: id })
  const row = (Array.isArray(rpc) ? rpc[0] : rpc) as any
  if (row) {
    if (row.best_price != null) bestPrice = Number(row.best_price)
    if (row.next_price != null) nextPrice = Number(row.next_price)
    bestBidId = row.best_bid_id ?? null
  }

  // Escalera FUSIONADA (D5): única fuente pública de tramos
  const { data: ladder } = await supabaseAdmin.rpc('tier_demand', { p_group_id: id })
  const tiers: Tier[] = (Array.isArray(ladder) ? ladder : []).map((t: any) => ({
    minUnits: Number(t.min_units),
    price: Number(t.price),
  }))

  // Stock mostrado = el de la puja que aporta el mejor precio actual
  let maxStock = 0
  let minExecution = 0
  if (bestBidId) {
    const { data: bid } = await supabaseAdmin
      .from('bids')
      .select('max_stock, min_execution')
      .eq('id', bestBidId)
      .single()
    if (bid) {
      maxStock = Number((bid as any).max_stock ?? 0)
      minExecution = Number((bid as any).min_execution ?? 0)
    }
  }

  const { count: bidCount } = await supabaseAdmin
    .from('bids')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', id)
    .eq('status', 'active')

  /**
   * A-04 · PERSONAS, que es un dato distinto de las UNIDADES.
   *
   * Hasta ahora la ficha decía «2 personas en el grupo» usando el número de
   * unidades: un comprador con 4 cámaras contaba como 4 «personas». En las cámaras
   * hay 20 personas y 57 unidades, así que el contador y la escalera no cuadraban.
   *
   * Decisión de producto (Benjamin, 14-sep-2026): se dicen LAS DOS COSAS, cada una
   * con su nombre. Personas para la fuerza colectiva, unidades para lo que mueve el
   * precio. Nunca el mismo número con dos nombres.
   *
   * Se cuenta aquí, en el servidor, y no con una RPC nueva: el número de personas
   * cambia despacio y no merece otra superficie pública. Los mismos estados de pago
   * que `group_committed_units` y `tier_demand`.
   */
  const { count: memberCount } = await supabaseAdmin
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', id)
    .in('payment_status', ['authorized', 'instructed', 'paid'])

  return {
    id: group.id as string,
    name: group.product_name as string,
    spec: ((group as any).product_spec ?? '') as string,
    pvp: Number((group as any).pvp ?? 0),
    imageUrl: ((group as any).image_url as string | null) ?? undefined,
    totalUnits: Number(group.total_units ?? 0),
    closesAt: group.closes_at as string,
    status: ((group as any).status ?? 'open') as string,
    bestPrice,
    nextPrice,
    bidCount: bidCount ?? 0,
    memberCount: memberCount ?? 0,
    tiers,
    maxStock,
    minExecution,
  }
}

export default async function GrupoPage({ params }: { params: { id: string } }) {
  const group = await fetchGroup(params.id)

  if (!group) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-base text-neutral-400">Grupo no encontrado</p>
      </div>
    )
  }

  /* ── Categoría del grupo (para breadcrumbs + schema) ── */
  const categorySlugs = getGroupCategorySlugs(group.id)
  const category = categorySlugs.length > 0 ? getCategory(categorySlugs[0]) : null

  const fullName = group.spec ? `${group.name} — ${group.spec}` : group.name

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: fullName,
    ...(group.imageUrl ? { image: group.imageUrl } : {}),
    description: `Compra ${group.name} en grupo a través de Gropo y consigue el mejor precio. Cuantos más se unen, menos paga cada uno.`,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      // Precio vigente = el máximo que pagará quien se una ahora (el cierre solo
      // puede bajarlo). Es el dato honesto; el PVP no es una oferta de Gropo.
      price: group.bestPrice.toFixed(2),
      ...(group.closesAt ? { priceValidUntil: group.closesAt.slice(0, 10) } : {}),
      availability: group.status === 'open'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/SoldOut',
      url: `${SITE_URL}/grupo/${group.id}`,
      // Sin `seller`: Gropo es intermediario, no vendedor, y la ficha todavía no
      // identifica al vendedor real (LEGAL.md §4.5). Mejor omitirlo que mentir.
    },
  }

  const breadcrumbItems = [
    { label: 'Gropo', href: '/' },
    ...(category
      ? [{ label: category.name, href: `/categorias/${category.slug}` }]
      : [{ label: 'Categorías', href: '/categorias' }]),
    { label: group.name, href: `/grupo/${group.id}` },
  ]

  return (
    <>
      <JsonLd data={productLd} />
      {/* ── DESKTOP (≥1024px) ── */}
      <div className="hidden lg:block">
        <GroupDesktopView
          breadcrumb={<Breadcrumbs items={breadcrumbItems} className="" />}
          groupId={group.id}
          name={group.name}
          spec={group.spec}
          pvp={group.pvp}
          imageUrl={group.imageUrl}
          initialBestPrice={group.bestPrice}
          initialTotalUnits={group.totalUnits}
          bidCount={group.bidCount}
          memberCount={group.memberCount}
          tiers={group.tiers}
          maxStock={group.maxStock}
          minExecution={group.minExecution}
          closesAt={group.closesAt}
        />
      </div>

      {/* ── MOBILE (<1024px) — 2d: Hero grande + barra fusionada ── */}
      <div className="lg:hidden bg-white">
        <div className="max-w-md mx-auto bg-white pb-16">
          {/* HERO IMAGE with gradient overlay (2d) */}
          <div
            className="relative w-full overflow-hidden shrink-0"
            style={{ aspectRatio: '1 / 0.78', background: '#1a1a1f' }}
          >
            {group.imageUrl ? (
              <img
                src={group.imageUrl}
                alt={group.name}
                className="absolute inset-0 w-full h-full object-cover opacity-[.88]"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-brand/20 to-brand/5" />
            )}

            {/* Top bar: back + share/heart */}
            <div className="absolute left-4 right-4 flex justify-between z-10" style={{ top: 'env(safe-area-inset-top, 12px)', paddingTop: 12 }}>
              <Link
                href="/"
                className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-neutral-800"
                style={{ background: 'rgba(255,255,255,.94)', boxShadow: '0 4px 12px -6px rgba(0,0,0,.4)' }}
                aria-label="Volver"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </Link>
              <div className="flex items-center gap-2.5">
                <HeroShareButton
                  productName={group.name}
                  bestPrice={group.bestPrice}
                  pvp={group.pvp}
                  nextPrice={group.nextPrice}
                  groupId={group.id}
                />
                <div className="w-[38px] h-[38px] rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,.94)', boxShadow: '0 4px 12px -6px rgba(0,0,0,.4)' }}>
                  <FavoriteButton groupId={group.id} size={17} icon="heart" />
                </div>
              </div>
            </div>

            {/* Gradient overlay with countdown + name + spec */}
            <div className="absolute bottom-0 left-0 right-0 px-[18px] pb-4 pt-16" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,.72))' }}>
              <GroupCountdownBadge closesAt={group.closesAt} />
              <h1 className="text-[22px] font-extrabold text-white tracking-tight leading-tight mt-2">{group.name}</h1>
              {group.spec && (
                <p className="text-xs text-white/70 mt-0.5">{group.spec}</p>
              )}
            </div>
          </div>

          {/* LIVE CONTENT + CTA */}
          <GroupLiveSection
            groupId={group.id}
            name={group.name}
            spec={group.spec}
            pvp={group.pvp}
            initialBestPrice={group.bestPrice}
            initialTotalUnits={group.totalUnits}
            bidCount={group.bidCount}
            memberCount={group.memberCount}
            tiers={group.tiers}
            maxStock={group.maxStock}
            minExecution={group.minExecution}
            closesAt={group.closesAt}
            heroMode
            /* UX-05 · Estos bloques vivían solo en escritorio: la ficha móvil no
               respondía "¿cuándo me cobráis?" ni "¿y si el grupo no sale?".
               Van como prop, no como hermano posterior, para que la barra de
               compra siga siendo el último hijo y no se desancle al hacer scroll. */
            belowContent={
              <div className="px-4 pb-6">
                <GroupHowAndTrust />
              </div>
            }
          />
        </div>
        <BottomNav />
      </div>
    </>
  )
}
