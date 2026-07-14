'use client'

import GroupCenterContent from './GroupCenterContent'
import GroupRightSidebar from './GroupRightSidebar'
import GroupCountdown from '@/components/GroupCountdown'
import FavoriteButton from '@/components/FavoriteButton'

interface Tier { minUnits: number; price: number }

interface Props {
  groupId: string
  name: string
  spec: string
  pvp: number
  imageUrl?: string
  initialBestPrice: number
  initialTotalUnits: number
  bidCount: number
  tiers: Tier[]
  maxStock: number
  minExecution: number
  closesAt: string
}

const STEPS = [
  { n: 1, title: 'Únete al grupo', body: 'Reservas tu plaza sin pagar nada por adelantado.' },
  { n: 2, title: 'Invita a más gente', body: 'Cada persona que entra acerca el siguiente tramo.' },
  { n: 3, title: 'El precio baja', body: 'Al cerrar, pagas el precio más bajo alcanzado.' },
]

const TRUST = [
  { title: 'Pago seguro', body: 'Tu dinero siempre protegido' },
  { title: 'Sin compromiso', body: 'Únete gratis, compra cuando quieras' },
  { title: 'Devoluciones fáciles', body: 'Si algo no encaja, lo solucionamos' },
]

export default function GroupDesktopView({
  groupId, name, spec, pvp, imageUrl,
  tiers, maxStock, closesAt,
}: Props) {
  function handleShare() {
    const url = `https://www.vonda.es/grupo/${groupId}`
    if (navigator.share) { navigator.share({ title: name, url }) }
    else { navigator.clipboard.writeText(url) }
  }

  return (
    <div className="min-h-screen bg-[#F2EFE9] py-8 px-6">
      <div className="max-w-[1200px] mx-auto bg-white rounded-[28px] shadow-sm px-10 py-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-7">
          <a href="/" className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Volver a Deporte
          </a>
          <div className="flex items-center gap-6">
            <button onClick={handleShare} className="flex items-center gap-2 text-sm font-medium text-neutral-700 hover:text-brand transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
              Compartir
            </button>
            <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
              <FavoriteButton groupId={groupId} size={18} icon="heart" />
              Guardar
            </div>
          </div>
        </div>

        {/* ── Título + cierre ── */}
        <div className="flex items-start justify-between gap-6 mb-6">
          <div className="min-w-0">
            <h1 className="text-4xl font-extrabold text-neutral-900 leading-tight tracking-tight">{name}</h1>
            {spec && <p className="text-sm text-neutral-500 mt-1.5">{spec}</p>}
          </div>
          <span className="flex-shrink-0 inline-flex items-center gap-1.5 text-sm font-medium text-orange-700 bg-orange-50 px-3.5 py-2 rounded-full">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 15" /></svg>
            Cierra dom 22:00 · <GroupCountdown closesAt={closesAt} minimal />
          </span>
        </div>

        {/* ── 2 columnas ── */}
        <div className="flex gap-8 items-start">
          <main className="flex-1 min-w-0">
            <GroupCenterContent name={name} imageUrl={imageUrl} />
          </main>
          <GroupRightSidebar
            groupId={groupId}
            name={name}
            spec={spec}
            imageUrl={imageUrl ?? null}
            pvp={pvp}
            tiers={tiers}
            maxStock={maxStock}
            closesAt={closesAt}
          />
        </div>

        {/* ── Cuantos más, menos pagas ── */}
        <section className="mt-12 pt-10 border-t border-neutral-100">
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Cuantos más, menos pagas</h2>
          <p className="text-[15px] text-neutral-600 leading-relaxed max-w-3xl">
            Cada vez que alguien asegura su plaza, el grupo se acerca al siguiente tramo y el precio baja
            para <span className="font-semibold text-neutral-900">todos</span>. No pagas hasta que el grupo
            cierra, y el importe final es el más bajo que se alcance.
          </p>
          <div className="grid grid-cols-3 gap-5 mt-7">
            {STEPS.map(s => (
              <div key={s.n} className="rounded-2xl border border-neutral-200 p-6">
                <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center text-sm font-bold text-brand mb-4">{s.n}</div>
                <h3 className="text-base font-bold text-neutral-900 mb-1.5">{s.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Fila de confianza ── */}
        <div className="mt-8 pt-6 border-t border-neutral-100 grid grid-cols-3 gap-6">
          {TRUST.map(t => (
            <div key={t.title} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand/10 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-neutral-900">{t.title}</p>
                <p className="text-sm text-neutral-500">{t.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
