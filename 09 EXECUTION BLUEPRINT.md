# 09 — EXECUTION BLUEPRINT · Mapa de implementación de la auditoría

**Insumo:** Auditoría técnica y académica de COPPER LAB v2.1 (11 jul 2026, commit `c7d4b1d`) — 24 hallazgos, ranking de 25 mejoras. Informe completo: ver memoria `auditoria-copper-lab-jul2026`.

**Rol de este documento:** transformar el ranking de 25 mejoras en tareas ejecutables por un modelo de IA con capacidad de razonamiento limitada, sin que ese modelo deba tomar ninguna decisión de arquitectura. Este documento **no implementa nada**; es la única fuente de verdad para quien implemente después.

**Cómo leer este documento:** cada recomendación (R01–R25) tiene el mismo esqueleto (Objetivo → Justificación → Dependencias → Impacto → Riesgos → Microtareas → Checkpoint → Rollback). Las recomendaciones R01–R10 y R20/R24 (por decisión explícita, ver §0) tienen el detalle completo; R11–R19 tienen detalle medio; R21/R23/R25 tienen detalle ligero por ser de bajo riesgo y alta autonomía. **Ejecutar en orden. No saltar recomendaciones. No combinar dos recomendaciones en un mismo commit.**

---

## §0 · Decisiones y no-decisiones registradas antes de planificar

Siguiendo la instrucción de no resolver arquitectura no definida, estas son las decisiones que se tomaron (con quién las tomó y por qué) y las que **siguen abiertas**:

| # | Pregunta | Estado | Resolución |
|---|---|---|---|
| D-A | Framework de pruebas | **Resuelto** (no ambiguo) | Vitest — el proyecto ya usa Vite; cero configuración adicional de bundler. |
| D-B | Fixture para los "números dorados" del manual (ARIMA(1,1,0) del Excel del curso ⇒ RMSE≈29.5) | **Abierto** | El Excel del curso está excluido a propósito del repo público (material del curso). Los tests de CI **no pueden** usarlo. Ver R01 — se resuelve con verificación manual documentada, no con un test automatizado de ese número específico. |
| D-C | Heurística de separador decimal (coma vs punto) en el parser | **Resuelto por defecto, confirmar antes de R02** | Ver R02 — regla de 3 dígitos estándar; el dueño del producto debe confirmar el formato real de los archivos que subirán los estudiantes antes de fijar la heurística en piedra. |
| D-D | Superficie de UI para "autoajustar sin fuga" (R06) | **Resuelto** | Botones nuevos y locales a la pestaña 07 (no se tocan las pestañas 03/04, respetando la regla de oro ya existente del proyecto). |
| D-E | Exposición histórica en git de material privado (GUION DE CLASE.md, BANCO DE PREGUNTAS.md) | **Abierto, requiere verificación previa** | Ver R10-T4. Si esos archivos fueron commiteados alguna vez, R10 no los limpia de la historia — eso es una operación aparte, más peligrosa, fuera de este alcance. |
| D-F | Enfoque de estacionalidad (R20) | **Resuelto por el dueño del producto** | Kernel periódico opcional en el GPR (ver R20 completo). Las otras dos rutas (p hasta 12; dummies estacionales en ARIMAX) quedan registradas como alternativas más baratas pero no se implementan en esta pasada. |
| D-G | Alcance de "pronóstico real a futuro" (R24) | **Resuelto con supuestos explícitos** | Ver R24 — supuestos declarados sobre covariables futuras y horizonte; el dueño del producto los confirmó como aceptables para descomponer. |
| D-H | Errores estándar de los β en ARIMAX (R11/R12) | **Resuelto** | OLS clásico + nota de limitación (texto exacto provisto por el dueño del producto, ver R12). Sin HAC/Newey-West en esta versión. |
| D-I | Cifra exacta del techo de filas en importación (R05) | **Resuelto con valor por defecto, no bloqueante** | 2.000 filas. No se bloquea la planificación por esto: es un valor conservador y fácilmente ajustable (una constante). |
| D-J | Versión exacta del paquete xlsx a instalar (R04) | **Abierto, resolver en tiempo de ejecución** | Consultar `https://cdn.sheetjs.com/` por la última release estable de la serie 0.20.x al momento de ejecutar R04 — no fijar un número de versión de memoria. |

---

## §1 · Resumen ejecutivo

25 recomendaciones agrupadas en 4 oleadas. La oleada 0 (R01) es un prerrequisito duro de todo lo demás: sin red de pruebas, cualquier cambio posterior no es verificable de forma segura. La oleada 1 (R02–R10) contiene los hallazgos de gravedad **Alta** de la auditoría — integridad de datos, seguridad de dependencias, y la fuga metodológica del flujo insignia — y debe completarse antes de promover la app para uso con datos propios. Las oleadas 2 (R11–R20) y 3 (R21–R25) son mejoras de calidad metodológica y de experiencia, de menor urgencia.

**Regla de ejecución no negociable:** cada recomendación se implementa, se valida en su checkpoint, y se hace commit **antes** de empezar la siguiente. Si un checkpoint falla, se ejecuta el rollback de esa recomendación y se detiene el proceso hasta que un humano revise — el ejecutor no debe "seguir adelante e intentar arreglarlo con la siguiente tarea".

---

## §2 · Dependencias globales

- Node 20, npm (ya en el repo — ver `.github/workflows/deploy.yml`).
- Ninguna recomendación de la oleada 1 requiere backend, cuenta externa ni credenciales nuevas.
- R10-T2 requiere una carpeta hermana fuera del repositorio (`../copper-lab-privado/` o similar) — debe existir o crearse antes de mover archivos.
- R04 requiere acceso de red a `cdn.sheetjs.com` en tiempo de instalación (y en el runner de CI del workflow de deploy).

## §3 · Riesgos globales

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Un cambio de una recomendación rompe silenciosamente el resultado numérico de otra pestaña | Media | Alto | R01 debe estar verde antes y después de cada recomendación de la oleada 1 en adelante — es la razón de que R01 sea la oleada 0. |
| El ejecutor combina varias recomendaciones en un solo commit y un checkpoint fallido obliga a revertir más de lo necesario | Media | Medio | Un commit por recomendación, nunca por microtarea suelta a medio terminar y nunca por oleada completa. |
| El ejecutor "mejora" código fuera del alcance de la tarea (refactor no pedido) | Media | Medio | Cada microtarea lista "Archivos prohibidos" explícitamente; el ejecutor no tiene autorización para tocar nada fuera de "Archivos permitidos". |
| Cambios en `calculateMetrics` (R08) rompen consumidores no previstos | Media | Alto | R08-T2 lista explícitamente los 6 call-sites conocidos; el checkpoint de R08 exige `grep` de todos los usos de `calculateMetrics` antes de cerrar la tarea. |
| R10-T2 mueve archivos que resultan estar referenciados desde otro lugar (ej. un script) | Baja | Medio | R10-T4 exige `git grep` de los nombres de archivo movidos antes de confirmar. |

## §4 · Roadmap general

```
Oleada 0 (bloqueante, secuencial)
  R01 — Suite de pruebas + puerta en CI
        │
        ▼
Oleada 1 — P0, orden estrictamente secuencial recomendado
  R02 → R03 → R04 → R05 → R06 → R07 → R08 → R09 → R10
        │
        ▼
Oleada 2 — P1, orden estrictamente secuencial recomendado
  R11 → R12 → R13 → R14 → R15 → R16 → R17 → R18 → R19 → R20
        │
        ▼
Oleada 3 — P2, orden estrictamente secuencial recomendado
  R21 → R22 → R23 → R24 → R25
```

Pares teóricamente paralelizables (anotados solo como optimización para un ejecutor más sofisticado o varios agentes — **el camino recomendado por defecto es secuencial estricto**, porque este documento asume un ejecutor de baja capacidad de razonamiento):
- R04 (solo `package.json`) es independiente de todo R02/R03/R05 (solo `parser.ts`).
- R11 y R12 comparten archivo (`arimax.ts`, `ArimaxView.tsx`) — no paralelizar entre sí.
- R18 y R19 son independientes entre sí.

---

# OLEADA 0

## R01 · Suite de pruebas + puerta de calidad en CI

**Prioridad:** P0 · **Origen:** hallazgo B4 · **Impacto esperado:** muy alto · **Dificultad:** media

### Objetivo
Que exista una red de pruebas automatizada que (a) confirme hoy la garantía que el manual ya afirma (equivalencia fit/forecast) y (b) impida que un cambio futuro la rompa sin que nadie lo note, incluyendo en el propio pipeline de deploy.

### Justificación
Esta auditoría reimplementó manualmente la verificación de consistencia y confirmó que se cumple (diferencia máxima 8,9×10⁻¹⁶), pero el script no existe en el repositorio. El manual (`08 MANUAL.md` §3.9) afirma la garantía como si estuviera protegida; hoy no lo está. Sin esta base, **ninguna otra recomendación de este documento es segura de implementar** — de ahí que sea la única oleada bloqueante.

### Dependencias
Ninguna. Es el punto de partida.

### Impacto
- Módulos afectados: ninguno de producción — solo se agregan archivos nuevos de test y configuración.
- Módulos que NO deben modificarse: cualquier archivo bajo `src/models/`, `src/views/`, `src/data/`, `src/state/`, `src/components/`. Esta recomendación **prohíbe cambiar comportamiento**, solo agrega verificación sobre el comportamiento actual.

### Riesgos
- **Técnico:** ninguno relevante — es código aditivo.
- **Funcional:** ninguno — no cambia la app.
- **Regresión:** ninguno — pero si algún test falla al escribirlo, **eso no es un bug de esta tarea**: es evidencia de que el comportamiento actual difiere de lo documentado, y debe reportarse como hallazgo, no "arreglarse" dentro de R01 (R01 no tiene permiso para tocar `src/models/*.ts`).

### Microtareas

#### R01-T1 · Instalar y configurar Vitest
- **Objetivo:** tener `npm test` funcionando, sin pruebas todavía.
- **Alcance:** agregar `vitest` a devDependencies; crear `vitest.config.ts` mínimo (o reutilizar `vite.config.ts` con el bloque `test`); agregar script `"test": "vitest run"` a `package.json`.
- **Contexto mínimo:** leer `package.json` y `vite.config.ts` actuales. No hace falta leer ningún archivo de `src/`.
- **Archivos permitidos:** `package.json`, `package-lock.json`, `vitest.config.ts` (nuevo).
- **Archivos prohibidos:** todo `src/`.
- **Dependencias:** ninguna.
- **Complejidad:** baja. **Riesgo:** bajo. **Tiempo estimado:** 20 min.
- **Criterios de aceptación:** `npm test` corre y reporta "no test files found" sin error de configuración.
- **Evidencia esperada:** salida de terminal de `npm test`.

#### R01-T2 · Tests de consistencia fit/forecast (con dataset sintético únicamente)
- **Objetivo:** codificar la verificación que el manual da por hecha.
- **Alcance:** crear `src/models/forecast.consistency.test.ts`. Para cada combinación `(p,d) ∈ {(1,0),(2,1),(6,2),(3,1)}`: comparar `fitArima(y,p,d).fitted` contra `arimaxForecast(y,[],p,d,n).fitted` con `n = y.length`, tolerancia `1e-9`. Repetir para `fitArimax` vs `arimaxForecast` con exógenas de 2 columnas. Repetir para `fitGpr` vs `gprForecast(y,params,n,2)`. Repetir para `fitHybrid` vs `hybridForecast(...,n,2)`. Usar `generateSyntheticData(42, 0.1)` como única fuente de datos (determinista, ya en el repo).
- **Contexto mínimo:** `src/models/arima.ts`, `src/models/arimax.ts`, `src/models/gpr.ts`, `src/models/hybrid.ts`, `src/models/forecast.ts`, `src/data/generator.ts`. No hace falta leer ninguna vista (`src/views/`).
- **Archivos permitidos:** `src/models/forecast.consistency.test.ts` (nuevo, único archivo).
- **Archivos prohibidos:** cualquier archivo de implementación (`.ts` que no termine en `.test.ts`).
- **Dependencias:** R01-T1.
- **Complejidad:** media. **Riesgo:** bajo. **Tiempo estimado:** 1.5 h.
- **Criterios de aceptación:** todos los casos pasan con la implementación actual (si alguno falla, detener y reportar — no es un bug a arreglar aquí).
- **Evidencia esperada:** salida de `npm test` en verde para este archivo.

#### R01-T3 · Tests del parser (comportamiento ACTUAL, antes de R02)
- **Objetivo:** fijar una fotografía del comportamiento actual del parser para poder comparar antes/después de R02/R03/R05.
- **Alcance:** crear `src/data/parser.test.ts`. Casos: fila con precio vacío se omite; precio no numérico rechaza con error; precio ≤0 rechaza con error; archivo vacío rechaza; columnas de covariables ausentes rellenan con los defaults documentados (2.5/100/4/100/0.7); **incluir explícitamente un caso que hoy pasa incorrectamente** — `price: "4,23"` hoy se interpreta como `4` (aserción que documenta el bug B1, no lo corrige — se corregirá en R02, donde este mismo test se actualizará).
- **Contexto mínimo:** `src/data/parser.ts` completo.
- **Archivos permitidos:** `src/data/parser.test.ts` (nuevo).
- **Archivos prohibidos:** `src/data/parser.ts` (no se toca la implementación en esta tarea).
- **Dependencias:** R01-T1.
- **Complejidad:** baja. **Riesgo:** bajo. **Tiempo estimado:** 45 min.
- **Criterios de aceptación:** todos los casos, incluido el que documenta el bug, pasan contra el código actual.
- **Evidencia esperada:** salida de `npm test`.

#### R01-T4 · Tests de `metrics.ts`
- **Objetivo:** cubrir los casos borde que R08 va a modificar.
- **Alcance:** crear `src/models/metrics.test.ts`. Casos: array vacío, longitudes distintas, `y` con ceros (para MAPE), caso normal con RMSE/MAE/MAPE/R² conocidos a mano (usar un ejemplo de 3-4 puntos calculado manualmente en el propio test, no traído de otro lado).
- **Contexto mínimo:** `src/models/metrics.ts`.
- **Archivos permitidos:** `src/models/metrics.test.ts` (nuevo).
- **Archivos prohibidos:** `src/models/metrics.ts`.
- **Dependencias:** R01-T1.
- **Complejidad:** baja. **Riesgo:** bajo. **Tiempo estimado:** 30 min.
- **Criterios de aceptación:** pasa contra el comportamiento actual (incluyendo que hoy `n=0` devuelve ceros, no null — eso se documenta, se cambia en R08).
- **Evidencia esperada:** salida de `npm test`.

#### R01-T5 · Puerta de calidad en el pipeline de deploy
- **Objetivo:** que un cambio que rompe los tests no llegue a publicarse.
- **Alcance:** en `.github/workflows/deploy.yml`, agregar un paso `run: npm test` entre `npm ci` y `npm run build` en el job `build`.
- **Contexto mínimo:** `.github/workflows/deploy.yml` completo (20 líneas).
- **Archivos permitidos:** `.github/workflows/deploy.yml`.
- **Archivos prohibidos:** cualquier otro archivo.
- **Dependencias:** R01-T1, R01-T2, R01-T3, R01-T4 (deben existir y pasar localmente antes de exigirlo en CI).
- **Complejidad:** baja. **Riesgo:** bajo (si los tests están mal escritos, esto podría bloquear deploys legítimos — por eso depende de que las 4 tareas anteriores ya estén verdes). **Tiempo estimado:** 15 min.
- **Criterios de aceptación:** un push de prueba con un test roto a propósito (revertido después) confirma que el job `build` falla y no llega a `deploy`.
- **Evidencia esperada:** captura o log del Action fallando en el paso de test cuando corresponde, y pasando cuando el código está sano.

### Checkpoint R01
- **Validar:** `npx tsc --noEmit` limpio · `npm test` — 4 archivos, todos verdes · `npm run build` exitoso.
- **Evidencia esperada:** salida de terminal de las tres órdenes.
- **Condición para continuar:** las tres en verde. Si `R01-T2` falla contra el código actual, **detener todo el proceso** — significa que la premisa central de esta auditoría (la equivalencia numérica) no se sostiene en el estado actual del repo, y ninguna recomendación posterior puede asumirla.

