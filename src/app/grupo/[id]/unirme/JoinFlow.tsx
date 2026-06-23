'use client';

// src/app/grupo/[id]/unirme/JoinFlow.tsx
// Checkout "Unirme a la vonda". Modelo de PROYECCIÓN: el precio del resumen, el
// banner, el subtotal y el botón reaccionan a [unidades actuales] + [qty]. El
// precio por unidad proyectado sale del quote (compute_price en el servidor); los
// tramos solo se usan client-side para el display del siguiente umbral (la curva
// de precios es pública). La mecánica bancaria NO se expone: el front es ciego al
// importe retenido — solo ve el precio de producto.

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import confetti from 'canvas-confetti';
import { PROVINCIAS_ES } from '@/lib/provincias';
import GroupCountdown from '@/components/GroupCountdown';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type Tier = { minUnits: number; price: number };

export type JoinGroup = {
  id: string;
  product_name: string;
  product_spec: string;
  pvp: number;
  current_price: number; // precio de la vonda con las unidades actuales (fallback hasta el quote)
  image_url?: string | null;
  total_units: number;
  closes_at: string;
  max_stock: number;
  min_execution: number;
  tiers: Tier[];
};

// 72,00 € — coma decimal y € al final
const eur = (n: number) => n.toFixed(2).replace('.', ',') + ' €';

function fireConfetti() {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  confetti({
    particleCount: 90,
    spread: 75,
    origin: { y: 0.75 },
    colors: ['#6C3CE1', '#8B63E8', '#F3F0FF'],
  });
}

const SECTION = 'px-4 pt-6';
const H = 'text-sm font-semibold text-neutral-900 mb-3';
const INPUT =
  'w-full h-12 px-3.5 rounded-xl border border-neutral-200 bg-white text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand';

