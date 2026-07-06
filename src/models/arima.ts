import { ols } from './matrix';

export function difference(series: number[], d: number): number[] {
  let res = [...series];
  for (let i = 0; i < d; i++) {
    const next = [];
    for (let j = 1; j < res.length; j++) {
      next.push(res[j] - res[j - 1]);
    }
    res = next;
  }
  return res;
}

export interface ArimaResult {
  fitted: number[];
  coefficients: number[];
  intercept: number;
}

export function fitArima(y: number[], p: number, d: number): ArimaResult {
  const n = y.length;
  if (n <= p + d) {
    return { fitted: Array(n).fill(0), coefficients: [], intercept: 0 };
  }

  // 1. Difference the series
  const diffed = difference(y, d);
  
  // 2. Build design matrix and target vector
  const X: number[][] = [];
  const target: number[] = [];
  
  for (let t = p; t < diffed.length; t++) {
    const row = [1]; // intercept
    for (let i = 1; i <= p; i++) {
      row.push(diffed[t - i]);
    }
    X.push(row);
    target.push(diffed[t]);
  }

  // 3. Estimate parameters via OLS
  const beta = ols(X, target);
  const intercept = beta[0];
  const coefficients = beta.slice(1);

  // 4. Calculate fitted values in differenced space
  const diffFitted = Array(diffed.length).fill(null); // fill with null or 0 for first p elements?
  // We can only fit from index p
  for (let t = 0; t < p; t++) diffFitted[t] = diffed[t]; // or keep as is? Let's just use naive for first p
  for (let t = p; t < diffed.length; t++) {
    let pred = intercept;
    for (let i = 1; i <= p; i++) {
      pred += coefficients[i - 1] * diffed[t - i];
    }
    diffFitted[t] = pred;
  }

  // 5. Reintegrate to original space
  // We want to reconstruct y_hat.
  // For d=1: y_hat[t] = y[t-1] + diff_hat[t-1]
  // Because diffed[t] = y[t+d] - ...
  const fitted = [...y]; // copy original
  // We overwrite the predicted parts
  // The first p+d values are used as history.
  // diffFitted corresponds to diffed indices. diffed[i] corresponds to y[i+d].
  for (let t = p + d; t < n; t++) {
    // Reconstruct backwards
    // If d=0: fitted[t] = diffFitted[t]
    // If d=1: fitted[t] = y[t-1] + diffFitted[t-1]
    // If d=2: diff_1[t-1] = diff_1[t-2] + diffFitted[t-2] ...
    
    // Simpler reintegration for 1-step ahead prediction:
    // We always know the actual history up to t-1.
    if (d === 0) {
      fitted[t] = diffFitted[t];
    } else if (d === 1) {
      fitted[t] = y[t - 1] + diffFitted[t - 1];
    } else if (d === 2) {
      // diff1[t-1] = y[t-1] - y[t-2]
      // diff2_hat[t-2] = diffFitted[t-2]
      // diff1_hat[t-1] = diff1[t-2] + diffFitted[t-2]
      const diff1_prev = y[t - 1] - y[t - 2];
      const diff1_hat = diff1_prev + diffFitted[t - 2];
      fitted[t] = y[t - 1] + diff1_hat;
    }
  }

  return {
    fitted,
    coefficients,
    intercept
  };
}
