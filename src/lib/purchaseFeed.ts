/**
 * PURCHASE ACTIVITY FEED — la lógica de `/notificaciones`.
 *
 * DECISIÓN DE PRODUCTO (Benjamin, 14-sep-2026). Las dos pantallas responden a dos
 * preguntas distintas y no se solapan:
 *
 *   /mis-grupos     → ¿En qué compras estoy y cuál es su estado AHORA?
 *   /notificaciones → ¿Qué ha CAMBIADO en mis compras desde la última vez?
 *
 * Esto último es un feed cronológico de actividad de compra colectiva, no un buzón.
 * La regla de admisión es una sola: **si el evento no cambia nada en la compra del
 * usuario, no entra**. Nada de bienvenidas, cuenta, perfil, marketing, novedades de
 * producto, mensajes corporativos ni actividad de terceros que no le afecte.
 *
 * DE DÓNDE SALE CADA COSA. Cuatro de los seis tipos son eventos reales que la base
 * de datos ya guardaba en `events` desde el 29 de agosto; los otros dos son estado
 * vivo, que no deja rastro histórico y hay que derivar:
 *
 * | Tipo               | Origen                      | Histórico |
 * |--------------------|-----------------------------|-----------|
 * | Nuevo precio       | `price_dropped` + unidades  | sí        |
 * | El precio ha bajado| `price_dropped`             | sí        |
 * | Se han unido       | `member_joined` (agrupados) | sí        |
 * | Compra cerrada     | `group_closed`              | sí        |
 * | Cerca del tier     | tramos + demanda AHORA      | **no**    |
 * | Cierra pronto      | `closes_at` AHORA           | **no**    |
 *
 * Los dos derivados llevan `live: true` y se fechan en el momento de mirar, así que
 * encabezan el feed de forma natural: es lo único sobre lo que el comprador todavía
 * puede actuar.
 *
 * LÍMITE CONOCIDO: `get_my_groups` no devuelve cuándo se unió el usuario, así que el
 * feed incluye eventos del grupo anteriores a su entrada. Para un grupo que vive
 * menos de una semana la distorsión es pequeña; si algún día molesta, la salida es
 * añadir `joined_at` a esa RPC y filtrar aquí.
 */

export type FeedKind =
  | 'tier_unlocked'
  | 'price_drop'
  | 'members_joined'
  | 'near_tier'
  | 'closing_soon'
  | 'closed'
  | 'not_executed'

export interface FeedMembership {
  group_id: string
  product_name: string
  image_url: string | null
  status: string
  closes_at: string
  current_price: number | string
  guaranteed_price: number | string
  payment_status: string
}

export interface FeedEvent {
  id: string
  group_id: string
  type: string
  payload: Record<string, unknown> | null
  created_at: string
}

export interface FeedLadderRow {
  min_units: number
  price: number | string
  effective_demand: number
  unlocked: boolean
}

export interface FeedItem {
  id: string
  kind: FeedKind
  /** ISO. Los derivados usan el instante de la consulta. */
  at: string
  groupId: string
  productName: string
  imageUrl: string | null
  icon: string
  title: string
  body: string
  ctaLabel: string
  /** A dónde lleva: la gestión de la compra o la ficha del grupo. */
  href: string
  /** Estado vivo (no un hecho pasado): es sobre lo que aún se puede actuar. */
  live: boolean
}

const eur = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
const num = (v: unknown, def = 0): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

/** Ventana para agrupar entradas seguidas al mismo grupo en una sola línea. */
const JOIN_GROUPING_MS = 6 * 60 * 60 * 1000
/** Por debajo de esto, «estás cerca del siguiente precio». */
const NEAR_TIER_UNITS = 3
/** Por debajo de esto, «tu grupo cierra pronto». */
const CLOSING_SOON_MS = 24 * 60 * 60 * 1000

/** Dos eventos cuentan como el mismo hecho si caen en el mismo segundo. */
function mismoInstante(a: string, b: string): boolean {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 1000
}

