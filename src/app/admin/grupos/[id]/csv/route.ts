import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = cookies().get('admin_auth')?.value
  if (!process.env.ADMIN_SECRET || auth !== process.env.ADMIN_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('product_name, product_spec, current_price')
    .eq('id', params.id)
    .single()

  const { data: members } = await supabaseAdmin
    .from('group_members')
    .select('join_order, quantity, guaranteed_price, final_price, payment_status, users(name, email, phone)')
    .eq('group_id', params.id)
    .order('join_order')

  const rows: (string | number)[][] = [
    ['#', 'Nombre', 'Teléfono', 'Email', 'Cantidad', 'Precio final (€)', 'Total (€)', 'Estado pago'],
  ]

  for (const m of members ?? []) {
    const u = m.users as any
    // final_price (liquidación) si el grupo ya cerró; si no, guaranteed_price (precio de unión)
    const unitPrice = Number(m.final_price ?? m.guaranteed_price)
    rows.push([
      m.join_order ?? '',
      u?.name ?? '',
      u?.phone ?? '',
      u?.email ?? '',
      m.quantity,
      unitPrice.toFixed(2),
      (unitPrice * m.quantity).toFixed(2),
      m.payment_status ?? 'pending',
    ])
  }

  const csv = rows
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const slug = (group?.product_name ?? 'grupo').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const filename = `${slug}-${params.id.slice(0, 8)}.csv`

  return new NextResponse('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
