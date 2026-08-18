# GymTrack — Plan de Implementación UI/UX Mobile-First

Plan de rediseño enfocado en la usabilidad real dentro del gimnasio:
operación a una sola mano, conectividad inestable, pantalla bloqueada y
precisión táctil reducida. Sin cambios de arquitectura backend: todo es
implementable sobre React 19 + Tailwind v4 + Supabase cliente.

---

## 0. Correcciones técnicas YA aplicadas (estado actual)

| Fix | Archivo | Descripción |
| --- | --- | --- |
| Temporizador v2 | `src/components/RestTimer.tsx` | El tiempo restante se calcula siempre como `endAtRef - Date.now()` (timestamp absoluto). Render con `requestAnimationFrame`; listener `visibilitychange` que recomputa al volver de segundo plano y dispara el beep si venció. Inmune al throttle del navegador/sistema. |
| BottomNav móvil | `src/components/Layout.tsx` | Navegación inferior fija con 6 tabs (Inicio, Ejercicios, Rutinas, Historial, Stats, Perfil), iconos SVG 24px, hitbox `min-h-14` (56px ≥ 48px), `safe-area-inset-bottom`, estado activo esmeralda. Topbar móvil fija `h-14`. Sidebar solo desktop (`hidden md:flex`). |
| Logout móvil | `src/pages/Profile.tsx` | Botón "Cerrar sesión" rojo al pie de Perfil (`md:hidden`). |
| Sticky catálogo | `src/pages/Catalog.tsx` | Offset realineado a `top-14` por la nueva topbar. |
| Hitboxes | `RestTimer`, `Layout`, `Profile` | Botones de descanso y nav con `min-h-11`/`min-h-12`/`min-h-14`. |

---

## 1. Rediseño del módulo "Entrenar" (Sesión Activa)

### 1.1 Layout de registro rápido (una mano)

**Objetivo:** minimizar toques por serie y el desplazamiento del pulgar.

- **Fila = botón completo**: cada serie es una fila tappable de 56px.
  Tappeo principal en la fila = marcar completada (toggle visual inmediato:
  fila atenuada + check esmeralda + `navigator.vibrate(30)` haptic).
- **Steppers gigantes**: peso y reps con botones `−`/`+` de 44×44px en los
  extremos (incrementos: +2.5 kg / +1 rep). Toque directo en el número abre
  teclado numérico nativo (`inputMode="decimal"`, `autofocus`).
- **Auto-avance**: al completar la serie N, la fila N+1 gana
  `ring-emerald-500` + `scale` sutil y `scrollIntoView({ block: 'nearest' })`.
- **Set actual persistente**: `activeSet` guardado en localStorage por sesión;
  al volver de bloqueo la fila activa queda donde estaba.
- Zona de input concentrada en la mitad inferior (accesible con el pulgar);
  header de ejercicio compacto arriba.

**Archivos:** `src/pages/Train.tsx` (SetRow v2), posible extracción a
`src/components/SetRow.tsx`.

### 1.2 Temporizador a prueba de segundo plano

Ya corregido (ver §0). Complementos de campo:

- **Wake Lock API**: `navigator.wakeLock.request('screen')` durante la sesión,
  con fallback silencioso si no soportado. Limpiar en cleanup.
- **Beep + vibración** al llegar a 0 (audio existente + `navigator.vibrate([200,100,200])`).
- Botón **"+30s"** de 48px para extender el descanso en curso.
- El temporizador se renderiza junto a la **fila activa**, no arriba de todo.

**Archivos:** `src/components/RestTimer.tsx`, `src/hooks/useWakeLock.ts` (nuevo).

### 1.3 Guardado optimista con cola de sync

**Objetivo:** cero pérdida de datos con señal caída dentro del gimnasio.

- **`src/lib/sync.ts`** (nuevo):
  - Toda mutación pasa por `enqueue(op)` → se aplica al estado local
    **inmediatamente** → intento de `flush()` a Supabase.
  - Cola **persistida en localStorage** (`gymtrack-pending`): cada op tiene
    `{ id, kind, payload, retries }`.
  - Reintentos exponenciales (1s → 2s → 5s → 15s, cap) + triggers en
    `window 'online'` y `visibilitychange`.
  - **IDs optimistas**: `crypto.randomUUID()` como id temporal; al confirmar
    el flush se reemplaza por el id del servidor (extender el flujo actual que
    ya adopta el id real tras upsert).
- **`SyncStatus`** (`src/components/SyncStatus.tsx`, nuevo): chip global no
  bloqueante — `✓ Sincronizado` / `⏳ Sincronizando…` / `⚠ Sin conexión · N pendientes`.
