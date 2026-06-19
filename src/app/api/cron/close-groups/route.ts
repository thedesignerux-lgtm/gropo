import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { closeGroup } from '@/app/admin/grupos/[id]/actions'
import { sendAdminAlert } from '@/lib/resend'

// Cron de cierre automático de grupos (Vercel Cron → solo GET).
//
// Idempotente: filtra status='open' AND closes_at<=now(), así que nunca recierra
// un grupo ya cerrado. Da igual si el botón manual lo cerró antes o si el cron se
// dispara dos veces seguidas.
//
// NO contiene lógica de cierre propia: invoca closeGroup() — el MISMO wrapper
// verificado que usa el botón del admin, que llama a la RPC close_group y, en los
// adjudicados, dispara los emails de pago. Auto-cierre = mismo efecto que el manual.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  // 1. SEGURIDAD primero: sin secreto válido, no se toca nada.
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== expected) {
    console.log('[cron/close-groups] 401 — Authorization inválida o ausente')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // 2 + 3. Grupos a cerrar: abiertos cuyo plazo ya venció.
  const { data: groups, error } = await supabaseAdmin
    .from('groups')
    .select('id, product_name')
    .eq('status', 'open')
    .lte('closes_at', new Date().toISOString())

  if (error) {
    console.error('[cron/close-groups] error al seleccionar grupos:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const checked = groups?.length ?? 0
  console.log(`[cron/close-groups] ${checked} grupo(s) vencido(s) para cerrar`)

  const closed: string[] = []
  const failed: { id: string; error: string }[] = []

  // 4. Cierre individual: un fallo NO aborta el lote.
  for (const group of groups ?? []) {
    try {
      const { error: closeError, data } = await closeGroup(group.id)
      if (closeError) throw new Error(closeError)
      closed.push(group.id)
      console.log(`[cron/close-groups] cerrado ${group.id} → ${data?.result ?? 'ok'}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      failed.push({ id: group.id, error: msg })
      console.error(`[cron/close-groups] FALLO al cerrar ${group.id}: ${msg}`)
    }
  }

  // 5. Si algo falló, avisa al admin (best-effort: no rompe la respuesta).
  if (failed.length > 0) {
    const detail = failed.map(f => `• ${f.id}: ${f.error}`).join('\n')
    try {
      await sendAdminAlert(
        `[Vonda] ${failed.length} grupo(s) fallaron al cerrar`,
        `El cron de cierre automático no pudo cerrar estos grupos:\n\n${detail}\n\n` +
          `Revisa los logs de Vercel y, si procede, ciérralos manualmente desde el panel.`,
      )
    } catch (e) {
      console.error('[cron/close-groups] no se pudo enviar la alerta al admin:', e)
    }
  }

  // 6. Resumen.
  const summary = { closed, failed, checked }
  console.log('[cron/close-groups] resumen:', JSON.stringify(summary))
  return NextResponse.json(summary)
}
