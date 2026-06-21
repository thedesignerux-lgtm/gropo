-- supabase/close_group.sql
-- Definicion VIVA sincronizada desde produccion (pg_get_functiondef) el 22 jun 2026.
-- Cierre alineado con el motor: calcula el precio final llamando a compute_price.
-- NO editar a mano: si cambia en prod, re-extraer.
-- Permisos: BLINDADA a service_role (admin close + cron la invocan server-side).
-- anon/authenticated NO deben ejecutarla (captura pagos / adjudica / cancela).
CREATE OR REPLACE FUNCTION public.close_group(p_group_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_group          RECORD;
  v_winning_bid_id uuid;
  v_winning_bid    RECORD;
  v_settlement     NUMERIC(10,2);
  v_gross_units    INTEGER;
  v_buying_units   INTEGER;
  v_adj_units      INTEGER;
  v_surplus        INTEGER;
  v_second_bid     RECORD;
  v_has_second     BOOLEAN;
  v_second_price   NUMERIC(10,2);
BEGIN
  -- (1) Lock + idempotencia
  SELECT * INTO v_group FROM groups WHERE id = p_group_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grupo % no encontrado', p_group_id;
  END IF;
  IF v_group.status IN ('closed', 'cancelled', 'closing') THEN
    RETURN jsonb_build_object('result', 'already_' || v_group.status);
  END IF;
  -- (2) status = 'closing'
  UPDATE groups SET status = 'closing' WHERE id = p_group_id;
  -- (3) PRECIO FINAL via motor de demanda efectiva
  SELECT best_price, best_bid_id
  INTO v_settlement, v_winning_bid_id
  FROM compute_price(p_group_id);
  -- sin puja activa -> cancelar todo
  IF v_winning_bid_id IS NULL THEN
    UPDATE groups SET status = 'cancelled' WHERE id = p_group_id;
    UPDATE group_members SET payment_status = 'cancelled'
    WHERE group_id = p_group_id
      AND payment_status IN ('authorized','instructed','paid');
    INSERT INTO events (group_id, type, payload) VALUES (
      p_group_id, 'group_closed',
      jsonb_build_object('type','group_closed','result','no_active_bids',
        'total_units',(SELECT COALESCE(SUM(quantity),0) FROM group_members WHERE group_id = p_group_id))
    );
    RETURN jsonb_build_object('result','no_active_bids');
  END IF;
  -- cargar el resto de la puja ganadora
  SELECT * INTO v_winning_bid FROM bids WHERE id = v_winning_bid_id;
  IF v_winning_bid.max_stock IS NULL THEN
    RAISE EXCEPTION 'La puja ganadora (%) no tiene max_stock definido', v_winning_bid_id;
  END IF;
  -- bruto: TODOS los miembros vivos ANTES de liberar
  SELECT COALESCE(SUM(quantity), 0) INTO v_gross_units
  FROM group_members
  WHERE group_id = p_group_id
    AND payment_status IN ('authorized','instructed','paid');
  -- (4) LIQUIDACION POR PMA: liberar esperadores que NO cubren el precio
  --     AJUSTE 1: target_price NULL (dato corrupto) tambien libera, nunca cobrar.
  UPDATE group_members
  SET payment_status = 'cancelled'
  WHERE group_id = p_group_id
    AND payment_status IN ('authorized','instructed','paid')
    AND join_mode = 'esperar'
    AND (target_price IS NULL OR target_price < v_settlement);
  -- (5) MINIMO DE EJECUCION medido SOLO sobre los que COMPRAN
  SELECT COALESCE(SUM(quantity), 0) INTO v_buying_units
  FROM group_members
  WHERE group_id = p_group_id
    AND payment_status IN ('authorized','instructed','paid')
    AND (join_mode = 'comprar' OR target_price >= v_settlement);
  IF v_buying_units < v_winning_bid.min_execution THEN
    UPDATE groups SET status = 'cancelled' WHERE id = p_group_id;
    UPDATE group_members SET payment_status = 'cancelled'
    WHERE group_id = p_group_id
      AND payment_status IN ('authorized','instructed','paid');
    INSERT INTO events (group_id, type, payload) VALUES (
      p_group_id, 'group_closed',
      jsonb_build_object('type','group_closed','result','no_execution',
        'total_units', v_buying_units, 'gross_units', v_gross_units,
        'min_required', v_winning_bid.min_execution)
    );
    RETURN jsonb_build_object('result','no_execution','total_units',v_buying_units,
      'gross_units', v_gross_units, 'min_required', v_winning_bid.min_execution);
  END IF;
  -- (6) ADJUDICACION POR STOCK sobre el pool de COMPRADORES
  UPDATE group_members gm
  SET final_price = v_settlement, payment_status = 'instructed'
  FROM (
    SELECT id FROM (
      SELECT id,
        SUM(quantity) OVER (ORDER BY join_order ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_qty
      FROM group_members
      WHERE group_id = p_group_id
        AND payment_status IN ('authorized','instructed','paid')
        AND (join_mode = 'comprar' OR target_price >= v_settlement)
    ) sub
    WHERE sub.cum_qty <= v_winning_bid.max_stock
  ) adj
  WHERE gm.id = adj.id;
  -- (7) Excedente medido sobre COMPRADORES
  SELECT COALESCE(SUM(quantity), 0) INTO v_adj_units
  FROM group_members
  WHERE group_id = p_group_id AND payment_status = 'instructed';
  v_surplus := v_buying_units - v_adj_units;
  -- -- 9A. CIERRE LIMPIO --
  IF v_surplus = 0 THEN
    UPDATE groups
    SET status = 'closed',
        current_price = v_settlement,
        final_price = v_settlement,
        winner_bid_id = v_winning_bid_id
    WHERE id = p_group_id;
    UPDATE bids SET status = 'winner' WHERE id = v_winning_bid_id;
    UPDATE bids SET status = 'outbid'
    WHERE group_id = p_group_id AND id <> v_winning_bid_id AND status = 'active';
    INSERT INTO events (group_id, type, payload) VALUES (
      p_group_id, 'group_closed',
      jsonb_build_object('type','group_closed','result','closed',
        'new_price',v_settlement,'total_units',v_buying_units,'gross_units',v_gross_units,
        'winner_bid_id',v_winning_bid_id)
    );
    RETURN jsonb_build_object('result','closed','settlement_price',v_settlement,
      'total_units',v_buying_units,'gross_units',v_gross_units,'winner_bid_id',v_winning_bid_id);
  END IF;
  -- -- 9B. EXCEDENTE --
  SELECT b.* INTO v_second_bid
  FROM bids b
  WHERE b.group_id = p_group_id AND b.status = 'active' AND b.id <> v_winning_bid_id
  ORDER BY b.created_at ASC
  LIMIT 1;
  v_has_second   := FOUND;
  v_second_price := NULL;
  UPDATE groups
  SET status = 'closing',
      current_price = v_settlement,
      final_price = v_settlement,
      winner_bid_id = v_winning_bid_id
  WHERE id = p_group_id;
  UPDATE bids SET status = 'winner' WHERE id = v_winning_bid_id;
  INSERT INTO events (group_id, type, payload) VALUES (
    p_group_id, 'group_closed',
    jsonb_build_object('type','group_closed','result','surplus',
      'new_price',v_settlement,'total_units',v_buying_units,'gross_units',v_gross_units,
      'adjudicated_units',v_adj_units,'surplus_units',v_surplus,'winner_bid_id',v_winning_bid_id,
      'second_bid_id', CASE WHEN v_has_second THEN v_second_bid.id ELSE NULL END,
      'second_price_at_n', v_second_price)
  );
  RETURN jsonb_build_object('result','surplus','settlement_price',v_settlement,
    'total_units',v_buying_units,'gross_units',v_gross_units,
    'adjudicated_units',v_adj_units,'surplus_units',v_surplus,'winner_bid_id',v_winning_bid_id,
    'second_bid_id', CASE WHEN v_has_second THEN v_second_bid.id ELSE NULL END,
    'second_price_at_n', v_second_price);
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.close_group(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_group(uuid) TO service_role;
