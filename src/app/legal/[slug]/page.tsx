import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import DesktopNavbar from '@/components/desktop/DesktopNavbar'
import BottomNav from '@/components/BottomNav'
import SiteFooter from '@/components/SiteFooter'
import LegalBody from '@/components/legal/LegalBody'
import { LEGAL_SLUGS, getLegalDoc } from '@/content/legal'
import { countPlaceholders, hasPlaceholders } from '@/lib/legal'

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const doc = getLegalDoc(params.slug)
  if (!doc) return {}
  return {
    title: `${doc.title} — Gropo`,
    description: doc.summary,
    // Mientras el documento tenga huecos ([RAZÓN SOCIAL], [NIF]…) no debe indexarse:
    // una página legal incompleta posicionada en Google es peor que no tenerla. El día
    // que Benjamin rellene los datos, esto se apaga solo. Nadie tiene que acordarse.
    robots: hasPlaceholders(doc) ? { index: false, follow: false } : undefined,
  }
}

export default function LegalDocPage({ params }: { params: { slug: string } }) {
  const doc = getLegalDoc(params.slug)
  if (!doc) notFound()

  const pending = countPlaceholders(doc)

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
      <div className="hidden lg:block">
        <DesktopNavbar />
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <main className="w-full max-w-[760px] mx-auto px-4 lg:px-10 pt-6 lg:pt-10 pb-14">
          <Link
            href="/legal"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-neutral-500 hover:text-neutral-800 transition-colors mb-5"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Información legal
          </Link>

          <h1 className="text-[26px] lg:text-[34px] font-extrabold tracking-tight text-neutral-900 leading-tight">
            {doc.title}
          </h1>
          <p className="text-[14.5px] text-neutral-500 mt-3 leading-relaxed">{doc.summary}</p>

          {pending > 0 && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
              <p className="text-[13px] font-bold text-amber-900">Borrador de trabajo</p>
              <p className="text-[12.5px] text-amber-800 leading-relaxed mt-1">
                Este documento está pendiente de completar con los datos definitivos de la
                sociedad y de una revisión jurídica final. Quedan {pending}{' '}
                {pending === 1 ? 'dato' : 'datos'} por rellenar.
              </p>
            </div>
          )}

          <div className="mt-7">
            <LegalBody doc={doc} />
          </div>

          <p className="text-center text-[13px] text-neutral-400 mt-8">
            <Link href="/legal" className="text-brand font-semibold">
              Ver todos los documentos legales
            </Link>
          </p>
        </main>
      </div>

      <SiteFooter />

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
