'use client'

export type TabId = 'resumen' | 'conversacion' | 'participantes' | 'historial' | 'preguntas' | 'alertas'

interface NavItem {
  id: TabId
  label: string
  count?: number
  icon: React.ReactNode
}

const icons = {
  resumen: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  conversacion: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  participantes: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  historial: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  preguntas: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  alertas: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
}

interface Props {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  conversationCount?: number
  participantCount?: number
  questionCount?: number
  productName: string
  bestPrice: number
  pvp: number
  nextPrice: number
  groupId: string
}

export default function GroupSidebar({
  activeTab, onTabChange,
  conversationCount = 0, participantCount = 0, questionCount = 0,
  productName, bestPrice, pvp, nextPrice, groupId,
}: Props) {
  const navItems: NavItem[] = [
    { id: 'resumen', label: 'Resumen', icon: icons.resumen },
    { id: 'conversacion', label: 'Conversación', count: conversationCount || undefined, icon: icons.conversacion },
    { id: 'participantes', label: 'Participantes', count: participantCount || undefined, icon: icons.participantes },
    { id: 'historial', label: 'Historial de precios', icon: icons.historial },
    { id: 'preguntas', label: 'Preguntas', count: questionCount || undefined, icon: icons.preguntas },
    { id: 'alertas', label: 'Alertas', icon: icons.alertas },
  ]

  function handleShare() {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/grupo/${groupId}`
    const fmtWa = (n: number) => n.toFixed(2).replace('.', ',')
    const text = `🚴 ${productName} a ${fmtWa(bestPrice)}€ (PVP ${fmtWa(pvp)}€). Si entra 1 más baja a ${fmtWa(nextPrice)}€ para todos. Cierra el domingo 22:00: ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col h-full">
      {/* Back link */}
      <a href="/" className="flex items-center gap-2 text-sm text-neutral-600 hover:text-brand transition-colors mb-6 px-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Volver a grupos
      </a>

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
              activeTab === item.id
                ? 'bg-brand/8 text-brand'
                : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
            }`}
          >
            <span className={activeTab === item.id ? 'text-brand' : 'text-neutral-400'}>
              {item.icon}
            </span>
            <span className="flex-1">{item.label}</span>
            {item.count != null && (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                activeTab === item.id ? 'bg-brand/15 text-brand' : 'bg-neutral-100 text-neutral-500'
              }`}>
                {item.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Divider */}
      <div className="border-t border-neutral-100 my-4" />

      {/* Share */}
      <button
        onClick={handleShare}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors text-left"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        Compartir grupo
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Mascot CTA */}
      <div className="mt-6 bg-neutral-50 rounded-2xl p-4 text-center">
        <div className="w-16 h-16 mx-auto mb-3 bg-brand/10 rounded-full flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-neutral-900 mb-1">Cuantos más seamos, menos pagamos</p>
        <p className="text-xs text-neutral-500 mb-3">Comparte este grupo y ahorra más.</p>
        <button
          onClick={handleShare}
          className="w-full flex items-center justify-center gap-2 bg-brand text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-brand-dark transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          Compartir enlace
        </button>
      </div>
    </aside>
  )
}
