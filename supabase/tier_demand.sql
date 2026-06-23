CREATE OR REPLACE FUNCTION public.tier_demand(p_group_id uuid)
RETURNS TABLE(
  min_units int,
  price numeric,
  effective_demand bigint,
  unlocked boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_tiers jsonb;
BEGIN
  SELECT b.tiers INTO v_tiers
  FROM bids b
  WHERE b.group_id = p_group_id AND b.status = 'active'
  ORDER BY b.created_at ASC LIMIT 1;
  IF v_tiers IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH live AS (
    SELECT gm.join_mode, gm.target_price, gm.quantity
    FROM group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.payment_status IN ('authorized','instructed','paid')
  ),
  t AS (
    SELECT (elem->>'min_units')::int AS min_units,
           (elem->>'price')::numeric AS price
    FROM jsonb_array_elements(v_tiers) AS elem
  ),
  d AS (
    SELECT
      t.min_units,
      t.price,
      COALESCE((
        SELECT SUM(l.quantity) FROM live l
        WHERE l.join_mode = 'comprar' OR l.target_price >= t.price
      ), 0) AS effective_demand
    FROM t
  )
  SELECT
    d.min_units,
    d.price,
    d.effective_demand,
    d.effective_demand >= d.min_units AS unlocked
  FROM d
  ORDER BY d.price DESC;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.tier_demand(uuid)
  TO anon, authenticated, service_role;
