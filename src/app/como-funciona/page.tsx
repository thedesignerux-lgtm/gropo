import Link from 'next/link'
import DesktopNavbar from '@/components/desktop/DesktopNavbar'
import BottomNav from '@/components/BottomNav'

const STEPS = [
  {
    n: '1', t: 'Encuentra tu producto', d: 'Explora los grupos abiertos o guarda productos en Mi Radar. Te avisamos en cuanto aparece una oportunidad para lo que te interesa.',
  },
  {
    n: '2', t: 'Asegura tu precio', d: 'Al unirte a un grupo dejas tu precio asegurado. No te cobramos: se hace una retención en tu tarjeta que solo se procesa si el grupo alcanza el objetivo.',
  },
  {
    n: '3', t: 'Cuantos más, menos pagáis', d: 'El precio baja en vivo según entran más compradores. Comparte el grupo con quien quieras: cada persona que se une baja el precio para todos.',
  },
  {
    n: '4', t: 'Cierre del grupo', d: 'Cada domingo a las 22:00 el grupo se cierra con un precio único de liquidación. Ese es el precio que paga todo el mundo, sin importar cuándo entró.',
  },
  {
    n: '5', t: 'Se cobra y se envía', d: 'Si el grupo alcanza el objetivo, se cobra tu precio final y te lo enviamos con seguimiento. Si no se alcanza, se libera la retención y no se te cobra nada.',
  },
]

const GUARANTEES = [
  { t: 'Tu dinero está protegido', d: 'Solo se realiza el cargo si el grupo alcanza su objetivo. Hasta entonces es una retención, no un cobro.' },
  { t: 'Nunca pagas de más', d: 'Tú fijas el máximo que aceptas pagar y el sistema nunca lo supera. Si el grupo consigue un precio mejor, pagas menos automáticamente.' },
  { t: 'Gropo responde', d: 'Gropo es el vendedor oficial (merchant of record): factura, envío y devoluciones pasan por nosotros.' },
]

export default function ComoFuncionaPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
      <div className="hidden lg:block"><DesktopNavbar /></div>

      <div className="flex-1 min-w-0 flex flex-col pb-24 lg:pb-0">
        <main className="w-full max-w-[820px] mx-auto px-4 lg:px-10 pt-6 lg:pt-10 pb-14">
          <span className="inline-block text-xs font-bold uppercase tracking-wide text-brand bg-brand/10 rounded-full px-3 py-1 mb-4">Cómo funciona</span>
          <h1 className="text-[28px] lg:text-4xl font-extrabold tracking-tight text-neutral-900">Compra en grupo. Paga menos.</h1>
          <p className="text-[15px] lg:text-base text-neutral-500 mt-3 leading-relaxed max-w-[620px]">
            Gropo junta a gente que quiere el mismo producto de ciclismo. Cuantos más sois, más baja el precio para todos — y solo se cobra si el grupo llega a su objetivo.
          </p>

          <div className="mt-10 flex flex-col gap-4">
            {STEPS.map(s => (
              <div key={s.n} className="flex gap-4 bg-white border border-neutral-200 rounded-2xl p-5">
                <span className="w-9 h-9 rounded-xl bg-brand text-white flex items-center justify-center text-base font-extrabold shrink-0">{s.n}</span>
                <div>
                  <h3 className="text-[15.5px] font-bold text-neutral-900">{s.t}</h3>
                  <p className="text-[13.5px] text-neutral-500 mt-1 leading-relaxed">{s.d}</p>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-xl font-extrabold text-neutral-900 mt-12 mb-4">Nuestras garantías</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {GUARANTEES.map(g => (
              <div key={g.t} className="bg-white border border-neutral-200 rounded-2xl p-5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
                </div>
                <h3 className="text-[14px] font-bold text-neutral-900">{g.t}</h3>
                <p className="text-[12.5px] text-neutral-500 mt-1 leading-relaxed">{g.d}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 bg-brand rounded-2xl p-6 lg:p-8 text-center">
            <h2 className="text-xl lg:text-2xl font-extrabold text-white">¿List@ para pagar menos?</h2>
            <p className="text-white/80 text-sm mt-2">Explora los grupos abiertos y asegura tu precio hoy.</p>
            <Link href="/" className="inline-flex items-center gap-2 bg-white text-brand font-bold text-sm rounded-xl px-6 py-3 mt-5">
              Ver grupos abiertos
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
          </div>

          <p className="text-center text-[13px] text-neutral-400 mt-8">
            ¿Tienes dudas? <Link href="/ayuda" className="text-brand font-semibold">Visita el centro de ayuda</Link>
          </p>
        </main>
      </div>

      <div className="lg:hidden"><BottomNav /></div>
    </div>
  )
}
