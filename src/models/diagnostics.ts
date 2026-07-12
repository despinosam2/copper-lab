// R11/R12 (09 EXECUTION BLUEPRINT) — Diagnóstico de residuos: autocorrelación,
// estadístico de Ljung-Box, y errores estándar de los coeficientes OLS.
//
// Sin cajas negras (mismo principio que matrix.ts): el p-valor de Ljung-Box
// requiere la función gamma incompleta regularizada, que se implementa aquí
// de forma transparente (algoritmo estándar de Numerical Recipes — serie
// para x < a+1, fracción continua para x >= a+1), no una librería de
// estadística externa.

import { invert } from './matrix';

// ---------------------------------------------------------- Autocorrelación ----

/**
 * Autocorrelación muestral en los rezagos 1..maxLag. r_k = c_k / c_0, con
 * c_k = Σ (e_t - ē)(e_{t+k} - ē).
 */
export function autocorrelation(residuals: number[], maxLag: number): number[] {
  const n = residuals.length;
  const mean = residuals.reduce((s, v) => s + v, 0) / n;
  const centered = residuals.map(v => v - mean);
  const c0 = centered.reduce((s, v) => s + v * v, 0);

  const acf: number[] = [];
  for (let k = 1; k <= maxLag; k++) {
    let ck = 0;
    for (let t = 0; t < n - k; t++) ck += centered[t] * centered[t + k];
    acf.push(c0 > 0 ? ck / c0 : 0);
  }
  return acf;
}

// ------------------------------------------------------------- Ljung-Box ----

// Log-gamma (aproximación de Lanczos, g=7 — precisión estándar de doble
// punto flotante, el mismo algoritmo usado en la mayoría de las
// implementaciones numéricas de referencia).
function logGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const xm1 = x - 1;
  let a = c[0];
  const t = xm1 + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (xm1 + i);
  return 0.5 * Math.log(2 * Math.PI) + (xm1 + 0.5) * Math.log(t) - t + Math.log(a);
}

/** P(a,x): gamma incompleta inferior regularizada, por serie (válida para x < a+1). */
function regularizedLowerGammaSeries(a: number, x: number): number {
  if (x <= 0) return 0;
  let sum = 1 / a;
  let term = sum;
  for (let n = 1; n < 200; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/** Q(a,x): gamma incompleta superior regularizada, por fracción continua (válida para x >= a+1). */
function regularizedUpperGammaCF(a: number, x: number): number {
  const FPMIN = 1e-300;
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** p-valor de la cola superior de una chi-cuadrado con k grados de libertad: P(X > x). */
export function chiSquareUpperPValue(x: number, k: number): number {
  if (x <= 0) return 1;
  const a = k / 2;
  const xx = x / 2;
  return xx < a + 1
    ? 1 - regularizedLowerGammaSeries(a, xx)
    : regularizedUpperGammaCF(a, xx);
}

export interface LjungBoxResult {
  statistic: number;
  pValue: number;
  df: number;
}

/**
 * Estadístico de Ljung-Box sobre los rezagos 1..maxLag:
 * Q = n(n+2) Σ r_k²/(n-k). Bajo H0 (residuos sin autocorrelación),
 * Q ~ χ²(maxLag) aproximadamente. p-valor bajo ⇒ rechazar H0 ⇒ queda
 * estructura en los residuos (el modelo está subespecificado).
 */
export function ljungBox(residuals: number[], maxLag: number): LjungBoxResult {
  const n = residuals.length;
  const acf = autocorrelation(residuals, maxLag);
  let q = 0;
  for (let k = 1; k <= maxLag; k++) {
    q += (acf[k - 1] * acf[k - 1]) / (n - k);
  }
  q *= n * (n + 2);
  return { statistic: q, pValue: chiSquareUpperPValue(q, maxLag), df: maxLag };
}

// ------------------------------------------------------ Errores estándar ----

/**
 * R12: errores estándar OLS clásicos (homocedásticos) de los coeficientes β.
 * SE(β_j) = sqrt(σ² · [(XᵀX)⁻¹]_jj), con σ² = RSS/(n-k).
 *
 * Limitación documentada (decisión explícita, no un descuido): dado que el
 * modelo incorpora una estructura AR(1), los errores estándar OLS pueden no
 * ser consistentes en presencia de autocorrelación serial. En este proyecto
 * se mantienen los errores estándar clásicos para preservar la simplicidad y
 * consistencia de la implementación. En consecuencia, los coeficientes
 * estimados se utilizan principalmente con fines predictivos e
 * interpretativos, mientras que las pruebas de significancia estadística
 * deben interpretarse con cautela. En trabajos futuros podría emplearse un
 * estimador robusto HAC (Newey–West) para mejorar la inferencia.
 */
export function standardErrors(X: number[][], residuals: number[], k: number): number[] {
  const n = residuals.length;
  const rss = residuals.reduce((s, e) => s + e * e, 0);
  const sigma2 = rss / Math.max(n - k, 1);

  const XtX: number[][] = Array(k).fill(0).map(() => Array(k).fill(0));
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += X[i][a] * X[i][b];
      XtX[a][b] = s;
    }
  }
  const inv = invert(XtX);
  return Array(k).fill(0).map((_, j) => Math.sqrt(Math.max(sigma2 * inv[j][j], 0)));
}

/** Estadístico t = β / SE(β) — para juzgar significancia (t grande ⇒ el coeficiente probablemente no es cero). */
export function tStatistics(coefficients: number[], se: number[]): number[] {
  return coefficients.map((b, j) => (se[j] > 0 ? b / se[j] : 0));
}
