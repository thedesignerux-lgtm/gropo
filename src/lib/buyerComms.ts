// Sistema de comunicaciones del comprador — registro y deduplicación.
//
// Por qué existe: la especificación (spec Sección H) exige que cada comunicación
// se pueda identificar de forma única para no duplicarla ante reintentos de
// webhook, refresh, o procesamiento concurrente. `buyer_communications` (ver
// migración `comms_buyer_communications_table`) tiene un unique(member_id, type,
// event_key); este módulo es la única puerta de entrada a esa tabla desde Node,
// así que toda comunicación pasa por el mismo candado.
//
// Patrón de uso: llamar a `tryRecordCommunication` ANTES de enviar el email. Si
// `isNew` es false, la comunicación ya existía (evento repetido / reintento) y
// NO hay que reenviar nada. Si es true, enviar el email y luego `markEmailSent`.
import { supabaseAdmin } from '@/lib/supabase-admin'

export type CommunicationType =
  | 'participation_confirmed'
  | 'selected_price_reached'
  | 'group_closed_success'
  | 'group_closed_not_reached'
  | 'payment_authorization_failed'
  | 'shipment_confirmed'
  | 'shipment_updated'
  | 'target_price_pending'

export interface RecordResult {
  isNew: boolean
  id: string | null
}

/**
 * Intenta registrar una comunicación. Si ya existe (mismo member_id + type +
 * event_key), no hace nada y devuelve isNew=false — así el llamador sabe que NO
 * debe enviar el email de nuevo.
 *
 * `eventKey` solo hace falta para tipos repetibles (hoy: 'shipment_updated' y
 * 'target_price_pending', que se repite cada fin de semana mientras el precio
 * elegido siga sin alcanzarse); el
 * resto son "una vez por participación" y usan la cadena vacía por defecto.
 */
export async function tryRecordCommunication(params: {
  memberId: string
  type: CommunicationType
  eventKey?: string
  payload?: Record<string, unknown>
}): Promise<RecordResult> {
  const { memberId, type, eventKey = '', payload = {} } = params

  const { data, error } = await supabaseAdmin
    .from('buyer_communications')
    .upsert(
      { member_id: memberId, type, event_key: eventKey, payload },
      { onConflict: 'member_id,type,event_key', ignoreDuplicates: true },
    )
    .select('id')

  if (error) {
    // No-fatal a propósito: si esto falla, preferimos arriesgar un email
    // duplicado antes que dejar al comprador sin ningún aviso.
    console.error(`[buyerComms] no se pudo registrar ${type} (miembro ${memberId}):`, error.message)
    return { isNew: true, id: null }
  }

  if (data && data.length > 0) return { isNew: true, id: data[0].id }
  return { isNew: false, id: null }
}

export async function markEmailSent(id: string | null): Promise<void> {
  if (!id) return
  await supabaseAdmin
    .from('buyer_communications')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', id)
}
