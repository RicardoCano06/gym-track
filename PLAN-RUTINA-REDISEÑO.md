# Plan: Rediseño de Rutina — Estilo App Móvil

Inspirado en imágenes de referencia (day detail limpio + body map interactivo + grid de ejercicios).

## Referencia visual
- Day detail: nombre día, botón "Iniciar Entrenamiento", estado vacío con ícono, floating button
- Add exercise: overlay full-screen, mapa corporal interactivo (frente/atras), búsqueda, chips, grid 2 columnas
- Mobile-first, theme oscuro, accent emerald (nuestro estilo)

---

## Paso 1: DayCard extraído y rediseñado
**Archivo:** `src/components/DayCard.tsx` (nuevo, extraído de RoutineDetail)
**Archivo:** `src/pages/RoutineDetail.tsx` (simplificado, importa DayCard)

Cambios:
- Extraer DayCard + ExerciseRow a componente propio
- Estado vacío: ícono de mancuerna SVG + "Agregá ejercicios a tu rutina"
- Botón "Iniciar Entrenamiento" (solo si hay ejercicios)
- Floating button "+ Agregar" (abre AddExerciseOverlay)
- Lista de ejercicios con imagen + nombre + config inline
- Mejorar visual: cards con bordes redondeados, sombras sutiles, espaciado

## Paso 2: AddExerciseOverlay
**Archivo:** `src/components/AddExerciseOverlay.tsx` (nuevo, reemplaza AddExerciseInline)

Flujo:
- Full-screen overlay (fixed, z-50, slide-up en mobile)
- Header: botón X (cerrar) + "Agregar ejercicio"
- BodyMap SVG (frente/atras) — seleccionar grupo muscular
- Si grupo seleccionado → mostrar ejercicios de ese grupo en grid
- Si no grupo → estado inicial "Seleccioná un grupo muscular o buscá"
- Input de búsqueda (debounce 250ms)
- Chips: Todos | Grupos Musculares | Equipo
- Grid 2 columnas (3-4 desktop) con cards: imagen + nombre
- Click card → agregar ejercicio al día + toast éxito
- Filtrar ejercicios ya agregados (alreadyAdded)

## Paso 3: BodyMap SVG
**Archivo:** `src/components/BodyMap.tsx` (nuevo)

- SVG simplificado con silueta corporal
- Frente: Hombros, Pectorales, Bíceps, Abdomen, Oblicuos, Antebrazo, Abductores, Aductores, Cuádriceps
- Atrás: Trapecio, Tríceps, Dorsales, Lumbar, Glúteos, Isquiotibiales, Pantorrillas
- Cardio como opción separada
- Cada zona: rect clickeable + label
- Botón "Girar" para cambiar vista
- Seleccionar grupo → onGroupSelect(group)
- Mapeo a nuestros grupos: pecho, espalda, hombros, brazos, pierna, core

## Paso 4: Workout page (básico)
**Archivo:** `src/pages/Workout.tsx` (nuevo)

- Recibe sessionId por URL
- Lista de ejercicios del día con:
  - Imagen + nombre
  - Inputs: series, reps, peso
  - Checkbox "completado"
- Timer entre series (descanso del ejercicio)
- Botón "Finalizar" → actualiza sesión con totales
- Navegación de vuelta a la rutina

## Paso 5: Routing
**Archivo:** `src/App.tsx`

- Agregar ruta `/workout/:sessionId`
- Importar Workout page

---

## Datos existentes
- muscleGroupOrder: ['pecho', 'espalda', 'hombros', 'brazos', 'pierna', 'core']
- categories, equipmentKinds de catalog.ts
- fetchExercises({ search, group, equipmentKind, category }, 0) → { exercises, total }
- fetchMuscleGroups() → string[]
- fetchEquipment() → Equipment[]
- addRoutineExercise(dayId, exerciseId, position) para agregar

## Order de implementación
1. DayCard.tsx (extraer + rediseñar)
2. RoutineDetail.tsx (simplificar, importar DayCard)
3. BodyMap.tsx (SVG simplificado)
4. AddExerciseOverlay.tsx (full-screen con BodyMap + grid)
5. Workout.tsx (básico)
6. App.tsx (routing)
7. Test E2E + build + lint + commit