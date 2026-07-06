# 04 — COURSE SPEC · Mapeo curso ↔ software

Este documento conecta las diapositivas del curso con las pantallas de COPPER LAB
y define **qué aprende el estudiante en cada una**.

---

## Bloque 0 · Datos (barra superior)

- **Diapositivas:** naturaleza de las series de commodities; datos sintéticos vs.
  reales; reproducibilidad.
- **Pantalla:** barra de dataset (semilla, ruido, importar CSV/Excel).
- **Qué aprende:** que todo modelo depende de los datos; que un proceso generador
  conocido permite verificar si el modelo "recupera" lo que sabemos que hay; y
  cómo el ruido afecta la dificultad del problema.
- **Experimento sugerido:** sube el ruido y observa cómo se degradan todas las
  métricas en el comparador.

---

## Bloque 1 · Modelo estructural

- **Diapositivas:** fundamentos económicos del precio del cobre; oferta, demanda,
  inventarios, rol del dólar, costos de energía; modelo de Vial.
- **Pantalla:** *Estructural* (pestaña 01).
- **Qué aprende:** que el precio es el resultado de un balance económico; a aislar
  el efecto de cada variable; a leer un déficit/superávit de mercado.
- **Experimento sugerido:** provoca un déficit subiendo el crecimiento y la
  interrupción de oferta; observa qué barras de la descomposición dominan.

---

## Bloque 2 · Series de tiempo — ARIMA

- **Diapositivas:** estacionariedad, diferenciación, autocorrelación, procesos AR.
- **Pantalla:** *ARIMA* (pestaña 02).
- **Qué aprende:** que se puede modelar una serie con su solo pasado; el rol de
  `d` (quitar tendencia) y `p` (memoria); los límites de un modelo sin economía.
- **Experimento sugerido:** fija `p=2` y compara `d=0` vs `d=1`; discute por qué
  diferenciar mejora el ajuste.

---

## Bloque 3 · Covariables — ARIMAX

- **Diapositivas:** modelos con variables exógenas; causalidad vs. correlación.
- **Pantalla:** *ARIMAX* (pestaña 03).
- **Qué aprende:** cómo incorporar información económica a un modelo temporal;
  a evaluar si una covariable realmente aporta comparando RMSE.
- **Experimento sugerido:** apaga todas las covariables (debe parecerse a ARIMA);
  enciéndelas una a una y observa el cambio en el error.

---

## Bloque 4 · Métodos bayesianos — GPR

- **Diapositivas:** procesos gaussianos, kernels, incertidumbre predictiva.
- **Pantalla:** *GPR* (pestaña 04).
- **Qué aprende:** que un modelo puede cuantificar su propia incertidumbre; el
  efecto de los hiperparámetros del kernel; el riesgo de sobreajuste.
- **Experimento sugerido:** baja la escala de longitud al mínimo y observa cómo
  la curva persigue el ruido mientras la banda se estrecha de forma engañosa.

---

## Bloque 5 · Modelos híbridos

- **Diapositivas:** combinación de modelos; descomposición lineal + no lineal;
  modelado de residuos.
- **Pantalla:** *Híbrido* (pestaña 05).
- **Qué aprende:** por qué combinar un modelo interpretable con uno flexible; a
  leer la "mejora" sobre ARIMAX; cuándo la combinación **no** ayuda.
- **Experimento sugerido:** busca una configuración donde la mejora sea ~0% y
  discute qué significa (ARIMAX ya capturaba la estructura).

---

## Bloque 6 · Evaluación y selección de modelos

- **Diapositivas:** métricas de error; sobreajuste; el modelo "mejor" según qué
  criterio.
- **Pantalla:** *Comparador* (pestaña 06).
- **Qué aprende:** a comparar modelos con criterios cuantitativos y a cuestionar
  el criterio: menor RMSE no siempre es "mejor"; la interpretabilidad y la
  honestidad sobre la incertidumbre también cuentan.
- **Experimento sugerido:** cambia el dataset (semilla/ruido) y observa si el
  modelo "ganador" cambia. Discute la estabilidad de la selección.
