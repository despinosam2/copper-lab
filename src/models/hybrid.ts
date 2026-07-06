import { fitArimax } from './arimax';
import { fitGpr, GprParams } from './gpr';

export interface HybridResult {
  fitted: number[];
  variance: number[];
  arimaxFitted: number[];
  gprFitted: number[];
}

export function fitHybrid(
  y: number[], 
  exog: number[][], 
  p: number, 
  d: number,
  gprParams: GprParams
): HybridResult {
  const n = y.length;
  
  // 1. Fit ARIMAX
  const arimaxModel = fitArimax(y, exog, p, d);
  const arimaxFitted = arimaxModel.fitted;
  const residuals = arimaxModel.residuals;

  // 2. Normalize time index to [0, 1] for GPR as specified
  const x = Array(n).fill(0).map((_, i) => i / (n > 1 ? n - 1 : 1));

  // 3. Fit GPR on residuals
  const gprModel = fitGpr(x, residuals, gprParams);

  // 4. Combine predictions
  const fitted = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    // Only combine where ARIMAX could fit (index >= p + d)
    // Actually, ARIMAX returns fitted=[...y] for the first p+d elements
    // so residuals will be 0 there. This naturally keeps it bounded.
    fitted[i] = arimaxFitted[i] + gprModel.mean[i];
  }

  return {
    fitted,
    variance: gprModel.variance,
    arimaxFitted,
    gprFitted: gprModel.mean
  };
}
