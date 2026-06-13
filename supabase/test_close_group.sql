-- ============================================================
-- KUORUM · TEST de close_group — 3 casos, todo en ROLLBACK
-- Pegar y ejecutar en: Supabase → SQL Editor
--
-- ⚠️ NO PERSISTE NADA: el bloque está envuelto en BEGIN … ROLLBACK.
--    Crea datos aislados (usuarios/grupos/bids/miembros temporales),
--    ejecuta close_group, valida con ASSERT, y revierte todo al final.
--    Si cualquier ASSERT falla, la transacción aborta y el ROLLBACK
--    deja la base intacta igualmente.
--
-- ⚠️ REQUISITO: plpgsql.check_asserts debe estar ON (es el default).
--    Verifícalo con:  SHOW plpgsql.check_asserts;   → debe decir 'on'.
--
-- ⚠️ POSIBLE FALLO ESPERADO: si la tabla events tiene la columna 'type'
--    como NOT NULL sin default, la primera llamada a close_group fallará
--    con "null value in column type" — porque close_group inserta solo
--    (group_id, payload). Si eso ocurre, hay que añadir 'type' a los
--    INSERT INTO events de close_group. Este test lo detecta en CASO 1.
--
-- Precios de prueba (price_mode = 'fluid', interpolación lineal):
--   tramos A: [ (1,50) (10,40) (20,30) ]
--     · N=7  → 50 + (7-1)/(10-1)*(40-50)  = 43.33
--     · N=15 → 40 + (15-10)/(20-10)*(30-40) = 35.00
--   tramos B (2ª puja, peor precio): [ (1,60) (20,45) ]
--     · N=15 → 60 + (15-1)/(20-1)*(45-60) = 48.95
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_seller uuid;
  v_b1 uuid; v_b2 uuid; v_b3 uuid; v_b4 uuid;
  v_g uuid;
  v_res jsonb;
  v_status text;
  v_cnt int;
