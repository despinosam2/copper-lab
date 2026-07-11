# 07 — VALIDACIÓN SPEC · Predicción out-of-sample, validación cruzada y selección de variables

**Estado: IMPLEMENTADO en v2.0** (pestaña 07 · Predicción), con una extensión
sobre el diseño original: además de los cuatro modelos del curso, la pestaña
incluye tres modelos de ML implementados de forma transparente en
`src/models/ml.ts` — Ridge (lineal regularizado), k-NN y bosque aleatorio
(determinista, semilla fija) — que usan como características los rezagos del
precio más las 5 covariables del dataset del curso.

## Objetivo pedagógico

Cerrar la brecha más señalada por la propia presentación del curso: todo lo
que la app muestra hoy es ajuste **dentro de muestra**, y "la prueba
definitiva de un modelo predictivo es su rendimiento en datos futuros". La
pestaña 07 convierte esa advertencia en experiencia directa: el estudiante
**ve** cómo su modelo favorito se degrada al salir de la muestra, cuánto varía
esa degradación entre distintos cortes temporales, y qué variables aportan
predicción real versus ajuste cosmético.

---

## F9 · División entrenamiento / prueba

- **Slider "% de entrenamiento"**: 50%–90%, paso 5%, default 80%.
- El corte es **temporal, nunca aleatorio**: entrenamiento = primeras
  observaciones, prueba = últimas. Barajar destruiría la estructura temporal
  (el modelo "vería el futuro"). Esta decisión se explica en la nota de
  pantalla — es la primera lección de la pestaña.
- **Gráfico principal**: la serie completa con la zona de prueba sombreada y
  una línea vertical en el corte (mismo patrón visual que la línea de shock
  del simulador dinámico). Línea del modelo en cobre continua sobre
  entrenamiento y punteada (o en otro tono) sobre prueba.
- **Selector de modelo**: ARIMA · ARIMAX · GPR · Híbrido. Cada modelo usa la
  configuración que el estudiante dejó en su pestaña (estado compartido, misma
  regla que el Comparador: los números siempre son trazables a lo que se vio).
- **Métricas lado a lado**: RMSE/MAE/MAPE/R² de entrenamiento y de prueba, más
  un readout destacado de **degradación** = (RMSE_test − RMSE_train)/RMSE_train,
  en %. Ese número ES la lección.

### Modo de predicción en la zona de prueba

Un paso adelante con historia real (*one-step-ahead*): los coeficientes se
congelan con el entrenamiento, pero cada predicción de prueba usa los valores
**observados** anteriores como rezagos. Se elige sobre el pronóstico recursivo
(alimentarse de las propias predicciones) por dos razones:

1. **Robustez (RNF-3)**: el recursivo puede diverger con ARIMA cerca de raíz
   unitaria — inaceptable en demo en vivo.
2. **Comparabilidad**: es la misma definición de ajuste que usan las pestañas
   02–05 y las tablas del estudio del curso, así que train vs test es una
   comparación limpia de "mismos mecanismos, datos no vistos".

La nota de pantalla documenta la elección y menciona el pronóstico recursivo
como extensión (fuera de alcance de esta versión).

### Supuesto sobre las exógenas

