-- ═══════════════════════════════════════════════════════════════════════════
-- P0-01 · 1 usuario + 1 grupo = 1 participación
-- Aplicado en producción el 11-sep-2026 · migración
-- `p001_one_membership_per_user_per_group`
--
-- REGLA DE PRODUCTO (MVP): una persona sólo puede tener UN pedido por grupo.
-- No existe ampliación de pedido ni segunda participación. Si algún día se
-- permite ampliar, será una decisión de producto nueva y NO debe resolverse
-- creando una segunda fila: la participación es única por (group_id, user_id).
--
-- Este fichero contiene ÚNICAMENTE el índice. Los cambios que lo acompañan
-- viven en sus ficheros de siempre:
--   · supabase/confirm_join.sql  → rama ELSIF que libera el hold sobrante
--   · supabase/prepare_join.sql  → rechazo temprano, antes de crear el hold
--
-- ⚠ ORDEN OBLIGATORIO SI SE REAPLICA DESDE CERO:
--   1) confirm_join con la rama de `uniq_member_per_group_alive`
--   2) este índice
--   3) prepare_join
--   Crear el índice SIN la rama de confirm_join convierte un bug de miembros
--   duplicados en uno de holds atascados: la unique_violation cae en ELSE→RAISE,
--   el webhook devuelve 500, Stripe reintenta indefinidamente y el hold NUNCA
--   se cancela (7 días de dinero retenido al cliente).
--
-- PARCIAL A PROPÓSITO: un miembro `released`/`cancelled` no bloquea volver a
-- unirse al mismo grupo. Sólo las participaciones vivas son únicas.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS uniq_member_per_group_alive
  ON public.group_members (group_id, user_id)
  WHERE payment_status IN ('authorized','instructed','paid');

-- ── Verificación tras aplicar ──────────────────────────────────────────────
-- SELECT indexdef FROM pg_indexes
--  WHERE schemaname='public' AND indexname='uniq_member_per_group_alive';
--
-- -- No debe haber duplicados vivos (si los hay, LIMPIAR ANTES de crear el índice):
-- SELECT group_id, user_id, count(*) FROM group_members
--  WHERE payment_status IN ('authorized','instructed','paid')
--  GROUP BY 1,2 HAVING count(*) > 1;
--
-- LIMITACIÓN CONOCIDA: la identidad se resuelve por EMAIL (confirm_join hace
-- ON CONFLICT (email)). La misma persona con dos emails distintos son dos
-- user_id y el índice los ve como participaciones legítimas. prepare_join cubre
-- parcialmente ese hueco comprobando por TELÉFONO. El cierre real depende de la
-- unificación de identidad → P0-02.
