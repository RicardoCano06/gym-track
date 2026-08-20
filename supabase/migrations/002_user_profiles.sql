-- ============================================================
-- Vekt — Migración 002: perfil del usuario
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

create table if not exists public.user_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  height_cm  numeric(5,1),       -- altura en cm
  age        int check (age between 10 and 120),
  sex        text check (sex in ('male', 'female', 'other')),
  level      text not null default 'principiante' check (level in ('principiante', 'intermedio', 'avanzado')),
  goal       text not null default 'mantener' check (goal in ('perder_grasa', 'ganar_masa', 'mantener')),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "usuarios_perfil" on public.user_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);