### Rollback
- Todos los cambios son archivos nuevos + una línea en `package.json`/`deploy.yml`. Revertir: `git revert` del commit de R01, o borrar los 4 archivos `.test.ts` + `vitest.config.ts` + la línea de script + el paso del workflow.
- No hay pruebas que repetir (es la primera tarea).

---

# OLEADA 1 — Prioridad P0

## R02 · Parser consciente de locale (coma decimal)

**Origen:** hallazgo B1 · **Impacto:** muy alto · **Dificultad:** baja

### Objetivo
Que un archivo con `"4,23"` en la columna de precio se interprete como 4.23 (o se rechace explícitamente), nunca como 4 en silencio.

### Justificación
Verificado: `parseFloat("4,23") === 4` en JavaScript, sin NaN. Es el formato decimal nativo del público hispanohablante del curso. Hoy corrompe datos sin ninguna señal de error.

### Dependencias
R01-T3 (tests del parser, fotografía del comportamiento actual) debe existir y estar en verde.

### Impacto
- Módulos afectados: `src/data/parser.ts` únicamente.
- Módulos que NO deben modificarse: `src/data/generator.ts`, cualquier vista, `src/state/`.

### Riesgos
- **Técnico:** una heurística mal calibrada podría rechazar formatos legítimos (ej. `"1,234"` en inglés como miles vs `"1,234"` en español como decimal con error tipográfico). Mitigado por la regla de 3 dígitos (ver abajo) y por D-C (confirmar con el dueño del producto el formato real esperado antes de cerrar esta tarea en producción — no bloqueante para implementar, sí para dar por "cerrado" el ajuste fino).
- **Funcional:** ninguno si la regla se implementa como se especifica.
- **Regresión:** el test de R01-T3 que documentaba el bug debe **actualizarse** (no borrarse) para reflejar el comportamiento correcto — ver R02-T1.

### Regla de parseo (algoritmo exacto — no hay margen de interpretación para el ejecutor)

```
función parseLocaleNumber(raw: string) → number:
  s = raw.trim()
  si s coincide con /^-?\d+$/         → return Number(s)                      // entero puro
  tieneComa = s.incluye(',')
  tienePunto = s.incluye('.')
  si tieneComa y tienePunto:
      // el separador que aparece MÁS A LA DERECHA es el decimal
      si posición última coma > posición último punto:
          s' = quitar todos los '.' de s, luego reemplazar ',' por '.'
      si no:
          s' = quitar todas las ',' de s
      return Number(s')                 // si Number() da NaN, es inválido — no reintentar con otra regla
  si tieneComa (sin punto):
      grupos = s.split(',')
      si grupos.length >= 2 y TODOS los grupos después del primero tienen exactamente 3 dígitos:
          → tratar coma como separador de miles: s' = grupos.join('')
      si no:
          → tratar la ÚLTIMA coma como separador decimal: s' = reemplazar esa coma por '.', quitar comas anteriores si las hubiera
      return Number(s')
  si tienePunto (sin coma):
      return Number(s)                  // comportamiento actual, sin cambios
  si no tiene ni coma ni punto:
      return Number(s)
```

Con esta regla: `"4,23"` → 4.23 (una coma, un grupo de 2 dígitos después ⇒ decimal). `"1,234"` → 1234 (un grupo de exactamente 3 dígitos ⇒ miles). `"1.234,56"` → 1234.56 (coma más a la derecha ⇒ decimal). `"1,234.56"` → 1234.56 (punto más a la derecha ⇒ decimal). Usar siempre `Number()`, nunca `parseFloat()`, para el valor final: si queda basura en el string, `Number()` devuelve `NaN` en vez de truncar en silencio — esto cierra a la vez el caso "coma decimal" y el caso general "texto parcialmente numérico".

### Microtareas

#### R02-T1 · Escribir los casos de prueba esperados (deben fallar contra el código actual)
- **Objetivo:** TDD — fijar el comportamiento correcto antes de tocar la implementación.
- **Alcance:** en `src/data/parser.test.ts` (creado en R01-T3), **actualizar** el caso que documentaba el bug (`"4,23"` → hoy 4, correcto debería ser 4.23) y agregar: `"1,234"` → 1234, `"1.234,56"` → 1234.56, `"1,234.56"` → 1234.56, `"abc123"` → rechazado (NaN), `"4.23abc"` → rechazado (hoy `parseFloat` lo aceptaría como 4.23; con `Number()` debe rechazarse).
- **Contexto mínimo:** el archivo de test existente de R01-T3.
- **Archivos permitidos:** `src/data/parser.test.ts`.
- **Archivos prohibidos:** `src/data/parser.ts`.
- **Dependencias:** R01-T3.
- **Complejidad:** baja. **Riesgo:** bajo. **Tiempo:** 30 min.
- **Criterios de aceptación:** los tests nuevos existen y **fallan** (rojo) contra el `parser.ts` actual — confirma que capturan el bug real.
- **Evidencia esperada:** salida de `npm test` mostrando los fallos esperados.

#### R02-T2 · Implementar `parseLocaleNumber` y conectarlo
- **Objetivo:** hacer pasar los tests de R02-T1.
- **Alcance:** agregar la función `parseLocaleNumber` (algoritmo exacto de arriba) en `parser.ts`; reemplazar los 6 usos de `parseFloat(String(...))` en `validateRows` (precio, growth, usd, stocks, libor, partLargas) por `parseLocaleNumber(String(...))`.
- **Contexto mínimo:** `src/data/parser.ts` completo, específicamente `validateRows` líneas donde aparecen `rawPrice`, `rawGrowth`, `rawUsd`, `rawStocks`, `rawLibor`, `rawPartLargas`.
- **Archivos permitidos:** `src/data/parser.ts`.
- **Archivos prohibidos:** cualquier otro archivo.
- **Dependencias:** R02-T1.
- **Complejidad:** baja. **Riesgo:** medio (toca el corazón del parser; mitigado por tests). **Tiempo:** 1 h.
- **Criterios de aceptación:** todos los tests de `parser.test.ts` pasan (los de R01-T3 no afectados por el cambio de regla + los nuevos de R02-T1).
- **Evidencia esperada:** `npm test` en verde completo.

### Checkpoint R02
- **Validar:** `npm test` verde · `tsc --noEmit` limpio · manual: importar un CSV de prueba con `price` en formato `"4,23"` en el preview y confirmar que se lee como 4.23 (no 4).
- **Evidencia esperada:** captura de la app mostrando el precio correcto tras importar.
- **Condición para continuar:** todo lo anterior en verde.

### Rollback
- Revertir el commit de R02. Repetir R01-T3 (los tests de esa tarea deben volver a pasar con la implementación anterior si se revierte todo junto).

---

## R03 · Señalizar covariables rellenadas por defecto

**Origen:** hallazgo C1 · **Impacto:** alto · **Dificultad:** media

### Objetivo
Que la interfaz distinga visualmente entre una covariable con datos reales del archivo importado y una covariable rellenada con una constante porque la columna no existía.

### Justificación
Hoy `parser.ts` rellena crecimiento/dólar/stocks/libor/partLargas con valores fijos sin que ninguna vista lo sepa. Un estudiante puede "medir importancia" o activar checkboxes de ARIMAX sobre columnas que son constantes inventadas, sin ninguna señal.

### Dependencias
R02 completo (mismo archivo, evitar tocar `parser.ts` dos veces en paralelo).

### Impacto
- Módulos afectados: `src/data/parser.ts` (tipo de retorno), `src/data/useDataset.ts` (propagar el dato), `src/App.tsx` (mostrar el aviso), `src/views/ArimaxView.tsx` (deshabilitar/anotar checkboxes), `src/views/ValidationView.tsx` (anotar la lista de importancia de variables ML).
- Módulos que NO deben modificarse: `src/models/*` (ningún modelo cambia su cálculo — esto es puramente informativo/UI), `src/data/generator.ts` (el dataset sintético siempre tiene todas las columnas "reales" por definición — debe devolver `detectedColumns` todo en `true`).

### Riesgos
- **Técnico:** cambiar el tipo de retorno de `parseFile`/`validateRows` (`ParseResult`) tiene 2 consumidores conocidos (`useDataset.ts`, y el propio `parser.ts` en su exportación) — bajo, pero hay que revisar ambos.
- **Funcional:** ninguno en el cálculo; solo en lo que se muestra.
- **Regresión:** ninguna esperada si se sigue el alcance exacto.

### Microtareas

#### R03-T1 · Extender `ParseResult` con `detectedColumns`
- **Objetivo:** que el parser informe qué columnas encontró, no solo los valores ya rellenados.
- **Alcance:** en `parser.ts`, agregar a `ParseResult` (cuando `success: true`) un campo `detectedColumns: { date: boolean; globalGrowth: boolean; usdIndex: boolean; stocks: boolean; libor: boolean; partLargas: boolean }` (precio no entra porque siempre es obligatorio y detectado). Calcularlo dentro de `validateRows` a partir de si `findValue(row, XXX_ALIASES)` fue `undefined` para la primera fila válida (o, más robusto: si fue `undefined`/vacío para **todas** las filas, ya que columnas parcialmente presentes son un caso raro no cubierto por el alcance de esta tarea — documentarlo como limitación conocida en un comentario corto).
- **Contexto mínimo:** `src/data/parser.ts` completo.
- **Archivos permitidos:** `src/data/parser.ts`.
- **Archivos prohibidos:** todo lo demás.
- **Dependencias:** R02-T2.
- **Complejidad:** baja. **Riesgo:** bajo. **Tiempo:** 45 min.
- **Criterios de aceptación:** test nuevo en `parser.test.ts`: un CSV sin columna `usd` produce `detectedColumns.usdIndex === false`; uno con la columna, `true`.
- **Evidencia esperada:** `npm test` verde.

#### R03-T2 · Propagar `detectedColumns` a través de `useDataset`
- **Objetivo:** que el resto de la app pueda leer qué se detectó.
- **Alcance:** en `useDataset.ts`, guardar el `detectedColumns` del último `parseFile` exitoso en un `useState`; para el dataset sintético (`isImported === false`), exponer `detectedColumns` con todos los campos en `true`; exponerlo en el objeto que devuelve el hook.
- **Contexto mínimo:** `src/data/useDataset.ts` completo (43 líneas).
- **Archivos permitidos:** `src/data/useDataset.ts`.
- **Archivos prohibidos:** `src/App.tsx` (todavía no — eso es R03-T3).
- **Dependencias:** R03-T1.
- **Complejidad:** baja. **Riesgo:** bajo. **Tiempo:** 30 min.
- **Criterios de aceptación:** `tsc --noEmit` limpio; el hook expone `detectedColumns` con el shape correcto en ambos casos (sintético e importado).
- **Evidencia esperada:** captura de tipos en el editor o `tsc` limpio.

#### R03-T3 · Banner "detectado / sin datos" en la barra de dataset
- **Objetivo:** mostrar de forma visible qué se detectó tras importar.
- **Alcance:** en `App.tsx`, debajo de la barra de dataset existente, cuando `dataset.isImported`, renderizar una línea: "Detectado: precio, fecha, crecimiento · Sin datos (rellenado): dólar, libor, posición especulativa" usando `dataset.detectedColumns`.
- **Contexto mínimo:** `src/App.tsx` completo, específicamente el bloque de la barra de dataset (líneas ~48–143).
- **Archivos permitidos:** `src/App.tsx`.
- **Archivos prohibidos:** cualquier archivo en `src/views/`.
- **Dependencias:** R03-T2.
- **Complejidad:** baja. **Riesgo:** bajo. **Tiempo:** 45 min.
- **Criterios de aceptación:** manual — importar un CSV con solo precio y fecha, confirmar que el banner lista las 5 covariables como "sin datos".
- **Evidencia esperada:** captura de pantalla del banner.

#### R03-T4 · Deshabilitar y anotar checkboxes de ARIMAX para columnas no detectadas
- **Objetivo:** impedir activar una covariable inventada sin que el usuario lo note.
- **Alcance:** en `ArimaxView.tsx`, para cada `def` de `EXOG_DEFS`, si `!dataset.detectedColumns[def.key]` (requiere pasar `detectedColumns` como prop desde `App.tsx` a la vista activa, o subir el dato al contexto — usar la vía más simple: pasar como prop adicional junto a `data`), deshabilitar el checkbox y agregar el sufijo " (sin datos — usa un valor constante)" a su etiqueta.
- **Contexto mínimo:** `src/views/ArimaxView.tsx` completo, `src/state/exogDefs.ts` (para `EXOG_DEFS`), y el punto donde `App.tsx` invoca `<ActiveComponent data={dataset.data} />` (necesita pasar una prop nueva).
- **Archivos permitidos:** `src/views/ArimaxView.tsx`, `src/App.tsx` (solo la línea que invoca `ActiveComponent` y la definición de la prop que reciben las vistas — no otras vistas).
- **Archivos prohibidos:** `src/views/StructuralView.tsx`, `src/views/ArimaView.tsx`, `src/views/GprView.tsx`, `src/views/HybridView.tsx`, `src/views/ComparatorView.tsx` (estas vistas no reciben la prop nueva en esta tarea — si `tsc` se queja de props faltantes, es porque el tipo de prop común se hizo obligatorio; hacerlo opcional con default para no forzar cambios en las demás vistas).
- **Dependencias:** R03-T3.
- **Complejidad:** media. **Riesgo:** medio (toca la firma de props compartida entre vistas — mantenerla opcional). **Tiempo:** 1.5 h.
- **Criterios de aceptación:** manual — con un CSV sin columna dólar, el checkbox "Incluir Índice Dólar" aparece deshabilitado y anotado.
- **Evidencia esperada:** captura de pantalla.

#### R03-T5 · Anotar la lista de importancia de variables (ML) en ValidationView
- **Objetivo:** mismo tratamiento que R03-T4 pero para el panel de ablación de la pestaña 07.
- **Alcance:** en `ValidationView.tsx`, al construir `ablatable` (la lista de covariables para ablación cuando `v.model` es ridge/knn/forest), anotar con "(sin datos)" las que `!detectedColumns[key]`; no es necesario deshabilitar nada aquí (la ablación de una constante ya da `delta≈0`, que es informativo por sí solo — solo falta la etiqueta).
- **Contexto mínimo:** `src/views/ValidationView.tsx`, específicamente `runImportance` y `ML_FEATURE_DEFS` en `src/models/ml.ts` (solo lectura, no se modifica `ml.ts`).
- **Archivos permitidos:** `src/views/ValidationView.tsx`.
- **Archivos prohibidos:** `src/models/ml.ts`.
- **Dependencias:** R03-T4.
- **Complejidad:** baja. **Riesgo:** bajo. **Tiempo:** 30 min.
- **Criterios de aceptación:** manual — con un CSV sin libor, el gráfico de importancia muestra "libor (sin datos)" en el eje.
- **Evidencia esperada:** captura de pantalla.

### Checkpoint R03
- **Validar:** `npm test` verde · `tsc --noEmit` limpio · manual completo: importar un CSV con solo `price`+`date`, confirmar banner, checkboxes deshabilitados en 03, etiqueta "(sin datos)" en la ablación de 07.
- **Condición para continuar:** los 4 puntos manuales confirmados con captura.

### Rollback
Revertir el commit de R03 completo (todas las tareas de R03 se commitean juntas al cerrar la recomendación, no una por una — el estado intermedio entre T1 y T5 no es un estado consistente para dejar a medias entre sesiones distintas de trabajo).

---

## R04 · Actualizar SheetJS a la versión sin CVEs

**Origen:** hallazgo B2 · **Impacto:** alto · **Dificultad:** baja

### Objetivo
Eliminar las 2 vulnerabilidades *high* (Prototype Pollution, ReDoS) de la librería que procesa los archivos que el usuario importa.

### Justificación
`npm audit` confirma ambas, sin fix disponible en el registro npm porque SheetJS distribuye las versiones parcheadas (≥0.20.2) solo desde su propio CDN.

