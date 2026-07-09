'use client'

import GroupCenterContent from './GroupCenterContent'
import FavoriteButton from '@/components/FavoriteButton'
import GroupRightSidebar from './GroupRightSidebar'

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

export default function GroupDesktopView({
  groupId, name, spec, pvp, imageUrl,
  initialBestPrice, initialTotalUnits,
  bidCount, tiers, maxStock, minExecution, closesAt,
}: Props) {
  const closesLabel = new Date(closesAt).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const diffMs = Math.max(0, new Date(closesAt).getTime() - Date.now())
  const days = Math.floor(diffMs / 86400000)
  const hours = Math.floor((diffMs % 86400000) / 3600000)
  const remainingLabel = days > 0 ? `${days}d ${hours}h restantes` : `${hours}h restantes`

  function handleShare() {
    const url = `https://www.vonda.es/grupo/${groupId}`
    if (navigator.share) { navigator.share({ title: name, url }) }
    else { navigator.clipboard.writeText(url) }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="bg-white border-b border-neutral-100 sticky top-0 z-30">
        <div className="max-w-[1360px] mx-auto px-8 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Volver a grupos
          </a>
          <div className="flex items-center gap-5">
            <button onClick={handleShare} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-brand transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              Compartir
            </button>
            <FavoriteButton groupId={groupId} size={16} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-brand transition-colors" />
          </div>
        </div>
      </header>

      <div className="max-w-[1360px] mx-auto px-8 py-8">
        <div className="flex gap-8 items-start">
          <div className="w-[300px] flex-shrink-0">
            <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden sticky top-[80px]">
              <div className="aspect-square bg-[#F8F8F8] flex items-center justify-center p-6">
                {imageUrl ? (
                  <img src={imageUrl} alt={name} className="w-full h-full object-contain" />
                ) : (
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-neutral-200"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                )}
              </div>
              <div className="p-5">
                <h1 className="text-lg font-bold text-neutral-900 leading-tight mb-1">{name}</h1>
                {spec && <p className="text-sm text-neutral-500 mb-3">{spec}</p>}
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"/>Grupo abierto
                </span>
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
                  <span>Cierre: {closesLabel}</span>
                </div>
                <p className="text-xs text-neutral-400 ml-[22px] mt-0.5">{remainingLabel}</p>
                <button onClick={handleShare}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-700 hover:border-brand hover:text-brand transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                  Compartir grupo
                </button>
              </div>
            </div>
          </div>

          <main className="flex-1 min-w-0">
            <GroupCenterContent groupId={groupId} pvp={pvp} tiers={tiers} maxStock={maxStock} initialBestPrice={initialBestPrice} />
          </main>

          <GroupRightSidebar groupId={groupId} maxStock={maxStock} />
        </div>
      </div>
    </div>
  )
}
