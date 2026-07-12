import { createContext, useContext, useState, ReactNode } from 'react';
import { GprParams } from '../models/gpr';

// Estado compartido de los parámetros de cada modelo.
//
// Vive sobre las pestañas por dos razones:
//  1. Las vistas se desmontan al cambiar de pestaña (AnimatePresence), así que
//     con estado local los sliders se reseteaban en cada cambio de tab.
//  2. El Comparador (RF-9) muestra las métricas de los cuatro modelos con la
//     configuración que el estudiante dejó en cada pantalla, de modo que los
//     números coinciden con lo que vio en cada pestaña.

export interface StructuralState {
  growth: number; // %
  supplyInterruptPct: number; // %
  inventory: number; // semanas
  usdIndex: number;
  energyCost: number; // relativo (1 = normal)
}

export interface DynamicsState {
  demandElasticity: number; // εD
  supplyElasticity: number; // εS
  supplyLag: number; // L, trimestres
  priceSensitivity: number; // φ
  activityGrowth: number; // gA, %/trimestre
  shockMagnitude: number; // δ, %
  shockQuarter: number;
}

export interface ArimaState {
  p: number;
  d: number;
}

export interface ArimaxState {
  p: number;
  d: number;
  useGrowth: boolean;
  useUsd: boolean;
  useStocks: boolean;
  useLibor: boolean;
  usePartLargas: boolean;
  /**
   * R22: diferenciar también las exógenas cuando d ≥ 1 (evita regresar Δᵈy
   * sobre niveles no estacionarios). Default false = comportamiento
   * histórico — los números dorados del manual no cambian sin acción
   * explícita del usuario.
   */
  diffExog: boolean;
}

export interface GprState {
  lengthScale: number;
  signalVariance: number;
  noiseVariance: number;
  /** Ancho de la banda de incertidumbre: 1σ (68%, como la presentación del curso) o 2σ (95%). */
  bandSigma: 1 | 2;
  /**
   * R20: kernel compuesto opcional. 'rbf' (default histórico) o
   * 'rbf+periodic' — RBF + kernel periódico con período fijo de 12
   * observaciones (el ciclo anual del dataset sintético mensual). El período
   * en unidades de x (12/(n−1)) lo calcula cada vista según su serie.
   */
  kernelMode: 'rbf' | 'rbf+periodic';
  /** Escala de longitud del kernel periódico (lp). */
  periodicLengthScale: number;
  /** Varianza de la componente periódica (σp²). */
  periodicVariance: number;
}

export interface HybridState {
  p: number;
  d: number;
  lengthScale: number;
}

export type PredictorId = 'arima' | 'arimax' | 'gpr' | 'hybrid' | 'ridge' | 'knn' | 'forest';

export interface ValidationState {
  /** % de la serie usado como entrenamiento (el resto es prueba). */
  trainPct: number;
  model: PredictorId;
  folds: number;
  /**
   * Modo de pronóstico del GPR en la zona de prueba:
   *  - 'onestep': re-entrena con ventana expansiva y predice un paso adelante
   *    (comparable con los demás modelos — el default justo).
   *  - 'extrapolate': un solo ajuste que extrapola multi-paso; la media
   *    revierte hacia la media histórica y la banda se ensancha (la imagen
   *    honesta de "aquí ya no sé", pero incomparable con los otros modelos).
   */
  gprMode: 'onestep' | 'extrapolate';
  /** Rezagos de precio usados como características por los modelos ML. */
  mlLags: number;
  /** Si true, los ML predicen Δprecio (diferenciado) y se reintegra al nivel. */
  mlDiff: boolean;
  ridgeLambda: number;
  knnK: number;
  forestTrees: number;
  forestDepth: number;
  /**
   * R06: configuración de ARIMAX/GPR autoajustada usando SÓLO el tramo de
   * entrenamiento de esta pestaña (a diferencia de los botones de autoajuste
   * de las pestañas 03/04, que siempre usan la serie completa). undefined
   * ⇒ se usa la configuración compartida de esa pestaña, como hoy. No
   * sobreescribe arimax/gpr del contexto — evita tocar las pestañas 03/04.
   */
  arimaxOverride?: ArimaxState;
  gprOverride?: GprParams;
  /** R24: horizonte del pronóstico a futuro, en períodos (1–24). */
  forecastHorizon: number;
  /**
   * R24: escenario de exógenas futuras — tasa de crecimiento %/período por
   * covariable. 0 (default) = constante en su último valor observado
   * (supuesto ingenuo, declarado en pantalla).
   */
  exogScenario: {
    globalGrowth: number;
    usdIndex: number;
    stocks: number;
    libor: number;
    partLargas: number;
  };
}

