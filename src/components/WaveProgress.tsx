'use client'

import { useId } from 'react'

interface Props {
  /** Current units */
  current: number
  /** Maximum units (stock) */
  max: number
  /** Height in pixels */
  height?: number
  /** Show the position dot */
  showDot?: boolean
  /** Additional className */
  className?: string
}

/**
 * WaveProgress — Vonda brand identity progress bar.
 * Displays a wavy/onda shape filled proportionally to current/max.
 * Filled = brand purple, unfilled = neutral gray.
 */
export default function WaveProgress({
  current,
  max,
  height = 32,
  showDot = true,
  className = '',
}: Props) {
  const gradientId = useId()
  const ratio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0
  const width = 100 // percentage-based, scales with container

  // Wave parameters
  const waves = 6 // number of wave peaks
  const amplitude = height * 0.18 // wave height
  const midY = height * 0.45 // vertical center of wave

  // Generate wave path
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

    // Close the shape: go down, across bottom, back up
    points.push(`L ${(endX / viewWidth) * 100} ${height}`)
    points.push(`L ${(startX / viewWidth) * 100} ${height}`)
    points.push('Z')

    return points.join(' ')
  }

  const viewWidth = 200 // internal SVG coordinate space
  const fillEnd = viewWidth * ratio
  const dotX = ratio * 100 // percentage for dot position
  const dotY = midY + Math.sin(ratio * waves * Math.PI * 2) * amplitude

  return (
    <div className={`relative w-full ${className}`} style={{ height }}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        style={{ overflow: 'visible' }}
      >
        {/* Background wave (unfilled) */}
        <path
          d={wavePath(0, viewWidth, viewWidth)}
          fill="#F0EEFF"
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

        {/* Gradient definition */}
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6C3CE1" />
            <stop offset="100%" stopColor="#8B63E8" />
          </linearGradient>
        </defs>
      </svg>

      {/* Position dot */}
      {showDot && ratio > 0 && ratio < 1 && (
        <div
          className="absolute w-3 h-3 rounded-full bg-white border-2 border-brand shadow-sm transition-all duration-500"
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
          className="absolute w-3 h-3 rounded-full bg-brand border-2 border-white shadow-sm"
          style={{
            right: 0,
            top: `${midY + Math.sin(waves * Math.PI * 2) * amplitude - 6}px`,
          }}
        />
      )}
    </div>
  )
}
