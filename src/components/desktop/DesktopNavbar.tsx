'use client'

/**
 * Barra superior de escritorio.
 *
 * Rehecha el 15-sep-2026 sobre el mockup de Benjamin («Gropo header.html»): rejilla de
 * tres columnas, barra más alta, buscador global y subrayado naranja en el enlace
 * activo. Se conserva el logo actual.
 *
 * CUATRO COSAS DEL MOCKUP QUE NO SE COPIAN LITERALMENTE, Y POR QUÉ:
 *
 * 1. TIPOGRAFÍA. El mockup usa Outfit. El producto usa Geist / Space Grotesk /
 *    Instrument Serif. Decisión de Benjamin (15-sep): estructura del mockup, letra
 *    actual — un header con otra fuente que el resto de la página se nota al bajar la
 *    vista.
 *
 * 2. ENLACES. El mockup lista «Productos · Cómo funciona · Comunidad · Mi Radar».
 *    «Comunidad» no existe como ruta y «Mis grupos» faltaba. Se mantienen los cuatro
 *    reales. Un enlace del header que lleva a un 404 es peor que un enlace de menos.
 *
 * 3. CONTRASTE DEL NARANJA. El mockup pinta el CTA con texto BLANCO sobre naranja:
 *    2,87:1, no pasa AA (calculado, no estimado). El proyecto ya tenía resuelta esa
 *    regla en `tailwind.config.ts` — fondo `accent` con texto casi negro, 6,04:1 — y es
 *    la que se aplica. El subrayado del activo es un elemento gráfico: AA le pide 3:1 y
 *    `accent` (#FF6A00) se queda en 2,79:1, así que ahí va `#EC5600` (3,46:1), que
 *    sigue leyéndose naranja.
 *
 * 4. BOTÓN «ENTRAR» CON EL NOMBRE DEL USUARIO. Requiere que la barra conozca la sesión;
 *    hoy no la consulta. Se mantiene el avatar que ya lleva a /perfil. Pendiente.
 *
 * Y una que sí se conserva del producto: LA CAMPANA. No está en el mockup, pero es la
 * única entrada a /notificaciones — quitarla dejaría la pantalla otra vez inalcanzable,
 * que es justo el problema que resolvió A-16.
 */

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const NAV_LINKS = [
  { href: '/', label: 'Explorar' },
  { href: '/mis-grupos', label: 'Mis grupos' },
  { href: '/favoritos', label: 'Mi Radar' },
  { href: '/como-funciona', label: 'Cómo funciona' },
]

/** Naranja del subrayado: 3,46:1 sobre el fondo de la barra. Ver nota 3 arriba. */
const UNDERLINE = '#EC5600'

export default function DesktopNavbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [q, setQ] = useState('')

  /**
   * El buscador vivía SOLO dentro de la home y filtraba en cliente. Puesto en una barra
   * global tenía que funcionar desde cualquier página, así que envía a la home con el
   * término en la URL y allí se aplica. Sin esto sería otro control con aspecto de
   * hacer algo que no hace nada (A-35).
   */
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const term = q.trim()
    router.push(term ? `/?q=${encodeURIComponent(term)}` : '/')
  }

  return (
    <header
      className="sticky top-0 z-30 border-b"
      style={{
        background: 'rgba(251,252,249,0.88)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderColor: 'rgba(8,63,67,0.075)',
        boxShadow: '0 1px 0 rgba(8,63,67,0.025)',
      }}
    >
      <div className="max-w-[1240px] mx-auto px-8 h-[80px] grid grid-cols-[auto_1fr_auto] items-center gap-8">
        <Link href="/" className="flex items-center shrink-0" aria-label="Gropo — ir al inicio">
          <img src="/logo.png" alt="Gropo" className="h-10 w-auto" />
        </Link>

        <nav className="flex items-center gap-7 min-w-0" aria-label="Navegación principal">
          {NAV_LINKS.map((link) => {
            const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`relative whitespace-nowrap text-[15px] py-[29px] transition-colors ${
                  active ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {/*
                  ANCHURA RESERVADA (15-sep-2026). El enlace activo pasa de peso 500 a
                  600, y la negrita ocupa más: al entrar en «Explorar» —el primero— los
                  otros tres se desplazaban a la derecha. Benjamin lo vio como un
                  temblor del menú al navegar.

                  La solución no es quitar la negrita, que es el refuerzo no cromático
                  del estado activo: es reservar SIEMPRE la anchura de la negrita. Las
                  dos copias se apilan en la misma celda de la rejilla; la invisible en
                  peso 600 fija la anchura y la visible cambia de peso sin mover nada.

                  Funciona con cualquier tipografía porque la mide el navegador. No hay
                  anchuras a mano que se queden desfasadas al cambiar la fuente.
                */}
                <span className="grid">
                  <span aria-hidden className="col-start-1 row-start-1 invisible font-semibold">
                    {link.label}
                  </span>
                  <span className={`col-start-1 row-start-1 ${active ? 'font-semibold' : 'font-medium'}`}>
                    {link.label}
                  </span>
                </span>
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 right-0 rounded-full"
                    style={{ bottom: 16, height: 3, background: UNDERLINE }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-3 justify-self-end">
          <form
            onSubmit={submit}
            role="search"
            className="hidden xl:flex items-center gap-2.5 h-[42px] rounded-full px-4 transition-colors focus-within:bg-white"
            style={{ width: 'min(240px, 20vw)', background: 'rgba(244,248,246,0.9)', border: '1px solid #DDE8E5' }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5A6B6E" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
            <label htmlFor="nav-search" className="sr-only">Buscar productos</label>
            <input
              id="nav-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Busca un producto"
              className="w-full min-w-0 bg-transparent text-[13.5px] text-neutral-800 placeholder:text-[#5A6B6E] focus:outline-none"
            />
          </form>

          {/* CTA. Fondo `accent` con texto casi negro: 6,04:1. Ver nota 3. */}
          <Link
            href="/crear-peticion"
            className="whitespace-nowrap text-[14.5px] font-bold rounded-full px-5 py-2.5 transition-transform active:scale-[0.98]"
            style={{ background: 'transparent', color: '#FF6A00', border: '2px solid #FF6A00' }}
          >
            Crea tu grupo
          </Link>

          <Link
            href="/notificaciones"
            aria-label="Actividad de tus compras"
            className="w-[42px] h-[42px] rounded-full grid place-items-center bg-white text-neutral-600 hover:text-brand transition-colors"
            style={{ border: '1px solid #DDE7E4' }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></svg>
          </Link>

          <Link
            href="/perfil"
            aria-label="Tu perfil"
            className="w-[42px] h-[42px] rounded-full grid place-items-center"
            style={{ background: '#DEEDEC', color: '#024947' }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </Link>
        </div>
      </div>
    </header>
  )
}
