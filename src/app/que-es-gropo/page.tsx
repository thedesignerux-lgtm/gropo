import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/site'
import DesktopNavbar from '@/components/desktop/DesktopNavbar'
import BottomNav from '@/components/BottomNav'
import SiteFooter from '@/components/SiteFooter'
import Breadcrumbs from '@/components/Breadcrumbs'
import JsonLd from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Qué es Gropo — Compra colectiva para conseguir mejores precios',
  description:
    'Gropo es un marketplace de compra colectiva donde compras en grupo para pagar menos. Cuantos más compradores se unen, más baja el precio para todos. Sin riesgo: si el grupo no llega al objetivo, no se cobra nada.',
  alternates: { canonical: `${SITE_URL}/que-es-gropo` },
  openGraph: {
    type: 'website',
    title: 'Qué es Gropo — Compra colectiva para conseguir mejores precios',
    description:
      'Marketplace de compra colectiva. Agrupa tu demanda con otros compradores y consigue mejores precios por volumen.',
    url: `${SITE_URL}/que-es-gropo`,
    siteName: 'Gropo',
  },
}

const BENEFITS = [
  {
    title: 'Precios que bajan en vivo',
    text: 'El precio de cada producto baja a medida que más personas se unen al grupo de compra. No hay trucos: el precio se calcula por volumen real.',
  },
  {
    title: 'Sin riesgo para el comprador',
    text: 'Cuando te unes a un grupo, tu dinero queda retenido pero no se cobra. Si el grupo no alcanza su objetivo, se libera la retención automáticamente.',
  },
  {
    title: 'Un solo precio para todos',
    text: 'Al cierre del grupo, todos los compradores pagan el mismo precio final. Da igual si fuiste el primero o el último en unirte.',
  },
  {
    title: 'Vendedores profesionales, pago protegido',
    text: 'Los productos los venden vendedores profesionales. Gropo es la plataforma que reúne a los compradores, gestiona el grupo y protege el pago: nada se cobra hasta que el grupo cierra.',
  },
]

const FAQ = [
  {
    q: '¿Qué es la compra colectiva?',
    a: 'La compra colectiva es un modelo donde varias personas agrupan su demanda para comprar el mismo producto juntas. Al pedir más unidades como grupo, se negocian mejores precios que comprando individualmente. En Gropo, esto se traduce en tramos de precio por volumen: cuantas más unidades suma el grupo, más baja el precio para todos.',
  },
  {
    q: '¿Qué diferencia tiene Gropo con una tienda online?',
    a: 'En una tienda online el precio está fijado. En Gropo, el precio es dinámico y baja según más personas se unen al grupo de compra. Además, no te cobramos nada hasta que el grupo alcanza su objetivo: solo se hace una retención temporal en tu tarjeta como garantía.',
  },
  {
    q: '¿Qué pasa si el grupo no llega al objetivo?',
    a: 'Si el grupo no alcanza el mínimo necesario, la retención en tu tarjeta se libera automáticamente y no se te cobra nada. No hay riesgo económico.',
  },
  {
    q: '¿Puedo fijar un precio máximo?',
    a: 'Sí. Puedes elegir "esperar a un precio" y fijar tu precio máximo aceptado. Si el grupo alcanza ese precio o uno mejor, entras automáticamente. Si no lo alcanza, no pagas nada.',
  },
  {
    q: '¿Gropo es solo de ciclismo?',
    a: 'Gropo nace con ciclismo como primera categoría, pero es un marketplace generalista. La compra colectiva funciona igual de bien para electrónica, hogar, deporte, alimentación o cualquier otro producto donde agrupar demanda permita negociar mejores precios.',
  },
  {
    q: '¿Quién me vende el producto?',
    a: 'Un vendedor profesional. Gropo no vende: es la plataforma que pone en contacto a los compradores con el vendedor, agrupa la demanda y facilita el pago. El vendedor es quien responde de la entrega, la garantía y las devoluciones de su producto.',
  },
]

