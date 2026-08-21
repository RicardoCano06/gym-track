-- Vekt — Seed del Demo Sandbox (180 días de historial para demo@vekt.app)
--
-- Requiere:
--   1) Migración 008 aplicada (función public.vekt_demo_user_id()).
--   2) Cuenta demo@vekt.app creada (dashboard > Authentication > Users).
--
-- Uso: SQL editor del dashboard (rol postgres). Es idempotente: borra y
-- regenera los datos del demo. Ningún otro usuario se ve afectado.
--
-- Rigor matemático (mismo modelo que src/lib/demoSeed.ts):
--   - Progresión lineal con ruido ±2.5 kg y deload (×0.8) cada 42 días.
--   - Press de banca 60 → 85 kg en 6 meses.
--   - Cero nulos: peso, reps, RPE y fechas ISO8601 estrictas.
--   - Todo ejercicio mapea a muscle/equipment válidos (lookup por nombre).

do $$
declare
  demo_uid uuid;
  -- rutinas
  r_torso uuid;
  r_pierna uuid;
  -- días
  d_torso_a uuid;
  d_pierna_a uuid;
  d_torso_b uuid;
  d_pierna_b uuid;
  -- ejercicio por clave
  ex_bench uuid;
  ex_incline uuid;
  ex_ohp uuid;
  ex_row uuid;
  ex_pulldown uuid;
  ex_curl uuid;
  ex_squat uuid;
  ex_deadlift uuid;
  ex_legpress uuid;
  ex_lunge uuid;
  ex_calf uuid;
  ex_abwheel uuid;
  -- iteración
  d date;
  s uuid;
  cnt int;
  day_of uuid;
  ex_id uuid;
  ex_key text;
  idx int;
  sets_count int;
  i int;
  w float;
  rec record;
  prog_start float;
  prog_end float;
  prog_total float;
  noise float;
