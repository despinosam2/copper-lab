import { cholesky, forwardSolve, backwardSolve, transpose, multiply } from './matrix';

export interface GprParams {
  lengthScale: number; // l
  signalVariance: number; // sigma_f^2
  noiseVariance: number; // sigma_n^2
  /**
   * R20: modo de kernel. 'rbf' (default, comportamiento histórico) o
   * 'rbf+periodic' (suma de RBF + kernel periódico — captura la
   * estacionalidad anual que el RBF puro no puede representar). Los tres
   * campos periódicos sólo se usan en modo compuesto.
   */
  kernelMode?: 'rbf' | 'rbf+periodic';
  /** Período del ciclo en unidades de x (para 12 meses con x=i/(n−1): 12/(n−1)). */
  period?: number;
  /** Escala de longitud del kernel periódico (lp). */
  periodicLengthScale?: number;
  /** Varianza de la componente periódica (σp²). */
  periodicVariance?: number;
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

/**
 * R20: kernel periódico estándar (MacKay):
 *   k(x,x') = σp² · exp(−2·sin²(π·|x−x'|/p) / lp²)
 * Máximo (=σp²) cuando |x−x'| es múltiplo del período p — dos puntos
 * separados exactamente un ciclo se consideran "vecinos" aunque estén
 * lejos en el tiempo. Es lo que el RBF puro no puede expresar.
 */
export function periodic(x1: number, x2: number, lp: number, sigmaP2: number, period: number): number {
  const s = Math.sin(Math.PI * Math.abs(x1 - x2) / period);
  return sigmaP2 * Math.exp(-(2 * s * s) / (lp * lp));
}

/**
 * R20: kernel activo según el modo. Con 'rbf' (o sin modo — todos los
 * llamadores existentes) devuelve EXACTAMENTE rbf(...): el default es
 * bit-a-bit idéntico al comportamiento histórico. Con 'rbf+periodic'
 * devuelve la SUMA de ambos (suma de kernels = suma de procesos
 * independientes: tendencia suave + ciclo estacional).
 */
export function kernel(x1: number, x2: number, params: GprParams): number {
  const base = rbf(x1, x2, params.lengthScale, params.signalVariance);
  if (params.kernelMode !== 'rbf+periodic') return base;
  return base + periodic(
    x1, x2,
    params.periodicLengthScale ?? 1.0,
    params.periodicVariance ?? 0.3,
    params.period ?? 0.125
  );
}

export function fitGpr(x: number[], y: number[], params: GprParams): GprResult {
  const n = x.length;
  if (n === 0) return { mean: [], variance: [] };

  const { noiseVariance } = params;

  // Estandarizamos y (media 0, desviación 1) antes de ajustar:
  //  - sin centrar, el prior 0 del GP encogería la predicción hacia 0;
  //  - sin escalar, los hiperparámetros σf² y σn² sólo tendrían sentido para
  //    una escala de precios concreta. Estandarizando, funcionan igual con la
  //    serie sintética (~4 USD/lb) que con datos reales (~300 ¢/lb).
  // Al final la media y la varianza se devuelven en las unidades originales.
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  const yStd = Math.max(Math.sqrt(y.reduce((s, v) => s + (v - yMean) ** 2, 0) / n), 1e-9);
  const yc = y.map(v => (v - yMean) / yStd);

  // Build Covariance Matrix K (R20: kernel() respeta el modo — con 'rbf' es
  // exactamente el RBF de siempre).
  const K: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      K[i][j] = kernel(x[i], x[j], params);
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
      kStar[j] = kernel(x[i], x[j], params);
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
    const stdVariance = kernel(x[i], x[i], params) + noiseVariance - vT_v;
    // De vuelta a unidades originales (la varianza escala con yStd²)
    variance[i] = stdVariance * yStd * yStd;
  }

  return { mean, variance };
}

export interface GprBounds {
  lengthScale: [number, number];
  signalVariance: [number, number];
  noiseVariance: [number, number];
}

/** steps valores espaciados geométricamente entre min y max (ambos incluidos). */
function logspace(min: number, max: number, steps: number): number[] {
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    out.push(Math.exp(logMin + t * (logMax - logMin)));
  }
  return out;
}

/**
 * −log p(y|X): verosimilitud marginal negativa de un GPR para una
 * combinación de hiperparámetros. Reutiliza la misma factorización de
 * Cholesky que fitGpr — es literalmente el mismo cálculo, evaluado para
 * comparar hiperparámetros en vez de para predecir.
 * R20: recibe GprParams completo para poder evaluar también el kernel
 * compuesto (con modo 'rbf' es idéntico al comportamiento anterior).
 */