### Dependencias
Ninguna de código — puede ejecutarse en cualquier punto de la oleada 1, se ubica aquí por orden de prioridad del ranking.

### Impacto
- Módulos afectados: `package.json`, `package-lock.json` únicamente.
- Módulos que NO deben modificarse: `src/data/parser.ts` (la API de `XLSX.read`/`XLSX.utils.sheet_to_json` no cambia entre estas versiones — si `tsc` o el smoke test detectan lo contrario, detener y reportar, no "arreglar" el código de parser para adaptarse sin registrar por qué).

### Riesgos
- **Técnico:** bajo — la API pública usada es estable históricamente.
- **Funcional:** bajo.
- **Regresión:** el smoke test de importación (R04-T4) es la mitigación.

### Microtareas

#### R04-T1 · Resolver la versión exacta a instalar (D-J, no fijar de memoria)
- **Objetivo:** obtener el número de versión real vigente.
- **Alcance:** consultar `https://cdn.sheetjs.com/` (o la documentación oficial de SheetJS) por la última release estable de la serie 0.20.x en el momento de ejecución.
- **Archivos permitidos:** ninguno (tarea de investigación, no de código).
- **Dependencias:** ninguna.
- **Complejidad:** trivial. **Riesgo:** bajo. **Tiempo:** 10 min.
- **Criterios de aceptación:** se tiene una URL de tarball concreta (formato `https://cdn.sheetjs.com/xlsx-0.XX.Y/xlsx-0.XX.Y.tgz`).
- **Evidencia esperada:** la URL resuelta, citada en el mensaje de commit de R04-T2.

#### R04-T2 · Cambiar la dependencia en `package.json`
- **Objetivo:** apuntar `xlsx` a la URL del tarball oficial parcheado.
- **Alcance:** reemplazar `"xlsx": "^0.18.5"` por `"xlsx": "https://cdn.sheetjs.com/<versión-resuelta-en-R04-T1>/xlsx-<versión>.tgz"`; ejecutar `npm install` para regenerar `package-lock.json`.
- **Contexto mínimo:** `package.json` completo.
- **Archivos permitidos:** `package.json`, `package-lock.json`.
- **Archivos prohibidos:** cualquier otra dependencia en el mismo archivo (no tocar React, Vite, etc. — esta es la única excepción autorizada a la restricción global "no actualizar dependencias", y solo para `xlsx`).
- **Dependencias:** R04-T1.
- **Complejidad:** baja. **Riesgo:** bajo. **Tiempo:** 15 min.
- **Criterios de aceptación:** `npm install` termina sin error.
- **Evidencia esperada:** salida de `npm install`.

#### R04-T3 · Confirmar que las 2 CVEs desaparecen
- **Objetivo:** verificar el cierre del hallazgo.
- **Alcance:** correr `npm audit`.
- **Archivos permitidos:** ninguno.
- **Dependencias:** R04-T2.
- **Complejidad:** trivial. **Riesgo:** bajo. **Tiempo:** 5 min.
- **Criterios de aceptación:** `npm audit` ya no reporta las 2 vulnerabilidades *high* de `xlsx` (la vulnerabilidad *moderate* de `esbuild`/`vite` es un hallazgo distinto, fuera de alcance de R04 — no intentar resolverla aquí).
- **Evidencia esperada:** salida de `npm audit`.

#### R04-T4 · Smoke test de importación
- **Objetivo:** confirmar que la nueva versión de `xlsx` sigue funcionando con el flujo real de la app.
- **Alcance:** manual en el preview — importar un CSV/XLSX de prueba (puede ser el mismo usado en R02) y confirmar que `parseFile` devuelve los datos esperados sin error de consola.
- **Archivos permitidos:** ninguno (verificación, no código).
- **Dependencias:** R04-T2, y preferentemente después de R01/R02 para tener casos de prueba ya preparados.
- **Complejidad:** baja. **Riesgo:** bajo. **Tiempo:** 15 min.
- **Criterios de aceptación:** importación exitosa, sin errores en `preview_console_logs`.
- **Evidencia esperada:** captura + log de consola limpio.

### Checkpoint R04
- **Validar:** `npm audit` sin las 2 CVEs de xlsx · `npm test` verde · `npm run build` exitoso · smoke test manual pasado.
- **Condición para continuar:** todo lo anterior en verde.

### Rollback
`git revert` del commit; `npm install` para restaurar `package-lock.json` a la versión anterior.

---

## R05 · Techo de filas al importar + guardas de datos insuficientes visibles en toda la app

**Origen:** hallazgos B3, B5 · **Impacto:** alto · **Dificultad:** baja

### Objetivo
Impedir el congelamiento verificado (2,4 s síncronos con n=400 en el peor caso) con importaciones grandes, y que el aviso de "datos insuficientes" (hoy exclusivo de la pestaña 07) sea visible sin importar qué pestaña esté activa.

### Justificación
No existe techo superior de filas; y el aviso de n<25 vive solo en `ValidationView.tsx`, dejando a las pestañas 02–05 mostrando ajustes con muy pocos datos sin ninguna advertencia (ver R08 para el problema relacionado de las métricas en 0.000 engañosas — R05 es la guarda visible, R08 es la corrección de los números).

### Dependencias
R02 (mismo archivo `parser.ts`).

### Decisión de producto tomada en este blueprint
Se opta por **no bloquear la importación** de archivos con pocas filas (algunos datasets reales de curso pueden legítimamente tener 20-30 observaciones) — en vez de eso, se **sube el banner de advertencia existente de la pestaña 07 a nivel de `App.tsx`**, visible en cualquier pestaña, y se agrega un techo superior que sí rechaza (con mensaje accionable) archivos demasiado grandes para el cómputo síncrono actual.

### Impacto
- Módulos afectados: `src/data/parser.ts` (techo superior), `src/App.tsx` (banner elevado), `src/views/ValidationView.tsx` (quitar el banner duplicado si `App.tsx` ya lo muestra).
- Módulos que NO deben modificarse: ningún modelo.

### Riesgos
- **Técnico:** bajo.
- **Funcional:** el valor del techo (2.000 filas, ver D-I) es una elección conservadora — confirmar en hardware real si en el futuro se reciben quejas de rechazo indebido.
- **Regresión:** quitar el banner de `ValidationView.tsx` sin duplicarlo en `App.tsx` primero dejaría a la app sin ningún aviso — el orden de las microtareas lo evita (agregar antes de quitar).

### Microtareas

#### R05-T1 · Techo superior de filas en el parser
- **Objetivo:** rechazar archivos que romperían el cómputo síncrono.
- **Alcance:** en `validateRows` (`parser.ts`), agregar constante `const MAX_ROWS = 2000;` al inicio del archivo; si `rawRows.length > MAX_ROWS`, devolver `{ success: false, errors: ['El archivo tiene {N} filas; el máximo soportado es 2000. Agrega los datos a una frecuencia menor (ej. mensual o trimestral) y vuelve a intentar.'] }` antes de cualquier otro procesamiento.
- **Contexto mínimo:** `src/data/parser.ts`, función `validateRows`.
- **Archivos permitidos:** `src/data/parser.ts`.
- **Archivos prohibidos:** todo lo demás.
- **Dependencias:** R02-T2, R03-T1 (evitar conflictos de edición concurrente sobre el mismo archivo).
- **Complejidad:** baja. **Riesgo:** bajo. **Tiempo:** 20 min.
- **Criterios de aceptación:** test nuevo en `parser.test.ts`: 2001 filas ⇒ rechazado con el mensaje esperado; 2000 filas ⇒ aceptado.
- **Evidencia esperada:** `npm test` verde.

#### R05-T2 · Elevar el banner de "datos insuficientes" a `App.tsx`
- **Objetivo:** visibilidad del aviso en cualquier pestaña.
- **Alcance:** copiar la condición y el bloque de aviso que hoy vive en `ValidationView.tsx` (`n < 25`) hacia `App.tsx`, renderizado justo antes de `<main>`, usando `dataset.data.length`.
- **Contexto mínimo:** el bloque exacto en `ValidationView.tsx` líneas ~165-171, y la estructura de `App.tsx` alrededor de `<main>`.
- **Archivos permitidos:** `src/App.tsx`.
- **Archivos prohibidos:** `src/views/ValidationView.tsx` (todavía no — ver R05-T3).
- **Dependencias:** R05-T1.
- **Complejidad:** baja. **Riesgo:** bajo. **Tiempo:** 20 min.
- **Criterios de aceptación:** manual — con un dataset de 10 filas (sintético con parámetros que lo permitan, o importado), el banner aparece en la pestaña 01 (Estructural), que hoy no lo muestra.
- **Evidencia esperada:** captura de pantalla.

#### R05-T3 · Quitar el banner duplicado de `ValidationView.tsx`
- **Objetivo:** no mostrar el mismo aviso dos veces cuando la pestaña 07 está activa.
- **Alcance:** eliminar el bloque `{n < 25 && (...)}` de `ValidationView.tsx` (ya cubierto globalmente por R05-T2).
- **Archivos permitidos:** `src/views/ValidationView.tsx` (solo esa eliminación, ninguna otra línea).
- **Archivos prohibidos:** todo lo demás.
- **Dependencias:** R05-T2 confirmado manualmente.
- **Complejidad:** trivial. **Riesgo:** bajo. **Tiempo:** 10 min.
- **Criterios de aceptación:** manual — el aviso sigue apareciendo en la pestaña 07 (ahora viene de `App.tsx`), una sola vez, no duplicado.
- **Evidencia esperada:** captura de pantalla.

### Checkpoint R05
- **Validar:** `npm test` verde · manual: archivo de 2001 filas rechazado con mensaje claro · banner visible en pestaña 01 con dataset chico · banner no duplicado en pestaña 07.
- **Condición para continuar:** los 4 puntos confirmados.

### Rollback
Revertir el commit de R05 completo.

---

## R06 · Autoajuste sin fuga en la pestaña 07

**Origen:** hallazgo A1 · **Impacto:** muy alto · **Dificultad:** media

### Objetivo
Que exista una forma de autoajustar ARIMAX (BIC) y GPR (verosimilitud marginal) usando **solo** el tramo de entrenamiento de la pestaña 07, sin contaminar la evaluación "fuera de muestra" con información del tramo de prueba.

### Justificación
Verificado: los botones de autoajuste existentes (`GprView.tsx`, `ArimaxView.tsx`) siempre usan la serie completa. El manual (§2.8) recomienda literalmente el flujo "Autoajustar (BIC) → pestaña 07 → Validar" — que es la fuga de selección en su forma más directa.

### Decisión de diseño tomada (D-D)
No se modifican las pestañas 03/04 (regla de oro existente del proyecto: no tocar las funciones ni los flujos ya validados de 02-05). En su lugar, se agregan botones **nuevos y locales a la pestaña 07** que llaman a las mismas funciones de autoajuste (`autoTuneArimaxBic`, `autoTuneGpr`) pero solo con `data.slice(0, trainEnd)`, y el resultado se guarda en un estado nuevo, propio de la pestaña 07, sin sobreescribir la configuración compartida de las pestañas 03/04.

### Dependencias
R01 completo (esta tarea modifica lógica de estado, no solo UI).

### Impacto
- Módulos afectados: `src/state/ModelParams.tsx` (2 campos opcionales nuevos en `ValidationState`), `src/views/ValidationView.tsx` (botones + lógica), `08 MANUAL.md` (actualizar el flujo recomendado del §2.8 — 3 líneas).
- Módulos que NO deben modificarse: `src/views/ArimaxView.tsx`, `src/views/GprView.tsx`, `src/models/arimaxTune.ts`, `src/models/gpr.ts` (se reutilizan tal cual, sin cambiar su firma ni su comportamiento).

### Riesgos
- **Técnico:** medio — agregar estado opcional a `ValidationState` y hacer que `runModel` lo prefiera cuando existe, sin romper el caso default (`undefined` ⇒ comportamiento idéntico al actual).
- **Funcional:** bajo si se sigue el alcance exacto.
- **Regresión:** el consistency test de R01-T2 no debe verse afectado (no se toca `arimaxTune.ts` ni `gpr.ts`).

### Microtareas

#### R06-T1 · Agregar estado de override local a `ValidationState`
- **Objetivo:** tener dónde guardar la configuración autoajustada sin fuga, separada de la compartida.
- **Alcance:** en `ModelParams.tsx`, agregar a la interfaz `ValidationState` dos campos opcionales: `arimaxOverride?: { p: number; d: number; flags: ArimaxState['useGrowth' /* etc */] }` (reutilizar el shape de `ArimaxTuneOutcome['flags']` de `arimaxTune.ts`) y `gprOverride?: GprParams`. Ambos `undefined` por defecto (no cambiar el valor inicial de `validation` en el provider más que agregar los campos como ausentes).
- **Contexto mínimo:** `src/state/ModelParams.tsx` completo, `src/models/arimaxTune.ts` (para el shape de `ArimaxTuneOutcome`), `src/models/gpr.ts` (para `GprParams`).
- **Archivos permitidos:** `src/state/ModelParams.tsx`.
- **Archivos prohibidos:** todo lo demás.
- **Dependencias:** R01 (checkpoint pasado).
- **Complejidad:** baja. **Riesgo:** bajo (campos opcionales, no rompe nada existente). **Tiempo:** 30 min.
- **Criterios de aceptación:** `tsc --noEmit` limpio.
- **Evidencia esperada:** salida de `tsc`.

#### R06-T2 · Botones "Autoajustar sin fuga" en `ValidationView.tsx`
- **Objetivo:** UI para disparar el autoajuste restringido al entrenamiento.
- **Alcance:** cuando `v.model === 'arimax'`, mostrar un botón que llame a `autoTuneArimaxBic(data.slice(0, trainEnd))` y guarde el resultado en `validation.arimaxOverride` (vía `set({ arimaxOverride: {...} })`); cuando `v.model === 'gpr'`, un botón análogo con `autoTuneGpr` sobre `x.slice(0,trainEnd)` / `y.slice(0,trainEnd)`, guardando en `gprOverride`. Reutilizar el patrón async con cesión de hilo ya usado en `ArimaxView.tsx`/`GprView.tsx` (mismo `setTimeout(async () => {...}, 0)`).
- **Contexto mínimo:** el patrón exacto de `handleAutoTune` en `ArimaxView.tsx` (líneas 20-36) y `GprView.tsx` (líneas 26-37) — copiar el patrón, no reinventar uno nuevo.
- **Archivos permitidos:** `src/views/ValidationView.tsx`.
- **Archivos prohibidos:** `src/views/ArimaxView.tsx`, `src/views/GprView.tsx`.
- **Dependencias:** R06-T1.
- **Complejidad:** media. **Riesgo:** bajo. **Tiempo:** 1.5 h.
- **Criterios de aceptación:** manual — al pulsar el botón, aparece "Calculando…" y luego un mensaje con la configuración encontrada (mismo patrón textual que `ArimaxView.tsx`).
- **Evidencia esperada:** captura de pantalla.

#### R06-T3 · Hacer que `runModel` prefiera el override cuando existe
- **Objetivo:** que la configuración sin fuga realmente se use al evaluar.
- **Alcance:** en el `runModel` de `ValidationView.tsx` (case `'arimax'` y `'gpr'`), si `v.arimaxOverride`/`v.gprOverride` está definido, usar esos parámetros en vez de los de `arimax`/`gpr` (el contexto compartido); si no está definido, comportamiento idéntico al actual (fallback a `arimax`/`gpr` del contexto).
- **Contexto mínimo:** el bloque `runModel` completo de `ValidationView.tsx` (líneas 40-70).
- **Archivos permitidos:** `src/views/ValidationView.tsx`.
- **Archivos prohibidos:** todo lo demás.
- **Dependencias:** R06-T2.
- **Complejidad:** media. **Riesgo:** medio (es el punto donde un error podría afectar TODOS los cálculos de la pestaña 07 — depende críticamente de R01-T2 para detectar cualquier regresión). **Tiempo:** 1 h.
- **Criterios de aceptación:** el consistency test de R01-T2 sigue en verde (no se tocó el caso sin override); test manual nuevo: con `arimaxOverride` definido, el RMSE de prueba cambia respecto de usar la config de la pestaña 03.
- **Evidencia esperada:** `npm test` verde + captura manual.

