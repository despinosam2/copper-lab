// R09-T4 (09 EXECUTION BLUEPRINT) — Equivalencia de configuración del GPR
// entre la pestaña 04 (siempre usa toda la serie, x = i/(n-1)) y la
// pestaña 07 (antes usaba x = i/(trainEnd-1), lo que hacía que el mismo l
// significara una suavidad distinta según el % de entrenamiento — Δ10.5%
// de RMSE verificado en la auditoría). Tras R09 ambas normalizan igual.

import { describe, it, expect } from "vitest";
import { generateSyntheticData } from "../data/generator";
import { gprPredict, gprOneStepForecast } from "./forecast";

describe("GPR — misma normalización en tab04 y tab07", () => {
  it("con el mismo l, el RMSE de entrenamiento no depende de trainEnd", () => {
    const data = generateSyntheticData(42, 0.1);
    const y = data.map((r) => r.price);
    const n = y.length;
    const params = { lengthScale: 0.1, signalVariance: 1.0, noiseVariance: 0.05 };
    const trainEnd = Math.round(0.8 * n);

    // Réplica de lo que hace GprView.tsx: x normalizado por (n-1), fit directo.
    const xFull = Array(n).fill(0).map((_, i) => i / (n - 1));
    const direct = gprPredict(
      xFull.slice(0, trainEnd),
      y.slice(0, trainEnd),
      xFull.slice(0, trainEnd),
      params,
    );

    // gprOneStepForecast (pestaña 07) evaluado sólo en el tramo de entrenamiento.
    const viaTab07 = gprOneStepForecast(y, params, trainEnd, 2);

    for (let i = 0; i < trainEnd; i++) {
      expect(viaTab07.fitted[i]).not.toBeNull();
      expect(Math.abs((viaTab07.fitted[i] as number) - direct.mean[i])).toBeLessThan(1e-9);
    }
  });
});