export function buildPurchaseFeed(
  memberships: FeedMembership[],
  events: FeedEvent[],
  ladders: Record<string, FeedLadderRow[]>,
  now: Date = new Date(),
): FeedItem[] {
  const porGrupo = new Map<string, FeedMembership>()
  for (const m of memberships) porGrupo.set(m.group_id, m)

  const items: FeedItem[] = []
  const nowIso = now.toISOString()

  // ── 1. ESTADO VIVO ────────────────────────────────────────────────────────
  // Lo único sobre lo que el comprador todavía puede hacer algo.
  for (const m of memberships) {
    if (m.status !== 'open') continue
    // Una plaza liberada o cancelada ya no es «mi compra»: nada que empujar.
    if (!['authorized', 'instructed', 'paid'].includes(m.payment_status)) continue

    const ladder = ladders[m.group_id] ?? []
    const unidades = ladder.length ? Math.max(...ladder.map((t) => num(t.effective_demand))) : 0
    const siguiente = ladder
      .filter((t) => !t.unlocked && num(t.price) < num(m.current_price))
      .sort((a, b) => num(b.price) - num(a.price))[0]

    if (siguiente) {
      const faltan = Math.max(0, num(siguiente.min_units) - unidades)
      if (faltan > 0 && faltan <= NEAR_TIER_UNITS) {
        items.push({
          id: `near:${m.group_id}`,
          kind: 'near_tier',
          at: nowIso,
          groupId: m.group_id,
          productName: m.product_name,
          imageUrl: m.image_url,
          icon: '⚡',
          title: 'Estás cerca del siguiente precio',
          body: `${faltan === 1 ? 'Falta 1 unidad' : `Faltan ${faltan} unidades`} para alcanzar ${eur(num(siguiente.price))}.`,
          ctaLabel: 'Ver grupo',
          href: `/grupo/${m.group_id}`,
          live: true,
        })
      }
    }

    const quedaMs = new Date(m.closes_at).getTime() - now.getTime()
    if (quedaMs > 0 && quedaMs <= CLOSING_SOON_MS) {
      const horas = Math.floor(quedaMs / 3600000)
      const minutos = Math.floor((quedaMs % 3600000) / 60000)
      const cuanto =
        horas >= 1
          ? `${horas} ${horas === 1 ? 'hora' : 'horas'}`
          : `${Math.max(1, minutos)} ${minutos === 1 ? 'minuto' : 'minutos'}`
      items.push({
        id: `closing:${m.group_id}`,
        kind: 'closing_soon',
        at: nowIso,
        groupId: m.group_id,
        productName: m.product_name,
        imageUrl: m.image_url,
        icon: '⏰',
        title: 'Tu grupo cierra pronto',
        body: `Quedan ${cuanto} para que termine la compra colectiva.`,
        ctaLabel: 'Ver grupo',
        href: `/grupo/${m.group_id}`,
        live: true,
      })
    }
  }

  // ── 2. LO QUE YA HA PASADO ────────────────────────────────────────────────
  const relevantes = events
    .filter((e) => porGrupo.has(e.group_id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const joins = relevantes.filter((e) => e.type === 'member_joined')
  const usados = new Set<string>()

  for (const ev of relevantes) {
    const m = porGrupo.get(ev.group_id)!
    if (usados.has(ev.id)) continue
    const p = ev.payload ?? {}

    if (ev.type === 'price_dropped') {
      // Una bajada de precio ES un tramo desbloqueado. El evento no guarda las
      // unidades, pero el `member_joined` que la provocó se escribe en el MISMO
      // instante y sí las trae: emparejándolos se puede decir la frase completa.
      const gemelo = joins.find((j) => j.group_id === ev.group_id && mismoInstante(j.created_at, ev.created_at))
      const unidades = gemelo ? num((gemelo.payload ?? {}).total_units) : 0
      const nuevo = num(p.new_price)
      const viejo = num(p.old_price)
      if (gemelo) usados.add(gemelo.id)

      items.push(
        unidades > 0
          ? {
              id: ev.id,
              kind: 'tier_unlocked',
              at: ev.created_at,
              groupId: ev.group_id,
              productName: m.product_name,
              imageUrl: m.image_url,
              icon: '🎯',
              title: 'Nuevo precio desbloqueado',
              body: `El grupo ha alcanzado ${unidades} ${unidades === 1 ? 'unidad' : 'unidades'}. Ahora todos pagan ${eur(nuevo)}.`,
              ctaLabel: 'Ver compra',
              href: '/mis-grupos',
              live: false,
            }
          : {
              id: ev.id,
              kind: 'price_drop',
              at: ev.created_at,
              groupId: ev.group_id,
              productName: m.product_name,
              imageUrl: m.image_url,
              icon: '🟢',
              title: 'El precio ha bajado',
              body: viejo > 0 ? `${eur(viejo)} → ${eur(nuevo)}` : `Ahora ${eur(nuevo)}`,
              ctaLabel: 'Ver compra',
              href: '/mis-grupos',
              live: false,
            },
      )
      continue
    }

    if (ev.type === 'member_joined') {
      // Varias entradas seguidas al mismo grupo son UNA noticia, no cinco.
      const ventana = joins.filter(
        (j) =>
          j.group_id === ev.group_id &&
          !usados.has(j.id) &&
          Math.abs(new Date(j.created_at).getTime() - new Date(ev.created_at).getTime()) <= JOIN_GROUPING_MS,
      )
      for (const j of ventana) usados.add(j.id)

      const cuantos = ventana.length
      const unidades = Math.max(...ventana.map((j) => num((j.payload ?? {}).total_units)))
      items.push({
        id: ev.id,
        kind: 'members_joined',
        at: ev.created_at,
        groupId: ev.group_id,
        productName: m.product_name,
        imageUrl: m.image_url,
        icon: '👥',
        title: cuantos === 1 ? 'Se ha unido un comprador' : `${cuantos} compradores se han unido`,
        body: unidades > 0 ? `El grupo ya suma ${unidades} ${unidades === 1 ? 'unidad' : 'unidades'}.` : 'El grupo sigue creciendo.',
        ctaLabel: 'Ver grupo',
        href: `/grupo/${ev.group_id}`,
        live: false,
      })
      continue
    }

    if (ev.type === 'group_closed') {
      const ejecutado = String(p.result ?? '') === 'closed'
      const precio = num(p.new_price)
      const unidades = num(p.total_units)
      items.push(
        ejecutado
          ? {
              id: ev.id,
              kind: 'closed',
              at: ev.created_at,
              groupId: ev.group_id,
              productName: m.product_name,
              imageUrl: m.image_url,
              icon: '✅',
              title: 'Compra colectiva cerrada',
              body: precio > 0
                ? `El grupo se ha cerrado con ${unidades} ${unidades === 1 ? 'unidad' : 'unidades'}. Precio final: ${eur(precio)}.`
                : 'El grupo se ha cerrado correctamente.',
              ctaLabel: 'Ver compra',
              href: '/mis-grupos',
              live: false,
            }
          : {
              // El grupo no salió adelante. Es el cambio MÁS relevante que puede
              // tener una compra, y hasta hoy no se comunicaba en ninguna parte.
              //
              // NO se afirma la causa. En producción hay cierres con
              // `result: 'no_active_bids'` y otros con solo `{reason:
              // 'manual_cleanup'}` —una limpieza del admin— sin `result` ninguno.
              // Decir «no se alcanzó el volumen mínimo» sería inventarse el motivo,
              // que es exactamente el error de A-18. Lo que sí se puede afirmar
              // siempre, y es lo que al comprador le importa, es que no se le ha
              // cobrado nada.
              id: ev.id,
              kind: 'not_executed',
              at: ev.created_at,
              groupId: ev.group_id,
              productName: m.product_name,
              imageUrl: m.image_url,
              icon: '⚪',
              title: 'El grupo se ha cerrado sin ejecutarse',
              body: 'No llegó a completarse la compra colectiva. Tu retención se ha anulado y no se ha hecho ningún cargo.',
              ctaLabel: 'Ver compra',
              href: '/mis-grupos',
              live: false,
            },
      )
      continue
    }

    // Todo lo demás —`bid_placed`, `bid_improved`— es actividad de vendedores: no
    // cambia la compra del usuario y además revelaría la competencia entre pujas,
    // que el comprador nunca debe ver (INV-17).
  }

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

/** Cuántos items son posteriores a la última visita. Para el contador. */
export function countUnseen(items: FeedItem[], lastSeenIso: string | null): number {
  if (!lastSeenIso) return items.filter((i) => !i.live).length
  const t = new Date(lastSeenIso).getTime()
  return items.filter((i) => !i.live && new Date(i.at).getTime() > t).length
}
