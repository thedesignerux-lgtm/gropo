'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  {
    label: 'Inicio', href: '/',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
  },
  {
    label: 'Mis grupos', href: '/mis-grupos',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  },
  {
    label: 'Mi Radar', href: '/favoritos',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>,
  },
  {
    label: 'Notificaciones', href: '/notificaciones',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  },
  {
    label: 'Mensajes', href: '/mensajes',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  },
]

const secondaryItems: NavItem[] = [
  {
    label: 'Cómo funciona', href: '/como-funciona',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  },
  {
    label: 'Ayuda', href: '/ayuda',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>,
  },
]

export default function HomeSidebar({
  promo = 'default',
  activeCount,
}: {
  promo?: 'default' | 'radar'
  activeCount?: number
}) {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex w-[236px] flex-shrink-0 flex-col sticky top-0 h-screen px-4 py-5 bg-[#0E1220] text-slate-300">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 px-2 pb-6" aria-label="Gropo - inicio">
        <img src="/logo-mark.png" alt="Gropo" className="w-[34px] h-[34px] object-contain" />
        <span className="text-[19px] font-bold text-white tracking-tight">Gropo</span>
      </Link>

      <nav className="flex flex-col gap-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href
          const showCount = item.href === '/favoritos' && typeof activeCount === 'number'
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[14.5px] font-medium transition-colors ${
                active ? 'bg-brand text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {showCount && (
                <span className="bg-white/20 text-white text-[12px] font-semibold rounded-full px-2 py-px">{activeCount}</span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/10 my-4" />

      <nav className="flex flex-col gap-0.5">
        {secondaryItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[14.5px] font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="flex-1" />

      {promo === 'radar' ? (
        <div className="rounded-2xl p-4 text-center bg-white/[0.04] border border-white/[0.07]">
          <style>{`
            @keyframes radar-mini-pulse { 0%{opacity:.5;transform:scale(.5)} 100%{opacity:0;transform:scale(1.9)} }
            .radar-mini-pulse { transform-origin:center; animation: radar-mini-pulse 2.4s ease-out infinite; }
            @media (prefers-reduced-motion: reduce){ .radar-mini-pulse{ animation:none } }
          `}</style>
          <svg viewBox="0 0 118 100" className="w-[110px] h-[92px] mx-auto mb-2" aria-hidden="true">
            <g transform="translate(59 46)">
              <circle r="42" fill="none" stroke="rgba(148,130,230,.28)" strokeWidth="1.3" />
              <circle r="30" fill="none" stroke="rgba(148,130,230,.28)" strokeWidth="1.3" />
              <circle r="18" fill="none" stroke="rgba(148,130,230,.28)" strokeWidth="1.3" />
              <circle className="radar-mini-pulse" r="16" fill="#6C3CE1" opacity=".45" />
              <circle r="6" fill="#8B76F0" />
              <circle cx="30" cy="-28" r="4.5" fill="#0E1220" stroke="#F0531F" strokeWidth="2.2" />
            </g>
          </svg>
          <p className="text-sm font-bold text-slate-100 mb-1">Tu radar trabaja por ti</p>
          <p className="text-xs text-slate-400 mb-3 leading-snug">Añade productos y te avisamos en cuanto aparezca la mejor oportunidad.</p>
          <Link href="/" className="w-full flex items-center justify-center gap-2 bg-brand text-white text-[13.5px] font-bold py-2.5 rounded-xl hover:bg-brand-dark transition-colors">
            Explorar mercado →
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl p-4 text-center bg-white/[0.04] border border-white/[0.07]">
          <div className="w-14 h-14 mx-auto mb-3 bg-white/5 rounded-full flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-light"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </div>
          <p className="text-sm font-bold text-slate-100 mb-1">Cuantos más seamos, menos pagamos</p>
          <p className="text-xs text-slate-400 mb-3 leading-snug">Únete a un grupo o crea el tuyo propio.</p>
          <Link href="/crear-peticion" className="w-full flex items-center justify-center gap-2 bg-brand text-white text-[13.5px] font-bold py-2.5 rounded-xl hover:bg-brand-dark transition-colors">
            Crear petición
          </Link>
        </div>
      )}
    </aside>
  )
}
