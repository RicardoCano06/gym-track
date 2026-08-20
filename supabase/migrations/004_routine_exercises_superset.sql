-- ============================================================
-- Vekt — Migración 004: supersets en routine_exercises
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

alter table public.routine_exercises
  add column if not exists superset_group int;