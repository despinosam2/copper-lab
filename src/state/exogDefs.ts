import { CopperRow } from '../data/generator';
import { ArimaxState } from './ModelParams';

// Covariables exógenas disponibles para ARIMAX, en un solo lugar para que la
// vista y el Comparador construyan la misma matriz y las mismas etiquetas.
// Las tres últimas vienen del dataset del curso (columnas Stocks, Libor,
// PartLargas); con el dataset sintético también tienen señal (ver generator.ts).
export const EXOG_DEFS: {
  key: keyof Pick<CopperRow, 'globalGrowth' | 'usdIndex' | 'stocks' | 'libor' | 'partLargas'>;
  flag: keyof Pick<ArimaxState, 'useGrowth' | 'useUsd' | 'useStocks' | 'useLibor' | 'usePartLargas'>;
  label: string;
  shortLabel: string;
}[] = [
  { key: 'globalGrowth', flag: 'useGrowth', label: 'Incluir Crecimiento Global', shortLabel: 'crecimiento' },
  { key: 'usdIndex', flag: 'useUsd', label: 'Incluir Índice Dólar', shortLabel: 'dólar' },
  { key: 'stocks', flag: 'useStocks', label: 'Incluir Inventarios (Stocks)', shortLabel: 'inventarios' },
  { key: 'libor', flag: 'useLibor', label: 'Incluir Índice Libor', shortLabel: 'libor' },
  { key: 'partLargas', flag: 'usePartLargas', label: 'Incluir Posición Especulativa', shortLabel: 'posición especulativa' }
];

/** Construye la matriz de exógenas activas, en el mismo orden que EXOG_DEFS. */
export function buildExogMatrix(data: CopperRow[], arimax: ArimaxState): number[][] {
  const active = EXOG_DEFS.filter(def => arimax[def.flag]);
  return data.map(row => active.map(def => row[def.key]));
}

/** Lista de definiciones activas, en el mismo orden que las columnas de buildExogMatrix. */
export function activeExogDefs(arimax: ArimaxState) {
  return EXOG_DEFS.filter(def => arimax[def.flag]);
}
