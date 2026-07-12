// R20 (09 EXECUTION BLUEPRINT) — kernel periódico y kernel compuesto.

import { describe, it, expect } from "vitest";
import { periodic, kernel, fitGpr, GprParams } from "./gpr";
import { generateSyntheticData } from "../data/generator";
import { calculateMetrics } from "./metrics";

describe("periodic — propiedades del kernel", () => {
  const lp = 1.0, sp2 = 0.5, period = 0.125;

  it("k(x,x) es el máximo (= σp²)", () => {
    expect(periodic(0.3, 0.3, lp, sp2, period)).toBeCloseTo(sp2, 12);
  });

  it("a distancia exactamente UN período, vuelve al máximo (la firma periódica)", () => {
    expect(periodic(0.3, 0.3 + period, lp, sp2, period)).toBeCloseTo(sp2, 9);
  });

  it("a medio período, la correlación es mínima", () => {
    const atHalf = periodic(0.3, 0.3 + period / 2, lp, sp2, period);
    const atFull = periodic(0.3, 0.3 + period, lp, sp2, period);
    expect(atHalf).toBeLessThan(atFull);
  });
});

describe("kernel — el modo default es EXACTAMENTE el RBF histórico", () => {
  it("sin kernelMode, kernel() coincide con la fórmula RBF a mano", () => {
    const params: GprParams = { lengthScale: 0.1, signalVariance: 2.0, noiseVariance: 0.05 };
    const x1 = 0.2, x2 = 0.35;
    const manualRbf = 2.0 * Math.exp(-((x1 - x2) ** 2) / (2 * 0.1 * 0.1));
    expect(kernel(x1, x2, params)).toBe(manualRbf);
  });

  it("con kernelMode 'rbf' explícito, ídem", () => {
    const params: GprParams = { lengthScale: 0.1, signalVariance: 2.0, noiseVariance: 0.05, kernelMode: 'rbf' };
    expect(kernel(0.2, 0.35, params)).toBe(kernel(0.2, 0.35, { ...params, kernelMode: undefined }));
  });

  it("con 'rbf+periodic', kernel() = rbf + periodic (suma de procesos)", () => {
    const params: GprParams = {
      lengthScale: 0.1, signalVariance: 2.0, noiseVariance: 0.05,
      kernelMode: 'rbf+periodic', period: 0.125, periodicLengthScale: 1.0, periodicVariance: 0.5
    };
    const base = kernel(0.2, 0.35, { ...params, kernelMode: 'rbf' });
    const per = periodic(0.2, 0.35, 1.0, 0.5, 0.125);
    expect(kernel(0.2, 0.35, params)).toBeCloseTo(base + per, 12);
  });
});

describe("kernel compuesto — captura la estacionalidad que el RBF puro no puede (A6)", () => {
  it("con el dataset sintético (ciclo de 12 meses), el compuesto mejora el RMSE del RBF puro suavizado", () => {
    // El generador incluye 0.25·sin(2πt/12): estacionalidad anual conocida.
    // Un RBF con l grande (suave, sin perseguir ruido) no puede representar
    // el ciclo; el compuesto con período correcto (12 meses = 12/(n−1) en x)
    // sí. Se compara con la MISMA suavidad base para aislar el efecto.
    const data = generateSyntheticData(42, 0.05); // ruido bajo: la estacionalidad domina
    const y = data.map(r => r.price);
    const n = y.length;
    const x = Array(n).fill(0).map((_, i) => i / (n - 1));

    const base: GprParams = { lengthScale: 0.3, signalVariance: 1.0, noiseVariance: 0.05 };
    const composite: GprParams = {
      ...base,
      kernelMode: 'rbf+periodic',
      period: 12 / (n - 1),
      periodicLengthScale: 1.0,
      periodicVariance: 0.5
    };

    const rmseRbf = calculateMetrics(y, fitGpr(x, y, base).mean).rmse!;
    const rmseComposite = calculateMetrics(y, fitGpr(x, y, composite).mean).rmse!;

    expect(rmseComposite).toBeLessThan(rmseRbf);
    // La mejora debe ser sustancial (la estacionalidad es 0.25 de amplitud
    // con ruido 0.05), no un empate por redondeo.
    expect(rmseComposite).toBeLessThan(rmseRbf * 0.8);
  });
});
