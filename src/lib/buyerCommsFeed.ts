/**
 * Sistema de comunicaciones del comprador — puente entre `buyer_communications`
 * (por PARTICIPACIÓN, exacto) y el feed de `/notificaciones` (que hasta ahora
 * solo leía `events`, por GRUPO, aproximado).
 *
 * Por qué hace falta esto además de `purchaseFeed.ts`: un cierre con excedente
 * puede dejar a un miembro dentro y a otro fuera del MISMO grupo, y el `events`
 * de `group_closed` es uno solo para todos. `buyer_communications` sí distingue,
 * porque se escribe una fila por participación (`sendClose.ts`). Aquí NO se
 * reescribe `purchaseFeed.ts`: se generan piezas equivalentes y más precisas
 * para group_closed_success/not_reached, y piezas nuevas para lo que antes no
 * existía (precio elegido alcanzado, retención fallida, envío confirmado).
 */
import type { FeedItem, FeedKind } from './purchaseFeed'

export interface MyNotificationRow {
  id: string
  type: string
  payload: Record<string, unknown> | null
  created_at: string
  shown_at: string | null
  seen_at: string | null
  actioned_at: string | null
  member_id: string
  group_id: string
  quantity: number
  payment_status: string
  product_name: string
  image_url: string | null
}

const eur = (n: unknown): string => {
  const v = Number(n)
  if (!Number.isFinite(v)) return ''
  return (v % 1 === 0 ? String(v) : v.toFixed(2).replace('.', ',')) + ' €'
}

/**
 * Tipos de `buyer_communications` que ya tienen una versión más precisa que la
 * derivada de `events` en `purchaseFeed.ts`. Cuando existe una fila de este
 * tipo para un grupo, la versión aproximada (`closed`/`not_executed`) de ESE
 * grupo se descarta a favor de esta.
 */
export const PRECISE_CLOSE_TYPES = new Set(['group_closed_success', 'group_closed_not_reached'])

export function buildCommsFeedItems(rows: MyNotificationRow[]): FeedItem[] {
  const items: FeedItem[] = []

  for (const r of rows) {
    const p = r.payload ?? {}
    const base = {
      id: `bc:${r.id}`,
      at: r.created_at,
      groupId: r.group_id,
      productName: r.product_name,
      imageUrl: r.image_url,
      live: false as const,
    }

    switch (r.type) {
      case 'participation_confirmed':
        items.push({
          ...base,
          kind: 'participation_confirmed' as FeedKind,
          icon: '✅',
          title: 'Ya estás dentro del grupo',
          body: `${r.quantity} ${r.quantity === 1 ? 'unidad' : 'unidades'}. Te avisaremos de cualquier cambio.`,
          ctaLabel: 'Ver mi grupo',
          href: `/grupo/${r.group_id}`,
        })
        break

      case 'selected_price_reached':
        items.push({
          ...base,
          kind: 'price_reached' as FeedKind,
          icon: '🎯',
          title: 'El precio que elegiste ya se ha alcanzado',
          body: `El grupo está en ${eur(p.new_price)}.`,
          ctaLabel: 'Ver mi grupo',
          href: `/grupo/${r.group_id}`,
        })
        break

      case 'group_closed_success':
        items.push({
          ...base,
          kind: 'closed_success' as FeedKind,
          icon: '✅',
          title: 'Grupo cerrado · compra confirmada',
          body: 'Tu compra continúa. Consulta el estado de tu pedido.',
          ctaLabel: 'Ver mi pedido',
          href: '/mis-grupos',
        })
        break

      case 'group_closed_not_reached':
        items.push({
          ...base,
          kind: 'closed_not_reached' as FeedKind,
          icon: '⚪',
          title: 'Grupo cerrado · precio no alcanzado',
          body: 'No hemos alcanzado el precio que elegiste. El importe será devuelto.',
          ctaLabel: 'Ver detalle',
          href: '/mis-grupos',
        })
        break

      case 'payment_authorization_failed':
        items.push({
          ...base,
          kind: 'auth_failed' as FeedKind,
          icon: '⚠️',
          title: 'No hemos podido completar tu compra',
          body: 'La retención del importe ha fallado. Por el momento, estás fuera del grupo.',
          ctaLabel: 'Volver a intentarlo',
          href: `/grupo/${r.group_id}`,
        })
        break

      case 'shipment_confirmed':
        items.push({
          ...base,
          kind: 'shipment_confirmed' as FeedKind,
          icon: '📦',
          title: 'Tu pedido está en camino',
          body: 'Ya tenemos código de seguimiento.',
          ctaLabel: 'Seguir mi pedido',
          href: '/mis-grupos',
        })
        break

      default:
        // Tipos futuros (shipment_updated, etc.) no se pintan hasta que se
        // defina su copy — mejor omitir que mostrar algo genérico y confuso.
        break
    }
  }

  return items
}

/** Grupos con una comunicación de cierre PRECISA (por participación). */
export function groupsWithPreciseClose(rows: MyNotificationRow[]): Set<string> {
  return new Set(rows.filter((r) => PRECISE_CLOSE_TYPES.has(r.type)).map((r) => r.group_id))
}
