# GymTrack — Gestor de Entrenamiento Personal

Web personal (gratis) para gestionar entrenamiento en el gimnasio: catálogo de
ejercicios por músculo/máquina, rutinas y tracking de progreso.

## Stack

| Capa       | Tecnología                                   |
| ---------- | -------------------------------------------- |
| Frontend   | Vite + React + TypeScript                    |
| Estilos    | Tailwind CSS v4                              |
| Backend/DB | Supabase (Postgres, plan gratis)             |
| Auth       | Supabase Auth (email)                        |
| Datos      | Seed desde free-exercise-db + traducciones propias (sin depender del API en runtime) |
| Deploy     | Vercel (gratis)                              |

## Modelo de datos (supabase/schema.sql)

- `muscles` — catálogo de músculos (id, nombre, grupo)
- `equipment` — catálogo de equipamiento (mancuerna, barra, máquina, polea, banda...)
- `exercises` — ejercicios (nombre es/en, descripción, instrucciones, músculos, equipo, imágenes)
- `routines` — planes de entrenamiento del usuario
- `routine_days` — días de una rutina (Push/Pull/Pierna...)
- `routine_exercises` — ejercicios de un día (orden, series, reps, descanso)
- `sessions` — sesiones de entrenamiento realizadas
- `session_sets` — series registradas (peso, reps, RPE)
- `body_metrics` — peso corporal y medidas
- `user_profiles` — altura, edad, sexo, nivel, objetivo (migración `supabase/migrations/002_user_profiles.sql`)

## Páginas / Rutas

- `/` — Dashboard: próxima sesión, resumen semanal
- `/ejercicios` — Catálogo: buscador + filtros por músculo/equipo
- `/ejercicios/:id` — Detalle: músculos, instrucciones, historial y PRs
- `/rutinas` — Rutinas: CRUD de planes por día
- `/entrenar/:dayId` — Sesión activa: registrar series/peso/reps/RPE
- `/historial` — Historial de sesiones
- `/estadisticas` — Volumen semanal, evolución por ejercicio (gráficos)

## Fases

- [x] Fase 0 — Base: proyecto, Tailwind, schema SQL, cliente Supabase, seed del catálogo
- [x] Fase 1 — Catálogo explorable (fotos, filtros por músculo y máquina)
- [x] Fase 2 — Auth + Rutinas
- [x] Fase 3 — Tracking de sesiones + historial
- [ ] Fase 4 — Estadísticas, pulido y deploy en Vercel

## Funcionalidades nuevas (extras)

- [x] Paso 1 — Perfil: altura/edad/sexo/nivel/objetivo, IMC con categoría y escala, registro de peso diario con historial y sparkline, recomendaciones basadas en evidencia (series semanales ≥10 por músculo, déficit/superávit según objetivo, descanso 48 h)
- [x] Paso 2 — Rutinas: día de la semana (lunes..domingo) + recomendador de ejercicios por grupo muscular del día (migración `supabase/migrations/003_routine_days_weekday.sql`)
- [x] Paso 3 — Series semanales por músculo en el dashboard (sesiones completadas, series totales, barras vs objetivo de 10 series)
- [x] Paso 4 — Gráfico de progreso por ejercicio (peso máximo, 1RM estimado, evolución por sesión en la página del ejercicio)
- [x] Paso 5 — Supersets (pares A/B con toggle en la rutina y vista alternada en la sesión, migración `supabase/migrations/004_routine_exercises_superset.sql`), export CSV del historial y tema claro/oscuro con persistencia

## Costo

$0. Requiere: cuenta Supabase gratis + GitHub (deploy).

## Configuración inicial

1. Crear proyecto en [supabase.com](https://supabase.com) (gratis)
2. Ejecutar `supabase/schema.sql` en el SQL editor del proyecto
3. Copiar `.env.example` a `.env.local` con las credenciales del proyecto
4. `npm run seed:fetch` → descarga el catálogo a `supabase/seed-data.json`
5. `npm run seed:db` → sube el catálogo a la base de datos
6. `npm run dev` → desarrollo local