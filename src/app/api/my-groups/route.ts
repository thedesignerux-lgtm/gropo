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
  const { data: vondaUser } = await supabaseAdmin
    .from('users')
    .select('phone')
    .eq('email', user.email)
    .maybeSingle()

  if (!vondaUser?.phone) {
    // User authenticated but never purchased → no groups
    return NextResponse.json({ groups: [] })
  }

  // 3. Reuse existing SECURITY DEFINER RPC
  const { data, error } = await supabaseAdmin
    .rpc('get_my_groups', { p_phone: vondaUser.phone })

  if (error) {
    console.error('[api/my-groups]', error.message)
    return NextResponse.json({ groups: [] }, { status: 500 })
  }

  return NextResponse.json(data ?? { groups: [] })
}
