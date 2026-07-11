// R01-T3 (09 EXECUTION BLUEPRINT) — Fotografía del comportamiento ACTUAL del
// parser, para poder comparar antes/después de R02/R03/R05.
//
// IMPORTANTE: uno de estos casos documenta a propósito el bug B1 (la coma
// decimal "4,23" se interpreta como 4). NO es un test de comportamiento
// correcto: es la línea base que R02-T1 actualizará al arreglar el bug.

import { describe, it, expect } from "vitest";
import { validateRows } from "./parser";

describe("validateRows — casos válidos", () => {
  it("acepta filas con precio numérico positivo", () => {
    const res = validateRows([{ price: 5 }, { price: 7 }]);
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(2);
    expect(res.data![0].price).toBe(5);
    expect(res.data![1].price).toBe(7);
  });

  it("omite (sin rechazar) filas con precio vacío", () => {
    const res = validateRows([{ price: 5 }, { price: "" }, { price: 7 }]);
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(2);
    // El índice temporal se reindexa sobre las filas conservadas.
    expect(res.data![1].t).toBe(1);
  });

  it("rellena covariables ausentes con los valores por defecto documentados", () => {
    const res = validateRows([{ price: 5 }]);
    expect(res.success).toBe(true);
    const row = res.data![0];
    expect(row.globalGrowth).toBe(2.5);
    expect(row.usdIndex).toBe(100);
    expect(row.stocks).toBe(4);
    expect(row.libor).toBe(100);
    expect(row.partLargas).toBe(0.7);
  });
});

describe("validateRows — casos rechazados", () => {
  it("rechaza un archivo vacío", () => {
    const res = validateRows([]);
    expect(res.success).toBe(false);
    expect(res.errors).toBeTruthy();
  });

  it("rechaza cuando no hay columna de precio", () => {
    const res = validateRows([{ growth: 2.5 }]);
    expect(res.success).toBe(false);
  });

  it("rechaza un precio no numérico", () => {
    const res = validateRows([{ price: "abc" }]);
    expect(res.success).toBe(false);
    expect(res.errors![0]).toContain("no es numérico");
  });

  it("rechaza un precio menor o igual a cero", () => {
    const res = validateRows([{ price: -5 }]);
    expect(res.success).toBe(false);
    expect(res.errors![0]).toContain("mayor a cero");
  });
});

describe("validateRows — comportamiento ACTUAL (bug B1, se corrige en R02)", () => {
  // parseFloat("4,23") === 4 en JavaScript: la coma decimal se trunca en
  // silencio. Este test fija ese comportamiento defectuoso como línea base;
  // R02-T1 lo actualizará para esperar 4.23.
  it("[BUG] interpreta la coma decimal '4,23' como 4", () => {
    const res = validateRows([{ price: "4,23" }]);
    expect(res.success).toBe(true);
    expect(res.data![0].price).toBe(4);
  });
});
