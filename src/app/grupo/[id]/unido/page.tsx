import { supabaseAdmin } from '@/lib/supabase-admin'
import PostCheckoutView, { type PostCheckoutGroup } from './PostCheckoutView'

export const dynamic = 'force-dynamic'

// Carga datos del grupo para la pantalla post-checkout.
// El precio viene de compute_price (única fuente de verdad).
async function fetchGroup(id: string): Promise<PostCheckoutGroup | null> {
  const { data: g, error } = await supabaseAdmin
    .from('groups')
    .select('id, product_name, product_spec, pvp, image_url, total_units, current_price, closes_at')
    .eq('id', id)
    .single()
  if (error || !g) return null

  // Precio real desde compute_price
  const { data: cp } = await supabaseAdmin.rpc('compute_price', { p_group_id: id })
  const row = (Array.isArray(cp) ? cp[0] : cp) as
    | { best_price?: number; next_price?: number }
    | null
  const currentPrice = row?.best_price != null ? Number(row.best_price) : Number(g.current_price)
  const nextPrice = row?.next_price != null ? Number(row.next_price) : currentPrice

  return {
    id: g.id as string,
    product_name: g.product_name as string,
    product_spec: ((g as any).product_spec ?? '') as string,
    image_url: ((g as any).image_url as string | null) ?? null,
    current_price: currentPrice,
    total_units: Number(g.total_units ?? 0),
    closes_at: g.closes_at as string,
    pvp: Number((g as any).pvp ?? 0),
    next_price: nextPrice,
  }
}

export default async function UnidoPage({ params }: { params: { id: string } }) {
  const group = await fetchGroup(params.id)

  if (!group) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-base text-neutral-400">Grupo no encontrado</p>
      </div>
    )
  }

  return <PostCheckoutView group={group} />
}
