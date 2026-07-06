import { cholesky, forwardSolve, backwardSolve, transpose, multiply } from './matrix';

export interface GprParams {
  lengthScale: number; // l
  signalVariance: number; // sigma_f^2
  noiseVariance: number; // sigma_n^2
}

export interface GprResult {
  mean: number[];
  variance: number[];
}

// RBF Kernel
function rbf(x1: number, x2: number, l: number, sigmaF2: number): number {
  const diff = x1 - x2;
  return sigmaF2 * Math.exp(-(diff * diff) / (2 * l * l));
}

export function fitGpr(x: number[], y: number[], params: GprParams): GprResult {
  const n = x.length;
  if (n === 0) return { mean: [], variance: [] };

  const { lengthScale, signalVariance, noiseVariance } = params;

  // Estandarizamos y (media 0, desviación 1) antes de ajustar:
  //  - sin centrar, el prior 0 del GP encogería la predicción hacia 0;
  //  - sin escalar, los hiperparámetros σf² y σn² sólo tendrían sentido para
  //    una escala de precios concreta. Estandarizando, funcionan igual con la
  //    serie sintética (~4 USD/lb) que con datos reales (~300 ¢/lb).
  // Al final la media y la varianza se devuelven en las unidades originales.
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  const yStd = Math.max(Math.sqrt(y.reduce((s, v) => s + (v - yMean) ** 2, 0) / n), 1e-9);
  const yc = y.map(v => (v - yMean) / yStd);

  // Build Covariance Matrix K
  const K: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      K[i][j] = rbf(x[i], x[j], lengthScale, signalVariance);
      if (i === j) {
        K[i][j] += noiseVariance; // K + sigma_n^2 * I
      }
    }
  }

  // Cholesky decomposition K = L L^T
  const L = cholesky(K);

  // We want to calculate K^-1 * yc
  // K * alpha = yc => L * L^T * alpha = yc
  // 1. Solve L * b = yc
  const b = forwardSolve(L, yc);
  // 2. Solve L^T * alpha = b
  const alpha = backwardSolve(L, b);

  // Compute mean and variance for each training point (as predictions)
  const mean = Array(n).fill(0);
  const variance = Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    // k* is the covariance between x[i] and all training points
    const kStar = Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      kStar[j] = rbf(x[i], x[j], lengthScale, signalVariance);
    }

    // mean = k*^T * alpha, des-estandarizado a las unidades originales
    let m = 0;
    for (let j = 0; j < n; j++) {
      m += kStar[j] * alpha[j];
    }
    mean[i] = m * yStd + yMean;

    // variance = k(x*, x*) - k*^T * K^-1 * k*
    // Let v = L^-1 * k* => L * v = k*
    const v = forwardSolve(L, kStar);
    let vT_v = 0;
    for (let j = 0; j < n; j++) {
      vT_v += v[j] * v[j];
    }
    const stdVariance = rbf(x[i], x[i], lengthScale, signalVariance) + noiseVariance - vT_v;
    // De vuelta a unidades originales (la varianza escala con yStd²)
    variance[i] = stdVariance * yStd * yStd;
  }

  return { mean, variance };
}
