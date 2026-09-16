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

import Link from 'next/link';
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
import { isValidEmail } from '@/lib/email';
import { supabase } from '@/lib/supabase';
import HowGropoSheet from '@/components/HowGropoSheet';
import { readLocalIdentity, saveLocalIdentity } from '@/lib/local-identity';
import { fmtSaving } from '@/lib/money'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

/**
 * Un escalón de la curva pública de precios.
 *
 * `demand` es la demanda EFECTIVA a ESE precio (`tier_demand.effective_demand`):
 * cuántas unidades lo comprarían. No es un número global — un esperador con
 * objetivo 150 € cuenta en el tramo de 150 € y en los más baratos, pero no en el
 * de 200 €. Ver P2-01b en `KNOWN_ISSUES.md`.
 */
type Tier = { minUnits: number; price: number; demand: number };

export type JoinGroup = {
  id: string;
  product_name: string;
  product_spec: string;
  pvp: number;
  current_price: number; // precio del gropo con las unidades actuales (fallback hasta el quote)
  image_url?: string | null;
  /** Unidades que ya ocupan stock (P2-01). Ver `remainingStock`. */
  committed_units: number;
  closes_at: string;
  max_stock: number;
  min_execution: number;
  /** El vendedor declaró que los precios ya incluyen el envío (UX-03). */
  shipping_included: boolean;
  tiers: Tier[];
};

/**
 * Stock restante de la puja que da el mejor precio. `null` = sin límite conocido.
 *
 * P2-01 · Antes esto restaba `total_units`, que es la demanda EFECTIVA al precio
 * actual: deja fuera a los esperadores que apuntan a un tramo más barato. Como
 * esos esperadores SÍ ocupan plaza, el resultado sobreestimaba lo disponible y
 * el selector dejaba pedir unidades que ya no existían; el rechazo llegaba
 * después, al pagar. Ahora resta `committed_units`, que es exactamente la misma
 * suma que usa `prepare_join` para aceptar o rechazar en servidor.
 *
 * Sigue siendo una foto del momento en que se pintó la página: entre eso y el
 * pago puede entrar alguien. La autoridad es `prepare_join`, no esto.
 */
function remainingStock(g: JoinGroup): number | null {
  return g.max_stock > 0 ? g.max_stock - g.committed_units : null;
}

/**
 * A-12 · El stock servía solo para IMPEDIR, nunca para AVISAR.
 *
 * `remainingStock` ya calculaba bien las unidades libres y el selector topaba ahí,
 * pero el badge decía «✓ En stock» exactamente igual con 2 unidades que con 200. Y
 * el peor sitio para callarlo es un grupo que ya tiene desbloqueado su mejor precio:
 * ahí no queda ninguna palanca de precio y la única razón para decidir hoy es que se
 * acaban — justo lo que no se decía.
 *
 * Umbral en 5 unidades: por debajo de eso el número comunica algo («quedan 2»);
 * por encima, un número grande no aporta y además revela el inventario del vendedor
 * sin necesidad.
 */
const LOW_STOCK_THRESHOLD = 5;

function StockBadge({ left }: { left: number | null }) {
  if (left !== null && left <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#FDEDED] px-2.5 py-1.5 text-xs font-bold text-[#B3261E]">
        Sin stock
      </span>
    );
  }
  if (left !== null && left <= LOW_STOCK_THRESHOLD) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#FEF3E2] px-2.5 py-1.5 text-xs font-bold text-[#B4541A]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L4.09 12.11a1 1 0 00.77 1.64H11l-1 8.25 8.91-10.11a1 1 0 00-.77-1.64H12z" /></svg>
        {left === 1 ? 'Queda 1 unidad' : `Quedan ${left} unidades`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#E6F5EC] px-2.5 py-1.5 text-xs font-bold text-[#0B7B44]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      En stock
    </span>
  );
}

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
      style={{ color: state.urgent ? '#D6452B' : state.near ? '#024947' : '#6B6B76' }}
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
    colors: ['#024947', '#04817E', '#F5FAFA'],
  });
}

const SECTION = 'px-4 pt-6';
const H = 'text-sm font-semibold text-neutral-900 mb-3';
const INPUT =
  'w-full h-12 px-3.5 rounded-xl border border-neutral-200 bg-white text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand';
const INPUT_ERR =
  'w-full h-12 px-3.5 rounded-xl border border-red-400 bg-white text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500';

/**
 * A-27 · Campo del checkout con etiqueta y autocompletado.
 *
 * Los ocho campos usaban SOLO `placeholder`: sin `<label>`, sin `id`, y sin un solo
 * `autoComplete`. Tres consecuencias, de más a menos cara:
 *
 *  1. El autorrelleno del móvil NO FUNCIONABA. Ocho campos tecleados a mano en una
 *     pantalla pequeña, en el punto de máxima fricción del embudo. De todo lo que
 *     encontró la auditoría, es lo que más cuesta en conversión.
 *  2. Al escribir, la etiqueta desaparece (el defecto clásico del placeholder-como-
 *     etiqueta): al repasar antes de pagar se ven ocho cajas con texto y ninguna dice
 *     qué es cada cosa.
 *  3. Sin `<label>` asociada no hay nombre accesible fiable (WCAG 3.3.2).
 *
 * La etiqueta va en `sr-only`: arregla 1 y 3 sin tocar el diseño aprobado. Hacerla
 * visible resolvería también 2, pero cambia la altura del formulario y eso es
 * decisión visual de Benjamin, no mía.
 */