#### R06-T4 · Copy explicativo + actualizar el flujo recomendado del manual
- **Objetivo:** que el usuario entienda la diferencia entre los botones de 03/04 y los nuevos de 07, y que el manual deje de recomendar el flujo con fuga.
- **Alcance:** agregar 2-3 líneas de texto junto a los nuevos botones explicando la diferencia; en `08 MANUAL.md` §2.8, cambiar el flujo recomendado "Importar CSV → pestaña 03 → Autoajustar (BIC) → pestaña 07 → Validar" por uno que use los botones nuevos de la propia pestaña 07.
- **Archivos permitidos:** `src/views/ValidationView.tsx`, `08 MANUAL.md`.
- **Dependencias:** R06-T3.
- **Complejidad:** baja. **Riesgo:** bajo. **Tiempo:** 30 min.
- **Criterios de aceptación:** manual — el texto es claro; el manual ya no describe el flujo con fuga.
- **Evidencia esperada:** diff del manual.

### Checkpoint R06
- **Validar:** `npm test` verde (incluyendo R01-T2 sin cambios) · `tsc --noEmit` limpio · manual: botón nuevo en 07 produce una configuración distinta a la de 03/04 cuando corresponde, y las pestañas 03/04 no muestran ningún cambio de comportamiento.
- **Condición para continuar:** todo lo anterior en verde.

### Rollback
Revertir el commit de R06 completo. `ArimaxState`/`GprState` compartidos no se tocaron, por lo que las pestañas 03/04 quedan intactas incluso a medio proceso.

---

## R07 · Nota anti-peeking en los controles de ML de la pestaña 07

**Origen:** hallazgo A2 · **Impacto:** alto · **Dificultad:** trivial

### Objetivo
Advertir explícitamente que mover los hiperparámetros de Ridge/k-NN/Bosque mirando el RMSE de prueba en vivo convierte la prueba en validación (sobreajuste manual al test).

### Justificación
La pestaña 07 recalcula el RMSE de prueba en vivo con cada movimiento de slider, sin ninguna advertencia sobre el riesgo — el vicio metodológico más común en principiantes de ML, facilitado por el propio diseño de la interfaz.

### Dependencias
Ninguna (cambio de copy puro).

### Impacto
- Módulos afectados: `src/views/ValidationView.tsx` únicamente (el bloque `isMl` que renderiza los sliders de Ridge/k-NN/Bosque).
- Módulos que NO deben modificarse: ninguno.

### Riesgos
Ninguno relevante — es texto.

### Microtareas

#### R07-T1 · Agregar el aviso
- **Objetivo:** el único paso de esta recomendación.
- **Alcance:** dentro del bloque `{isMl && (...)}` de `ValidationView.tsx`, agregar un párrafo (mismo estilo que los `<p className="text-ink-500 text-xs...">` ya existentes en ese bloque): *"Si mueves estos controles mirando el RMSE de PRUEBA hasta que baje, el conjunto de prueba deja de ser una prueba honesta — es sobreajuste manual al test, el mismo vicio que esta pestaña existe para enseñar a evitar."*
- **Contexto mínimo:** el bloque `isMl` de `ValidationView.tsx` (líneas ~273-309).
- **Archivos permitidos:** `src/views/ValidationView.tsx`.
- **Archivos prohibidos:** todo lo demás.
- **Dependencias:** ninguna.
- **Complejidad:** trivial. **Riesgo:** bajo. **Tiempo:** 15 min.
- **Criterios de aceptación:** manual — el texto aparece al seleccionar Ridge/k-NN/Bosque en el selector de modelo.
- **Evidencia esperada:** captura de pantalla.

### Checkpoint R07
- **Validar:** manual únicamente — el texto es visible y correcto.

### Rollback
Revertir el commit (una sola línea de JSX).

---

## R08 · ErrorBoundary + corrección de métricas engañosas con datos insuficientes

**Origen:** hallazgo B5 · **Impacto:** alto · **Dificultad:** media-alta

### Objetivo
(a) Que ninguna excepción de React deje la app en pantalla en blanco. (b) Que cuando un modelo no puede ajustarse (`n ≤ p+d`), las métricas se muestren como "—" en vez de "0.000" (que hoy se lee como "ajuste perfecto" cuando en realidad significa "no hay nada que medir").

### Justificación
Verificado en el código: `calculateMetrics([], [])` devuelve `{rmse:0, mae:0, mape:0, r2:0}` por la rama de `actual.length===0`. Combinado con `fitArima` devolviendo `fitted` de ceros cuando `n≤p+d`, las pestañas 02-05 pueden mostrar RMSE 0.000 con datasets pequeños — el peor tipo de engaño posible, porque parece éxito. Además, no existe ningún `ErrorBoundary` en `App.tsx`: una excepción no prevista desmonta toda la app.

### Dependencias
R01-T4 (tests de `metrics.ts` con el comportamiento actual documentado) y R05 (banner de datos insuficientes ya visible globalmente, complementario a esta corrección).

### Impacto — ALCANCE AMPLIO, LISTAR TODOS LOS CONSUMIDORES
Cambiar el tipo de retorno de `calculateMetrics` (de `{rmse:number,...}` a `{rmse:number|null,...}` cuando `n===0`) afecta a **todos** sus consumidores. Lista completa verificada por grep, ningún otro archivo debe asumirse:
- `src/views/ArimaView.tsx` (usa `metrics.rmse.toFixed(3)` directamente)
- `src/views/ArimaxView.tsx` (ídem)
- `src/views/GprView.tsx` (ídem)
- `src/views/HybridView.tsx` (usa `hybridMetrics`/`arimaxMetrics`)
- `src/views/ComparatorView.tsx` (usa `.rmse` para ordenar el "ganador" — un `null` no debe compararse con `Math.min`)
- `src/models/evaluation.ts` (`evaluateSplit`/`testRmse`/`walkForwardRmse` ya manejan `null` en otros campos — verificar consistencia con el nuevo contrato de `calculateMetrics`)
- `src/views/ValidationView.tsx` (ya tiene el helper `fmt()` que maneja `null` — es el patrón a reutilizar, no a reinventar)

Módulos que NO deben modificarse: `src/models/arima.ts`, `src/models/arimax.ts`, `src/models/gpr.ts`, `src/models/hybrid.ts` (el comportamiento de `fitted=ceros` cuando `n≤p+d` se mantiene igual — esta tarea corrige cómo se **muestran** las métricas resultantes, no cómo se calcula el ajuste).

### Riesgos
- **Técnico:** alto en superficie (6 archivos) pero bajo en profundidad (cada cambio es mecánico: mover de `.toFixed(3)` directo a pasar por el helper `fmt`).
- **Funcional:** el "ganador" del Comparador (`ComparatorView.tsx`) debe excluir modelos con `rmse === null` del cálculo de `Math.min` — si se olvida, `Math.min(...[null, 0.3])` da un resultado incorrecto en JavaScript (coerción de `null` a 0). Es el punto de mayor riesgo de esta recomendación.
- **Regresión:** R01-T4 debe actualizarse (el test que documentaba "n=0 devuelve ceros" pasa a documentar "n=0 devuelve null").

### Microtareas

#### R08-T1 · Mover `fmt()` a un módulo compartido
- **Objetivo:** que las 6 vistas puedan formatear valores potencialmente `null` de forma consistente, reutilizando lo que ya existe en `ValidationView.tsx` en vez de reinventarlo.
- **Alcance:** crear `src/components/format.ts` con la función `fmt` extraída literalmente de `ValidationView.tsx` (líneas 26-27); en `ValidationView.tsx`, reemplazar la definición local por un import desde el nuevo módulo.
- **Contexto mínimo:** las 2 líneas exactas de `fmt` en `ValidationView.tsx`.
- **Archivos permitidos:** `src/components/format.ts` (nuevo), `src/views/ValidationView.tsx` (solo el cambio de definición local → import).
- **Archivos prohibidos:** cualquier otro archivo todavía.
- **Dependencias:** ninguna.
- **Complejidad:** baja. **Riesgo:** bajo. **Tiempo:** 20 min.
- **Criterios de aceptación:** `tsc --noEmit` limpio; la pestaña 07 se ve idéntica a antes.
- **Evidencia esperada:** captura de la pestaña 07 sin cambios visuales.

#### R08-T2 · Cambiar `calculateMetrics` para devolver `null` en el caso `n===0`
- **Objetivo:** implementar el contrato nuevo.
- **Alcance:** en `metrics.ts`, cuando `actual.length !== predicted.length || actual.length === 0`, devolver `{rmse:null, mae:null, mape:null, r2:null}` en vez de ceros. Actualizar el tipo de retorno de la función explícitamente (`{ rmse: number | null; mae: number | null; mape: number | null; r2: number | null }`).
- **Contexto mínimo:** `src/models/metrics.ts` completo (37 líneas).
- **Archivos permitidos:** `src/models/metrics.ts`, `src/models/metrics.test.ts` (actualizar el caso de R01-T4 que documentaba el comportamiento viejo).
- **Archivos prohibidos:** todo lo demás — **esta tarea NO debe tocar ningún consumidor todavía**; el `tsc` fallará en los 6 archivos consumidores después de este paso, y eso es esperado y correcto (confirma exactamente dónde hay que actuar en las siguientes microtareas).
- **Dependencias:** R08-T1.
- **Complejidad:** baja. **Riesgo:** bajo (aislado). **Tiempo:** 30 min.
- **Criterios de aceptación:** `npm test` verde para `metrics.test.ts`; `tsc --noEmit` **falla** con errores de tipo listados exactamente en los 6 archivos de la sección "Impacto" — confirmar que no hay un séptimo archivo no anticipado.
- **Evidencia esperada:** salida completa de `tsc --noEmit` (para usarla como checklist en las siguientes tareas).

#### R08-T3 · Adaptar las 4 vistas de modelo simple (Arima, Arimax, Gpr, Hybrid)
- **Objetivo:** que dejen de asumir que `metrics.rmse` siempre es un número.
- **Alcance:** en cada una de las 4 vistas, reemplazar `metrics.rmse.toFixed(3)` (y mae/mape/r2 equivalentes) por `fmt(metrics.rmse)` (importado del módulo de R08-T1), ajustando el formato de porcentaje de MAPE de forma equivalente.
- **Contexto mínimo:** los bloques de `<Panel title={metrics.X.toFixed(...)} .../>` en cada una de las 4 vistas — son 4 líneas por vista, no hace falta leer el resto del archivo más que para ubicar el import.
- **Archivos permitidos:** `src/views/ArimaView.tsx`, `src/views/ArimaxView.tsx`, `src/views/GprView.tsx`, `src/views/HybridView.tsx`.
- **Archivos prohibidos:** `src/views/ComparatorView.tsx`, `src/views/ValidationView.tsx` (tareas separadas).
- **Dependencias:** R08-T2.
- **Complejidad:** baja (mecánica, repetida 4 veces). **Riesgo:** bajo. **Tiempo:** 1 h.
- **Criterios de aceptación:** `tsc --noEmit` limpio para estos 4 archivos; manual — con un dataset de 3 filas y p=6,d=2 en ARIMA, el panel de RMSE muestra "—" en vez de "0.000".
- **Evidencia esperada:** captura de pantalla del caso "—".

#### R08-T4 · Adaptar `ComparatorView.tsx` (el punto de mayor riesgo)
- **Objetivo:** que el cálculo del "ganador" (`minRmse`) ignore modelos con `rmse === null`.
- **Alcance:** en `ComparatorView.tsx`, cambiar `Math.min(...results.map(r => r.rmse))` por una versión que filtre los `null` primero (`results.filter(r => r.rmse !== null).map(r => r.rmse as number)`, y si el array filtrado queda vacío, `minRmse = null`); la comparación `row.rmse === comparison.minRmse` para marcar el ganador debe seguir funcionando cuando ambos son `null` sin marcar falsamente un ganador (agregar `row.rmse !== null &&` a la condición).
- **Contexto mínimo:** `src/views/ComparatorView.tsx` completo (116 líneas) — es corto, leerlo entero.
- **Archivos permitidos:** `src/views/ComparatorView.tsx`.
- **Archivos prohibidos:** todo lo demás.
- **Dependencias:** R08-T3.
- **Complejidad:** media (es el único punto con lógica, no solo formato). **Riesgo:** medio. **Tiempo:** 45 min.
- **Criterios de aceptación:** test manual — forzar que un modelo tenga `rmse:null` (dataset muy corto) y confirmar que (a) no rompe la tabla, (b) no se marca como ganador falso, (c) el resto de los modelos sigue comparándose bien entre sí.
- **Evidencia esperada:** captura de pantalla.

#### R08-T5 · ErrorBoundary
- **Objetivo:** que una excepción no controlada no deje la app en blanco.
- **Alcance:** crear `src/components/ErrorBoundary.tsx` (class component con `componentDidCatch`/`getDerivedStateFromError`), mostrando un mensaje ("Algo salió mal en esta pestaña.") y un botón "Restaurar dataset sintético" que invoque `dataset.clearImport()` (requiere pasar esa función como prop al boundary, o usarlo solo alrededor de `<ActiveComponent>` con acceso al `dataset` del scope de `App.tsx`). Envolver `<ActiveComponent data={dataset.data} />` en `App.tsx` con este componente.
- **Contexto mínimo:** el bloque `<main>...<ActiveComponent /></main>` de `App.tsx` (líneas 179-196).
- **Archivos permitidos:** `src/components/ErrorBoundary.tsx` (nuevo), `src/App.tsx`.
- **Archivos prohibidos:** todo lo demás.
- **Dependencias:** ninguna (puede hacerse en paralelo con T2-T4, se lista al final por orden de prioridad, no por dependencia técnica).
- **Complejidad:** media. **Riesgo:** bajo. **Tiempo:** 1 h.
- **Criterios de aceptación:** manual — forzar un error (ej. lanzar una excepción temporal dentro de una vista, revertir después de confirmar) y comprobar que se muestra el mensaje de recuperación en vez de una pantalla en blanco.
- **Evidencia esperada:** captura de pantalla del estado de error y de la recuperación tras pulsar el botón.

### Checkpoint R08
- **Validar:** `npm test` verde (incluyendo `metrics.test.ts` actualizado) · `tsc --noEmit` completamente limpio (cero errores en los 6 archivos listados en "Impacto") · manual: dataset de 3 filas en pestañas 02-05 muestra "—", no "0.000" · Comparador no marca ganador falso · ErrorBoundary probado.
- **Condición para continuar:** los 5 puntos confirmados. Este es el checkpoint más exigente de la oleada 1 — no avanzar a R09 si `tsc` reporta un solo error residual.

### Rollback
Revertir el commit de R08 completo (las 5 microtareas se integran en un solo commit al cerrar la recomendación, dado que son mutuamente dependientes en el sentido de que T2 deja el build roto hasta que T3/T4 terminan).

---

## R09 · Unificar la normalización del GPR entre la pestaña 04 y la pestaña 07

**Origen:** hallazgo A3 · **Impacto:** medio-alto · **Dificultad:** baja

### Objetivo
Que el mismo valor de `l` (escala de longitud) produzca la misma suavidad efectiva sin importar si se evalúa desde la pestaña 04 o desde la 07.

### Justificación
Verificado numéricamente: con `l=0.1` y 80% de entrenamiento, la normalización de `forecast.ts` (`x = i/(trainEnd-1)`) produce un RMSE de entrenamiento 10,5% distinto al que produciría la normalización de `GprView.tsx` (`x = i/(n-1)`).

### Decisión tomada
Normalizar siempre por `n-1` (longitud de la serie completa), independientemente de `trainEnd`. Es el cambio de menor riesgo: solo toca `forecast.ts`, no `GprView.tsx`, y es matemáticamente neutro para el caso `trainEnd=n` (ya que ahí `n-1 === trainEnd-1`), por lo que **no puede romper** el test de consistencia de R01-T2.

