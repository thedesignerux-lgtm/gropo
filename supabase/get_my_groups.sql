-- ============================================================
-- KUORUM · RPC get_my_groups(p_phone)
-- Pegar y ejecutar en: Supabase → SQL Editor
--
-- SECURITY DEFINER: corre con permisos del owner, así que sortea el
-- RLS bloqueado de users/group_members (anon NO puede leer esas tablas
-- directamente). Devuelve SOLO los grupos del teléfono indicado.
-- Sin fuga de PII: el filtro por teléfono normalizado es la única vía.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_groups(p_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_result json;
BEGIN
  -- Normalizar igual que join_group
  v_phone := regexp_replace(p_phone, '[\s\-\.]', '', 'g');
  v_phone := regexp_replace(v_phone, '^\+34', '');

  -- Validar formato; si no es válido, no devolver nada
  IF v_phone !~ '^[679][0-9]{8}$' THEN
    RETURN json_build_object('groups', '[]'::json);
  END IF;

  SELECT json_build_object('groups', COALESCE(json_agg(r), '[]'::json))
  INTO v_result
  FROM (
    SELECT
      gm.id            AS member_id,
      gm.quantity,
      gm.guaranteed_price,
      gm.final_price,
      gm.payment_status,
      g.id             AS group_id,
      g.product_name,
      g.product_spec,
      g.image_url,
      g.status,
      g.closes_at,
      g.current_price,
      -- payment_info SOLO si el grupo está cerrado y el miembro
      -- está instruido/pagado. Antes del cierre, NUNCA (anonimato
      -- del vendedor, regla 8 de la spec).
      CASE
        WHEN g.status = 'closed'
             AND gm.payment_status IN ('instructed','paid')
        THEN (SELECT b.payment_info FROM bids b WHERE b.id = g.winner_bid_id)
        ELSE NULL
      END AS payment_info
    FROM group_members gm
    JOIN users u  ON u.id = gm.user_id
    JOIN groups g ON g.id = gm.group_id
    WHERE u.phone = v_phone
    ORDER BY gm.created_at DESC
  ) r;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_groups(text) TO anon, authenticated;
