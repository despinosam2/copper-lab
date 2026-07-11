// R01-T4 (09 EXECUTION BLUEPRINT) — Cobertura de calculateMetrics, incluidos
// los casos borde que R08 modificará (hoy n=0 devuelve ceros; R08 lo cambia a
// null para no mostrar "0.000" como si fuera un ajuste perfecto).

import { describe, it, expect } from "vitest";
import { calculateMetrics } from "./metrics";

describe("calculateMetrics — caso normal (valores calculados a mano)", () => {
  // actual   = [10, 20, 30], predicho = [12, 18, 33]
  // errores  = [-2, 2, -3]  → ΣE² = 17, Σ|E| = 7
  // RMSE = √(17/3) = 2.380476…   MAE = 7/3 = 2.33333…
  // MAPE = (0.2 + 0.1 + 0.1)/3 · 100 = 13.3333…
  // ȳ = 20 → Σ(y−ȳ)² = 200 → R² = 1 − 17/200 = 0.915
  const m = calculateMetrics([10, 20, 30], [12, 18, 33]);
  it("RMSE", () => expect(m.rmse).toBeCloseTo(2.380476, 5));
  it("MAE", () => expect(m.mae).toBeCloseTo(2.333333, 5));
  it("MAPE", () => expect(m.mape).toBeCloseTo(13.333333, 5));
  it("R²", () => expect(m.r2).toBeCloseTo(0.915, 5));
});

describe("calculateMetrics — MAPE excluye los valores cero de la serie", () => {
  it("un actual = 0 no entra en el MAPE", () => {
    // actual = [0, 10], predicho = [1, 12] → sólo cuenta |(10-12)/10| = 0.2
    const m = calculateMetrics([0, 10], [1, 12]);
    expect(m.mape).toBeCloseTo(20, 5);
  });
});

describe("calculateMetrics — R² cuando la serie es constante", () => {
  it("Σ(y−ȳ)² = 0 devuelve R² = 0 (comportamiento actual)", () => {
    const m = calculateMetrics([5, 5], [5, 5]);
    expect(m.r2).toBe(0);
    expect(m.rmse).toBe(0);
  });
});

describe("calculateMetrics — casos degenerados (comportamiento actual, R08 los cambia)", () => {
  it("[actual R08] array vacío devuelve ceros, no null", () => {
    const m = calculateMetrics([], []);
    expect(m).toEqual({ rmse: 0, mae: 0, mape: 0, r2: 0 });
  });

  it("[actual R08] longitudes distintas devuelven ceros", () => {
    const m = calculateMetrics([1, 2], [1]);
    expect(m).toEqual({ rmse: 0, mae: 0, mape: 0, r2: 0 });
  });
});