### Dependencias
R01 (para confirmar que el cambio no rompe la consistencia).

### Impacto
- Módulos afectados: `src/models/forecast.ts` únicamente — 3 sitios de cómputo de `x`/`denom`: `gprForecast`, `gprOneStepForecast`, `hybridForecast`.
- Módulos que NO deben modificarse: `src/views/GprView.tsx` (ya usa `n-1`, es la referencia correcta), `src/models/gpr.ts` (no cambia, solo cambia lo que le pasan como `x` desde `forecast.ts`).

### Riesgos
- **Técnico:** bajo.
- **Funcional:** los números de RMSE de la pestaña 07 para el modelo GPR e Híbrido **cambiarán** ligeramente respecto de la versión actual (es el objetivo de la tarea, no un bug) — cualquier captura de pantalla o valor de referencia previo de esos dos modelos en la pestaña 07 queda obsoleto tras este cambio, y debe regenerarse.
- **Regresión:** verificar con R01-T2 que `trainEnd=n` sigue siendo exactamente idéntico.

### Microtareas

#### R09-T1 · Cambiar el denominador en `gprForecast`
- **Alcance:** en `forecast.ts`, función `gprForecast`, cambiar `const denom = Math.max(trainEnd - 1, 1);` por `const denom = Math.max(n - 1, 1);` (usar la longitud total de la serie, no `trainEnd`).
- **Contexto mínimo:** la función `gprForecast` completa en `forecast.ts` (líneas ~141-156).
- **Archivos permitidos:** `src/models/forecast.ts`.
- **Archivos prohibidos:** todo lo demás.
- **Dependencias:** R01 (checkpoint pasado).
- **Complejidad:** trivial. **Riesgo:** bajo. **Tiempo:** 10 min.
- **Criterios de aceptación:** el test de R01-T2 (caso GPR, `trainEnd=n`) sigue en verde.
- **Evidencia esperada:** `npm test`.

#### R09-T2 · Mismo cambio en `gprOneStepForecast`
- **Alcance:** idéntico patrón, función `gprOneStepForecast` (líneas ~165-201) — la variable `denom` usada en `xOf`.
- **Archivos permitidos:** `src/models/forecast.ts`.
- **Dependencias:** R09-T1.
- **Complejidad:** trivial. **Riesgo:** bajo. **Tiempo:** 10 min.
- **Criterios de aceptación:** test de R01-T2 sigue en verde.
- **Evidencia esperada:** `npm test`.

#### R09-T3 · Mismo cambio en `hybridForecast`
- **Alcance:** en `hybridForecast` (líneas ~209-243), la variable `denom` usada para `xAll`.
- **Archivos permitidos:** `src/models/forecast.ts`.
- **Dependencias:** R09-T2.
- **Complejidad:** trivial. **Riesgo:** bajo. **Tiempo:** 10 min.
- **Criterios de aceptación:** test de R01-T2 (caso Híbrido) sigue en verde.
- **Evidencia esperada:** `npm test`.

#### R09-T4 · Test nuevo de equivalencia de configuración entre pestañas
- **Objetivo:** codificar la garantía que motivó esta recomendación, para que no vuelva a romperse en silencio.
- **Alcance:** en un nuevo archivo `src/models/forecast.gpr-consistency.test.ts`: fijar `l=0.1`, generar dataset sintético, calcular RMSE de entrenamiento vía `fitGpr` directo sobre el 80% inicial (usando `x = i/(n-1)`, replicando lo que hace `GprView.tsx`) y vía `gprOneStepForecast(...,trainEnd,...)` evaluado solo en el tramo de entrenamiento; verificar que ambos coinciden dentro de una tolerancia pequeña (`1e-9`, deben ser exactamente iguales tras R09-T1/T2).
- **Contexto mínimo:** `src/models/gpr.ts` (`fitGpr`), `src/models/forecast.ts` (`gprOneStepForecast`).
- **Archivos permitidos:** el nuevo archivo de test.
- **Dependencias:** R09-T3.
- **Complejidad:** media. **Riesgo:** bajo. **Tiempo:** 45 min.
- **Criterios de aceptación:** el test pasa.
- **Evidencia esperada:** `npm test` verde.

### Checkpoint R09
- **Validar:** `npm test` verde (todos los archivos, especialmente R01-T2 y el nuevo R09-T4) · manual: comparar el RMSE de entrenamiento del GPR en pestaña 04 vs pestaña 07 (modo un paso) con `l=0.1` y 80% de entrenamiento — deben coincidir donde antes diferían en 10,5%.
- **Condición para continuar:** ambos verdes.

### Rollback
Revertir el commit de R09 (3 líneas de código + 1 archivo de test nuevo).

---

## R10 · LICENSE + sacar el material privado del repositorio

**Origen:** hallazgos D2, D3 · **Impacto:** medio-alto · **Dificultad:** trivial (T1) / requiere confirmación humana (T2-T4)

### Objetivo
(a) Que el código tenga una licencia explícita que permita su reutilización académica. (b) Que el material con las respuestas del curso deje de vivir en la carpeta del repositorio público, protegido hoy solo por `.gitignore`.

### Justificación
No hay `LICENSE` ni campo `license` en `package.json` — el código es legalmente "todos los derechos reservados" pese a invitar a estudiantes y terceros a leerlo/adaptarlo. `.gitignore` no es un mecanismo de confidencialidad: un `git add -f`, un renombre que rompa el patrón, o una herramienta que lo ignore, puede publicar las respuestas de evaluación.

### ⚠️ Advertencia de alcance — parte de esta recomendación requiere confirmación humana explícita
R10-T2 mueve archivos fuera del repositorio. Es una operación sobre el sistema de archivos del usuario, fuera del control de versiones, potencialmente afectando accesos o atajos existentes. **Ningún ejecutor automatizado debe realizar R10-T2 sin que un humano confirme la ruta de destino primero.** Esto no es una cautela genérica: es una instrucción explícita de este blueprint.

### Dependencias
Ninguna técnica — puede ejecutarse en cualquier momento, se prioriza aquí por el ranking de riesgo.

### Impacto
- Módulos afectados: raíz del repositorio (`LICENSE` nuevo, `package.json`, `.gitignore`), y el sistema de archivos fuera del repositorio (carpeta hermana de destino).
- Módulos que NO deben modificarse: ningún archivo de `src/`.

### Riesgos
- **Técnico:** bajo para T1; medio para T2 (mover archivos referenciados desde otro lugar sin saberlo).
- **Funcional:** ninguno esperado en la app (los archivos movidos no son importados por ningún código, son material de apoyo del curso).
- **Regresión:** ninguna en el código; el riesgo real es de proceso (perder acceso a un archivo que alguien más necesitaba en esa ubicación) — mitigado por T4.

### Microtareas

#### R10-T1 · Agregar LICENSE (MIT)
- **Objetivo:** licencia explícita para el código.
- **Alcance:** crear `LICENSE` en la raíz con el texto estándar de la licencia MIT (nombre del titular: Daniel Espinosa / despinosam2, año 2026); agregar `"license": "MIT"` a `package.json`. Agregar una nota de una línea en `README.md`: "El código está bajo licencia MIT; los datos y materiales del curso (Excel, presentaciones) no están cubiertos por esta licencia y no se distribuyen en este repositorio."
- **Archivos permitidos:** `LICENSE` (nuevo), `package.json`, `README.md`.
- **Archivos prohibidos:** todo lo demás.
- **Dependencias:** ninguna.
- **Complejidad:** trivial. **Riesgo:** bajo. **Tiempo:** 15 min.
- **Criterios de aceptación:** los 3 archivos existen/se actualizan correctamente.
- **Evidencia esperada:** diff de los 3 archivos.

#### R10-T2 · [REQUIERE CONFIRMACIÓN HUMANA EXPLÍCITA — NO EJECUTAR SIN ELLA] Mover material privado fuera del repositorio
- **Objetivo:** que `GUION DE CLASE.md`, `BANCO DE PREGUNTAS.md`, `Datos Modelo Trimestral 10dic2019.xls`, los `.pptx`, `PRACTICA*`, `*KAHOOT*` dejen de estar en la carpeta del repositorio.
- **Alcance:** confirmar con el usuario la ruta de destino (propuesta: `../copper-lab-privado/` como carpeta hermana de `/Users/daniel/Desktop/copper lab`); mover (no copiar) los archivos listados a esa carpeta.
- **Archivos permitidos:** los archivos explícitamente listados arriba, únicamente para moverlos (no editarlos).
- **Archivos prohibidos:** cualquier archivo de `src/`, cualquier documento `01`-`09`, `README.md`.
- **Dependencias:** R10-T1, y **confirmación humana de la ruta de destino**.
- **Complejidad:** trivial. **Riesgo:** medio (operación fuera del repo). **Tiempo:** 20 min.
- **Criterios de aceptación:** `git status` no muestra ninguno de esos archivos como untracked en la carpeta del repo (porque ya no están ahí).
- **Evidencia esperada:** salida de `git status` antes/después, y confirmación de que los archivos existen en la nueva ubicación.

#### R10-T3 · Simplificar `.gitignore`
- **Objetivo:** quitar patrones que ya no hacen falta porque los archivos no están en la carpeta.
- **Alcance:** en `.gitignore`, quitar los patrones específicos de los archivos ya movidos (`Datos Modelo*.xls`, `*.pptx`, etc.), manteniendo un comentario breve explicando que el material del curso vive fuera del repo. Mantener como defensa en profundidad los patrones de `GUION DE CLASE.md` y `BANCO DE PREGUNTAS.md` por si alguna vez se copian de vuelta accidentalmente (no hace daño mantenerlos).
- **Archivos permitidos:** `.gitignore`.
- **Dependencias:** R10-T2 confirmado.
- **Complejidad:** trivial. **Riesgo:** bajo. **Tiempo:** 10 min.
- **Criterios de aceptación:** `.gitignore` refleja el nuevo estado.
- **Evidencia esperada:** diff de `.gitignore`.

#### R10-T4 · Verificar exposición histórica en git (D-E) — investigación, no corrección
- **Objetivo:** determinar si `GUION DE CLASE.md`/`BANCO DE PREGUNTAS.md` fueron alguna vez commiteados (no solo presentes en el working tree).
- **Alcance:** ejecutar `git log --all --full-history -- "GUION DE CLASE.md"` y lo mismo para `BANCO DE PREGUNTAS.md`. Si el resultado está vacío, no se requiere ninguna acción adicional (nunca estuvieron en la historia). **Si el resultado NO está vacío**, esto significa que el contenido con las respuestas ya existe en la historia de git y R10 (mover archivos del working tree) **no lo elimina** — se requeriría una reescritura de historia (`git filter-repo` o similar), que es una operación destructiva, afecta cualquier clon existente del repositorio, y **no debe ejecutarse sin aprobación explícita separada del usuario**, documentada como una recomendación nueva fuera del alcance de este blueprint.
- **Archivos permitidos:** ninguno (solo lectura vía comandos git).
- **Dependencias:** ninguna — puede ejecutarse antes que T2 incluso, como diagnóstico previo.
- **Complejidad:** trivial. **Riesgo:** bajo (es solo lectura). **Tiempo:** 10 min.
- **Criterios de aceptación:** se tiene una respuesta clara (sí/no aparece en el historial) documentada en el resultado de esta tarea.
- **Evidencia esperada:** salida literal de los dos comandos `git log`.

### Checkpoint R10
- **Validar:** `LICENSE` existe · `git status` limpio de archivos privados · resultado de R10-T4 documentado (con acción de seguimiento registrada si el resultado no fue vacío, no resuelta aquí).
- **Condición para continuar:** T1, T3 completos; T2 completo **solo si** hubo confirmación humana; T4 documentado sin importar el resultado (si detecta historia expuesta, se detiene ahí y se reporta, no se intenta arreglar dentro de esta tarea).

### Rollback
T1: revertir el commit. T2: mover los archivos de vuelta a la carpeta del repo desde la ubicación de destino (reversible mientras no se haya hecho nada más con ellos). T3: revertir el commit de `.gitignore`.

---

# OLEADA 2 — Prioridad P1

*(Detalle medio: mismo esqueleto, microtareas más agregadas.)*

## R11 · ACF de residuos + Ljung-Box en ARIMA/ARIMAX

**Origen:** A5 · **Impacto:** alto · **Dificultad:** media

**Objetivo:** mostrar la autocorrelación de los residuos y el estadístico de Ljung-Box, para que la elección de `p` deje de basarse solo en RMSE.
**Justificación:** los residuos ya se calculan (`arimax.ts` línea 72); falta exponerlos y diagnosticarlos. Es la carencia pedagógica número uno según el perfil "profesor universitario" de la auditoría.
**Dependencias:** R01, R08 (reutiliza el patrón de `fmt`/paneles con posibles `null`).
**Impacto:** nuevo módulo `src/models/diagnostics.ts` (función `autocorrelation(residuals, maxLag)` y `ljungBox(residuals, maxLag)`); nuevo panel en `ArimaView.tsx` y `ArimaxView.tsx`. No modificar `fitArima`/`fitArimax` (los residuos se derivan de `y - fitted`, ya disponible en las vistas).

**Microtareas:**
- **R11-T1** — Implementar `autocorrelation`/`ljungBox` en `diagnostics.ts` nuevo, con tests unitarios contra un caso de ruido blanco conocido (autocorrelación baja, Ljung-Box no significativo) y un caso con estructura clara (autocorrelación alta). Archivos permitidos: `src/models/diagnostics.ts`, `src/models/diagnostics.test.ts`. Complejidad: media. Riesgo: bajo. Tiempo: 2 h.
- **R11-T2** — Panel "Residuos" en `ArimaView.tsx`: gráfico de barras de ACF (lags 1 a min(20, n/4)) con bandas ±2/√n, y el valor de Ljung-Box con su p-valor. Reutilizar `BarChart` de Recharts (mismo patrón que la descomposición de `StructuralView.tsx`). Archivos permitidos: `src/views/ArimaView.tsx`. Complejidad: media. Riesgo: bajo. Tiempo: 2 h.
- **R11-T3** — Mismo panel en `ArimaxView.tsx`. Archivos permitidos: `src/views/ArimaxView.tsx`. Dependencias: R11-T2 (reutilizar el mismo sub-componente si se extrajo uno — si R11-T2 escribió el panel inline sin extraer componente, extraerlo en esta tarea a `src/components/ResidualsPanel.tsx` para no duplicar 40 líneas de JSX). Complejidad: media. Riesgo: bajo. Tiempo: 1.5 h.

**Checkpoint:** `npm test` verde · manual: con un dataset con tendencia fuerte y `d=0` (subespecificado a propósito), el panel muestra autocorrelación alta y Ljung-Box significativo; con `d=1` correctamente especificado, autocorrelación baja.
**Rollback:** revertir el commit; los archivos son nuevos o aditivos, no hay riesgo de dejar el resto de la app en mal estado.

---

## R12 · Errores estándar y estadístico t de los β en ARIMAX

**Origen:** A5 · **Impacto:** alto · **Dificultad:** media

**Objetivo:** mostrar el error estándar y el t-stat de cada coeficiente (φ y β) en la pestaña 03, con la nota de limitación exacta acordada con el dueño del producto.
**Método (D-H, resuelto):** errores estándar OLS clásicos (homocedásticos), **no** HAC/Newey-West. Nota obligatoria a mostrar junto a los coeficientes, texto exacto:

> *"Debido a que el modelo incorpora una estructura AR(1), los errores estándar OLS pueden no ser consistentes en presencia de autocorrelación serial. En este proyecto se mantienen los errores estándar clásicos para preservar la simplicidad y consistencia de la implementación. En consecuencia, los coeficientes estimados se utilizan principalmente con fines predictivos e interpretativos, mientras que las pruebas de significancia estadística deben interpretarse con cautela. En trabajos futuros podría emplearse un estimador robusto HAC (Newey–West) para mejorar la inferencia."*

