import { ols } from './matrix';
import { difference } from './arima';

export interface ArimaxResult {
  fitted: number[];
  coefficients: number[];
  exogCoefficients: number[];
  intercept: number;
  residuals: number[];
  /** R12: matriz de diseño usada en la estimación OLS (espacio diferenciado), para calcular errores estándar sin reconstruirla en la vista. */
  designMatrix: number[][];
  /** R12: residuos en el MISMO espacio que designMatrix (diferenciado) — distintos de `residuals`, que está reintegrado al nivel del precio. */
  diffResiduals: number[];
}

/**
 * R22: con `diffExog = true` y d ≥ 1, las exógenas se diferencian d veces
 * junto con la serie. Sin esto (default histórico), se regresa Δᵈy sobre
 * X en NIVELES contemporáneos — si X es no estacionaria (dólar, libor),
 * eso reintroduce el riesgo de relación espuria que la diferenciación de y
 * sacó por la puerta, y hace extraña la lectura económica del β ("un nivel
 * alto del dólar produce caídas perpetuas del precio"). Con d = 0 el toggle
 * no aplica (no hay nada que igualar). Default false: comportamiento
 * bit-a-bit idéntico al histórico (los números dorados del manual — ARIMAX
 * 26.1 con el Excel del curso — no cambian sin acción explícita del usuario).
 */
export function fitArimax(y: number[], exog: number[][], p: number, d: number, diffExog = false): ArimaxResult {
  const n = y.length;
  if (n <= p + d) {
    return { fitted: Array(n).fill(0), coefficients: [], exogCoefficients: [], intercept: 0, residuals: [], designMatrix: [], diffResiduals: [] };
  }

  // 1. Difference the series
  const diffed = difference(y, d);

  // 2. Build design matrix and target vector
  const X: number[][] = [];
  const target: number[] = [];
  const numExog = exog.length > 0 ? exog[0].length : 0;

  // R22: valor de la exógena k para la fila con objetivo diffed[t]
  // (índice original t+d). Diferenciadas: diffedExogCols[k][t] está alineada
  // con diffed[t] por construcción (ambas pierden las primeras d posiciones).
  const useDiffExog = diffExog && d > 0 && numExog > 0;
  const diffedExogCols: number[][] = useDiffExog
    ? Array(numExog).fill(0).map((_, k) => difference(exog.map(r => r[k]), d))
    : [];
  const exogAt = (t: number, k: number): number =>
    useDiffExog ? diffedExogCols[k][t] : exog[t + d][k];

  for (let t = p; t < diffed.length; t++) {
    const row = [1]; // intercept
    for (let i = 1; i <= p; i++) {
      row.push(diffed[t - i]);
    }
    // Add exogenous variables for time t+d in original series, which corresponds to t in differenced
    for (let k = 0; k < numExog; k++) {
      row.push(exogAt(t, k));
    }
    X.push(row);
    target.push(diffed[t]);
  }

  // 3. Estimate parameters via OLS
  const beta = ols(X, target);
  const intercept = beta[0];
  const coefficients = beta.slice(1, p + 1);
  const exogCoefficients = beta.slice(p + 1);

  // 4. Calculate fitted values in differenced space
  const diffFitted = Array(diffed.length).fill(0);
  for (let t = p; t < diffed.length; t++) {
    let pred = intercept;
    for (let i = 1; i <= p; i++) {
      pred += coefficients[i - 1] * diffed[t - i];
    }
    for (let k = 0; k < numExog; k++) {
      pred += exogCoefficients[k] * exogAt(t, k);
    }
    diffFitted[t] = pred;
  }

  // 5. Reintegrate to original space
  const fitted = [...y];
  for (let t = p + d; t < n; t++) {
    if (d === 0) {
      fitted[t] = diffFitted[t];
    } else if (d === 1) {
      fitted[t] = y[t - 1] + diffFitted[t - 1];
    } else if (d === 2) {
      const diff1_prev = y[t - 1] - y[t - 2];
      const diff1_hat = diff1_prev + diffFitted[t - 2];
      fitted[t] = y[t - 1] + diff1_hat;
    }
  }

  const residuals = y.map((val, i) => val - fitted[i]);
  // R12: residuos en el espacio de X/target (diferenciado), para errores
  // estándar — diffFitted[t] ya es X[fila]·beta para cada fila de X.
  const diffResiduals = target.map((tgt, i) => tgt - diffFitted[i + p]);

  return {
    fitted,
    coefficients,
    exogCoefficients,
    intercept,
    residuals,
    designMatrix: X,
    diffResiduals
  };
}
