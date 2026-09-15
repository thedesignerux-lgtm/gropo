/**
 * Pie de página común.
 *
 * POR QUÉ EXISTE. No es decoración: la LSSI exige que la información identificativa
 * del prestador y las condiciones sean accesibles «de forma permanente, fácil, directa
 * y gratuita». Un enlace que solo aparece dentro del checkout no es acceso permanente.
 *
 * Solo se enlazan rutas que existen. La tentación de poner «Vender en Gropo» estaba
 * ahí, pero esa página todavía no está construida y un 404 en el pie es peor que una
 * columna con un enlace menos.
 */
import Link from 'next/link'
import { CONTACT_EMAIL } from '@/lib/site'

const YEAR = 2026

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-400 mb-3">{title}</h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  )
}

function Item({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const cls = 'text-[13px] text-neutral-600 hover:text-neutral-900 transition-colors'
  return (
    <li>
      {external ? (
        <a href={href} className={cls}>
          {children}
        </a>
      ) : (
        <Link href={href} className={cls}>
          {children}
        </Link>
      )}
    </li>
  )
}

export default function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="w-full max-w-[1100px] mx-auto px-5 lg:px-10 pt-10 pb-28 lg:pb-12">
        <div className="mb-9">
          <span className="text-[19px] font-extrabold tracking-tight text-neutral-900">Gropo</span>
          <p className="text-[13px] text-neutral-500 mt-1">Compra en grupo. Paga menos.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8">
          <Col title="Ayuda">
            <Item href="/ayuda">Centro de ayuda</Item>
            <Item href={`mailto:${CONTACT_EMAIL}`} external>
              Contacto
            </Item>
            <Item href="/mis-grupos">Mis grupos</Item>
            <Item href="/legal/devoluciones">Devoluciones y reembolsos</Item>
            <Item href="/legal/reportar-problema">Reportar un problema</Item>
          </Col>

          <Col title="Comprar">
            <Item href="/como-funciona">Cómo funciona</Item>
            <Item href="/legal/condiciones-compra">Condiciones de compra</Item>
            <Item href="/legal/terminos">Términos y condiciones</Item>
          </Col>

          <Col title="Vender">
            <Item href="/legal/condiciones-vendedores">Condiciones para vendedores</Item>
            <Item href="/legal/productos-prohibidos">Productos prohibidos</Item>
          </Col>

          <Col title="Legal">
            <Item href="/legal/aviso-legal">Aviso legal</Item>
            <Item href="/legal/privacidad">Privacidad</Item>
            <Item href="/legal/cookies">Cookies</Item>
            <Item href="/legal/propiedad-intelectual">Propiedad intelectual</Item>
          </Col>
        </div>

        <div className="mt-10 pt-6 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-[12px] text-neutral-400">© {YEAR} Gropo. Todos los derechos reservados.</p>
          <Link href="/legal" className="text-[12px] text-neutral-500 hover:text-neutral-800 font-semibold transition-colors">
            Información legal
          </Link>
        </div>
      </div>
    </footer>
  )
}