**Dependencias:** R11 (comparten el módulo de diagnóstico/estadística y la vista `ArimaxView.tsx`).
**Impacto:** `src/models/arimax.ts` (NO se modifica `fitArimax` en sí — se agrega una función nueva y separada `arimaxStandardErrors(X, y, beta)` en un módulo nuevo, para no tocar la función ya validada); `src/views/ArimaxView.tsx` (mostrar SE y t junto a cada β, y la nota citada arriba, textual, sin parafrasear).

**Microtareas:**
- **R12-T1** — Implementar `standardErrors(X, residuals, beta)` en `src/models/diagnostics.ts` (fórmula clásica: `SE(β_j) = sqrt(σ² · (XᵀX)⁻¹_jj)` con `σ² = RSS/(n-k)`, reutilizando `invert` de `matrix.ts`, ya importado en otros módulos). Tests unitarios con un caso de regresión simple con SE conocido de antemano (calculado a mano). Archivos permitidos: `src/models/diagnostics.ts`, su test. Complejidad: media. Riesgo: bajo. Tiempo: 1.5 h.
- **R12-T2** — En `ArimaxView.tsx`, calcular `X`/`residuals`/`beta` disponibles localmente (ya se calculan para el ajuste; reconstruir la matriz de diseño si no está expuesta desde `fitArimax`, o exportar `designMatrix` como campo adicional de `ArimaxResult` — **decisión de implementación menor, no bloqueante**: preferir exportar la matriz de diseño desde `fitArimax` como campo nuevo opcional antes que reconstruirla en la vista, para no duplicar la lógica de construcción de filas). Mostrar SE y t junto a cada `Readout` de coeficiente existente, y agregar la nota citada arriba en un `<Note>`. Archivos permitidos: `src/models/arimax.ts` (solo agregar un campo de retorno, sin cambiar la lógica de estimación existente), `src/views/ArimaxView.tsx`. Complejidad: media. Riesgo: medio (tocar `arimax.ts`, aunque sea aditivo, requiere que R01-T2 confirme que el ajuste no cambió). Tiempo: 2 h.

**Checkpoint:** `npm test` verde (incluyendo que R01-T2 sigue validando `fitArimax` sin cambios de comportamiento, solo un campo nuevo) · manual: los SE/t se muestran y la nota aparece con el texto exacto acordado.
**Rollback:** revertir el commit.

---

## R13 · Ceder el hilo dentro del walk-forward

**Origen:** B3 · **Impacto:** medio-alto · **Dificultad:** media

**Objetivo:** que el walk-forward (especialmente GPR un paso) ceda el hilo también **dentro** de la validación de un solo modelo, no solo entre modelos.
**Justificación:** verificado — 2,4 s síncronos con n=400 en un solo modelo; hoy la cesión de hilo (`ValidationView.tsx` línea ~106) ocurre solo entre modelos del bucle `for (const id of ids)`.
**Dependencias:** R05 (el techo de 2.000 filas acota el peor caso, pero no lo elimina dentro del límite permitido).
**Impacto:** `src/models/evaluation.ts` (`walkForwardRmse` pasa a ser `async`, cede el hilo cada N puntos evaluados dentro de cada fold); `src/views/ValidationView.tsx` (adaptar las 2 llamadas a `walkForwardRmse` para `await`).

**Microtareas:**
- **R13-T1** — Convertir `walkForwardRmse` en `async`, agregando `await new Promise(r => setTimeout(r, 0))` cada ~10 puntos evaluados dentro del bucle de un fold (no solo entre folds). Archivos permitidos: `src/models/evaluation.ts`. Complejidad: media. Riesgo: medio (cambia la firma de la función a async — todos sus consumidores deben `await`la). Tiempo: 1 h.
- **R13-T2** — Actualizar `ValidationView.tsx` para `await walkForwardRmse(...)` en ambos usos (`runWalkForward`). Archivos permitidos: `src/views/ValidationView.tsx`. Dependencias: R13-T1. Complejidad: baja. Riesgo: bajo. Tiempo: 30 min.
- **R13-T3** — Test de tiempo: repetir la medición de la auditoría (n=400, GPR un paso) y confirmar que, aunque el tiempo total no baja demasiado, la UI permanece responsiva (verificar manualmente que "Calculando…" se sigue pintando y no hay warning de "página no responde" del navegador).

**Checkpoint:** manual — n=400 sintético extendido, walk-forward de GPR no bloquea la UI de forma perceptible (usar el preview, interactuar con otro control mientras corre).
**Rollback:** revertir el commit.

---

## R14 · Presets de experimento clicables

**Origen:** C2 · **Impacto:** alto · **Dificultad:** media

**Objetivo:** botones que fijan una configuración de sliders conocida y pedagógicamente cargada (ej. "Ver la telaraña" en la pestaña 01, "Provocar sobreajuste" en la 04), convirtiendo las recetas de la guía de estudio en interacciones de un clic.
**Dependencias:** ninguna de las anteriores estrictamente, pero se ubica después de R08 (mismo patrón de estado que ya se estabilizó).
**Impacto:** `src/views/StructuralView.tsx`, `src/views/GprView.tsx`, `src/views/HybridView.tsx`, `src/views/ArimaView.tsx` (un botón de preset por pantalla que llama a `setDynamics`/`setGpr`/etc. con los valores exactos documentados en `GUIA DE ESTUDIO.md`). No crear ningún estado nuevo — los presets solo llaman a los setters ya existentes del contexto compartido.

**Microtareas (una por pantalla, mismo patrón, no dependientes entre sí salvo por convención de UI a mantener consistente):**
- **R14-T1** — `StructuralView.tsx`: botón "Ver la telaraña" → `setDynamics({...dynamics, supplyLag: 8, demandElasticity: 0.1})`. Complejidad: baja. Riesgo: bajo. Tiempo: 30 min.
- **R14-T2** — `GprView.tsx`: botón "Provocar sobreajuste" → `setGpr({...gpr, lengthScale: 0.01})`. Complejidad: baja. Riesgo: bajo. Tiempo: 20 min.
- **R14-T3** — `HybridView.tsx`: botón "Mejora ≈ 0%" → un valor de `lengthScale` grande conocido (usar el mismo criterio que documenta la guía). Complejidad: baja. Riesgo: bajo. Tiempo: 20 min.
- **R14-T4** — Enlace visible a `GUIA DE ESTUDIO.md` desde el pie de la app o el header (`App.tsx`), para los experimentos que no se conviertan en botón en esta pasada.

**Checkpoint:** manual — cada botón, al pulsarse, deja los sliders exactamente en los valores documentados en `GUIA DE ESTUDIO.md` para ese experimento.
**Rollback:** revertir cada commit de vista de forma independiente (son 4 commits separados, uno por vista, dado que son independientes entre sí).

---

## R15 · Enmiendas de documentación + CHANGELOG + versión sincronizada

**Origen:** D1, B7 · **Impacto:** medio · **Dificultad:** trivial

**Objetivo:** que `01 PRD.md`, `02 SRS.md`, `05 UI SPEC.md` dejen de contradecir la v2; que exista un CHANGELOG; que `package.json` diga la misma versión que el manual.
**Impacto:** solo archivos `.md` y `package.json`. Cero riesgo de código.

**Microtareas:**
- **R15-T1** — Agregar un bloque de 3-4 líneas al inicio de `01 PRD.md`, `02 SRS.md`, `05 UI SPEC.md`: "Enmienda v2 (jul 2026): el alcance se amplió a 7 pestañas y 3 modelos ML adicionales; ver `07 VALIDACION SPEC.md` y `08 MANUAL.md`." Tiempo: 20 min.
- **R15-T2** — Crear `CHANGELOG.md` con las entradas reconstruidas desde `git log --oneline` (una línea por versión/commit relevante). Tiempo: 30 min.
- **R15-T3** — Cambiar `"version": "2.0.0"` a `"2.1.0"` en `package.json`, agregar tag de git `v2.1.0` sobre el commit actual (requiere `git tag v2.1.0 && git push --tags` — **acción visible en el remoto, confirmar con el usuario antes de hacer push del tag**, aunque crear el tag localmente no lo es). Tiempo: 15 min.

**Checkpoint:** los 4 documentos actualizados, `package.json` y el manual coinciden en versión.
**Rollback:** revertir los commits de documentación; `git tag -d v2.1.0` si se creó y aún no se compartió.

---

## R16 · Muestra común en el Comparador + columna de configuración y aviso de folds en la 07

**Origen:** A7, A8, A9 · **Impacto:** medio · **Dificultad:** baja-media

**Objetivo:** (a) que el Comparador evalúe los 4 modelos desde el mismo `t` inicial; (b) que la tabla de walk-forward de la pestaña 07 muestre la configuración de covariables de cada modelo; (c) que un aviso informe cuando los folds solicitados se reducen.

**Microtareas:**
- **R16-T1** — En `ComparatorView.tsx`, calcular `commonStart = Math.max(arima.p+arima.d, arimax.p+arimax.d, hybrid.p+hybrid.d)` (el GPR no tiene `p+d`, empieza en 0) y usar `commonStart` para las 4 llamadas a `metricsFrom`, con una nota bajo la tabla explicando la muestra común. Archivos permitidos: `src/views/ComparatorView.tsx`. Complejidad: baja. Riesgo: bajo. Tiempo: 45 min.
- **R16-T2** — En `ValidationView.tsx`, agregar una columna "Configuración" a la tabla de `cvResults`, reutilizando el mismo patrón de string que ya usa `ComparatorView.tsx` (`p=X · d=Y · covariables`). Archivos permitidos: `src/views/ValidationView.tsx`. Complejidad: baja. Riesgo: bajo. Tiempo: 45 min.
- **R16-T3** — En `evaluation.ts`, `walkForwardFolds` ya devuelve un array — comparar `folds.length` contra el `k` solicitado en `ValidationView.tsx` y mostrar "solicitaste {k} folds; con estos datos se usan {folds.length}" cuando difieran. Archivos permitidos: `src/views/ValidationView.tsx` (no requiere tocar `evaluation.ts`, la comparación se hace en la vista). Complejidad: baja. Riesgo: bajo. Tiempo: 30 min.

**Checkpoint:** manual — Comparador con p/d distintos entre modelos muestra una nota de muestra común; tabla de CV muestra configuración; con n=96/90%/k=6 se informa la reducción a 4 folds.
**Rollback:** 3 commits independientes, revertir cualquiera sin afectar los otros dos.

---

## R17 · Deshacer autoajuste

**Origen:** C3 · **Impacto:** medio · **Dificultad:** baja

**Objetivo:** que al pulsar "Autoajustar" en GPR/ARIMAX se pueda volver a la configuración anterior con un clic.
**Impacto:** `src/views/GprView.tsx`, `src/views/ArimaxView.tsx` — guardar el estado previo en una variable local (`useState`) justo antes de sobreescribir con el resultado del autoajuste, y mostrar un botón "Restaurar mi configuración" junto al mensaje de resultado.

**Microtareas:**
- **R17-T1** — `GprView.tsx`: antes de `setGpr({...gpr, ...best})`, guardar `gpr` actual en un `useState<GprState|null>` local; agregar botón que restaure ese valor guardado. Complejidad: baja. Riesgo: bajo. Tiempo: 30 min.
- **R17-T2** — Mismo patrón en `ArimaxView.tsx`. Complejidad: baja. Riesgo: bajo. Tiempo: 30 min.

**Checkpoint:** manual — autoajustar, luego restaurar, confirma que los sliders vuelven exactamente a los valores previos.
**Rollback:** revertir cada commit de vista independientemente.

---

## R18 · Exportar métricas/series a CSV y gráfico a PNG

**Origen:** C5 · **Impacto:** medio-alto · **Dificultad:** baja-media

**Objetivo:** botón "Descargar CSV" (métricas + serie) y "Descargar imagen" (gráfico) en cada pestaña de modelo.
**Impacto:** nuevo helper `src/components/exportCsv.ts` (función pura que arma un string CSV a partir de un array de objetos, y dispara la descarga vía `Blob`/`URL.createObjectURL` — sin dependencias nuevas); uso en las 7 vistas de modelo. Para PNG: usar la captura del SVG de Recharts (`XMLSerializer` + canvas) — **si esto resulta más complejo de lo estimado, la microtarea de PNG puede diferirse; el CSV es el 80% del valor y es independiente.**

**Microtareas:**
- **R18-T1** — Implementar y testear `exportCsv(rows: Record<string,unknown>[], filename: string)` en un módulo nuevo. Complejidad: baja. Riesgo: bajo. Tiempo: 1 h.
- **R18-T2** — Botón "Descargar CSV" en `ArimaView.tsx` (patrón de referencia para las demás). Complejidad: baja. Riesgo: bajo. Tiempo: 30 min.
- **R18-T3** — Replicar en `ArimaxView.tsx`, `GprView.tsx`, `HybridView.tsx`, `ComparatorView.tsx`, `ValidationView.tsx`, `StructuralView.tsx` (6 tareas mecánicas, una por vista, independientes entre sí).
- **R18-T4 (opcional, puede diferirse)** — Exportación de PNG del gráfico activo.

**Checkpoint:** manual — cada botón de CSV descarga un archivo con los datos correctos (abrir el CSV descargado y verificar contra lo mostrado en pantalla).
**Rollback:** cada vista es un commit independiente.

---

## R19 · Configuración compartible por URL

**Origen:** C5 · **Impacto:** medio-alto · **Dificultad:** media

**Objetivo:** que el estado de `ModelParamsContext` (y el seed/noise del dataset) se pueda codificar en el query string y restaurarse al cargar la página.
**Impacto:** `src/App.tsx` (leer `URLSearchParams` al montar, escribir al cambiar estado — con debounce para no saturar el historial), `src/state/ModelParams.tsx` (exponer una forma de inicializar el estado desde un objeto externo).

**Microtareas:**
- **R19-T1** — Función `encodeStateToQuery(state)` / `decodeStateFromQuery(params)` en un módulo nuevo `src/state/urlState.ts`, con test de round-trip (encode→decode debe devolver el mismo objeto). Complejidad: media. Riesgo: bajo. Tiempo: 1.5 h.
- **R19-T2** — En `App.tsx`, al montar, si hay query string, usarlo para inicializar `ModelParamsProvider` (requiere que el provider acepte un estado inicial opcional — cambio a `ModelParams.tsx`, aditivo, con default igual al actual si no se pasa nada). Complejidad: media. Riesgo: medio (toca el estado central de la app). Tiempo: 2 h.
- **R19-T3** — Botón "Copiar enlace de esta configuración" que serializa el estado actual a la URL y lo copia al portapapeles. Complejidad: baja. Riesgo: bajo. Tiempo: 45 min.

**Checkpoint:** manual — configurar varios sliders, copiar el enlace, abrirlo en una pestaña nueva del navegador, confirmar que la configuración se restaura exactamente.
**Rollback:** revertir el commit; el comportamiento sin query string es idéntico al actual (cambio puramente aditivo).

---

## R20 · Kernel periódico opcional en el GPR (decisión D-F)

**Origen:** A6 · **Impacto:** alto · **Dificultad:** alta (la de mayor dificultad de la oleada 2, por decisión explícita del dueño del producto)

### Objetivo
Que el GPR pueda componer el kernel RBF existente con un kernel periódico opcional, para poder capturar la estacionalidad anual que el generador sintético incluye (`0.25·sin(2πt/12)`) y que hoy ningún modelo puede representar.

### Justificación
Verificado: con `p≤6` en ARIMA/ARIMAX y un kernel RBF puro en el GPR, la componente estacional del generador es estructuralmente inalcanzable. Es la mejor demo posible de "por qué existen los kernels compuestos", y el dueño del producto eligió esta ruta (más rica pedagógicamente) sobre las alternativas más baratas (subir p a 12; dummies estacionales), que quedan documentadas como descartadas en esta versión.

### Alternativas descartadas (registradas, no implementadas)
- Subir `p` hasta 12 en ARIMA/ARIMAX: mínimo esfuerzo, pero no enseña el concepto de estacionalidad de forma explícita.
- Dummies estacionales en ARIMAX: cambia la matriz de diseño e interpretación de los β, impacto pedagógico medio.

### Fórmula del kernel compuesto (no ambigua)

