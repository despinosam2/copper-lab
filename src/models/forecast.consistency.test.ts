// R01-T2 (09 EXECUTION BLUEPRINT) — Consistencia AJUSTE ↔ PRONÓSTICO.
//
// La estrategia de la v2 (07 VALIDACION SPEC) es que las funciones de
// forecast.ts son PARALELAS a las de fit* de las pestañas 02–05, y que con
// trainEnd = n reproducen exactamente sus resultados in-sample. El manual
// (§3.9) y la spec 07 (criterio de aceptación 1) afirman esta garantía, pero
// hasta ahora no existía como artefacto en el repo. Esto la codifica.
//
// Datos: únicamente el generador sintético determinista (sin el Excel del
// curso, que se excluye del repo público). Semilla fija ⇒ reproducible.

import { describe, it, expect } from "vitest";
import { generateSyntheticData } from "../data/generator";
import { fitArima } from "./arima";
import { fitArimax } from "./arimax";
import { fitGpr } from "./gpr";
import { fitHybrid } from "./hybrid";
import {
  arimaxForecast,
  gprForecast,
  hybridForecast,
} from "./forecast";

const TOL = 1e-9;
const data = generateSyntheticData(42, 0.1);
const y = data.map((r) => r.price);
const n = y.length;
const exog2 = data.map((r) => [r.globalGrowth, r.usdIndex]);
const exog5 = data.map((r) => [
  r.globalGrowth,
  r.usdIndex,
  r.stocks,
  r.libor,
  r.partLargas,
]);

/** Compara desde `from` en adelante, tratando null como "sin predicción". */
function expectClose(
  forecast: (number | null)[],
  fit: number[],
  from: number,
) {
  for (let i = from; i < fit.length; i++) {
    const f = forecast[i];
    expect(f, `índice ${i} no debería ser null`).not.toBeNull();
    expect(Math.abs((f as number) - fit[i])).toBeLessThan(TOL);
  }
}

describe("ARIMA: fitArima ↔ arimaxForecast(trainEnd=n)", () => {
  for (const [p, d] of [
    [1, 0],
    [2, 1],
    [6, 2],
    [3, 1],
  ] as const) {
    it(`ARIMA(${p},${d},0) coincide in-sample`, () => {
      const fit = fitArima(y, p, d);
      const fc = arimaxForecast(y, [], p, d, n);
      expectClose(fc.fitted, fit.fitted, p + d);
    });
  }
});

describe("ARIMAX: fitArimax ↔ arimaxForecast(trainEnd=n)", () => {
  for (const [p, d] of [
    [2, 1],
    [4, 0],
  ] as const) {
    it(`ARIMAX(${p},${d}) con 2 covariables coincide in-sample`, () => {
      const fit = fitArimax(y, exog2, p, d);
      const fc = arimaxForecast(y, exog2, p, d, n);
      expectClose(fc.fitted, fit.fitted, p + d);
    });
  }
});

describe("GPR: fitGpr ↔ gprForecast(trainEnd=n)", () => {
  it("la media coincide in-sample", () => {
    const params = { lengthScale: 0.1, signalVariance: 1.0, noiseVariance: 0.05 };
    const x = Array(n)
      .fill(0)
      .map((_, i) => i / (n - 1));
    const fit = fitGpr(x, y, params);
    const fc = gprForecast(y, params, n, 2);
    expectClose(fc.fitted, fit.mean, 0);
  });
});

describe("Híbrido: fitHybrid ↔ hybridForecast(trainEnd=n)", () => {
  it("ARIMAX(2,1)+GPR coincide in-sample", () => {
    const params = { lengthScale: 0.1, signalVariance: 1.0, noiseVariance: 0.05 };
    const fit = fitHybrid(y, exog5, 2, 1, params);
    const fc = hybridForecast(y, exog5, 2, 1, params, n, 2);
    expectClose(fc.fitted, fit.fitted, 3);
  });
});
