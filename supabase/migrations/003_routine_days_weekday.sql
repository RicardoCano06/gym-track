-- ============================================================
-- Vekt — Migración 003: día de la semana en routine_days
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

alter table public.routine_days
  add column if not exists weekday text
    check (weekday in ('lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'));