export default function QueEsGropoPage() {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
      <JsonLd data={faqLd} />
      <div className="hidden lg:block">
        <DesktopNavbar />
      </div>

      <main className="w-full max-w-[820px] mx-auto px-4 lg:px-10 pt-6 lg:pt-10 pb-14">
        <Breadcrumbs
          items={[
            { label: 'Gropo', href: '/' },
            { label: 'Qué es Gropo', href: '/que-es-gropo' },
          ]}
        />

        {/* ── Hero ── */}
        <h1 className="text-[28px] lg:text-[38px] font-extrabold tracking-tight text-neutral-900 leading-tight">
          Compra colectiva: mejores precios comprando juntos
        </h1>
        <p className="text-[15px] lg:text-[17px] text-neutral-500 mt-4 leading-relaxed max-w-[680px]">
          Gropo es un marketplace de compra colectiva. Juntamos a personas que
          quieren el mismo producto y las conectamos con vendedores profesionales
          que ofrecen precios por volumen. Cuantos más se unen al grupo, más baja
          el precio para todos.
        </p>

        {/* ── Cómo funciona (resumen) ── */}
        <section className="mt-12">
          <h2 className="text-xl lg:text-2xl font-extrabold text-neutral-900 mb-2">
            Cómo funciona un grupo de compra
          </h2>
          <p className="text-[14.5px] text-neutral-500 leading-relaxed mb-6">
            La compra colectiva en Gropo funciona en tres pasos. No necesitas organizar nada: el grupo ya está creado y el precio baja automáticamente.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { n: '1', t: 'Elige tu producto', d: 'Explora los grupos abiertos y elige el que te interesa. Cada grupo tiene un producto concreto con tramos de precio por volumen.' },
              { n: '2', t: 'Únete al grupo', d: 'Asegura tu precio sin que te cobren nada: se hace una retención en tu tarjeta que solo se procesa si el grupo alcanza su objetivo.' },
              { n: '3', t: 'Cuantos más, menos pagáis', d: 'Comparte el grupo. Cada persona que se une baja el precio para todos. Al cierre, todos pagan el mismo precio final.' },
            ].map(s => (
              <div key={s.n} className="bg-white border border-neutral-200 rounded-2xl p-5">
                <span className="w-9 h-9 rounded-xl bg-brand text-white flex items-center justify-center text-base font-extrabold mb-3">
                  {s.n}
                </span>
                <h3 className="text-[15px] font-bold text-neutral-900">{s.t}</h3>
                <p className="text-[13px] text-neutral-500 mt-1 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>

          <p className="text-[14px] text-neutral-500 mt-4">
            ¿Quieres ver el proceso completo?{' '}
            <Link href="/como-funciona" className="text-brand font-semibold hover:underline">
              Cómo funciona Gropo paso a paso
            </Link>
          </p>
        </section>

        {/* ── Beneficios ── */}
        <section className="mt-14">
          <h2 className="text-xl lg:text-2xl font-extrabold text-neutral-900 mb-6">
            Por qué comprar en grupo con Gropo
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {BENEFITS.map(b => (
              <div key={b.title} className="bg-white border border-neutral-200 rounded-2xl p-5">
                <h3 className="text-[15px] font-bold text-neutral-900">{b.title}</h3>
                <p className="text-[13px] text-neutral-500 mt-1.5 leading-relaxed">{b.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Para quién ── */}
        <section className="mt-14">
          <h2 className="text-xl lg:text-2xl font-extrabold text-neutral-900 mb-3">
            Para quién es Gropo
          </h2>
          <p className="text-[14.5px] text-neutral-500 leading-relaxed">
            Gropo es para cualquier persona que quiera comprar mejor. Tanto si
            buscas material de ciclismo, electrónica, productos para el hogar o
            cualquier otra categoría, la compra colectiva te permite acceder a
            precios que normalmente solo consiguen los grandes compradores.
          </p>
          <p className="text-[14.5px] text-neutral-500 leading-relaxed mt-3">
            No necesitas conocer a los demás compradores ni organizar nada.
            Gropo gestiona el grupo y el pago; el vendedor fija sus precios por
            volumen y te envía el producto. Tú solo eliges tu producto y decides tu
            precio máximo.
          </p>
        </section>

        {/* ── FAQ ── */}
        <section className="mt-14">
          <h2 className="text-xl lg:text-2xl font-extrabold text-neutral-900 mb-6">
            Preguntas frecuentes sobre compra colectiva
          </h2>
          <div className="space-y-4">
            {FAQ.map(f => (
              <details
                key={f.q}
                className="bg-white border border-neutral-200 rounded-2xl overflow-hidden group"
              >
                <summary className="px-5 py-4 cursor-pointer text-[15px] font-semibold text-neutral-900 flex items-center justify-between gap-3 list-none [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="shrink-0 transition-transform group-open:rotate-180"
                    aria-hidden
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <div className="px-5 pb-4">
                  <p className="text-[13.5px] text-neutral-500 leading-relaxed">{f.a}</p>
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="mt-14">
          <div className="bg-brand rounded-2xl p-6 lg:p-8 text-center">
            <h2 className="text-xl lg:text-2xl font-extrabold text-white">
              Empieza a ahorrar comprando en grupo
            </h2>
            <p className="text-white/80 text-sm mt-2">
              Explora los grupos abiertos y asegura tu precio hoy. Sin riesgo.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-5">
              <Link
                href="/"
                className="inline-flex items-center gap-2 bg-white text-brand font-bold text-sm rounded-xl px-6 py-3"
              >
                Ver grupos abiertos
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
              <Link
                href="/categorias"
                className="inline-flex items-center gap-2 bg-white/15 text-white font-bold text-sm rounded-xl px-6 py-3 border border-white/20"
              >
                Explorar categorías
              </Link>
            </div>
          </div>
        </section>

        <p className="text-center text-[13px] text-neutral-400 mt-8">
          ¿Tienes dudas?{' '}
          <Link href="/ayuda" className="text-brand font-semibold">
            Visita el centro de ayuda
          </Link>{' '}
          ·{' '}
          <Link href="/como-funciona" className="text-brand font-semibold">
            Cómo funciona
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