```
k_compuesto(x, x') = k_RBF(x, x') + k_periódico(x, x')

k_periódico(x, x') = σp² · exp( −2·sin²(π·|x−x'|/p) / lp² )
```

con `p` = período (fijo en 1/8 si `x` está normalizado a [0,1] sobre 96 meses ⇒ período de 12 meses; **debe calcularse como `12/n` donde `n` es la longitud de la serie**, no como una constante fija, para que el período siga siendo "12 observaciones" sin importar el tamaño del dataset — ver R20-T1), `lp` = escala de longitud periódica (nuevo hiperparámetro, rango sugerido [0.1, 3.0]), `σp²` = varianza de la componente periódica (nuevo hiperparámetro, rango sugerido [0.01, 2.0]).

### Dependencias
R01, R09 (mismo módulo `gpr.ts`/`forecast.ts`).

### Impacto
- Módulos afectados: `src/models/gpr.ts` (nueva función de kernel + parámetro de kernel activo), `src/models/forecast.ts` (los 3 sitios que llaman a `rbf(...)` deben poder usar el kernel compuesto cuando esté activo), `src/state/ModelParams.tsx` (`GprState` gana campos opcionales: `kernelMode: 'rbf' | 'rbf+periodic'`, `periodicLengthScale`, `periodicVariance`), `src/views/GprView.tsx` (selector + 2 sliders nuevos, condicionales al modo), `03 MODEL SPEC.md` (documentar la fórmula).
- Módulos que NO deben modificarse: `src/models/hybrid.ts` no necesita cambios si se implementa el kernel como una función intercambiable que `fitGpr`/`gprPredict` reciben — **decisión de diseño**: el kernel activo debe ser un parámetro de `GprParams` (o una función pasada explícitamente), no una rama hardcodeada dentro de `fitGpr`, para que Híbrido y ValidationView lo hereden gratis sin tocarse.

### Riesgos
- **Técnico:** medio-alto — es la recomendación matemáticamente más compleja de este documento. El autoajuste por verosimilitud marginal (`autoTuneGpr`) también debe extender su grilla de búsqueda a 5 dimensiones (l, σf², σn², lp, σp²) en modo compuesto — el costo de la búsqueda en grilla crece de 6³=216 a 6⁵≈7.776 evaluaciones, cada una con una factorización de Cholesky. **Esto puede violar el RNF-4 (rendimiento) y requiere ceder el hilo con más frecuencia o reducir los pasos de grilla por dimensión (ej. 4 valores por dimensión en vez de 6 cuando el modo es compuesto: 4⁵=1.024).** Esta es una decisión técnica que debe tomarse durante R20-T4, no antes — se registra aquí como un riesgo conocido, no como una pregunta abierta que bloquee el inicio de R20.
- **Funcional:** el kernel compuesto tiene más hiperparámetros que ajustar a mano — mayor curva de aprendizaje para el estudiante; mitigado por tener el modo RBF puro como default y el compuesto como opción explícita ("avanzado").
- **Regresión:** con `kernelMode: 'rbf'` (default), el comportamiento debe ser **exactamente idéntico** al actual — es el criterio de aceptación más importante de toda la recomendación.

### Microtareas

#### R20-T1 · Implementar el kernel periódico y la función de kernel compuesto
- **Alcance:** en `gpr.ts`, agregar `function periodic(x1, x2, lp, sigmaP2, period)`, y una función `kernel(x1, x2, params, mode)` que devuelva `rbf(...)` cuando `mode==='rbf'` o `rbf(...) + periodic(...)` cuando `mode==='rbf+periodic'`. El `period` se calcula como `12 / n` donde `n` es la longitud de la serie de entrenamiento (pasado como parámetro explícito a la función, no una constante global).
- **Contexto mínimo:** `src/models/gpr.ts` completo.
- **Archivos permitidos:** `src/models/gpr.ts`, `src/models/gpr.test.ts` (nuevo — test unitario del kernel periódico con valores conocidos: `k_periódico(x,x)` debe ser máximo, `k_periódico` en `|x-x'|=period` debe volver al máximo también).
- **Dependencias:** R09 (checkpoint pasado).
- **Complejidad:** media. **Riesgo:** medio. **Tiempo:** 2 h.
- **Criterios de aceptación:** tests unitarios del kernel pasan; con `mode='rbf'`, `kernel(x1,x2,params,'rbf') === rbf(x1,x2,params.lengthScale,params.signalVariance)` exactamente (mismo valor, no aproximado).
- **Evidencia esperada:** `npm test`.

#### R20-T2 · Extender `GprState` y propagar el modo de kernel
- **Alcance:** en `ModelParams.tsx`, agregar a `GprState`: `kernelMode: 'rbf' | 'rbf+periodic'` (default `'rbf'`), `periodicLengthScale: number` (default 1.0), `periodicVariance: number` (default 0.3). En `gpr.ts`, `fitGpr` y `negLogMarginalLikelihood` deben aceptar el modo y los parámetros periódicos, usando la función `kernel(...)` de R20-T1 en vez de `rbf(...)` directamente en todos los sitios donde hoy se llama a `rbf`.
- **Contexto mínimo:** `src/state/ModelParams.tsx`, `src/models/gpr.ts` completo (todos los usos de `rbf`).
- **Archivos permitidos:** `src/state/ModelParams.tsx`, `src/models/gpr.ts`.
- **Dependencias:** R20-T1.
- **Complejidad:** media. **Riesgo:** medio (toca todos los call-sites internos de `fitGpr`). **Tiempo:** 2 h.
- **Criterios de aceptación:** el test de consistencia de R01-T2 (GPR, modo implícito `'rbf'`) sigue en verde sin ningún cambio — es la prueba de que el modo default es bit-a-bit idéntico al comportamiento previo.
- **Evidencia esperada:** `npm test`.

#### R20-T3 · Propagar el modo de kernel a `forecast.ts`
- **Alcance:** `gprPredict`, `gprForecast`, `gprOneStepForecast`, `hybridForecast` deben aceptar y usar el mismo `kernel(...)` con el modo correspondiente (recibido como parte de `GprParams` extendido, o como argumento adicional — preferir extender `GprParams` para que el cambio se propague por los tipos existentes sin agregar parámetros nuevos a cada función).
- **Contexto mínimo:** `src/models/forecast.ts` completo.
- **Archivos permitidos:** `src/models/forecast.ts`.
- **Dependencias:** R20-T2.
- **Complejidad:** media. **Riesgo:** medio. **Tiempo:** 1.5 h.
- **Criterios de aceptación:** R01-T2 y R09-T4 siguen en verde con el modo default.
- **Evidencia esperada:** `npm test`.

#### R20-T4 · Extender el autoajuste por verosimilitud marginal al modo compuesto
- **Alcance:** en `autoTuneGpr`, cuando el modo es `'rbf+periodic'`, extender la grilla de búsqueda a las 2 dimensiones nuevas (`lp`, `σp²`) con **4 valores por dimensión en modo compuesto** (no 6, por la razón de costo computacional documentada en "Riesgos" arriba — esta es la resolución concreta de ese riesgo, tomada aquí, no antes), cediendo el hilo con la misma frecuencia relativa que hoy (tras cada valor del primer parámetro de la grilla).
- **Contexto mínimo:** `autoTuneGpr` completo en `gpr.ts`.
- **Archivos permitidos:** `src/models/gpr.ts`.
- **Dependencias:** R20-T3.
- **Complejidad:** alta. **Riesgo:** medio-alto (el más riesgoso de rendimiento en toda la oleada 2 — medir tiempo real). **Tiempo:** 2.5 h.
- **Criterios de aceptación:** con el dataset sintético por defecto (n=96), el autoajuste en modo compuesto termina en menos de 5 segundos (medir con `Date.now()` antes/después, manualmente); el hilo no se congela (UI sigue respondiendo durante el cálculo).
- **Evidencia esperada:** tiempo medido + captura de la UI respondiendo durante el cálculo.

#### R20-T5 · UI: selector de modo + 2 sliders nuevos en `GprView.tsx`
- **Alcance:** agregar un selector (mismo patrón de botones `role="group"` que el de ±1σ/±2σ ya existente) para elegir `kernelMode`; mostrar los 2 sliders nuevos (`periodicLengthScale`, `periodicVariance`) solo cuando `kernelMode==='rbf+periodic'`; actualizar la nota pedagógica de la pantalla explicando qué captura el kernel periódico.
- **Contexto mínimo:** `src/views/GprView.tsx` completo.
- **Archivos permitidos:** `src/views/GprView.tsx`.
- **Dependencias:** R20-T4.
- **Complejidad:** media. **Riesgo:** bajo. **Tiempo:** 2 h.
- **Criterios de aceptación:** manual — con `kernelMode='rbf+periodic'` y el dataset sintético (que tiene estacionalidad conocida), el RMSE mejora respecto del RBF puro con los mismos hiperparámetros de suavidad; el modo default sigue viéndose exactamente como antes.
- **Evidencia esperada:** captura de pantalla con RMSE comparado (RBF puro vs compuesto).

#### R20-T6 · Documentar la fórmula en `03 MODEL SPEC.md`
- **Alcance:** agregar la fórmula del kernel compuesto (la misma de este blueprint) a la sección de GPR del spec.
- **Archivos permitidos:** `03 MODEL SPEC.md`.
- **Dependencias:** R20-T5.
- **Complejidad:** trivial. **Riesgo:** bajo. **Tiempo:** 20 min.

### Checkpoint R20
- **Validar:** `npm test` verde completo (todos los tests previos + los nuevos de R20) · `tsc --noEmit` limpio · manual: modo default idéntico al comportamiento pre-R20 · modo compuesto mejora el RMSE con el dataset sintético (que tiene estacionalidad de período 12) · autoajuste compuesto termina en <5s sin congelar el hilo.
- **Condición para continuar:** todo lo anterior en verde. Esta es la recomendación más compleja del documento — si el checkpoint falla, no intentar "arreglar sobre la marcha"; volver a R20-T4 (el punto de mayor riesgo) y revisar antes de reintentar el resto.

### Rollback
Cada microtarea es razonablemente independiente en el sentido de que el modo default (`'rbf'`) nunca deja de funcionar hasta que se llega a R20-T5 (UI). Si el checkpoint falla en T4 (rendimiento), se puede revertir solo T4-T6 y dejar T1-T3 (el kernel compuesto implementado pero sin autoajuste ni UI) como una base para retomar después, o revertir la recomendación completa.

---

# OLEADA 3 — Prioridad P2

*(Detalle ligero: recomendaciones de bajo riesgo y alta autonomía, salvo R24 que recibe tratamiento completo por instrucción explícita del dueño del producto.)*

## R21 · Paquete de accesibilidad

**Origen:** C4 · **Impacto:** medio · **Dificultad:** baja

**Objetivo:** cumplir lo que `02 SRS.md` (RNF-5) ya afirma como implementado.
**Microtareas (independientes entre sí, mismo commit o separados según preferencia del ejecutor):**
- Envolver `<App />` en `main.tsx` con `<MotionConfig reducedMotion="user">` de `framer-motion`. Archivos permitidos: `src/main.tsx`. Riesgo: bajo. Tiempo: 15 min.
- Agregar manejo de flechas izquierda/derecha en el `role="tablist"` de `App.tsx` (patrón WAI-ARIA APG estándar: flecha derecha mueve el foco a la siguiente pestaña, flecha izquierda a la anterior, con wrap-around). Archivos permitidos: `src/App.tsx`. Riesgo: bajo. Tiempo: 45 min.
- Subir el valor de `ink-500` en `tailwind.config.js` de `#78838d` a un tono con contraste ≥4.5:1 sobre `#171c22` (ej. `#8b95a0` — **verificar con la misma fórmula WCAG usada en la auditoría antes de fijar el valor final**, no asumir que este ejemplo ya cumple). Archivos permitidos: `tailwind.config.js`. Riesgo: bajo (cambio de color global, revisar visualmente que no rompe el sistema "instrumento científico" del 05 UI SPEC). Tiempo: 30 min + revisión visual.
- Agregar `role="img"` y `aria-label` descriptivo a los `ResponsiveContainer`/gráficos de Recharts en cada vista (7 vistas, cambio mecánico y repetido). Tiempo: 1.5 h total.

**Checkpoint:** manual con `prefers-reduced-motion` activado en el navegador (o `preview_resize` con emulación si está disponible) — sin animación de transición de pestañas; navegación de pestañas por teclado con flechas; contraste verificado con la misma fórmula de la auditoría.
**Rollback:** cada cambio es independiente y trivial de revertir.

---

## R22 · Nota sobre exógenas en niveles + toggle de diferenciación

**Origen:** A4 · **Impacto:** medio · **Dificultad:** media

**Objetivo:** (a) nota honesta en `03 MODEL SPEC.md` y en `ArimaxView.tsx` sobre mezclar objetivo diferenciado con exógenas en niveles; (b) toggle "Diferenciar exógenas también" activado por defecto cuando `d≥1`, que aplica `difference(exogColumn, d)` a cada covariable antes de construir la matriz de diseño.

**Microtareas:**
- **R22-T1** — Nota en `03 MODEL SPEC.md` y `ArimaxView.tsx` (mismo estilo "limitación honesta" que ya usa el proyecto para el término MA). Riesgo: bajo. Tiempo: 30 min.
- **R22-T2** — En `arimax.ts`, agregar un parámetro opcional `diffExog: boolean` a `fitArimax`; cuando es `true` y `d≥1`, aplicar `difference(...)` a cada columna de `exog` antes de construir `X` (reutilizar `difference` de `arima.ts`, ya importado). **Con `diffExog` por defecto `undefined`/`false`, el comportamiento debe ser idéntico al actual** — criterio de aceptación central. Archivos permitidos: `src/models/arimax.ts`, `src/models/forecast.ts` (mismo parámetro en `arimaxForecast`, `hybridForecast`), sus tests. Riesgo: medio (toca `arimax.ts`, aunque de forma aditiva — depende de R01-T2 para confirmar que el caso default no cambia). Tiempo: 2 h.
- **R22-T3** — Toggle en `ArimaxView.tsx` (activado por defecto solo cuando `d≥1`, con el mismo patrón visual que el toggle "Diferenciar (predecir Δprecio)" ya existente en `ValidationView.tsx` para ML — reutilizar ese patrón de copy, no inventar uno nuevo). Riesgo: bajo. Tiempo: 45 min.

**Checkpoint:** `npm test` verde (R01-T2 confirma que sin el toggle nada cambió) · manual: con el toggle activo y datos con tendencia fuerte en una covariable, los β cambian de forma coherente con la interpretación económica correcta.
**Rollback:** revertir el commit; el parámetro es opcional y aditivo.

---

## R23 · Tour de primera visita + glosario en tooltips

**Origen:** C2 · **Impacto:** medio · **Dificultad:** media

**Objetivo:** ayudar al estudiante que usa la app sin profesor delante.
**Microtareas:**
- **R23-T1** — Tooltip/popover de una palabra en términos técnicos clave (BIC, verosimilitud marginal, σn², walk-forward) — componente nuevo `src/components/Term.tsx` (envuelve el texto con un `<abbr>`/tooltip accesible), usado donde aparecen esos términos en las notas existentes. Riesgo: bajo. Tiempo: 2 h.
- **R23-T2** — Tour de 4-5 pasos en la primera visita (detectar con `localStorage`, ej. `copperlab_visited`), señalando: la barra de dataset, las pestañas numeradas, el botón de autoajuste, el enlace a la guía de estudio. Puede implementarse sin librería nueva (overlay simple con posicionamiento manual) o evaluarse una librería ligera — **si se evalúa una dependencia nueva, eso es una decisión que excede el alcance de "no agregar funcionalidades fuera de lo pedido" y debe confirmarse antes de instalarla; la implementación sin dependencias nuevas es la ruta por defecto de este blueprint.** Riesgo: medio (única tarea de esta oleada con una decisión de dependencia potencialmente abierta). Tiempo: 3 h.

**Checkpoint:** manual — con `localStorage` limpio, el tour aparece; tras cerrarlo, no reaparece en la siguiente carga.
**Rollback:** revertir el commit; borrar la clave de `localStorage` usada.

