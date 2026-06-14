-- ============================================================
-- GRUPETA · Migración · enum event_type += 'petition_created'
-- Aplicado en Supabase el 2026-06-14
-- Ejecutar en: Supabase → SQL Editor
--
-- Añade el valor 'petition_created' al enum event_type, usado por la
-- RPC create_petition (ver create_petition.sql) para registrar el
-- evento de una petición de producto.
--
-- IF NOT EXISTS lo hace idempotente: re-ejecutarlo no falla si el valor
-- ya está. ALTER TYPE ... ADD VALUE no puede ir dentro de una transacción
-- explícita; ejecútalo suelto (el SQL Editor de Supabase lo permite).
-- ============================================================

ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'petition_created';
