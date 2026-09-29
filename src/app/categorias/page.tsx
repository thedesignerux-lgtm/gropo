import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/site'
import { CATEGORIES } from '@/lib/categories'
import { countOpenGroupsByCategory } from '@/lib/category-counts'
import DesktopNavbar from '@/components/desktop/DesktopNavbar'
import BottomNav from '@/components/BottomNav'
import SiteFooter from '@/components/SiteFooter'
import Breadcrumbs from '@/components/Breadcrumbs'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Categorías — Compra colectiva por categoría',
  description:
    'Explora todas las categorías de compra colectiva en Gropo: ciclismo, electrónica, hogar, deporte, moda y más. Encuentra tu producto y compra en grupo para pagar menos.',
  alternates: { canonical: `${SITE_URL}/categorias` },
  openGraph: {
    title: 'Categorías de compra colectiva — Gropo',
    description:
      'Todas las categorías del marketplace de compra colectiva Gropo. Agrupa tu demanda y consigue mejores precios.',
    url: `${SITE_URL}/categorias`,
    siteName: 'Gropo',
  },
}

export default async function CategoriasPage() {
  const counts = await countOpenGroupsByCategory()

  // Separamos categorías con productos de las que están vacías
  const active = CATEGORIES.filter(c => (counts.get(c.slug) ?? 0) > 0)
  const upcoming = CATEGORIES.filter(c => (counts.get(c.slug) ?? 0) === 0)

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
      <div className="hidden lg:block">
        <DesktopNavbar />
      </div>

      <main className="w-full max-w-[920px] mx-auto px-4 lg:px-10 pt-6 lg:pt-10 pb-14">
        <Breadcrumbs
          items={[
            { label: 'Gropo', href: '/' },
            { label: 'Categorías', href: '/categorias' },
          ]}
        />

        <h1 className="text-[28px] lg:text-[36px] font-extrabold tracking-tight text-neutral-900 leading-tight">
          Categorías de compra colectiva
        </h1>
        <p className="text-[15px] text-neutral-500 mt-3 leading-relaxed max-w-[620px]">
          Explora los grupos de compra abiertos por categoría. Elige tu producto, únete al grupo y el precio baja para todos.
        </p>

        {/* ── Categorías con grupos abiertos ── */}
        {active.length > 0 && (
          <section className="mt-10">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map(c => {
                const count = counts.get(c.slug) ?? 0
                return (
                  <Link
                    key={c.slug}
                    href={`/categorias/${c.slug}`}
                    className="bg-white border border-neutral-200 rounded-2xl p-5 hover:border-brand/40 hover:shadow-sm transition-all group"
                  >
                    <h2 className="text-[17px] font-bold text-neutral-900 group-hover:text-brand transition-colors">
                      {c.name}
                    </h2>
                    <p className="text-[13px] text-neutral-500 mt-1.5 leading-relaxed line-clamp-2">
                      {c.description}
                    </p>
                    <p className="text-[12.5px] text-brand font-semibold mt-3">
                      {count} {count === 1 ? 'grupo abierto' : 'grupos abiertos'}
                    </p>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Próximamente ── */}
        {upcoming.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-bold text-neutral-700 mb-4">Próximamente</h2>
            <p className="text-[14px] text-neutral-500 mb-4 leading-relaxed">
              Gropo es un marketplace generalista. Estas categorías estarán disponibles en cuanto haya grupos de compra abiertos.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map(c => (
                <div
                  key={c.slug}
                  className="bg-white/60 border border-neutral-100 rounded-2xl p-4 opacity-70"
                >
                  <h3 className="text-[15px] font-semibold text-neutral-600">{c.name}</h3>
                  <p className="text-[12px] text-neutral-400 mt-1 line-clamp-2">{c.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── SEO internal links ── */}
        <section className="mt-14 text-center">
          <p className="text-[13px] text-neutral-400">
            <Link href="/que-es-gropo" className="text-brand font-semibold hover:underline">
              Qué es Gropo
            </Link>
            {' · '}
            <Link href="/como-funciona" className="text-brand font-semibold hover:underline">
              Cómo funciona
            </Link>
            {' · '}
            <Link href="/" className="text-brand font-semibold hover:underline">
              Ver todos los grupos
            </Link>
          </p>
        </section>
      </main>

      <SiteFooter />
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
