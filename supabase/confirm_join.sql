-- supabase/confirm_join.sql
-- Definicion VIVA sincronizada desde produccion (pg_get_functiondef) el 22 jun 2026.
-- 11 args (join_mode/target_price). Idempotente por stripe_payment_intent_id.
-- Dedupe por telefono OR email + red de seguridad unique_violation. Inserta como authorized.
-- NO editar a mano: si cambia en prod, re-extraer.
-- Permisos: BLINDADA a service_role (el webhook la invoca server-side).
-- anon/authenticated NO deben ejecutarla (inserta miembros sin pasar por el hold).
CREATE OR REPLACE FUNCTION public.confirm_join(p_payment_intent_id text, p_group_id uuid, p_name text, p_email text, p_phone text, p_quantity integer, p_authorized_amount numeric, p_guaranteed_price numeric, p_shipping jsonb, p_join_mode text DEFAULT 'comprar'::text, p_target_price numeric DEFAULT NULL::numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
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
BEGIN
  -- IDEMPOTENCIA: mismo PaymentIntent -> no duplicar miembro.
  IF EXISTS (SELECT 1 FROM group_members WHERE stripe_payment_intent_id = p_payment_intent_id) THEN
    RETURN json_build_object('status', 'already_processed');
  END IF;
  v_phone := regexp_replace(p_phone, '[\s\-\.]', '', 'g');
  v_phone := regexp_replace(v_phone, '^\+34', '');
  -- RE-VALIDACION (carrera hold->confirm)
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = p_group_id AND status = 'open') THEN
    RETURN json_build_object('status', 'needs_release', 'reason', 'group_closed');
  END IF;
  -- duplicado por telefono O email (la identidad se resuelve por email)
  IF EXISTS (
    SELECT 1 FROM group_members gm JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = p_group_id
      AND (u.phone = v_phone OR u.email = p_email)
  ) THEN
    RETURN json_build_object('status', 'needs_release', 'reason', 'duplicate');
  END IF;
  SELECT best_bid_id INTO v_bid_id FROM compute_price(p_group_id);
  IF v_bid_id IS NULL THEN
    RETURN json_build_object('status', 'needs_release', 'reason', 'no_bid');
  END IF;
  SELECT max_stock INTO v_max_stock FROM bids WHERE id = v_bid_id;
  SELECT COALESCE(total_units, 0) INTO v_current_total FROM groups WHERE id = p_group_id;
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
    UPDATE groups SET total_units = total_units + p_quantity WHERE id = p_group_id;
    SELECT best_price, next_price INTO v_new_price, v_next_price FROM compute_price(p_group_id);
    UPDATE groups SET current_price = v_new_price, next_price = v_next_price WHERE id = p_group_id;
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
      RETURN json_build_object('status', 'needs_release', 'reason', 'duplicate');
  END;
  RETURN json_build_object(
    'status', 'confirmed',
    'new_total_units', v_new_total,
    'new_price', v_new_price
  );
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.confirm_join(text,uuid,text,text,text,integer,numeric,numeric,jsonb,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_join(text,uuid,text,text,text,integer,numeric,numeric,jsonb,text,numeric) TO service_role;
