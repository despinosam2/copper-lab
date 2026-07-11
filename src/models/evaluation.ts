// Evaluación out-of-sample (07 VALIDACION SPEC): métricas por tramo,
// validación cruzada walk-forward e importancia de variables por ablación.

import { calculateMetrics } from './metrics';

export type Metrics = ReturnType<typeof calculateMetrics>;

export interface SplitEvaluation {
  train: Metrics | null;
  test: Metrics | null;
  /** (RMSE_test − RMSE_train) / RMSE_train, en % — la lección de la pestaña. */
  degradationPct: number | null;
}

/** Métricas de un ajuste separadas por tramo entrenamiento / prueba. */
export function evaluateSplit(y: number[], fitted: (number | null)[], trainEnd: number): SplitEvaluation {
  const trA: number[] = [], trP: number[] = [];
  const teA: number[] = [], teP: number[] = [];
  for (let i = 0; i < y.length; i++) {
    const f = fitted[i];
    if (f === null || !isFinite(f)) continue;
    if (i < trainEnd) { trA.push(y[i]); trP.push(f); }
    else { teA.push(y[i]); teP.push(f); }
  }
  const train = trA.length > 0 ? calculateMetrics(trA, trP) : null;
  const test = teA.length > 0 ? calculateMetrics(teA, teP) : null;
  const degradationPct = train && test && train.rmse > 0
    ? ((test.rmse - train.rmse) / train.rmse) * 100
    : null;
  return { train, test, degradationPct };
}

export interface Fold {
  trainEnd: number;
  testEnd: number;
}

/**
 * Folds walk-forward con origen rodante y ventana expansiva: el último 40%
 * de la serie se divide en k bloques de prueba; cada fold entrena con todo lo
 * anterior a su bloque. Nunca se entrena con datos posteriores a la prueba
 * (el k-fold barajado clásico es inválido en series de tiempo).
 */
export function walkForwardFolds(n: number, k: number): Fold[] {
  const start = Math.floor(n * 0.6);
  if (start < 10) return []; // dataset demasiado corto para validar
  const folds: Fold[] = [];
  for (let j = 0; j < k; j++) {
    const trainEnd = Math.round(start + ((n - start) * j) / k);
    const testEnd = Math.round(start + ((n - start) * (j + 1)) / k);
    if (testEnd > trainEnd) folds.push({ trainEnd, testEnd });
  }
  return folds;
}

export interface WalkForwardResult {
  perFold: (number | null)[];
  mean: number | null;
  std: number | null;
}

/** RMSE de prueba por fold + media ± desviación estándar. */
export function walkForwardRmse(
  y: number[],
  folds: Fold[],
  run: (trainEnd: number) => (number | null)[]
): WalkForwardResult {
  const perFold: (number | null)[] = folds.map(({ trainEnd, testEnd }) => {
    const fitted = run(trainEnd);
    const a: number[] = [], p: number[] = [];
    for (let i = trainEnd; i < testEnd; i++) {
      const f = fitted[i];
      if (f !== null && isFinite(f)) { a.push(y[i]); p.push(f); }
    }
    return a.length > 0 ? calculateMetrics(a, p).rmse : null;
  });
  const valid = perFold.filter((v): v is number => v !== null);
  if (valid.length === 0) return { perFold, mean: null, std: null };
  const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
  const std = Math.sqrt(valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length);
  return { perFold, mean, std };
}

/** RMSE sólo del tramo de prueba de un ajuste ya calculado. */
export function testRmse(y: number[], fitted: (number | null)[], trainEnd: number): number | null {
  const ev = evaluateSplit(y, fitted, trainEnd);
  return ev.test ? ev.test.rmse : null;
}
