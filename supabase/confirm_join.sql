-- supabase/confirm_join.sql
-- ESPEJO DEL CUERPO VIVO EN PRODUCCIÓN a 11-sep-2026.
-- Última modificación: migración `p001_one_membership_per_user_per_group`
-- (rama ★P0-01 en el manejador de excepciones).
-- Antes de tocar esta función, compara con producción:
--   SELECT pg_get_functiondef(oid) FROM pg_proc
--    WHERE proname='confirm_join' AND pronamespace='public'::regnamespace;
--
-- ⚠ La rama `uniq_member_per_group_alive` NO es opcional mientras exista ese
-- índice: sin ella la unique_violation cae en ELSE→RAISE, el webhook devuelve
-- 500 y el hold sobrante nunca se cancela.

CREATE OR REPLACE FUNCTION public.confirm_join(
  p_payment_intent_id text, p_group_id uuid, p_name text, p_email text,
  p_phone text, p_quantity integer, p_authorized_amount numeric,
  p_guaranteed_price numeric, p_shipping jsonb,
  p_join_mode text DEFAULT 'comprar'::text, p_target_price numeric DEFAULT NULL::numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_phone         text;
  v_user_id       uuid;
  v_join_order    int;
  v_old_price     numeric;
  v_new_price     numeric;
  v_next_price    numeric;
  v_new_total     int;
  v_bid_id        uuid;
  v_max_stock     int;
  v_current_total int;
  v_has_addresses boolean;
  v_shipping_line1 text;
  v_constraint    text;
BEGIN
  -- IDEMPOTENCIA: mismo PaymentIntent → no duplicar miembro.
  IF EXISTS (SELECT 1 FROM group_members WHERE stripe_payment_intent_id = p_payment_intent_id) THEN
    RETURN json_build_object('status', 'already_processed');
  END IF;

  v_phone := regexp_replace(p_phone, '[\s\-\.]', '', 'g');
  v_phone := regexp_replace(v_phone, '^\+34', '');

  -- RE-VALIDACIÓN (carrera hold→confirm) + candado de fila
  PERFORM 1 FROM groups WHERE id = p_group_id AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('status', 'needs_release', 'reason', 'group_closed');
  END IF;

  SELECT best_bid_id INTO v_bid_id FROM compute_price(p_group_id);
  IF v_bid_id IS NULL THEN
    RETURN json_build_object('status', 'needs_release', 'reason', 'no_bid');
  END IF;
  SELECT max_stock INTO v_max_stock FROM bids WHERE id = v_bid_id;

  SELECT COALESCE(SUM(quantity), 0) INTO v_current_total
  FROM group_members
  WHERE group_id = p_group_id
    AND payment_status IN ('authorized','instructed','paid');

  IF v_current_total + p_quantity > v_max_stock THEN
    RETURN json_build_object('status', 'needs_release', 'reason', 'out_of_stock');
  END IF;

  SELECT best_price INTO v_old_price FROM compute_price(p_group_id);

  BEGIN
    INSERT INTO users (email, phone, name, role)
    VALUES (p_email, v_phone, p_name, 'buyer')
    ON CONFLICT (email) DO UPDATE SET phone = v_phone, name = p_name
    RETURNING id INTO v_user_id;

    SELECT COALESCE(MAX(join_order), 0) + 1 INTO v_join_order
    FROM group_members WHERE group_id = p_group_id;

    INSERT INTO group_members (
      group_id, user_id, quantity, guaranteed_price, join_order, payment_status,
      stripe_payment_intent_id, authorized_amount,
      join_mode, target_price,
      shipping_name, shipping_phone, shipping_address_line1, shipping_address_line2,
      shipping_city, shipping_province, shipping_postal_code, shipping_country
    ) VALUES (
      p_group_id, v_user_id, p_quantity, p_guaranteed_price, v_join_order, 'authorized',
      p_payment_intent_id, p_authorized_amount,
      COALESCE(p_join_mode, 'comprar'), p_target_price,
      p_shipping->>'name', p_shipping->>'phone',
      p_shipping->>'line1', p_shipping->>'line2',
      p_shipping->>'city', p_shipping->>'province', p_shipping->>'postal_code',
      COALESCE(p_shipping->>'country', 'ES')
    );

    -- ── SYNC dirección de envío → user_addresses (perfil) ──
    v_shipping_line1 := nullif(trim(COALESCE(p_shipping->>'line1', '')), '');
    IF v_shipping_line1 IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM user_addresses
        WHERE user_id = v_user_id
          AND line1 = v_shipping_line1
          AND postal_code = nullif(trim(p_shipping->>'postal_code'), '')
      ) THEN
        SELECT count(*) = 0 INTO v_has_addresses
        FROM user_addresses WHERE user_id = v_user_id;

        INSERT INTO user_addresses (user_id, label, line1, line2, city, province, postal_code, country, is_default)
        VALUES (
          v_user_id,
          'Envío',
          v_shipping_line1,
          nullif(trim(p_shipping->>'line2'), ''),
          nullif(trim(p_shipping->>'city'), ''),
          nullif(trim(p_shipping->>'province'), ''),
          nullif(trim(p_shipping->>'postal_code'), ''),
          COALESCE(nullif(trim(p_shipping->>'country'), ''), 'España'),
          v_has_addresses
        );
      END IF;
    END IF;

    SELECT best_price, next_price INTO v_new_price, v_next_price FROM compute_price(p_group_id);
    UPDATE groups SET current_price = v_new_price, next_price = v_next_price WHERE id = p_group_id;
    UPDATE groups SET total_units = (
      SELECT COALESCE(SUM(gm.quantity), 0)
      FROM group_members gm
      WHERE gm.group_id = p_group_id
        AND gm.payment_status IN ('authorized','instructed','paid')
        AND (gm.join_mode = 'comprar' OR gm.target_price >= v_new_price)
    )
    WHERE id = p_group_id;
    SELECT total_units INTO v_new_total FROM groups WHERE id = p_group_id;

    INSERT INTO events (group_id, type, payload)
    VALUES (p_group_id, 'member_joined', jsonb_build_object(
      'name_inicial', left(p_name, 1), 'quantity', p_quantity,
      'new_price', v_new_price, 'total_units', v_new_total));

    IF v_new_price < v_old_price THEN
      INSERT INTO events (group_id, type, payload)
      VALUES (p_group_id, 'price_dropped', jsonb_build_object(
        'old_price', v_old_price, 'new_price', v_new_price));
    END IF;
  EXCEPTION
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint = 'uniq_group_members_pi' THEN
        -- Entrega concurrente del mismo PI: la membresía YA existe → no liberar jamás.
        RETURN json_build_object('status', 'already_processed');
      ELSIF v_constraint = 'uniq_member_per_group_alive' THEN
        -- ★P0-01 · Esta persona YA tiene una participación viva en este grupo.
        -- Regla MVP: 1 usuario + 1 grupo = 1 pedido. El hold sobrante se libera.
        RETURN json_build_object('status', 'needs_release', 'reason', 'already_member');
      ELSIF v_constraint = 'users_phone_key' THEN
        -- NOTA: este constraint NO existe en producción (P1-07). Rama muerta
        -- conservada a propósito: retirarla es cosmético y toca dinero.
        RETURN json_build_object('status', 'needs_release', 'reason', 'phone_in_use');
      ELSE
        RAISE;
      END IF;
  END;

  RETURN json_build_object(
    'status', 'confirmed',
    'new_total_units', v_new_total,
    'new_price', v_new_price
  );
END;
$function$;

-- Permisos (verificar SIEMPRE tras cualquier cambio).
-- Esperado: anon=false, authenticated=false, service_role=true.
