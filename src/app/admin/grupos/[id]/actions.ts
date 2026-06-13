'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'

const PAYMENT_CYCLE: Record<string, string> = {
  pending:    'instructed',
  instructed: 'paid',
  paid:       'paid',
}

export interface CloseResult {
  result: string
  settlement_price?: number
  total_units?: number
  adjudicated_units?: number
  surplus_units?: number
  min_required?: number
  second_price_at_n?: number
}

export async function closeGroup(
  groupId: string,
): Promise<{ error?: string; data?: CloseResult }> {
  const { data, error } = await supabaseAdmin.rpc('close_group', { p_group_id: groupId })
  if (error) return { error: error.message }
  revalidatePath(`/admin/grupos/${groupId}`)
  revalidatePath('/admin')
  return { data: data as CloseResult }
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
