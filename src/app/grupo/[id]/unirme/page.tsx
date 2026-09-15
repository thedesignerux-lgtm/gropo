import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import JoinFlow, { type JoinGroup } from './JoinFlow'

export const dynamic = 'force-dynamic'

// Carga el gropo: tabla groups + compute_price (única fuente de verdad de precio)
// → best_bid_id → bids para los tramos y el stock. El precio por unidad reactivo
// lo calcula JoinFlow desde el quote; aquí solo se entregan los datos base.
async function fetchGropo(id: string): Promise<JoinGroup | null> {
  const { data: g, error } = await supabaseAdmin
    .from('groups')
    .select('id, product_name, product_spec, pvp, image_url, total_units, current_price, closes_at')
    .eq('id', id)
    .single()
  if (error || !g) return null

  const { data: cp } = await supabaseAdmin.rpc('compute_price', { p_group_id: id })
  const row = (Array.isArray(cp) ? cp[0] : cp) as
    | { best_price?: number; best_bid_id?: string }
    | null
  const currentPrice = row?.best_price != null ? Number(row.best_price) : Number(g.current_price)
  const bestBidId = row?.best_bid_id ?? null

  // Escalera FUSIONADA (D5): el flujo de unirse ve la misma curva pública que la ficha.
  //
  // P2-01b · `effective_demand` viaja con cada tramo. Antes se descartaba y el
  // checkout medía el progreso con `total_units`, un único número: la demanda al
  // precio de HOY. Pero "cuánto falta para 150 €" se responde con la demanda A
  // 150 €, que es otra y siempre mayor o igual. Cada tramo trae la suya.
  const { data: ladder } = await supabaseAdmin.rpc('tier_demand', { p_group_id: id })
  const tiers: { minUnits: number; price: number; demand: number }[] =
    (Array.isArray(ladder) ? ladder : []).map((t: any) => ({
      minUnits: Number(t.min_units),
      price: Number(t.price),
      demand: Number(t.effective_demand ?? 0),
    }))

  // P2-01 · Unidades que YA OCUPAN STOCK. No es `total_units`: ese campo es la
  // demanda EFECTIVA al precio actual (deja fuera a los esperadores que apuntan
  // más abajo) y encima no baja cuando alguien se libera. El servidor acepta o
  // rechaza con esta otra cifra, así que la ficha tiene que enseñar la misma.
  const { data: committed, error: committedError } = await supabaseAdmin.rpc(
    'group_committed_units',
    { p_group_id: id },
  )
  if (committedError) {
    // Si la RPC falla no podemos callarnos y enseñar un cero: eso diría que el
    // stock está entero. Volvemos al número viejo, que sobreestima pero es lo
    // más cercano que hay, y dejamos rastro en el log. No es un fallo de
    // dinero: `prepare_join` sigue siendo quien acepta o rechaza en servidor.
    console.error(
      '[unirme] group_committed_units falló, usando total_units:',
      committedError.message,
    )
  }
  const committedUnits = committedError
    ? Number(g.total_units ?? 0)
    : Number(committed ?? 0)

  let maxStock = 0
  let minExecution = 0
  let shippingIncluded = false
  if (bestBidId) {
    const { data: bid } = await supabaseAdmin
      .from('bids')
      .select('max_stock, min_execution, shipping_included')
      .eq('id', bestBidId)
      .single()
    if (bid) {
      maxStock = Number((bid as any).max_stock ?? 0)
      minExecution = Number((bid as any).min_execution ?? 0)
      // UX-03 · Antes el checkout decía "Entrega gratis" con un texto fijo.
      // Ahora sale de lo que declaró el vendedor al cargar sus tramos.
      shippingIncluded = Boolean((bid as any).shipping_included)
    }
  }

  return {
    id: g.id as string,
    product_name: g.product_name as string,
    product_spec: ((g as any).product_spec ?? '') as string,
    pvp: Number((g as any).pvp ?? 0),
    current_price: currentPrice,
    image_url: ((g as any).image_url as string | null) ?? null,
    committed_units: committedUnits,
    closes_at: g.closes_at as string,
    max_stock: maxStock,
    min_execution: minExecution,
    shipping_included: shippingIncluded,
    tiers,
  }
}

export default async function UnirmePage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { mode?: string; target?: string; qty?: string }
}) {
  const v = await fetchGropo(params.id)

  if (!v) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-base text-neutral-400">Gropo no encontrado</p>
      </div>
    )
  }

  // "Esperar a precio" mode: ?mode=esperar&target=37.00
  const joinMode = searchParams.mode === 'esperar' ? 'esperar' : 'comprar'
  const targetPrice = searchParams.target ? Number(searchParams.target) : undefined
  // Quantity from ficha: ?qty=4 (clamped to 1–10 in JoinFlow)
  const initialQuantity = searchParams.qty ? Math.max(1, Math.min(10, parseInt(searchParams.qty) || 1)) : 1

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto min-h-screen max-w-md bg-white pb-52 lg:max-w-lg">

        {/* ── CABECERA: marca + pago seguro 3D Secure ── */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-neutral-100 bg-white/95 px-4 backdrop-blur">
          <Link
            href={`/grupo/${v.id}`}
            aria-label="Volver al gropo"
            className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <img
            src="/logo.png"
            alt="Gropo"
            className="h-7 w-auto"
          />
          <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Pago seguro · 3D Secure
          </span>
        </header>

        <JoinFlow
          group={v}
          joinMode={joinMode}
          targetPrice={targetPrice}
          initialQuantity={initialQuantity}
        />
      </div>
    </div>
  )
}
