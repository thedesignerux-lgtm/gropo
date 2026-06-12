'use client'

import { useState, useEffect } from 'react'

function getTimeUntilNextSundayMadrid(): { days: number; hours: number } {
  const now = new Date()

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now)

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }

  const weekday = parts.find(p => p.type === 'weekday')!.value
  const hour = parseInt(parts.find(p => p.type === 'hour')!.value)
  const minute = parseInt(parts.find(p => p.type === 'minute')!.value)

  const dayOfWeek = weekdayMap[weekday] ?? 0
  const minutesPerDay = 24 * 60
  const targetMinutesInWeek = 22 * 60 // Sunday 22:00 = day 0, hour 22
  const currentMinutesInWeek = dayOfWeek * minutesPerDay + hour * 60 + minute

  const remainingMinutes =
    currentMinutesInWeek < targetMinutesInWeek
      ? targetMinutesInWeek - currentMinutesInWeek
      : 7 * minutesPerDay - currentMinutesInWeek + targetMinutesInWeek

  return {
    days: Math.floor(remainingMinutes / (24 * 60)),
    hours: Math.floor((remainingMinutes % (24 * 60)) / 60),
  }
}

export default function CountdownChip() {
  const [time, setTime] = useState<{ days: number; hours: number } | null>(null)

  useEffect(() => {
    setTime(getTimeUntilNextSundayMadrid())
    const id = setInterval(() => setTime(getTimeUntilNextSundayMadrid()), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-1.5 bg-orange-100 text-orange-600 rounded-full px-3 py-1.5 text-xs font-semibold">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span>
        Cierra dom 22:00&nbsp;·&nbsp;
        {time ? `${time.days}d ${time.hours}h` : '···'}
      </span>
    </div>
  )
}
