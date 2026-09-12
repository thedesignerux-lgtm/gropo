'use client'

import { useId } from 'react'

export type WaveColorScheme = 'brand' | 'orange' | 'green' | 'gray'

interface WaveColors {
  fill: string
  fillEnd: string
  stroke: string
  bgFill: string
  dot: string
  halo: string
}

const COLORS: Record<WaveColorScheme, WaveColors> = {
  orange: {
    fill: '#F97316',
    fillEnd: '#FED7AA',
    stroke: '#EA580C',
    bgFill: '#FFF7ED',
    dot: '#EA580C',
    halo: 'rgba(249, 115, 22, 0.12)',
  },
  brand: {
    fill: '#024947',
    fillEnd: '#E4F0F0',
    stroke: '#024947',
    bgFill: '#F7FBFB',
    dot: '#024947',
    halo: 'rgba(2, 73, 71, 0.12)',
  },
  green: {
    fill: '#059669',
    fillEnd: '#A7F3D0',
    stroke: '#047857',
    bgFill: '#ECFDF5',
    dot: '#059669',
    halo: 'rgba(5, 150, 105, 0.12)',
  },
  gray: {
    fill: '#9CA3AF',
    fillEnd: '#E5E7EB',
    stroke: '#6B7280',
    bgFill: '#F3F4F6',
    dot: '#6B7280',
    halo: 'rgba(107, 114, 128, 0.08)',
  },
}

// ─── Wave shape generation ──────────────────────────────────

/** DJB2 hash → stable positive integer from any string */
function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return h >>> 0
}

/** Seeded LCG pseudo-random — deterministic across SSR + hydration */
function lcg(seed: number) {
  let s = seed || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * Generate organic wave Y values (0 = peak top, 1 = baseline).
 * Uses a seeded momentum random-walk (velocity with damping + gentle
 * mean-reversion) instead of periodic sines, so each card reads like a
 * live stock/price ticker — irregular rolling hills, never a repeating
 * sawtooth. Deterministic across SSR + hydration for a given seed.
 */
function makeProfile(seed: string): number[] {
  const rand = lcg(hash(seed || 'wave'))
  const N = 8

  const out: number[] = []
  let v = 0.28 + rand() * 0.44      // random starting height
  let vel = (rand() - 0.5) * 0.38   // random initial momentum
  for (let i = 0; i < N; i++) {
    out.push(v)
    vel += (rand() - 0.5) * 0.34    // random impulse each step (dynamic)
    vel += (0.5 - v) * 0.07         // light mean-reversion toward center
    vel *= 0.74                     // damping → smooth, momentum-y roll
    v += vel
    // Soft bounce off the rails so the crest never flatlines at an edge
    if (v < 0.14) { v = 0.14; vel = Math.abs(vel) * 0.6 }
    if (v > 0.86) { v = 0.86; vel = -Math.abs(vel) * 0.6 }
  }
  return out
}

/**
 * Catmull-Rom → cubic Bézier smooth SVG path through all points.
 * C1-continuous curve that passes exactly through every control point.
 */
function curvePath(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  const n = pts.length
  const r = (v: number) => v.toFixed(1)
  let d = `M${r(pts[0][0])},${r(pts[0][1])}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(n - 1, i + 2)]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C${r(c1x)},${r(c1y)},${r(c2x)},${r(c2y)},${r(p2[0])},${r(p2[1])}`
  }
  return d
}

/** Linear interpolation of Y at any X between control points */
function lerpY(pts: [number, number][], x: number): number {
  if (x <= pts[0][0]) return pts[0][1]
  if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1]
  for (let i = 0; i < pts.length - 1; i++) {
    if (x <= pts[i + 1][0]) {
      const t = (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0])
      return pts[i][1] + t * (pts[i + 1][1] - pts[i][1])
    }
  }
  return pts[pts.length - 1][1]
}

// ─── Component ──────────────────────────────────────────────

interface Props {
  /** Current units */
  current: number
  /** Maximum units (stock) */
  max: number
  /** Height in pixels */
  height?: number
  /** Show the progress dot */
  showDot?: boolean
  /** Color scheme */
  colorScheme?: WaveColorScheme
  /** Show ambient halo glow */
  showHalo?: boolean
  /** Additional className */
  className?: string
  /** Seed for unique wave shape (e.g. group ID) */
  seed?: string
}

/**
 * WaveProgress — smooth area-chart wave with gradient fill.
 * Emotional ticker: no axes, no labels. Purely visual.
 */
export default function WaveProgress({
  current,
  max,
  height = 32,
  showDot = true,
  colorScheme = 'brand',
  showHalo = false,
  className = '',
  seed = '',
}: Props) {
  const uid = useId()
  const gFill = `wf${uid}`
  const gBg = `wb${uid}`
  const c = COLORS[colorScheme]
  const ratio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0

  const W = 200
  const H = height
  const PAD = H * 0.10
  const AMP = H * 0.68

  const profile = makeProfile(seed || `${current}-${max}`)
  const pts: [number, number][] = profile.map((y, i) => [
    (i / (profile.length - 1)) * W,
    PAD + y * AMP,
  ])

  // Full background area
  const bgLine = curvePath(pts)
  const bgArea = `${bgLine}L${W},${H}L0,${H}Z`

  // Filled area clipped at progress ratio
  const clipX = ratio * W
  const clipped = pts.filter(([x]) => x <= clipX + 0.5)
  if (ratio > 0 && ratio < 1) clipped.push([clipX, lerpY(pts, clipX)])
  const fillLine = clipped.length >= 2 ? curvePath(clipped) : ''
  const fillArea = fillLine
    ? `${fillLine}L${clipped[clipped.length - 1][0].toFixed(1)},${H}L0,${H}Z`
    : ''

  const dotLeft = ratio * 100
  const dotTop = ratio > 0 ? (lerpY(pts, clipX) / H) * 100 : 0

  return (
    <div className={`relative w-full ${className}`} style={{ height: H }}>
      {/* Ambient halo */}
      {showHalo && ratio > 0 && (
        <div
          className="absolute rounded-2xl pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at ${ratio * 75 + 12}% 50%, ${c.halo} 0%, transparent 70%)`,
            filter: 'blur(10px)',
            inset: -8,
          }}
        />
      )}

      {/* Wave SVG */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
        role="presentation"
      >
        <defs>
          <linearGradient id={gFill} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.fill} stopOpacity="0.80" />
            <stop offset="100%" stopColor={c.fillEnd} stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id={gBg} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.bgFill} stopOpacity="0.7" />
            <stop offset="100%" stopColor={c.bgFill} stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Background wave (full width, muted) */}
        <path d={bgArea} fill={`url(#${gBg})`} />

        {/* Filled wave (up to progress) */}
        {fillArea && <path d={fillArea} fill={`url(#${gFill})`} />}

        {/* Thin stroke along the filled curve crest */}
        {fillLine && (
          <path
            d={fillLine}
            fill="none"
            stroke={c.stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.5"
          />
        )}
      </svg>

      {/* Progress dot */}
      {showDot && ratio > 0 && ratio < 1 && (
        <div
          className="absolute w-3 h-3 rounded-full bg-white"
          style={{
            left: `${dotLeft}%`,
            top: `${dotTop}%`,
            transform: 'translate(-50%, -50%)',
            border: `2.5px solid ${c.dot}`,
            boxShadow: `0 0 0 3px ${c.halo}, 0 1px 3px rgba(0,0,0,0.12)`,
          }}
        />
      )}
    </div>
  )
}
