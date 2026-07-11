// Modelos de ML "avanzados" para predicción del precio (v2, 07 VALIDACION SPEC).
//
// Tres paradigmas distintos, todos implementados aquí mismo — legibles y sin
// cajas negras, como el resto de la app:
//   · Ridge   — regresión lineal REGULARIZADA (forma cerrada, sin iterar)
//   · k-NN    — basado en instancias: "el precio se parece al de los k
//               momentos históricos más similares"
//   · Bosque aleatorio — ensemble de árboles de regresión (bagging +
//               submuestreo de variables), con semilla fija ⇒ determinista
//
// Todos usan la misma matriz de características: rezagos del precio (un paso
// adelante con historia real) + las 5 covariables contemporáneas del dataset
// del curso. La estandarización se calcula SOLO con el tramo de entrenamiento.

import { CopperRow } from '../data/generator';
import { invert } from './matrix';

export const ML_FEATURE_DEFS: { key: keyof Pick<CopperRow, 'globalGrowth' | 'usdIndex' | 'stocks' | 'libor' | 'partLargas'>; label: string }[] = [
  { key: 'globalGrowth', label: 'crecimiento' },
  { key: 'usdIndex', label: 'dólar' },
  { key: 'stocks', label: 'inventarios' },
  { key: 'libor', label: 'libor' },
  { key: 'partLargas', label: 'posición especulativa' }
];

export interface MlDataset {
  X: number[][];
  y: number[];
  /** Índice en la serie original de cada fila. */
  origIdx: number[];
  featureNames: string[];
}

/**
 * Construye la matriz de características: [precio t−1 … t−lags, exógenas en t].
 * `excludeFeature` permite la ablación (importancia de variables) quitando
 * una covariable por nombre.
 *
 * Con `diff = true` el objetivo y los rezagos son Δprecio en vez del nivel:
 * árboles y vecinos no pueden EXTRAPOLAR (nunca predicen por encima del
 * máximo visto en entrenamiento), así que con una serie con tendencia
 * colapsan; prediciendo el cambio y reintegrando (ver `reintegrateDeltas`)
 * ese problema desaparece — la misma idea que la "d" de ARIMA.
 */
export function buildMlDataset(data: CopperRow[], lags: number, excludeFeature?: string, diff = false): MlDataset {
  const defs = ML_FEATURE_DEFS.filter(f => f.label !== excludeFeature);
  const prefix = diff ? 'Δprecio' : 'precio';
  const featureNames = [
    ...Array(lags).fill(0).map((_, i) => `${prefix} t−${i + 1}`),
    ...defs.map(f => f.label)
  ];
  // dy[i] = y_i − y_{i−1}; dy[0] no existe
  const dy = data.map((r, i) => (i === 0 ? 0 : r.price - data[i - 1].price));
  const start = diff ? lags + 1 : lags;

  const X: number[][] = [];
  const y: number[] = [];
  const origIdx: number[] = [];
  for (let t = start; t < data.length; t++) {
    const row: number[] = [];
    for (let i = 1; i <= lags; i++) row.push(diff ? dy[t - i] : data[t - i].price);
    for (const f of defs) row.push(data[t][f.key]);
    X.push(row);
    y.push(diff ? dy[t] : data[t].price);
    origIdx.push(t);
  }
  return { X, y, origIdx, featureNames };
}

/**
 * Reintegra predicciones de Δprecio al nivel de precio, un paso adelante con
 * historia real: ŷ_t = y_{t−1} + Δŷ_t (igual que la reintegración de ARIMA).
 */
export function reintegrateDeltas(fittedDeltas: (number | null)[], prices: number[]): (number | null)[] {
  return fittedDeltas.map((delta, j) =>
    delta === null || j === 0 ? null : prices[j - 1] + delta
  );
}

interface Standardizer {
  mean: number[];
  std: number[];
}

function fitStandardizer(rows: number[][]): Standardizer {
  const k = rows[0].length;
  const mean = Array(k).fill(0);
  const std = Array(k).fill(0);
  for (const r of rows) for (let c = 0; c < k; c++) mean[c] += r[c];
  for (let c = 0; c < k; c++) mean[c] /= rows.length;
  for (const r of rows) for (let c = 0; c < k; c++) std[c] += (r[c] - mean[c]) ** 2;
  for (let c = 0; c < k; c++) std[c] = Math.max(Math.sqrt(std[c] / rows.length), 1e-9);
  return { mean, std };
}

