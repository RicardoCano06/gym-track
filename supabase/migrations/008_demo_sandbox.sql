-- Vekt — Migración 008: Demo Sandbox hardening
--
-- La cuenta demo (demo@vekt.app) puede LEER (políticas RLS existentes:
-- lectura de su propio user_id + catálogo público), pero TODO intento de
-- INSERT / UPDATE / DELETE desde esa cuenta se anula silenciosamente a nivel
-- servidor (trigger BEFORE que devuelve NULL). Es la defensa en profundidad
-- de la estrategia "Blackhole" del cliente: aunque otro cliente intente
-- escribir con la sesión demo, la base no persiste NADA.
--
-- Uso: SQL editor del dashboard (rol postgres). No requiere la cuenta
-- creada para instalarse; la resolución del uid es por email y en runtime.

-- Resolución estable del uid de la cuenta demo (por email, sin hardcodear).
create or replace function public.vekt_demo_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from auth.users where email = 'demo@vekt.app' limit 1;
$$;

-- Trigger de anulación silenciosa para el usuario demo.
create or replace function public.vekt_block_demo_mutations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() = public.vekt_demo_user_id() then
    -- BEFORE trigger devolviendo NULL descarta la operación sin error:
    -- el cliente cree que se guardó (consistente con el blackhole).
    return null;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Aplica el trigger a todas las tablas de datos de usuario.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'routines',
    'routine_days',
    'routine_exercises',
    'sessions',
    'session_sets',
    'body_metrics',
    'user_profiles'
  ]
  loop
    execute format('drop trigger if exists vekt_demo_ro on public.%I', tbl);
    execute format(
      'create trigger vekt_demo_ro before insert or update or delete on public.%I
       for each row execute function public.vekt_block_demo_mutations()',
      tbl
    );
  end loop;
end;
$$;