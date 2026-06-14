-- ============================================================
-- GRUPETA · RPC create_petition
-- Aplicado en Supabase el 2026-06-14
-- Ejecutar en: Supabase → SQL Editor
--
-- Crea una "petición": un grupo SIN puja, a la espera de que el
-- admin le encuentre un vendedor y le cargue una puja. Mientras
-- no tenga puja, no aparece en el Inicio.
-- Requiere el valor 'petition_created' en el enum event_type.
-- SECURITY DEFINER: el cliente anon no puede insertar en groups
-- directamente (RLS), así que esta RPC es la única vía controlada.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_petition(
  p_product_name text,
  p_product_spec text,
  p_product_url  text,
  p_quantity     int,
  p_name         text,
  p_email        text,
  p_phone        text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone     text;
  v_user_id   uuid;
  v_group_id  uuid;
  v_closes_at timestamptz;
BEGIN
  IF p_product_name IS NULL OR length(trim(p_product_name)) < 2 THEN
    RAISE EXCEPTION 'Indica el nombre del producto';
  END IF;
  IF p_quantity < 1 OR p_quantity > 10 THEN
    RAISE EXCEPTION 'Cantidad debe ser entre 1 y 10';
  END IF;

  v_phone := regexp_replace(p_phone, '[\s\-\.]', '', 'g');
  v_phone := regexp_replace(v_phone, '^\+34', '');
  IF v_phone !~ '^[679][0-9]{8}$' THEN
    RAISE EXCEPTION 'Teléfono no válido (9 dígitos, empieza por 6, 7 o 9)';
  END IF;

  IF (SELECT COUNT(*) FROM events e
      WHERE e.type = 'petition_created'
        AND e.payload->>'phone' = v_phone
        AND e.created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'Demasiadas peticiones, espera un momento';
  END IF;

  INSERT INTO users (email, phone, name, role)
  VALUES (p_email, v_phone, p_name, 'buyer')
  ON CONFLICT (email) DO UPDATE SET phone = v_phone, name = p_name
  RETURNING id INTO v_user_id;

  v_closes_at := (
    (
      (now() AT TIME ZONE 'Europe/Madrid')::date
      + (((7 - EXTRACT(ISODOW FROM (now() AT TIME ZONE 'Europe/Madrid')))::int) % 7) * INTERVAL '1 day'
    )::timestamp
    + INTERVAL '22 hours'
  ) AT TIME ZONE 'Europe/Madrid';

  INSERT INTO groups (product_name, product_spec, product_url, status, closes_at, total_units, created_by)
  VALUES (trim(p_product_name), NULLIF(trim(p_product_spec), ''), NULLIF(trim(p_product_url), ''), 'open', v_closes_at, 0, v_user_id)
  RETURNING id INTO v_group_id;

  INSERT INTO events (group_id, type, payload)
  VALUES (v_group_id, 'petition_created', jsonb_build_object(
    'name', p_name, 'email', p_email, 'phone', v_phone, 'quantity', p_quantity
  ));

  RETURN json_build_object('success', true, 'group_id', v_group_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_petition(text,text,text,int,text,text,text) TO anon, authenticated;
