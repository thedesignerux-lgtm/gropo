'use client';

// src/app/grupo/[id]/unirme/JoinFlow.tsx
// Checkout "Unirme al gropo". Modelo de PROYECCIÓN: el precio del resumen, el
// banner, el subtotal y el botón reaccionan a [unidades actuales] + [qty]. El
// precio por unidad proyectado sale del quote (compute_price en el servidor); los
// tramos solo se usan client-side para el display del siguiente umbral (la curva
// de precios es pública). La mecánica bancaria NO se expone: el front es ciego al
// importe retenido — solo ve el precio de producto.
//
// Presentación alineada con el diseño de ficha (cabecera producto, cantidad,
// tarjeta de ahorro potencial, progreso "X ciclistas", tarjetas de confianza,
// logos de pago y acordeón). La LÓGICA de precio/cantidad/dirección/Stripe/holds
// es la misma de siempre; aquí solo cambia el marcado.

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
import { normalizePhone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';
import HowGropoSheet from '@/components/HowGropoSheet';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type Tier = { minUnits: number; price: number };

export type JoinGroup = {
  id: string;
  product_name: string;
  product_spec: string;
  pvp: number;
  current_price: number; // precio del gropo con las unidades actuales (fallback hasta el quote)
  image_url?: string | null;
  total_units: number;
  closes_at: string;
  max_stock: number;
  min_execution: number;
  tiers: Tier[];
};

// 549 € · 62,50 € — sin decimales si es entero, coma decimal y € al final
const eur = (n: number) =>
  (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')) + ' €';

/* Ventana de urgencia: solo se muestra cuenta atrás si el cierre está cerca.
   Un contador de "155d" mata el FOMO e invita a procrastinar, así que por
   encima de este umbral se enseña solo el día de cierre. */
const URGENCY_WINDOW_DAYS = 14;

/* Countdown compacto del checkout: "2d 14h" en morado (rojo el último día).
   No usa GroupCountdown(minimal) porque ese ya imprime su propio "Cierra en". */
function CompactCountdown({ closesAt }: { closesAt: string }) {
  const [state, setState] = useState<{ label: string; urgent: boolean; near: boolean } | null>(null);
  useEffect(() => {
    const calc = () => {
      const diff = new Date(closesAt).getTime() - Date.now();
      if (diff <= 0) return { label: 'Cerrado', urgent: false, near: true };
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      if (d > URGENCY_WINDOW_DAYS) return { label: 'Próximo domingo', urgent: false, near: false };
      return { label: d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`, urgent: d < 1, near: true };
    };
    setState(calc());
    const id = setInterval(() => setState(calc()), 60_000);
    return () => clearInterval(id);
  }, [closesAt]);

  if (!state) return <span className="text-lg font-extrabold text-neutral-300">—</span>;
  return (
    <span
      className={`tabular-nums ${state.near ? 'text-lg font-extrabold' : 'text-[13px] font-bold'}`}
      style={{ color: state.urgent ? '#D6452B' : state.near ? '#6C4BF4' : '#6B6B76' }}
    >
      {state.label}
    </span>
  );
}

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
  initialQuantity = 1,
}: {
  group: JoinGroup
  joinMode?: 'comprar' | 'esperar'
  targetPrice?: number
  initialQuantity?: number
}) {
  // Tope: 10 por comprador y nunca más del stock restante de la puja ganadora.
  const remaining = group.max_stock > 0 ? Math.max(1, group.max_stock - group.total_units) : 10;
  const maxQty = Math.min(10, remaining);

  const [quantity, setQuantity] = useState(initialQuantity); // viene de la ficha via ?qty=N
  const [quote, setQuote] = useState<{ pricePerUnit: number | null }>({
    pricePerUnit: group.current_price,
  });
  const prevPrice = useRef<number | null>(null);


  const sorted = useMemo(() => [...group.tiers].sort((a, b) => a.minUnits - b.minUnits), [group.tiers]);
  const isEsperar = joinMode === 'esperar';
  const pricePerUnit = quote.pricePerUnit ?? group.current_price;
  const efectiveTargetPrice = targetPrice ?? (sorted.length > 0 ? sorted[sorted.length - 1].price : pricePerUnit);

  // ¿El target del esperador ya se alcanza con su entrada?
  const targetReached = isEsperar && pricePerUnit <= efectiveTargetPrice;
  // Modo visual: si el target ya se alcanza, colapsar a "comprar"
  const visualMode = isEsperar && !targetReached ? 'esperar' : 'comprar';

  // Quote en vivo: precio por unidad proyectado a (total_units + qty).
  useEffect(() => {
    const ac = new AbortController();
    fetch(
      `/api/group/${group.id}/quote?units=${quantity}${isEsperar ? `&target=${efectiveTargetPrice}` : ''}`,
      { signal: ac.signal },
    )
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
  }, [group.id, quantity, isEsperar, efectiveTargetPrice]);

  // ── PROYECCIÓN (reactiva a total_units + qty) ──
  const total = pricePerUnit * quantity;
  // Si esperar pero target ya alcanzado → mostrar R (precio real), no T
  const displayPricePerUnit = (isEsperar && !targetReached) ? efectiveTargetPrice : pricePerUnit;
  const displayTotal = displayPricePerUnit * quantity;
  const savingsPerUnit = Math.max(0, group.pvp - displayPricePerUnit);
  const nextTier = useMemo(() => {
    let curIdx = 0;
    for (let i = 0; i < sorted.length; i++) if (sorted[i].minUnits <= group.total_units) curIdx = i;
    return curIdx < sorted.length - 1 ? sorted[curIdx + 1] : null;
  }, [sorted, group.total_units]);

  const projected = group.total_units + quantity;
  const unlocks = !!nextTier && projected >= nextTier.minUnits; // Estado A


  // Hold para Stripe: siempre target × qty para esperadores (techo de seguridad)
  const holdPricePerUnit = isEsperar ? efectiveTargetPrice : pricePerUnit;
  const amountCents = useMemo(
    () => Math.max(50, Math.round(holdPricePerUnit * quantity * 100)),
    [holdPricePerUnit, quantity],
  );
  const elementsOptions = useMemo(
    () => ({
      mode: 'payment' as const,
      amount: amountCents,
      currency: 'eur',
      capture_method: 'manual' as const,
      // Debe COINCIDIR con la PaymentIntent del servidor (create-intent), o Stripe
      // rechaza la confirmación en modo diferido con "setup_future_usage mismatch".
      setup_future_usage: 'on_session' as const,
      paymentMethodTypes: ['card'],
      appearance: { theme: 'stripe' as const, variables: { colorPrimary: '#6C3CE1' } },
    }),
    [amountCents],
  );

  const [payInfoOpen, setPayInfoOpen] = useState(false);

  // ── Stepper de tramos (diseño 4b): estados y relleno de la barra ──
  // La barra refleja las unidades PROYECTADAS (grupo + las que elige el usuario),
  // en coherencia con el precio, que también es proyectado.
  const nTiers = sorted.length;
  const lastUnlockedIdx = (() => { let idx = -1; for (let i = 0; i < sorted.length; i++) if (group.total_units >= sorted[i].minUnits) idx = i; return idx; })();
  const projIdx = (() => { let idx = -1; for (let i = 0; i < sorted.length; i++) if (projected >= sorted[i].minUnits) idx = i; return idx; })();
  const comprarGoalIdx = projIdx + 1 < nTiers ? projIdx + 1 : -1;
  const targetTier = sorted.find((t) => Math.abs(t.price - efectiveTargetPrice) < 0.01) ?? sorted[sorted.length - 1];
  const missingToTarget = targetTier ? Math.max(0, targetTier.minUnits - projected) : 0;
  // Posición CONTINUA en la barra: interpola entre tramos según las unidades,
  // así el relleno avanza porcentualmente al acercarse al siguiente tramo.
  const posOf = (units: number) => {
    if (nTiers <= 1) return 0;
    if (units >= sorted[nTiers - 1].minUnits) return 1;
    let lo = 0;
    for (let i = 0; i < nTiers; i++) if (units >= sorted[i].minUnits) lo = i;
    const a = sorted[lo].minUnits, b = sorted[lo + 1].minUnits;
    const seg = b > a ? Math.min(1, Math.max(0, (units - a) / (b - a))) : 0;
    return (lo + seg) / (nTiers - 1);
  };
  const groupPos = posOf(group.total_units);
  const projPos = posOf(projected);
  // El punto (knob) solo se muestra mientras avanza ENTRE hitos; al llegar
  // justo a un tramo, ese nodo pasa a check y el punto desaparece.
  const showKnob = projIdx < nTiers - 1 && projected > sorted[projIdx].minUnits;

  return (
    <div>
      {/* ── MODO ESPERAR / TARGET REACHED BANNER (money-critical display) ── */}
      {visualMode === 'esperar' ? (
        <>
          {/* ═══ Diseño 4b (modo esperar) — datos en vivo, lógica intacta ═══ */}

          {/* Tarjeta de producto: foto + nombre + PVP · cantidad + badges */}
          <section className="px-4 pt-4">
            <div className="rounded-[18px] border border-black/[0.08] bg-white p-[15px]">
              <div className="flex gap-[15px]">
                <div className="h-24 w-24 flex-none overflow-hidden rounded-[15px] bg-[#F4F2F8]">
                  {group.image_url ? (
                    <img src={group.image_url} alt={group.product_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-neutral-300">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="text-[15px] font-bold leading-[1.3] text-neutral-900">{group.product_name}</div>
                  {group.pvp > 0 && (
                    <div className="mt-auto pt-2 text-xs font-medium text-neutral-400">Precio tienda <span className="line-through">{eur(group.pvp)}</span></div>
                  )}
                </div>
              </div>
              <div className="mt-[13px] flex items-center gap-2">
                <div className="flex h-[34px] items-center gap-2.5 rounded-[11px] border border-black/[0.08] bg-[#F5F3F9] px-1.5">
                  <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Quitar una unidad" className="grid h-6 w-6 place-items-center text-[17px] leading-none text-neutral-600 disabled:text-neutral-300">−</button>
                  <span className="min-w-[22px] text-center text-[15px] font-bold tabular-nums text-neutral-900">{quantity}</span>
                  <button type="button" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty} aria-label="Añadir una unidad" className="grid h-6 w-6 place-items-center text-[17px] leading-none text-neutral-600 disabled:text-neutral-300">+</button>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F3F9] px-2.5 py-1.5 text-xs font-semibold text-neutral-500">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6C3CE1" strokeWidth="2"><rect x="1" y="6" width="14" height="10" rx="1.5" /><path d="M15 9h4l3 3v4h-7" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>
                  Entrega gratis
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#E6F5EC] px-2.5 py-1.5 text-xs font-bold text-[#0F8A4D]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  En stock
                </span>
              </div>
            </div>
          </section>

          {/* Filas de precio: precio actual del grupo (neutro) + tu precio objetivo (resaltado) */}
          <section className="px-4 pt-3.5">
            <div className="rounded-[18px] border border-black/[0.08] bg-white p-1.5">
              <div className="flex items-center px-3 py-[11px]">
                <div className="text-xs font-semibold text-neutral-500">Precio actual del grupo</div>
                <div className="ml-auto text-[22px] font-extrabold leading-none tracking-tight tabular-nums text-neutral-900">{eur(pricePerUnit)}</div>
              </div>
              <div className="flex items-center rounded-[14px] border-[1.5px] px-3.5 py-3" style={{ background: '#F4F0FE', borderColor: '#6C3CE1' }}>
                <div className="mr-[11px] grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px]" style={{ background: '#6C3CE1' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></svg>
                </div>
                <div>
                  <div className="text-[15px] font-bold text-brand">Tu precio objetivo</div>
                  <div className="mt-px text-xs font-medium" style={{ color: '#8A72D6' }}>al que compras si el grupo lo alcanza</div>
                </div>
                <div className="ml-auto text-[22px] font-extrabold leading-none tracking-tight tabular-nums text-brand">{eur(efectiveTargetPrice)}</div>
              </div>
            </div>
          </section>

          {/* Progreso del grupo — stepper horizontal con checks (diseño 4b) */}
          <section className="px-4 pt-3.5">
            <div className="rounded-[18px] border border-black/[0.08] bg-white p-[15px]">
              <div className="flex items-center">
                <div className="flex-1 text-[15px] font-extrabold text-neutral-900">Progreso del grupo</div>
                <div className="flex items-center gap-1 text-xs font-semibold text-neutral-500">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6C3CE1" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" /></svg>
                  <span>Cierra en</span> <CompactCountdown closesAt={group.closes_at} />
                </div>
              </div>
              <div className="relative mx-1 mb-2 mt-6">
                <div className="absolute left-[6%] right-[6%] top-[9px] h-[3px] rounded-full bg-black/[0.07]" />
                <div className="absolute left-[6%] top-[9px] h-[3px] rounded-full bg-brand transition-[width] duration-300 ease-out" style={{ width: `calc(88% * ${projPos})` }} />
                <div className="absolute left-[6%] top-[9px] h-[3px] rounded-full bg-brand transition-[width] duration-300 ease-out" style={{ width: `calc(88% * ${groupPos})` }} />
                {showKnob && (
                  <div className="absolute top-[6px] z-[1] h-[9px] w-[9px] -translate-x-1/2 rounded-full bg-brand ring-2 ring-white shadow-sm transition-[left] duration-300 ease-out" style={{ left: `calc(6% + 88% * ${projPos})` }} />
                )}
                <div className="relative flex justify-between">
                  {sorted.map((t, i) => {
                    const groupReached = group.total_units >= t.minUnits;
                    const youReached = projected >= t.minUnits;
                    const isTarget = Math.abs(t.price - efectiveTargetPrice) < 0.01;
                    return (
                      <div key={i} className="flex w-14 flex-col items-center">
                        {groupReached ? (
                          <div className="grid h-5 w-5 place-items-center rounded-full border-[3px] border-[#faf9fc] bg-brand" style={{ boxShadow: '0 0 0 1.5px #6C3CE1' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                          </div>
                        ) : youReached ? (
                          <div className="grid h-5 w-5 place-items-center rounded-full border-[3px] border-[#faf9fc]" style={{ background: '#6C3CE1', boxShadow: '0 0 0 1.5px #6C3CE1' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                          </div>
                        ) : isTarget ? (
                          <div className="grid h-[22px] w-[22px] animate-pulse place-items-center rounded-full border-[3px] border-[#e8890c] bg-white">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#e8890c" strokeWidth="2.6"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                          </div>
                        ) : (
                          <div className="mt-0.5 h-4 w-4 rounded-full border-[2.5px] border-black/[0.18] bg-white" />
                        )}
                        <div className={`mt-2 text-[15px] font-extrabold ${isTarget && !youReached ? 'text-[#e8890c]' : groupReached ? 'text-neutral-900' : youReached ? 'text-brand' : 'text-neutral-400'}`}>{eur(t.price)}</div>
                        <div className="text-xs font-medium text-neutral-400">{t.minUnits} uds</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {missingToTarget > 0 ? (
                <div className="mt-1 text-center text-xs font-medium text-neutral-500">Faltan <b className="text-[#e8890c]">{missingToTarget} {missingToTarget === 1 ? 'unidad' : 'unidades'}</b> para llegar a tu objetivo</div>
              ) : (
                <div className="mt-1 text-center text-xs font-bold text-[#0F8A4D]">Tu precio objetivo ya está desbloqueado 🎉</div>
              )}
            </div>
          </section>

          {/* Banner verde: compra automática (money-critical: importe retenido) */}
          <section className="px-4 pt-3.5">
            <div className="flex gap-[11px] rounded-2xl border border-[#CFEADA] bg-[#EEF8F1] p-[13px]">
              <svg width="19" height="19" className="mt-px flex-none" viewBox="0 0 24 24" fill="none" stroke="#0F8A4D" strokeWidth="2"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" /><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <div className="text-xs font-semibold leading-[1.5] text-[#0D6B3D]">
                <b>Tu compra automática a {eur(efectiveTargetPrice)}.</b> Se retendrán {eur(efectiveTargetPrice * quantity)} ({eur(efectiveTargetPrice)}/ud × {quantity}). Si el grupo alcanza este precio antes del cierre, tu compra se confirma automáticamente. Si no, se libera sin cargo.{' '}
                <button type="button" onClick={() => setPayInfoOpen(true)} className="font-extrabold underline">Cómo funciona</button>
              </div>
            </div>
          </section>

          {/* Filas de confianza */}
          <section className="px-4 pt-3.5">
            <div className="flex flex-col gap-2.5">
              <div className="flex gap-3 rounded-2xl border border-black/[0.08] bg-white p-[13px]">
                <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-brand">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" /><path d="M9 12l2 2 4-4" /></svg>
                </div>
                <div>
                  <div className="text-[15px] font-bold text-neutral-900">Tu reserva garantiza el descuento</div>
                  <div className="mt-0.5 text-xs leading-[1.5] text-neutral-500">La marca solo concede este precio cuando existe suficiente demanda confirmada.</div>
                </div>
              </div>
              <div className="flex gap-3 rounded-2xl border border-black/[0.08] bg-white p-[13px]">
                <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-brand">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 16L3 6l5.5 4L12 4l3.5 6L21 6l-2 10z" /><path d="M5 20h14" /></svg>
                </div>
                <div>
                  <div className="text-[15px] font-bold text-neutral-900">Siempre pagas el mejor precio alcanzado</div>
                  <div className="mt-0.5 text-xs leading-[1.5] text-neutral-500">Si el grupo alcanza un precio más bajo, se aplicará automáticamente.</div>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : targetReached ? (
        <>
          {/* ═══ Diseño 5a · objetivo conseguido (esperador cuyo precio ya alcanzó el grupo) ═══ */}

          {/* Tarjeta de producto */}
          <section className="px-4 pt-4">
            <div className="rounded-[18px] border border-black/[0.08] bg-white p-[15px]">
              <div className="flex gap-[15px]">
                <div className="h-24 w-24 flex-none overflow-hidden rounded-[15px] bg-[#F4F2F8]">
                  {group.image_url ? (
                    <img src={group.image_url} alt={group.product_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-neutral-300">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="text-[15px] font-bold leading-[1.3] text-neutral-900">{group.product_name}</div>
                  {group.product_spec && <div className="mt-0.5 text-xs text-neutral-400">{group.product_spec}</div>}
                  {group.pvp > displayPricePerUnit && (
                    <div className="mt-auto pt-2 text-xs font-medium text-neutral-400">Precio tienda <span className="line-through">{eur(group.pvp)}</span></div>
                  )}
                </div>
              </div>
              <div className="mt-[13px] flex items-center gap-2">
                <div className="flex h-[34px] items-center gap-2.5 rounded-[11px] border border-black/[0.08] bg-[#F5F3F9] px-1.5">
                  <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Quitar una unidad" className="grid h-6 w-6 place-items-center text-[17px] leading-none text-neutral-600 disabled:text-neutral-300">−</button>
                  <span className="min-w-[22px] text-center text-[15px] font-bold tabular-nums text-neutral-900">{quantity}</span>
                  <button type="button" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty} aria-label="Añadir una unidad" className="grid h-6 w-6 place-items-center text-[17px] leading-none text-neutral-600 disabled:text-neutral-300">+</button>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F3F9] px-2.5 py-1.5 text-xs font-semibold text-neutral-500">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6C3CE1" strokeWidth="2"><rect x="1" y="6" width="14" height="10" rx="1.5" /><path d="M15 9h4l3 3v4h-7" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>
                  Entrega gratis
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#E6F5EC] px-2.5 py-1.5 text-xs font-bold text-[#0F8A4D]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  En stock
                </span>
              </div>
            </div>
          </section>

          {/* Tarjeta objetivo conseguido */}
          <section className="px-4 pt-3.5">
            <div className="flex items-center rounded-[18px] border-[1.5px] px-3.5 py-3.5" style={{ background: '#F4F0FE', borderColor: '#6C3CE1' }}>
              <div className="mr-[11px] grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px]" style={{ background: '#6C3CE1' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></svg>
              </div>
              <div>
                <div className="text-[15px] font-bold text-brand">¡Objetivo conseguido! Compras a {eur(displayPricePerUnit)}</div>
                <div className="mt-px text-xs font-medium" style={{ color: '#8A72D6' }}>al reservar, tu compra se confirma automáticamente</div>
              </div>
              <div className="ml-auto text-[22px] font-extrabold leading-none tracking-tight tabular-nums text-brand">{eur(displayPricePerUnit)}</div>
            </div>
          </section>

          {/* Progreso del grupo — con "tu precio" en el tramo conseguido */}
          <section className="px-4 pt-3.5">
            <div className="rounded-[18px] border border-black/[0.08] bg-white p-[15px]">
              <div className="flex items-center">
                <div className="flex-1 text-[15px] font-extrabold text-neutral-900">Progreso del grupo</div>
                <div className="flex items-center gap-1 text-xs font-semibold text-neutral-500">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6C3CE1" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" /></svg>
                  <span>Cierra en</span> <CompactCountdown closesAt={group.closes_at} />
                </div>
              </div>
              <div className="relative mx-1 mb-2 mt-6">
                <div className="absolute left-[6%] right-[6%] top-[9px] h-[3px] rounded-full bg-black/[0.07]" />
                <div className="absolute left-[6%] top-[9px] h-[3px] rounded-full bg-brand transition-[width] duration-300 ease-out" style={{ width: `calc(88% * ${projPos})` }} />
                <div className="absolute left-[6%] top-[9px] h-[3px] rounded-full bg-brand transition-[width] duration-300 ease-out" style={{ width: `calc(88% * ${groupPos})` }} />
                {showKnob && (
                  <div className="absolute top-[6px] z-[1] h-[9px] w-[9px] -translate-x-1/2 rounded-full bg-brand ring-2 ring-white shadow-sm transition-[left] duration-300 ease-out" style={{ left: `calc(6% + 88% * ${projPos})` }} />
                )}
                <div className="relative flex justify-between">
                  {sorted.map((t, i) => {
                    const groupReached = group.total_units >= t.minUnits;
                    const youReached = projected >= t.minUnits;
                    const isGoal = i === comprarGoalIdx;
                    const isMine = Math.abs(t.price - displayPricePerUnit) < 0.01;
                    return (
                      <div key={i} className="flex w-14 flex-col items-center">
                        {groupReached || youReached ? (
                          <div className="grid h-5 w-5 place-items-center rounded-full border-[3px] border-[#faf9fc] bg-brand" style={{ boxShadow: '0 0 0 1.5px #6C3CE1' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                          </div>
                        ) : isGoal ? (
                          <div className="grid h-[22px] w-[22px] animate-pulse place-items-center rounded-full border-[3px] border-[#e8890c] bg-white">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#e8890c" strokeWidth="2.6"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                          </div>
                        ) : (
                          <div className="mt-0.5 h-4 w-4 rounded-full border-[2.5px] border-black/[0.18] bg-white" />
                        )}
                        <div className={`mt-2 text-[15px] font-extrabold ${isGoal && !youReached ? 'text-[#e8890c]' : (groupReached || youReached) ? 'text-neutral-900' : 'text-neutral-400'}`}>{eur(t.price)}</div>
                        <div className="text-xs font-medium text-neutral-400">{t.minUnits} uds</div>
                        {isMine && <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">tu precio</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
              {comprarGoalIdx >= 0 ? (
                <div className="mt-1 text-center text-xs font-medium text-neutral-500">Faltan <b className="text-[#e8890c]">{sorted[comprarGoalIdx].minUnits - projected} {sorted[comprarGoalIdx].minUnits - projected === 1 ? 'unidad' : 'unidades'}</b> para bajar al siguiente tramo: {eur(sorted[comprarGoalIdx].price)}</div>
              ) : (
                <div className="mt-1 text-center text-xs font-bold text-[#0F8A4D]">Ya estás en el mejor precio 🎉</div>
              )}
            </div>
          </section>

          {/* Banner verde: compra confirmada al reservar (money-critical: cargo al cierre) */}
          <section className="px-4 pt-3.5">
            <div className="flex gap-[11px] rounded-2xl border border-[#CFEADA] bg-[#EEF8F1] p-[13px]">
              <svg width="19" height="19" className="mt-px flex-none" viewBox="0 0 24 24" fill="none" stroke="#0F8A4D" strokeWidth="2"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" /><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <div className="text-xs font-semibold leading-[1.5] text-[#0D6B3D]">
                <b>Compra confirmada al reservar.</b> El grupo ya alcanzó tu precio, así que tu compra a {eur(displayPricePerUnit)} queda asegurada. Se retiene el importe y el cargo se hace al cierre del grupo.{' '}
                <button type="button" onClick={() => setPayInfoOpen(true)} className="font-extrabold underline">Cómo funciona</button>
              </div>
            </div>
          </section>

          {/* Filas de confianza */}
          <section className="px-4 pt-3.5">
            <div className="flex flex-col gap-2.5">
              <div className="flex gap-3 rounded-2xl border border-black/[0.08] bg-white p-[13px]">
                <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-brand">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" /><path d="M9 12l2 2 4-4" /></svg>
                </div>
                <div>
                  <div className="text-[15px] font-bold text-neutral-900">Tu reserva garantiza el descuento</div>
                  <div className="mt-0.5 text-xs leading-[1.5] text-neutral-500">La marca solo concede este precio cuando existe suficiente demanda confirmada.</div>
                </div>
              </div>
              <div className="flex gap-3 rounded-2xl border border-black/[0.08] bg-white p-[13px]">
                <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-brand">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 16L3 6l5.5 4L12 4l3.5 6L21 6l-2 10z" /><path d="M5 20h14" /></svg>
                </div>
                <div>
                  <div className="text-[15px] font-bold text-neutral-900">Siempre pagas el mejor precio alcanzado</div>
                  <div className="mt-0.5 text-xs leading-[1.5] text-neutral-500">Si el grupo alcanza un precio más bajo, se aplicará automáticamente.</div>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <>

          {/* ═══ Diseño 4b adaptado a modo comprar (comprar ahora, sin precio objetivo) ═══ */}

          {/* Tarjeta de producto */}
          <section className="px-4 pt-4">
            <div className="rounded-[18px] border border-black/[0.08] bg-white p-[15px]">
              <div className="flex gap-[15px]">
                <div className="h-24 w-24 flex-none overflow-hidden rounded-[15px] bg-[#F4F2F8]">
                  {group.image_url ? (
                    <img src={group.image_url} alt={group.product_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-neutral-300">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="text-[15px] font-bold leading-[1.3] text-neutral-900">{group.product_name}</div>
                  {group.product_spec && <div className="mt-0.5 text-xs text-neutral-400">{group.product_spec}</div>}
                  {group.pvp > displayPricePerUnit && (
                    <div className="mt-auto pt-2 text-xs font-medium text-neutral-400">Precio tienda <span className="line-through">{eur(group.pvp)}</span></div>
                  )}
                </div>
              </div>
              <div className="mt-[13px] flex items-center gap-2">
                <div className="flex h-[34px] items-center gap-2.5 rounded-[11px] border border-black/[0.08] bg-[#F5F3F9] px-1.5">
                  <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Quitar una unidad" className="grid h-6 w-6 place-items-center text-[17px] leading-none text-neutral-600 disabled:text-neutral-300">−</button>
                  <span className="min-w-[22px] text-center text-[15px] font-bold tabular-nums text-neutral-900">{quantity}</span>
                  <button type="button" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty} aria-label="Añadir una unidad" className="grid h-6 w-6 place-items-center text-[17px] leading-none text-neutral-600 disabled:text-neutral-300">+</button>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F3F9] px-2.5 py-1.5 text-xs font-semibold text-neutral-500">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6C3CE1" strokeWidth="2"><rect x="1" y="6" width="14" height="10" rx="1.5" /><path d="M15 9h4l3 3v4h-7" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>
                  Entrega gratis
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#E6F5EC] px-2.5 py-1.5 text-xs font-bold text-[#0F8A4D]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  En stock
                </span>
              </div>
            </div>
          </section>

          {/* Tarjeta de precio: una sola fila resaltada (el precio que aseguras hoy) */}
          <section className="px-4 pt-3.5">
            <div className="flex items-center rounded-[18px] border-[1.5px] px-3.5 py-3.5" style={{ background: '#F4F0FE', borderColor: '#6C3CE1' }}>
              <div className="mr-[11px] grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px]" style={{ background: '#6C3CE1' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" /><path d="M9 12l2 2 4-4" /></svg>
              </div>
              <div>
                <div className="text-[15px] font-bold text-brand">Precio de tu plaza</div>
                <div className="mt-px text-xs font-medium" style={{ color: '#8A72D6' }}>bajará si entran más compradores</div>
              </div>
              <div className="ml-auto text-[22px] font-extrabold leading-none tracking-tight tabular-nums text-brand">{eur(displayPricePerUnit)}</div>
            </div>
            {savingsPerUnit > 0.01 && (
              <p className="mt-2 px-1 text-[12px] font-semibold text-[#0F8A4D]">Ahorras {eur(savingsPerUnit * quantity)} frente al precio de tienda</p>
            )}
          </section>

          {/* Progreso del grupo — stepper horizontal (objetivo = próximo tramo por desbloquear) */}
          <section className="px-4 pt-3.5">
            <div className="rounded-[18px] border border-black/[0.08] bg-white p-[15px]">
              <div className="flex items-center">
                <div className="flex-1 text-[15px] font-extrabold text-neutral-900">Progreso del grupo</div>
                <div className="flex items-center gap-1 text-xs font-semibold text-neutral-500">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6C3CE1" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" /></svg>
                  <span>Cierra en</span> <CompactCountdown closesAt={group.closes_at} />
                </div>
              </div>
              <div className="relative mx-1 mb-2 mt-6">
                <div className="absolute left-[6%] right-[6%] top-[9px] h-[3px] rounded-full bg-black/[0.07]" />
                <div className="absolute left-[6%] top-[9px] h-[3px] rounded-full bg-brand transition-[width] duration-300 ease-out" style={{ width: `calc(88% * ${projPos})` }} />
                <div className="absolute left-[6%] top-[9px] h-[3px] rounded-full bg-brand transition-[width] duration-300 ease-out" style={{ width: `calc(88% * ${groupPos})` }} />
                {showKnob && (
                  <div className="absolute top-[6px] z-[1] h-[9px] w-[9px] -translate-x-1/2 rounded-full bg-brand ring-2 ring-white shadow-sm transition-[left] duration-300 ease-out" style={{ left: `calc(6% + 88% * ${projPos})` }} />
                )}
                <div className="relative flex justify-between">
                  {sorted.map((t, i) => {
                    const groupReached = group.total_units >= t.minUnits;
                    const youReached = projected >= t.minUnits;
                    const isGoal = i === comprarGoalIdx;
                    return (
                      <div key={i} className="flex w-14 flex-col items-center">
                        {groupReached ? (
                          <div className="grid h-5 w-5 place-items-center rounded-full border-[3px] border-[#faf9fc] bg-brand" style={{ boxShadow: '0 0 0 1.5px #6C3CE1' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                          </div>
                        ) : youReached ? (
                          <div className="grid h-5 w-5 place-items-center rounded-full border-[3px] border-[#faf9fc]" style={{ background: '#6C3CE1', boxShadow: '0 0 0 1.5px #6C3CE1' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                          </div>
                        ) : isGoal ? (
                          <div className="grid h-[22px] w-[22px] animate-pulse place-items-center rounded-full border-[3px] border-[#e8890c] bg-white">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#e8890c" strokeWidth="2.6"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                          </div>
                        ) : (
                          <div className="mt-0.5 h-4 w-4 rounded-full border-[2.5px] border-black/[0.18] bg-white" />
                        )}
                        <div className={`mt-2 text-[15px] font-extrabold ${isGoal && !youReached ? 'text-[#e8890c]' : groupReached ? 'text-neutral-900' : youReached ? 'text-brand' : 'text-neutral-400'}`}>{eur(t.price)}</div>
                        <div className="text-xs font-medium text-neutral-400">{t.minUnits} uds</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {projIdx > lastUnlockedIdx ? (
                <div className="mt-1 text-center text-xs font-bold text-[#0F8A4D]">Tus {quantity} {quantity === 1 ? 'unidad desbloquea' : 'uds desbloquean'} {eur(sorted[projIdx].price)} 🎉</div>
              ) : comprarGoalIdx >= 0 ? (
                <div className="mt-1 text-center text-xs font-medium text-neutral-500">Faltan <b className="text-[#e8890c]">{sorted[comprarGoalIdx].minUnits - projected} {sorted[comprarGoalIdx].minUnits - projected === 1 ? 'unidad' : 'unidades'}</b> para desbloquear {eur(sorted[comprarGoalIdx].price)}</div>
              ) : (
                <div className="mt-1 text-center text-xs font-bold text-[#0F8A4D]">Mejor precio ya desbloqueado 🎉</div>
              )}
            </div>
          </section>

          {/* Banner verde: aseguras tu plaza hoy sin pagar */}
          <section className="px-4 pt-3.5">
            <div className="flex gap-[11px] rounded-2xl border border-[#CFEADA] bg-[#EEF8F1] p-[13px]">
              <svg width="19" height="19" className="mt-px flex-none" viewBox="0 0 24 24" fill="none" stroke="#0F8A4D" strokeWidth="2"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" /><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <div className="text-xs font-semibold leading-[1.5] text-[#0D6B3D]">
                <b>Aseguras tu plaza hoy sin pagar.</b> Retenemos el importe en tu tarjeta y solo se cobra al cierre del grupo, al mejor precio alcanzado. Si el grupo no se completa, se libera sin cargo.{' '}
                <button type="button" onClick={() => setPayInfoOpen(true)} className="font-extrabold underline">¿Cómo funciona el pago?</button>
              </div>
            </div>
          </section>

          {/* Filas de confianza */}
          <section className="px-4 pt-3.5">
            <div className="flex flex-col gap-2.5">
              <div className="flex gap-3 rounded-2xl border border-black/[0.08] bg-white p-[13px]">
                <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-brand">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" /><path d="M9 12l2 2 4-4" /></svg>
                </div>
                <div>
                  <div className="text-[15px] font-bold text-neutral-900">Tu reserva garantiza el descuento</div>
                  <div className="mt-0.5 text-xs leading-[1.5] text-neutral-500">La marca solo concede este precio cuando existe suficiente demanda confirmada.</div>
                </div>
              </div>
              <div className="flex gap-3 rounded-2xl border border-black/[0.08] bg-white p-[13px]">
                <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-brand">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 16L3 6l5.5 4L12 4l3.5 6L21 6l-2 10z" /><path d="M5 20h14" /></svg>
                </div>
                <div>
                  <div className="text-[15px] font-bold text-neutral-900">Siempre pagas el mejor precio alcanzado</div>
                  <div className="mt-0.5 text-xs leading-[1.5] text-neutral-500">Si el grupo alcanza un precio más bajo, se aplicará automáticamente.</div>
                </div>
              </div>
            </div>
          </section>

      </>
      )}

      {/* ── 2-4 + FOOTER (dentro de Elements) ── */}
      <Elements stripe={stripePromise} options={elementsOptions}>
        <InnerForm
          group={group}
          quantity={quantity}
          total={displayTotal}
          savings={savingsPerUnit * quantity}
          showAdjust={!unlocks && !targetReached}
          joinMode={isEsperar ? 'esperar' : 'comprar'}
          visualMode={visualMode}
          targetReached={targetReached}
          targetPrice={isEsperar ? efectiveTargetPrice : undefined}
          onOpenHow={() => setPayInfoOpen(true)}
        />
      </Elements>

      {/* ── Bottom sheet compartido con la home ── */}
      <HowGropoSheet open={payInfoOpen} onClose={() => setPayInfoOpen(false)} />
    </div>
  );
}

/* Logos de método de pago (sin assets externos, inline). */
function PayLogos() {
  const pill = 'flex h-7 items-center justify-center rounded-md border border-neutral-200 bg-white px-2.5';
  return (
    <div className="flex items-center justify-center gap-1.5">
      <div className={pill}><span className="text-[11.5px] font-extrabold italic tracking-tight text-[#1A1F71]">VISA</span></div>
      <div className={pill}>
        <svg width="26" height="16" viewBox="0 0 30 18" aria-label="Mastercard"><circle cx="12" cy="9" r="6" fill="#EB001B" /><circle cx="18" cy="9" r="6" fill="#F79E1B" fillOpacity="0.9" /></svg>
      </div>
      <div className={pill}>
        <span className="flex items-center gap-0.5 text-[11.5px] font-semibold text-neutral-900" aria-label="Apple Pay">
          <svg width="10" height="12" viewBox="0 0 14 17" fill="currentColor" aria-hidden="true"><path d="M11.2 9c0-1.6 1.3-2.4 1.4-2.4-.8-1.1-2-1.3-2.4-1.3-1-.1-2 .6-2.5.6s-1.3-.6-2.2-.6c-1.1 0-2.1.6-2.7 1.6-1.1 2-.3 4.9.8 6.5.5.8 1.2 1.7 2 1.6.8 0 1.1-.5 2.1-.5s1.2.5 2.1.5c.9 0 1.4-.8 2-1.6.6-.9.8-1.8.8-1.8s-1.5-.6-1.5-2.6zM9.6 3.5c.4-.5.7-1.3.6-2-.6 0-1.4.4-1.9 1-.4.5-.7 1.3-.6 2 .7.1 1.4-.4 1.9-1z" /></svg>
          Pay
        </span>
      </div>
      <div className={pill}>
        <span className="text-[11.5px] font-semibold text-neutral-900"><span style={{ color: '#4285F4' }}>G</span> Pay</span>
      </div>
    </div>
  );
}

/* Fila "¿Cómo funciona Gropo?" — abre el bottom sheet compartido. */
function HowGropoRow({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="px-4 pt-4">
      <button type="button" onClick={onOpen} className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3.5">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-brand/10 text-[10px] font-black text-brand">i</span>
          ¿Cómo funciona Gropo?
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9a97a2" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
    </section>
  );
}

function InnerForm({
  group,
  quantity,
  total,
  savings,
  showAdjust,
  joinMode = 'comprar',
  visualMode = 'comprar',
  targetReached = false,
  targetPrice,
  onOpenHow,
}: {
  group: JoinGroup;
  quantity: number;
  total: number;
  savings: number;
  showAdjust: boolean;
  joinMode?: 'comprar' | 'esperar';
  visualMode?: 'comprar' | 'esperar';
  targetReached?: boolean;
  targetPrice?: number;
  onOpenHow: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const [c, setC] = useState({ nombre: '', apellidos: '', email: '', phone: '' });
  const [s, setS] = useState({ line1: '', postal_code: '', city: '', province: '' });
  const [billingSame, setBillingSame] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const datosRef = useRef<HTMLElement>(null);
  // Precarga: si el usuario ya compró antes, no debe volver a teclear sus datos
  // ni su dirección. La identidad vive en localStorage (la guarda este mismo
  // checkout al confirmar) y la dirección predeterminada en el perfil.
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let u: { name?: string; email?: string; phone?: string } | null = null;
      try {
        const raw = localStorage.getItem('vonda_user');
        u = raw ? JSON.parse(raw) : null;
      } catch { u = null; }
      if (!u?.email && !u?.phone) return;

      const full = (u.name ?? '').trim();
      const sp = full.indexOf(' ');
      if (!cancelled) {
        setC((prev) => ({
          nombre: prev.nombre || (sp === -1 ? full : full.slice(0, sp)),
          apellidos: prev.apellidos || (sp === -1 ? '' : full.slice(sp + 1)),
          email: prev.email || (u?.email ?? ''),
          phone: prev.phone || (u?.phone ?? ''),
        }));
      }

      if (!u.email || !u.phone) return;
      try {
        const { data } = await supabase.rpc('get_profile', { p_phone: u.phone, p_email: u.email });
        const list = Array.isArray(data?.addresses) ? data.addresses : [];
        const def = list.find((a: { is_default?: boolean }) => a.is_default) ?? list[0];
        if (!def || cancelled) return;
        setS((prev) => {
          if (prev.line1) return prev; // no pisar lo que ya haya escrito
          return {
            line1: def.line1 ?? '',
            postal_code: def.postal_code ?? '',
            city: def.city ?? '',
            province: PROVINCIAS_ES.includes(def.province) ? def.province : '',
          };
        });
        setPrefilled(true);
      } catch { /* sin perfil: el formulario se queda vacío */ }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit() {
    setError(null);
    if (!stripe || !elements) return;

    // Validar campos obligatorios — si faltan, scroll al formulario
    const missing = !c.nombre.trim() || !c.apellidos.trim() || !c.email.trim() || !c.phone.trim() || !s.line1.trim() || !s.postal_code.trim() || !s.city.trim() || !s.province;
    if (missing) {
      datosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setError("Completa todos los campos antes de continuar.");
      return;
    }

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

    // Recordar identidad (teléfono + email) para la auto-carga de "Mis grupos".
    // Se guarda antes de confirmPayment para sobrevivir a redirecciones 3DS.
    try {
      localStorage.setItem('vonda_user', JSON.stringify({
        name: fullName,
        email: c.email.trim(),
        phone: normalizePhone(c.phone),
        quantity,
        price: Math.round((total / quantity) * 100) / 100,
        address_line1: s.line1,
      }));
    } catch {}

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
      {/* ── SUBTOTAL ── */}
      <section className="px-4 pt-6">
        <div className="rounded-2xl border border-neutral-100 bg-white p-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-neutral-500">Subtotal ({quantity} {quantity === 1 ? 'ud' : 'uds'}{targetReached || visualMode === 'esperar' ? ' · precio objetivo' : ''})</span>
            <span className="text-lg font-bold text-neutral-900">{eur(total)}</span>
          </div>
          {savings > 0.01 && (
            <div className="mt-1 text-right text-xs font-semibold text-brand">
              Ahorras {eur(savings)} frente a tienda
            </div>
          )}
        </div>
      </section>

      {/* ── 1. TUS DATOS ── */}
      <section ref={datosRef as any} className={SECTION}>
        <h2 className={H}>1. Tus datos</h2>
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

      {/* ── 2. DIRECCIÓN DE ENVÍO ── */}
      <section className={SECTION}>
        <h2 className={H}>2. Dirección de envío</h2>
        {prefilled && (
          <p className="-mt-1 mb-3 flex items-center gap-1.5 text-[12.5px] font-medium text-brand">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden="true"><path d="M5 12l5 5 9-11" /></svg>
            Tu dirección guardada · puedes editarla
          </p>
        )}
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

      {/* ── 3. PAGO SEGURO ── */}
      <section className={SECTION}>
        <h2 className={H}>3. Pago seguro</h2>
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

      {/* ── ¿CÓMO FUNCIONA GROPO? ── */}
      <HowGropoRow onOpen={onOpenHow} />

      {/* ── FOOTER FIJO: Hoy 0 € (retención, no cobro) ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-100 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-3 lg:max-w-lg">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !stripe}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-[15px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            {loading ? (
              'Procesando…'
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                {targetReached ? `Confirmar compra · ${eur(total)}` : `${visualMode === 'esperar' ? 'Reservar plaza' : 'Unirme al grupo'} (Hoy 0 €)`}
              </>
            )}
          </button>
          {targetReached && (
            <p className="mt-2 text-center text-xs text-neutral-500">
              El grupo ya alcanzó tu precio objetivo. Se retiene el importe y el cargo se realiza al cierre del grupo; si no ejecuta, se libera sin cargo.
            </p>
          )}
          {showAdjust && visualMode !== 'esperar' && (
            <p className="mt-2 text-center text-xs text-neutral-500">
              Hoy 0 €. Pagas el precio final al cierre; se ajustará a la baja si el gropo crece.
            </p>
          )}
          {visualMode === 'esperar' && (
            <p className="mt-2 text-center text-xs text-neutral-500">
              Solo pagas si el gropo baja a tu precio objetivo. Si no, se libera sin cargo.
            </p>
          )}

          {/* ── TRUST BADGES: validación institucional en el punto de fricción ── */}
          <div className="mt-2.5 border-t border-neutral-100 pt-2.5">
            <p className="mb-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-neutral-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              Pago seguro · 3D Secure
            </p>
            <PayLogos />
          </div>
        </div>
      </div>
    </>
  );
}
