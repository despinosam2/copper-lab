import { createContext, useContext, useState, ReactNode } from 'react';

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
}

export interface GprState {
  lengthScale: number;
  signalVariance: number;
  noiseVariance: number;
  /** Ancho de la banda de incertidumbre: 1σ (68%, como la presentación del curso) o 2σ (95%). */
  bandSigma: 1 | 2;
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
  /** Rezagos de precio usados como características por los modelos ML. */
  mlLags: number;
  ridgeLambda: number;
  knnK: number;
  forestTrees: number;
  forestDepth: number;
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

export function ModelParamsProvider({ children }: { children: ReactNode }) {
  const [structural, setStructural] = useState<StructuralState>({
    growth: 2.5,
    supplyInterruptPct: 5,
    inventory: 4,
    usdIndex: 100,
    energyCost: 1
  });
  const [dynamics, setDynamics] = useState<DynamicsState>({
    demandElasticity: 0.3,
    supplyElasticity: 0.15,
    supplyLag: 4,
    priceSensitivity: 0.15,
    activityGrowth: 0.3,
    shockMagnitude: 10,
    shockQuarter: 8
  });
  const [arima, setArima] = useState<ArimaState>({ p: 2, d: 1 });
  const [arimax, setArimax] = useState<ArimaxState>({
    p: 2,
    d: 1,
    useGrowth: true,
    useUsd: true,
    useStocks: false,
    useLibor: false,
    usePartLargas: false
  });
  const [gpr, setGpr] = useState<GprState>({ lengthScale: 0.1, signalVariance: 1.0, noiseVariance: 0.05, bandSigma: 2 });
  const [hybrid, setHybrid] = useState<HybridState>({ p: 2, d: 1, lengthScale: 0.1 });
  const [validation, setValidation] = useState<ValidationState>({
    trainPct: 80,
    model: 'arimax',
    folds: 4,
    mlLags: 3,
    ridgeLambda: 0.1,
    knnK: 5,
    forestTrees: 50,
    forestDepth: 5
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
