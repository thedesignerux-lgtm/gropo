-- ============================================================
-- GRUPETA · close_group + compute_price_at_n
-- Actualizado 2026-06-14
-- Ejecutar en: Supabase → SQL Editor
--
-- compute_price_at_n: precio de una puja a N unidades.
--   stepped → precio del tramo alcanzado.
--   fluid   → interpolación lineal entre el tramo inferior y el
--             superior (busca el tramo superior con min_units > N).
--
-- close_group: cierre del grupo (cron domingo 22:00 + botón manual).
--   - Lock FOR UPDATE + idempotencia (closed/cancelled/closing).
--   - N = suma de cantidades. Mejor puja a N (empate → más antigua).
--   - min_execution: si N < mínimo → cancelado.
--   - Precio único de liquidación = precio del ganador a N.
--   - Adjudicación por join_order hasta max_stock (no se parten pedidos).
--   - Excedente (regla 6): adjudicados 'instructed', resto 'pending';
--     registra 2ª puja para que el admin resuelva.
--   - Guarda final_price + winner_bid_id en groups y marca pujas
--     winner/outbid.
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_price_at_n(p_tiers jsonb, p_price_mode text, p_n integer)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  v_lo_units  INTEGER;
  v_lo_price  NUMERIC(10,2);
  v_hi_units  INTEGER;
  v_hi_price  NUMERIC(10,2);
