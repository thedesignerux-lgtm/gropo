// src/lib/shipping-sendcloud.ts
// Genera etiquetas de envío vía Sendcloud API v3 (síncrono).
// Espejo de stripe-capture.ts: idempotente, no-fatal, aísla errores por miembro.
// Disparo: botón admin manual "Generar etiquetas" (NO automático al cierre en V0).
import { supabaseAdmin } from '@/lib/supabase-admin';
const SENDCLOUD_BASE = 'https://panel.sendcloud.sc/api/v3';
const SHIPPING_OPTION_CODE =
  process.env.SENDCLOUD_SHIPPING_OPTION_CODE ?? 'sendcloud:letter';
// Peso/dimensiones V0 (ajustables vía env). GP5000 ~0,30 kg/ud + embalaje.
const UNIT_WEIGHT_KG = Number(process.env.SENDCLOUD_UNIT_WEIGHT_KG ?? '0.30');
const PACKAGING_WEIGHT_KG = Number(process.env.SENDCLOUD_PACKAGING_WEIGHT_KG ?? '0.30');
const BOX = { length: '30', width: '30', height: '20', unit: 'cm' };
// Remitente = distribuidor (placeholder hasta concretar; swap = editar .env.local).
function getFromAddress() {
  return {
    name: process.env.SENDCLOUD_FROM_NAME ?? 'Gropo Envios (test)',
    company_name: process.env.SENDCLOUD_FROM_COMPANY ?? 'Gropo',
    address_line_1: process.env.SENDCLOUD_FROM_ADDRESS_LINE1 ?? 'Carrer de Prova 1',
    house_number: process.env.SENDCLOUD_FROM_HOUSE_NUMBER ?? '1',
    postal_code: process.env.SENDCLOUD_FROM_POSTAL_CODE ?? '08001',
    city: process.env.SENDCLOUD_FROM_CITY ?? 'Barcelona',
    country_code: process.env.SENDCLOUD_FROM_COUNTRY ?? 'ES',
    phone_number: process.env.SENDCLOUD_FROM_PHONE ?? '+34600000000',
    email: process.env.SENDCLOUD_FROM_EMAIL ?? 'envios@gropo.es',
  };
}
function authHeader(): string {
  const pub = process.env.SENDCLOUD_PUBLIC_KEY;
  const sec = process.env.SENDCLOUD_SECRET_KEY;
  if (!pub || !sec) {
    throw new Error('Faltan SENDCLOUD_PUBLIC_KEY / SENDCLOUD_SECRET_KEY');
  }
  return `Basic ${Buffer.from(`${pub}:${sec}`).toString('base64')}`;
}
export type ShippingResult = {
  created: number;
  skipped: number;
  failed: Array<{ member_id: string; reason: string }>;
};
/**
 * Genera una etiqueta por cada miembro adjudicado (instructed/paid) del grupo
 * que aún no tenga parcel. Nunca lanza por un fallo individual: lo recoge en `failed`.
 */
export async function generateShippingLabels(groupId: string): Promise<ShippingResult> {
  const { data: members, error } = await supabaseAdmin
    .from('group_members')
    .select(
      'id, quantity, payment_status, shipping_parcel_id, ' +
      'shipping_name, shipping_phone, shipping_address_line1, shipping_address_line2, ' +
      'shipping_city, shipping_province, shipping_postal_code, shipping_country, ' +
      'users(email)'
    )
    .eq('group_id', groupId)
    .in('payment_status', ['instructed', 'paid']);
  if (error) throw new Error(`No se pudieron leer los miembros: ${error.message}`);
  const result: ShippingResult = { created: 0, skipped: 0, failed: [] };
  const fromAddress = getFromAddress();
  const carrier = SHIPPING_OPTION_CODE.split(':')[0];
  for (const m of (members ?? []) as any[]) {
    // Capa 1 de idempotencia: ya tiene parcel → saltar.
    if (m.shipping_parcel_id) { result.skipped++; continue; }
    if (!m.shipping_address_line1 || !m.shipping_postal_code || !m.shipping_city) {
      result.failed.push({ member_id: m.id, reason: 'direccion_incompleta' });
      await markFailed(m.id);
      continue;
    }
    const qty = m.quantity ?? 1;
    const weight = (UNIT_WEIGHT_KG * qty + PACKAGING_WEIGHT_KG).toFixed(3);
    const body = {
      apply_shipping_defaults: false,
      apply_shipping_rules: false,
      order_number: `gropo-${String(m.id).slice(0, 8)}`,
      external_reference_id: m.id, // Capa 2: idempotencia del lado Sendcloud.
      to_address: {
        name: m.shipping_name ?? '',
        address_line_1: m.shipping_address_line1,
        address_line_2: m.shipping_address_line2 || undefined,
        postal_code: m.shipping_postal_code,
        city: m.shipping_city,
        country_code: m.shipping_country ?? 'ES',
        phone_number: m.shipping_phone ?? undefined,
        email: m.users?.email ?? undefined,
      },
      from_address: fromAddress,
      ship_with: {
        type: 'shipping_option_code',
        properties: { shipping_option_code: SHIPPING_OPTION_CODE },
      },
      parcels: [
        {
          weight: { value: weight, unit: 'kg' },
          dimensions: { ...BOX },
        },
      ],
    };
    try {
      const res = await fetch(`${SENDCLOUD_BASE}/shipments/announce-with-shipping-rules`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        result.failed.push({ member_id: m.id, reason: `http_${res.status}: ${JSON.stringify(json?.errors ?? json)}` });
        await markFailed(m.id);
        continue;
      }
      // OJO v3: error de carrier llega con HTTP 200 dentro de data.errors.
      const data = json?.data;
      if (Array.isArray(data?.errors) && data.errors.length > 0) {
        result.failed.push({ member_id: m.id, reason: `carrier_error: ${JSON.stringify(data.errors)}` });
        await markFailed(m.id);
        continue;
      }
      const parcel = data?.parcels?.[0];
      const parcelId = parcel?.id != null ? String(parcel.id) : null;
      if (!parcelId) {
        result.failed.push({ member_id: m.id, reason: `sin_parcel_id: ${JSON.stringify(data)}` });
        await markFailed(m.id);
        continue;
      }
      const labelLink =
        (parcel.documents ?? []).find((d: any) => d.type === 'label')?.link ?? null;
      const { error: upErr } = await supabaseAdmin
        .from('group_members')
        .update({
          shipping_parcel_id: parcelId,
          shipping_tracking_code: parcel.tracking_number ?? null,
          shipping_label_url: labelLink,
          shipping_carrier: carrier,
          shipping_status: 'created',
        })
        .eq('id', m.id)
        .is('shipping_parcel_id', null); // no pisar si una ejecución concurrente ya lo puso
      if (upErr) {
        // Etiqueta creada en Sendcloud pero falló el guardado. external_reference_id
        // evita duplicar en el reintento (Sendcloud devuelve el mismo parcel).
        result.failed.push({ member_id: m.id, reason: `db_update_failed: ${upErr.message}` });
        continue;
      }
      result.created++;
    } catch (e: any) {
      result.failed.push({ member_id: m.id, reason: `excepcion: ${e?.message ?? String(e)}` });
      await markFailed(m.id);
    }
  }
  return result;
}
async function markFailed(memberId: string): Promise<void> {
  await supabaseAdmin
    .from('group_members')
    .update({ shipping_status: 'failed' })
    .eq('id', memberId)
    .is('shipping_parcel_id', null);
}
