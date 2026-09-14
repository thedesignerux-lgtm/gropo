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

  const phone = gropoUser?.phone
  const userEmail = gropoUser?.email ?? authEmail   // A-17 · ya no se reasigna

  /**
   * A-17 · Aquí había un plan B que NO PODÍA FUNCIONAR, y que además costaba hasta
   * 51 consultas.
   *
   * Cargaba los **50 `group_members` más recientes de toda la plataforma** y recorría
   * uno a uno consultando su `users` para comparar el email. Dos problemas:
   *
   *  - **N+1**: 50 consultas secuenciales por cada visita que entrara por esa rama.
   *  - **Acotado a 50 GLOBALES**: con catálogo real, un comprador cuya compra no
   *    estuviera entre las 50 últimas de toda la plataforma no se encontraba nunca.
   *    Sin error y sin aviso: simplemente «no tienes pedidos».
   *
   * Y sobre todo: **era inalcanzable**. Se entra aquí solo si el paso 2 no encontró
   * teléfono, y eso pasa en dos casos, los dos sin salida por este camino:
   *
   *  1. Existe un `users` con ese email pero sin teléfono → el bucle acabaría
   *     encontrando **esa misma fila**, con el mismo teléfono vacío.
   *  2. No existe ningún `users` con ese email → el bucle compara emails de OTROS
   *     usuarios y no coincide jamás. (`users_email_key` es UNIQUE, INV-14: no puede
   *     haber una segunda fila con el mismo email.)
   *
   * Comprobado en producción: 39 usuarios sin teléfono y **ninguno con compras**.
   * `prepare_join` exige y normaliza el teléfono, así que todo el que compra lo tiene;
   * los que no lo tienen son cuentas creadas al iniciar sesión, sin pedidos que
   * enseñar. Devolver la lista vacía es la respuesta correcta.
   */
  if (!phone) {
    console.warn('[api/my-groups] sin teléfono para', authEmail, '— sin pedidos que devolver')
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
