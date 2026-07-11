# Guía de estudio — 8 noches con COPPER LAB

Plan para dominar la herramienta y la teoría detrás de cada modelo, estudiando
~2 horas por noche. Sigue la secuencia de las pestañas (01→06), que es la misma
secuencia pedagógica del curso.

**Estructura de cada noche:** 30 min de teoría (leer la sección correspondiente
de `03 MODEL SPEC.md` y `04 COURSE SPEC.md` + la nota de la pantalla) · 60–70 min
de práctica guiada en la app · 20 min de auto-test escribiendo las respuestas
con tus palabras.

---

## Noche 1 — Los datos (barra superior)

**Teoría:** naturaleza de las series de commodities; datos sintéticos vs. reales;
proceso generador de datos; reproducibilidad; el error AR(1) —
`06 DATA SPEC.md` completo.

**Práctica:**
- Mueve la semilla: la serie cambia pero su "carácter" (tendencia, estacionalidad) no. ¿Por qué?
- Sube el ruido de 0.02 a 0.25 y ve al Comparador: todas las métricas se degradan.
- Importa el Excel del curso (Datos Modelo Trimestral) y vuelve al sintético.

**Auto-test:** ¿por qué la misma semilla produce el mismo dataset? ¿Qué ventaja
tiene conocer el proceso generador al evaluar un modelo? ¿Qué es un error AR(1)?

---

## Noche 2 — Modelo estructural estático (pestaña 01, parte superior)

**Teoría:** oferta, demanda, balance de mercado; rol de inventarios, dólar y
energía; el precio como suma de aportes interpretables (Vial).

**Práctica:**
- Mueve UN slider a la vez y observa qué barra de la descomposición cambia.
- Provoca un déficit (crecimiento alto + interrupción de oferta) y lee el balance.
- Explica el signo de cada barra: ¿por qué inventarios altos y dólar fuerte son barras pátina (negativas)?

**Auto-test:** explica en una frase económica cada término: demandPush,
supplyPull, inventoryCushion, usdEffect, costFloor.

---

## Noche 3 — Simulador dinámico (pestaña 01, parte inferior)

**Teoría:** el modelo estructural estándar (Vial 1988/2003; Labys 2006): las
cuatro ecuaciones acopladas; elasticidades; rezago de oferta; ciclo de telaraña
(cobweb); inventarios como amortiguador.

**Práctica (los 3 experimentos de la nota):**
1. L=8 y εD=0.1 → ciclo de telaraña persistente ("oscilando").
2. φ alto vs. φ bajo → quién absorbe el shock: el precio o los inventarios.
3. Sube gA → ciclo montado sobre una tendencia.

**Auto-test:** ¿por qué el rezago de oferta genera ciclos? ¿Por qué los precios
de commodities son tan volátiles cuando los inventarios están bajos?

---

## Noche 4 — ARIMA (pestaña 02)

**Teoría:** estacionariedad; diferenciación (el rol de d); autocorrelación;
procesos autorregresivos AR(p); estimación por mínimos cuadrados; por qué esta
app usa ARIMA(p, d, 0) sin término MA.

**Práctica:**
- Fija p=2 y compara d=0 vs. d=1: ¿por qué diferenciar mejora el ajuste de una serie con tendencia?
- Sube p de 1 a 6: ¿el RMSE siempre baja? ¿Eso significa que el modelo es "mejor"?
- Mira los coeficientes φ: ¿qué significa un φ1 negativo en la serie diferenciada?

**Auto-test:** ¿qué puede capturar un modelo que sólo mira su propio pasado, y
qué no puede capturar jamás?

---

## Noche 5 — ARIMAX (pestaña 03)

**Teoría:** regresores exógenos; causalidad vs. correlación; cómo se estiman
los β junto a los φ; evaluación del aporte de una covariable.

**Práctica:**
- Apaga ambas covariables: debe parecerse a ARIMA con los mismos p, d.
- Enciéndelas una a una y anota el cambio en RMSE y el valor de β.
- Repite con el Excel del curso: ahí las covariables son Dolarindex y Pindustrial.

**Auto-test:** ¿un β distinto de cero garantiza que la covariable "aporta"?
¿Cómo lo verificarías? (pista: comparar RMSE y pensar en sobreajuste).

---

## Noche 6 — GPR (pestaña 04)

