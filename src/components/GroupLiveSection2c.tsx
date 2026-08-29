'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTierDemand } from '@/hooks/useTierDemand'
import { usePulse } from '@/hooks/usePulse'
import { useCheckout } from '@/components/checkout/CheckoutProvider'
import GropoTargetSlider, { type Detent } from '@/components/GropoTargetSlider'
import { createClient } from '@/lib/supabase-browser'

function fmt(n: number | undefined | null): string {
  if (n === undefined || n === null) return '—'
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

interface Tier { minUnits: number; price: number }

interface Props {
  groupId: string
  name: string
  spec: string
  pvp: number
  initialBestPrice: number
  initialNextPrice: number
  initialTotalUnits: number
  bidCount: number
  tiers: Tier[]
  maxStock: number
  minExecution: number
  closesAt: string
}

export default function GroupLiveSection2c({
  groupId, name, spec, pvp,
  initialBestPrice, initialNextPrice, initialTotalUnits,
  tiers, closesAt,
}: Props) {
  const { open } = useCheckout()
  const router = useRouter()
  const [authed, setAuthed] = useState<boolean | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setAuthed(!!user))
  }, [])

  const { tiers: demandTiers, currentPrice, nextTier, missing } = useTierDemand(groupId)
  const { data: pulseData } = usePulse(nextTier ? groupId : null)
  const displayPrice = currentPrice > 0 ? currentPrice : initialBestPrice

  // Next price from real-time or initial
  const nextPriceDisplay = nextTier?.price ?? (initialNextPrice > 0 && initialNextPrice < displayPrice ? initialNextPrice : null)

  const savings = pvp > 0 ? pvp - displayPrice : 0

  // ── Detents del target slider
  const detents: Detent[] = useMemo(
    () => [...tiers].sort((a, b) => a.minUnits - b.minUnits).map(t => ({ price: t.price, uds: t.minUnits })),
    [tiers]
  )
  const curIdx = useMemo(() => {
    let idx = 0
    for (let i = 0; i < detents.length; i++) if (detents[i].price >= displayPrice) idx = i
    return idx
  }, [detents, displayPrice])

  const [selIdx, setSelIdx] = useState(curIdx)
  const touchedRef = useRef(false)
  useEffect(() => { if (!touchedRef.current) setSelIdx(curIdx) }, [curIdx])
  useEffect(() => { if (selIdx > detents.length - 1) setSelIdx(curIdx) }, [detents.length, selIdx, curIdx])
  const handleSelIdx = (i: number) => { touchedRef.current = true; setSelIdx(i) }

  const effectiveSelected = detents[selIdx]?.price ?? displayPrice
  const confirmed = selIdx <= curIdx
  const isEsperar = !confirmed
  const accent = confirmed ? '#6C4BF4' : '#E8944A'

  const handleCheckout = () => {
    if (isEsperar) {
      const p = new URLSearchParams({ mode: 'esperar', target: String(effectiveSelected) })
      router.push(`/grupo/${groupId}/unirme?${p.toString()}`)
    } else if (authed) {
      open({ groupId, productName: name, productSpec: spec, imageUrl: null, quantity: 1, maxPricePerUnit: effectiveSelected })
    } else {
      router.push(`/grupo/${groupId}/unirme?target=${effectiveSelected}`)
    }
  }

  return (
    <div className="flex flex-col flex-1" style={{ padding: '14px 18px 0' }}>
      {/* Price row: "Precio del grupo" left + "Siguiente" right */}
      <div className="flex items-end justify-between">
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase' as const, color: '#8A8794' }}>Precio del grupo</div>
          <div className="flex items-baseline gap-2" style={{ marginTop: 3 }}>
            <span className="tabular-nums" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{fmt(displayPrice)}</span>
            {pvp > 0 && <span style={{ fontSize: 13, color: '#9a97a2', textDecoration: 'line-through' }}>{fmt(pvp)}</span>}
          </div>
        </div>
        {nextPriceDisplay != null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase' as const, color: '#8A8794' }}>Siguiente</div>
            <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, marginTop: 3, color: '#6C4BF4' }}>{fmt(nextPriceDisplay)}</div>
          </div>
        )}
      </div>

      {/* Target slider with PMA bubble */}
      {detents.length > 1 && (
        <div style={{ marginTop: 6 }}>
          <GropoTargetSlider
            detents={detents}
            curIdx={curIdx}
            selIdx={selIdx}
            onSelIdx={handleSelIdx}
            size="mini"
            chrome="nudge"
            udsToNext={missing}
            pulse={pulseData?.steps}
            glow={pulseData?.glow}
          />
        </div>
      )}

      {/* Bottom: Máx. + CTA — pushed to bottom with margin-top:auto */}
      <div className="flex items-center gap-2.5" style={{ marginTop: 'auto', padding: '12px 0 12px' }}>
        <div style={{ flex: '0 0 auto' }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.3px', textTransform: 'uppercase' as const, color: '#8A8794' }}>Máx.</div>
          <div className="tabular-nums" style={{ fontSize: 19, fontWeight: 800, lineHeight: 1, marginTop: 2, color: accent }}>{fmt(effectiveSelected)}</div>
        </div>
        <button
          type="button"
          onClick={handleCheckout}
          className="flex-1 active:scale-[0.98] transition-all whitespace-nowrap"
          style={{
            border: `2px solid ${accent}`,
            background: `${accent}14`,
            color: accent,
            fontWeight: 800,
            fontSize: 14,
            borderRadius: 14,
            padding: '14px 8px',
            cursor: 'pointer',
            boxShadow: `0 12px 26px -14px ${confirmed ? 'rgba(108,75,244,.28)' : 'rgba(232,148,74,.28)'}`,
          }}
        >
          {isEsperar ? `Reservar plaza · Máx. ${fmt(effectiveSelected)}` : `Bloquear precio · Máx. ${fmt(effectiveSelected)}`}
        </button>
      </div>
    </div>
  )
}
