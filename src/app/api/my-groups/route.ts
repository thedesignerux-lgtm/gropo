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

  const authEmail = user.email

  // 2. Look up phone by email in users table
  const { data: gropoUser } = await supabaseAdmin
    .from('users')
    .select('phone, email')
    .eq('email', authEmail)
    .maybeSingle()

  let phone = gropoUser?.phone
  let userEmail = gropoUser?.email ?? authEmail

  // 3. Fallback: if no users record, search group_members by shipping_phone
  //    via the users table linked through user_id
  if (!phone) {
    // Try to find a group_member whose user record matches this auth email
    const { data: member } = await supabaseAdmin
      .from('group_members')
      .select('user_id, shipping_phone')
      .order('created_at', { ascending: false })
      .limit(50)

    if (member && member.length > 0) {
      // Check if any member's user_id links to a user with this email
      for (const m of member) {
        if (m.user_id) {
          const { data: u } = await supabaseAdmin
            .from('users')
            .select('phone, email')
            .eq('id', m.user_id)
            .maybeSingle()
          if (u && u.email === authEmail) {
            phone = u.phone
            userEmail = u.email
            break
          }
        }
      }
    }
  }

  if (!phone) {
    return NextResponse.json({ groups: [] })
  }

  // 4. Call get_my_groups with BOTH required params: p_phone + p_email
  const { data, error } = await supabaseAdmin
    .rpc('get_my_groups', { p_phone: phone, p_email: userEmail })

  if (error) {
    console.error('[api/my-groups]', error.message)
    return NextResponse.json({ groups: [] }, { status: 500 })
  }

  return NextResponse.json(data ?? { groups: [] })
}
