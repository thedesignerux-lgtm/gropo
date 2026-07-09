'use client'

import { useId } from 'react'

type WaveColorScheme = 'brand' | 'orange' | 'green'

const COLOR_MAP: Record<WaveColorScheme, {
  gradientStart: string
  gradientEnd: string
  bg: string
  halo: string
  dotBorder: string
}> = {
  brand: {
    gradientStart: '#6C3CE1',
    gradientEnd: '#8B63E8',
    bg: '#F0EEFF',
    halo: 'rgba(108, 60, 225, 0.10)',
    dotBorder: '#6C3CE1',
  },
  orange: {
    gradientStart: '#E8590C',
    gradientEnd: '#FF8C42',
    bg: '#FFF4ED',
    halo: 'rgba(232, 89, 12, 0.10)',
    dotBorder: '#E8590C',
  },
  green: {
    gradientStart: '#0D9F6E',
    gradientEnd: '#31C48D',
    bg: '#ECFDF5',
    halo: 'rgba(13, 159, 110, 0.10)',
    dotBorder: '#0D9F6E',
  },
}

// Pre-defined organic wave control points (normalized 0–1 on both axes)
// Each point is [x, y] where y=0 is top of wave, y=1 is baseline
// This gives a natural, non-repetitive wave shape like rolling hills
const WAVE_POINTS: [number, number][] = [
  [0,    0.70],
  [0.06, 0.35],
  [0.12, 0.55],
  [0.18, 0.25],
  [0.25, 0.50],
  [0.32, 0.15],
  [0.38, 0.45],
  [0.44, 0.30],
  [0.50, 0.55],
  [0.56, 0.20],
  [0.62, 0.50],
  [0.68, 0.35],
  [0.75, 0.60],
  [0.82, 0.25],
  [0.88, 0.50],
  [0.94, 0.40],
  [1.00, 0.65],
]

interface Props {
  /** Current units */
  current: number
  /** Maximum units (stock) */
  max: number
  /** Height in pixels */
  height?: number
  /** Show the position dot */
  showDot?: boolean
  /** Color scheme */
  colorScheme?: WaveColorScheme
  /** Show ambient halo behind the wave */
  showHalo?: boolean
  /** Additional className */
  className?: string
}

/**
 * WaveProgress — Vonda brand identity progress bar.
 * Smooth, organic wave shape (area chart aesthetic) with gradient fill.
 * No axes, no labels — purely an emotional ticker.
 */
export default function WaveProgress({
  current,
  max,
  height = 32,
  showDot = true,
  colorScheme = 'brand',
  showHalo = false,
  className = '',
}: Props) {
  const gradientId = useId()
  const haloId = useId()
  const colors = COLOR_MAP[colorScheme]
  const ratio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0

  const vw = 100  // SVG viewBox width
  const topPad = height * 0.10 // breathing room at top
  const waveH = height * 0.55  // vertical range of wave crests

  // Convert normalized points to SVG coordinates
  function toSVG(pt: [number, number], clipX?: number): [number, number] {
    const x = pt[0] * vw
    const y = topPad + pt[1] * waveH
    return [clipX !== undefined ? Math.min(x, clipX) : x, y]
  }

  // Build a smooth cubic-bezier path through the wave points
  function smoothPath(points: [number, number][]): string {
    if (points.length < 2) return ''
    const [sx, sy] = points[0]
    let d = `M ${sx} ${sy}`

    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i]
      const [x1, y1] = points[i + 1]
      // Horizontal tension: 40% of segment width
      const cpx = (x1 - x0) * 0.4
      d += ` C ${x0 + cpx} ${y0}, ${x1 - cpx} ${y1}, ${x1} ${y1}`
    }

    return d
  }

  // Full wave points in SVG coords
  const allPts = WAVE_POINTS.map(p => toSVG(p))

  // Clip points at ratio boundary for filled portion
  const clipX = ratio * vw
  const filledPts = allPts.filter(([x]) => x <= clipX + 0.5)
  // Add interpolated end point at exact clip position
  if (ratio > 0 && ratio < 1 && filledPts.length > 0) {
    const lastIdx = allPts.findIndex(([x]) => x > clipX)
    if (lastIdx > 0) {
      const [x0, y0] = allPts[lastIdx - 1]
      const [x1, y1] = allPts[lastIdx]
      const t = (clipX - x0) / (x1 - x0)
      const interpY = y0 + (y1 - y0) * t
      filledPts.push([clipX, interpY])
    }
  }

  // Build paths
  const bgLine = smoothPath(allPts)
  const bgPath = `${bgLine} L ${vw} ${height} L 0 ${height} Z`

  let fillPath = ''
  let dotPos: [number, number] | null = null
  if (filledPts.length >= 2) {
    const fillLine = smoothPath(filledPts)
    const endX = filledPts[filledPts.length - 1][0]
    fillPath = `${fillLine} L ${endX} ${height} L 0 ${height} Z`
    dotPos = filledPts[filledPts.length - 1]
  }

  return (
    <div className={`relative w-full ${className}`} style={{ height: showHalo ? height + 16 : height }}>
      {/* Ambient halo */}
      {showHalo && ratio > 0 && (
        <div
          className="absolute rounded-2xl transition-all duration-700 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at ${Math.max(15, ratio * 85)}% 60%, ${colors.halo} 0%, transparent 65%)`,
            filter: 'blur(10px)',
            top: -8,
            bottom: -8,
            left: -8,
            right: -8,
          }}
        />
      )}

      <div className="relative" style={{ height }}>
        <svg
          viewBox={`0 0 ${vw} ${height}`}
          preserveAspectRatio="none"
          className="w-full h-full"
          style={{ overflow: 'visible' }}
          aria-hidden="true"
          role="presentation"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colors.gradientStart} />
              <stop offset="100%" stopColor={colors.gradientEnd} />
            </linearGradient>
            {/* Vertical fade for filled area */}
            <linearGradient id={haloId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.gradientStart} stopOpacity="0.9" />
              <stop offset="100%" stopColor={colors.gradientEnd} stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {/* Background wave (unfilled) */}
          <path d={bgPath} fill={colors.bg} />

          {/* Filled wave */}
          {fillPath && (
            <path d={fillPath} fill={`url(#${haloId})`} className="transition-all duration-500" />
          )}
        </svg>

        {/* Position dot */}
        {showDot && dotPos && ratio > 0 && ratio < 1 && (
          <div
            className="absolute w-3.5 h-3.5 rounded-full bg-white shadow-md transition-all duration-500"
            style={{
              left: `${(dotPos[0] / vw) * 100}%`,
              top: `${dotPos[1] - 7}px`,
              transform: 'translateX(-50%)',
              border: `2.5px solid ${colors.dotBorder}`,
            }}
          />
        )}

        {/* Completion dot */}
        {showDot && ratio >= 1 && (
          <div
            className="absolute w-3.5 h-3.5 rounded-full shadow-md"
            style={{
              right: -2,
              top: `${allPts[allPts.length - 1][1] - 7}px`,
              border: `2.5px solid white`,
              backgroundColor: colors.gradientStart,
            }}
          />
        )}
      </div>
    </div>
  )
}
