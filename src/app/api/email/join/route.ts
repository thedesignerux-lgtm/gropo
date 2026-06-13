import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendJoinConfirmation } from '@/lib/resend'

// Endpoint público: lo llama JoinModal tras un join_group RPC exitoso.
// Best-effort: nunca debe afectar a la unión (el cliente no espera la respuesta).
// No confía en el cliente para el contenido — re-lee precio/producto en servidor
// y verifica que la persona realmente se unió antes de enviar nada.

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const groupId = body?.groupId as string | undefined
    const email = (body?.email as string | undefined)?.trim()

    if (!groupId || !email) {
      return NextResponse.json({ ok: false, error: 'groupId y email requeridos' }, { status: 400 })
    }

    // Contenido autoritativo desde la BD (no del cliente)
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('product_name, current_price, closes_at')
      .eq('id', groupId)
      .single()

    if (!group) {
      return NextResponse.json({ ok: false, skipped: 'grupo no encontrado' })
    }

    // Verificar que ese email es realmente miembro de este grupo
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, name')
      .eq('email', email)
      .single()

    if (!user) {
      return NextResponse.json({ ok: false, skipped: 'usuario no encontrado' })
    }

    const { data: member } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ ok: false, skipped: 'no es miembro del grupo' })
    }

    const { data, error } = await sendJoinConfirmation({
      to: email,
      nombre: user.name ?? undefined,
      productName: group.product_name,
      currentPrice: Number(group.current_price),
      closesAt: group.closes_at,
    })

    if (error) {
      return NextResponse.json({ ok: false, error }, { status: 502 })
    }
    return NextResponse.json({ ok: true, id: data?.id ?? null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
