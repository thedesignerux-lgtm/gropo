-- ════════════════════════════════════════════════════════════════════
-- IDENTIDAD DEL PERFIL (get_profile + direcciones + radar)
-- ────────────────────────────────────────────────────────────────────
-- El perfil es una página SOLO con sesión (login por OTP de email). La
-- identidad autoritativa es el email VERIFICADO en la sesión (auth.jwt()).
--
-- Antes: cada RPC resolvía el usuario por (teléfono + email) pasados desde
-- el cliente. Bugs/riesgos que esto causaba:
--   1) En un dispositivo nuevo / caché borrada, el navegador no tiene el
--      teléfono en localStorage → get_profile no encontraba al usuario →
--      "Aún no tienes direcciones" aunque existieran.
--   2) Un cliente podía pasar teléfono+email de OTRA persona y leer/editar
--      sus datos (los params venían del cliente, no de la sesión).
--
-- Ahora: _profile_uid() prioriza el email del JWT (autenticado → solo SUS
-- datos, ignora params), y solo cae al modo estricto tel+email para
-- llamadas anónimas (retrocompatibilidad de páginas públicas SSR).
-- ════════════════════════════════════════════════════════════════════

-- ── Helper de identidad (INTERNO, no exponer como RPC) ──────────────
CREATE OR REPLACE FUNCTION public._profile_uid(p_phone text, p_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_jwt_email text;
  v_phone     text;
  v_email     text;
  v_uid       uuid;
begin
  v_jwt_email := lower(nullif(trim(auth.jwt() ->> 'email'), ''));
  if v_jwt_email is not null then
    select id into v_uid from public.users where lower(email) = v_jwt_email limit 1;
    return v_uid;  -- autenticado: solo sus propios datos, ignora params
  end if;
  -- Sin sesión (anon): identidad estricta por tel + email.
  v_phone := regexp_replace(coalesce(p_phone,''), '[\s\-\.]', '', 'g');
  v_phone := regexp_replace(v_phone, '^\+34', '');
  v_email := lower(trim(coalesce(p_email,'')));
  if v_phone !~ '^[679][0-9]{8}$' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return null;
  end if;
  select id into v_uid from public.users where phone = v_phone and lower(email) = v_email limit 1;
  return v_uid;
end; $function$;
REVOKE EXECUTE ON FUNCTION public._profile_uid(text,text) FROM PUBLIC, anon, authenticated;

-- ── get_profile ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_profile(p_phone text, p_email text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid;
begin
  v_uid := public._profile_uid(p_phone, p_email);
  if v_uid is null then return json_build_object('addresses','[]'::json,'radar',null); end if;
  return json_build_object(
    'addresses', (select coalesce(json_agg(row_to_json(t) order by t.is_default desc, t.created_at), '[]'::json)
                  from (select id,label,line1,line2,city,province,postal_code,country,is_default,created_at
                        from public.user_addresses where user_id = v_uid) t),
    'radar', (select json_build_object('categories', coalesce(categories,'{}'), 'max_price', max_price)
              from public.user_radar_prefs where user_id = v_uid)
  );
end; $function$;

-- ── address_add ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.address_add(p_phone text, p_email text, p_line1 text, p_line2 text, p_city text, p_province text, p_postal text, p_label text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid; v_def boolean;
begin
  v_uid := public._profile_uid(p_phone, p_email);
  if v_uid is null then return json_build_object('ok',false,'reason','no_user'); end if;
  if coalesce(nullif(trim(p_line1),''), '') = '' then return json_build_object('ok',false,'reason','empty'); end if;
  select count(*)=0 into v_def from public.user_addresses where user_id = v_uid;
  insert into public.user_addresses(user_id,label,line1,line2,city,province,postal_code,is_default)
  values (v_uid, nullif(p_label,''), p_line1, nullif(p_line2,''), nullif(p_city,''), nullif(p_province,''), nullif(p_postal,''), v_def);
  return json_build_object('ok',true,'addresses',
    (select coalesce(json_agg(row_to_json(t) order by t.is_default desc, t.created_at), '[]'::json)
     from (select id,label,line1,line2,city,province,postal_code,country,is_default,created_at from public.user_addresses where user_id = v_uid) t));
end; $function$;

-- ── address_update ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.address_update(p_phone text, p_email text, p_id uuid, p_line1 text, p_line2 text, p_city text, p_province text, p_postal text, p_label text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid;
begin
  v_uid := public._profile_uid(p_phone, p_email);
  if v_uid is null then return json_build_object('ok',false,'reason','no_user'); end if;
  if coalesce(nullif(trim(p_line1),''),'') = '' then return json_build_object('ok',false,'reason','empty'); end if;
  if not exists (select 1 from public.user_addresses where id = p_id and user_id = v_uid) then return json_build_object('ok',false,'reason','not_found'); end if;
  update public.user_addresses
    set line1 = p_line1, line2 = nullif(p_line2,''), city = nullif(p_city,''),
        province = nullif(p_province,''), postal_code = nullif(p_postal,''), label = nullif(p_label,'')
    where id = p_id and user_id = v_uid;
  return json_build_object('ok',true,'addresses',
    (select coalesce(json_agg(row_to_json(t) order by t.is_default desc, t.created_at), '[]'::json)
     from (select id,label,line1,line2,city,province,postal_code,country,is_default,created_at from public.user_addresses where user_id = v_uid) t));
end; $function$;

-- ── address_delete ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.address_delete(p_phone text, p_email text, p_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid; v_isdef boolean;
begin
  v_uid := public._profile_uid(p_phone, p_email);
  if v_uid is null then return json_build_object('ok',false,'reason','no_user'); end if;
  select is_default into v_isdef from public.user_addresses where id = p_id and user_id = v_uid;
  if v_isdef is null then return json_build_object('ok',false,'reason','not_found'); end if;
  if v_isdef then return json_build_object('ok',false,'reason','default'); end if;
  delete from public.user_addresses where id = p_id and user_id = v_uid;
  return json_build_object('ok',true,'addresses',
    (select coalesce(json_agg(row_to_json(t) order by t.is_default desc, t.created_at), '[]'::json)
     from (select id,label,line1,line2,city,province,postal_code,country,is_default,created_at from public.user_addresses where user_id = v_uid) t));
end; $function$;

-- ── address_set_default ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.address_set_default(p_phone text, p_email text, p_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid;
begin
  v_uid := public._profile_uid(p_phone, p_email);
  if v_uid is null then return json_build_object('ok',false,'reason','no_user'); end if;
  if not exists (select 1 from public.user_addresses where id = p_id and user_id = v_uid) then return json_build_object('ok',false,'reason','not_found'); end if;
  update public.user_addresses set is_default = (id = p_id) where user_id = v_uid;
  return json_build_object('ok',true,'addresses',
    (select coalesce(json_agg(row_to_json(t) order by t.is_default desc, t.created_at), '[]'::json)
     from (select id,label,line1,line2,city,province,postal_code,country,is_default,created_at from public.user_addresses where user_id = v_uid) t));
end; $function$;

-- ── radar_prefs_save ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.radar_prefs_save(p_phone text, p_email text, p_categories text[], p_max_price numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid;
begin
  v_uid := public._profile_uid(p_phone, p_email);
  if v_uid is null then return json_build_object('ok',false,'reason','no_user'); end if;
  insert into public.user_radar_prefs(user_id, categories, max_price, updated_at)
  values (v_uid, coalesce(p_categories,'{}'), p_max_price, now())
  on conflict (user_id) do update set categories = excluded.categories, max_price = excluded.max_price, updated_at = now();
  return json_build_object('ok',true);
end; $function$;

-- ── Permisos (las RPC del perfil son anon+authenticated) ───────────
GRANT EXECUTE ON FUNCTION public.get_profile(text,text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.address_add(text,text,text,text,text,text,text,text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.address_update(text,text,uuid,text,text,text,text,text,text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.address_delete(text,text,uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.address_set_default(text,text,uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.radar_prefs_save(text,text,text[],numeric) TO anon, authenticated, service_role;
