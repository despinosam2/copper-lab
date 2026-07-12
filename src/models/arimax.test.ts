// R12 (09 EXECUTION BLUEPRINT) — designMatrix/diffResiduals deben ser
// consistentes con el objetivo diferenciado real: para cada fila i,
// designMatrix[i]·β + diffResiduals[i] debe reconstruir exactamente el
// target diferenciado (no un valor derivado circularmente del propio test).

import { describe, it, expect } from "vitest";
import { generateSyntheticData } from "../data/generator";
import { fitArimax } from "./arimax";
import { arimaxForecast } from "./forecast";
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

describe("fitArimax — diffExog (R22)", () => {
  const data = generateSyntheticData(42, 0.1);
  const y = data.map(r => r.price);
  const exog = data.map(r => [r.globalGrowth, r.usdIndex]);

  it("con diffExog=false (default) el resultado es idéntico al histórico", () => {
    const a = fitArimax(y, exog, 2, 1);
    const b = fitArimax(y, exog, 2, 1, false);
    expect(b.fitted).toEqual(a.fitted);
    expect(b.exogCoefficients).toEqual(a.exogCoefficients);
  });

  it("con diffExog=true y d>=1, los coeficientes cambian (las X entran diferenciadas)", () => {
    const levels = fitArimax(y, exog, 2, 1, false);
    const diffed = fitArimax(y, exog, 2, 1, true);
    expect(diffed.exogCoefficients).not.toEqual(levels.exogCoefficients);
    // La columna de la matriz de diseño para la primera exógena debe ser la
    // PRIMERA DIFERENCIA de la serie de crecimiento, no su nivel.
    const growthSeries = data.map(r => r.globalGrowth);
    const expectedFirstExog = growthSeries[3] - growthSeries[2]; // Δgrowth alineado con la primera fila (t=p=2, d=1 → original t+d=3)
    expect(diffed.designMatrix[0][3]).toBeCloseTo(expectedFirstExog, 9); // columnas: [1, φ1, φ2, exog1, exog2]
  });

  it("con diffExog=true y d=0, es un no-op (idéntico a false)", () => {
    const a = fitArimax(y, exog, 2, 0, false);
    const b = fitArimax(y, exog, 2, 0, true);
    expect(b.fitted).toEqual(a.fitted);
  });

  it("consistencia fit↔forecast también con diffExog=true", () => {
    const fit = fitArimax(y, exog, 2, 1, true);
    const fc = arimaxForecast(y, exog, 2, 1, y.length, true);
    for (let i = 3; i < y.length; i++) {
      expect(fc.fitted[i]).not.toBeNull();
      expect(Math.abs((fc.fitted[i] as number) - fit.fitted[i])).toBeLessThan(1e-9);
    }
  });
});
