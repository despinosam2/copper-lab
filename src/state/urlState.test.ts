// R19 — round-trip y robustez de la codificación de estado en URL.

import { describe, it, expect } from "vitest";
import { encodeState, decodeState, ShareableState } from "./urlState";

const sample: ShareableState = {
  seed: 42,
  noise: 0.1,
  structural: { growth: 2.5, supplyInterruptPct: 5, inventory: 4, usdIndex: 100, energyCost: 1 },
  dynamics: { demandElasticity: 0.1, supplyElasticity: 0.15, supplyLag: 8, priceSensitivity: 0.15, activityGrowth: 0.3, shockMagnitude: 10, shockQuarter: 8 },
  arima: { p: 3, d: 1 },
  arimax: { p: 2, d: 1, useGrowth: true, useUsd: false, useStocks: true, useLibor: false, usePartLargas: false, diffExog: true },
  gpr: { lengthScale: 0.05, signalVariance: 2.0, noiseVariance: 0.01, bandSigma: 1, kernelMode: 'rbf+periodic', periodicLengthScale: 1.5, periodicVariance: 0.4 },
  hybrid: { p: 2, d: 1, lengthScale: 0.3 },
  validation: { trainPct: 70, model: 'forest', folds: 5, gprMode: 'extrapolate', mlLags: 4, mlDiff: true, ridgeLambda: 0.5, knnK: 7, forestTrees: 80, forestDepth: 6, forecastHorizon: 18, exogScenario: { globalGrowth: 0.5, usdIndex: -0.2, stocks: 0, libor: 0, partLargas: 0 } },
};

describe("urlState — encode/decode", () => {
  it("round-trip: decode(encode(s)) reproduce el estado exacto", () => {
    const decoded = decodeState(encodeState(sample));
    expect(decoded).toEqual(sample);
  });

  it("sobrevive el paso por URLSearchParams (encodeo de URL real)", () => {
    const params = new URLSearchParams({ config: encodeState(sample) });
    const roundTripped = decodeState(new URLSearchParams(params.toString()).get('config'));
    expect(roundTripped).toEqual(sample);
  });

  it("null/vacío devuelve null", () => {
    expect(decodeState(null)).toBeNull();
    expect(decodeState('')).toBeNull();
  });

  it("JSON corrupto devuelve null, no lanza", () => {
    expect(decodeState('{no es json')).toBeNull();
    expect(decodeState('"un string"')).toBeNull();
  });

  it("versión desconocida devuelve null", () => {
    expect(decodeState(JSON.stringify({ v: 99, seed: 1, noise: 0.1 }))).toBeNull();
  });

  it("sin seed/noise numéricos devuelve null", () => {
    expect(decodeState(JSON.stringify({ v: 1, seed: 'x', noise: 0.1 }))).toBeNull();
  });
});
