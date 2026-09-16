// Email 08 del sistema de comunicaciones del comprador — "Nuevas oportunidades
// de compra", sección N de la spec. Pensado para correr una vez al día (ver
// vercel.json); esta ruta se auto-limita a sábado y domingo (hora de Madrid) y
// no hace nada el resto de la semana, para que un cron diario sea seguro.
//
// Criterio conservador de "oportunidad relevante" (spec Sección N, decisión
// pendiente #2 resuelta como "criterio inicial, puede evolucionar"):
//   · el usuario tiene el grupo en FAVORITOS, o lo originó como PETICIÓN;
//   · el grupo sigue abierto y su precio actual YA mejora el PVP original
//     (es decir, la compra colectiva ya ha conseguido algo concreto);
//   · el usuario NO tiene ya una participación viva en ese grupo (si ya
//     compró, no es una "oportunidad", es su pedido — eso lo cubren los
//     otros emails).
// Máximo 1 email por usuario y fin de semana: `weekend_opportunity_log`.
//
// SEGUNDO BLOQUE (añadido tras el primer despliegue, no es uno de los 8 emails
// de la especificación original): recordatorio para quien YA es miembro del
// grupo en join_mode='esperar' y cuyo target_price todavía NO se ha alcanzado,
// pero el grupo ya superó el PVP. Es puramente informativo — no ofrece
// "aceptar el precio actual", porque esa acción no existe como funcionalidad
// (ver cabecera de `targetPending.ts`). Dedup vía `buyer_communications`
// (type='target_price_pending', event_key=weekendKey) porque, a diferencia del
// bloque de arriba, aquí el destinatario SÍ tiene member_id.
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendWeekendOpportunities, sendTargetPending } from '@/lib/resend'
import { tryRecordCommunication, markEmailSent } from '@/lib/buyerComms'
import { SITE_URL } from '@/lib/site'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function madridDateStr(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

function madridWeekday(d: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', weekday: 'short' }).format(d)
}

/** Fecha (Madrid) del sábado de ESTE fin de semana, o null si hoy no es fin de semana. */
function currentWeekendKey(now: Date): string | null {
  const wd = madridWeekday(now)
  if (wd === 'Sat') return madridDateStr(now)
  if (wd === 'Sun') return madridDateStr(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  return null
}

interface Opportunity {
  groupId: string
  productName: string
  currentPrice: number
  pvp: number
  closesAt: string
}

export async function GET(req: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== expected) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const now = new Date()
  const weekendKey = currentWeekendKey(now)
  if (!weekendKey) {
    return NextResponse.json({ skipped: 'no es fin de semana (hora de Madrid)' })
  }

  // 1. Grupos con oportunidad real: abiertos, con PVP conocido y precio actual
  //    ya por debajo del PVP.
  const { data: openGroups, error: groupsErr } = await supabaseAdmin
    .from('groups')
    .select('id, product_name, current_price, pvp, closes_at')
    .eq('status', 'open')
    .not('pvp', 'is', null)
    .gt('closes_at', now.toISOString())
  if (groupsErr) {
    console.error('[cron/weekend] error leyendo grupos:', groupsErr.message)
    return NextResponse.json({ error: groupsErr.message }, { status: 500 })
  }

  const oportunidadPorGrupo = new Map<string, Opportunity>()
  for (const g of openGroups ?? []) {
    const pvp = Number(g.pvp)
    const price = Number(g.current_price)
    if (Number.isFinite(pvp) && Number.isFinite(price) && price < pvp) {
      oportunidadPorGrupo.set(g.id, {
        groupId: g.id, productName: g.product_name, currentPrice: price, pvp, closesAt: g.closes_at,
      })
    }
  }
  if (oportunidadPorGrupo.size === 0) {
    return NextResponse.json({ sent: 0, skipped: 'sin oportunidades esta semana' })
  }
  const opportunityGroupIds = Array.from(oportunidadPorGrupo.keys())

  // 2. Candidatos por FAVORITOS.
  const { data: favRows } = await supabaseAdmin
    .from('favorites')
    .select('auth_id, group_id')
    .in('group_id', opportunityGroupIds)

  // 3. Candidatos por PETICIÓN (el propio grupo nació de su petición).
  const { data: petitionEvents } = await supabaseAdmin
    .from('events')
    .select('group_id, payload')
    .eq('type', 'petition_created')
    .in('group_id', opportunityGroupIds)

  // 4. Resolver auth_id / user_id → fila de `users` (nombre, email, id).
  const authIds = Array.from(new Set((favRows ?? []).map(r => r.auth_id).filter(Boolean)))
  const petitionUserIds = Array.from(new Set(
    (petitionEvents ?? []).map(e => (e.payload as any)?.user_id).filter(Boolean),
  ))

  const usersByAuthId = new Map<string, { id: string; name: string | null; email: string }>()
  if (authIds.length > 0) {
    const { data } = await supabaseAdmin.from('users').select('id, auth_id, name, email').in('auth_id', authIds)
    for (const u of data ?? []) if (u.auth_id) usersByAuthId.set(u.auth_id, u)
  }
  const usersById = new Map<string, { id: string; name: string | null; email: string }>()
  if (petitionUserIds.length > 0) {
    const { data } = await supabaseAdmin.from('users').select('id, name, email').in('id', petitionUserIds)
    for (const u of data ?? []) usersById.set(u.id, u)
  }

  // 5. Candidatos: user_id → Set<group_id oportunidad>.
  const candidatos = new Map<string, Set<string>>()
  for (const r of favRows ?? []) {
    const u = usersByAuthId.get(r.auth_id)
    if (!u) continue
    if (!candidatos.has(u.id)) candidatos.set(u.id, new Set())
    candidatos.get(u.id)!.add(r.group_id)
  }
  for (const e of petitionEvents ?? []) {
    const uid = (e.payload as any)?.user_id
    const u = uid ? usersById.get(uid) : undefined
    if (!u) continue
    if (!candidatos.has(u.id)) candidatos.set(u.id, new Set())
    candidatos.get(u.id)!.add(e.group_id)
  }
  // Nota: NO se corta la ejecución aquí aunque no haya candidatos por
  // favoritos/petición — el bloque 7 (miembros 'esperar' pendientes) es
  // independiente de este y debe poder ejecutarse igualmente.

  // 6. Excluir grupos donde el usuario YA tiene una participación viva (no es
  //    una "oportunidad" para quien ya compró).
  const allUserIds = Array.from(candidatos.keys())
  const { data: liveMembers } = allUserIds.length > 0
    ? await supabaseAdmin
        .from('group_members')
        .select('user_id, group_id')
        .in('user_id', allUserIds)
        .in('group_id', opportunityGroupIds)
        .in('payment_status', ['authorized', 'instructed', 'paid'])
    : { data: [] as { user_id: string; group_id: string }[] }
  const yaParticipa = new Set((liveMembers ?? []).map(m => `${m.user_id}:${m.group_id}`))

  const userInfo = new Map(
    Array.from(usersByAuthId.values()).concat(Array.from(usersById.values())).map(u => [u.id, u] as const),
  )

  let sent = 0
  let skippedDedup = 0
  let attempted = 0

  for (const [userId, groupIds] of Array.from(candidatos.entries())) {
    const u = userInfo.get(userId)
    if (!u?.email) continue

    const opportunities = Array.from(groupIds)
      .filter(gid => !yaParticipa.has(`${userId}:${gid}`))
      .map(gid => oportunidadPorGrupo.get(gid))
      .filter((o): o is Opportunity => o != null)
      .slice(0, 3)
    if (opportunities.length === 0) continue

    attempted++

    // Dedup: máximo 1 por usuario y fin de semana.
    const { data: inserted, error: dedupErr } = await supabaseAdmin
      .from('weekend_opportunity_log')
      .upsert({ user_id: userId, weekend_key: weekendKey }, { onConflict: 'user_id,weekend_key', ignoreDuplicates: true })
      .select('id')
    if (dedupErr) {
      console.error('[cron/weekend] dedup falló para', userId, dedupErr.message)
      continue
    }
    if (!inserted || inserted.length === 0) { skippedDedup++; continue }

    try {
      const { error } = await sendWeekendOpportunities({
        to: u.email,
        nombre: u.name ?? undefined,
        opportunities: opportunities.map(o => ({
          productName: o.productName,
          currentPrice: o.currentPrice,
          pvp: o.pvp,
          closesAt: o.closesAt,
          groupUrl: `${SITE_URL}/grupo/${o.groupId}`,
        })),
      })
      if (error) console.error('[cron/weekend] email falló para', u.email, error)
      else sent++
    } catch (e: any) {
      console.error('[cron/weekend] email excepción para', u.email, e?.message)
    }
  }

  // 7. Segundo bloque: miembros 'esperar' de ESTOS MISMOS grupos-oportunidad
  //    cuyo target_price todavía no llega al precio ya conseguido. Reutiliza
  //    `oportunidadPorGrupo` — ya filtrado a grupos abiertos con descuento real
  //    sobre el PVP — para no repetir la consulta a `groups`.
  let pendingAttempted = 0
  let pendingSent = 0
  let pendingSkippedDedup = 0

  const { data: pendingMembers, error: pendingErr } = await supabaseAdmin
    .from('group_members')
    .select('id, group_id, target_price, users(name, email)')
    .eq('join_mode', 'esperar')
    .in('group_id', opportunityGroupIds)
    .in('payment_status', ['authorized', 'instructed', 'paid'])
  if (pendingErr) {
    console.error('[cron/weekend] error leyendo miembros esperar:', pendingErr.message)
  }

  for (const m of pendingMembers ?? []) {
    const opp = oportunidadPorGrupo.get(m.group_id)
    if (!opp) continue
    const target = m.target_price != null ? Number(m.target_price) : null
    // Sin target (dato corrupto) o target ya alcanzado: no es "pendiente", lo
    // cubre selected_price_reached, no este recordatorio.
    if (target == null || target >= opp.currentPrice) continue

    const u = m.users as any
    if (!u?.email) continue

    pendingAttempted++

    const rec = await tryRecordCommunication({
      memberId: m.id,
      type: 'target_price_pending',
      eventKey: weekendKey,
      payload: { current_price: opp.currentPrice, pvp: opp.pvp, target_price: target },
    })
    if (!rec.isNew) { pendingSkippedDedup++; continue }

    try {
      const { error } = await sendTargetPending({
        to: u.email,
        nombre: u.name ?? undefined,
        productName: opp.productName,
        targetPrice: target,
        currentPrice: opp.currentPrice,
        pvp: opp.pvp,
        closesAt: opp.closesAt,
        groupUrl: `${SITE_URL}/grupo/${m.group_id}`,
      })
      if (error) console.error('[cron/weekend] email target_pending falló para', u.email, error)
      else { pendingSent++; await markEmailSent(rec.id) }
    } catch (e: any) {
      console.error('[cron/weekend] email target_pending excepción para', u.email, e?.message)
    }
  }

  return NextResponse.json({
    weekendKey,
    opportunities: { candidates: candidatos.size, attempted, sent, skippedDedup },
    targetPending: { attempted: pendingAttempted, sent: pendingSent, skippedDedup: pendingSkippedDedup },
  })
}
