import Link from 'next/link'
import DesktopNavbar from '@/components/desktop/DesktopNavbar'
import BottomNav from '@/components/BottomNav'

export default function MensajesPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
      <div className="hidden lg:block"><DesktopNavbar /></div>

      <div className="flex-1 min-w-0 flex flex-col pb-24 lg:pb-0">
        <main className="w-full max-w-[720px] mx-auto px-4 lg:px-10 pt-6 lg:pt-10 pb-14">
          <h1 className="text-2xl lg:text-[28px] font-extrabold tracking-tight text-neutral-900">Mensajes</h1>
          <p className="text-sm text-neutral-500 mt-1">Tu comunicación con Vonda.</p>

          <div className="mt-8 bg-white border border-neutral-200 rounded-2xl px-6 py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto mb-4">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
            </div>
            <p className="text-[15px] font-bold text-neutral-900">Aún no tienes mensajes</p>
            <p className="text-sm text-neutral-500 mt-1 max-w-xs mx-auto">Cuando haya novedades importantes sobre tus pedidos o tus grupos, te escribiremos por aquí.</p>
            <Link href="/ayuda" className="inline-block mt-5 border border-neutral-200 hover:border-neutral-300 text-neutral-700 font-bold text-sm rounded-xl px-6 py-3 transition-colors">¿Necesitas ayuda?</Link>
          </div>
        </main>
      </div>

      <div className="lg:hidden"><BottomNav /></div>
    </div>
  )
}
