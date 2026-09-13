// src/components/GroupHowAndTrust.tsx
//
// UX-05 · Los bloques de "cómo funciona" y de confianza de la ficha de grupo.
//
// Vivían solo dentro de `desktop/GroupDesktopView`, así que la ficha MÓVIL —donde
// se decide la mayor parte del tráfico— no tenía ni una sola frase que respondiera
// "¿qué pasa si el grupo no sale?" ni "¿cuándo me cobráis?". Los mensajes de
// confianza estaban únicamente en el checkout, es decir DESPUÉS de la decisión.
//
// Al extraerlos aquí hay una sola fuente para las dos vistas: cambiar un texto ya
// no puede dejar móvil y escritorio diciendo cosas distintas (era el coste de DT-03).

const STEPS = [
  { n: 1, title: 'Únete al grupo', body: 'Reservas tu plaza sin pagar nada por adelantado.' },
  { n: 2, title: 'Invita a más gente', body: 'Cada persona que entra acerca el siguiente tramo.' },
  { n: 3, title: 'El precio baja', body: 'Al cerrar, pagas el precio más bajo alcanzado.' },
]

const TRUST = [
  { title: 'Pago seguro', body: 'Tu dinero siempre protegido' },
  { title: 'Nunca pagas de más', body: 'Tú eliges tu precio máximo' },
  { title: 'Devoluciones fáciles', body: 'Si algo no encaja, lo solucionamos' },
]

export default function GroupHowAndTrust() {
  return (
    <>
      <section className="mt-9 pt-[30px] border-t border-[#F1EFF5]">
        <h2 className="text-[19px] font-extrabold text-neutral-900 mb-3">Cuantos más, menos pagas</h2>
        <p className="text-[15px] leading-relaxed text-[#57545e] max-w-[640px]">
          Cada vez que alguien asegura su plaza, el grupo se acerca al siguiente tramo y el precio baja
          para <strong>todos</strong>. No pagas hasta que el grupo cierra, y el importe final es el más bajo que se alcance.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-6">
          {STEPS.map(s => (
            <div key={s.n} className="rounded-2xl border border-[#E6EDEC] p-[18px]">
              <div className="w-[30px] h-[30px] rounded-[9px] bg-[#DEEDEC] flex items-center justify-center text-sm font-extrabold text-brand">{s.n}</div>
              <h3 className="text-[14.5px] font-bold text-neutral-900 mt-3">{s.title}</h3>
              <p className="text-[12.5px] text-[#6B6B76] leading-relaxed mt-1">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col sm:flex-row gap-5 sm:gap-11 mt-[30px] pt-[26px] border-t border-[#F1EFF5]">
        {TRUST.map(t => (
          <div key={t.title} className="flex items-center gap-[11px]">
            <div className="w-[34px] h-[34px] rounded-full bg-[#DEEDEC] flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-[13.5px] font-bold text-neutral-900">{t.title}</p>
              <p className="text-xs text-[#6B6B76]">{t.body}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