const applyStd = (row: number[], s: Standardizer) => row.map((v, c) => (v - s.mean[c]) / s.std[c]);

function splitTrain(ds: MlDataset, trainEnd: number) {
  const trIdx: number[] = [];
  ds.origIdx.forEach((j, i) => { if (j < trainEnd) trIdx.push(i); });
  return trIdx;
}

/** Vuelca predicciones por fila a un arreglo por índice original. */
function toFitted(ds: MlDataset, n: number, preds: number[]): (number | null)[] {
  const fitted: (number | null)[] = Array(n).fill(null);
  ds.origIdx.forEach((j, i) => { fitted[j] = preds[i]; });
  return fitted;
}

// ---------------------------------------------------------------- Ridge ----

/**
 * Regresión ridge: β = (XᵀX + λI)⁻¹Xᵀy sobre características estandarizadas
 * y precio centrado. λ encoge los coeficientes hacia 0 — el precio a pagar
 * por menos varianza (el mismo trade-off sesgo/varianza del GPR con σn²).
 */
export function ridgeForecast(ds: MlDataset, n: number, trainEnd: number, lambda: number): (number | null)[] {
  const trIdx = splitTrain(ds, trainEnd);
  const k = ds.featureNames.length;
  if (trIdx.length < k + 2) return Array(n).fill(null);

  const std = fitStandardizer(trIdx.map(i => ds.X[i]));
  const yTr = trIdx.map(i => ds.y[i]);
  const yMean = yTr.reduce((s, v) => s + v, 0) / yTr.length;

  const XtX: number[][] = Array(k).fill(0).map(() => Array(k).fill(0));
  const Xty: number[] = Array(k).fill(0);
  for (const i of trIdx) {
    const r = applyStd(ds.X[i], std);
    const yc = ds.y[i] - yMean;
    for (let a = 0; a < k; a++) {
      Xty[a] += r[a] * yc;
      for (let b = 0; b < k; b++) XtX[a][b] += r[a] * r[b];
    }
  }
  for (let a = 0; a < k; a++) XtX[a][a] += lambda * trIdx.length;
  const inv = invert(XtX);
  const beta = Array(k).fill(0).map((_, a) => inv[a].reduce((s, v, b) => s + v * Xty[b], 0));

  const preds = ds.X.map(row => {
    const r = applyStd(row, std);
    return yMean + r.reduce((s, v, c) => s + v * beta[c], 0);
  });
  return toFitted(ds, n, preds);
}

// ----------------------------------------------------------------- k-NN ----

/**
 * k vecinos más cercanos: la predicción es el promedio del precio en los k
 * momentos históricos más parecidos (distancia euclídea en características
 * estandarizadas). Dentro del entrenamiento cada punto es su propio vecino:
 * con k=1 el ajuste de entrenamiento es perfecto — sobreajuste de manual.
 */
export function knnForecast(ds: MlDataset, n: number, trainEnd: number, k: number): (number | null)[] {
  const trIdx = splitTrain(ds, trainEnd);
  if (trIdx.length < k) return Array(n).fill(null);

  const std = fitStandardizer(trIdx.map(i => ds.X[i]));
  const trRows = trIdx.map(i => applyStd(ds.X[i], std));
  const trY = trIdx.map(i => ds.y[i]);

  const preds = ds.X.map(row => {
    const q = applyStd(row, std);
    const dists = trRows.map((tr, i) => {
      let d2 = 0;
      for (let c = 0; c < q.length; c++) d2 += (q[c] - tr[c]) ** 2;
      return { d2, y: trY[i] };
    });
    dists.sort((a, b) => a.d2 - b.d2);
    let s = 0;
    for (let i = 0; i < k; i++) s += dists[i].y;
    return s / k;
  });
  return toFitted(ds, n, preds);
}

// ------------------------------------------------------- Bosque aleatorio ----

