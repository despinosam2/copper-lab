// R24 (09 EXECUTION BLUEPRINT) — pronóstico real a futuro (recursivo con
// cortacircuito) y extrapolación GPR.

import { describe, it, expect } from "vitest";
import { generateSyntheticData } from "../data/generator";
import { fitArima } from "./arima";
import { difference } from "./arima";
import { arimaxForecastAhead, gprForecastAhead, hybridForecastAhead } from "./forecast";

const data = generateSyntheticData(42, 0.1);
const y = data.map(r => r.price);
const exog2 = data.map(r => [r.globalGrowth, r.usdIndex]);

describe("arimaxForecastAhead — recursivo", () => {
  it("el PRIMER paso coincide con el cálculo manual desde los coeficientes de fitArima", () => {
    // Con d=1 y sólo historia real disponible en el paso 1, la predicción es
    // y[n-1] + (c + Σ φᵢ·Δy[n-1-i]) — calculable a mano desde fitArima.
    const p = 2, d = 1;
    const fit = fitArima(y, p, d);
    const diffed = difference(y, d);
    let expectedDiff = fit.intercept;
    for (let i = 1; i <= p; i++) expectedDiff += fit.coefficients[i - 1] * diffed[diffed.length - i];
    const expected = y[y.length - 1] + expectedDiff;

    const ahead = arimaxForecastAhead(y, [], p, d, 6, Array(6).fill([]));
    expect(ahead).not.toBeNull();
    expect(ahead!.mean[0]).toBeCloseTo(expected, 9);
  });

  it("h pasos con exógenas: largo correcto, sin NaN/Infinity, dentro del cortacircuito", () => {
    const lastRow = data[data.length - 1];
    const future = Array(12).fill(0).map(() => [lastRow.globalGrowth, lastRow.usdIndex]);
    const ahead = arimaxForecastAhead(y, exog2, 2, 1, 12, future);
    expect(ahead).not.toBeNull();
    expect(ahead!.mean).toHaveLength(12);
    const max = Math.max(...y), min = Math.min(...y), range = max - min;
    for (const v of ahead!.mean) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeLessThanOrEqual(max + 3 * range + 1e-9);
      expect(v).toBeGreaterThanOrEqual(Math.max(0, min - 3 * range) - 1e-9);
    }
  });

  it("una serie geométrica explosiva (φ≈2) activa el cortacircuito y lo marca", () => {
    // y = 1,2,4,...,2^k con p=1,d=0 ⇒ φ estimado ≈ 2 ⇒ la recursión duplica
    // cada paso y DEBE salir del rango de confianza en pocos pasos.
    const explosive = Array(12).fill(0).map((_, i) => Math.pow(2, i));
    const ahead = arimaxForecastAhead(explosive, [], 1, 0, 10, Array(10).fill([]));
    expect(ahead).not.toBeNull();
    expect(ahead!.outOfConfidence.some(f => f)).toBe(true);
    const { mean } = ahead!;
    const hi = Math.max(...explosive) + 3 * (Math.max(...explosive) - Math.min(...explosive));
    for (const v of mean) expect(v).toBeLessThanOrEqual(hi + 1e-9);
  });

  it("h=0 devuelve arrays vacíos (caso límite del blueprint)", () => {
    const ahead = arimaxForecastAhead(y, [], 2, 1, 0, []);
    expect(ahead).toEqual({ mean: [], outOfConfidence: [] });
  });

  it("d=2 con p=6 y ruido alto: sin NaN, acotado (el caso más propenso a divergir)", () => {
    const noisy = generateSyntheticData(7, 0.25).map(r => r.price);
    const ahead = arimaxForecastAhead(noisy, [], 6, 2, 24, Array(24).fill([]));
    expect(ahead).not.toBeNull();
    for (const v of ahead!.mean) expect(Number.isFinite(v)).toBe(true);
  });
});

describe("gprForecastAhead — extrapolación", () => {
  it("a horizonte largo, la media revierte hacia la media histórica y la banda se ensancha", () => {
    const params = { lengthScale: 0.1, signalVariance: 1.0, noiseVariance: 0.05 };
    const ahead = gprForecastAhead(y, params, 24, 2);
    expect(ahead).not.toBeNull();
    const yMean = y.reduce((s, v) => s + v, 0) / y.length;
    // El último punto extrapolado (24 pasos ≈ 2.4 length scales fuera) debe
    // estar más cerca de la media histórica que el primero.
    const d0 = Math.abs(ahead!.mean[0] - yMean);
    const d23 = Math.abs(ahead!.mean[23] - yMean);
    expect(d23).toBeLessThanOrEqual(d0 + 1e-9);
    // La banda del último punto es más ancha que la del primero.
    const w0 = ahead!.bandHi![0] - ahead!.bandLo![0];
    const w23 = ahead!.bandHi![23] - ahead!.bandLo![23];
    expect(w23).toBeGreaterThan(w0);
  });
});

describe("hybridForecastAhead", () => {
  it("largo correcto, sin NaN, con banda", () => {
    const lastRow = data[data.length - 1];
    const exog5 = data.map(r => [r.globalGrowth, r.usdIndex, r.stocks, r.libor, r.partLargas]);
    const future = Array(12).fill(0).map(() => [lastRow.globalGrowth, lastRow.usdIndex, lastRow.stocks, lastRow.libor, lastRow.partLargas]);
    const ahead = hybridForecastAhead(y, exog5, 2, 1, { lengthScale: 0.1, signalVariance: 1.0, noiseVariance: 0.05 }, 12, future, 2);
    expect(ahead).not.toBeNull();
    expect(ahead!.mean).toHaveLength(12);
    expect(ahead!.bandLo).toHaveLength(12);
    for (const v of ahead!.mean) expect(Number.isFinite(v)).toBe(true);
  });

  it("h=0 devuelve arrays vacíos", () => {
    const ahead = hybridForecastAhead(y, exog2, 2, 1, { lengthScale: 0.1, signalVariance: 1.0, noiseVariance: 0.05 }, 0, []);
    expect(ahead).toEqual({ mean: [], outOfConfidence: [] });
  });
});
