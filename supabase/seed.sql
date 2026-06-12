-- ============================================================
-- KUORUM · Seed inicial + políticas RLS de lectura pública
-- Pegar y ejecutar en: Supabase → SQL Editor
-- ============================================================


-- ── PARTE 1: RLS ─────────────────────────────────────────────
-- Activa RLS (idempotente: no falla si ya estaba activo)

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids   ENABLE ROW LEVEL SECURITY;

-- Borra las políticas si existen, para que el script sea re-ejecutable
DROP POLICY IF EXISTS "groups_public_read" ON public.groups;
DROP POLICY IF EXISTS "bids_public_read"   ON public.bids;

-- Visitante (anon) y usuario autenticado pueden leer grupos no cancelados
CREATE POLICY "groups_public_read"
  ON public.groups
  FOR SELECT
  TO anon, authenticated
  USING (status <> 'cancelled');

-- Visitante puede leer los bids de un grupo solo si ese grupo no está cancelado
CREATE POLICY "bids_public_read"
  ON public.bids
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.id = bids.group_id
        AND g.status <> 'cancelled'
    )
  );


-- ── PARTE 2: SEED ────────────────────────────────────────────
-- Calcula el próximo domingo 22:00 Europe/Madrid en tiempo de ejecución.
-- DATE_TRUNC('week', ...) = lunes de la semana actual → +6 días = domingo.
-- Si ya pasó ese domingo, suma 7 días más (CASE).

WITH closes AS (
  SELECT
    CASE
      WHEN (
        DATE_TRUNC('week', NOW() AT TIME ZONE 'Europe/Madrid')
        + INTERVAL '6 days 22 hours'
      ) AT TIME ZONE 'Europe/Madrid' > NOW()
      THEN (
        DATE_TRUNC('week', NOW() AT TIME ZONE 'Europe/Madrid')
        + INTERVAL '6 days 22 hours'
      ) AT TIME ZONE 'Europe/Madrid'
      ELSE (
        DATE_TRUNC('week', NOW() AT TIME ZONE 'Europe/Madrid')
        + INTERVAL '13 days 22 hours'
      ) AT TIME ZONE 'Europe/Madrid'
    END AS at
),

-- Inserta los 4 grupos y devuelve sus IDs para usarlos en bids
new_groups AS (
  INSERT INTO public.groups
    (product_name,                    product_spec,                status,   closes_at,              current_price, next_price, total_units)
  VALUES
    ('Cubierta Continental GP5000',   '700×25 · Carretera',        'open',   (SELECT at FROM closes),  41.90,         38.90,      14),
    ('Pedales Shimano 105 PD-R7000',  'Carretera · Calas incluidas','open',  (SELECT at FROM closes),  89.90,         79.00,      18),
    ('Casco Giro Agilis MIPS',        'Carretera · Ventilado',     'open',   (SELECT at FROM closes),  79.90,         69.00,      12),
    ('Luz trasera Garmin Varia RTL515','Radar · 65 lúmenes',       'open',   (SELECT at FROM closes), 159.90,        149.90,       7)
  RETURNING id, product_name
)

-- Inserta un bid por grupo con los tramos completos en JSONB
INSERT INTO public.bids (group_id, price_mode, tiers, min_execution, max_stock)
SELECT
  ng.id,
  t.price_mode,
  t.tiers::jsonb,
  t.min_execution,
  t.max_stock
FROM new_groups ng
JOIN (VALUES

  ( 'Cubierta Continental GP5000',
    'stepped',
    '[
      {"min_units":  1, "price": 48.90},
      {"min_units":  6, "price": 44.90},
      {"min_units": 10, "price": 41.90},
      {"min_units": 15, "price": 38.90},
      {"min_units": 20, "price": 36.50}
    ]',
    6,   -- min_execution: mínimo 6 uds para activar el grupo
    50   -- max_stock: capacidad máxima del proveedor
  ),

  ( 'Pedales Shimano 105 PD-R7000',
    'stepped',
    '[
      {"min_units":  1, "price": 104.90},
      {"min_units":  8, "price":  97.90},
      {"min_units": 15, "price":  89.90},
      {"min_units": 30, "price":  79.00}
    ]',
    8, 50
  ),

  ( 'Casco Giro Agilis MIPS',
    'stepped',
    '[
      {"min_units":  1, "price": 94.90},
      {"min_units":  6, "price": 86.90},
      {"min_units": 12, "price": 79.90},
      {"min_units": 20, "price": 69.00}
    ]',
    6, 40
  ),

  ( 'Luz trasera Garmin Varia RTL515',
    'stepped',
    '[
      {"min_units":  1, "price": 159.90},
      {"min_units":  8, "price": 149.90},
      {"min_units": 15, "price": 139.90}
    ]',
    8, 30
  )

) AS t(product_name, price_mode, tiers, min_execution, max_stock)
  ON ng.product_name = t.product_name;
