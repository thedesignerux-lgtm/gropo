'use client'

/**
 * Panel de progreso + tarjetas de tramo para la ficha de ESCRITORIO.
 *
 * Adaptación del mockup de Benjamin (15 sep 2026), con tres correcciones de datos y
 * un reparto de trabajo entre las dos piezas:
 *
 *   · LAS TARJETAS SON LA ELECCIÓN. Precio y umbral, nada más. No repiten las cifras
 *     del panel: hacerlo obligaba a meter «12 / 20 · Faltan 8» en 97 px y la tarjeta
 *     salía altísima y estrecha.
 *   · EL PANEL ES EL DETALLE DE LO ELEGIDO. Cambia con la selección: titular, frase,
 *     barra y cifras hablan SIEMPRE del tramo que tienes marcado.
 *
 * Y lo que se corrigió del mockup:
 *
 * 1. CADA TRAMO LLEVA SU PROPIA DEMANDA. El mockup repetía el mismo «13» en las tres
 *    tarjetas. En las ruedas Zipp es correcto por casualidad —los 13 compradores son de
 *    «comprar ahora» y cuentan en los cuatro tramos—, pero es falso en 3 de los 4 grupos
 *    abiertos: Zapatillas 8 / 12 / 22, Garmin 6 / 10 / 10, Gafas 14 / 14 / 18. Un tramo
 *    más barato admite a MÁS gente, así que su demanda es mayor. Fue el fallo A-36.
 * 2. «13 + 7» NO. Esa notación ya significa «lo que hay + lo que TÚ vas a pedir» desde
 *    el 15 sep y está en producción. El hueco se escribe «12 / 20 · Faltan 8».
 * 3. UNIDADES, NO PERSONAS, en la barra: el umbral del tramo es de unidades y hay
 *    compradores que piden varias. El recuento de personas vive arriba (A-04).
 */

export interface ChooserTier { price: number; uds: number }

