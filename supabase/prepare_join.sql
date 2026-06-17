CREATE OR REPLACE FUNCTION public.prepare_join(
  p_group_id uuid,
  p_phone    text,
  p_quantity integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_phone            text;
  v_bid_id           uuid;
  v_guaranteed_price numeric;
  v_max_stock        int;
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

  -- Dedupe por teléfono dentro del grupo
  IF EXISTS (
    SELECT 1 FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = p_group_id AND u.phone = v_phone
  ) THEN
    RAISE EXCEPTION 'Ya estás en este grupo';
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
  IF v_group.total_units + p_quantity > v_max_stock THEN
    RAISE EXCEPTION 'Stock insuficiente: solo quedan % unidades disponibles',
      (v_max_stock - v_group.total_units);
  END IF;

  -- Precio a retener = precio PROYECTADO a (total_units + cantidad), no el tramo 1.
  -- compute_price(group, extra) evalúa la puja ganadora a las unidades que habría
  -- si entra este comprador → un techo más ajustado y siempre ≥ el precio final.
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
$function$;R REPLACE FUNCTION public.prepare_join(
  p_group_id uuid,
  p_phone    text,
  p_quantity integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_phone            text;
  v_bid_id           uuid;
  v_guaranteed_price numeric;
  v_max_stock        int;
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

  -- Dedupe por teléfono dentro del grupo
  IF EXISTS (
    SELECT 1 FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = p_group_id AND u.phone = v_phone
  ) THEN
    RAISE EXCEPTION 'Ya estás en este grupo';
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
  IF v_group.total_units + p_quantity > v_max_stock THEN
    RAISE EXCEPTION 'Stock insuficiente: solo quedan % unidades disponibles',
      (v_max_stock - v_group.total_units);
  END IF;

  -- Precio a retener = precio PROYECTADO a (total_units + cantidad), no el tramo 1.
  -- compute_price(group, extra) evalúa la puja ganadora a las unidades que habría
  -- si entra este comprador → un techo más ajustado y siempre ≥ el precio final.
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