// PRNG determinista (mismo mulberry32 del generador de datos): semilla fija
// ⇒ el bosque produce siempre el mismo resultado (RNF-2).
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface TreeNode {
  feature?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  value?: number;
}

const MIN_LEAF = 3;

function buildTree(
  idx: number[],
  X: number[][],
  y: number[],
  depth: number,
  maxDepth: number,
  rng: () => number
): TreeNode {
  const mean = idx.reduce((s, i) => s + y[i], 0) / idx.length;
  if (depth >= maxDepth || idx.length < 2 * MIN_LEAF) return { value: mean };

  const nFeat = X[0].length;
  const mtry = Math.max(1, Math.round(Math.sqrt(nFeat)));
  // Submuestreo de variables: cada nodo sólo "ve" mtry características al azar
  const candidates: number[] = [];
  while (candidates.length < mtry) {
    const f = Math.floor(rng() * nFeat);
    if (!candidates.includes(f)) candidates.push(f);
  }

  let best: { f: number; thr: number; sse: number } | null = null;
  for (const f of candidates) {
    const sorted = [...idx].sort((a, b) => X[a][f] - X[b][f]);
    // Sumas prefijas para evaluar cada corte en O(1)
    let leftSum = 0, leftSq = 0;
    let rightSum = 0, rightSq = 0;
    for (const i of sorted) { rightSum += y[i]; rightSq += y[i] * y[i]; }
    for (let s = 0; s < sorted.length - 1; s++) {
      const yi = y[sorted[s]];
      leftSum += yi; leftSq += yi * yi;
      rightSum -= yi; rightSq -= yi * yi;
      const nl = s + 1, nr = sorted.length - nl;
      if (nl < MIN_LEAF || nr < MIN_LEAF) continue;
      if (X[sorted[s]][f] === X[sorted[s + 1]][f]) continue; // sin corte entre valores iguales
      const sse = (leftSq - leftSum * leftSum / nl) + (rightSq - rightSum * rightSum / nr);
      if (!best || sse < best.sse) {
        best = { f, thr: (X[sorted[s]][f] + X[sorted[s + 1]][f]) / 2, sse };
      }
    }
  }
  if (!best) return { value: mean };

  const leftIdx = idx.filter(i => X[i][best!.f] <= best!.thr);
  const rightIdx = idx.filter(i => X[i][best!.f] > best!.thr);
  if (leftIdx.length === 0 || rightIdx.length === 0) return { value: mean };

  return {
    feature: best.f,
    threshold: best.thr,
    left: buildTree(leftIdx, X, y, depth + 1, maxDepth, rng),
    right: buildTree(rightIdx, X, y, depth + 1, maxDepth, rng)
  };
}

function predictTree(node: TreeNode, row: number[]): number {
  if (node.value !== undefined) return node.value;
  return row[node.feature!] <= node.threshold!
    ? predictTree(node.left!, row)
    : predictTree(node.right!, row);
}

/**
 * Bosque aleatorio de regresión: nTrees árboles, cada uno entrenado con una
 * muestra bootstrap del entrenamiento y cortes elegidos entre √F variables al
 * azar por nodo. La predicción es el promedio del bosque. No extrapola: fuera
 * del rango visto en entrenamiento predice valores "aplanados" — limitación
 * clásica de los árboles con series con tendencia, y parte de la lección.
 */
export function forestForecast(
  ds: MlDataset,
  n: number,
  trainEnd: number,
  nTrees: number,
  maxDepth: number,
  seed = 42
): (number | null)[] {
  const trIdx = splitTrain(ds, trainEnd);
  if (trIdx.length < 2 * MIN_LEAF) return Array(n).fill(null);

  const rng = mulberry32(seed);
  const trees: TreeNode[] = [];
  for (let t = 0; t < nTrees; t++) {
    const boot: number[] = [];
    for (let i = 0; i < trIdx.length; i++) {
      boot.push(trIdx[Math.floor(rng() * trIdx.length)]);
    }
    trees.push(buildTree(boot, ds.X, ds.y, 0, maxDepth, rng));
  }

  const preds = ds.X.map(row => {
    let s = 0;
    for (const tree of trees) s += predictTree(tree, row);
    return s / trees.length;
  });
  return toFitted(ds, n, preds);
}
