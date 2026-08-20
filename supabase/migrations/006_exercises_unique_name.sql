-- Vekt — Migración 006: sin ejercicios duplicados por nombre en español

-- 1) Descarta filas que comparten el mismo nombre en español, conservando la de menor id.
--    (la base ya se limpió a 867 ejercicios; esto protege cualquier otra instancia)
delete from public.exercises a
using public.exercises b
where a.id > b.id
  and lower(trim(a.name)) = lower(trim(b.name));

-- 2) Bloquea futuros duplicados: un nombre en español solo puede existir una vez.
create unique index if not exists exercises_name_unique_idx
  on public.exercises (lower(trim(name)));