**Teoría:** regresión no paramétrica; procesos gaussianos; kernel RBF; los tres
hiperparámetros (l, σf², σn²); media y varianza predictiva; la banda ±2σ; por
qué "un buen modelo sabe cuánto no sabe".

**Práctica:**
- Baja l al mínimo: la curva persigue el ruido y la banda se estrecha de forma engañosa — eso ES el sobreajuste.
- Sube σn²: el modelo asume más ruido de observación y suaviza.
- Con el Excel del curso: observa que los hiperparámetros funcionan igual (la app estandariza internamente).

**Auto-test:** ¿por qué la banda estrecha del modelo sobreajustado es "una
mentira"? ¿Qué controla cada hiperparámetro?

---

## Noche 7 — Híbrido (pestaña 05)

**Teoría:** combinación de modelos; descomposición lineal + no lineal;
modelado de residuos; cuándo la combinación NO ayuda.

**Práctica:**
- Busca una configuración donde la mejora sea ~0% y explica qué significa (ARIMAX ya capturaba la estructura).
- Busca la mayor mejora posible moviendo l.
- Compara la línea "ARIMAX base" con la del híbrido: ¿dónde difieren?

**Auto-test:** ¿por qué entrenar el GPR sobre los residuos y no sobre la serie
directamente? ¿Qué estructura queda en los residuos de un modelo lineal?

---

## Noche 8 — Comparador y simulacro de clase (pestaña 06)

**Teoría:** RMSE, MAE y MAPE (fórmulas e interpretación de cada una); ajuste
dentro de muestra vs. generalización; interpretabilidad y honestidad sobre la
incertidumbre como criterios adicionales.

**Práctica:**
- Deja tu mejor configuración en cada pestaña y ve al Comparador: los números coinciden con lo que viste en cada pantalla.
- Cambia semilla y ruido: ¿el "ganador" es estable? ¿Qué significa que cambie?
- **Simulacro:** recorre las 6 pestañas explicando cada una en 5 minutos, como si tuvieras estudiantes delante.

**Auto-test final:** ¿por qué menor RMSE no implica mejor modelo? Da tres
criterios distintos para elegir un modelo y un caso donde entren en conflicto.

---

## Noche 9 (v2, opcional) — Predicción out-of-sample (pestaña 07)

**Teoría:** ajuste dentro de muestra vs. predicción fuera de muestra;
degradación; validación walk-forward (por qué el k-fold barajado es inválido
en series de tiempo); importancia de variables por ablación; por qué árboles
y vecinos no extrapolan tendencias.

**Práctica:**
- Importa el Excel del curso, elige ARIMAX, y mueve el % de entrenamiento:
  ¿cómo cambia la degradación?
- Pon el GPR con escala de longitud mínima en la pestaña 04 y ven aquí: el
  RMSE de entrenamiento es diminuto y el de prueba explota — el sobreajuste,
  ahora medido y no solo intuido.
- En GPR, alterna "Un paso" y "Extrapolación": la extrapolación revierte a la
  media histórica y da métricas mucho peores. No es un error: es lo que
  significa predecir lejos sin información.
- "Validar los 7 modelos": ¿el ganador in-sample (pestaña 06) sigue ganando
  fuera de muestra? Observa también la σ entre folds (estabilidad).
- Con Bosque aleatorio o k-NN, activa "Diferenciar (predecir Δprecio)" y
  compara: los árboles no pueden predecir sobre el máximo que vieron; con el
  cambio diferenciado, ese techo desaparece (la misma idea que la d de ARIMA).
- "Medir importancia": ¿qué covariables aportan predicción real y cuáles solo
  ajuste cosmético?

**Auto-test:** ¿por qué barajar los datos antes de partir train/test sería
trampa? ¿Qué significa una degradación negativa? ¿Por qué el mejor RMSE
in-sample casi nunca coincide con el mejor out-of-sample?

---

## Consejos transversales

- **Un slider a la vez.** El valor pedagógico de la app está en aislar efectos.
- Las **notas al pie de cada pantalla** son el resumen teórico mínimo; los
  documentos `01`–`06` del repo son la referencia completa.
- Si algo se ve raro con datos importados, restaura el sintético: es tu caso
  de control con verdad conocida.
- La pregunta que ata todo el curso: *¿qué supuesto económico hay detrás de
  cada número que estoy viendo?*
