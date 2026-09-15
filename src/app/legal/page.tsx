import type { Metadata } from 'next'
import Link from 'next/link'
import DesktopNavbar from '@/components/desktop/DesktopNavbar'
import BottomNav from '@/components/BottomNav'
import SiteFooter from '@/components/SiteFooter'
import { LEGAL_ENTRIES, LEGAL_GROUP_LABEL, type LegalGroup } from '@/content/legal'
import { hasPlaceholders } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Información legal — Gropo',
  description: 'Condiciones de compra, devoluciones, privacidad, cookies y demás documentos legales de Gropo.',
}

const GROUPS: LegalGroup[] = ['comprar', 'vender', 'plataforma']

export default function LegalIndexPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
      <div className="hidden lg:block">
        <DesktopNavbar />
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <main className="w-full max-w-[760px] mx-auto px-4 lg:px-10 pt-6 lg:pt-10 pb-14">
          <span className="inline-block text-xs font-bold uppercase tracking-wide text-brand bg-brand/10 rounded-full px-3 py-1 mb-4">
            Legal
          </span>
          <h1 className="text-[28px] lg:text-4xl font-extrabold tracking-tight text-neutral-900">
            Información legal
          </h1>
          <p className="text-[15px] text-neutral-500 mt-3 leading-relaxed">
            Las condiciones bajo las que funciona Gropo, escritas para que se entiendan.
          </p>

          {GROUPS.map((g) => {
            const entries = LEGAL_ENTRIES.filter((e) => e.group === g)
            if (entries.length === 0) return null
            return (
              <section key={g} className="mt-8">
                <h2 className="text-[12px] font-bold uppercase tracking-wide text-neutral-400 mb-3">
                  {LEGAL_GROUP_LABEL[g]}
                </h2>
                <div className="bg-white border border-neutral-200 rounded-2xl divide-y divide-neutral-100 overflow-hidden">
                  {entries.map(({ doc }) => (
                    <Link
                      key={doc.slug}
                      href={`/legal/${doc.slug}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[14.5px] font-semibold text-neutral-900">{doc.title}</span>
                          {hasPlaceholders(doc) && (
                            <span className="text-[10.5px] font-bold uppercase tracking-wide text-amber-800 bg-amber-100 rounded px-1.5 py-0.5">
                              Borrador
                            </span>
                          )}
                        </div>
                        <p className="text-[12.5px] text-neutral-500 mt-0.5 leading-relaxed">{doc.summary}</p>
                      </div>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        className="text-neutral-300 shrink-0"
                        aria-hidden
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </section>
            )
          })}

          <p className="text-[12.5px] text-neutral-400 mt-8 leading-relaxed">
            Los documentos marcados como borrador están pendientes de completar con los datos
            definitivos de la sociedad y de una revisión jurídica final.
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