- **Nunca** un modal de "error de red" durante el entrenamiento.
- Mutaciones en cola: `upsertSessionSet`, `finishSession`, `saveBodyMetric`.

**Archivos:** `src/lib/sync.ts`, `src/components/SyncStatus.tsx`,
`src/pages/Train.tsx`, `src/pages/History.tsx`, `src/pages/Profile.tsx`.

---

## 2. Eliminación de antipatrones táctiles

### 2.1 `confirm()` → Dialog propio

- **`src/components/Dialog.tsx`** (nuevo): bottom-sheet en mobile / centered en
  desktop (mismo patrón que `AddExerciseModal`), texto de acción, botón
  secundario "Cancelar" y primario destructivo rojo, hitboxes 48px.
- Reemplaza los 4 `confirm()` actuales:
  - `Routines.tsx` → eliminar rutina
  - `RoutineDetail.tsx` → eliminar día, quitar ejercicio
  - (nuevo) borrar serie en `Train.tsx`

### 2.2 Hover-reveal → acciones siempre visibles

- ✕ de rutinas: `opacity-100` en mobile, hover-reveal solo en `md+`
  (`md:opacity-0 md:group-hover:opacity-100`).

### 2.3 Swipe actions (opcional, sin librerías)

- `src/components/SwipeRow.tsx` (nuevo): pointer events (touchstart/move/end)
  para swipe izquierdo que revela "Quitar" rojo. Fallback: ✕ visible.
  Aplicar a filas de ejercicio en `RoutineDetail.tsx`.

### 2.4 Modales adaptados

- `AddExerciseModal`: ya bottom-sheet en mobile; agregar badges de
  nivel/equipo/categoría en cada resultado.
- **Bottom-sheet "Nota de serie"**: long-press (o botón ⋯) en una fila de
  `Train.tsx` → sheet con textarea (`session_sets.notes` ya existe en schema)
  + indicador de nota en la fila.

### 2.5 Audit de hitboxes (48px)

- SetRow filas (56px), steppers (44px+), RestTimer (hecho), NavLink (hecho),
  botones de sensación del cierre de sesión, botones de `Dialog`.

---

## 3. Dashboard ↔ Rutinas

### 3.1 Tarjeta "Próxima sesión"

- Nueva query `fetchNextSession(userId)` en `src/lib/db.ts`: rutinas +
  `routine_days` con `weekday` no nulo → próximo día de la semana desde hoy
  (loop 7 días) → `{ dayId, nombre, weekday, nEjercicios, rutina }`.
- **Card hero** esmeralda (jerarquía mayor que las stat cards):
  "Próxima: Push · Miércoles · 5 ejercicios" + CTA "Entrenar ▶"
  (link directo a `/entrenar/:dayId`).
- **Sesión en curso**: si existe una sesión activa sin finalizar, la card
  muestra "Sesión en curso" + CTA "Retomar" (caso de uso principal en el
  gimnasio).
- Sin días con weekday → empty state con CTA a rutinas + hint "Configurá el
  día de la semana para recibir sugerencias".

### 3.2 Jerarquía sin recargas

- **Peso reciente**: chip compacto "Último peso: 84.2 kg (hoy)" → link a `/perfil`.
- **Tendencia semanal**: ▲/▼ vs semana anterior en las stat cards
  (`fetchWeeklyMuscleVolume` con `weekStart` desplazado 7 días).
- **Stale-while-revalidate**: refetch silencioso al volver de background
  (`visibilitychange`) para que el Dashboard esté fresco al desbloquear.

**Archivos:** `src/lib/db.ts`, `src/pages/Dashboard.tsx`.

---

## 4. Sistema de estados y retroalimentación

### 4.1 Errores de red unificados

- **`src/lib/toast-context.tsx` + `src/components/Toast.tsx`** (nuevos):
  cola de toasts (éxito/error/info), auto-dismiss 4s, apilados sobre el
  BottomNav, `safe-area` respetado. Montar el provider en `src/App.tsx`.
- Regla: **errores transitorios → nunca modal**; la cola de sync trabaja
  silenciosa. Error definitivo (RLS/401, schema) → toast error con acción
  "Reintentar".
- **Sesión expirada**: interceptor en `src/lib/db.ts` — error 401 → toast
  "Sesión expirada" + redirect a `/login` (hoy se pierde en `console.error`).

### 4.2 Skeletons y empty states que guían

- Skeletons **isomórficos** al layout final (misma grilla, sin layout shift) —
  estandarizar en los lugares que falten (Train loading, RoutineDetail).
