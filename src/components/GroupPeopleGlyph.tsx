/**
 * A-33 · El icono que acompaña al recuento de gente de un grupo.
 *
 * QUÉ SUSTITUYE. Tres círculos con las letras A, B y C —`AVATAR_LETTERS`— que estaban
 * en el panel de escritorio, en el bloque de la ficha móvil y en las tarjetas de la
 * home. No eran iniciales de nadie: eran constantes. En las tarjetas se pintaban
 * incluso con el grupo vacío.
 *
 * Por qué importa más de lo que parece: inventar identidades para adornar la prueba
 * social es el mismo error que «✓ Precio bloqueado» (A-30) o los 1,8 s fabricados. Un
 * comprador desconfiado lo detecta, y contradice lo único que este producto tiene de
 * verdad singular, que es contar la mecánica del dinero sin adornos.
 *
 * Un símbolo anónimo de grupo no afirma nada falso: dice «gente», que es exactamente
 * lo que la frase de al lado ya cuantifica. Si no hay gente, no se pinta.
 */

export default function GroupPeopleGlyph({
  count,
  size = 'md',
}: {
  /** Personas reales en el grupo. Con 0 o menos no se pinta nada. */
  count: number
  size?: 'sm' | 'md'
}) {
  if (!Number.isFinite(count) || count <= 0) return null

  const box = size === 'sm' ? 19 : 28
  const icon = size === 'sm' ? 11 : 15

  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full text-brand"
      style={{
        width: box,
        height: box,
        background: '#DEEDEC',
        border: size === 'sm' ? '2px solid #F2F7F7' : '2px solid #FFFFFF',
      }}
    >
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
        <circle cx="10" cy="8" r="3.2" />
        <path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4" />
        <path d="M15.4 4.8a3.2 3.2 0 0 1 0 6.2" />
      </svg>
    </span>
  )
}
