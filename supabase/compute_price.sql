-- supabase/compute_price.sql
-- Definicion VIVA sincronizada desde produccion (pg_get_functiondef) el 22 jun 2026.
-- Motor de demanda efectiva por tier (PMA). NO editar a mano: si cambia en prod, re-extraer.
-- Permisos: INTENCIONADAMENTE abiertos. El front anon la llama para el precio en vivo
-- (SSR + componentes cliente). SECURITY DEFINER: solo devuelve 3 escalares, no expone
-- filas de group_members al llamante.
CREATE OR REPLACE FUNCTION public.compute_price(p_group_id uuid, p_extra_units integer DEFAULT 0)
 RETURNS TABLE(best_price numeric, best_bid_id uuid, next_price numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_bid_id uuid;
  v_tiers  jsonb;
  v_best   numeric;
  v_next   numeric;
BEGIN
  -- (1) UNICA puja activa del grupo. Sin puja -> cero filas (igual que hoy).
  SELECT b.id, b.tiers
  INTO v_bid_id, v_tiers
  FROM bids b
  WHERE b.group_id = p_group_id AND b.status = 'active'
  ORDER BY b.created_at ASC
  LIMIT 1;
  IF v_bid_id IS NULL THEN
    RETURN;
  END IF;
  -- (2-7) Demanda efectiva por tier y resolucion del precio.
  WITH live AS (
    -- Solo miembros VIVOS (dinero comprometido).
    SELECT gm.join_mode, gm.target_price, gm.quantity
    FROM group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.payment_status IN ('authorized', 'instructed', 'paid')
  ),
  tiers AS (
    -- (2) Desempaqueta los tramos del jsonb.
    SELECT (elem->>'min_units')::int     AS min_units,
           (elem->>'price')::numeric     AS price
    FROM jsonb_array_elements(v_tiers) AS elem
  ),
  tier_demand AS (
    -- (3) demanda(P) = compradores 'ahora' (todo P) + esperadores con target >= P.
    SELECT
      t.min_units,
      t.price,
      COALESCE((
        SELECT SUM(l.quantity)
        FROM live l
        WHERE l.join_mode = 'comprar' OR l.target_price >= t.price
      ), 0) AS base_demand
    FROM tiers t
  ),
  base_tier AS (
    -- (5 fallback) tier base = menor min_units (el precio mas caro).
    SELECT price FROM tiers ORDER BY min_units ASC LIMIT 1
  )
  SELECT
    -- (4-5) best_price = tier desbloqueado mas barato; si ninguno, el tier base.
    COALESCE(
      (SELECT MIN(td.price) FROM tier_demand td
        WHERE td.base_demand + p_extra_units >= td.min_units),
      (SELECT price FROM base_tier)
    ),
    -- (7) next_price = lo mismo, sumando 1 comprador 'ahora' mas.
    COALESCE(
      (SELECT MIN(td.price) FROM tier_demand td
        WHERE td.base_demand + p_extra_units + 1 >= td.min_units),
      (SELECT price FROM base_tier)
    )
  INTO v_best, v_next;
  -- (6) best_bid_id = la puja unica.
  RETURN QUERY SELECT v_best, v_bid_id, v_next;
END;
$function$
;
GRANT EXECUTE ON FUNCTION public.compute_price(uuid, integer) TO anon, authenticated, service_role;
