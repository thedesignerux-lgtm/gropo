// src/components/EmptyShowcase.tsx
//
// UX-08 · Qué ve alguien que llega a Gropo cuando no hay ningún grupo abierto.
//
// Antes era una línea gris en mitad de la nada: "No hay grupos abiertos". Es la
// pantalla que ve el 100 % del tráfico frío mientras no haya catálogo, así que
// tenía que hacer tres cosas y no hacía ninguna: explicar el modelo, dar una
// acción y no dejar marchar al visitante sin dejar rastro.
//
// La acción es `/crear-peticion`, que ya existe y funciona: crea el grupo sin
// puja y guarda nombre, email y teléfono. Así una visita sin catálogo deja
// demanda registrada — que es justo el argumento para negociar con una marca.
//
// El copy promete lo mismo que la pantalla de éxito de la petición ("te
// avisaremos por email en cuanto encontremos un vendedor"), ni una palabra más.

import Link from 'next/link'

export default function EmptyShowcase({ minHeight }: { minHeight?: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center px-6 py-14"
      style={minHeight ? { minHeight } : undefined}
    >
      <div
        className="w-14 h-14 rounded-full grid place-items-center mb-4"
        style={{ background: '#DEEDEC', color: '#024947' }}
        aria-hidden="true"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9.5" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      </div>

      <h2 className="text-[19px] font-extrabold tracking-tight text-[#1a1a1f]">
        Todavía no hay ningún grupo abierto
      </h2>

      <p className="text-[14.5px] leading-relaxed text-[#57545e] mt-2 max-w-[420px]">
        Gropo junta a gente que quiere el mismo producto para conseguir el precio
        que da el volumen. Dinos cuál quieres y te avisamos por email en cuanto
        encontremos un vendedor.
      </p>

      <Link
        href="/crear-peticion"
        className="mt-6 inline-flex items-center justify-center h-12 px-7 rounded-xl bg-brand text-white font-bold text-[14.5px] hover:bg-brand-dark active:scale-[0.98] transition-all"
      >
        Pedir un producto
      </Link>

      <Link
        href="/como-funciona"
        className="mt-3.5 text-[13px] font-semibold text-brand hover:underline"
      >
        Cómo funciona Gropo
      </Link>
    </div>
  )
}
