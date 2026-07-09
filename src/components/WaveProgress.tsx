'use client'

import { useId } from 'react'

type WaveColorScheme = 'brand' | 'orange' | 'green'

const COLOR_MAP: Record<WaveColorScheme, {
  gradientStart: string
  gradientEnd: string
  bg: string
  halo: string
  dot: string
}> = {
  brand: {
    gradientStart: '#6C3CE1',
    gradientEnd: '#8B63E8',
    bg: '#F0EEFF',
    halo: 'rgba(108, 60, 225, 0.12)',
    dot: 'border-brand',
  },
  orange: {
    gradientStart: '#E8590C',
    gradientEnd: '#FF8C42',
    bg: '#FFF4ED',
    halo: 'rgba(232, 89, 12, 0.12)',
    dot: 'border-orange-500',
  },
  green: {
    gradientStart: '#0D9F6E',
    gradientEnd: '#31C48D',
    bg: '#ECFDF5',
    halo: 'rgba(13, 159, 110, 0.12)',
    dot: 'border-green-500',
  },
}

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
 * Displays a wavy/onda shape filled proportionally to current/max.
 * Supports color schemes for different contexts and optional ambient halo.
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
  const colors = COLOR_MAP[colorScheme]
  const ratio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0

  // Wave parameters
  const waves = 6
  const amplitude = height * 0.18
  const midY = height * 0.45

  function wavePath(startX: number, endX: number, viewWidth: number): string {
    const points: string[] = []
    const steps = 80
    const rangeX = endX - startX

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = startX + t * rangeX
      const y = midY + Math.sin(t * waves * Math.PI * 2) * amplitude
      points.push(`${i === 0 ? 'M' : 'L'} ${(x / viewWidth) * 100} ${y}`)
    }

    points.push(`L ${(endX / viewWidth) * 100} ${height}`)
    points.push(`L ${(startX / viewWidth) * 100} ${height}`)
    points.push('Z')

    return points.join(' ')
  }

  const viewWidth = 200
  const fillEnd = viewWidth * ratio
  const dotY = midY + Math.sin(ratio * waves * Math.PI * 2) * amplitude

  return (
    <div className={`relative w-full ${className}`} style={{ height: showHalo ? height + 16 : height }}>
      {/* Ambient halo */}
      {showHalo && ratio > 0 && (
        <div
          className="absolute inset-0 rounded-2xl transition-all duration-700"
          style={{
            background: `radial-gradient(ellipse at ${Math.max(10, ratio * 100)}% 50%, ${colors.halo} 0%, transparent 70%)`,
            filter: 'blur(8px)',
            top: -8,
            bottom: -8,
            left: -4,
            right: -4,
          }}
        />
      )}

      <div className="relative" style={{ height }}>
        <svg
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          className="w-full h-full"
          style={{ overflow: 'visible' }}
        >
          {/* Background wave */}
          <path
            d={wavePath(0, viewWidth, viewWidth)}
            fill={colors.bg}
            className="transition-all duration-500"
          />

          {/* Filled wave */}
          {ratio > 0 && (
            <path
              d={wavePath(0, fillEnd, viewWidth)}
              fill={`url(#${gradientId})`}
              className="transition-all duration-500"
            />
          )}

          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colors.gradientStart} />
              <stop offset="100%" stopColor={colors.gradientEnd} />
            </linearGradient>
          </defs>
        </svg>

        {/* Position dot */}
        {showDot && ratio > 0 && ratio < 1 && (
          <div
            className={`absolute w-3 h-3 rounded-full bg-white border-2 ${colors.dot} shadow-sm transition-all duration-500`}
            style={{
              left: `${ratio * 100}%`,
              top: `${dotY - 6}px`,
              transform: 'translateX(-50%)',
            }}
          />
        )}

        {/* Completion dot */}
        {showDot && ratio >= 1 && (
          <div
            className="absolute w-3 h-3 rounded-full bg-white border-2 shadow-sm"
            style={{
              right: 0,
              top: `${midY + Math.sin(waves * Math.PI * 2) * amplitude - 6}px`,
              borderColor: colors.gradientStart,
              backgroundColor: colors.gradientStart,
            }}
          />
        )}
      </div>
    </div>
  )
}
