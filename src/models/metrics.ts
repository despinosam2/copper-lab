export function calculateMetrics(actual: number[], predicted: number[]) {
  if (actual.length !== predicted.length || actual.length === 0) {
    return { rmse: 0, mae: 0, mape: 0 };
  }

  const n = actual.length;
  let sumSqErr = 0;
  let sumAbsErr = 0;
  let sumPctErr = 0;

  let nonZeroCount = 0;
  for (let i = 0; i < n; i++) {
    const y = actual[i];
    const y_hat = predicted[i];
    const diff = y - y_hat;

    sumSqErr += diff * diff;
    sumAbsErr += Math.abs(diff);

    if (y !== 0) {
      sumPctErr += Math.abs(diff / y);
      nonZeroCount++;
    }
  }

  return {
    rmse: Math.sqrt(sumSqErr / n),
    mae: sumAbsErr / n,
    mape: nonZeroCount > 0 ? (sumPctErr / nonZeroCount) * 100 : 0
  };
}
