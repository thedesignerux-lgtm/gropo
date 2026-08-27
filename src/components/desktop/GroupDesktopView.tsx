'use client'

import GroupRightSidebar from './GroupRightSidebar'
import GroupCountdown from '@/components/GroupCountdown'
import FavoriteButton from '@/components/FavoriteButton'
import DesktopNavbar from '@/components/desktop/DesktopNavbar'

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

function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="w-full h-full bg-[#F1EEFA] flex flex-col items-center justify-center gap-2 text-neutral-400">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
      </svg>
      <span className="text-xs text-neutral-400">{label}</span>
    </div>
  )
}

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
    <div className="min-h-screen" style={{ background: '#FBFAF8' }}>
      <DesktopNavbar />
      <div className="py-8 px-6">
      <div className="max-w-[1080px] mx-auto bg-white rounded-[30px] border border-[#ECEAF2] overflow-hidden px-[38px] py-[34px]" style={{ boxShadow: '0 40px 90px -50px rgba(30,20,60,.35)' }}>

        {/* ── Header: breadcrumb + share/save ── */}
        <div className="flex items-center justify-between mb-1.5">
          <a href="/" className="text-[13px] text-[#8A8794] hover:text-neutral-700 transition-colors">
            ← Volver a Deporte
          </a>
          <div className="flex items-center gap-2">
            <button onClick={handleShare} className="flex items-center gap-[7px] text-[13.5px] font-bold text-[#1a1a1f] hover:text-brand px-2.5 py-2 rounded-[9px] transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="10.5" x2="15.4" y2="6.5" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /></svg>
              Compartir
            </button>
            <FavoriteButton
              groupId={groupId}
              size={16}
              icon="heart"
              label="Guardar"
              className="gap-[7px] text-[13.5px] font-bold text-[#1a1a1f] hover:text-brand px-2.5 py-2 rounded-[9px]"
            />
          </div>
        </div>

        {/* ── Title + countdown row ── */}
        <div className="flex items-end justify-between gap-5">
          <div className="min-w-0">
            <h1 className="text-[30px] font-extrabold text-[#1a1a1f] leading-tight" style={{ letterSpacing: '-.6px' }}>{name}</h1>
            {spec && <p className="text-sm text-[#8A8794] mt-1">{spec} · Deporte</p>}
          </div>
          <span className="flex-shrink-0 inline-flex items-center gap-[7px] text-[13px] font-bold text-[#B4541A] bg-[#FCEEE1] rounded-full px-3.5 py-2 whitespace-nowrap">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 15" /></svg>
            Cierra dom 22:00 · <GroupCountdown closesAt={closesAt} minimal />
          </span>
        </div>

        {/* ── 2 columnas: galería + panel de compra ── */}
        <div className="grid gap-9 mt-[22px] items-start" style={{ gridTemplateColumns: '1fr 360px' }}>

          {/* Left: Gallery grid */}
          <div className="grid gap-2.5 rounded-[22px] overflow-hidden" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gridTemplateRows: '1fr 1fr', height: 452 }}>
            {/* Main image — spans 2 rows */}
            <div className="relative min-w-0" style={{ gridRow: '1 / 3' }}>
              {imageUrl ? (
                <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                <ImagePlaceholder label={`${name} · foto principal`} />
              )}
            </div>
            {/* Detail 1 */}
            <div className="relative min-w-0">
              {imageUrl ? (
                <img src={imageUrl} alt={`${name} detalle`} className="w-full h-full object-cover" />
              ) : (
                <ImagePlaceholder label="detalle" />
              )}
            </div>
            {/* Detail 2 */}
            <div className="relative min-w-0">
              {imageUrl ? (
                <img src={imageUrl} alt={`${name} detalle`} className="w-full h-full object-cover" />
              ) : (
                <ImagePlaceholder label="detalle" />
              )}
            </div>
          </div>

          {/* Right: Purchase panel */}
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
        <section className="mt-9 pt-[30px] border-t border-[#F1EFF5]">
          <h2 className="text-[19px] font-extrabold text-neutral-900 mb-3">Cuantos más, menos pagas</h2>
          <p className="text-[15px] leading-relaxed text-[#57545e] max-w-[640px]">
            Cada vez que alguien asegura su plaza, el grupo se acerca al siguiente tramo y el precio baja
            para <strong>todos</strong>. No pagas hasta que el grupo cierra, y el importe final es el más bajo que se alcance.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-6">
            {STEPS.map(s => (
              <div key={s.n} className="rounded-2xl border border-[#ECEAF2] p-[18px]">
                <div className="w-[30px] h-[30px] rounded-[9px] bg-[#EDE9FB] flex items-center justify-center text-sm font-extrabold text-brand">{s.n}</div>
                <h3 className="text-[14.5px] font-bold text-neutral-900 mt-3">{s.title}</h3>
                <p className="text-[12.5px] text-[#8A8794] leading-relaxed mt-1">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Trust row ── */}
        <div className="flex gap-11 mt-[30px] pt-[26px] border-t border-[#F1EFF5]">
          {TRUST.map(t => (
            <div key={t.title} className="flex items-center gap-[11px]">
              <div className="w-[34px] h-[34px] rounded-full bg-[#EDE9FB] flex-shrink-0" />
              <div>
                <p className="text-[13.5px] font-bold text-neutral-900">{t.title}</p>
                <p className="text-xs text-[#8A8794]">{t.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  )
}
