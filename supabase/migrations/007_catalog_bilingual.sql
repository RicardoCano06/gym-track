-- Vekt — Migración 007: catálogo bilingüe
--
-- Aplica tras 006. Añade la columna instructions_es (text[]) a exercises
-- para guardar las instrucciones traducidas al español. Los nombres en
-- inglés de ejercicios ya existen (name_en). Músculos y equipos se traducen
-- desde el frontend (diccionario), sin columna nueva.
--
-- Tras aplicarla, correr: npm run seed:db   (sube instructions_es desde seed-data.json)

alter table public.exercises
  add column if not exists instructions_es text[];
