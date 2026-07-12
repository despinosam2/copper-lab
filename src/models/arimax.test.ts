// R12 (09 EXECUTION BLUEPRINT) — designMatrix/diffResiduals deben ser
// consistentes con el objetivo diferenciado real: para cada fila i,
// designMatrix[i]·β + diffResiduals[i] debe reconstruir exactamente el
// target diferenciado (no un valor derivado circularmente del propio test).

import { describe, it, expect } from "vitest";
import { generateSyntheticData } from "../data/generator";
import { fitArimax } from "./arimax";
import { difference } from "./arima";

describe("fitArimax — designMatrix y diffResiduals (R12)", () => {
  it("designMatrix·β + diffResiduals reconstruye el target diferenciado real", () => {
    const data = generateSyntheticData(42, 0.1);
    const y = data.map(r => r.price);
    const exog = data.map(r => [r.globalGrowth, r.usdIndex]);
    const p = 2, d = 1;
    const model = fitArimax(y, exog, p, d);

    // Reconstrucción independiente del target diferenciado (mismo cálculo
    // que hace fitArimax internamente, pero derivado aquí, no importado de él).
    const diffed = difference(y, d);
    const expectedTarget = diffed.slice(p);

    const beta = [model.intercept, ...model.coefficients, ...model.exogCoefficients];
    expect(model.designMatrix.length).toBe(expectedTarget.length);
    expect(model.diffResiduals.length).toBe(expectedTarget.length);

    for (let i = 0; i < model.designMatrix.length; i++) {
      const predicted = model.designMatrix[i].reduce((s, x, j) => s + x * beta[j], 0);
      expect(predicted + model.diffResiduals[i]).toBeCloseTo(expectedTarget[i], 9);
    }
  });

  it("con n <= p+d, designMatrix y diffResiduals quedan vacíos (no undefined)", () => {
    const model = fitArimax([1, 2], [], 6, 2);
    expect(model.designMatrix).toEqual([]);
    expect(model.diffResiduals).toEqual([]);
  });
});