- Todo empty state con **una sola acción primaria**:
  - Dashboard sin sesiones → "Ir a mis rutinas" (hecho).
  - Rutinas sin días → form "Agregar día" con `autofocus` + hint.
  - Catálogo sin resultados → botón "Limpiar filtros" (hoy texto estático).
  - Progreso sin datos → CTA a rutinas + copy "Entrená este ejercicio y seguí
    acá tu evolución".

---

## 5. Orden de implementación

| # | Tarea | Depende de | Estado |
| --- | --- | --- | --- |
| 1 | `sync.ts` + `SyncStatus` + `ToastProvider` | — | ✅ `src/lib/sync.ts`, `src/components/SyncStatus.tsx`, `src/lib/toast-context.ts` + `src/components/Toast.tsx`; mutaciones de sets/sesión/peso en cola con uuid cliente e upsert idempotente (verificado: doble envío → 1 fila) |
| 2 | `Dialog.tsx` y reemplazo de los 4 `confirm()` | — | ✅ `src/components/Dialog.tsx` (bottom-sheet mobile / centrado desktop) + `src/lib/use-confirm.tsx`; reemplazados confirm() en Rutinas (eliminar rutina) y RoutineDetail (día, quitar ejercicio); **nuevo** borrado de serie en Train (optimista + cola: `dequeue` cancela el upsert pendiente y encola `session_set_delete`) |
| 3 | SetRow v2 (fila tappable, steppers, auto-avance, haptics) + Wake Lock | 1 (sync de sets) | ✅ SetRow v2 en `src/pages/Train.tsx`: botón número 56px de toggle (✓ + vibrate 30ms), steppers −/+ 44px (±2.5 kg / ±1 rep), inputs con teclado nativo, RPE y ✕ en línea secundaria, fila activa con ring + scale + scrollIntoView; `activeSet` persistido en localStorage por sesión y re-derivado al volver; **`src/hooks/useWakeLock.ts`** (request 'screen' durante la sesión, re-adquiere al liberar, cleanup); RestTimer con estado a nivel módulo (sobrevive a moverse junto a la fila activa), botón **+30s** y vibración `[200,100,200]` al expirar |
| 4 | Card "Próxima sesión" + tendencia semanal + refetch on visibility | — | ✅ Dashboard: `fetchNextSession` (días con weekday, loop 7 días) + `fetchActiveSession` (sesión sin finalizar) + card hero esmeralda ("Próxima: {día} · {rutina} · N ejercicios" / "Sesión en curso · Retomar" / empty con CTA); tendencia ▲/▼ vs semana pasada en Sesiones y Series (segunda query con weekStart −7d); chip "Último peso" → /perfil; refetch silencioso al volver a visible (stale-while-revalidate) |
| 5 | Bottom-sheet nota de serie + SwipeRow + "Limpiar filtros" | 1, 2 | ✅ `src/components/BottomSheet.tsx` (sheet con handle + safe-area) + botón ⋯ por serie en Train (esmeralda si hay nota; guarda `session_sets.notes` vía cola optimista — verificado contra base real); `src/components/SwipeRow.tsx` (pointer events, gate |dx|>|dy|, `touch-action: pan-y`, revela "Quitar" rojo 88px, fallback ✕ intacto) aplicado a filas de ejercicio en RoutineDetail; botón "Limpiar filtros" en el empty state del Catálogo (solo si hay filtros activos) |
| 6 | Audit final de hitboxes y contraste en tema claro | 3, 4, 5 | ✅ Hitboxes: steppers SetRow → 44×44, RPE select 44px, RestTimer/+30s/Detener/ThemeToggle → 48px, ✕ rutinas **siempre visible en mobile** (`md:opacity-0 md:group-hover`), ⚙/✕ día, ↔/✕ ejercicio, ✕ AddExerciseModal, "Entrenar ▶", "+ Agregar", chips y selects de Catálogo, inputs de serie → ≥44px. Contraste claro: emerald-400 → `#047857` (4.9:1), amber-400 → `#b45309` (5.6:1) sobre fondo claro |
| 7 | Fix crash "página en blanco" | — | ✅ Diagnóstico con Edge headless + CDP contra el build real (todas las rutas OK con sesión): el blanco provenía de acceso sin protección a `localStorage`/`crypto` en módulos top-level (modo privado, storage bloqueado, contexto no-seguro). Blindados: `main.tsx` (theme init), `sync.ts` (`persistQueue` try/catch + `genId()` con fallback), `Layout` ThemeToggle, `Train.persistActive`; `genId()` usado en db.ts y Train |

Criterio de aceptación de cada paso: build (`tsc -b && vite build`) + lint
(oxlint) en cero y verificación manual contra la base real.