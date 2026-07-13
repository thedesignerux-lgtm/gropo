'use client'

import GroupCenterContent from './GroupCenterContent'
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
  tiers, maxStock, closesAt,
}: Props) {
  function handleShare() {
    const url = `https://www.vonda.es/grupo/${groupId}`
    if (navigator.share) { navigator.share({ title: name, url }) }
    else { navigator.clipboard.writeText(url) }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Top bar */}
      <header className="bg-white border-b border-neutral-100 sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-8 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Volver a grupos
          </a>
          <button onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:border-brand hover:text-brand transition-colors">
            Compartir grupo
          </button>
        </div>
      </header>

      {/* Main 2-column layout */}
      <div className="max-w-[1200px] mx-auto px-8 py-8">
        <div className="flex gap-8 items-start">
          {/* Left: product info */}
          <main className="flex-1 min-w-0">
            <GroupCenterContent
              groupId={groupId}
              name={name}
              spec={spec}
              imageUrl={imageUrl}
              pvp={pvp}
              tiers={tiers}
              maxStock={maxStock}
              initialBestPrice={initialBestPrice}
              closesAt={closesAt}
            />
          </main>

          {/* Right: price selector + CTA */}
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
      </div>
    </div>
  )
}