En la zona de prueba, ARIMAX e Híbrido usan los valores **observados** de las
covariables (pronóstico *condicional*: "si hubiéramos conocido el dólar y la
actividad, ¿cuánto habríamos errado en el precio?"). Es el estándar para
evaluar la relación precio↔covariables; predecir también las covariables es
otro problema. Documentado en la nota.

---

## F10 · Validación cruzada walk-forward (rolling origin)

**La validación cruzada k-fold clásica (barajar y partir) es inválida en
series de tiempo** — entrenar con datos posteriores al bloque de prueba es
fuga de información. Se implementa el estándar para series temporales:
**walk-forward con origen rodante y ventana expansiva**:

```
fold 1:  entrena [0 … 60%)   → prueba (60% … 70%]
fold 2:  entrena [0 … 70%)   → prueba (70% … 80%]
fold 3:  entrena [0 … 80%)   → prueba (80% … 90%]
fold 4:  entrena [0 … 90%)   → prueba (90% … 100%]
```

- **Selector de folds**: 3–6, default 4. El primer fold nunca entrena con
  menos del 50% de los datos (con datasets muy cortos se reduce k
  automáticamente y se informa).
- **Salida**: tabla con RMSE de prueba por fold + **media ± desviación
  estándar**. La desviación entre folds es el segundo mensaje pedagógico: un
  modelo puede ganar en un corte y perder en otro — la estabilidad importa
  tanto como el promedio.
- Botón **"Validar los 4 modelos"**: corre el walk-forward para ARIMA, ARIMAX,
  GPR e Híbrido con sus configuraciones actuales y muestra un mini-comparador
  out-of-sample (media ± σ por modelo). Es el gemelo honesto del Comparador
  de la pestaña 06 — y el experimento estrella: *¿el ganador in-sample sigue
  ganando fuera de muestra?*

**Costo computacional** (verificado contra los tamaños reales): el caso más
caro es el Híbrido con el dataset del curso (~131 puntos): OLS de ≤12 columnas
+ Cholesky de ~118×118 por fold. Con 4 folds × 4 modelos ≈ instantáneo salvo
los Cholesky (~decenas de ms). Se usa el mismo patrón async con cesión de hilo
del botón de autoajuste GPR — lección ya aprendida: nunca congelar el hilo.

---

## F11 · Importancia de variables (¿qué mueve el precio?)

Aplica a ARIMAX e Híbrido (los que usan exógenas; el GPR de la app es
univariado y ARIMA no tiene covariables — la pantalla lo indica).

**Método: ablación leave-one-covariate-out con re-ajuste**, evaluada
out-of-sample:

```
para cada covariable v en {crecimiento, dólar, stocks, libor, part. largas}:
  1. re-ajustar el modelo SIN v (solo con el tramo de entrenamiento)
  2. medir RMSE en la zona de prueba
  3. importancia(v) = RMSE_test(sin v) − RMSE_test(completo)
```

- **Salida**: gráfico de barras horizontales ordenado (mismo estilo que la
  descomposición del modelo estructural). Barra positiva = "quitar esta
  variable empeora la predicción" (aporta); barra ≈ 0 o negativa = "no aporta
  — o incluso estorba fuera de muestra".
- Se elige ablación con re-ajuste (y no coeficientes estandarizados ni
  permutación) porque: (a) re-ajustar un OLS de ≤12 columnas es gratis, (b) con
  covariables económicas correlacionadas entre sí (dólar y libor, p. ej.) los
  coeficientes individuales engañan, mientras que "¿qué pierdo si no la
  tengo?" es la pregunta económica real, y (c) medida en la zona de PRUEBA
  distingue aporte predictivo de ajuste cosmético — el punto de toda la
  pestaña.
- **Advertencia en la nota**: con covariables colineales, quitar una puede no
  empeorar nada porque otra la sustituye — importancia baja ≠ variable
  económicamente irrelevante. (Discusión de causalidad vs correlación del
  Bloque 3.)

---

## Cambios técnicos requeridos (el trabajo real)

El bloque central es separar **ajuste** de **predicción** — hoy están
fusionados en los cuatro modelos:

| Módulo | Cambio | Naturaleza |
|---|---|---|
| `arima.ts` / `arimax.ts` | Dividir en `estimate(train) → coefs` y `predictOneStep(coefs, historia, exog)` | Refactor limpio; la fórmula ya existe |
| `gpr.ts` | Generalizar `fitGpr` para predecir en `xTest` distinto del entrenamiento | La matemática GPR ya lo contempla (k* entre prueba y entrenamiento); es el cambio más natural |
| `gpr.ts` | Normalización de x y estandarización de y calculadas **solo con entrenamiento** | Crítico: hacerlo con toda la serie sería fuga de información |
| `hybrid.ts` | Encadenar las dos piezas anteriores | Mecánico una vez existan |
| `views/ValidationView.tsx` | Pestaña nueva | Ensambla piezas existentes (Chart, métricas, patrón del Comparador) |
| `App.tsx` / `ModelParams` | Registrar pestaña 07 y su estado (split %, folds, modelo activo) | Mecánico |

**Bonus pedagógico gratis del GPR out-of-sample**: al predecir más allá del
último punto de entrenamiento, la media del GPR revierte hacia la media
histórica y la banda **se ensancha** — el modelo declarando "aquí ya no sé".
Es la imagen más honesta de toda la app y no requiere código extra: es el
comportamiento natural del kernel RBF en extrapolación.

## Plan por etapas

| Etapa | Contenido | Valor |
|---|---|---|
| **1 · MVP** | Refactor fit/predict + split train/test + gráfico + métricas lado a lado con degradación | El 70% del valor pedagógico |
| **2 · CV** | Walk-forward + tabla de folds + "Validar los 4 modelos" | El comparador honesto |
| **3 · Variables** | Ablación + gráfico de importancia | Selección de variables con evidencia |

Cada etapa es entregable por sí sola. Estimación honesta: etapa 1 es media
jornada (el refactor es lo delicado — hay que verificar que las pestañas
02–05 sigan dando números idénticos tras separar fit/predict); etapas 2 y 3
son 2–3 horas cada una sobre la base de la etapa 1.

## Criterios de aceptación

1. Con 100% de entrenamiento, las métricas de la pestaña 07 coinciden
   exactamente con las de las pestañas 02–05 (regresión de consistencia).
2. RMSE de prueba ≥ RMSE de entrenamiento en configuraciones sobreajustadas
   (l mínimo en GPR debe mostrar degradación brutal — es la demo clave).
3. Ninguna operación congela el hilo del navegador (patrón async del
   autoajuste).
4. Con el Excel del curso (131 puntos) todo corre en < 1 s.
5. Determinismo: mismos datos + misma configuración ⇒ mismos resultados.
