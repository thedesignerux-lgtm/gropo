-- ============================================================
-- KUORUM · close_group + compute_price_at_n
-- Pegar y ejecutar en: Supabase → SQL Editor
-- ============================================================


-- ── HELPER: precio de una puja a N unidades ──────────────────
-- stepped : escalón en que N >= min_units (el más alto aplicable)
-- fluid   : interpolación lineal entre el escalón inferior y superior
-- Si N está por debajo del primer tramo → precio del primer tramo
-- Si N supera el último tramo → precio del último tramo (sin extrapolación)

CREATE OR REPLACE FUNCTION compute_price_at_n(
  p_tiers      JSONB,
  p_price_mode TEXT,
  p_n          INTEGER
)
RETURNS NUMERIC(10,2)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_lo_units  INTEGER;
  v_lo_price  NUMERIC(10,2);
  v_hi_units  INTEGER;
  v_hi_price  NUMERIC(10,2);
BEGIN
  -- Tier inferior: el mayor min_units que no supera p_n
  SELECT
    (elem->>'min_units')::INTEGER,
    (elem->>'price')::NUMERIC(10,2)
  INTO v_lo_units, v_lo_price
  FROM jsonb_array_elements(p_tiers) AS elem
  WHERE (elem->>'min_units')::INTEGER <= p_n
  ORDER BY (elem->>'min_units')::INTEGER DESC
  LIMIT 1;

  -- p_n por debajo del primer tramo: devolver precio del primer tramo
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

  -- Fluid: tier superior (el menor min_units que supera p_n)
  SELECT
    (elem->>'min_units')::INTEGER,
    (elem->>'price')::NUMERIC(10,2)
  INTO v_hi_units, v_hi_price
  FROM jsonb_array_elements(p_tiers) AS elem
  WHERE (elem->>'min_units')::INTEGER > p_n
  ORDER BY (elem->>'min_units')::INTEGER ASC
  LIMIT 1;

  -- p_n >= último tramo: máximo descuento, sin extrapolar
  IF v_hi_units IS NULL THEN
    RETURN v_lo_price;
  END IF;

  -- Interpolación lineal: hi_price < lo_price (precio baja al subir unidades)
  RETURN ROUND(
    v_lo_price
    + (p_n - v_lo_units)::NUMERIC
      / (v_hi_units - v_lo_units)::NUMERIC
      * (v_hi_price - v_lo_price)::NUMERIC,
    2
  );
END;
$$;


