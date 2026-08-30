'use client';

// src/components/checkout/FastCheckoutModal.tsx
// Gate A3 · "Confirma tu bloqueo" — bottom sheet (mobile) / modal centrado (desktop).
// Diseño 1-Click purgado (Benjamin): precio máximo + producto + envío/pago prefill
// + CTA. SIN ola, urgencia ni selector de cantidad (la cantidad se elige en la ficha).
//
// Dos rutas de confirmación:
//   · Tarjeta guardada (acordeón cerrado, texto plano)  → POST /api/checkout/lock
//     [cargo silencioso con el PM por defecto — endpoint money-critical, Gate A3.money]
//   · Editar / nueva tarjeta (acordeón abierto, PaymentElement) → create-intent (A2)
//     + stripe.confirmPayment. Ruta ya funcional.
import { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { PROVINCIAS_ES } from '@/lib/provincias';
import type { CheckoutPayload } from './CheckoutProvider';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const eur = (n: number) => n.toFixed(2).replace('.', ',') + ' €';

type Prefill = {
  authenticated: boolean;
  shipping: {
    name: string | null; phone: string | null;
    line1: string | null; line2: string | null;
    city: string | null; province: string | null;
    postal_code: string | null; country: string | null;
  } | null;
  payment: { brand: string | null; last4: string | null; wallet: string | null } | null;
  contact?: { name: string | null; email: string | null; phone: string | null };
};

export default function FastCheckoutModal({
  payload,
  onClose,
  onSuccess,
}: {
  payload: CheckoutPayload;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(true);

  const isEsperar = payload.joinMode === 'esperar';
  const pricePerUnit = isEsperar && payload.targetPrice ? payload.targetPrice : payload.maxPricePerUnit;
  const total = pricePerUnit * payload.quantity;
  const amountCents = Math.max(50, Math.round(total * 100));

  useEffect(() => {
    let alive = true;
    fetch('/api/checkout/prefill')
      .then((r) => r.json())
      .then((d) => { if (alive) { setPrefill(d); setPrefillLoading(false); } })
      .catch(() => { if (alive) { setPrefill({ authenticated: false, shipping: null, payment: null }); setPrefillLoading(false); } });
    return () => { alive = false; };
  }, []);

  // Cerrar con ESC + bloquear scroll de fondo mientras el sheet está abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const elementsOptions = useMemo(
    () => ({
      mode: 'payment' as const,
      amount: amountCents,
      currency: 'eur',
      capture_method: 'manual' as const,
      setup_future_usage: 'on_session' as const, // debe coincidir con create-intent (A2)
      paymentMethodTypes: ['card'],
      appearance: { theme: 'stripe' as const, variables: { colorPrimary: '#6C3CE1' } },
    }),
    [amountCents],
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Asegura tu precio"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
      />

      {/* Sheet / modal */}
      <div className="relative w-full sm:max-w-[420px] max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl animate-[sheetUp_280ms_cubic-bezier(0.22,1,0.36,1)]">
        <Elements stripe={stripePromise} options={elementsOptions}>
          <InnerCheckout
            payload={payload}
            total={total}
            isEsperar={isEsperar}
            prefill={prefill}
            prefillLoading={prefillLoading}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        </Elements>
      </div>

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes sheetUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @media (min-width: 640px) { @keyframes sheetUp { from { transform: translateY(16px); opacity: .6 } to { transform: translateY(0); opacity: 1 } } }
      `}</style>
    </div>
  );
}

type Status = 'idle' | 'processing' | 'success' | 'error';

function InnerCheckout({
  payload,
  total,
  isEsperar,
  prefill,
  prefillLoading,
  onClose,
  onSuccess,
}: {
  payload: CheckoutPayload;
  total: number;
  isEsperar: boolean;
  prefill: Prefill | null;
  prefillLoading: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState(false);
  const [editingShipping, setEditingShipping] = useState(false);

  const hasSavedCard = !!prefill?.payment?.last4;
  const ship = prefill?.shipping ?? null;

  // Editar envío (inline)
  const [s, setS] = useState({ line1: '', postal_code: '', city: '', province: '' });
  useEffect(() => {
    if (ship) setS({
      line1: ship.line1 ?? '', postal_code: ship.postal_code ?? '',
      city: ship.city ?? '', province: ship.province ?? '',
    });
  }, [ship]);

  // Si no hay tarjeta guardada, arrancamos con el PaymentElement visible.
  useEffect(() => { if (!prefillLoading && !hasSavedCard) setEditingPayment(true); }, [prefillLoading, hasSavedCard]);

  const brandLabel = (b: string | null) =>
    ({ visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex' } as Record<string, string>)[b ?? ''] ?? 'Tarjeta';

  async function handleConfirm() {
    setErrorMsg(null);
    setStatus('processing');

    // Ruta A — nueva tarjeta / edición: create-intent (A2) + confirmPayment.
    if (editingPayment || !hasSavedCard) {
      if (!stripe || !elements) { setStatus('error'); setErrorMsg('Pago no disponible. Reintenta.'); return; }
      const { error: submitError } = await elements.submit();
      if (submitError) { setStatus('error'); setErrorMsg(submitError.message ?? 'Revisa los datos de la tarjeta'); return; }

      try {
        const res = await fetch('/api/join/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            group_id: payload.groupId,
            quantity: payload.quantity,
            name: prefill?.contact?.name ?? prefill?.shipping?.name ?? '',
            email: prefill?.contact?.email ?? '',
            phone: prefill?.contact?.phone ?? prefill?.shipping?.phone ?? '',
            join_mode: payload.joinMode || 'comprar',
            ...(payload.targetPrice != null ? { target_price: payload.targetPrice } : {}),
            shipping: {
              name: prefill?.shipping?.name ?? prefill?.contact?.name ?? '',
              phone: prefill?.shipping?.phone ?? prefill?.contact?.phone ?? '',
              line1: s.line1, city: s.city, province: s.province, postal_code: s.postal_code,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) { setStatus('error'); setErrorMsg(data.error ?? 'No se pudo bloquear tu precio'); return; }

        const { error: confirmError } = await stripe.confirmPayment({
          elements,
          clientSecret: data.clientSecret,
          confirmParams: { return_url: `${window.location.origin}/grupo/${payload.groupId}/unido` },
          redirect: 'if_required',
        });
        if (confirmError) { setStatus('error'); setErrorMsg(confirmError.message ?? 'No se pudo verificar el pago'); return; }

        await completeSuccess(data.clientSecret ? String(data.clientSecret).split('_secret')[0] : null);
      } catch {
        setStatus('error'); setErrorMsg('Error de conexión. Inténtalo de nuevo.');
      }
      return;
    }

    // Ruta B — tarjeta guardada (1-Click silencioso) → /api/checkout/lock.
    try {
      const res = await fetch('/api/checkout/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: payload.groupId, quantity: payload.quantity, join_mode: payload.joinMode || 'comprar', ...(payload.targetPrice != null ? { target_price: payload.targetPrice } : {}) }),
      });
      const data = await res.json().catch(() => ({}));

      // Sin tarjeta/dirección guardada → cambiar a captura con formulario, sin alarmar.
      if (data?.error === 'no_saved_card') { setStatus('idle'); setEditingPayment(true); return; }
      if (data?.error === 'no_shipping') { setStatus('idle'); setEditingShipping(true); setErrorMsg('Añade una dirección de envío.'); return; }

      // 3DS: resolver el reto del banco sin salir del modal.
      if (data?.requires_action && data?.clientSecret) {
        if (!stripe) { setStatus('error'); setErrorMsg('Pago no disponible. Reintenta.'); return; }
        const { error: naError } = await stripe.handleNextAction({ clientSecret: data.clientSecret });
        if (naError) { setStatus('error'); setErrorMsg(naError.message ?? 'No se pudo verificar el pago.'); return; }
        await completeSuccess(data.pi_id ?? String(data.clientSecret).split('_secret')[0]);
        return;
      }

      if (!res.ok) {
        // Edge case (Benjamin): tarjeta caducada/rechazada → abrir acordeón y pedir otra.
        setStatus('error');
        setErrorMsg(data.error ?? 'No se pudo bloquear con tu tarjeta guardada. Prueba con otra.');
        setEditingPayment(true);
        return;
      }
      await completeSuccess(data.pi_id ?? null);
    } catch {
      setStatus('error'); setErrorMsg('Error de conexión. Inténtalo de nuevo.');
    }
  }

  // Éxito INLINE (sin pantalla nueva): el botón se transforma a verde con check,
  // pausa 1,5 s para que el cerebro procese el refuerzo, y el sheet baja (onSuccess
  // → provider: toast + refresh). Evita la "ceguera de cambio".
  async function completeSuccess(piId?: string | null) {
    // El hold YA está autorizado por el banco. La membresía la crea el WEBHOOK
    // de Stripe, que en producción (serverless) puede tardar unos segundos.
    // Mientras tanto mantenemos el spinner "Reservando/Asegurando…" (status
    // sigue en 'processing') e intentamos confirmar la fila en BD.
    // Si se confirma → verde inmediato. Si el webhook tarda más de la cuenta,
    // mostramos el verde IGUALMENTE: la retención está aceptada y la membresía
    // llega sí o sí (backend idempotente). NUNCA volvemos al botón inicial,
    // que daría la falsa impresión de que no pasó nada.
    if (piId) {
      for (let i = 0; i < 18; i++) {
        try {
          const r = await fetch(`/api/join/status?pi=${encodeURIComponent(piId)}`);
          if ((await r.json())?.joined === true) break;
        } catch { /* red: reintenta */ }
        await new Promise(res => setTimeout(res, 1000));
      }
    }
    setStatus('success');
    setTimeout(() => onSuccess(), 1500);
  }

  const processing = status === 'processing';
  const succeeded = status === 'success';

  return (
    <div className="px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2">
      <Grab />

      {/* Header */}
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-bold text-neutral-900">{isEsperar ? 'Confirma tu reserva' : 'Confirma tu bloqueo'}</h2>
        <button onClick={onClose} aria-label="Cerrar" className="text-neutral-400 hover:text-neutral-600">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
        </button>
      </div>

      {/* Producto */}
      <div className="mt-3 flex items-center gap-3">
        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100">
          {payload.imageUrl && <img src={payload.imageUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900">{payload.productName}</p>
          {payload.productSpec && <p className="truncate text-xs text-neutral-400">{payload.productSpec}</p>}
        </div>
      </div>

      {/* Precio máximo garantizado — HERO centrado (ancla visual) */}
      <div className="mt-4 border-t border-neutral-100 pt-5 text-center">
        <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
          {isEsperar ? 'Compra automática a' : 'Precio máximo garantizado'}{payload.quantity > 1 ? ` · ${payload.quantity} uds` : ''}
        </p>
        <p className="mt-2 text-4xl font-bold text-brand tabular-nums">{eur(total)}</p>
        <p className="mt-2 flex items-center justify-center gap-1 text-xs font-medium text-neutral-500">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
          {isEsperar ? 'Si el gropo alcanza este precio, se confirma automáticamente.' : 'Nunca pagarás más.'}
        </p>
      </div>

      {/* Envío */}
      <div className="mt-4 border-t border-neutral-100 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Envío</span>
          <button onClick={() => setEditingShipping((v) => !v)} className="text-sm font-semibold text-brand">
            {editingShipping ? 'Hecho' : 'Editar'}
          </button>
        </div>
        {!editingShipping ? (
          <div className="mt-1.5 flex items-start gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0 text-neutral-400"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="2.5" /></svg>
            <p className="text-sm text-neutral-700">
              {prefillLoading ? 'Cargando…' : ship?.line1 ? (
                <>
                  <span className="line-clamp-1">{ship.line1}{ship.line2 ? `, ${ship.line2}` : ''}</span>
                  <span className="line-clamp-1 text-neutral-500">{[ship.postal_code, ship.city, ship.country === 'ES' ? 'España' : ship.country].filter(Boolean).join(' · ')}</span>
                </>
              ) : 'Añade una dirección de envío'}
            </p>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <input className={FIELD} placeholder="Dirección (calle y número)" value={s.line1} onChange={(e) => setS({ ...s, line1: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} inputMode="numeric" placeholder="Código postal" value={s.postal_code} onChange={(e) => setS({ ...s, postal_code: e.target.value })} />
              <input className={FIELD} placeholder="Ciudad" value={s.city} onChange={(e) => setS({ ...s, city: e.target.value })} />
            </div>
            <select className={`${FIELD} ${s.province ? 'text-neutral-900' : 'text-neutral-400'}`} value={s.province} onChange={(e) => setS({ ...s, province: e.target.value })}>
              <option value="">Provincia</option>
              {PROVINCIAS_ES.map((p) => <option key={p} value={p} className="text-neutral-900">{p}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Pago */}
      <div className="mt-4 border-t border-neutral-100 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Pago</span>
          {hasSavedCard && (
            <button onClick={() => setEditingPayment((v) => !v)} className="text-sm font-semibold text-brand">
              {editingPayment ? 'Usar la guardada' : 'Editar'}
            </button>
          )}
        </div>

        {hasSavedCard && !editingPayment ? (
          <div className="mt-1.5 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-neutral-400"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
            <span className="text-sm text-neutral-700">
              {prefill?.payment?.wallet === 'apple_pay' ? 'Apple Pay · ' : ''}{brandLabel(prefill?.payment?.brand ?? null)} ···· {prefill?.payment?.last4}
            </span>
          </div>
        ) : (
          <div className="mt-2 rounded-xl border border-neutral-100 p-3">
            <PaymentElement options={{ layout: 'tabs' }} />
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
              Guardamos tu tarjeta de forma segura para tus próximas compras.
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {status === 'error' && errorMsg && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="mt-0.5 flex-shrink-0 text-red-600"><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16.5" x2="12" y2="16.5" /></svg>
          <p className="text-[13px] font-medium text-red-700">{errorMsg}</p>
        </div>
      )}

      {/* CTA — máquina de estados INLINE: idle → procesando → éxito (verde) */}
      <button
        onClick={handleConfirm}
        disabled={processing || succeeded || (editingPayment && !stripe)}
        aria-live="polite"
        className={`mt-5 flex w-full items-center justify-center rounded-2xl py-3.5 text-[15px] font-bold text-white transition-colors disabled:opacity-100 ${
          succeeded ? 'bg-green-600' : 'bg-brand hover:bg-brand-dark disabled:opacity-60'
        }`}
      >
        {succeeded ? (
          <span className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            {isEsperar ? '¡Reserva confirmada!' : '¡Precio asegurado!'}
          </span>
        ) : processing ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            {isEsperar ? 'Reservando tu plaza…' : 'Asegurando tu precio…'}
          </span>
        ) : (
          isEsperar ? `RESERVAR POR ${eur(total)}` : `BLOQUEAR POR ${eur(total)}`
        )}
      </button>

      <p className="mt-3 flex items-start justify-center gap-1.5 px-2 text-center text-[11.5px] leading-snug text-neutral-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
        {isEsperar ? 'Se retendrá este importe. Si el gropo no alcanza tu precio, se libera sin cargo.' : 'No realizaremos ningún cargo hoy. Solo pagas si el grupo se completa.'}
      </p>
    </div>
  );
}

const FIELD = 'w-full h-11 px-3 rounded-xl border border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand';

function Grab() {
  return <div className="mx-auto mb-3 mt-2 h-1.5 w-10 rounded-full bg-neutral-200 sm:hidden" />;
}
