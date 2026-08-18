-- ============================================================
-- GymTrack — Schema
-- Ejecutar en el SQL Editor de Supabase (proyecto nuevo)
-- ============================================================

-- ---------- Catálogo (lectura pública) ----------

create table if not exists public.muscles (
  id          serial primary key,
  name        text not null unique,
  group_name  text not null
);

create table if not exists public.equipment (
  id         serial primary key,
  name       text not null unique,
  kind       text not null default 'free_weight' -- free_weight | machine | cable | band | bodyweight | cardio | other
);

create table if not exists public.exercises (
  id               uuid primary key default gen_random_uuid(),
  source_id        text unique,              -- id del dataset original (free-exercise-db)
  name             text not null,            -- español si hay traducción, sino inglés
  name_en          text,
  description      text,
  instructions     text[],                   -- pasos de ejecución
  muscle_primary   int references public.muscles(id),
  muscle_secondary int[] default '{}',
  equipment        int references public.equipment(id),
  category         text not null default 'fuerza', -- fuerza | cardio | estiramiento | pliometria ...
  level            text,                     -- principiante | intermedio | avanzado
  force            text,                     -- push | pull | static
  image_url        text,
  created_at       timestamptz not null default now()
);

alter table public.exercises enable row level security;
alter table public.muscles enable row level security;
alter table public.equipment enable row level security;

create policy "catalogo_lectura_publica" on public.exercises
  for select using (true);
create policy "catalogo_lectura_publica" on public.muscles
  for select using (true);
create policy "catalogo_lectura_publica" on public.equipment
  for select using (true);

-- ---------- Datos del usuario (privados) ----------

create table if not exists public.routines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists public.routine_days (
  id          uuid primary key default gen_random_uuid(),
  routine_id  uuid not null references public.routines(id) on delete cascade,
  day_number  int not null,
  name        text,          -- "Push", "Pull", "Pierna"
  goal        text           -- músculos objetivo
);

create table if not exists public.routine_exercises (
  id            uuid primary key default gen_random_uuid(),
  day_id        uuid not null references public.routine_days(id) on delete cascade,
  exercise_id   uuid not null references public.exercises(id),
  position      int not null,
  sets          int not null default 3,
  reps          text,        -- "8-12" | "fallo" | "5x5"
  rest_seconds  int not null default 90,
  notes         text
);

create table if not exists public.sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  routine_id        uuid references public.routines(id),
  day_id            uuid references public.routine_days(id),
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  duration_minutes  int,
  feeling           int check (feeling between 1 and 10),
  notes             text
);

create table if not exists public.session_sets (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  set_number  int not null,
  weight_kg   numeric(6,2),
  reps        int,
  rpe         numeric(2,1),
  completed   boolean not null default true,
  notes       text
);

create table if not exists public.body_metrics (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null default current_date,
  weight_kg  numeric(5,2),
  notes      text,
  unique (user_id, date)
);

alter table public.routines enable row level security;
alter table public.routine_days enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.sessions enable row level security;
alter table public.session_sets enable row level security;
alter table public.body_metrics enable row level security;

create policy "usuarios_rutinas" on public.routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "usuarios_dias" on public.routine_days
  for all using (
    exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid())
  );

create policy "usuarios_ejercicios_rutina" on public.routine_exercises
  for all using (
    exists (
      select 1 from public.routine_days d
      join public.routines r on r.id = d.routine_id
      where d.id = day_id and r.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.routine_days d
      join public.routines r on r.id = d.routine_id
      where d.id = day_id and r.user_id = auth.uid()
    )
  );

create policy "usuarios_sesiones" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "usuarios_series" on public.session_sets
  for all using (
    exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
  );

create policy "usuarios_medidas" on public.body_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Índices ----------

create index if not exists idx_exercises_muscle    on public.exercises(muscle_primary);
create index if not exists idx_exercises_equipment on public.exercises(equipment);
create index if not exists idx_exercises_category  on public.exercises(category);
create index if not exists idx_routines_user       on public.routines(user_id);
create index if not exists idx_days_routine        on public.routine_days(routine_id);
create index if not exists idx_day_exercises_day   on public.routine_exercises(day_id);
create index if not exists idx_sessions_user       on public.sessions(user_id);
create index if not exists idx_sets_session        on public.session_sets(session_id);
create index if not exists idx_metrics_user        on public.body_metrics(user_id, date);