function negLogMarginalLikelihood(x: number[], yc: number[], params: GprParams): number {
  const n = x.length;
  const K: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      K[i][j] = kernel(x[i], x[j], params);
      if (i === j) K[i][j] += params.noiseVariance;
    }
  }
  const L = cholesky(K);
  const z = forwardSolve(L, yc);
  const alpha = backwardSolve(L, z);

  let quad = 0;
  for (let i = 0; i < n; i++) quad += yc[i] * alpha[i]; // yᵀK⁻¹y

  let logDet = 0;
  for (let i = 0; i < n; i++) logDet += Math.log(Math.max(L[i][i], 1e-12));
  logDet *= 2; // log|K| = 2·Σ log(Lᵢᵢ)

  return 0.5 * quad + 0.5 * logDet + (n / 2) * Math.log(2 * Math.PI);
}

/**
 * Busca (l, σf², σn²) que maximizan la verosimilitud marginal — el criterio
 * estándar en la literatura de GPR (Rasmussen & Williams, cap. 5) — por
 * búsqueda en grilla logarítmica dentro de los rangos de los sliders.
 *
 * Se usa grilla en vez de descenso por gradiente a propósito: siempre
 * termina en tiempo acotado y no depende de un punto de partida, coherente
 * con que ningún cálculo de la app use optimización iterativa que pueda
 * fallar en vivo (mismo principio que evita el término MA en ARIMA).
 *
 * Es asíncrona y cede el hilo tras cada valor de l: la grilla completa puede
 * tomar más de un segundo, y sin ceder el hilo el navegador se congela por
 * completo durante la búsqueda (ni siquiera pinta "Calculando…").
 */
export async function autoTuneGpr(
  x: number[],
  y: number[],
  bounds: GprBounds,
  steps = 6,
  /**
   * R20: modo compuesto opcional. Con periodicOpts, la grilla se extiende a
   * 5 dimensiones (l, σf², σn², lp, σp²) con `compositeSteps` valores por
   * dimensión (4 por defecto, no 6: 4⁵=1.024 evaluaciones vs 6⁵=7.776 —
   * la resolución del riesgo de rendimiento anotado en el blueprint §R20).
   */
  periodicOpts?: { period: number; lpBounds: [number, number]; sp2Bounds: [number, number]; compositeSteps?: number }
): Promise<GprParams> {
  const n = y.length;
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  const yStd = Math.max(Math.sqrt(y.reduce((s, v) => s + (v - yMean) ** 2, 0) / n), 1e-9);
  const yc = y.map(v => (v - yMean) / yStd);

  const gridSteps = periodicOpts ? (periodicOpts.compositeSteps ?? 4) : steps;
  const lVals = logspace(bounds.lengthScale[0], bounds.lengthScale[1], gridSteps);
  const sf2Vals = logspace(bounds.signalVariance[0], bounds.signalVariance[1], gridSteps);
  const sn2Vals = logspace(bounds.noiseVariance[0], bounds.noiseVariance[1], gridSteps);
  const lpVals = periodicOpts ? logspace(periodicOpts.lpBounds[0], periodicOpts.lpBounds[1], gridSteps) : [undefined];
  const sp2Vals = periodicOpts ? logspace(periodicOpts.sp2Bounds[0], periodicOpts.sp2Bounds[1], gridSteps) : [undefined];

  let best: GprParams = { lengthScale: lVals[0], signalVariance: sf2Vals[0], noiseVariance: sn2Vals[0] };
  let bestNll = Infinity;

  for (const l of lVals) {
    for (const sf2 of sf2Vals) {
      for (const sn2 of sn2Vals) {
        for (const lp of lpVals) {
          for (const sp2 of sp2Vals) {
            const candidate: GprParams = periodicOpts
              ? { lengthScale: l, signalVariance: sf2, noiseVariance: sn2, kernelMode: 'rbf+periodic', period: periodicOpts.period, periodicLengthScale: lp, periodicVariance: sp2 }
              : { lengthScale: l, signalVariance: sf2, noiseVariance: sn2 };
            const nll = negLogMarginalLikelihood(x, yc, candidate);
            if (nll < bestNll) {
              bestNll = nll;
              best = candidate;
            }
          }
        }
        // R20: en modo compuesto la grilla interior es 4²=16 Cholesky por
        // (l,σf²,σn²) — se cede el hilo también aquí, no sólo por valor de l.
        if (periodicOpts) await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return best;
}
