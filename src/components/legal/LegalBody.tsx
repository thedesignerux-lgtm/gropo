/**
 * Render de un documento legal. Server component puro: no hay estado, no hay
 * interacción, y así el texto llega en el HTML inicial —que es justo lo que quiere un
 * buscador y lo que necesita alguien que imprime la página o la guarda en PDF.
 */
import type { LegalBlock, LegalDoc } from '@/lib/legal'

function Block({ b }: { b: LegalBlock }) {
  switch (b.type) {
    case 'p':
      return <p className="text-[14px] leading-[1.75] text-neutral-700">{b.text}</p>
    case 'note':
      return (
        <p className="text-[13.5px] leading-[1.7] text-neutral-700 bg-neutral-50 border-l-2 border-brand rounded-r-lg px-4 py-3">
          {b.text}
        </p>
      )
    case 'list':
      return (
        <ul className="space-y-1.5 pl-1">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-[1.7] text-neutral-700">
              <span aria-hidden className="text-neutral-300 select-none mt-[2px]">—</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )
    case 'table':
      return (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[280px] text-[13.5px] border border-neutral-200 rounded-xl border-separate border-spacing-0 overflow-hidden">
            <thead>
              <tr className="bg-neutral-50">
                {b.head.map((h, i) => (
                  <th key={i} className="text-left font-bold text-neutral-800 px-4 py-2.5 border-b border-neutral-200">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className="px-4 py-2.5 text-neutral-700 border-b border-neutral-100 last:border-b-0">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

export default function LegalBody({ doc }: { doc: LegalDoc }) {
  return (
    <article className="bg-white border border-neutral-200 rounded-2xl px-5 py-6 sm:px-8 sm:py-9">
      {doc.intro && doc.intro.length > 0 && (
        <div className="space-y-3 pb-7 mb-7 border-b border-neutral-100">
          {doc.intro.map((b, i) => (
            <Block key={i} b={b} />
          ))}
        </div>
      )}

      <div className="space-y-8">
        {doc.sections.map((s, i) => (
          <section key={i} id={s.n ? `s${s.n}` : undefined} className="scroll-mt-24">
            {s.title && (
              <h2 className="text-[15.5px] font-bold text-neutral-900 mb-3 leading-snug">
                {s.n && <span className="text-neutral-400 font-semibold mr-2">{s.n}.</span>}
                {s.title}
              </h2>
            )}
            <div className="space-y-3">
              {s.blocks.map((b, j) => (
                <Block key={j} b={b} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  )
}
