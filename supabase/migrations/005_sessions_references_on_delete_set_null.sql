-- Las sesiones quedan referenciando a la rutina/día aunque la rutina se
-- borre. Con ON DELETE SET NULL, eliminar una rutina con historial no falla
-- por la FK sessions_day_id_fkey / sessions_routine_id_fkey.
-- Aplicar en el SQL Editor de Supabase (proyectos existentes).

alter table public.sessions
  drop constraint if exists sessions_day_id_fkey,
  drop constraint if exists sessions_routine_id_fkey;

alter table public.sessions
  add constraint sessions_routine_id_fkey
    foreign key (routine_id) references public.routines(id) on delete set null,
  add constraint sessions_day_id_fkey
    foreign key (day_id) references public.routine_days(id) on delete set null;