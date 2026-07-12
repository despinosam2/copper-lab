// R11/R12 (09 EXECUTION BLUEPRINT) — Tests de diagnostics.ts.

import { describe, it, expect } from "vitest";
import { autocorrelation, ljungBox, chiSquareUpperPValue, standardErrors, tStatistics } from "./diagnostics";
import { generateSyntheticData } from "../data/generator";

describe("chiSquareUpperPValue — contra valores críticos conocidos (95%)", () => {
  // Valores de tabla estándar: P(X > x) = 0.05 para estos (df, x).
  it("df=1, x=3.841459 → p≈0.05", () => {
    expect(chiSquareUpperPValue(3.841459, 1)).toBeCloseTo(0.05, 3);
  });
  it("df=2, x=5.991465 → p≈0.05", () => {
    expect(chiSquareUpperPValue(5.991465, 2)).toBeCloseTo(0.05, 3);
  });
  it("df=3, x=7.814728 → p≈0.05", () => {
    expect(chiSquareUpperPValue(7.814728, 3)).toBeCloseTo(0.05, 3);
  });
  it("x=0 → p=1 (ninguna evidencia contra H0)", () => {
    expect(chiSquareUpperPValue(0, 5)).toBe(1);
  });
});

describe("autocorrelation", () => {
  it("una serie alternante +1/-1 tiene autocorrelación de rezago 1 fuertemente negativa", () => {
    const residuals = Array(40).fill(0).map((_, i) => (i % 2 === 0 ? 1 : -1));
    const acf = autocorrelation(residuals, 3);
    expect(acf[0]).toBeLessThan(-0.9); // rezago 1 ≈ -1
  });

  it("ruido blanco determinista tiene autocorrelación baja en todos los rezagos", () => {
    // Generador sintético con ruido puro (sin tendencia/estacionalidad/covariables):
    // se usa el propio PRNG del proyecto vía generateSyntheticData con ruido alto
    // y se toma sólo el residuo respecto de su media como aproximación a ruido blanco.
    const data = generateSyntheticData(123, 0.25);
    const y = data.map(r => r.price);
    const mean = y.reduce((s, v) => s + v, 0) / y.length;
    // Diferenciar una vez rompe la tendencia lenta; lo que queda se acerca a ruido.
    const diffed = y.slice(1).map((v, i) => v - y[i] - (mean - mean));
    const acf = autocorrelation(diffed, 5);
    for (const r of acf) expect(Math.abs(r)).toBeLessThan(0.5);
  });
});

describe("ljungBox", () => {
  it("una serie alternante +1/-1 (estructura fuerte) da p-valor casi 0", () => {
    const residuals = Array(60).fill(0).map((_, i) => (i % 2 === 0 ? 1 : -1));
    const result = ljungBox(residuals, 4);
    expect(result.pValue).toBeLessThan(0.001);
  });

  it("ruido gaussiano con semilla fija (poca estructura) no rechaza H0 con confianza alta", () => {
    // mulberry32 vía generateSyntheticData con ruido alto, mismo enfoque que el
    // test de autocorrelation de arriba.
    const data = generateSyntheticData(7, 0.25);
    const y = data.map(r => r.price);
    const diffed = y.slice(1).map((v, i) => v - y[i]);
    const result = ljungBox(diffed, 4);
    expect(result.pValue).toBeGreaterThan(0.01);
  });
});

describe("standardErrors — caso calculado a mano", () => {
  // x = [0,1,2], y = [1,2,4]. Regresión simple con intercepto:
  // pendiente=1.5, intercepto=5/6; residuos=[1/6,-1/3,1/6]; RSS=1/6; df=1.
  // (XᵀX)⁻¹ = [[5/6,-1/2],[-1/2,1/2]] → SE(intercepto)=√(1/6·5/6)≈0.3727,
  // SE(pendiente)=√(1/6·1/2)≈0.2887.
  it("coincide con el cálculo manual", () => {
    const X = [[1, 0], [1, 1], [1, 2]];
    const residuals = [1 / 6, -1 / 3, 1 / 6];
    const se = standardErrors(X, residuals, 2);
    expect(se[0]).toBeCloseTo(0.3727, 3);
    expect(se[1]).toBeCloseTo(0.2887, 3);
  });

  it("un ajuste exacto (residuos cero) da errores estándar cero", () => {
    const X = [[1, 0], [1, 1], [1, 2]];
    const se = standardErrors(X, [0, 0, 0], 2);
    expect(se[0]).toBeCloseTo(0, 10);
    expect(se[1]).toBeCloseTo(0, 10);
  });
});

describe("tStatistics", () => {
  it("t = β / SE(β)", () => {
    const t = tStatistics([1.5, 0.8333], [0.2887, 0.3727]);
    expect(t[0]).toBeCloseTo(1.5 / 0.2887, 3);
    expect(t[1]).toBeCloseTo(0.8333 / 0.3727, 3);
  });

  it("SE=0 no produce Infinity/NaN (devuelve 0)", () => {
    const t = tStatistics([1.5], [0]);
    expect(t[0]).toBe(0);
  });
});
