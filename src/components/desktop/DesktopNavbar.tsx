'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { href: '/', label: 'Explorar' },
  { href: '/mis-grupos', label: 'Mis grupos' },
  { href: '/favoritos', label: 'Mi Radar' },
  { href: '/como-funciona', label: 'Cómo funciona' },
]

/* ── Brand logo (cuadrado morado "v" + Vonda) ── */
function BrandLogo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="Vonda">
      <div className="w-[34px] h-[34px] rounded-[10px] grid place-items-center text-white font-extrabold text-lg" style={{ background: '#6C4BF4' }}>v</div>
      <span className="text-xl font-extrabold tracking-tight text-neutral-900">Vonda</span>
    </Link>
  )
}

export default function DesktopNavbar() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30 border-b" style={{ background: 'rgba(251,250,248,0.9)', backdropFilter: 'blur(12px)', borderColor: '#EFEDE7' }}>
      <div className="max-w-[1240px] mx-auto flex items-center gap-8 px-8 h-[72px]">
        <BrandLogo />

        <nav className="hidden lg:flex items-center gap-7 ml-4">
          {NAV_LINKS.map((link) => {
            const active = link.href === '/'
              ? pathname === '/'
              : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-[15px] transition-colors ${active ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-500 hover:text-neutral-900'}`}
              >
                {active && <span className="mr-1.5" style={{ color: '#6C4BF4' }}>•</span>}
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-3.5 ml-auto">
          <Link
            href="/crear-peticion"
            className="text-[15px] font-semibold text-neutral-900 rounded-full px-5 py-2.5 bg-white transition-colors hover:border-brand"
            style={{ border: '1.5px solid #E4E1DA' }}
          >
            Crea tu grupo
          </Link>
          <Link
            href="/perfil"
            className="w-9 h-9 rounded-full grid place-items-center text-sm font-extrabold"
            style={{ background: '#EDE9FB', color: '#6C4BF4' }}
          >
            V
          </Link>
        </div>
      </div>
    </header>
  )
}
