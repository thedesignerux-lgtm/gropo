'use client';

// src/components/checkout/CheckoutProvider.tsx
// Gate A3 · Backbone del FastCheckoutModal ubicuo.
// Se monta UNA sola vez en el root layout. Cualquier vista (ficha, Mi Radar)
// dispara el modal con `useCheckout().open({...})` — modal agnóstico al contexto.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import FastCheckoutModal from './FastCheckoutModal';

export type CheckoutPayload = {
  groupId: string;
  productName: string;
  productSpec?: string | null;
  imageUrl?: string | null;
  quantity: number;
  /** Precio máximo garantizado por unidad (techo — "nunca pagarás más"). */
  maxPricePerUnit: number;
};

type CheckoutContextValue = {
  open: (payload: CheckoutPayload) => void;
  close: () => void;
};

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

export function useCheckout(): CheckoutContextValue {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error('useCheckout debe usarse dentro de <CheckoutProvider>');
  return ctx;
}

export default function CheckoutProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [payload, setPayload] = useState<CheckoutPayload | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback((p: CheckoutPayload) => setPayload(p), []);
  const close = useCallback(() => setPayload(null), []);

  // Éxito: el sheet ya se ha "morfeado" a verde y bajado (lo gestiona el modal).
  // Aquí solo cerramos, refrescamos el estado del servidor (ficha/radar → verde)
  // y lanzamos un toast de confirmación.
  const handleSuccess = useCallback(() => {
    setPayload(null);
    setToast('¡Precio asegurado!');
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
    router.refresh();
  }, [router]);

  return (
    <CheckoutContext.Provider value={{ open, close }}>
      {children}
      {payload && <FastCheckoutModal payload={payload} onClose={close} onSuccess={handleSuccess} />}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg animate-[fadeIn_180ms_ease-out]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            {toast}
          </div>
        </div>
      )}
    </CheckoutContext.Provider>
  );
}
