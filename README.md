# Vekt ⚡

**Entrenamiento con sobrecarga progresiva, offline-first y bilingüe.**

Vekt es una web app (PWA-style SPA) para registrar entrenamientos de fuerza y
seguir la progresión de cargas a lo largo del tiempo: rutinas, series, RPE,
peso corporal, rachas, volumen semanal y récords personales — en español o en
inglés, y funcionando incluso sin conexión.

---

## Índice

- [¿Qué hace?](#qué-hace)
- [Stack y arquitectura](#stack-y-arquitectura)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Primeros pasos](#primeros-pasos)
- [Variables de entorno](#variables-de-entorno)
- [Base de datos (Supabase)](#base-de-datos-supabase)
- [Sincronización offline](#sincronización-offline)
- [Modo Demo Sandbox](#modo-demo-sandbox)
- [Bilingüe](#bilingüe)
- [Tests E2E](#tests-e2e)
- [Seguridad](#seguridad)
- [Deploy en Cloudflare Pages](#deploy-en-cloudflare-pages)
- [Scripts útiles](#scripts-útiles)

---

## ¿Qué hace?

| Funcionalidad | Detalle |
|---|---|
| Rutinas y días | Creá rutinas (ej. "Torso" / "Pierna"), con días por semana, objetivo y ejercicios |
| Entrenar | Registrá series en vivo: peso, reps, RPE, supersets, descanso, sensación y notas |
| Historial | Todas tus sesiones, exportables a CSV |
| Estadísticas | Racha actual y récord, volumen semanal por músculo, evolución y PRs (1RM estimado) |
| Progreso por ejercicio | Gráfico de evolución de carga en el tiempo |
| Perfil | Altura, edad, sexo, nivel, objetivo, peso corporal e IMC + recomendaciones |
| Offline-first | La app funciona sin conexión: las mutaciones se encolan y sincronizan al volver |
| Bilingüe | ES/EN con toggle persistente, fechas localizadas y CSV en el idioma activo |
| Demo 1-Click | Sandbox aislado con 6 meses de datos de ejemplo, sin tocar producción |

---

## Stack y arquitectura

```
React 19 + TypeScript + Vite 8 + Tailwind CSS
Supabase (Auth + Postgres + RLS + PostgREST)
Persistencia offline: localStorage (cola de sync) + Web Locks + IndexedDB (demo)
E2E: Node + CDP (Chrome/Edge headless)
```

**Flujo de datos normal (usuario real):**

```
UI (páginas) ──> src/lib/db.ts ──> Supabase (lecturas)
                    │
                    └─ escrituras ─> src/lib/sync.ts (cola offline) ─> Supabase (al estar online)
```

- Las **lecturas** van directo a Supabase (los datos del usuario viven en la nube).
- Las **escrituras** pasan por un motor de sincronización con cola persistente:
  si no hay red, la operación queda en cola y se envía cuando se reconecta.

**Flujo de datos en modo demo:**

```
UI ──> db.ts ──> src/lib/demoData.ts ──> IndexedDB "vekt-local" (espejo local)
                  (jamás toca Supabase)
```

---

## Estructura del proyecto

```
├─ src/
│  ├─ components/       # AuthProvider, Layout, HeaderStatus, BottomNav, cards, diálogos...
│  ├─ pages/            # Login, Dashboard, Catalog, ExerciseDetail, Routines, Train,
│  │                    # History, Stats, Profile
│  └─ lib/
│     ├─ db.ts          # Capa de datos hacia Supabase (40+ funciones)
│     ├─ sync.ts        # Motor de sincronización offline (cola + locks + retry)
│     ├─ demo.ts        # Sandbox demo: flags, purga, usuario local
│     ├─ demoStore.ts   # IndexedDB "vekt-local" (espejo del demo)
│     ├─ demoData.ts    # Espejo local de db.ts (modo demo)
│     ├─ demoSeed.ts    # Generador algorítmico de 180 días de historial
│     ├─ i18n.ts        # Diccionario ES/EN + helpers de nombres
│     ├─ lang-context.tsx, theme-context.tsx, auth-context.ts
│     ├─ recommendations.ts, format.ts, constants.ts, types.ts, supabase.ts
│     └─ use-confirm.tsx
├─ scripts/
│  ├─ fetch-catalog.mjs      # Descarga el catálogo de ejercicios (free-exercise-db)
│  ├─ seed-db.mjs            # Sube el catálogo a Supabase (requiere SERVICE_ROLE_KEY)
│  ├─ translate-instructions.mjs   # Traduce instrucciones al español (caché local)
│  ├─ naturalize-instructions.mjs  # Naturaliza el español (voseo + glosario fitness)
│  └─ e2e/                   # Suites E2E (Node + CDP)
├─ supabase/
│  ├─ schema.sql             # Esquema completo de referencia
│  ├─ seed-data.json         # Catálogo (867 ejercicios, bilingüe)
│  ├─ seed.sql               # Generador SQL del historial demo (para el dashboard)
│  └─ migrations/            # Migraciones 002 → 008
├─ .env.example              # Variables de entorno (valores falsos)
├─ .env.production.example   # Guía de variables de producción (Cloudflare)
```

---

## Primeros pasos

Requisitos: **Node 20+** y acceso a un proyecto **Supabase** (o el proyecto ya configurado).

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables locales (copiá el ejemplo)
copy .env.example .env.local
#    → pegá tu URL y anon key de Supabase

# 3. Levantar el entorno de desarrollo
npm run dev        # http://localhost:5173
```

Para el **catálogo de ejercicios** (opcional pero recomendado en dev):

```bash
npm run seed:db    # requiere SUPABASE_SERVICE_ROLE_KEY en .env.local
```

---

## Variables de entorno

| Variable | Dónde | Para qué | ¿Se versiona? |
|---|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` / Cloudflare | URL del proyecto (pública) | ❌ |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` / Cloudflare | Key pública de cliente | ❌ |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` (solo scripts) | Seed del catálogo / tareas admin | ❌ (secreta) |
| `E2E_TEST_PASSWORD` | `.env.local` / CI | Suites E2E (cuenta de test) | ❌ (secreta) |
| `VITE_DEMO_PASSWORD` | Cloudflare (opcional) | Cuenta demo online; sin valor → demo 100% local | ❌ |

> Regla de oro: **nunca** versionar valores reales. En el repo solo viven
> placeholders (`.env.example`). Para producción, las variables se definen en
> el dashboard de Cloudflare Pages y se inyectan en el build.

---

## Base de datos (Supabase)

Esquema (ver `supabase/schema.sql` para el detalle):

```
auth.users
   │
   ├─ user_profiles      (altura, edad, sexo, nivel, objetivo)
   ├─ routines           (Torso, Pierna…)
   │    └─ routine_days      (día por semana, objetivo)
   │         └─ routine_exercises  (ejercicio + sets/reps/descanso)
   ├─ sessions           (entrenamiento: inicio/fin, duración, sensación)
   │    └─ session_sets      (series: peso, reps, RPE, completada)
   ├─ body_metrics       (peso corporal diario/semanal)
   │
   └─ (catálogo público, sin dueño)
        exercises  ── muscles ── equipment
```

**Migraciones** (aplicar en orden desde el SQL editor del dashboard):

| Migración | Qué hace |
|---|---|
| `002` | Tabla `user_profiles` |
| `003` | Columna `weekday` en `routine_days` |
| `004` | Columna `superset_group` en `routine_exercises` |
| `005` | `ON DELETE SET NULL` en referencias de sesiones |
| `006` | Dedup + índice único de ejercicios por nombre |
| `007` | Columna `instructions_es` (instrucciones en español) |
| `008` | **Demo hardening**: triggers que anulan toda mutación de `demo@vekt.app` |

**RLS (Row Level Security):** el catálogo (exercises/muscles/equipment) es de
lectura pública; todas las tablas de usuario son de lectura/escritura **solo
para el dueño** (`auth.uid() = user_id`). Verificado: con el anon key sin
login, las 7 tablas de usuario devuelven `[]`.

---

## Sincronización offline

`src/lib/sync.ts` implementa una cola de escrituras tolerante a fallos:

- **Cola persistente**: cada operación se guarda en `localStorage` bajo
  `gymtrack-sync-queue-<userId>` (una cola por cuenta, así cambiar de sesión
  en el mismo dispositivo no mezcla datos).
- **Coalescing**: múltiples `upsert` sobre la misma entidad se fusionan (solo
  se envía el último estado); un `delete` cancela un `upsert` pendiente.
- **Web Locks** (`navigator.locks`): exclusión mutua entre pestañas para no
  enviar la misma operación dos veces; fallback con lock en localStorage.
- **Reintentos con backoff** y timeout por operación (15s). Un `AbortError` o
  pérdida de socket se reintenta como error de red; un `401/403` pausa la cola.
- **Pausa ante errores de auth** y barrido de colas viejas (30 días) para no
  agotar la cuota de `localStorage`.

Claves locales utilizadas: `gymtrack-sync-queue-*`, `gymtrack-sync-lock-*`,
`gymtrack-sync-paused-*`, `gymtrack-active-set-*`, `gymtrack-lang`,
`gymtrack-theme`.

---

## Modo Demo Sandbox

El botón **"⚡ Entrar como Invitado (Demo)"** en la pantalla de login abre un
sandbox aislado para que cualquiera explore la app con datos realistas sin
afectar producción ni otros usuarios.

**Arquitectura (4 capas):**

1. **Hardening DB** (`008_demo_sandbox.sql`): trigger que anula silenciosamente
   todo `INSERT/UPDATE/DELETE` del usuario demo a nivel servidor (defensa en
   profundidad aunque otro cliente use sus credenciales).
2. **Blackhole en sync**: en modo demo, la cola descarta las operaciones
   "como sincronizadas" sin hacer ningún fetch a Supabase.
3. **Generador de datos**: `demoSeed.ts` (local) y `seed.sql` (cloud) generan
   **6 meses de historial** con rigor matemático:
   - 2 rutinas (Torso/Pierna), 4 sesiones semanales.
   - Progresión lineal con ruido ±2.5 kg y **deload** (×0.8) cada 6 semanas
     (ej: Press de banca 60 → 85 kg en 6 meses).
   - Cero nulos: peso, reps, RPE y fechas ISO8601 estrictas; todo ejercicio
     mapea a músculo/equipo válidos.
4. **UI resiliente**: el flujo es ① purga local (`deleteDatabase('vekt-local')`),
   ② intento de sign-in con la cuenta demo (si `VITE_DEMO_PASSWORD` está
   configurada), ③ si falla la red → **Demo Puramente Local** con una sesión
   sintética y los datos inyectados directo en IndexedDB (funciona offline).

Al **cerrar sesión**, el sandbox se purga por completo (IndexedDB + cola +
flags) para que el próximo usuario real arranque limpio.

---

## Bilingüe

- Diccionario completo ES/EN en `src/lib/i18n.ts` (~450 claves).
- Toggle **ES/EN** en el perfil (píldora con indicador deslizante), persistido
  en `localStorage 'gymtrack-lang'` (por defecto `es`).
- Fechas y horas localizadas (`es-AR` / `en-US`), CSV con headers y nombres en
  el idioma activo, `<html lang>` actualizado.
- **Instrucciones de ejercicios**: los nombres en inglés (`name_en`) vienen del
  dataset original; las instrucciones en español (`instructions_es`) fueron
  **naturalizadas** a rioplatense (voseo consistente + glosario de gimnasio)
  mediante `scripts/naturalize-instructions.mjs`.

---

## Tests E2E

Arnes en Node + CDP (Chrome/Edge headless), sin dependencias de navegador
adicionales. Requiere `.env.local` con `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
`E2E_TEST_PASSWORD`.

```bash
npm run test:e2e
```

El runner levanta automáticamente el build + preview (`:4173`) y el navegador
(`:9222`), o reutiliza instancias ya corriendo. Suites:

| Suite | Cubre |
|---|---|
| `sugg-e2e` | Sugerencia de sesión en el dashboard |
| `resid-e2e` | Sincronización pendiente y quitar ejercicios |
| `edge-a` / `edge-b` | Offline: cola, cierre abrupto y recuperación multi-pestaña |
| `auth-e2e` | Login, logout y limpieza de datos |
| `coalesce-e2e` | Fusión de upserts y orden upsert→delete (sin resurrecciones) |

> Nota: los selectores E2E son parte del contrato de la app (login con
> `input[type=email]`, `button[type=submit]`, etc.). Al modificar la UI hay que
> preservarlos; el botón demo usa `data-testid="demo-login"` y no interfiere.

---

## Seguridad

- **Sin secretos en el repo**: ni la service role key ni passwords se versionan.
  Las credenciales se gestionan por entorno (`.env.local` local, dashboard de
  Cloudflare en prod). Verificado con `git grep` sobre todo el historial.
- **Anon key ≠ acceso**: la key pública de cliente no puede leer datos de
  otros usuarios gracias a RLS. La service role (con permisos totales) solo
  existe en tu máquina / CI.
- **Demo aislado**: la cuenta demo no puede escribir en la base (triggers) y
  el sandbox local nunca contacta Supabase.
- **Rotación**: si una password se filtra, se rota (ej. la del usuario E2E ya
  fue rotada) y el valor nuevo solo vive en `.env.local`.

---

## Deploy en Cloudflare Pages

1. Conectá el repo (build command: `npm run build`, output: `dist`).
2. En **Settings → Environment variables** definí, para producción y preview:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - (opcional) `VITE_DEMO_PASSWORD` si querés la cuenta demo online
3. Guardá. Cloudflare inyecta las variables en el build; **no hace falta**
   ningún `.env.production` en el repo.

---

## Scripts útiles

```bash
npm run dev          # dev server
npm run build        # typecheck (tsc -b) + build de producción
npm run lint         # oxlint
npm run test:e2e     # suite E2E completa
npm run preview      # sirve dist/ en :4173
npm run seed:fetch   # descarga el catálogo de ejercicios → supabase/seed-data.json
npm run seed:db      # sube el catálogo a Supabase (necesita SERVICE_ROLE_KEY)
node scripts/translate-instructions.mjs    # traduce instrucciones al español
node scripts/naturalize-instructions.mjs   # naturaliza el español (voseo)
```
