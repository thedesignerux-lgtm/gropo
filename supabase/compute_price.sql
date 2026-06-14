-- ============================================================
-- GRUPETA · compute_price + fluid_price
-- Aplicado en Supabase el 2026-06-14
-- Ejecutar en: Supabase → SQL Editor
--
-- fluid_price: helper de interpolación lineal entre tramos.
--   Corrige el bug original donde fluid se comportaba como stepped
--   (el next_tier se buscaba solo entre tramos ya alcanzados).
--
-- compute_price: evalúa todas las pujas activas del grupo,
--   devuelve la más barata (best_price, best_bid_id) y el precio
--   si entrara 1 unidad más (next_price).
--   Desempate: a igual precio, gana la puja más antigua (regla 6).
-- ============================================================

CREATE OR REPLACE FUNCTION public.fluid_price(p_tiers jsonb, p_units int)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  WITH t AS (
    SELECT (tier->>'min_units')::int AS mu,
           (tier->>'price')::numeric AS pr
    FROM jsonb_array_elements(p_tiers) tier
  ),
  curr AS (SELECT mu, pr FROM t WHERE mu <= p_units ORDER BY mu DESC LIMIT 1),
  nxt  AS (SELECT mu, pr FROM t WHERE mu >  p_units ORDER BY mu ASC  LIMIT 1)
  SELECT CASE
           WHEN curr.mu IS NULL THEN NULL
           WHEN nxt.mu  IS NULL THEN curr.pr
           ELSE curr.pr - ((curr.pr - nxt.pr) / (nxt.mu - curr.mu)) * (p_units - curr.mu)
         END
  FROM curr FULL OUTER JOIN nxt ON true;
$$;

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
      CASE b.price_mode::text
        WHEN 'stepped' THEN (
          SELECT (t->>'price')::numeric
          FROM jsonb_array_elements(b.tiers) t
          WHERE (t->>'min_units')::int <= v_units
          ORDER BY (t->>'min_units')::int DESC
          LIMIT 1
        )
        ELSE public.fluid_price(b.tiers, v_units)
      END AS p_now,
      CASE b.price_mode::text
        WHEN 'stepped' THEN (
          SELECT (t->>'price')::numeric
          FROM jsonb_array_elements(b.tiers) t
          WHERE (t->>'min_units')::int <= v_units + 1
          ORDER BY (t->>'min_units')::int DESC
          LIMIT 1
        )
        ELSE public.fluid_price(b.tiers, v_units + 1)
      END AS p_next
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