function Field({
  id, label, error, inputRef, className, ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  error?: string | null
  inputRef?: React.RefObject<HTMLInputElement>
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id}
        ref={inputRef}
        className={error ? INPUT_ERR : INPUT}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[12.5px] font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

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
  // El Math.max(1, …) de antes hacía que con stock 0 el selector siguiera
  // permitiendo 1 unidad: el comprador rellenaba el formulario entero y
  // `prepare_join` lo rechazaba al final. Ahora se ve antes de empezar.
  const left = remainingStock(group);
  const maxQty = left === null ? 10 : Math.min(10, Math.max(1, left));

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

  // Quote en vivo: precio por unidad proyectado. Lo calcula compute_price en el
  // servidor, que es la autoridad; la escalera de aquí abajo solo pinta.
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
  // ── ESCALERA CON DEMANDA POR TRAMO (P2-01b) ──
  //
  // Antes todo esto se medía contra `group.total_units`, un solo número: la
  // demanda al precio vigente. Con eso, un grupo al que le falta 1 unidad para
  // bajar a 150 € podía anunciar "faltan 8", porque los esperadores que apuntan
  // a 150 € no entran en la demanda a 200 €. La caja de precio (que sí viene del
  // servidor) decía 150 € y el progreso, justo debajo, decía que faltaban 8.
  //
  // Cada tramo trae ahora su propia demanda. `withYou` le suma la compra en
  // curso SOLO si contaría en ese tramo: quien compra ahora cuenta en todos;
  // quien espera a un objetivo cuenta en el suyo y en los más baratos, igual
  // que hace `tier_demand` en el servidor.
  const ladder = useMemo(() => sorted.map((t) => {
    const buyerCounts = !isEsperar || t.price <= efectiveTargetPrice + 0.01;
    const withYou = t.demand + (buyerCounts ? quantity : 0);
    return {
      ...t,
      withYou,
      groupReached: t.demand >= t.minUnits,
      youReached: withYou >= t.minUnits,
      missing: Math.max(0, t.minUnits - withYou),
    };
  }), [sorted, isEsperar, efectiveTargetPrice, quantity]);

  const nextTier = useMemo(() => {
    let curIdx = -1;
    for (let i = 0; i < ladder.length; i++) if (ladder[i].groupReached) curIdx = i;
    return curIdx + 1 < ladder.length ? ladder[curIdx + 1] : null;
  }, [ladder]);

  const unlocks = !!nextTier && nextTier.youReached; // Estado A


  // Hold para Stripe: siempre target × qty para esperadores (techo de seguridad)
  const holdPricePerUnit = isEsperar ? efectiveTargetPrice : pricePerUnit;
  const amountCents = useMemo(
    () => Math.max(50, Math.round(holdPricePerUnit * quantity * 100)),
    [holdPricePerUnit, quantity],
  );
  // Una vez el comprador pulsa el boton, el pedido queda CONGELADO: ni el importe
  // que ve Stripe ni la cantidad pueden cambiar mientras el checkout esta en
  // marcha. Sin esto, la respuesta del quote puede llegar con submit() a medio
  // ejecutar y dejar a Stripe y al servidor discutiendo sobre dos importes
  // distintos. El selector de unidades se deshabilita a la vez (checkoutBusy).
  const [frozenAmount, setFrozenAmount] = useState<number | null>(null);
  const checkoutBusy = frozenAmount !== null;
  const effectiveAmount = frozenAmount ?? amountCents;

  const elementsOptions = useMemo(
    () => ({
      mode: 'payment' as const,
      amount: effectiveAmount,
      currency: 'eur',
      capture_method: 'manual' as const,
      // Debe COINCIDIR con la PaymentIntent del servidor (create-intent), o Stripe
      // rechaza la confirmación en modo diferido con "setup_future_usage mismatch".
      setup_future_usage: 'on_session' as const,
      paymentMethodTypes: ['card'],
      appearance: { theme: 'stripe' as const, variables: { colorPrimary: '#024947' } },
    }),
    [effectiveAmount],
  );

  const [payInfoOpen, setPayInfoOpen] = useState(false);

  // ── Stepper de tramos (diseño 4b): estados y relleno de la barra ──
  // La barra refleja las unidades PROYECTADAS (grupo + las que elige el usuario),
  // en coherencia con el precio, que también es proyectado.
  const nTiers = ladder.length;
  const lastUnlockedIdx = (() => { let idx = -1; for (let i = 0; i < nTiers; i++) if (ladder[i].groupReached) idx = i; return idx; })();
  const projIdx = (() => { let idx = -1; for (let i = 0; i < nTiers; i++) if (ladder[i].youReached) idx = i; return idx; })();
  const comprarGoalIdx = projIdx + 1 < nTiers ? projIdx + 1 : -1;
  const targetIdx = (() => {
    const i = ladder.findIndex((t) => Math.abs(t.price - efectiveTargetPrice) < 0.01);
    return i >= 0 ? i : nTiers - 1;
  })();
  const missingToTarget = targetIdx >= 0 ? ladder[targetIdx].missing : 0;
  // Posición CONTINUA en la barra. El relleno de un segmento es lo llena que
  // está la exigencia del tramo que viene: su demanda dividida entre sus
  // unidades. Al cumplirse, el segmento llega justo al nodo.
  const positionOf = (reachedIdx: number, key: 'demand' | 'withYou') => {
    if (nTiers <= 1 || reachedIdx < 0) return 0;
    if (reachedIdx >= nTiers - 1) return 1;
    const next = ladder[reachedIdx + 1];
    const seg = next.minUnits > 0 ? Math.min(1, Math.max(0, next[key] / next.minUnits)) : 0;
    return (reachedIdx + seg) / (nTiers - 1);
  };
  const groupPos = positionOf(lastUnlockedIdx, 'demand');
  const projPos = positionOf(projIdx, 'withYou');
  // El punto (knob) solo se muestra mientras avanza ENTRE hitos; al llegar
  // justo a un tramo, ese nodo pasa a check y el punto desaparece.
  const showKnob = projIdx >= 0 && projIdx < nTiers - 1 && projPos > projIdx / (nTiers - 1) + 1e-9;

  return (
    /* A-32 · En escritorio esto es una rejilla de dos columnas: el formulario a la
       izquierda y el producto con su progreso a la derecha, de modo que se ven a la
       vez. En móvil no hay rejilla y el orden del DOM manda: producto y luego
       formulario, que es como estaba. La lógica de dinero no se toca — esto es
       colocación, nada más. */
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_368px] lg:items-start lg:gap-8">
      {/* Columna DERECHA en escritorio, bloque de arriba en móvil. */}
      <div className="lg:col-start-2 lg:row-start-1 lg:min-w-0">
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
                <div className="flex h-[34px] items-center gap-2.5 rounded-[11px] border border-black/[0.08] bg-[#F2F7F7] px-1.5">
                  <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1 || checkoutBusy} aria-label="Quitar una unidad" className="grid h-6 w-6 place-items-center text-[17px] leading-none text-neutral-600 disabled:text-neutral-300">−</button>
                  <span className="min-w-[22px] text-center text-[15px] font-bold tabular-nums text-neutral-900">{quantity}</span>
                  <button type="button" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty || checkoutBusy} aria-label="Añadir una unidad" className="grid h-6 w-6 place-items-center text-[17px] leading-none text-neutral-600 disabled:text-neutral-300">+</button>
                </div>
                {group.shipping_included && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F2F7F7] px-2.5 py-1.5 text-xs font-semibold text-neutral-600">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#024947" strokeWidth="2"><rect x="1" y="6" width="14" height="10" rx="1.5" /><path d="M15 9h4l3 3v4h-7" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>
                    Envío incluido
                  </span>
                )}
                <StockBadge left={remainingStock(group)} />
              </div>
            </div>
          </section>

          {/* Filas de precio: precio actual del grupo (neutro) + tu precio objetivo (resaltado) */}
          <section className="px-4 pt-3.5">
            <div className="rounded-[18px] border border-black/[0.08] bg-white p-1.5">
              <div className="flex items-center px-3 py-[11px]">
                <div className="text-xs font-semibold text-neutral-500">Precio actual del grupo</div>
                <div className="ml-auto flex-shrink-0 whitespace-nowrap text-[22px] font-extrabold leading-none tracking-tight tabular-nums text-neutral-900">{eur(pricePerUnit)}</div>
              </div>
              <div className="flex items-center rounded-[14px] border-[1.5px] px-3.5 py-3" style={{ background: '#F5F9F9', borderColor: '#024947' }}>
                <div className="mr-[11px] grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px]" style={{ background: '#024947' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-bold text-brand">Tu precio objetivo</div>
                  <div className="mt-px text-xs font-medium" style={{ color: '#024947' }}>al que compras si el grupo lo alcanza</div>
                </div>
                <div className="ml-auto flex-shrink-0 whitespace-nowrap text-[22px] font-extrabold leading-none tracking-tight tabular-nums text-brand">{eur(efectiveTargetPrice)}</div>
              </div>
            </div>
          </section>

          {/* Progreso del grupo — stepper horizontal con checks (diseño 4b) */}
          <section className="px-4 pt-3.5">
            <div className="rounded-[18px] border border-black/[0.08] bg-white p-[15px]">
              <div className="flex items-center">
                <div className="flex-1 text-[15px] font-extrabold text-neutral-900">Progreso del grupo</div>
                <div className="flex items-center gap-1 text-xs font-semibold text-neutral-500">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#024947" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" /></svg>
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
                    const groupReached = ladder[i].groupReached;
                    const youReached = ladder[i].youReached;
                    const isTarget = Math.abs(t.price - efectiveTargetPrice) < 0.01;
                    return (
                      <div key={i} className="flex w-14 flex-col items-center">
                        {groupReached ? (
                          <div className="grid h-5 w-5 place-items-center rounded-full border-[3px] border-[#faf9fc] bg-brand" style={{ boxShadow: '0 0 0 1.5px #024947' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                          </div>
                        ) : youReached ? (
                          <div className="grid h-5 w-5 place-items-center rounded-full border-[3px] border-[#faf9fc]" style={{ background: '#024947', boxShadow: '0 0 0 1.5px #024947' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                          </div>
                        ) : isTarget ? (
                          <div className="grid h-[22px] w-[22px] animate-pulse place-items-center rounded-full border-[3px] border-accent-dark bg-white">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#B24A00" strokeWidth="2.6"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                          </div>
                        ) : (
                          <div className="mt-0.5 h-4 w-4 rounded-full border-[2.5px] border-black/[0.18] bg-white" />
                        )}
                        <div className={`mt-2 text-[15px] font-extrabold ${isTarget && !youReached ? 'text-accent-dark' : groupReached ? 'text-neutral-900' : youReached ? 'text-brand' : 'text-neutral-400'}`}>{eur(t.price)}</div>
                        <div className="text-xs font-medium text-neutral-500">{t.minUnits} {t.minUnits === 1 ? 'ud' : 'uds'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {missingToTarget > 0 ? (
                <div className="mt-1 text-center text-xs font-medium text-neutral-500">Faltan <b className="text-accent-dark">{missingToTarget} {missingToTarget === 1 ? 'unidad' : 'unidades'}</b> para llegar a tu objetivo</div>
              ) : (
                <div className="mt-1 text-center text-xs font-bold text-[#0B7B44]">Tu precio objetivo ya está desbloqueado 🎉</div>
              )}
            </div>
          </section>

          {/* Banner verde: compra automática (money-critical: importe retenido) */}
          <section className="px-4 pt-3.5">
            <div className="flex gap-[11px] rounded-2xl border border-[#CFEADA] bg-[#EEF8F1] p-[13px]">
              <svg width="19" height="19" className="mt-px flex-none" viewBox="0 0 24 24" fill="none" stroke="#0B7B44" strokeWidth="2"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" /><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <div className="text-xs font-semibold leading-[1.5] text-[#0D6B3D]">
                <b>Tu compra automática a {eur(efectiveTargetPrice)}.</b> Se retendrán {eur(efectiveTargetPrice * quantity)} ({eur(efectiveTargetPrice)}/ud × {quantity}). Si el grupo alcanza este precio antes del cierre, tu compra se confirma automáticamente. Si no, se libera sin cargo. <b>La reserva se mantiene hasta el cierre y no se puede retirar:</b> es lo que permite al vendedor comprometer el precio.{' '}
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
                <div className="flex h-[34px] items-center gap-2.5 rounded-[11px] border border-black/[0.08] bg-[#F2F7F7] px-1.5">
                  <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1 || checkoutBusy} aria-label="Quitar una unidad" className="grid h-6 w-6 place-items-center text-[17px] leading-none text-neutral-600 disabled:text-neutral-300">−</button>
                  <span className="min-w-[22px] text-center text-[15px] font-bold tabular-nums text-neutral-900">{quantity}</span>
                  <button type="button" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty || checkoutBusy} aria-label="Añadir una unidad" className="grid h-6 w-6 place-items-center text-[17px] leading-none text-neutral-600 disabled:text-neutral-300">+</button>
                </div>
                {group.shipping_included && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F2F7F7] px-2.5 py-1.5 text-xs font-semibold text-neutral-600">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#024947" strokeWidth="2"><rect x="1" y="6" width="14" height="10" rx="1.5" /><path d="M15 9h4l3 3v4h-7" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>
                    Envío incluido
                  </span>
                )}
                <StockBadge left={remainingStock(group)} />
              </div>
            </div>
          </section>

          {/* Tarjeta objetivo conseguido */}
          <section className="px-4 pt-3.5">
            <div className="flex items-center rounded-[18px] border-[1.5px] px-3.5 py-3.5" style={{ background: '#F5F9F9', borderColor: '#024947' }}>
              <div className="mr-[11px] grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px]" style={{ background: '#024947' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></svg>
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-bold text-brand">¡Objetivo conseguido! Compras a {eur(displayPricePerUnit)}</div>
                <div className="mt-px text-xs font-medium" style={{ color: '#024947' }}>al reservar, tu compra se confirma automáticamente</div>
              </div>
              <div className="ml-auto flex-shrink-0 whitespace-nowrap text-[22px] font-extrabold leading-none tracking-tight tabular-nums text-brand">{eur(displayPricePerUnit)}</div>
            </div>
          </section>

          {/* Progreso del grupo — con "tu precio" en el tramo conseguido */}
          <section className="px-4 pt-3.5">
            <div className="rounded-[18px] border border-black/[0.08] bg-white p-[15px]">
              <div className="flex items-center">
                <div className="flex-1 text-[15px] font-extrabold text-neutral-900">Progreso del grupo</div>
                <div className="flex items-center gap-1 text-xs font-semibold text-neutral-500">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#024947" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" /></svg>
                  <span>Cierra en</span> <CompactCountdown closesAt={group.closes_at} />
                </div>
              </div>
              <div className="relative mx-1 mb-2 mt-6">
                {/* 16-sep-2026 (Benjamin) · Aquí el objetivo YA está conseguido: el
                    círculo se queda anclado en el tramo alcanzado, sin el punto que
                    antes se adelantaba hacia el SIGUIENTE tramo. Ese adelanto es real
                    (tus unidades también cuentan ahí — "comprar ahora" cuenta en
                    todos), pero sin ninguna etiqueta al lado se leía como un fallo de
                    posición, no como progreso. El "Faltan N unidades" de debajo ya lo
                    cuenta bien; aquí basta con el check quieto. */}
                <div className="absolute left-[6%] right-[6%] top-[9px] h-[3px] rounded-full bg-black/[0.07]" />
                <div className="absolute left-[6%] top-[9px] h-[3px] rounded-full bg-brand transition-[width] duration-300 ease-out" style={{ width: `calc(88% * ${nTiers > 1 ? projIdx / (nTiers - 1) : projPos})` }} />
                <div className="absolute left-[6%] top-[9px] h-[3px] rounded-full bg-brand transition-[width] duration-300 ease-out" style={{ width: `calc(88% * ${groupPos})` }} />
                <div className="relative flex justify-between">
                  {sorted.map((t, i) => {
                    const groupReached = ladder[i].groupReached;
                    const youReached = ladder[i].youReached;
                    const isGoal = i === comprarGoalIdx;
                    const isMine = Math.abs(t.price - displayPricePerUnit) < 0.01;
                    return (
                      <div key={i} className="flex w-14 flex-col items-center">
                        {groupReached || youReached ? (
                          <div className="grid h-5 w-5 place-items-center rounded-full border-[3px] border-[#faf9fc] bg-brand" style={{ boxShadow: '0 0 0 1.5px #024947' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                          </div>
                        ) : isGoal ? (
                          <div className="grid h-[22px] w-[22px] animate-pulse place-items-center rounded-full border-[3px] border-accent-dark bg-white">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#B24A00" strokeWidth="2.6"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                          </div>
                        ) : (
                          <div className="mt-0.5 h-4 w-4 rounded-full border-[2.5px] border-black/[0.18] bg-white" />
                        )}
                        <div className={`mt-2 text-[15px] font-extrabold ${isGoal && !youReached ? 'text-accent-dark' : (groupReached || youReached) ? 'text-neutral-900' : 'text-neutral-400'}`}>{eur(t.price)}</div>
                        <div className="text-xs font-medium text-neutral-500">{t.minUnits} {t.minUnits === 1 ? 'ud' : 'uds'}</div>
                        {isMine && <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">tu precio</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
              {comprarGoalIdx >= 0 ? (
                <div className="mt-1 text-center text-xs font-medium text-neutral-500">Faltan <b className="text-accent-dark">{ladder[comprarGoalIdx].missing} {ladder[comprarGoalIdx].missing === 1 ? 'unidad' : 'unidades'}</b> para bajar al siguiente tramo: {eur(sorted[comprarGoalIdx].price)}</div>
              ) : (
                <div className="mt-1 text-center text-xs font-bold text-[#0B7B44]">Ya estás en el mejor precio 🎉</div>
              )}
            </div>
          </section>

          {/* Banner verde: compra confirmada al reservar (money-critical: cargo al cierre) */}
          <section className="px-4 pt-3.5">
            <div className="flex gap-[11px] rounded-2xl border border-[#CFEADA] bg-[#EEF8F1] p-[13px]">
              <svg width="19" height="19" className="mt-px flex-none" viewBox="0 0 24 24" fill="none" stroke="#0B7B44" strokeWidth="2"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" /><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
                <div className="flex h-[34px] items-center gap-2.5 rounded-[11px] border border-black/[0.08] bg-[#F2F7F7] px-1.5">
                  <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1 || checkoutBusy} aria-label="Quitar una unidad" className="grid h-6 w-6 place-items-center text-[17px] leading-none text-neutral-600 disabled:text-neutral-300">−</button>
                  <span className="min-w-[22px] text-center text-[15px] font-bold tabular-nums text-neutral-900">{quantity}</span>
                  <button type="button" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty || checkoutBusy} aria-label="Añadir una unidad" className="grid h-6 w-6 place-items-center text-[17px] leading-none text-neutral-600 disabled:text-neutral-300">+</button>
                </div>
                {group.shipping_included && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F2F7F7] px-2.5 py-1.5 text-xs font-semibold text-neutral-600">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#024947" strokeWidth="2"><rect x="1" y="6" width="14" height="10" rx="1.5" /><path d="M15 9h4l3 3v4h-7" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>
                    Envío incluido
                  </span>
                )}
                <StockBadge left={remainingStock(group)} />
              </div>
            </div>
          </section>

          {/* Tarjeta de precio: una sola fila resaltada (el precio que aseguras hoy) */}
          <section className="px-4 pt-3.5">
            <div className="flex items-center rounded-[18px] border-[1.5px] px-3.5 py-3.5" style={{ background: '#F5F9F9', borderColor: '#024947' }}>
              <div className="mr-[11px] grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px]" style={{ background: '#024947' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" /><path d="M9 12l2 2 4-4" /></svg>
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-bold text-brand">Precio de tu plaza</div>
                {/* A-13 · Este subtítulo era un texto FIJO que no consultaba el estado.
                    En los grupos donde ya no queda escalera —G05, G06— era falso, y
                    encima chocaba con el «Mejor precio ya desbloqueado 🎉» que la barra
                    de progreso pinta 40 px más abajo. */}
                <div className="mt-px text-xs font-medium" style={{ color: '#024947' }}>
                  {nextTier ? 'bajará si entran más compradores' : 'es el mejor precio del grupo'}
                </div>
              </div>
              <div className="ml-auto flex-shrink-0 whitespace-nowrap text-[22px] font-extrabold leading-none tracking-tight tabular-nums text-brand">{eur(displayPricePerUnit)}</div>
            </div>
            {/* El ahorro se dice una sola vez, en el bloque de dinero de abajo. */}
          </section>

          {/* Progreso del grupo — stepper horizontal (objetivo = próximo tramo por desbloquear) */}
          <section className="px-4 pt-3.5">
            <div className="rounded-[18px] border border-black/[0.08] bg-white p-[15px]">
              <div className="flex items-center">
                <div className="flex-1 text-[15px] font-extrabold text-neutral-900">Progreso del grupo</div>
                <div className="flex items-center gap-1 text-xs font-semibold text-neutral-500">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#024947" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" /></svg>
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
                    const groupReached = ladder[i].groupReached;
                    const youReached = ladder[i].youReached;
                    const isGoal = i === comprarGoalIdx;
                    return (
                      <div key={i} className="flex w-14 flex-col items-center">
                        {groupReached ? (
                          <div className="grid h-5 w-5 place-items-center rounded-full border-[3px] border-[#faf9fc] bg-brand" style={{ boxShadow: '0 0 0 1.5px #024947' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                          </div>
                        ) : youReached ? (
                          <div className="grid h-5 w-5 place-items-center rounded-full border-[3px] border-[#faf9fc]" style={{ background: '#024947', boxShadow: '0 0 0 1.5px #024947' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                          </div>
                        ) : isGoal ? (
                          <div className="grid h-[22px] w-[22px] animate-pulse place-items-center rounded-full border-[3px] border-accent-dark bg-white">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#B24A00" strokeWidth="2.6"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                          </div>
                        ) : (
                          <div className="mt-0.5 h-4 w-4 rounded-full border-[2.5px] border-black/[0.18] bg-white" />
                        )}
                        <div className={`mt-2 text-[15px] font-extrabold ${isGoal && !youReached ? 'text-accent-dark' : groupReached ? 'text-neutral-900' : youReached ? 'text-brand' : 'text-neutral-400'}`}>{eur(t.price)}</div>
                        <div className="text-xs font-medium text-neutral-500">{t.minUnits} {t.minUnits === 1 ? 'ud' : 'uds'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {projIdx > lastUnlockedIdx ? (
                <div className="mt-1 text-center text-xs font-bold text-[#0B7B44]">{quantity === 1 ? 'Tu unidad desbloquea' : `Tus ${quantity} unidades desbloquean`} {eur(ladder[projIdx].price)} 🎉</div>
              ) : comprarGoalIdx >= 0 ? (
                <div className="mt-1 text-center text-xs font-medium text-neutral-500">Faltan <b className="text-accent-dark">{ladder[comprarGoalIdx].missing} {ladder[comprarGoalIdx].missing === 1 ? 'unidad' : 'unidades'}</b> para desbloquear {eur(sorted[comprarGoalIdx].price)}</div>
              ) : (
                <div className="mt-1 text-center text-xs font-bold text-[#0B7B44]">Mejor precio ya desbloqueado 🎉</div>
              )}
            </div>
          </section>

          {/* Banner verde: aseguras tu plaza hoy sin pagar */}
          <section className="px-4 pt-3.5">
            <div className="flex gap-[11px] rounded-2xl border border-[#CFEADA] bg-[#EEF8F1] p-[13px]">
              <svg width="19" height="19" className="mt-px flex-none" viewBox="0 0 24 24" fill="none" stroke="#0B7B44" strokeWidth="2"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" /><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <div className="text-xs font-semibold leading-[1.5] text-[#0D6B3D]">
                <b>Aseguras tu plaza hoy sin pagar.</b> Retenemos el importe en tu tarjeta y solo se cobra al cierre del grupo, al mejor precio alcanzado. Si el grupo no se completa, se libera sin cargo. <b>Tu plaza queda reservada hasta el cierre y no se puede retirar:</b> es lo que permite al vendedor comprometer el precio.{' '}
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
      </div>

      {/* Columna IZQUIERDA en escritorio: el formulario y el pago. */}
      <div className="lg:col-start-1 lg:row-start-1 lg:min-w-0">
      {/* ── 2-4 + FOOTER (dentro de Elements) ── */}
      <Elements stripe={stripePromise} options={elementsOptions}>
        <InnerForm
          group={group}
          quantity={quantity}
          total={displayTotal}
          /* UX-14 · El importe que de verdad se bloquea en la tarjeta. Sale de
             `effectiveAmount`, el mismo que viaja a Stripe, así que no puede
             desincronizarse ni siquiera con el checkout ya en marcha. */
          holdTotal={effectiveAmount / 100}
          savings={savingsPerUnit * quantity}
          showAdjust={!unlocks && !targetReached}
          joinMode={isEsperar ? 'esperar' : 'comprar'}
          visualMode={visualMode}
          targetReached={targetReached}
          targetPrice={isEsperar ? efectiveTargetPrice : undefined}
          onOpenHow={() => setPayInfoOpen(true)}
          onCheckoutStart={() => setFrozenAmount(amountCents)}
          onCheckoutEnd={() => setFrozenAmount(null)}
        />
      </Elements>
      </div>

      {/* ── Bottom sheet compartido con la home ── */}
      <HowGropoSheet open={payInfoOpen} onClose={() => setPayInfoOpen(false)} />
    </div>
  );
}

/* Logos de método de pago (sin assets externos, inline). */
/**
 * UX-04 · Fila de métodos aceptados, bajo el botón de pago.
 *
 * Llevaba también Apple Pay y Google Pay. Se han retirado por dos razones
 * independientes, y basta con una:
 *
 *  1. Es marcado ESTÁTICO: no pregunta nada al Payment Element. Un usuario de
 *     Android veía Apple Pay, que en su teléfono es imposible; uno de Safari
 *     veía Google Pay; y cualquiera sin tarjeta guardada no veía ninguno de los
 *     dos al llegar al pago. Prometía en el punto de pago algo que en la mitad
 *     de los casos no aparece.
 *  2. Las carteras además exigen registrar el dominio en Stripe
 *     (Settings → Payments → Payment method domains). En live la lista estaba
 *     VACÍA (comprobado el 13-sep-2026); en test es UNKNOWN, la clave de la
 *     integración no tiene permiso para consultarlo.
 *
 * Las marcas de tarjeta sí se quedan: el Payment Element siempre ofrece tarjeta,
 * así que VISA y Mastercard son ciertas en todos los casos.
 *
 * PARA DEVOLVERLAS: registrar el dominio en Stripe (test y live son listas
 * separadas), comprobar en un móvil real que la cartera aparece de verdad en el
 * Element, y solo entonces volver a añadir los dos pills aquí.
 */
function PayLogos() {
  const pill = 'flex h-7 items-center justify-center rounded-md border border-neutral-200 bg-white px-2.5';
  return (
    <div className="flex items-center justify-center gap-1.5">
      <div className={pill}><span className="text-[11.5px] font-extrabold italic tracking-tight text-[#1A1F71]">VISA</span></div>
      <div className={pill}>
        <svg width="26" height="16" viewBox="0 0 30 18" aria-label="Mastercard"><circle cx="12" cy="9" r="6" fill="#EB001B" /><circle cx="18" cy="9" r="6" fill="#F79E1B" fillOpacity="0.9" /></svg>
      </div>
    </div>
  );
}

/* A-28 (mitad de producto) · Acceso a las condiciones desde el checkout.
 *
 * Hasta ahora el comprador firmaba una autorización de pago sin que existiera en
 * ninguna pantalla un enlace a las condiciones bajo las que firma. La LSSI pide acceso
 * permanente a esa información y la normativa de consumo pide información
 * precontractual ANTES de quedar vinculado; el pie del sitio cubre lo primero, esto
 * cubre lo segundo, que es donde de verdad importa.
 *
 * Los textos siguen siendo un borrador pendiente de revisión jurídica: esto resuelve
 * el acceso, no la validez del contenido.
 */
function LegalRow() {
  const link = 'font-semibold text-neutral-700 underline underline-offset-2 hover:text-neutral-900';
  return (
    <section className="px-4 pt-3">
      <div className="rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3.5">
        <p className="text-[12px] leading-relaxed text-neutral-500">
          Al confirmar autorizas una retención por el importe máximo indicado. Si el precio
          final es igual o inferior, se cobrará ese precio final; si es superior, tu compra no
          se ejecutará y no se te cobrará nada.
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
          Consulta las{' '}
          <Link href="/legal/condiciones-compra" target="_blank" className={link}>Condiciones de compra</Link>,
          la{' '}
          <Link href="/legal/devoluciones" target="_blank" className={link}>Política de devoluciones</Link>{' '}
          y la{' '}
          <Link href="/legal/privacidad" target="_blank" className={link}>Política de privacidad</Link>.
        </p>
      </div>
    </section>
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
  holdTotal,
  savings,
  showAdjust,
  joinMode = 'comprar',
  visualMode = 'comprar',
  targetReached = false,
  targetPrice,
  onOpenHow,
  onCheckoutStart,
  onCheckoutEnd,
}: {
  group: JoinGroup;
  quantity: number;
  total: number;
  /** Lo que se retiene hoy en la tarjeta. Puede superar a `total` cuando un
   *  esperador ya vio su objetivo alcanzado: el hold es su techo, el cobro
   *  será el precio real y la diferencia se libera al capturar. */
  holdTotal: number;
  savings: number;
  showAdjust: boolean;
  joinMode?: 'comprar' | 'esperar';
  visualMode?: 'comprar' | 'esperar';
  targetReached?: boolean;
  targetPrice?: number;
  onOpenHow: () => void;
  /** Congela el importe y el selector en cuanto arranca el checkout. */
  onCheckoutStart: () => void;
  /** Lo descongela si el checkout falla y el comprador vuelve al boton. */
  onCheckoutEnd: () => void;
}) {
  const noStock = (remainingStock(group) ?? 1) <= 0;
  /** Esperador que todavía no ha visto su objetivo alcanzado: el importe no es
   *  un total a pagar, es un techo condicionado a que el grupo llegue. */
  const esperando = visualMode === 'esperar' && !targetReached;
  /** Solo pasa con un esperador cuyo objetivo YA se alcanzó: el hold es su
   *  objetivo y el cobro será el precio real, más bajo. */
  const holdExceedsTotal = holdTotal - total > 0.01;
  const stripe = useStripe();
  const elements = useElements();

  const [c, setC] = useState({ nombre: '', apellidos: '', email: '', phone: '' });
  const [s, setS] = useState({ line1: '', postal_code: '', city: '', province: '' });
  const [billingSame, setBillingSame] = useState(true);
  const [loading, setLoading] = useState(false);
  // P0-03 · El hold ya esta autorizado pero la membresia la crea el WEBHOOK.
  // Mientras la confirmamos no volvemos al boton ni cantamos exito.
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * A-26 · Los errores del formulario se pintan JUNTO AL CAMPO que falla.
   *
   * Antes había un único booleano para los ocho campos obligatorios y un solo
   * mensaje —«Completa todos los campos antes de continuar»— que además se pintaba
   * DESPUÉS de la sección «3. Pago seguro», mientras el submit hacía scroll hasta
   * arriba. Es decir: la pantalla saltaba al principio y el aviso se quedaba fuera
   * de vista, detrás de tres secciones y del footer fijo. El comprador veía que algo
   * se movía y nada más.
   *
   * `error` sigue existiendo para lo que sí es global: fallos de Stripe, de red y
   * rechazos del servidor.
   */
  type FieldKey = 'nombre' | 'apellidos' | 'email' | 'phone' | 'line1' | 'postal_code' | 'city' | 'province';
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const clearField = (k: FieldKey) =>
    setFieldErrors((prev) => (prev[k] ? { ...prev, [k]: undefined } : prev));

  const datosRef = useRef<HTMLElement>(null);
  const refs: Record<FieldKey, React.RefObject<any>> = {
    nombre: useRef<HTMLInputElement>(null),
    apellidos: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    line1: useRef<HTMLInputElement>(null),
    postal_code: useRef<HTMLInputElement>(null),
    city: useRef<HTMLInputElement>(null),
    province: useRef<HTMLSelectElement>(null),
  };
  // Precarga: si el usuario ya compró antes, no debe volver a teclear sus datos
  // ni su dirección. La identidad vive en localStorage (la guarda este mismo
  // checkout al confirmar) y la dirección predeterminada en el perfil.
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = readLocalIdentity();
      if (!u.email && !u.phone) return;

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
    setFieldErrors({});
    if (!stripe || !elements) return;

    // A-26 · Se revisan los ocho campos y se marca CADA uno que falla, en orden de
    // pantalla. El foco va al primero, que es lo que un lector de pantalla anuncia y
    // lo que el teclado del móvil abre.
    // A-25 · El email lleva además comprobación de formato: es la llave con la que se
    // recupera el pedido (`get_my_groups` exige teléfono + email), y un fallo ahí no
    // da error en ninguna parte — el dinero se retiene igual y el pedido desaparece
    // de /mis-grupos y /notificaciones. El servidor lo valida también, en
    // `create-intent`, que es la autoridad; esto avisa antes de pagar.
    const errs: Partial<Record<FieldKey, string>> = {};
    if (!c.nombre.trim()) errs.nombre = 'Falta tu nombre';
    if (!c.apellidos.trim()) errs.apellidos = 'Faltan tus apellidos';
    if (!c.email.trim()) errs.email = 'Falta tu email';
    else if (!isValidEmail(c.email)) errs.email = 'Revisa tu email: no parece una dirección válida. Es a donde enviamos la confirmación y con lo que podrás consultar tu pedido.';
    if (!c.phone.trim()) errs.phone = 'Falta tu teléfono';
    if (!s.line1.trim()) errs.line1 = 'Falta la dirección de envío';
    if (!s.postal_code.trim()) errs.postal_code = 'Falta el código postal';
    if (!s.city.trim()) errs.city = 'Falta la ciudad';
    if (!s.province) errs.province = 'Elige tu provincia';

    const order: FieldKey[] = ['nombre', 'apellidos', 'email', 'phone', 'line1', 'postal_code', 'city', 'province'];
    const first = order.find((k) => errs[k]);
    if (first) {
      setFieldErrors(errs);
      refs[first].current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      refs[first].current?.focus({ preventScroll: true });
      return;
    }

    setLoading(true);
    onCheckoutStart();
    const fullName = `${c.nombre} ${c.apellidos}`.trim();

    // Reloj de seguridad (P0-06). El 11-sep-2026 se observo en produccion que
    // elements.submit() podia no resolver nunca y dejar al comprador atrapado en
    // "Procesando..." sin salida. No se ha logrado reproducir despues, asi que la
    // causa sigue siendo UNKNOWN: esto no arregla el fallo, impide que sea letal.
    // Es seguro: aqui todavia NO existe ninguna retencion — create-intent no se ha
    // llamado — asi que reintentar no puede cobrar ni retener dos veces.
    const submitOutcome = await Promise.race([
      elements.submit(),
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 20000)),
    ]);
    if (submitOutcome === 'timeout') {
      setError('El formulario de pago no responde. Vuelve a pulsar el botón; si sigue igual, recarga la página. No se te ha cobrado ni retenido nada.');
      setLoading(false);
      onCheckoutEnd();
      return;
    }

    const { error: submitError } = submitOutcome;
    if (submitError) {
      setError(submitError.message ?? 'Revisa los datos de la tarjeta');
      setLoading(false);
      onCheckoutEnd();
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
        onCheckoutEnd();
        return;
      }
      clientSecret = data.clientSecret;
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.');
      setLoading(false);
      onCheckoutEnd();
      return;
    }

    // Recordar identidad (teléfono + email) para la auto-carga de "Mis grupos".
    // Se guarda antes de confirmPayment para sobrevivir a redirecciones 3DS.
    saveLocalIdentity({
      name: fullName,
      email: c.email.trim(),
      phone: normalizePhone(c.phone),
      quantity,
      price: Math.round((total / quantity) * 100) / 100,
      address_line1: s.line1,
    });

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
      onCheckoutEnd();
      return;
    }

    // ── P0-03 · NO cantar exito antes de tiempo ────────────────────────────
    // El banco ya ha autorizado la retencion, pero la fila de group_members la
    // crea el WEBHOOK de Stripe, que en serverless tarda unos segundos. Si
    // confirm_join acaba devolviendo needs_release (grupo cerrado, sin stock,
    // ya eres miembro), el hold se cancela — y hasta ahora el usuario ya estaba
    // viendo la pantalla de exito. Mismo bucle que FastCheckoutModal.
    //
    // El pi_id NO hay que pedirlo a la API: ya viaja dentro del clientSecret.
    const piId = String(clientSecret).split('_secret')[0];
    setConfirming(true);
    if (piId.startsWith('pi_')) {
      for (let i = 0; i < 18; i++) {
        try {
          const r = await fetch(`/api/join/status?pi=${encodeURIComponent(piId)}`);
          if ((await r.json())?.joined === true) break;
        } catch { /* red: reintenta */ }
        await new Promise(res => setTimeout(res, 1000));
      }
    }
    // Agotado el margen seguimos adelante igualmente: la retencion esta
    // aceptada y volver al boton inicial daria la falsa impresion de que no
    // paso nada — que es una mentira peor que la que arreglamos aqui.
    window.location.href = `/grupo/${group.id}/unido`;
  }

  return (
    <>
      {/* ── TOTAL Y RETENCIÓN (UX-14) ──
          Antes aquí solo había un "Subtotal" y ninguna línea de envío ni total,
          y el CTA decía "Hoy 0 €" sin contar que hay un importe bloqueado en la
          tarjeta. Ahora se dice lo que se paga, lo que se retiene, y en qué se
          diferencian cuando no coinciden. */}
      <section className="px-4 pt-6">
        <div className="rounded-2xl border border-neutral-100 bg-white p-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-neutral-500">
              {esperando ? 'Tu precio máximo' : 'Total'} ({quantity} {quantity === 1 ? 'ud' : 'uds'})
            </span>
            <span className="text-lg font-bold text-neutral-900">{eur(total)}</span>
          </div>

          {/* A-14 · El ahorro SÍ se calculaba, pero estaba al final del bloque, en
              12 px y después del párrafo legal — mientras en la home es un badge verde
              en cada tarjeta. En las gafas son 89 € frente a 197 €: un 55 %. El
              argumento económico más fuerte del producto se desvanecía justo en la
              pantalla donde se firma. Va junto al total, que es lo que se mira. */}
          {savings > 0.01 && (
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-[13px] text-neutral-500">Precio en tienda</span>
              <span className="text-[13px]">
                <span className="text-neutral-400 line-through">{eur(group.pvp * quantity)}</span>
                <span className="ml-2 font-bold text-[#0B7B44]">Ahorras {fmtSaving(savings)}</span>
              </span>
            </div>
          )}

          {group.shipping_included && (
            <div className="mt-1.5 flex items-baseline justify-between text-sm">
              <span className="text-neutral-500">Envío</span>
              <span className="font-semibold text-neutral-700">Incluido</span>
            </div>
          )}

          {holdExceedsTotal && (
            <div className="mt-1.5 flex items-baseline justify-between text-sm">
              <span className="text-neutral-500">Se retiene hoy</span>
              <span className="font-semibold text-neutral-700">{eur(holdTotal)}</span>
            </div>
          )}

          <p className="mt-2.5 border-t border-neutral-100 pt-2.5 text-xs leading-relaxed text-neutral-500">
            {esperando
              ? `Hoy no se te cobra nada. Retenemos ${eur(holdTotal)} en tu tarjeta y solo se cobra si el grupo llega a tu precio. Si no llega, se libera entera.`
              : holdExceedsTotal
                ? 'Hoy no se te cobra nada. Al cierre se cobra el total y se libera la diferencia.'
                : `Hoy no se te cobra nada: retenemos ${eur(holdTotal)} en tu tarjeta y al cierre se cobra el precio final, que puede ser menor.`}
          </p>

        </div>
      </section>

      {/* ── 1. TUS DATOS ── */}
      <section ref={datosRef as any} className={SECTION}>
        <h2 className={H}>1. Tus datos</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field id="nombre" label="Nombre" placeholder="Nombre" autoComplete="given-name"
            error={fieldErrors.nombre} inputRef={refs.nombre}
            value={c.nombre} onChange={(e) => { setC({ ...c, nombre: e.target.value }); clearField('nombre'); }} />
          <Field id="apellidos" label="Apellidos" placeholder="Apellidos" autoComplete="family-name"
            error={fieldErrors.apellidos} inputRef={refs.apellidos}
            value={c.apellidos} onChange={(e) => { setC({ ...c, apellidos: e.target.value }); clearField('apellidos'); }} />
        </div>
        <Field id="email" label="Email" type="email" placeholder="Email" autoComplete="email"
          className="mt-3" error={fieldErrors.email} inputRef={refs.email}
          value={c.email} onChange={(e) => { setC({ ...c, email: e.target.value }); clearField('email'); }} />
        <div className="mt-3 flex items-stretch gap-2">
          <span className="inline-flex items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[15px] text-neutral-500">
            +34
          </span>
          <Field id="phone" label="Teléfono móvil" type="tel" inputMode="numeric"
            placeholder="Teléfono móvil" autoComplete="tel-national" className="flex-1"
            error={fieldErrors.phone} inputRef={refs.phone}
            value={c.phone} onChange={(e) => { setC({ ...c, phone: e.target.value }); clearField('phone'); }} />
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
        <Field id="line1" label="Dirección (calle y número)" placeholder="Dirección (calle y número)"
          autoComplete="address-line1" error={fieldErrors.line1} inputRef={refs.line1}
          value={s.line1} onChange={(e) => { setS({ ...s, line1: e.target.value }); clearField('line1'); }} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field id="postal_code" label="Código postal" inputMode="numeric" placeholder="Código postal"
            autoComplete="postal-code" error={fieldErrors.postal_code} inputRef={refs.postal_code}
            value={s.postal_code} onChange={(e) => { setS({ ...s, postal_code: e.target.value }); clearField('postal_code'); }} />
          <Field id="city" label="Ciudad" placeholder="Ciudad" autoComplete="address-level2"
            error={fieldErrors.city} inputRef={refs.city}
            value={s.city} onChange={(e) => { setS({ ...s, city: e.target.value }); clearField('city'); }} />
        </div>
        <div className="mt-3">
          <label htmlFor="province" className="sr-only">Provincia</label>
          <select
            id="province"
            ref={refs.province}
            autoComplete="address-level1"
            aria-invalid={fieldErrors.province ? true : undefined}
            aria-describedby={fieldErrors.province ? 'province-error' : undefined}
            className={`${fieldErrors.province ? INPUT_ERR : INPUT} ${s.province ? 'text-neutral-900' : 'text-neutral-400'}`}
            value={s.province} onChange={(e) => { setS({ ...s, province: e.target.value }); clearField('province'); }}
          >
            <option value="">Provincia</option>
            {PROVINCIAS_ES.map((p) => (
              <option key={p} value={p} className="text-neutral-900">{p}</option>
            ))}
          </select>
          {fieldErrors.province && (
            <p id="province-error" role="alert" className="mt-1.5 text-[12.5px] font-medium text-red-600">
              {fieldErrors.province}
            </p>
          )}
        </div>
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

      {/* ── CONDICIONES (A-28) ── */}
      <LegalRow />

      {/* ── FOOTER FIJO: Hoy 0 € (retención, no cobro) ── */}
      {/* A-32 · En móvil sigue fija al borde inferior. En escritorio, fijarla al
          fondo de una pantalla de 1.440 la dejaba a medio metro del formulario: ahí
          pasa a ser pegajosa DENTRO de su columna, siempre a la vista y junto a los
          campos que se están rellenando. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-100 bg-white/95 backdrop-blur lg:sticky lg:inset-x-auto lg:bottom-4 lg:mt-6 lg:rounded-2xl lg:border lg:border-neutral-200 lg:shadow-[0_8px_30px_rgba(0,0,0,0.10)]">
        <div className="mx-auto max-w-md px-4 py-3 lg:max-w-none">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || confirming || !stripe || noStock}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-[15px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            {confirming ? (
              'Confirmando tu plaza…'
            ) : loading ? (
              'Procesando…'
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                {noStock ? 'Sin unidades disponibles' : targetReached ? `Confirmar compra · ${eur(total)}` : `${visualMode === 'esperar' ? 'Reservar plaza' : 'Unirme al grupo'} (Hoy 0 €)`}
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
            <p className="mt-2 text-center text-[10.5px] leading-snug text-neutral-400">
              Al confirmar aceptas las{' '}
              <Link href="/legal/condiciones-compra" target="_blank" className="underline underline-offset-2 hover:text-neutral-600">
                Condiciones de compra
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
