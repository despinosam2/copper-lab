export interface Metrics {
  rmse: number | null;
  mae: number | null;
  mape: number | null;
  r2: number | null;
}

/**
 * R08: cuando no hay nada que evaluar (longitudes distintas o vacío), se
 * devuelve null en los 4 campos, no ceros. Antes un RMSE de 0.000 aquí era
 * indistinguible de un ajuste perfecto — la firma más engañosa posible
 * cuando en realidad significaba "el modelo no pudo ajustarse" (p. ej.
 * n ≤ p+d en ARIMA con muy pocos datos).
 */
export function calculateMetrics(actual: number[], predicted: number[]): Metrics {
  if (actual.length !== predicted.length || actual.length === 0) {
    return { rmse: null, mae: null, mape: null, r2: null };
  }

  const n = actual.length;
  const meanY = actual.reduce((s, v) => s + v, 0) / n;
  let sumSqErr = 0;
  let sumAbsErr = 0;
  let sumPctErr = 0;
  let sumSqTot = 0; // Σ(y − ȳ)² para el R²

  let nonZeroCount = 0;
  for (let i = 0; i < n; i++) {
    const y = actual[i];
    const y_hat = predicted[i];
    const diff = y - y_hat;

    sumSqErr += diff * diff;
    sumAbsErr += Math.abs(diff);
    sumSqTot += (y - meanY) * (y - meanY);

    if (y !== 0) {
      sumPctErr += Math.abs(diff / y);
      nonZeroCount++;
    }
  }

  return {
    rmse: Math.sqrt(sumSqErr / n),
    mae: sumAbsErr / n,
    mape: nonZeroCount > 0 ? (sumPctErr / nonZeroCount) * 100 : 0,
    // Coeficiente de determinación: fracción de la varianza explicada.
    // Puede ser negativo si el modelo ajusta peor que la media.
    r2: sumSqTot > 0 ? 1 - sumSqErr / sumSqTot : 0
  };
}
