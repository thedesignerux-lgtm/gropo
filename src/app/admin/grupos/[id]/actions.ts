'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'

const PAYMENT_CYCLE: Record<string, string> = {
  pending:    'instructed',
  instructed: 'paid',
  paid:       'paid',
}

export async function updatePaymentStatus(memberId: string, groupId: string) {
  const { data: member } = await supabaseAdmin
    .from('group_members')
    .select('payment_status')
    .eq('id', memberId)
    .single()

  if (!member) return

  const next = PAYMENT_CYCLE[member.payment_status] ?? 'paid'
  if (next === member.payment_status) return

  await supabaseAdmin
    .from('group_members')
    .update({ payment_status: next })
    .eq('id', memberId)

  revalidatePath(`/admin/grupos/${groupId}`)
}
