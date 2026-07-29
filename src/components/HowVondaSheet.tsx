'use client'

// Bottom sheet "¿Cómo funciona Vonda?" — compartido entre la home (card
// destacada) y el checkout (enlace "¿Cómo funciona el pago?").
// Se monta siempre; queda inerte con pointer-events:none mientras está cerrado.

const ROWS = [
  { emoji: '💳', h: 'Hoy no pagas nada', b: 'Tu banco puede mostrar una autorización temporal por el importe que hayas elegido. No es un cobro.' },
  { emoji: '📉', h: 'Siempre pagas el precio más bajo', b: 'Si el grupo alcanza tu precio o uno mejor, comprarás automáticamente al precio más bajo conseguido.' },
  { emoji: '🛡️', h: 'Sin riesgo', b: 'Si el grupo no alcanza tu precio, no se realizará ninguna compra y la autorización temporal se liberará automáticamente al cerrar la Vonda.' },
  { emoji: '⏰', h: 'Cierre', b: 'El precio final se calcula el domingo a las 22:00.' },
]

export default function HowVondaSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50" style={{ pointerEvents: open ? 'auto' : 'none' }}>
      <div
        onClick={onClose}
        className="absolute inset-0 flex items-end justify-center transition-opacity"
        style={{ background: 'rgba(18,18,26,.42)', opacity: open ? 1 : 0, display: open ? 'flex' : 'none' }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-white"
          style={{ borderRadius: '22px 22px 0 0', padding: '20px 20px 30px', maxHeight: '85%', overflowY: 'auto', animation: open ? 'vSheet .24s cubic-bezier(.22,1,.36,1) both' : 'none' }}
        >
          <div className="mx-auto mb-3.5 rounded-full" style={{ width: 38, height: 4, background: '#E4E2EC' }} />
          <div className="text-[17px] font-extrabold tracking-tight text-[#1a1a1f]">¿Cómo funciona Vonda?</div>
          {ROWS.map((r, i) => (
            <div key={r.h} className="flex items-start gap-2.5" style={{ marginTop: i === 0 ? 16 : 14 }}>
              <span className="text-[20px] leading-none">{r.emoji}</span>
              <div>
                <div className="text-[13px] font-extrabold text-[#1a1a1f]">{r.h}</div>
                <p className="text-[12.5px] leading-[1.5]" style={{ color: '#4a4a52', margin: '4px 0 0' }}>{r.b}</p>
              </div>
            </div>
          ))}
          <button type="button" onClick={onClose} className="w-full mt-[18px] bg-brand text-white text-[14px] font-extrabold rounded-[13px]" style={{ padding: 14 }}>Entendido</button>
        </div>
      </div>
    </div>
  )
}
