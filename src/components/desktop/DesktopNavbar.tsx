'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { href: '/', label: 'Explorar' },
  { href: '/mis-grupos', label: 'Mis grupos' },
  { href: '/favoritos', label: 'Mi Radar' },
]

export default function DesktopNavbar() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-100" style={{ backgroundColor: 'rgba(247,249,252,0.92)', backdropFilter: 'blur(12px)' }}>
      <div className="max-w-[1280px] mx-auto px-8 h-16 flex items-center justify-between">
        {/* Left: nav links in pill container */}
        <nav className="hidden xl:flex items-center gap-1 bg-neutral-200/50 rounded-full p-1">
          {NAV_LINKS.map((link) => {
            const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  active
                    ? 'bg-white text-neutral-900 shadow-sm font-semibold'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Center: Logo */}
        <Link href="/" className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5" aria-label="Vonda">
          <img src="/logo.png" alt="Vonda" className="h-8 w-auto" />
          <span className="text-xl font-bold text-neutral-900 tracking-tight">Vonda</span>
        </Link>

        {/* Right: CTA + avatar */}
        <div className="flex items-center gap-3">
          <Link
            href="/crear-peticion"
            className="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-full border border-neutral-200 text-sm font-semibold text-neutral-700 hover:border-brand hover:text-brand transition-colors"
          >
            Crea tu grupo
          </Link>
          <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-sm font-semibold text-white cursor-pointer">
            V
          </div>
        </div>
      </div>
    </header>
  )
}