-- ── FUNCIÓN PRINCIPAL ────────────────────────────────────────
CREATE OR REPLACE FUNCTION close_group(p_group_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  -- ── 1. LOCK — evita doble cierre concurrente ──────────────
  SELECT * INTO v_group FROM groups WHERE id = p_group_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grupo % no encontrado', p_group_id;
  END IF;

  -- ── 2. IDEMPOTENCIA ───────────────────────────────────────
  -- 'closing' incluido: un grupo que ya entró en el flujo de cierre
  -- (incluido excedente pendiente de resolución) NO debe re-adjudicarse,
  -- da igual si lo llama el botón o el cron.
  IF v_group.status IN ('closed', 'cancelled', 'closing') THEN
    RETURN jsonb_build_object('result', 'already_' || v_group.status);
  END IF;

  -- ── 3. MARCAR EN CURSO ────────────────────────────────────
  UPDATE groups SET status = 'closing' WHERE id = p_group_id;

  -- ── 4. N = suma de cantidades de todos los miembros ───────
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_n
  FROM group_members
  WHERE group_id = p_group_id;

  -- ── 5. MEJOR PUJA A N UNIDADES ────────────────────────────
  -- Orden: precio más bajo → si empate, puja más antigua
  SELECT b.*, compute_price_at_n(b.tiers, b.price_mode::text, v_n) AS price_at_n
  INTO v_winning_bid
  FROM bids b
  WHERE b.group_id = p_group_id
    AND b.status = 'active'
  ORDER BY compute_price_at_n(b.tiers, b.price_mode::text, v_n) ASC,
           b.created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    UPDATE groups SET status = 'cancelled' WHERE id = p_group_id;
    UPDATE group_members SET payment_status = 'cancelled' WHERE group_id = p_group_id;
    INSERT INTO events (group_id, type, payload) VALUES (
      p_group_id,
      'group_closed',
      jsonb_build_object('type','group_closed','result','no_active_bids','total_units',v_n)
    );
    RETURN jsonb_build_object('result','no_active_bids','total_units',v_n);
  END IF;

  -- Invariante: tras el guard NOT FOUND, v_winning_bid nunca debería ser NULL.
  -- Defensa explícita por si acaso, para no seguir con valores NULL.
  IF v_winning_bid IS NULL THEN
    RAISE EXCEPTION 'no hay puja activa para este grupo (%)', p_group_id;
  END IF;

  -- ── 6. MIN_EXECUTION: si N < mínimo el grupo no se ejecuta ─
  IF v_n < v_winning_bid.min_execution THEN
    UPDATE groups SET status = 'cancelled' WHERE id = p_group_id;
    UPDATE group_members SET payment_status = 'cancelled' WHERE group_id = p_group_id;
    INSERT INTO events (group_id, type, payload) VALUES (
      p_group_id,
      'group_closed',
      jsonb_build_object(
        'type','group_closed','result','no_execution',
        'total_units',v_n,'min_required',v_winning_bid.min_execution
      )
    );
    RETURN jsonb_build_object(
      'result','no_execution',
      'total_units',v_n,
      'min_required',v_winning_bid.min_execution
    );
  END IF;

  -- ── 7. PRECIO ÚNICO DE LIQUIDACIÓN ────────────────────────
  v_settlement := v_winning_bid.price_at_n;

  -- Defensa: max_stock NULL haría que 'cum_qty <= NULL' fuese siempre NULL
  -- y nadie quedaría adjudicado en silencio. Fallar ruidosamente.
  IF v_winning_bid.max_stock IS NULL THEN
    RAISE EXCEPTION 'La puja ganadora (%) no tiene max_stock definido', v_winning_bid.id;
  END IF;

  -- ── 8. ADJUDICACIÓN POR ACUMULADO DE CANTIDADES ───────────
  -- Se acumula quantity en orden de join_order.
  -- Un miembro entra completo o va al excedente: no se parten pedidos.
  -- Todos cuya cantidad acumulada <= max_stock quedan adjudicados.
  -- final_price = precio de liquidación del cierre.
  -- guaranteed_price NO se toca: es el precio del tramo 1 fijado en join_group.
  UPDATE group_members gm
  SET
    final_price    = v_settlement,
    payment_status = 'instructed'
  FROM (
    SELECT id
    FROM (
      SELECT
        id,
        SUM(quantity) OVER (
          ORDER BY join_order ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS cum_qty
      FROM group_members
      WHERE group_id = p_group_id
    ) sub
    WHERE sub.cum_qty <= v_winning_bid.max_stock
  ) adj
  WHERE gm.id = adj.id;

  -- Unidades realmente adjudicadas (puede ser < max_stock si el último
  -- miembro que cabe no puede partirse)
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_adj_units
  FROM group_members
  WHERE group_id = p_group_id
    AND payment_status = 'instructed';

  v_surplus := v_n - v_adj_units;

  -- ── 9A. CIERRE LIMPIO ─────────────────────────────────────
  IF v_surplus = 0 THEN
    UPDATE groups
    SET status = 'closed', current_price = v_settlement
    WHERE id = p_group_id;

    INSERT INTO events (group_id, type, payload) VALUES (
      p_group_id,
      'group_closed',
      jsonb_build_object(
        'type','group_closed','result','closed',
        'new_price',v_settlement,'total_units',v_n,
        'winner_bid_id',v_winning_bid.id
      )
    );
    RETURN jsonb_build_object(
      'result','closed',
      'settlement_price',v_settlement,
      'total_units',v_n,
      'winner_bid_id',v_winning_bid.id
    );
  END IF;

  -- ── 9B. EXCEDENTE ─────────────────────────────────────────
  -- Los primeros (por join_order) que suman <= max_stock → instruidos.
  -- Los demás mantienen payment_status='pending' y el admin resuelve.
  SELECT b.*, compute_price_at_n(b.tiers, b.price_mode::text, v_n) AS price_at_n
  INTO v_second_bid
  FROM bids b
  WHERE b.group_id = p_group_id
    AND b.status   = 'active'
    AND b.id      <> v_winning_bid.id
  ORDER BY compute_price_at_n(b.tiers, b.price_mode::text, v_n) ASC,
           b.created_at ASC
  LIMIT 1;

  v_second_price := CASE WHEN FOUND THEN v_second_bid.price_at_n ELSE NULL END;

  -- Grupo permanece 'closing' hasta que admin resuelva el excedente
  UPDATE groups
  SET status = 'closing', current_price = v_settlement
  WHERE id = p_group_id;

  INSERT INTO events (group_id, type, payload) VALUES (
    p_group_id,
    'group_closed',
    jsonb_build_object(
      'type','group_closed','result','surplus',
      'new_price',v_settlement,
      'total_units',v_n,
      'adjudicated_units',v_adj_units,
      'surplus_units',v_surplus,
      'winner_bid_id',v_winning_bid.id,
      'second_bid_id',CASE WHEN FOUND THEN v_second_bid.id ELSE NULL END,
      'second_price_at_n',v_second_price
    )
  );
  RETURN jsonb_build_object(
    'result','surplus',
    'settlement_price',v_settlement,
    'total_units',v_n,
    'adjudicated_units',v_adj_units,
    'surplus_units',v_surplus,
    'winner_bid_id',v_winning_bid.id,
    'second_bid_id',CASE WHEN FOUND THEN v_second_bid.id ELSE NULL END,
    'second_price_at_n',v_second_price
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;