interface ModelParamsState {
  structural: StructuralState;
  setStructural: (s: StructuralState) => void;
  dynamics: DynamicsState;
  setDynamics: (s: DynamicsState) => void;
  arima: ArimaState;
  setArima: (s: ArimaState) => void;
  arimax: ArimaxState;
  setArimax: (s: ArimaxState) => void;
  gpr: GprState;
  setGpr: (s: GprState) => void;
  hybrid: HybridState;
  setHybrid: (s: HybridState) => void;
  validation: ValidationState;
  setValidation: (s: ValidationState) => void;
}

const ModelParamsContext = createContext<ModelParamsState | null>(null);

/**
 * R19: estado inicial opcional (viene de un enlace compartido, ?config=).
 * Cada bloque se mezcla sobre los defaults — un enlace de una versión vieja
 * con campos ausentes cae a los defaults, nunca rompe (RNF-3). Sin `initial`,
 * el comportamiento es idéntico al de siempre.
 */
export interface InitialModelParams {
  structural?: Partial<StructuralState>;
  dynamics?: Partial<DynamicsState>;
  arima?: Partial<ArimaState>;
  arimax?: Partial<ArimaxState>;
  gpr?: Partial<GprState>;
  hybrid?: Partial<HybridState>;
  validation?: Partial<ValidationState>;
}

export function ModelParamsProvider({ children, initial }: { children: ReactNode; initial?: InitialModelParams }) {
  const [structural, setStructural] = useState<StructuralState>({
    growth: 2.5,
    supplyInterruptPct: 5,
    inventory: 4,
    usdIndex: 100,
    energyCost: 1,
    ...initial?.structural
  });
  const [dynamics, setDynamics] = useState<DynamicsState>({
    demandElasticity: 0.3,
    supplyElasticity: 0.15,
    supplyLag: 4,
    priceSensitivity: 0.15,
    activityGrowth: 0.3,
    shockMagnitude: 10,
    shockQuarter: 8,
    ...initial?.dynamics
  });
  const [arima, setArima] = useState<ArimaState>({ p: 2, d: 1, ...initial?.arima });
  const [arimax, setArimax] = useState<ArimaxState>({
    p: 2,
    d: 1,
    useGrowth: true,
    useUsd: true,
    useStocks: false,
    useLibor: false,
    usePartLargas: false,
    diffExog: false,
    ...initial?.arimax
  });
  const [gpr, setGpr] = useState<GprState>({ lengthScale: 0.1, signalVariance: 1.0, noiseVariance: 0.05, bandSigma: 2, kernelMode: 'rbf', periodicLengthScale: 1.0, periodicVariance: 0.3, ...initial?.gpr });
  const [hybrid, setHybrid] = useState<HybridState>({ p: 2, d: 1, lengthScale: 0.1, ...initial?.hybrid });
  const [validation, setValidation] = useState<ValidationState>({
    trainPct: 80,
    model: 'arimax',
    folds: 4,
    gprMode: 'onestep',
    mlLags: 3,
    mlDiff: false,
    ridgeLambda: 0.1,
    knnK: 5,
    forestTrees: 50,
    forestDepth: 5,
    forecastHorizon: 12,
    exogScenario: { globalGrowth: 0, usdIndex: 0, stocks: 0, libor: 0, partLargas: 0 },
    ...initial?.validation
  });

  return (
    <ModelParamsContext.Provider
      value={{ structural, setStructural, dynamics, setDynamics, arima, setArima, arimax, setArimax, gpr, setGpr, hybrid, setHybrid, validation, setValidation }}
    >
      {children}
    </ModelParamsContext.Provider>
  );
}

export function useModelParams(): ModelParamsState {
  const ctx = useContext(ModelParamsContext);
  if (!ctx) throw new Error('useModelParams debe usarse dentro de ModelParamsProvider');
  return ctx;
}
