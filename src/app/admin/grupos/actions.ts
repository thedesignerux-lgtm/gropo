'use server'

import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'

export interface Tier {
  min_units: number
  price: number
}

export interface CreateGroupInput {
  product_name: string
  product_spec: string
  product_url: string
  image_url: string
  closes_at: string
  price_mode: 'fluid' | 'stepped'
  min_execution: number
  max_stock: number
  tiers: Tier[]
}

export async function createGroup(input: CreateGroupInput): Promise<{ error?: string }> {
  const { product_name, product_spec, product_url, image_url, closes_at, price_mode, min_execution, max_stock, tiers } = input

  // Validations
  if (!product_name.trim()) return { error: 'El nombre del producto es obligatorio' }
  if (!closes_at) return { error: 'La fecha de cierre es obligatoria' }
  if (tiers.length < 1) return { error: 'Añade al menos un tramo de precio' }

  for (let i = 0; i < tiers.length; i++) {
    if (!Number.isFinite(tiers[i].min_units) || tiers[i].min_units < 1)
      return { error: `Tramo ${i + 1}: unidades mínimas deben ser ≥ 1` }
    if (!Number.isFinite(tiers[i].price) || tiers[i].price <= 0)
      return { error: `Tramo ${i + 1}: precio debe ser mayor que 0` }
    if (i > 0 && tiers[i].min_units <= tiers[i - 1].min_units)
      return { error: `Tramo ${i + 1}: min_units debe ser mayor que el tramo anterior` }
    if (i > 0 && tiers[i].price >= tiers[i - 1].price)
      return { error: `Tramo ${i + 1}: precio debe ser menor que el tramo anterior` }
  }

  // Insert group
  const initialPrice = tiers[0].price
  const { data: group, error: groupError } = await supabaseAdmin
    .from('groups')
    .insert({
      product_name: product_name.trim(),
      product_spec: product_spec.trim() || null,
      product_url: product_url.trim() || null,
      image_url: image_url.trim() || null,
      closes_at: new Date(closes_at).toISOString(),
      status: 'open',
      total_units: 0,
      current_price: initialPrice,
      next_price: tiers[1]?.price ?? null,
    })
    .select('id')
    .single()

  if (groupError || !group) return { error: groupError?.message ?? 'Error al crear el grupo' }

  // Insert bid
  const { error: bidError } = await supabaseAdmin
    .from('bids')
    .insert({
      group_id: group.id,
      price_mode,
      min_execution,
      max_stock,
      tiers,
      status: 'active',
    })

  if (bidError) {
    await supabaseAdmin.from('groups').delete().eq('id', group.id)
    return { error: bidError.message ?? 'Error al crear la puja' }
  }

  redirect(`/admin/grupos/${group.id}`)
}