BEGIN
  SELECT
    (elem->>'min_units')::INTEGER,
    (elem->>'price')::NUMERIC(10,2)
  INTO v_lo_units, v_lo_price
  FROM jsonb_array_elements(p_tiers) AS elem
  WHERE (elem->>'min_units')::INTEGER <= p_n
  ORDER BY (elem->>'min_units')::INTEGER DESC
  LIMIT 1;

  IF v_lo_units IS NULL THEN
    SELECT
      (elem->>'min_units')::INTEGER,
      (elem->>'price')::NUMERIC(10,2)
    INTO v_lo_units, v_lo_price
    FROM jsonb_array_elements(p_tiers) AS elem
    ORDER BY (elem->>'min_units')::INTEGER ASC
    LIMIT 1;
    RETURN v_lo_price;
  END IF;

  IF p_price_mode = 'stepped' THEN
    RETURN v_lo_price;
  END IF;

  SELECT
    (elem->>'min_units')::INTEGER,
    (elem->>'price')::NUMERIC(10,2)
  INTO v_hi_units, v_hi_price
  FROM jsonb_array_elements(p_tiers) AS elem
  WHERE (elem->>'min_units')::INTEGER > p_n
  ORDER BY (elem->>'min_units')::INTEGER ASC
  LIMIT 1;

  IF v_hi_units IS NULL THEN
    RETURN v_lo_price;
  END IF;

  RETURN ROUND(
    v_lo_price
    + (p_n - v_lo_units)::NUMERIC
      / (v_hi_units - v_lo_units)::NUMERIC
      * (v_hi_price - v_lo_price)::NUMERIC,
    2
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.close_group(p_group_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_group        RECORD;
  v_n            INTEGER;
  v_winning_bid  RECORD;
  v_second_bid   RECORD;
  v_settlement   NUMERIC(10,2);
  v_second_price NUMERIC(10,2);
  v_adj_units    INTEGER;
  v_surplus      INTEGER;
BEGIN
  SELECT * INTO v_group FROM groups WHERE id = p_group_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grupo % no encontrado', p_group_id;
  END IF;

  IF v_group.status IN ('closed', 'cancelled', 'closing') THEN
    RETURN jsonb_build_object('result', 'already_' || v_group.status);
  END IF;

  UPDATE groups SET status = 'closing' WHERE id = p_group_id;

  SELECT COALESCE(SUM(quantity), 0) INTO v_n
  FROM group_members WHERE group_id = p_group_id;

  SELECT b.*, compute_price_at_n(b.tiers, b.price_mode::text, v_n) AS price_at_n
  INTO v_winning_bid
  FROM bids b
  WHERE b.group_id = p_group_id AND b.status = 'active'
  ORDER BY compute_price_at_n(b.tiers, b.price_mode::text, v_n) ASC, b.created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    UPDATE groups SET status = 'cancelled' WHERE id = p_group_id;
    UPDATE group_members SET payment_status = 'cancelled' WHERE group_id = p_group_id;
    INSERT INTO events (group_id, type, payload) VALUES (
      p_group_id, 'group_closed',
      jsonb_build_object('type','group_closed','result','no_active_bids','total_units',v_n)
    );
    RETURN jsonb_build_object('result','no_active_bids','total_units',v_n);
  END IF;

  IF v_winning_bid IS NULL THEN
    RAISE EXCEPTION 'no hay puja activa para este grupo (%)', p_group_id;
  END IF;

  IF v_n < v_winning_bid.min_execution THEN
    UPDATE groups SET status = 'cancelled' WHERE id = p_group_id;
    UPDATE group_members SET payment_status = 'cancelled' WHERE group_id = p_group_id;
    INSERT INTO events (group_id, type, payload) VALUES (
      p_group_id, 'group_closed',
      jsonb_build_object('type','group_closed','result','no_execution',
        'total_units',v_n,'min_required',v_winning_bid.min_execution)
    );
    RETURN jsonb_build_object('result','no_execution','total_units',v_n,
      'min_required',v_winning_bid.min_execution);
  END IF;

  v_settlement := v_winning_bid.price_at_n;

  IF v_winning_bid.max_stock IS NULL THEN
    RAISE EXCEPTION 'La puja ganadora (%) no tiene max_stock definido', v_winning_bid.id;
  END IF;

  UPDATE group_members gm
  SET final_price = v_settlement, payment_status = 'instructed'
  FROM (
    SELECT id FROM (
      SELECT id,
        SUM(quantity) OVER (ORDER BY join_order ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_qty
      FROM group_members WHERE group_id = p_group_id
    ) sub
    WHERE sub.cum_qty <= v_winning_bid.max_stock
  ) adj
  WHERE gm.id = adj.id;

  SELECT COALESCE(SUM(quantity), 0) INTO v_adj_units
  FROM group_members
  WHERE group_id = p_group_id AND payment_status = 'instructed';

  v_surplus := v_n - v_adj_units;

  -- ── 9A. CIERRE LIMPIO ──
  IF v_surplus = 0 THEN
    UPDATE groups
    SET status = 'closed',
        current_price = v_settlement,
        final_price = v_settlement,
        winner_bid_id = v_winning_bid.id
    WHERE id = p_group_id;

    UPDATE bids SET status = 'winner'
    WHERE id = v_winning_bid.id;
    UPDATE bids SET status = 'outbid'
    WHERE group_id = p_group_id AND id <> v_winning_bid.id AND status = 'active';

    INSERT INTO events (group_id, type, payload) VALUES (
      p_group_id, 'group_closed',
      jsonb_build_object('type','group_closed','result','closed',
        'new_price',v_settlement,'total_units',v_n,'winner_bid_id',v_winning_bid.id)
    );
    RETURN jsonb_build_object('result','closed','settlement_price',v_settlement,
      'total_units',v_n,'winner_bid_id',v_winning_bid.id);
  END IF;

  -- ── 9B. EXCEDENTE ──
  SELECT b.*, compute_price_at_n(b.tiers, b.price_mode::text, v_n) AS price_at_n
  INTO v_second_bid
  FROM bids b
  WHERE b.group_id = p_group_id AND b.status = 'active' AND b.id <> v_winning_bid.id
  ORDER BY compute_price_at_n(b.tiers, b.price_mode::text, v_n) ASC, b.created_at ASC
  LIMIT 1;

  v_second_price := CASE WHEN FOUND THEN v_second_bid.price_at_n ELSE NULL END;

  UPDATE groups
  SET status = 'closing',
      current_price = v_settlement,
      final_price = v_settlement,
      winner_bid_id = v_winning_bid.id
  WHERE id = p_group_id;

  UPDATE bids SET status = 'winner' WHERE id = v_winning_bid.id;

  INSERT INTO events (group_id, type, payload) VALUES (
    p_group_id, 'group_closed',
    jsonb_build_object('type','group_closed','result','surplus',
      'new_price',v_settlement,'total_units',v_n,'adjudicated_units',v_adj_units,
      'surplus_units',v_surplus,'winner_bid_id',v_winning_bid.id,
      'second_bid_id',CASE WHEN FOUND THEN v_second_bid.id ELSE NULL END,
      'second_price_at_n',v_second_price)
  );
  RETURN jsonb_build_object('result','surplus','settlement_price',v_settlement,
    'total_units',v_n,'adjudicated_units',v_adj_units,'surplus_units',v_surplus,
    'winner_bid_id',v_winning_bid.id,
    'second_bid_id',CASE WHEN FOUND THEN v_second_bid.id ELSE NULL END,
    'second_price_at_n',v_second_price);

EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$function$;
