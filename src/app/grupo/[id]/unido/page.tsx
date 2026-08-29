import Link from 'next/link'

export const dynamic = 'force-dynamic'

// return_url del 3D Secure. De momento, página mínima de espera: el miembro se
// crea de verdad en el webhook (Bloque 2.4), que confirmará el hold. Aquí solo
// tranquilizamos al comprador mientras eso cuaja.
export default function UnidoPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-white px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <h1 className="mt-6 text-xl font-bold text-neutral-900">
          Tu reserva está confirmándose…
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">
          Hemos retenido el precio garantizado en tu tarjeta. En cuanto se confirme, te avisamos
          por email. Pagarás el precio final del gropo al cierre — siempre igual o menor.
        </p>

        <Link
          href={`/grupo/${params.id}`}
          className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-brand px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          Volver al gropo
        </Link>
      </div>
    </div>
  )
}
