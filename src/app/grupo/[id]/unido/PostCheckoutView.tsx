'use client'

// src/app/grupo/[id]/unido/PostCheckoutView.tsx
// Pantalla post-checkout: celebración → resumen → precio live → compartir → cuenta opcional.
// Patrón "Compra primero → cuenta después" (MasterClass / Gymshark / Depop).

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import AuthPanel from '@/components/AuthPanel'
import { readLocalIdentity } from '@/lib/local-identity'

export type PostCheckoutGroup = {
  id: string
  product_name: string
  product_spec: string
  image_url: string | null
  current_price: number
  total_units: number
  closes_at: string
  pvp: number
  next_price: number
}

const eur = (n: number) =>
  (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'

// ── Checkmark animado ──
function AnimatedCheck() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 border-2 border-green-500">
      <svg
        width="28" height="28" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        className="text-green-500 animate-[check_0.4s_ease-out_0.2s_both]"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  )
}

// ── Precio en directo con pulsing dot ──
function LivePrice({
  price,
  memberCount,
  nextPrice,
  nextUnits,
}: {
  price: number
  memberCount: number
  nextPrice: number | null
  nextUnits: number | null
}) {
  const missing = nextUnits != null ? Math.max(0, nextUnits - memberCount) : 0

  return (
    <div className="rounded-2xl bg-brand/5 border border-brand/15 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-widest text-brand">
          Precio en directo
        </span>
      </div>
      {/* Price */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-[28px] font-extrabold tracking-tight text-brand tabular-nums">
          {eur(price)}
        </span>
        <span className="text-sm font-semibold text-brand/70">/ud</span>
      </div>
      {/* Meta */}
      <p className="mt-1 text-[13px] text-neutral-600">
        <strong className="font-bold text-neutral-900">{memberCount} persona{memberCount !== 1 ? 's' : ''}</strong> en el grupo
      </p>
      {missing > 0 && nextPrice != null && (
        <p className="mt-0.5 text-[13px] text-neutral-600">
          Faltan <strong className="font-bold text-brand">{missing} más</strong> para bajar a {eur(nextPrice)}
        </p>
      )}
      {/* Badge */}
      <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[11.5px] font-bold text-green-700">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
        Puede bajar hasta el domingo
      </span>
    </div>
  )
}

// ── Botón WhatsApp ──
function WhatsAppButton({
  productName, price, pvp, nextPrice, groupId,
}: {
  productName: string; price: number; pvp: number; nextPrice: number; groupId: string
}) {
  function handleShare() {
    const url = `${window.location.origin}/grupo/${groupId}`
    const savings = pvp - price
    const text = savings > 0.5
      ? `🚴 ${productName} a ${eur(price)} (PVP ${eur(pvp)}). Cuantos más seamos, más baja. Únete y baja el precio para todos: ${url}`
      : `🚴 ${productName} a ${eur(price)}. Cuantos más seamos, más baja. Únete: ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#25D366] py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#1ebe5a] active:scale-[0.98]"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.374 0 0 5.373 0 12c0 2.117.555 4.103 1.523 5.826L.057 23.985a.5.5 0 0 0 .558.642l6.46-1.695A11.956 11.956 0 0 0 12 24c6.626 0 12-5.373 12-12S18.626 0 12 0zm0 21.818a9.806 9.806 0 0 1-5.064-1.41l-.364-.214-3.755.985.997-3.648-.235-.374A9.817 9.817 0 0 1 2.182 12c0-5.424 4.394-9.818 9.818-9.818s9.818 4.394 9.818 9.818-4.394 9.818-9.818 9.818z" />
      </svg>
      Compartir por WhatsApp
    </button>
  )
}

// ── Copiar enlace ──
function CopyLinkButton({ groupId }: { groupId: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `${window.location.origin}/grupo/${groupId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white py-3 text-[13.5px] font-semibold text-neutral-600 transition-colors hover:bg-neutral-50 active:scale-[0.98]"
    >
      {copied ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Enlace copiado
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          Copiar enlace del grupo
        </>
      )}
    </button>
  )
}

// ══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════
export default function PostCheckoutView({ group }: { group: PostCheckoutGroup }) {
  // ── Estado ──
  const [memberEmail, setMemberEmail] = useState('')
  const [memberName, setMemberName] = useState('')
  const [memberQty, setMemberQty] = useState(1)
  const [memberPrice, setMemberPrice] = useState<number | null>(null)
  const [memberAddress, setMemberAddress] = useState('')
  const [livePrice, setLivePrice] = useState(group.current_price)
  const [liveUnits, setLiveUnits] = useState(group.total_units)
  const [nextPrice, setNextPrice] = useState<number | null>(group.next_price)
  const [isAuthed, setIsAuthed] = useState(false)

  // ── Leer datos del miembro desde localStorage ──
  useEffect(() => {
    // `readLocalIdentity` no lanza y devuelve {} si no hay nada, así que los
    // valores por defecto ('' , 1, null) se mantienen solos.
    const u = readLocalIdentity()
    setMemberEmail(u.email ?? '')
    setMemberName(u.name ?? '')
    if (u.quantity) setMemberQty(Number(u.quantity))
    if (u.price) setMemberPrice(Number(u.price))
    if (u.address_line1) setMemberAddress(u.address_line1)
  }, [])

  // ── Comprobar si ya tiene sesión ──
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setIsAuthed(true)
    })
  }, [])

  // ── Fetch live data (price + units) ──
  const refreshData = useCallback(async () => {
    try {
      const res = await fetch(`/api/group/${group.id}/quote?units=0`)
      const data = await res.json()
      if (data.pricePerUnit != null) setLivePrice(Number(data.pricePerUnit))
      if (data.nextPrice != null) setNextPrice(Number(data.nextPrice))
    } catch {}

    try {
      const res = await fetch(`/api/group/${group.id}/summary`)
      const data = await res.json()
      if (data.firmUnits != null || data.reserveUnits != null) {
        setLiveUnits((data.firmUnits ?? 0) + (data.reserveUnits ?? 0))
      }
    } catch {}
  }, [group.id])

  // ── Supabase Realtime: suscripción a cambios del grupo ──
  useEffect(() => {
    const supabase = createClient()

    // Refresh on mount
    refreshData()

    // Subscribe to realtime changes on group_members for this group
    const channel = supabase
      .channel(`post-checkout-${group.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_members',
          filter: `group_id=eq.${group.id}`,
        },
        () => { refreshData() }
      )
      .subscribe()

    // Also poll every 30s as fallback
    const interval = setInterval(refreshData, 30_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [group.id, refreshData])

  // ── Siguiente tramo ──
  const [nextTierUnits, setNextTierUnits] = useState<number | null>(null)
  useEffect(() => {
    fetch(`/api/group/${group.id}/tier-demand`)
      .then(r => r.json())
      .then(data => {
        const tiers = Array.isArray(data?.tiers) ? data.tiers : Array.isArray(data) ? data : []
        if (!tiers.length) return
        const sorted = tiers
          .map((t: any) => ({ minUnits: Number(t.min_units ?? t.minUnits), price: Number(t.price) }))
          .sort((a: any, b: any) => a.minUnits - b.minUnits)
        for (const t of sorted) {
          if (t.minUnits > liveUnits) {
            setNextTierUnits(t.minUnits)
            return
          }
        }
        setNextTierUnits(null)
      })
      .catch(() => {})
  }, [group.id, liveUnits])

  const displayPrice = livePrice
  const savings = group.pvp - displayPrice

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-lg bg-white min-h-screen pb-8 lg:pb-16">

        {/* ── BLOQUE 1: Celebración ── */}
        <section className="px-5 pt-10 pb-1">
          <AnimatedCheck />
          <h1 className="mt-4 text-[22px] font-extrabold tracking-tight text-neutral-900">
            ¡Plaza asegurada!
          </h1>
          <p className="mt-1.5 text-[15px] text-neutral-600">
            Tu reserva en <strong className="font-semibold text-neutral-900">{group.product_name}</strong> está confirmada.
          </p>
          {memberEmail && (
            <p className="mt-1.5 text-[13px] text-neutral-400">
              Recibirás los detalles en <strong className="font-medium text-neutral-600">{memberEmail}</strong>
            </p>
          )}
        </section>

        {/* ── BLOQUE 2: Precio en directo ── */}
        <section className="px-5 pt-5">
          <LivePrice
            price={displayPrice}
            memberCount={liveUnits}
            nextPrice={nextPrice}
            nextUnits={nextTierUnits}
          />
        </section>

        {/* ── BLOQUE 3: Resumen de reserva ── */}
        <section className="px-5 pt-4">
          <div className="rounded-2xl border border-neutral-100 bg-white p-4">
            <div className="flex gap-3.5">
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                {group.image_url ? (
                  <img
                    src={group.image_url}
                    alt={group.product_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-neutral-300">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="4" />
                      <line x1="12" y1="2" x2="12" y2="8" />
                      <line x1="12" y1="16" x2="12" y2="22" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-bold text-neutral-900 leading-tight">{group.product_name}</h2>
                {group.product_spec && (
                  <p className="text-[12.5px] text-neutral-400 mt-0.5">{group.product_spec}</p>
                )}
                <p className="mt-1 text-[14px] font-bold text-brand">
                  {memberQty} {memberQty === 1 ? 'ud' : 'uds'} × {eur(memberPrice ?? displayPrice)}
                </p>
              </div>
            </div>

            <div className="mt-3 border-t border-neutral-100 pt-3 space-y-2">
              {memberAddress && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-neutral-400">Envío</span>
                  <span className="font-medium text-neutral-700 text-right max-w-[60%]">{memberAddress}</span>
                </div>
              )}
              <div className="flex justify-between text-[13px]">
                <span className="text-neutral-400">Cierre del grupo</span>
                <span className="font-medium text-neutral-700">Domingo, 22:00</span>
              </div>
              {(group.pvp - (memberPrice ?? displayPrice)) > 0.5 && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-neutral-400">Ahorro vs PVP</span>
                  <span className="font-bold text-green-600">{eur(group.pvp - (memberPrice ?? displayPrice))}/ud</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── BLOQUE 4: Compartir ── */}
        <section className="px-5 pt-5">
          <div className="rounded-2xl border border-neutral-100 bg-white p-5">
            <h3 className="text-[17px] font-extrabold tracking-tight text-neutral-900">
              Comparte y que baje más
            </h3>
            <p className="mt-1 text-[13.5px] text-neutral-500 leading-snug">
              Cada persona que se une hace bajar el precio para todos — incluido tú.
            </p>
            <div className="mt-4 space-y-2.5">
              <WhatsAppButton
                productName={group.product_name}
                price={displayPrice}
                pvp={group.pvp}
                nextPrice={nextPrice ?? displayPrice}
                groupId={group.id}
              />
              <CopyLinkButton groupId={group.id} />
            </div>
          </div>
        </section>

        {/* ── BLOQUE 5: Cuenta opcional ── */}
        {!isAuthed && (
          <section className="px-5 pt-5">
            <div className="rounded-2xl border border-neutral-100 bg-white p-5">
              <AuthPanel
                title="Sigue cómo baja el precio"
                subtitle="Crea tu cuenta gratis para ver el precio en tiempo real, gestionar tus reservas y recibir alertas."
                ctaLabel="Enviar enlace mágico"
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                }
                next={`/grupo/${group.id}`}
                sentNote="Haz clic en el enlace del email para activar tu cuenta. Tu reserva no se ve afectada."
                initialEmail={memberEmail}
              />
              <p className="mt-3 text-center text-[11.5px] text-neutral-400 leading-relaxed">
                Sin compromiso. Solo para seguir tu reserva y ver el precio en tiempo real.
              </p>
            </div>
          </section>
        )}

        {/* Si ya está autenticado */}
        {isAuthed && (
          <section className="px-5 pt-5">
            <div className="flex items-center gap-3 rounded-2xl bg-green-50 border border-green-100 p-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 flex-shrink-0">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p className="text-[13.5px] text-green-800">
                <strong className="font-bold">Cuenta activa</strong> — puedes seguir tu reserva desde tu perfil.
              </p>
            </div>
          </section>
        )}

        {/* ── BLOQUE 6: Volver ── */}
        <section className="px-5 pt-6 pb-4">
          <Link
            href={`/grupo/${group.id}`}
            className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white py-3.5 text-[14px] font-semibold text-brand transition-colors hover:bg-brand/5 active:scale-[0.98]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Volver al gropo
          </Link>
        </section>

      </div>

      {/* CSS para la animación del check */}
      <style>{`
        @keyframes check {
          from { stroke-dashoffset: 24; opacity: 0 }
          to { stroke-dashoffset: 0; opacity: 1 }
        }
      `}</style>
    </div>
  )
}
