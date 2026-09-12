// src/components/PulseAcceptModal.tsx — GROPO PULSE (G5)
// Modal "Aceptar este precio": datos de envío + tarjeta (SetupIntent, 0 € hoy).
// La retención SOLO ocurre cuando la masa crítica se alcanza (motor G2).
// Renderizado via portal (las tarjetas viven dentro de <Link>).
'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { PROVINCIAS_ES } from '@/lib/provincias'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'

interface Props {
  groupId: string
  productName: string
  tierPrice: number
  quantity: number
  onClose: () => void
}

interface FormData {
  name: string; email: string; phone: string
  line1: string; line2: string; city: string; province: string; postal_code: string
}

export default function PulseAcceptModal({ groupId, productName, tierPrice, quantity, onClose }: Props) {
  const [form, setForm] = useState<FormData>({
    name: '', email: '', phone: '', line1: '', line2: '', city: '', province: '', postal_code: '',
  })
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Prefill desde la identidad local (la misma que usa Mis Grupos)
    try {
      const u = JSON.parse(localStorage.getItem('vonda_user') ?? '{}')
      setForm((f) => ({ ...f, name: u.name ?? '', email: u.email ?? '', phone: u.phone ?? '' }))
    } catch { /* sin prefill */ }
  }, [])

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const formOk = form.name && form.email && form.phone && form.line1 && form.city && form.province && form.postal_code

  async function startCard() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/pulse/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo iniciar')
      setClientSecret(json.clientSecret)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Aceptar este precio">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-neutral-900">Aceptar este precio</h2>
            <p className="text-[13px] text-neutral-500 mt-0.5">{productName}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-400 hover:bg-neutral-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* La promesa central del Pulse, sin letra pequeña */}
        <div className="mt-4 rounded-xl px-4 py-3 text-[13.5px] leading-snug" style={{ background: '#F6F3FE', color: '#013230' }}>
          <b>Hoy no se retiene nada (0 €).</b> Solo si el grupo alcanza los <b>{fmt(tierPrice)}</b>,
          retendremos <b>{fmt(tierPrice * quantity)}</b>{quantity > 1 ? ` (${quantity} uds)` : ''} y tu plaza quedará asegurada.
          Si el grupo no llega, no pagas nada.
        </div>

        {!clientSecret ? (
          <>
            <div className="grid grid-cols-1 gap-2.5 mt-4">
              <input className="pulse-inp" placeholder="Nombre y apellidos" value={form.name} onChange={set('name')} />
              <div className="grid grid-cols-2 gap-2.5">
                <input className="pulse-inp" placeholder="Email" type="email" value={form.email} onChange={set('email')} />
                <input className="pulse-inp" placeholder="Teléfono" type="tel" value={form.phone} onChange={set('phone')} />
              </div>
              <input className="pulse-inp" placeholder="Dirección (calle y número)" value={form.line1} onChange={set('line1')} />
              <input className="pulse-inp" placeholder="Piso, puerta (opcional)" value={form.line2} onChange={set('line2')} />
              <div className="grid grid-cols-2 gap-2.5">
                <input className="pulse-inp" placeholder="Ciudad" value={form.city} onChange={set('city')} />
                <input className="pulse-inp" placeholder="Código postal" value={form.postal_code} onChange={set('postal_code')} />
              </div>
              <select className="pulse-inp" value={form.province} onChange={set('province')}>
                <option value="">Provincia…</option>
                {PROVINCIAS_ES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {error && <p className="text-[13px] text-red-600 mt-3">{error}</p>}
            <button
              disabled={!formOk || loading}
              onClick={startCard}
              className="w-full mt-4 rounded-xl py-3.5 text-sm font-bold text-white disabled:opacity-40"
              style={{ background: '#024947' }}
            >
              {loading ? 'Un momento…' : 'Continuar con la tarjeta'}
            </button>
          </>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret, locale: 'es' }}>
            <CardStep groupId={groupId} form={form} tierPrice={tierPrice} quantity={quantity} onClose={onClose} />
          </Elements>
        )}

        <style jsx global>{`
          .pulse-inp {
            width: 100%; border: 1px solid #e5e5e5; border-radius: 12px;
            padding: 11px 14px; font-size: 14px; color: #171717; background: #fff;
          }
          .pulse-inp:focus { outline: none; border-color: #024947; }
        `}</style>
      </div>
    </div>,
    document.body,
  )
}

function CardStep({ groupId, form, tierPrice, quantity, onClose }: {
  groupId: string; form: FormData; tierPrice: number; quantity: number; onClose: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    if (!stripe || !elements) return
    setSaving(true); setError(null)
    try {
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      })
      if (confirmError || !setupIntent || setupIntent.status !== 'succeeded') {
        throw new Error(confirmError?.message ?? 'No se pudo guardar la tarjeta')
      }
      const res = await fetch('/api/pulse/accept/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: groupId,
          setup_intent_id: setupIntent.id,
          name: form.name,
          email: form.email,
          phone: form.phone,
          shipping: {
            name: form.name, phone: form.phone,
            line1: form.line1, line2: form.line2 || null,
            city: form.city, province: form.province,
            postal_code: form.postal_code, country: 'ES',
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo completar')
      setDone(true)
      setTimeout(() => { onClose(); router.refresh() }, 2200)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="mt-5 text-center py-6">
        <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center" style={{ background: '#F0F7F7' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#024947" strokeWidth="3"><path d="M5 12l5 5 9-11" /></svg>
        </div>
        <p className="text-[15px] font-bold text-neutral-900 mt-3">Compromiso activado</p>
        <p className="text-[13px] text-neutral-500 mt-1">
          Cuando el grupo alcance {fmt(tierPrice)} retendremos {fmt(tierPrice * quantity)} y tu plaza quedará asegurada.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <PaymentElement />
      {error && <p className="text-[13px] text-red-600 mt-3">{error}</p>}
      <button
        disabled={!stripe || saving}
        onClick={submit}
        className="w-full mt-4 rounded-xl py-3.5 text-sm font-bold text-white disabled:opacity-40"
        style={{ background: '#024947' }}
      >
        {saving ? 'Guardando…' : 'Activar mi compromiso (0 € hoy)'}
      </button>
      <p className="text-[11.5px] text-neutral-400 text-center mt-2.5">
        Tarjeta guardada de forma segura por Stripe. Sin cargos hasta que el grupo llegue a tu precio.
      </p>
    </div>
  )
}
