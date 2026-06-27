import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const groupId = params.id

  const { data, error } = await supabaseAdmin
    .from('group_members')
    .select('join_mode, quantity, payment_status')
    .eq('group_id', groupId)
    .in('payment_status', ['authorized', 'instructed', 'paid'])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let firmUnits = 0
  let reserveUnits = 0
  for (const m of data ?? []) {
    if (m.join_mode === 'comprar') firmUnits += m.quantity
    else reserveUnits += m.quantity
  }

  // maxStock from the winning bid
  const { data: bid } = await supabaseAdmin
    .from('bids')
    .select('max_stock')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  return NextResponse.json({
    firmUnits,
    reserveUnits,
    maxStock: bid?.max_stock ?? 0,
  })
}
