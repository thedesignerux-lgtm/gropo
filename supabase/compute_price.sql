-- ============================================================
-- GRUPETA · compute_price
-- Actualizado 2026-06-14 (unificado con compute_price_at_n)
--
-- compute_price evalúa todas las pujas activas del grupo a N
-- unidades (total_units + p_extra_units), delega el cálculo de
-- precio en compute_price_at_n (ÚNICA fuente de verdad, usada
-- también por close_group), y devuelve la puja más barata.
-- Desempate: a igual precio, gana la más antigua (regla 6).
-- La interpolación fluida y el redondeo a 2 decimales viven
-- en compute_price_at_n (ver close_group.sql).
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_price(p_group_id uuid, p_extra_units integer DEFAULT 0)
RETURNS TABLE(best_price numeric, best_bid_id uuid, next_price numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_units int;
BEGIN
  SELECT COALESCE(total_units, 0) + p_extra_units INTO v_units
  FROM groups WHERE id = p_group_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH bid_scores AS (
    SELECT
      b.id,
      b.created_at,
      compute_price_at_n(b.tiers, b.price_mode::text, v_units)     AS p_now,
      compute_price_at_n(b.tiers, b.price_mode::text, v_units + 1) AS p_next
    FROM bids b
    WHERE b.group_id = p_group_id
      AND b.status = 'active'
  )
  SELECT
    s.p_now,
    s.id,
    (SELECT MIN(p_next) FROM bid_scores WHERE p_next IS NOT NULL)
  FROM (
    SELECT * FROM bid_scores
    WHERE p_now IS NOT NULL
    ORDER BY p_now ASC, created_at ASC
    LIMIT 1
  ) s;
END;
$function$;
