// Autoajuste de ARIMAX por BIC (criterio de información bayesiano).
//
// A diferencia del GPR (donde la verosimilitud marginal penaliza la
// complejidad "de fábrica"), en una regresión OLS el RMSE dentro de muestra
// NUNCA empeora al agregar rezagos o covariables: buscar el menor RMSE
// elegiría siempre el modelo más complejo. El BIC agrega la penalización que
// falta:
//
//   BIC = m·ln(RSS/m) + k·ln(m)
//
// con RSS la suma de residuos al cuadrado (en la escala original del precio),
// k = 1 + p + (covariables activas) y m las observaciones evaluadas.
//
// Para que el BIC sea comparable entre órdenes distintos (p, d), todos los
// candidatos se evalúan sobre la MISMA muestra: t ≥ 8 (= p_max + d_max), así
// ningún modelo gana por evaluarse en menos puntos.
//
// Búsqueda exhaustiva: 6 valores de p × 3 de d × 32 subconjuntos de las 5
// exógenas = 576 combinaciones — el óptimo verdadero según el criterio, sin
// optimización iterativa que pueda fallar en vivo. Cede el hilo entre valores
// de p para no congelar el navegador.

import { CopperRow } from '../data/generator';
import { EXOG_DEFS } from '../state/exogDefs';
import { fitArimax } from './arimax';

export interface ArimaxTuneOutcome {
  p: number;
  d: number;
  flags: {
    useGrowth: boolean;
    useUsd: boolean;
    useStocks: boolean;
    useLibor: boolean;
    usePartLargas: boolean;
  };
  bic: number;
}

const P_MAX = 6;
const D_MAX = 2;
const COMMON_START = P_MAX + D_MAX; // muestra común para todos los candidatos

export async function autoTuneArimaxBic(data: CopperRow[]): Promise<ArimaxTuneOutcome | null> {
  const y = data.map(r => r.price);
  const n = y.length;
  if (n - COMMON_START < 20) return null; // muy pocos datos para comparar 576 modelos

  let best: ArimaxTuneOutcome | null = null;

  for (let p = 1; p <= P_MAX; p++) {
    for (let d = 0; d <= D_MAX; d++) {
      for (let mask = 0; mask < 1 << EXOG_DEFS.length; mask++) {
        const defs = EXOG_DEFS.filter((_, i) => mask & (1 << i));
        const exog = data.map(r => defs.map(f => r[f.key]));
        const fit = fitArimax(y, exog, p, d);

        let rss = 0;
        let m = 0;
        for (let t = COMMON_START; t < n; t++) {
          const e = y[t] - fit.fitted[t];
          rss += e * e;
          m++;
        }
        const k = 1 + p + defs.length;
        if (m <= k + 2 || rss <= 0) continue;

        const bic = m * Math.log(rss / m) + k * Math.log(m);
        if (!best || bic < best.bic) {
          best = {
            p,
            d,
            bic,
            // El orden de bits sigue a EXOG_DEFS: growth, usd, stocks, libor, partLargas
            flags: {
              useGrowth: Boolean(mask & 1),
              useUsd: Boolean(mask & 2),
              useStocks: Boolean(mask & 4),
              useLibor: Boolean(mask & 8),
              usePartLargas: Boolean(mask & 16)
            }
          };
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 0)); // ceder el hilo
  }

  return best;
}