begin
  demo_uid := public.vekt_demo_user_id();
  if demo_uid is null then
    raise exception 'La cuenta demo@vekt.app no existe. Creala en Authentication > Users y volvé a correr este script.';
  end if;

  -- ---------- limpieza previa (idempotente) ----------
  delete from session_sets where session_id in (select id from sessions where user_id = demo_uid);
  delete from sessions where user_id = demo_uid;
  delete from routine_exercises
    where day_id in (select id from routine_days
                     where routine_id in (select id from routines where user_id = demo_uid));
  delete from routine_days
    where routine_id in (select id from routines where user_id = demo_uid);
  delete from routines where user_id = demo_uid;
  delete from body_metrics where user_id = demo_uid;
  delete from user_profiles where user_id = demo_uid;

  -- ---------- catálogo (lookup por nombre español) ----------
  select id into ex_bench   from exercises where name = 'Press de banca agarre medio' limit 1;
  select id into ex_incline from exercises where name = 'Press inclinado con mancuernas' limit 1;
  select id into ex_ohp     from exercises where name = 'Press militar con barra' limit 1;
  select id into ex_row     from exercises where name = 'Remo con barra' limit 1;
  select id into ex_pulldown from exercises where name = 'Jalón al pecho agarre cerrado' limit 1;
  select id into ex_curl    from exercises where name = 'Curl con barra' limit 1;
  select id into ex_squat   from exercises where name = 'Sentadilla con barra' limit 1;
  select id into ex_deadlift from exercises where name = 'Peso muerto' limit 1;
  select id into ex_legpress from exercises where name = 'Prensa de piernas' limit 1;
  select id into ex_lunge   from exercises where name = 'Zancadas con mancuernas' limit 1;
  select id into ex_calf    from exercises where name = 'Prensa de gemelos' limit 1;
  select id into ex_abwheel from exercises where name = 'Rueda abdominal' limit 1;

  if ex_bench is null then
    raise notice 'AVISO: el catálogo no tiene todos los ejercicios del demo; se omiten los faltantes.';
  end if;

  perform setseed(0.42);

  -- ---------- rutinas y días ----------
  insert into routines (user_id, name, description, created_at)
  values (demo_uid, 'Torso', '', now() - interval '180 days') returning id into r_torso;
  insert into routines (user_id, name, description, created_at)
  values (demo_uid, 'Pierna', '', now() - interval '180 days') returning id into r_pierna;

  insert into routine_days (routine_id, day_number, name, weekday, goal)
  values (r_torso, 1, 'Torso A', 'lunes', 'Empuje y tirón horizontal') returning id into d_torso_a;
  insert into routine_days (routine_id, day_number, name, weekday, goal)
  values (r_pierna, 1, 'Pierna A', 'martes', 'Sentadilla y bisagra') returning id into d_pierna_a;
  insert into routine_days (routine_id, day_number, name, weekday, goal)
  values (r_torso, 2, 'Torso B', 'jueves', 'Empuje y tirón vertical') returning id into d_torso_b;
  insert into routine_days (routine_id, day_number, name, weekday, goal)
  values (r_pierna, 2, 'Pierna B', 'viernes', 'Prensa y zancada') returning id into d_pierna_b;

  -- ---------- ejercicios de rutina ----------
  insert into routine_exercises (day_id, exercise_id, position, sets, reps, rest_seconds, notes)
  select v.day_id, v.exercise_id, v.position, v.sets, v.reps, v.rest_seconds, v.notes
  from (values
    (d_torso_a,  ex_bench,    0, 3, '8-12', 90,  ''),
    (d_torso_a,  ex_row,      1, 3, '8-12', 90,  ''),
    (d_torso_a,  ex_ohp,      2, 3, '8-12', 90,  ''),
    (d_torso_a,  ex_abwheel,  3, 3, '8-12', 60,  ''),
    (d_pierna_a, ex_squat,    0, 4, '8-12', 180, ''),
    (d_pierna_a, ex_deadlift, 1, 4, '8-12', 180, ''),
    (d_pierna_a, ex_calf,     2, 3, '10-15', 60, ''),
    (d_torso_b,  ex_incline,  0, 3, '8-12', 90,  ''),
    (d_torso_b,  ex_pulldown, 1, 3, '8-12', 90,  ''),
    (d_torso_b,  ex_curl,     2, 3, '8-12', 90,  ''),
    (d_torso_b,  ex_ohp,      3, 3, '8-12', 90,  ''),
    (d_pierna_b, ex_legpress, 0, 3, '8-12', 120, ''),
    (d_pierna_b, ex_lunge,    1, 3, '8-12', 90,  ''),
    (d_pierna_b, ex_calf,     2, 3, '10-15', 60, ''),
    (d_pierna_b, ex_abwheel,  3, 3, '8-12', 60,  '')
  ) as v(day_id, exercise_id, position, sets, reps, rest_seconds, notes)
  where v.exercise_id is not null;

  -- ---------- sesiones (Lun/Mar/Jue/Vie durante 180 días) ----------
  cnt := 0;
  for d in
    select g::date from generate_series(now() - interval '179 days', now(), interval '1 day') g
    where extract(dow from g) in (1, 2, 4, 5)
  loop
    day_of := case extract(dow from d)
      when 1 then d_torso_a
      when 2 then d_pierna_a
      when 4 then d_torso_b
      else d_pierna_b
    end;

    insert into sessions (user_id, routine_id, day_id, started_at, ended_at, duration_minutes, feeling, notes)
    values (
      demo_uid,
      case when day_of in (d_torso_a, d_torso_b) then r_torso else r_pierna end,
      day_of,
      d::timestamp + time '18:30',
      d::timestamp + time '18:30' + (55 + floor(random() * 11)) * interval '1 minute',
      55 + floor(random() * 11),
      3 + floor(random() * 3),
      ''
    ) returning id into s;

    cnt := cnt + 1;
    for rec in
      select re.exercise_id, re.sets
      from routine_exercises re
      where re.day_id = day_of
      order by re.position
    loop
      ex_id := rec.exercise_id;
      sets_count := rec.sets;
      prog_start := case ex_id
        when ex_bench then 60 when ex_incline then 24 when ex_ohp then 35
        when ex_row then 55 when ex_pulldown then 50 when ex_curl then 20
        when ex_squat then 70 when ex_deadlift then 80 when ex_legpress then 140
        when ex_lunge then 14 when ex_calf then 90 when ex_abwheel then 10
        else 0 end;
      prog_end := case ex_id
        when ex_bench then 85 when ex_incline then 34 when ex_ohp then 50
        when ex_row then 72.5 when ex_pulldown then 67.5 when ex_curl then 30
        when ex_squat then 100 when ex_deadlift then 120 when ex_legpress then 210
        when ex_lunge then 22 when ex_calf then 130 when ex_abwheel then 15
        else 0 end;
      prog_total := 26; -- sesiones aprox. del ejercicio en 6 meses

      -- índice de progresión = cantidad de sesiones del ejercicio hasta hoy
      select count(*) into idx
      from session_sets x
      join sessions y on y.id = x.session_id
      where x.exercise_id = ex_id
        and y.user_id = demo_uid
        and y.started_at <= d::timestamp + time '18:30';

      w := prog_start + (prog_end - prog_start) * least(1.0, idx::float / prog_total);
      if extract(day from (now() - d)) % 42 < 7 then
        w := w * 0.8; -- semana de deload
      end if;

      for i in 1..sets_count loop
        noise := (random() * 2 - 1) * 2.5;
        insert into session_sets
          (session_id, exercise_id, set_number, weight_kg, reps, rpe, completed, notes)
        values (
          s, ex_id, i,
          greatest(0, round((w + noise) * (case i when 1 then 0.96 when 2 then 1.0 else 1.04 end) * 2) / 2),
          case i when 1 then 10 + floor(random() * 3)
                 when 2 then 8 + floor(random() * 3)
                 else 6 + floor(random() * 3) end,
          7 + floor(random() * 3),
          true,
          ''
        );
      end loop;
    end loop;
  end loop;

  -- ---------- medidas corporales semanales (88 → 82.4 kg) ----------
  for rec in
    select g::date as d
    from generate_series(now() - interval '179 days', now(), interval '7 days') g
  loop
    insert into body_metrics (user_id, date, weight_kg, notes)
    values (
      demo_uid,
      rec.d::text,
      round((88 - 5.6 * (1 - (now() - rec.d::timestamp)::float / (180 * 86400)) + (random() * 0.8 - 0.4)) * 10) / 10,
      ''
    );
  end loop;

  -- ---------- perfil ----------
  insert into user_profiles (user_id, height_cm, age, sex, level, goal, updated_at)
  values (demo_uid, 178, 29, 'male', 'intermedio', 'ganar_masa', now())
  on conflict (user_id) do update
    set height_cm = excluded.height_cm,
        age = excluded.age,
        sex = excluded.sex,
        level = excluded.level,
        goal = excluded.goal,
        updated_at = excluded.updated_at;

  raise notice 'Demo seed listo: % sesiones generadas.', cnt;
end;
$$;