const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
const uds = (n: number) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`

export default function TierChooser({
  detents, tierDemand, curIdx, floorIdx, selIdx, onSelIdx, myUnits = 0, disabled = false, notActivated = false,
}: {
  detents: ChooserTier[]
  /** Demanda efectiva por tramo, con las unidades como clave. De `tier_demand`. */
  tierDemand: Record<number, number>
  /** Tramo desbloqueado más barato: el precio que el grupo paga HOY, sin ti. */
  curIdx: number
  /**
   * Suelo de lo elegible: el tramo al que entrarías con TUS unidades dentro. Es lo que
   * `prepare_join` va a grabar como techo (`compute_price(grupo, cantidad)`), así que
   * por encima de él no hay nada que elegir. Igual a `curIdx` salvo que tu cantidad
   * desbloquee un tramo más barato ella sola.
   */
  floorIdx: number
  selIdx: number
  onSelIdx: (i: number) => void
  /** Unidades del selector de cantidad. Se pintan como proyección, nunca sumadas. */
  myUnits?: number
  disabled?: boolean
  /** A-01 · Sin grupo activado no hay precio garantizado: el panel calla. */
  notActivated?: boolean
}) {
  const teal = '#024947'
  const orange = '#E8944A'

  const cur = detents[curIdx]
  const piso = detents[floorIdx]
  const sel = detents[selIdx]
  const esperando = selIdx > floorIdx
  /** Tu cantidad, ella sola, desbloquea un tramo que el grupo aún no tiene. */
  const loDesbloqueasTu = floorIdx > curIdx
  const accent = esperando ? orange : teal

  const dem = (n: number) => Math.max(0, Number(tierDemand[n] ?? 0))

  /**
   * De qué tramo habla el panel:
   *   · si has elegido un tramo aún cerrado → de ESE, que es tu decisión;
   *   · si estás en el precio de hoy → del siguiente, que es lo que puede pasar.
   */
  /**
   * De qué tramo habla el panel —titular, frase Y BARRA, los tres del mismo—:
   *
   *   · has marcado uno más barato  → de ese, que es tu decisión;
   *   · tus unidades abren un tramo → del que abres, para que la barra enseñe que lo
   *     completas: «13 + 7 / 20». Antes enseñaba el SIGUIENTE («23 + 7 / 45»), o sea
   *     el titular hablaba de 99 € y la barra de 85 €. Lo cazó Benjamin.
   *   · si no                       → del siguiente, que es lo que puede pasar.
   */
  const sig = detents[floorIdx + 1] ?? null
  const focus = esperando ? sel : (loDesbloqueasTu ? piso : sig)
  const have = focus ? dem(focus.uds) : 0
  const mine = myUnits > 0 ? myUnits : 0
  /**
   * Lo que falta se cuenta CONTIGO DENTRO, igual que la barra. Contarlo de las dos
   * maneras a la vez —titular sin tus unidades, barra con ellas— dejaba «Faltan 23» a
   * dos centímetros de «22 + 8 / 45», que dice 15. El titular avisa de que te incluye.
   */
  const missing = focus ? Math.max(0, focus.uds - have - mine) : 0
  /** Lo que faltaría para el tramo de después del tuyo, contigo dentro. */
  const faltanSig = sig ? Math.max(0, sig.uds - dem(sig.uds) - mine) : 0
  const pctGrupo = focus && focus.uds > 0 ? Math.min(100, (Math.min(have, focus.uds) / focus.uds) * 100) : 0
  const pctMio = focus && focus.uds > 0 ? Math.min(100 - pctGrupo, (mine / focus.uds) * 100) : 0

  return (
    <div>
      {/* ── Panel: el detalle del tramo que tienes marcado ──────────────── */}
      {!notActivated && (
        <div
          className="rounded-2xl p-4"
          style={{
            background: esperando ? '#FDF6EE' : '#F1F8F7',
            border: `1px solid ${esperando ? '#F3E3CC' : '#DCEBE9'}`,
            transition: 'background .25s, border-color .25s',
          }}
        >
          <div className="flex items-start gap-3">
            <span className="grid place-items-center rounded-full shrink-0" style={{ width: 38, height: 38, background: esperando ? '#F8E7D2' : '#DBECEA', color: accent }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
                <circle cx="10" cy="8" r="3.2" />
                <path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4" />
                <path d="M15.4 4.8a3.2 3.2 0 0 1 0 6.2" />
              </svg>
            </span>
            <div className="min-w-0">
              {focus ? (
                <>
                  <p className="text-[16px] font-extrabold leading-tight text-neutral-900">
                    {/* `esperando` manda: si has marcado un tramo más barato, el titular
                        habla de ESE, no de lo que desbloquean tus unidades. */}
                    {!esperando && loDesbloqueasTu
                      ? <>Con {uds(mine)} entraríais a {fmt(piso.price)}</>
                      : <>{mine > 0 ? 'Contigo dentro, ' : ''}{missing === 1 ? 'falta 1 unidad' : `faltan ${missing} unidades`} para{' '}
                          {esperando ? 'llegar a' : 'pagar'} {fmt(focus.price)}</>}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-snug text-neutral-600">
                    {esperando ? (
                      /* El precio de referencia es el TUYO —el del suelo—, no el del grupo
                         sin ti: si tus unidades ya lo bajan, decir «ahora está en 119 €»
                         compara contra un precio que tú no llegarías a pagar. */
                      <>Solo comprarías si el grupo llega a <b className="font-bold text-neutral-800">{fmt(sel.price)}</b>.
                        {' '}{loDesbloqueasTu ? 'Contigo entraría en' : 'Ahora está en'}{' '}
                        <b className="font-bold text-neutral-800">{fmt(piso.price)}</b>, y cada unidad que entra lo acerca.</>
                    ) : loDesbloqueasTu ? (
                      /* Tus unidades, solas, bajan el precio del grupo. Decirlo es más
                         cierto y más fuerte que enseñar el precio de antes. */
                      <>Tus unidades completan las {uds(piso.uds)} del tramo, así que pagaríais{' '}
                        <b className="font-bold text-neutral-800">{fmt(piso.price)}</b> en vez de {fmt(cur.price)}.
                        {sig && faltanSig > 0 && <> Y {fmt(sig.price)} con {faltanSig} más.</>}</>
                    ) : (
                      <>Ahora mismo entrarías con <b className="font-bold text-neutral-800">{fmt(cur.price)}</b>.
                        {' '}Si se {missing === 1 ? 'une 1 unidad más' : `unen ${missing} unidades más`}, todos pagaríais{' '}
                        <b className="font-bold text-neutral-800">{fmt(focus.price)}</b>.</>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[16px] font-extrabold leading-tight text-neutral-900">
                    Este es el precio más bajo: {fmt(piso.price)}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-snug text-neutral-600">
                    No hay ningún tramo por debajo. Si te unes hoy, pagas <b className="font-bold text-neutral-800">{fmt(piso.price)}</b>.
                  </p>
                </>
              )}
            </div>
          </div>

          {focus && (
            <>
              <div className="relative mt-3.5" style={{ height: 14 }}>
                <div className="absolute rounded-full overflow-hidden flex" style={{ left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: 6, background: esperando ? '#F3E3CC' : '#DCEBE9' }}>
                  <div style={{ width: `${pctGrupo}%`, background: accent, transition: 'width .3s ease' }} />
                  {/* Lo tuyo, más claro: es una proyección, no lo que hay. */}
                  {pctMio > 0 && <div style={{ width: `${pctMio}%`, background: accent, opacity: 0.4, transition: 'width .3s ease' }} />}
                </div>
                <span className="absolute rounded-full" style={{ left: '100%', top: '50%', transform: 'translate(-50%,-50%)', width: 14, height: 14, background: '#fff', border: `3px solid ${accent}` }} />
              </div>
              {/* Solo la fracción. El «Faltan 8 para 99 €» que llevaba a la derecha era
                  el titular otra vez, palabra por palabra, a 60 px de distancia. */}
              <div className="mt-2 text-[12px] font-semibold text-neutral-700 tabular-nums">
                {have}
                {mine > 0 && <span style={{ color: accent }}> + {mine}</span>}
                {' / '}{uds(focus.uds)}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tarjetas: solo la elección ──────────────────────────────────── */}
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-500 mt-5 mb-2">
        Tu precio máximo
      </p>
      <div
        role="radiogroup"
        aria-label="Elige tu precio máximo"
        className="grid gap-2"
        style={{
          /* Un tramo ya superado no se puede elegir: se queda en su ancho mínimo. */
          gridTemplateColumns: detents.map((_, i) => (i < floorIdx ? 'auto' : 'minmax(0,1fr)')).join(' '),
          alignItems: 'stretch',
        }}
      >
        {detents.map((d, i) => {
          /* Por debajo del suelo no hay elección posible: o el grupo ya lo superó, o
             tus propias unidades lo superan. En ambos casos queda solo el precio. */
          if (i < floorIdx) {
            return (
              <div key={i} className="self-center text-center text-[12px] font-semibold text-neutral-400 whitespace-nowrap px-0.5">
                {fmt(d.price)}
              </div>
            )
          }

          const selected = i === selIdx
          const achieved = i <= curIdx
          /* Este tramo lo abre TU cantidad; el grupo todavía no lo tiene. */
          const abiertoPorTi = !achieved && i === floorIdx
          const pick = (e: { preventDefault: () => void }) => {
            if (disabled) return
            e.preventDefault()
            if (i !== selIdx) onSelIdx(i)
          }

          return (
            <div
              key={i}
              role="radio"
              aria-checked={selected}
              aria-label={`${fmt(d.price)}${achieved ? ', disponible para todos' : abiertoPorTi ? ', lo desbloquean tus unidades' : `, a partir de ${uds(d.uds)}`}`}
              tabIndex={!disabled && selected ? 0 : -1}
              /* `pointerdown`, no `click`: mismo motivo que en el slider. */
              onPointerDown={pick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') pick(e)
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); if (!disabled) onSelIdx(Math.min(detents.length - 1, selIdx + 1)) }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); if (!disabled) onSelIdx(Math.max(floorIdx, selIdx - 1)) }
              }}
              className="rounded-xl px-2.5 py-2.5 flex items-center gap-2"
              style={{
                border: `1.5px solid ${selected ? accent : '#E6EDEC'}`,
                background: selected ? (esperando ? '#FFFDFA' : '#FAFDFD') : '#fff',
                cursor: disabled ? 'default' : 'pointer',
                boxShadow: selected ? `0 0 0 3px ${accent}22` : 'none',
                transition: 'border-color .2s, box-shadow .2s, background .2s',
              }}
            >
              <span className="grid place-items-center rounded-full shrink-0" style={{ width: 16, height: 16, border: `2px solid ${selected ? accent : '#C9D6D4'}` }}>
                {selected && <span className="rounded-full" style={{ width: 7, height: 7, background: accent }} />}
              </span>
              <span className="min-w-0">
                <span className="block text-[18px] font-extrabold leading-none tabular-nums whitespace-nowrap" style={{ color: selected ? accent : achieved ? '#1a1a1f' : '#5C6B6E' }}>
                  {fmt(d.price)}
                </span>
                <span className="block text-[10.5px] leading-tight text-neutral-500 mt-1">
                  {achieved ? 'Para todos' : abiertoPorTi ? 'Lo abres tú' : `Con ${d.uds} uds.`}
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
