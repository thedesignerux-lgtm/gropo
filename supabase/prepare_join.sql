-- supabase/prepare_join.sql
-- ESPEJO DEL CUERPO VIVO EN PRODUCCIÓN a 11-sep-2026.
-- Última modificación: migración `p001_one_membership_per_user_per_group`
-- (bloque ★P0-01). Antes de tocar esta función, compara con producción:
--   SELECT pg_get_functiondef('public.prepare_join(uuid,text,integer)'::regprocedure);

CREATE OR REPLACE FUNCTION public.prepare_join(p_group_id uuid, p_phone text, p_quantity integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_phone            text;
  v_bid_id           uuid;
  v_guaranteed_price numeric;
  v_max_stock        int;
  v_committed_units  int;
  v_group            RECORD;
BEGIN
  -- Cantidad
  IF p_quantity < 1 OR p_quantity > 10 THEN
    RAISE EXCEPTION 'Cantidad debe ser entre 1 y 10';
  END IF;

  -- Grupo abierto + datos de producto
  SELECT id, product_name, product_spec, COALESCE(total_units, 0) AS total_units, status
  INTO v_group
  FROM groups WHERE id = p_group_id;
  IF NOT FOUND OR v_group.status <> 'open' THEN
    RAISE EXCEPTION 'Grupo no disponible';
  END IF;

  -- Normalizar + validar teléfono ES (idéntico a join_group)
  v_phone := regexp_replace(p_phone, '[\s\-\.]', '', 'g');
  v_phone := regexp_replace(v_phone, '^\+34', '');
  IF v_phone !~ '^[679][0-9]{8}$' THEN
    RAISE EXCEPTION 'Teléfono no válido (formato español: 9 dígitos empezando por 6, 7 o 9)';
  END IF;

  -- ★P0-01 · Un pedido por persona y grupo. Rechazo ANTES del hold, para que
  -- nadie vea una retención en su tarjeta por una compra que no se va a permitir.
  -- Comprueba por TELÉFONO: cubre el caso que el índice no puede ver (misma
  -- persona usando un email distinto → otro user_id). El índice sobre
  -- (group_id, user_id) es la barrera final; esto es el aviso temprano.
  IF EXISTS (
    SELECT 1 FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = p_group_id
      AND u.phone = v_phone
      AND gm.payment_status IN ('authorized','instructed','paid')
  ) THEN
    RAISE EXCEPTION 'Ya tienes un pedido en este grupo. Puedes consultarlo en "Mis pedidos".';
  END IF;

  -- Rate limit: máx 3 en 1h
  IF (SELECT COUNT(*) FROM group_members gm JOIN users u ON u.id = gm.user_id
      WHERE u.phone = v_phone AND gm.created_at > now() - interval '1 hour') >= 3 THEN
    RAISE EXCEPTION 'Demasiados intentos, espera un momento';
  END IF;

  -- Puja ganadora + guard de stock
  SELECT best_bid_id INTO v_bid_id FROM compute_price(p_group_id);
  IF v_bid_id IS NULL THEN
    RAISE EXCEPTION 'No hay puja activa en este grupo';
  END IF;

  SELECT max_stock INTO v_max_stock FROM bids WHERE id = v_bid_id;

  SELECT COALESCE(SUM(quantity), 0) INTO v_committed_units
  FROM group_members
  WHERE group_id = p_group_id
    AND payment_status IN ('authorized','instructed','paid');

  IF v_committed_units + p_quantity > v_max_stock THEN
    RAISE EXCEPTION 'Stock insuficiente: solo quedan % unidades disponibles',
      GREATEST(v_max_stock - v_committed_units, 0);
  END IF;

  SELECT best_price INTO v_guaranteed_price
  FROM compute_price(p_group_id, p_quantity);

  RETURN json_build_object(
    'phone',            v_phone,
    'guaranteed_price', v_guaranteed_price,
    'best_bid_id',      v_bid_id,
    'product_name',     v_group.product_name,
    'product_spec',     v_group.product_spec
  );
END;
$function$;

-- Permisos (verificar SIEMPRE tras cualquier cambio):
--   SELECT has_function_privilege('anon','public.prepare_join(uuid,text,integer)'::regprocedure,'EXECUTE');
-- Esperado: anon=false, authenticated=false, service_role=true.
