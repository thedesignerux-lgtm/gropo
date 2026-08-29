// src/components/PulseRings.tsx — GROPO PULSE · anillos decorativos
// Sin hooks: usable desde componentes server y client.
// El padre debe ser `position: relative`; los anillos se expanden desde su centro.

export type PulseTone = 'orange' | 'purple'

const TONE: Record<PulseTone, string> = {
  orange: '#F0531F', // energía latente (Mi Radar observando)
  purple: '#6C3CE1', // compromisos activos empujando
}

// intensidad → velocidad y nº de anillos (1 suave · 2 medio · 3 fuerte)
const SPEED: Record<1 | 2 | 3, string> = { 1: '2.8s', 2: '2.2s', 3: '1.5s' }

interface Props {
  tone: PulseTone
  intensity: 0 | 1 | 2 | 3
  className?: string
}

export default function PulseRings({ tone, intensity, className = '' }: Props) {
  if (intensity <= 0) return null
  const color = TONE[tone]
  const speed = SPEED[(Math.min(3, Math.max(1, intensity)) as 1 | 2 | 3)]
  return (
    <span aria-hidden="true" className={className} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <span
        className="gropo-pulse-ring"
        style={{ border: `2px solid ${color}`, ['--pulse-speed' as never]: speed }}
      />
      {intensity >= 2 && (
        <span
          className="gropo-pulse-ring gropo-pulse-ring--delayed"
          style={{ border: `2px solid ${color}`, ['--pulse-speed' as never]: speed }}
        />
      )}
    </span>
  )
}