export default function JoinFlow({
  group,
  joinMode = 'comprar',
  targetPrice,
}: {
  group: JoinGroup
  joinMode?: 'comprar' | 'esperar'
  targetPrice?: number
}) {
  // Tope: 10 por comprador y nunca más del stock restante de la puja ganadora.
  const remaining = group.max_stock > 0 ? Math.max(1, group.max_stock - group.total_units) : 10;
  const maxQty = Math.min(10, remaining);

  const [quantity, setQuantity] = useState(1); // por defecto 1, NUNCA 0
  const [quote, setQuote] = useState<{ pricePerUnit: number | null }>({
    pricePerUnit: group.current_price,
  });
  const prevPrice = useRef<number | null>(null);

  // Quote en vivo: precio por unidad proyectado a (total_units + qty).
  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/group/${group.id}/quote?units=${quantity}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => {
        const p = d.pricePerUnit != null ? Number(d.pricePerUnit) : null;
        // Confeti SOLO al bajar de tramo (cruce a la baja), una vez por cruce.
        if (prevPrice.current != null && p != null && p < prevPrice.current) fireConfetti();
        if (p != null) prevPrice.current = p;
        setQuote({ pricePerUnit: p });
      })
      .catch(() => {});
    return () => ac.abort();
  }, [group.id, quantity]);

  // Tramos ordenados (curva de precios pública). Se usan para el target del
  // modo esperar y para el cálculo del siguiente umbral.
  const sorted = useMemo(() => [...group.tiers].sort((a, b) => a.minUnits - b.minUnits), [group.tiers]);

  // ── PROYECCIÓN (reactiva a total_units + qty) ──
  const isEsperar = joinMode === 'esperar'
  const pricePerUnit = quote.pricePerUnit ?? group.current_price;
  const efectiveTargetPrice = targetPrice ?? (sorted.length > 0 ? sorted[sorted.length - 1].price : pricePerUnit)
  const total = pricePerUnit * quantity;
  // En modo esperar, el importe mostrado y retenido es el target × qty
  // (lo que el comprador acepta pagar como máximo), no el proyectado actual.
  const displayPricePerUnit = isEsperar ? efectiveTargetPrice : pricePerUnit;
  const displayTotal = displayPricePerUnit * quantity;
  const savingsPerUnit = Math.max(0, group.pvp - pricePerUnit);
  const nextTier = useMemo(() => {
    let curIdx = 0;
    for (let i = 0; i < sorted.length; i++) if (sorted[i].minUnits <= group.total_units) curIdx = i;
    return curIdx < sorted.length - 1 ? sorted[curIdx + 1] : null;
  }, [sorted, group.total_units]);

  const projected = group.total_units + quantity;
  const unlocks = !!nextTier && projected >= nextTier.minUnits; // Estado A
  const missing = nextTier ? Math.max(0, nextTier.minUnits - projected) : 0; // Estado B

  // Stripe Elements: importe = total de producto proyectado (= el cargo real,
  // que el servidor recalcula idéntico). El front no maneja ningún "hold".
  const amountCents = useMemo(
    () => Math.max(50, Math.round(displayPricePerUnit * quantity * 100)),
    [displayPricePerUnit, quantity],
  );
  const elementsOptions = useMemo(
    () => ({
      mode: 'payment' as const,
      amount: amountCents,
      currency: 'eur',
      capture_method: 'manual' as const,
      paymentMethodTypes: ['card'],
      appearance: { theme: 'stripe' as const, variables: { colorPrimary: '#6C3CE1' } },
    }),
    [amountCents],
  );

  // Barra de estado por unidades: progreso REAL de la vonda hacia el próximo tramo.
  const barTarget = nextTier ? nextTier.minUnits : Math.max(group.total_units, 1);
  const barFrac = barTarget > 0 ? Math.min(1, group.total_units / barTarget) : 1;

  return (
    <div>
      {/* ── MODO ESPERAR BANNER ── */}
      {isEsperar && (
        <section className="px-4 pt-4">
          <div className="rounded-2xl bg-brand/5 border border-brand/20 p-4">
            <div className="flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-neutral-900">Compra automática a {eur(efectiveTargetPrice)}</p>
                <p className="text-xs text-neutral-500 mt-1">
                  Tu pago se reservará ahora al precio actual ({eur(pricePerUnit)}). Si la vonda alcanza {eur(efectiveTargetPrice)} antes del cierre, se confirma automáticamente al precio más bajo. Si no se alcanza, puedes quedarte al precio actual o cancelar sin cargo.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── RESUMEN DE PRODUCTO (precio proyectado, reactivo) ── */}
      <section className="flex gap-3.5 px-4 pt-4">
        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-[#F5F5F5]">
          {group.image_url ? (
            <img src={group.image_url} alt={group.product_name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-300">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-neutral-900">{group.product_name}</h1>
          {group.product_spec && <p className="truncate text-sm text-neutral-400">{group.product_spec}</p>}
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold text-brand">{eur(displayPricePerUnit)}</span>
            <span className="text-xs text-neutral-400">/ud</span>
            {group.pvp > pricePerUnit && (
              <span className="text-sm text-neutral-400 line-through">{eur(group.pvp)}</span>
            )}
          </div>
          <p className="text-[11px] text-neutral-400">El precio en la vonda</p>
        </div>
      </section>

      {/* ── BARRA DE ESTADO POR UNIDADES ── */}
      <section className="px-4 pt-4">
        <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-900">
              {group.total_units} {group.total_units === 1 ? 'unidad confirmada' : 'unidades confirmadas'}
            </span>
            <span className="flex flex-col items-end leading-tight">
              <GroupCountdown closesAt={group.closes_at} minimal />
            </span>
          </div>
          <div className="h-[6px] w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${barFrac * 100}%`, transition: 'width 300ms ease' }}
            />
          </div>
        </div>
      </section>

      {/* ── 1. SELECTOR DE CANTIDAD ── */}
      <section className={SECTION}>
        <h2 className={H}>1. ¿Cuántas unidades quieres?</h2>

        <div className="flex items-center justify-between">
          <div className="inline-flex items-center rounded-xl border border-neutral-200">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Quitar una unidad"
              className="flex h-11 w-11 items-center justify-center text-xl text-neutral-700 disabled:text-neutral-300"
            >
              −
            </button>
            <span className="w-10 text-center text-base font-semibold tabular-nums text-neutral-900">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              disabled={quantity >= maxQty}
              aria-label="Añadir una unidad"
              className="flex h-11 w-11 items-center justify-center text-xl text-neutral-700 disabled:text-neutral-300"
            >
              +
            </button>
          </div>
          <span className="text-xs text-neutral-400">Máx. {maxQty} por persona</span>
        </div>

        {/* ── BANNER A/B ── */}
        {unlocks ? (
          // Estado A — DESBLOQUEA
          <p className="mt-3 rounded-xl bg-brand/10 px-3 py-2.5 text-sm font-semibold text-brand">
            🎉 ¡Desbloqueado! Tu compra baja el precio a {eur(pricePerUnit)}/ud.
          </p>
        ) : nextTier ? (
          // Estado B — NO desbloquea
          <p className="mt-3 rounded-xl bg-neutral-50 px-3 py-2.5 text-sm font-medium text-neutral-600">
            {missing} {missing === 1 ? 'unidad más' : 'unidades más'} para {eur(nextTier.price)}/ud.
          </p>
        ) : null}

        {/* ── SUBTOTAL (etiqueta A/B) ── */}
        <div className="mt-3 rounded-2xl border border-neutral-100 bg-white p-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-neutral-500">
              {unlocks ? `Subtotal (${quantity} uds)` : 'Total actual'}
            </span>
            <span className="text-lg font-bold text-neutral-900">{eur(displayTotal)}</span>
          </div>
          {savingsPerUnit > 0 && (
            <div className="mt-1 text-right text-xs font-semibold text-brand">
              Ahorras {eur(savingsPerUnit * quantity)} frente a tienda
            </div>
          )}
        </div>
      </section>

      {/* ── 2-4 + FOOTER (dentro de Elements) ── */}
      <Elements stripe={stripePromise} options={elementsOptions}>
        <InnerForm
          group={group}
          quantity={quantity}
          total={displayTotal}
          showAdjust={!unlocks}
          joinMode={isEsperar ? 'esperar' : 'comprar'}
          targetPrice={isEsperar ? efectiveTargetPrice : undefined}
        />
      </Elements>
    </div>
  );
}

function InnerForm({
  group,
  quantity,
  total,
  showAdjust,
  joinMode = 'comprar',
  targetPrice,
}: {
  group: JoinGroup;
  quantity: number;
  total: number;
  showAdjust: boolean;
  joinMode?: 'comprar' | 'esperar';
  targetPrice?: number;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const [c, setC] = useState({ nombre: '', apellidos: '', email: '', phone: '' });
  const [s, setS] = useState({ line1: '', postal_code: '', city: '', province: '' });
  const [billingSame, setBillingSame] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!stripe || !elements) return;

    setLoading(true);
    const fullName = `${c.nombre} ${c.apellidos}`.trim();

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? 'Revisa los datos de la tarjeta');
      setLoading(false);
      return;
    }

    let clientSecret: string;
    try {
      const res = await fetch('/api/join/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: group.id,
          quantity,
          name: fullName,
          email: c.email,
          phone: c.phone,
          join_mode: joinMode,
          target_price: targetPrice ?? null,
          shipping: {
            name: fullName,
            phone: c.phone,
            line1: s.line1,
            city: s.city,
            province: s.province,
            postal_code: s.postal_code,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo completar la compra');
        setLoading(false);
        return;
      }
      clientSecret = data.clientSecret;
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.');
      setLoading(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/grupo/${group.id}/unido`,
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message ?? 'No se pudo verificar el pago');
      setLoading(false);
      return;
    }

    window.location.href = `/grupo/${group.id}/unido`;
  }

  return (
    <>
      {/* ── 2. TUS DATOS ── */}
      <section className={SECTION}>
        <h2 className={H}>2. Tus datos</h2>
        <div className="grid grid-cols-2 gap-3">
          <input className={INPUT} placeholder="Nombre"
            value={c.nombre} onChange={(e) => setC({ ...c, nombre: e.target.value })} />
          <input className={INPUT} placeholder="Apellidos"
            value={c.apellidos} onChange={(e) => setC({ ...c, apellidos: e.target.value })} />
        </div>
        <input className={`${INPUT} mt-3`} type="email" placeholder="Email"
          value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} />
        <div className="mt-3 flex items-stretch gap-2">
          <span className="inline-flex items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[15px] text-neutral-500">
            +34
          </span>
          <input className={`${INPUT} flex-1`} inputMode="numeric" placeholder="Teléfono móvil"
            value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} />
        </div>
      </section>

      {/* ── 3. DIRECCIÓN DE ENVÍO ── */}
      <section className={SECTION}>
        <h2 className={H}>3. Dirección de envío</h2>
        <input className={INPUT} placeholder="Dirección (calle y número)"
          value={s.line1} onChange={(e) => setS({ ...s, line1: e.target.value })} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <input className={INPUT} inputMode="numeric" placeholder="Código postal"
            value={s.postal_code} onChange={(e) => setS({ ...s, postal_code: e.target.value })} />
          <input className={INPUT} placeholder="Ciudad"
            value={s.city} onChange={(e) => setS({ ...s, city: e.target.value })} />
        </div>
        <select
          className={`${INPUT} mt-3 ${s.province ? 'text-neutral-900' : 'text-neutral-400'}`}
          value={s.province} onChange={(e) => setS({ ...s, province: e.target.value })}
        >
          <option value="">Provincia</option>
          {PROVINCIAS_ES.map((p) => (
            <option key={p} value={p} className="text-neutral-900">{p}</option>
          ))}
        </select>
        <label className="mt-3 flex items-center gap-2 text-sm text-neutral-600">
          <input type="checkbox"
            className="h-4 w-4 rounded border-neutral-300 text-brand focus:ring-brand"
            checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} />
          Esta es también mi dirección de facturación
        </label>
      </section>

      {/* ── 4. PAGO SEGURO ── */}
      <section className={SECTION}>
        <h2 className={H}>4. Pago seguro</h2>
        <div className="rounded-2xl border border-neutral-100 p-3.5">
          <PaymentElement options={{ layout: 'tabs' }} />
        </div>
        <p className="mt-3 rounded-xl bg-neutral-50 px-3 py-2.5 text-xs leading-relaxed text-neutral-500">
          Tu pago está protegido con 3D Secure: lo verificarás en el siguiente paso si tu banco lo pide.
        </p>
      </section>

      {error && (
        <p role="alert" className="mx-4 mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {/* ── FOOTER FIJO: solo precio de producto ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-100 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !stripe}
            className="h-12 w-full rounded-xl bg-brand text-[15px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            {loading
              ? 'Procesando…'
              : joinMode === 'esperar'
                ? `Reservar plaza · ${eur(total)}`
                : `Pagar ${eur(total)}`
            }
          </button>
          {showAdjust && joinMode !== 'esperar' && (
            <p className="mt-2 text-center text-xs text-neutral-500">
              Pagas el precio actual. Se ajustará a la baja si la vonda crece.
            </p>
          )}
          {joinMode === 'esperar' && (
            <p className="mt-2 text-center text-xs text-neutral-500">
              Solo pagas si la vonda baja a tu precio objetivo. Si no, se libera sin cargo.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
