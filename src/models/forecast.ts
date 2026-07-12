// Pronóstico out-of-sample (07 VALIDACION SPEC).
//
// Estas funciones separan AJUSTE de PREDICCIÓN: los coeficientes se estiman
// sólo con el tramo de entrenamiento [0, trainEnd) y luego se aplican
// congelados a toda la serie. La predicción en la zona de prueba es a un paso
// (one-step-ahead): usa los valores OBSERVADOS anteriores como rezagos —
// misma definición de ajuste que las pestañas 02–05, para que train vs test
// sea una comparación limpia de "mismos mecanismos, datos no vistos".
//
// No se modifican fitArima/fitArimax/fitGpr/fitHybrid (usados por las
// pestañas 02–05): con trainEnd = n estas funciones reproducen exactamente
// sus resultados (verificado por script), pero mantenerlas separadas elimina
// todo riesgo de regresión sobre lo ya validado.

import { ols, cholesky, forwardSolve, backwardSolve } from './matrix';
import { difference } from './arima';
import { GprParams, kernel } from './gpr';

export interface ForecastResult {
  /** Predicción por índice original; null donde el modelo no puede predecir. */
  fitted: (number | null)[];
  bandLo?: (number | null)[];
  bandHi?: (number | null)[];
}

const nulls = (n: number): (number | null)[] => Array(n).fill(null);

/**
 * ARIMA(p,d,0) / ARIMAX out-of-sample. Con exog = [] es ARIMA puro.
 * Los β se estiman sólo con filas cuyo objetivo cae antes de trainEnd.
 */
export function arimaxForecast(
  y: number[],
  exog: number[][],
  p: number,
  d: number,
  trainEnd: number
): ForecastResult {
  const n = y.length;
  const numExog = exog.length > 0 ? exog[0].length : 0;
  if (trainEnd <= p + d + numExog + 2 || n <= p + d) return { fitted: nulls(n) };

  const diffed = difference(y, d);

  // Misma matriz de diseño que fitArimax (intercepto + rezagos + exógenas
  // contemporáneas), guardando el índice original del objetivo de cada fila.
  const rows: number[][] = [];
  const targets: number[] = [];
  const origIdx: number[] = [];
  for (let t = p; t < diffed.length; t++) {
    const row = [1];
    for (let i = 1; i <= p; i++) row.push(diffed[t - i]);
    for (let k = 0; k < numExog; k++) row.push(exog[t + d][k]);
    rows.push(row);
    targets.push(diffed[t]);
    origIdx.push(t + d);
  }

  const trainRows: number[][] = [];
  const trainTargets: number[] = [];
  rows.forEach((row, i) => {
    if (origIdx[i] < trainEnd) {
      trainRows.push(row);
      trainTargets.push(targets[i]);
    }
  });
  if (trainRows.length < p + numExog + 2) return { fitted: nulls(n) };

  const beta = ols(trainRows, trainTargets);

  // Predicción con coeficientes congelados + reintegración un-paso con
  // historia real (idéntica a la de fitArimax).
  const fitted = nulls(n);
  rows.forEach((row, i) => {
    let predDiff = 0;
    for (let c = 0; c < row.length; c++) predDiff += beta[c] * row[c];
    const j = origIdx[i];
    if (d === 0) fitted[j] = predDiff;
    else if (d === 1) fitted[j] = y[j - 1] + predDiff;
    else fitted[j] = 2 * y[j - 1] - y[j - 2] + predDiff;
  });

  return { fitted };
}

/**
 * Núcleo GPR genérico: entrena con (xTrain, yTrain) y predice en xQuery.
 * Estandariza y SOLO con el tramo de entrenamiento (sin fuga de información).
 * Con xQuery = xTrain reproduce fitGpr exactamente.
 * R20: usa kernel() de gpr.ts (RBF puro por defecto, RBF+periódico si
 * params.kernelMode lo pide) — la copia local de rbf se eliminó para que
 * las pestañas 04 y 07 no puedan divergir en la definición del kernel.
 */
export function gprPredict(
  xTrain: number[],
  yTrain: number[],
  xQuery: number[],
  params: GprParams
): { mean: number[]; variance: number[] } {
  const m = xTrain.length;
  if (m === 0) return { mean: [], variance: [] };
  const { noiseVariance } = params;

  const yMean = yTrain.reduce((s, v) => s + v, 0) / m;
  const yStd = Math.max(Math.sqrt(yTrain.reduce((s, v) => s + (v - yMean) ** 2, 0) / m), 1e-9);
  const yc = yTrain.map(v => (v - yMean) / yStd);

  const K: number[][] = Array(m).fill(0).map(() => Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      K[i][j] = kernel(xTrain[i], xTrain[j], params);
      if (i === j) K[i][j] += noiseVariance;
    }
  }
  const L = cholesky(K);
  const alpha = backwardSolve(L, forwardSolve(L, yc));

  const mean: number[] = [];
  const variance: number[] = [];
  for (const xq of xQuery) {
    const kStar = xTrain.map(xt => kernel(xq, xt, params));
    let mu = 0;
    for (let j = 0; j < m; j++) mu += kStar[j] * alpha[j];
    mean.push(mu * yStd + yMean);
    const v = forwardSolve(L, kStar);
    let vTv = 0;
    for (let j = 0; j < m; j++) vTv += v[j] * v[j];
    variance.push((kernel(xq, xq, params) + noiseVariance - vTv) * yStd * yStd);
  }
  return { mean, variance };
}

