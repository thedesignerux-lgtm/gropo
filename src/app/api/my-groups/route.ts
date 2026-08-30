import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  // 1. Verify auth session from cookies
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ groups: [] }, { status: 401 })
  }

  // 2. Look up phone by email in users table
  const { data: gropoUser } = await supabaseAdmin
    .from('users')
    .select('phone')
    .eq('email', user.email)
    .maybeSingle()

  let phone = gropoUser?.phone

  // 3. Fallback: if no users record, search group_members by buyer_email
  //    This covers the "buy first, account later" flow where checkout
  //    happens without auth and no users record exists yet.
  if (!phone) {
    const { data: member } = await supabaseAdmin
      .from('group_members')
      .select('buyer_phone')
      .eq('buyer_email', user.email)
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (member?.buyer_phone) {
      phone = member.buyer_phone

      // Auto-create users record so future queries work directly
      const { error: upsertErr } = await supabaseAdmin
        .from('users')
        .upsert(
          { email: user.email, phone, name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? '' },
          { onConflict: 'email' }
        )
      if (upsertErr) {
        console.error('[api/my-groups] upsert users fallback:', upsertErr.message)
      }
    }
  }

  if (!phone) {
    // User authenticated but never purchased → no groups
    return NextResponse.json({ groups: [] })
  }

  // 4. Reuse existing SECURITY DEFINER RPC
  const { data, error } = await supabaseAdmin
    .rpc('get_my_groups', { p_phone: phone })

  if (error) {
    console.error('[api/my-groups]', error.message)
    return NextResponse.json({ groups: [] }, { status: 500 })
  }

  return NextResponse.json(data ?? { groups: [] })
}
