// R13 (09 EXECUTION BLUEPRINT) — walkForwardRmse pasó a ser async (cede el
// hilo entre folds). Este test confirma que sigue devolviendo el resultado
// correcto (no sólo que type-checkea como Promise).

import { describe, it, expect } from "vitest";
import { walkForwardRmse, walkForwardFolds } from "./evaluation";

describe("walkForwardRmse — R13: async, mismo resultado que antes", () => {
  it("es una función async (devuelve una Promise)", () => {
    const result = walkForwardRmse([1, 2, 3], [], () => []);
    expect(result).toBeInstanceOf(Promise);
  });

  it("calcula el RMSE por fold correctamente con un run determinista", async () => {
    // y = 0..99; folds triviales de tamaño 10; run() predice y+1 siempre
    // (error constante de 1 en cada punto) ⇒ RMSE de cada fold = 1.
    const y = Array(100).fill(0).map((_, i) => i);
    const folds = walkForwardFolds(100, 3, 0.7);
    expect(folds.length).toBeGreaterThan(0);

    const run = (trainEnd: number) => y.map(v => v + 1);
    const result = await walkForwardRmse(y, folds, run);

    expect(result.mean).toBeCloseTo(1, 9);
    expect(result.std).toBeCloseTo(0, 9);
    for (const rmse of result.perFold) expect(rmse).toBeCloseTo(1, 9);
  });

  it("sin folds válidos, devuelve mean/std null", async () => {
    const result = await walkForwardRmse([1, 2, 3], [], () => []);
    expect(result.mean).toBeNull();
    expect(result.std).toBeNull();
  });
});