---

## R24 · Pronóstico real a futuro (h pasos adelante con escenarios de exógenas)

**Origen:** hallazgo de la sección 3.5 / "funciones importantes que faltan" · **Impacto:** alto · **Dificultad:** alta

### Objetivo
Que la app pueda producir un pronóstico real hacia adelante (más allá del último dato observado), no solo evaluación retrospectiva out-of-sample, con una banda de incertidumbre que se ensancha de forma honesta.

### Supuestos de producto fijados para poder descomponer (D-G, confirmados por el dueño del producto)
Dado que el dueño del producto pidió proponer un default razonable y descomponer igual, se fijan estos supuestos **explícitos** — cualquier cambio a ellos es una decisión de producto nueva, no un ajuste técnico:

1. **Horizonte por defecto:** `h = 12` períodos (meses o trimestres, según la unidad del dataset activo), ajustable de 1 a 24 vía slider.
2. **Covariables futuras — supuesto por defecto:** se mantienen constantes en su último valor observado ("supuesto ingenuo", declarado explícitamente en pantalla: *"Se asume que crecimiento, dólar, inventarios, libor y posición especulativa se mantienen en su último valor observado durante el horizonte. Esto es una simplificación deliberada, no una predicción de esas variables."*).
3. **Ajuste opcional de escenario:** un slider de "tasa de crecimiento durante el horizonte" (%/período) por covariable, reutilizando el patrón de UI ya validado en `StructuralView.tsx` (`activityGrowth`) — no se construye un input de series de tiempo completo, por simplicidad.
4. **Modelos aplicables:** ARIMA, ARIMAX e Híbrido requieren pronóstico **recursivo** (alimentarse de sus propias predicciones, ya que no hay "historia real" futura) — el propio `07 VALIDACION SPEC.md` declaró el recursivo "fuera de alcance" por riesgo de divergencia cerca de raíz unitaria; para R24 esto ya no es evitable, así que se reutiliza el patrón de cortacircuito numérico que ya existe en `structuralDynamic.ts` (límites `[0.25·P̄, 4·P̄]`) adaptado a este contexto: si la predicción recursiva excede un múltiplo razonable del rango histórico de la serie, se trunca y se marca visualmente como "fuera de rango de confianza". GPR usa `gprForecast` (extrapolación), ya construido y sin necesidad de recursividad.
5. **Ubicación en la UI:** una sección nueva dentro de la pestaña 07 ("Proyección a futuro"), no una pestaña 08 nueva — para no inflar la navegación, dado que 07 ya es la pestaña de pronóstico.

### Dependencias
R01, R06, R09 (reutiliza `forecast.ts` y el patrón de estado de la pestaña 07 ya endurecido en la oleada 1).

### Impacto
- Módulos afectados: `src/models/forecast.ts` (nuevas funciones `arimaxForecastAhead`, `gprForecastAhead` ya cubierta por `gprForecast` existente reutilizada tal cual, `hybridForecastAhead`), `src/state/ModelParams.tsx` (nuevo estado para el horizonte y los supuestos de escenario), `src/views/ValidationView.tsx` (nueva sección de UI).
- Módulos que NO deben modificarse: `src/models/arima.ts`, `src/models/arimax.ts`, `src/models/gpr.ts`, `src/models/hybrid.ts` (todo el pronóstico a futuro se construye en `forecast.ts`, paralelo, siguiendo el mismo principio arquitectónico que ya usa el proyecto).

### Riesgos
- **Técnico:** alto — el pronóstico recursivo de ARIMA/ARIMAX cerca de raíz unitaria puede divergir; el cortacircuito numérico es la mitigación pero introduce su propia superficie de casos borde a probar.
- **Funcional:** el estudiante puede interpretar el pronóstico de 12 meses como una predicción real del precio del cobre — **riesgo pedagógico**, no solo técnico. Requiere una advertencia muy visible (no una nota al pie) de que esto NO es el propósito de la app (recordar el PRD: "la meta no es predecir el precio real del cobre").
- **Regresión:** ninguna esperada sobre las pestañas 02-07 existentes si se sigue el principio de funciones paralelas.

### Microtareas

#### R24-T1 · `arimaxForecastAhead`: pronóstico recursivo con cortacircuito
- **Alcance:** nueva función en `forecast.ts` que, dado un ajuste ya estimado (reutilizar `arimaxForecast` para obtener los coeficientes sobre todo el histórico disponible), genere `h` predicciones hacia adelante alimentándose de sus propias predicciones anteriores como rezagos, con las exógenas futuras provistas como parámetro (arrays de longitud `h`, construidos en la UI según los supuestos 2-3 de arriba); aplicar el cortacircuito: si `|predicción| > 3 × (max(y) − min(y)) + max(y)` (rango histórico ampliado), truncar al límite y marcar ese punto con un flag `outOfConfidence: true` en el resultado.
- **Contexto mínimo:** `arimaxForecast` completo en `forecast.ts`, `structuralDynamic.ts` (solo como referencia del patrón de cortacircuito, no se importa nada de ahí).
- **Archivos permitidos:** `src/models/forecast.ts`, su test.
- **Dependencias:** R09 (checkpoint pasado).
- **Complejidad:** alta. **Riesgo:** alto. **Tiempo:** 3 h.
- **Criterios de aceptación:** test con una serie sintética con tendencia fuerte y `d=2` (caso más propenso a divergir): la función no produce `NaN`/`Infinity`, y marca `outOfConfidence` cuando corresponde.
- **Evidencia esperada:** `npm test`.

#### R24-T2 · `hybridForecastAhead`
- **Alcance:** análogo a R24-T1, combinando `arimaxForecastAhead` con `gprForecast` (extrapolación) sobre los residuos, extendido a los `h` puntos futuros.
- **Archivos permitidos:** `src/models/forecast.ts`, su test.
- **Dependencias:** R24-T1.
- **Complejidad:** media. **Riesgo:** medio. **Tiempo:** 1.5 h.
- **Criterios de aceptación:** test de consistencia — con `h=0`, el resultado coincide con el pronóstico ya existente.
- **Evidencia esperada:** `npm test`.

#### R24-T3 · Estado nuevo para horizonte y escenario de exógenas
- **Alcance:** en `ModelParams.tsx`, extender `ValidationState` con `forecastHorizon: number` (default 12), `exogScenario: { growthRate: number; ... }` (una tasa por covariable, default 0 = constante).
- **Archivos permitidos:** `src/state/ModelParams.tsx`.
- **Dependencias:** R24-T2.
- **Complejidad:** baja. **Riesgo:** bajo. **Tiempo:** 30 min.

#### R24-T4 · Sección "Proyección a futuro" en `ValidationView.tsx`
- **Alcance:** nueva sección (debajo de la validación walk-forward existente): slider de horizonte, sliders de tasa de crecimiento por covariable (reutilizando el componente `Slider` existente), gráfico que extiende el `Chart` ya usado con los puntos nuevos más allá de `n`, y **una advertencia prominente, no una nota al pie**: *"Esto es una proyección condicional a los supuestos de la izquierda, no una predicción del precio real del cobre — el propósito de esta app es entender los modelos, no predecir el mercado."*
- **Contexto mínimo:** `src/views/ValidationView.tsx` completo, `src/components/Chart.tsx` (para confirmar que acepta puntos con fecha posterior al último dato sin romperse).
- **Archivos permitidos:** `src/views/ValidationView.tsx`.
- **Dependencias:** R24-T3.
- **Complejidad:** alta. **Riesgo:** medio. **Tiempo:** 3 h.
- **Criterios de aceptación:** manual — el gráfico muestra los `h` puntos futuros con la banda de incertidumbre ensanchándose; los puntos marcados `outOfConfidence` se distinguen visualmente (ej. línea punteada o color distinto); la advertencia es imposible de no ver.
- **Evidencia esperada:** captura de pantalla.

#### R24-T5 · Documentación
- **Alcance:** agregar la sección al `07 VALIDACION SPEC.md` y al `08 MANUAL.md`, incluyendo los 5 supuestos fijados arriba, textuales.
- **Archivos permitidos:** `07 VALIDACION SPEC.md`, `08 MANUAL.md`.
- **Dependencias:** R24-T4.
- **Complejidad:** baja. **Riesgo:** bajo. **Tiempo:** 45 min.

### Checkpoint R24
- **Validar:** `npm test` verde completo · manual: proyección a 12 meses con el dataset sintético no diverge a `NaN`/`Infinity` en ninguna combinación razonable de p/d; la advertencia pedagógica es visible sin necesidad de hacer scroll adicional; el cortacircuito se activa visiblemente en un caso forzado a propósito (ej. `d=2`, `p=6`, dataset con mucho ruido).
- **Condición para continuar:** todo lo anterior en verde. Dada la complejidad, es aceptable cerrar esta recomendación en más de una sesión de trabajo, siempre que cada microtarea individual quede en un commit propio y verificable.

### Rollback
Toda la recomendación es aditiva (funciones y estado nuevos, sección de UI nueva) — revertir el conjunto de commits de R24 no afecta ninguna pestaña existente.

---

## R25 · Higiene final

**Origen:** B8, D4, C6 · **Impacto:** bajo-medio · **Dificultad:** baja

**Objetivo:** pulido acumulativo de bajo riesgo.
**Microtareas (todas independientes, pueden agruparse en un solo commit o varios según preferencia):**
- Resolver los comentarios de borrador en `arima.ts` (líneas 49-51: la deliberación "fill with null or 0…") — eliminar la asignación muerta `diffFitted[t] = diffed[t]` para `t<p` si en efecto no se usa (confirmar con R01-T2 que no cambia el resultado antes de eliminar). Riesgo: bajo (depende de R01-T2 para confirmar que es código muerto real). Tiempo: 30 min.
- Unificar idioma de comentarios (español) en los archivos donde hay mezcla. Tiempo: 30 min.
- Borrar `01 PRD.md 2` (duplicado accidental) y los archivos temporales de Office (`~$*`, `.~*`) y `.Rhistory` del directorio (confirmar que están en `.gitignore` y no trackeados antes de borrar — si están trackeados, usar `git rm`, no borrado directo). Tiempo: 15 min.
- Renombrar `GUIA DE ESTUDIO.md` de "8 noches" a reflejar las 9 noches reales que contiene (o ajustar el contenido a 8 — decisión menor de redacción, tomar la opción de renombrar el título por ser el cambio de menor riesgo). Tiempo: 10 min.
- Detectar seriales de fecha de Excel en `parser.ts` (`formatDate`) y convertirlos a formato legible en vez de mostrarlos crudos. Riesgo: bajo. Tiempo: 45 min.
- Etiqueta de unidad junto al eje Y en `Chart.tsx` (heurística: si los valores superan 50, asumir ¢/lb; si no, USD/lb) y nota de unidades en `StructuralView.tsx`. Riesgo: bajo. Tiempo: 45 min.

**Checkpoint:** `npm test` verde · `tsc --noEmit` limpio · revisión visual de que ningún cambio alteró el comportamiento de ninguna pestaña.
**Rollback:** cada punto es un commit independiente y trivial de revertir.

---

# §5 · Cronograma de ejecución (estimado)

| Oleada | Recomendaciones | Tiempo estimado acumulado |
|---|---|---|
| 0 | R01 | ~3 h |
| 1 (P0) | R02–R10 | ~18 h |
| 2 (P1) | R11–R20 | ~28 h (R20 concentra ~13 h por su complejidad) |
| 3 (P2) | R21–R25 | ~15 h (R24 concentra ~9 h) |
| **Total** | | **~64 h** de trabajo de implementación, sin contar revisión humana en cada checkpoint |

# §6 · Matriz de dependencias (resumen)

| Recomendación | Depende de | Bloquea |
|---|---|---|
| R01 | — | Todas |
| R02 | R01 | R03, R05 |
| R03 | R02 | R04+ (por orden, no por dependencia técnica) |
| R04 | — (técnica); R01 (orden) | — |
| R05 | R02, R03 | R08 (banner compartido) |
| R06 | R01 | R07 (mismo archivo, orden) |
| R07 | — | — |
| R08 | R01, R05 | R11-R20 (patrón `fmt`/paneles reutilizado) |
| R09 | R01 | R20 (mismo módulo) |
| R10 | — | — |
| R11 | R01, R08 | R12 |
| R12 | R11 | — |
| R13 | R05 | — |
| R14–R19 | R08 (orden, no técnica dura) | — |
| R20 | R01, R09 | R24 (mismo módulo `forecast.ts`) |
| R21–R23, R25 | R08 (orden) | — |
| R24 | R01, R06, R09, R20 | — |

# §7 · Matriz de riesgos (resumen global)

| Recomendación | Riesgo técnico | Riesgo funcional | Riesgo de regresión |
|---|---|---|---|
| R01 | Bajo | Ninguno | Ninguno |
| R02 | Bajo | Medio (heurística de locale) | Bajo |
| R03 | Medio | Bajo | Bajo |
| R04 | Bajo | Bajo | Bajo |
| R05 | Bajo | Bajo | Bajo |
| R06 | Medio | Bajo | Medio |
| R07 | Ninguno | Ninguno | Ninguno |
| R08 | Alto (superficie ancha) | Medio | Alto |
| R09 | Bajo | Medio (números cambian a propósito) | Bajo |
| R10 | Bajo (T1); Medio (T2) | Bajo | Ninguno |
| R11–R12 | Medio | Bajo | Medio |
| R13 | Medio | Bajo | Bajo |
| R14, R17, R25 | Bajo | Bajo | Bajo |
| R15 | Ninguno | Ninguno | Ninguno |
| R16 | Bajo | Bajo | Bajo |
| R18–R19 | Medio | Bajo | Bajo |
| R20 | Alto | Medio | Medio |
| R21–R23 | Bajo-Medio | Bajo | Bajo |
| R24 | Alto | Alto (pedagógico) | Bajo |

# §8 · Criterios globales de aceptación

Antes de dar por cerrada **cualquier** recomendación de este documento:

1. `npx tsc --noEmit` — cero errores.
2. `npm test` — todos los archivos en verde, incluyendo los de recomendaciones anteriores (nunca solo los nuevos).
3. `npm run build` — exitoso.
4. Ningún error nuevo en la consola del navegador para las vistas tocadas (verificar con las herramientas de preview).
5. `git diff` revisado archivo por archivo contra la lista de "Archivos permitidos" de cada microtarea antes de hacer commit — cualquier archivo fuera de esa lista en el diff es una señal de alcance excedido y debe revertirse de ese commit.
6. Un commit por recomendación (no por microtarea suelta, salvo excepciones ya anotadas explícitamente como independientes en R14/R17/R18/R21/R25).
7. El checkpoint específico de la recomendación, documentado arriba, pasado y con su evidencia guardada.

# §9 · Restricciones globales para el ejecutor

- No refactorizar código fuera del alcance exacto de la microtarea activa, aunque se "vea feo" o se identifique una mejora obvia — registrar la observación aparte, no actuar sobre ella.
- No renombrar variables, funciones ni archivos existentes salvo que la microtarea lo pida explícitamente.
- No mover archivos salvo en R10-T2 (y solo con confirmación humana).
- No cambiar la arquitectura general (contexto compartido, separación fit/predict, ausencia de backend) — ninguna recomendación de este documento lo requiere.
- No actualizar dependencias salvo `xlsx` en R04, explícitamente.
- No modificar las funciones `fitArima`/`fitArimax`/`fitGpr`/`fitHybrid` salvo los cambios aditivos explícitamente autorizados en R12-T2 (campo nuevo de retorno) y R20-T2/T3 (parámetro de modo de kernel) — nunca su lógica de estimación central.
- No agregar funcionalidades no descritas en la microtarea activa, por útiles que parezcan.
- No saltar el checkpoint de una recomendación para "ir más rápido".
- Ante cualquier ambigüedad no cubierta explícitamente en este documento: **detener y reportar**, no decidir por cuenta propia — es exactamente la regla que este documento sigue respecto de R20/R24/R11-R12 antes de que el dueño del producto las resolviera.
