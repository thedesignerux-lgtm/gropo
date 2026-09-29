import Link from 'next/link'
import JsonLd from '@/components/seo/JsonLd'
import { SITE_URL } from '@/lib/site'

export interface BreadcrumbItem {
  label: string
  href: string
}

/**
 * Breadcrumbs visuales + JSON-LD BreadcrumbList.
 *
 * El último elemento NO es un enlace (es la página actual).
 * Se renderiza con separadores chevron y se adapta a mobile con truncado.
 */
export default function Breadcrumbs({
  items,
  className = 'mb-4',
}: {
  items: BreadcrumbItem[]
  /** Márgenes del <nav>. Por defecto mb-4 (páginas de contenido). */
  className?: string
}) {
  const ldItems = items.map((item, i) => ({
    '@type': 'ListItem' as const,
    position: i + 1,
    name: item.label,
    item: item.href.startsWith('http') ? item.href : `${SITE_URL}${item.href}`,
  }))

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: ldItems,
        }}
      />
      <nav aria-label="Breadcrumb" className={className}>
        <ol className="flex items-center gap-1.5 text-[13px] text-neutral-400 flex-wrap">
          {items.map((item, i) => {
            const isLast = i === items.length - 1
            return (
              <li key={item.href} className="flex items-center gap-1.5">
                {i > 0 && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden
                    className="shrink-0"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                )}
                {isLast ? (
                  <span className="text-neutral-600 font-medium truncate max-w-[200px]">
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="hover:text-neutral-700 transition-colors whitespace-nowrap"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}
