'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLadders, MgCard, Drawer, type Membership } from '@/components/desktop/MisGruposDesktop'

export default function MisGruposMobile({ memberships }: { memberships: Membership[] }) {
  const ladders = useLadders(memberships)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const openMem = memberships.find(m => m.member_id === open) || null

  return (
    <div className="px-4">
      {memberships.length === 0 ? (
        <div className="text-sm text-gray-500 bg-white border border-gray-200 rounded-2xl px-5 py-8 text-center">
          Aún no participas en ningún grupo. <Link href="/" className="text-brand font-semibold">Explora grupos abiertos →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {memberships.map(m => (
            <MgCard key={m.member_id} m={m} ladder={ladders[m.group_id] || []} onOpen={() => setOpen(m.member_id)} />
          ))}
        </div>
      )}

      {/* Drawer (mismo panel que desktop, casi ancho completo en móvil) */}
      <div onClick={() => setOpen(null)} className="fixed inset-0 z-40 transition-opacity duration-300" style={{ background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(2px)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }} />
      <aside role="dialog" aria-modal="true" aria-label="Detalle del grupo" className="fixed top-0 right-0 h-screen w-[440px] max-w-[92vw] bg-white z-50 flex flex-col transition-transform duration-300" style={{ boxShadow: '-12px 0 40px rgba(15,23,42,.18)', transform: open ? 'translateX(0)' : 'translateX(100%)' }}>
        {openMem && <Drawer m={openMem} ladder={ladders[openMem.group_id] || []} onClose={() => setOpen(null)} />}
      </aside>
    </div>
  )
}
