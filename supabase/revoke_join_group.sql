-- =====================================================================
-- VONDA · revoke_join_group.sql
-- Retira el acceso por RPC a join_group (la vía legada del JoinModal).
-- Tras migrar a Stripe, unirse SOLO puede ocurrir con tarjeta autorizada
-- (prepare_join → hold → webhook → confirm_join). join_group sigue
-- existiendo (la reusa la lógica de referencia), pero NADIE debe poder
-- crear un miembro sin hold por llamada directa con la publishable key.
--
-- Ejecutar en Supabase → SQL Editor.
-- =====================================================================

-- (Opcional) Verifica la firma exacta antes de revocar:
--   SELECT oid::regprocedure FROM pg_proc WHERE proname = 'join_group';
-- Debe devolver: join_group(uuid,text,text,text,integer)

REVOKE EXECUTE ON FUNCTION public.join_group(uuid, text, text, text, integer)
  FROM anon, authenticated, public;

-- Comprobación posterior (debe quedar sin privilegios para anon/authenticated):
--   SELECT grantee, privilege_type
--   FROM information_schema.role_routine_grants
--   WHERE routine_name = 'join_group';