/**
 * GPR sobre el índice temporal, out-of-sample. En la zona de prueba el GPR
 * EXTRAPOLA (no hay mecanismo de un-paso sin reentrenar): la media revierte
 * hacia la media del entrenamiento y la banda se ensancha — el modelo
 * declarando honestamente "aquí ya no sé". Es deliberado y pedagógico.
 */
export function gprForecast(
  y: number[],
  params: GprParams,
  trainEnd: number,
  bandSigma: 1 | 2 = 2
): ForecastResult {
  const n = y.length;
  if (trainEnd < 3) return { fitted: nulls(n) };
  const denom = Math.max(trainEnd - 1, 1);
  const xAll = Array(n).fill(0).map((_, i) => i / denom);
  const { mean, variance } = gprPredict(xAll.slice(0, trainEnd), y.slice(0, trainEnd), xAll, params);
  const fitted = mean.map(v => v as number | null);
  const bandLo = mean.map((v, i) => Math.max(0, v - bandSigma * Math.sqrt(Math.max(0, variance[i]))));
  const bandHi = mean.map((v, i) => v + bandSigma * Math.sqrt(Math.max(0, variance[i])));
  return { fitted, bandLo, bandHi };
}

/**
 * GPR out-of-sample en modo UN PASO: para cada punto de prueba re-entrena
 * con todos los datos anteriores (ventana expansiva) y predice sólo el punto
 * siguiente — la actualización natural del posterior gaussiano. Es el modo
 * comparable con ARIMA/ARIMAX/ML (que también usan la historia real), a
 * diferencia de gprForecast, que extrapola multi-paso y revierte a la media.
 */
export function gprOneStepForecast(
  y: number[],
  params: GprParams,
  trainEnd: number,
  bandSigma: 1 | 2 = 2
): ForecastResult {
  const n = y.length;
  if (trainEnd < 3) return { fitted: nulls(n) };
  const denom = Math.max(trainEnd - 1, 1);
  const xOf = (i: number) => i / denom;

  const fitted = nulls(n);
  const bandLo = nulls(n);
  const bandHi = nulls(n);

  // Tramo de entrenamiento: un solo ajuste con [0, trainEnd), como siempre.
  const xTr = Array(trainEnd).fill(0).map((_, i) => xOf(i));
  const base = gprPredict(xTr, y.slice(0, trainEnd), xTr, params);
  for (let i = 0; i < trainEnd; i++) {
    const sd = Math.sqrt(Math.max(0, base.variance[i]));
    fitted[i] = base.mean[i];
    bandLo[i] = Math.max(0, base.mean[i] - bandSigma * sd);
    bandHi[i] = base.mean[i] + bandSigma * sd;
  }

  // Tramo de prueba: re-entrenar con [0, i) y predecir el punto i.
  for (let i = trainEnd; i < n; i++) {
    const xw = Array(i).fill(0).map((_, j) => xOf(j));
    const g = gprPredict(xw, y.slice(0, i), [xOf(i)], params);
    const sd = Math.sqrt(Math.max(0, g.variance[0]));
    fitted[i] = g.mean[0];
    bandLo[i] = Math.max(0, g.mean[0] - bandSigma * sd);
    bandHi[i] = g.mean[0] + bandSigma * sd;
  }

  return { fitted, bandLo, bandHi };
}

/**
 * Híbrido out-of-sample: ARIMAX (un-paso con historia real) + GPR entrenado
 * sobre los residuos del tramo de entrenamiento, extrapolado a la prueba.
 * Misma construcción que la pestaña 05 (residuos con ceros en los primeros
 * p+d puntos, x normalizado por el largo del entrenamiento).
 */
export function hybridForecast(
  y: number[],
  exog: number[][],
  p: number,
  d: number,
  gprParams: GprParams,
  trainEnd: number,
  bandSigma: 1 | 2 = 2
): ForecastResult {
  const n = y.length;
  const base = arimaxForecast(y, exog, p, d, trainEnd);
  if (base.fitted.every(v => v === null)) return { fitted: nulls(n) };

  const residuals = y.map((v, i) => {
    const f = base.fitted[i];
    return f === null ? 0 : v - f;
  });
  const denom = Math.max(trainEnd - 1, 1);
  const xAll = Array(n).fill(0).map((_, i) => i / denom);
  const g = gprPredict(xAll.slice(0, trainEnd), residuals.slice(0, trainEnd), xAll, gprParams);

  const fitted = nulls(n);
  const bandLo = nulls(n);
  const bandHi = nulls(n);
  for (let i = 0; i < n; i++) {
    const b = base.fitted[i];
    if (b === null) continue;
    const mu = b + g.mean[i];
    const sd = Math.sqrt(Math.max(0, g.variance[i]));
    fitted[i] = mu;
    bandLo[i] = Math.max(0, mu - bandSigma * sd);
    bandHi[i] = mu + bandSigma * sd;
  }
  return { fitted, bandLo, bandHi };
}
