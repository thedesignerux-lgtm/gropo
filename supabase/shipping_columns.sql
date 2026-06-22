-- Columnas de envío en group_members (Sendcloud V0). Aplicado en prod 22 jun 2026.
-- Aditivo e idempotente.
ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS shipping_label_url     text,
  ADD COLUMN IF NOT EXISTS shipping_tracking_code text,
  ADD COLUMN IF NOT EXISTS shipping_carrier       text,
  ADD COLUMN IF NOT EXISTS shipping_parcel_id     text,
  ADD COLUMN IF NOT EXISTS shipping_status        text NOT NULL DEFAULT 'pending';
