'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export async function toggleFavorite(
  groupId: string,
): Promise<{ favorited: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { favorited: false, error: 'not_authenticated' }

  const { data: existing } = await supabase
    .from('favorites')
    .select('auth_id')
    .eq('auth_id', user.id)
    .eq('group_id', groupId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('auth_id', user.id)
      .eq('group_id', groupId)
    if (error) return { favorited: true, error: error.message }
    revalidatePath('/favoritos')
    return { favorited: false }
  } else {
    const { error } = await supabase
      .from('favorites')
      .insert({ auth_id: user.id, group_id: groupId })
    if (error) return { favorited: false, error: error.message }
    revalidatePath('/favoritos')
    return { favorited: true }
  }
}

export async function getMyFavoriteIds(): Promise<string[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('favorites')
    .select('group_id')
    .eq('auth_id', user.id)

  return (data ?? []).map((f: any) => f.group_id)
}
