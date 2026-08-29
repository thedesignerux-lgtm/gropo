'use client'

import { useState } from 'react'
import Link from 'next/link'
import DesktopNavbar from '@/components/desktop/DesktopNavbar'
import BottomNav from '@/components/BottomNav'

const FAQS = [
  { q: '¿Me cobráis al unirme a un grupo?', a: 'No. Al asegurar tu precio hacemos una retención en tu tarjeta (un “hold”), no un cobro. Solo se procesa el pago si el grupo alcanza su objetivo al cerrar. Si no lo alcanza, la retención se libera y no se te cobra nada.' },
  { q: '¿Qué significa “asegurar el precio”?', a: 'Reservas tu plaza en el grupo al precio actual. Si entran más personas y el precio baja, pagas el precio más bajo. Nunca pagas más del máximo que aceptaste al unirte.' },
  { q: '¿Qué pasa si el grupo no llega al objetivo?', a: 'No pasa nada malo: se libera tu retención automáticamente y no se realiza ningún cargo. Es la garantía de Gropo — si no hay grupo, no hay pago.' },
  { q: '¿Cuándo cierra un grupo?', a: 'Los grupos cierran cada domingo a las 22:00 (hora peninsular española). En ese momento se fija el precio final único para todos los participantes.' },
  { q: '¿Puedo salir de un grupo?', a: 'Sí, en cualquier momento antes del cierre. Al salir se libera tu retención al instante, sin coste.' },
  { q: '¿Cómo veo mis pedidos?', a: 'En la sección “Mis grupos”, identificándote con el teléfono y el email con los que te uniste. Ahí ves el estado de cada grupo y tu plaza.' },
  { q: '¿Cómo y cuándo llega mi pedido?', a: 'Cuando el grupo cierra habiendo alcanzado el objetivo, se procesa tu pago y preparamos el envío con seguimiento. Recibirás la información de tracking por email.' },
  { q: '¿Puedo cambiar mi dirección de envío?', a: 'Sí, desde tu perfil, en el bloque “Dirección de envío”. Puedes tener varias direcciones y marcar una como predeterminada.' },
  { q: '¿Es seguro el pago?', a: 'Sí. Los pagos se gestionan a través de Stripe, líder mundial en pagos. Gropo no almacena los datos de tu tarjeta.' },
]

export default function AyudaPage() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
      <div className="hidden lg:block"><DesktopNavbar /></div>

      <div className="flex-1 min-w-0 flex flex-col pb-24 lg:pb-0">
        <main className="w-full max-w-[760px] mx-auto px-4 lg:px-10 pt-6 lg:pt-10 pb-14">
          <span className="inline-block text-xs font-bold uppercase tracking-wide text-brand bg-brand/10 rounded-full px-3 py-1 mb-4">Centro de ayuda</span>
          <h1 className="text-[28px] lg:text-4xl font-extrabold tracking-tight text-neutral-900">¿En qué te ayudamos?</h1>
          <p className="text-[15px] text-neutral-500 mt-3 leading-relaxed">Las preguntas más frecuentes sobre cómo comprar en grupo con Gropo.</p>

          <div className="mt-8 bg-white border border-neutral-200 rounded-2xl divide-y divide-neutral-100 overflow-hidden">
            {FAQS.map((f, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                  className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 hover:bg-neutral-50 transition-colors"
                >
                  <span className="text-[14.5px] font-semibold text-neutral-900">{f.q}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={`text-neutral-400 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {open === i && (
                  <p className="px-5 pb-4 -mt-1 text-[13.5px] text-neutral-600 leading-relaxed">{f.a}</p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 bg-white border border-neutral-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
            </div>
            <div className="flex-1">
              <h3 className="text-[14.5px] font-bold text-neutral-900">¿No encuentras tu respuesta?</h3>
              <p className="text-[13px] text-neutral-500 mt-0.5">Escríbenos y te ayudamos lo antes posible.</p>
            </div>
            <a href="mailto:hola@vonda.es" className="bg-brand text-white font-bold text-sm rounded-xl px-5 py-2.5 text-center shrink-0">Contactar</a>
          </div>

          <p className="text-center text-[13px] text-neutral-400 mt-8">
            ¿Nuevo en Gropo? <Link href="/como-funciona" className="text-brand font-semibold">Descubre cómo funciona</Link>
          </p>
        </main>
      </div>

      <div className="lg:hidden"><BottomNav /></div>
    </div>
  )
}