BEGIN
  -- ── Usuarios de prueba (role 'seller' = enum válido garantizado) ──
  INSERT INTO users (email, name, role)
    VALUES ('test-seller@kuorum.test', 'TEST Seller', 'seller')
    RETURNING id INTO v_seller;
  INSERT INTO users (email, name, role, phone)
    VALUES ('test-b1@kuorum.test', 'TEST B1', 'seller', '600000001') RETURNING id INTO v_b1;
  INSERT INTO users (email, name, role, phone)
    VALUES ('test-b2@kuorum.test', 'TEST B2', 'seller', '600000002') RETURNING id INTO v_b2;
  INSERT INTO users (email, name, role, phone)
    VALUES ('test-b3@kuorum.test', 'TEST B3', 'seller', '600000003') RETURNING id INTO v_b3;
  INSERT INTO users (email, name, role, phone)
    VALUES ('test-b4@kuorum.test', 'TEST B4', 'seller', '600000004') RETURNING id INTO v_b4;


  -- ════════════════════════════════════════════════════════
  -- CASO 1 — CIERRE LIMPIO
  -- N=7, min_execution=5, max_stock=100 → todo dentro, liquida a 43.33
  -- ════════════════════════════════════════════════════════
  INSERT INTO groups (product_name, status, closes_at, current_price, total_units)
    VALUES ('TEST_clean', 'open', now() + interval '1 day', 50.00, 0)
    RETURNING id INTO v_g;

  INSERT INTO bids (group_id, seller_id, price_mode, tiers, min_execution, max_stock, status)
    VALUES (v_g, v_seller, 'fluid',
      '[{"min_units":1,"price":50.00},{"min_units":10,"price":40.00},{"min_units":20,"price":30.00}]',
      5, 100, 'active');

  INSERT INTO group_members (group_id, user_id, join_order, quantity, guaranteed_price, payment_status)
    VALUES (v_g, v_b1, 1, 3, 50.00, 'pending'),
           (v_g, v_b2, 2, 4, 50.00, 'pending');

  v_res := close_group(v_g);
  RAISE NOTICE 'CASO 1 (limpio) → %', v_res;

  ASSERT v_res->>'result' = 'closed',
    'CASO 1: result esperado closed, obtenido ' || COALESCE(v_res->>'result','NULL');
  ASSERT (v_res->>'settlement_price')::numeric = 43.33,
    'CASO 1: precio esperado 43.33, obtenido ' || COALESCE(v_res->>'settlement_price','NULL');
  ASSERT (v_res->>'total_units')::int = 7,
    'CASO 1: N esperado 7, obtenido ' || COALESCE(v_res->>'total_units','NULL');

  SELECT status INTO v_status FROM groups WHERE id = v_g;
  ASSERT v_status = 'closed', 'CASO 1: estado grupo esperado closed, obtenido ' || v_status;

  SELECT count(*) INTO v_cnt FROM group_members
    WHERE group_id = v_g AND payment_status = 'instructed' AND final_price = 43.33;
  ASSERT v_cnt = 2, 'CASO 1: esperados 2 miembros instructed@43.33, obtenidos ' || v_cnt;

  -- guaranteed_price NO debe haberse tocado
  SELECT count(*) INTO v_cnt FROM group_members
    WHERE group_id = v_g AND guaranteed_price = 50.00;
  ASSERT v_cnt = 2, 'CASO 1: guaranteed_price no debe cambiar (esperados 2 con 50.00), obtenidos ' || v_cnt;


  -- ════════════════════════════════════════════════════════
  -- CASO 2 — NO EJECUCIÓN
  -- N=5 < min_execution=10 → grupo cancelled, nadie instructed
  -- ════════════════════════════════════════════════════════
  INSERT INTO groups (product_name, status, closes_at, current_price, total_units)
    VALUES ('TEST_no_exec', 'open', now() + interval '1 day', 50.00, 0)
    RETURNING id INTO v_g;

  INSERT INTO bids (group_id, seller_id, price_mode, tiers, min_execution, max_stock, status)
    VALUES (v_g, v_seller, 'fluid',
      '[{"min_units":1,"price":50.00},{"min_units":10,"price":40.00},{"min_units":20,"price":30.00}]',
      10, 100, 'active');

  INSERT INTO group_members (group_id, user_id, join_order, quantity, guaranteed_price, payment_status)
    VALUES (v_g, v_b1, 1, 2, 50.00, 'pending'),
           (v_g, v_b2, 2, 3, 50.00, 'pending');

  v_res := close_group(v_g);
  RAISE NOTICE 'CASO 2 (no_execution) → %', v_res;

  ASSERT v_res->>'result' = 'no_execution',
    'CASO 2: result esperado no_execution, obtenido ' || COALESCE(v_res->>'result','NULL');
  ASSERT (v_res->>'total_units')::int = 5,
    'CASO 2: N esperado 5, obtenido ' || COALESCE(v_res->>'total_units','NULL');
  ASSERT (v_res->>'min_required')::int = 10,
    'CASO 2: min_required esperado 10, obtenido ' || COALESCE(v_res->>'min_required','NULL');

  SELECT status INTO v_status FROM groups WHERE id = v_g;
  ASSERT v_status = 'cancelled', 'CASO 2: estado grupo esperado cancelled, obtenido ' || v_status;

  SELECT count(*) INTO v_cnt FROM group_members
    WHERE group_id = v_g AND payment_status = 'cancelled';
  ASSERT v_cnt = 2, 'CASO 2: esperados 2 miembros cancelled, obtenidos ' || v_cnt;

  SELECT count(*) INTO v_cnt FROM group_members
    WHERE group_id = v_g AND (payment_status = 'instructed' OR final_price IS NOT NULL);
  ASSERT v_cnt = 0, 'CASO 2: nadie debe quedar instructed ni con final_price, infractores: ' || v_cnt;


  -- ════════════════════════════════════════════════════════
  -- CASO 3 — EXCEDENTE
  -- N=15, max_stock=10, min_execution=5. Acumulado por join_order:
  --   m1 qty4 (cum4 ✓) · m2 qty5 (cum9 ✓) · m3 qty4 (cum13 ✗) · m4 qty2 (cum15 ✗)
  -- → adjudicadas 9, excedente 6. Liquida a 35.00. 2ª puja a 48.95.
  -- ════════════════════════════════════════════════════════
  INSERT INTO groups (product_name, status, closes_at, current_price, total_units)
    VALUES ('TEST_surplus', 'open', now() + interval '1 day', 50.00, 0)
    RETURNING id INTO v_g;

  -- Puja ganadora (tramos A), max_stock=10
  INSERT INTO bids (group_id, seller_id, price_mode, tiers, min_execution, max_stock, status)
    VALUES (v_g, v_seller, 'fluid',
      '[{"min_units":1,"price":50.00},{"min_units":10,"price":40.00},{"min_units":20,"price":30.00}]',
      5, 10, 'active');

  -- 2ª puja (tramos B, peor precio): para poblar second_bid_id / second_price_at_n
  INSERT INTO bids (group_id, seller_id, price_mode, tiers, min_execution, max_stock, status)
    VALUES (v_g, v_seller, 'fluid',
      '[{"min_units":1,"price":60.00},{"min_units":20,"price":45.00}]',
      5, 100, 'active');

  INSERT INTO group_members (group_id, user_id, join_order, quantity, guaranteed_price, payment_status)
    VALUES (v_g, v_b1, 1, 4, 50.00, 'pending'),
           (v_g, v_b2, 2, 5, 50.00, 'pending'),
           (v_g, v_b3, 3, 4, 50.00, 'pending'),
           (v_g, v_b4, 4, 2, 50.00, 'pending');

  v_res := close_group(v_g);
  RAISE NOTICE 'CASO 3 (surplus) → %', v_res;

  ASSERT v_res->>'result' = 'surplus',
    'CASO 3: result esperado surplus, obtenido ' || COALESCE(v_res->>'result','NULL');
  ASSERT (v_res->>'settlement_price')::numeric = 35.00,
    'CASO 3: precio esperado 35.00, obtenido ' || COALESCE(v_res->>'settlement_price','NULL');
  ASSERT (v_res->>'total_units')::int = 15,
    'CASO 3: N esperado 15, obtenido ' || COALESCE(v_res->>'total_units','NULL');
  ASSERT (v_res->>'adjudicated_units')::int = 9,
    'CASO 3: adjudicadas esperadas 9, obtenidas ' || COALESCE(v_res->>'adjudicated_units','NULL');
  ASSERT (v_res->>'surplus_units')::int = 6,
    'CASO 3: excedente esperado 6, obtenido ' || COALESCE(v_res->>'surplus_units','NULL');
  ASSERT (v_res->>'second_price_at_n')::numeric = 48.95,
    'CASO 3: 2º precio esperado 48.95, obtenido ' || COALESCE(v_res->>'second_price_at_n','NULL');

  -- Grupo permanece en 'closing' hasta resolución manual del excedente
  SELECT status INTO v_status FROM groups WHERE id = v_g;
  ASSERT v_status = 'closing', 'CASO 3: estado grupo esperado closing, obtenido ' || v_status;

  -- m1, m2 (join_order 1,2) → instructed @ 35.00
  SELECT count(*) INTO v_cnt FROM group_members
    WHERE group_id = v_g AND join_order IN (1,2)
      AND payment_status = 'instructed' AND final_price = 35.00;
  ASSERT v_cnt = 2, 'CASO 3: esperados 2 adjudicados instructed@35.00, obtenidos ' || v_cnt;

  -- m3, m4 (join_order 3,4) → siguen pending, sin final_price
  SELECT count(*) INTO v_cnt FROM group_members
    WHERE group_id = v_g AND join_order IN (3,4)
      AND payment_status = 'pending' AND final_price IS NULL;
  ASSERT v_cnt = 2, 'CASO 3: esperados 2 en excedente pending sin final_price, obtenidos ' || v_cnt;


  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '✅ LOS 3 CASOS PASARON';
  RAISE NOTICE '════════════════════════════════════════';
END $$;

ROLLBACK;
