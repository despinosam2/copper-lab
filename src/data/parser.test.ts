// R01-T3 (09 EXECUTION BLUEPRINT) — Fotografía del comportamiento ACTUAL del
// parser, para poder comparar antes/después de R02/R03/R05.
//
// IMPORTANTE: uno de estos casos documenta a propósito el bug B1 (la coma
// decimal "4,23" se interpreta como 4). NO es un test de comportamiento
// correcto: es la línea base que R02-T1 actualizará al arreglar el bug.

import { describe, it, expect } from "vitest";
import { validateRows, sniffCsvFieldSeparator } from "./parser";

const enc = (s: string) => new TextEncoder().encode(s);

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

describe("validateRows — R02: coma decimal y separadores de miles", () => {
  it("interpreta la coma decimal '4,23' como 4.23 (bug B1 corregido)", () => {
    const res = validateRows([{ price: "4,23" }]);
    expect(res.success).toBe(true);
    expect(res.data![0].price).toBeCloseTo(4.23, 5);
  });

  it("interpreta '1,234' (grupo de 3 dígitos) como separador de miles", () => {
    const res = validateRows([{ price: "1,234" }]);
    expect(res.success).toBe(true);
    expect(res.data![0].price).toBe(1234);
  });

  it("interpreta '1.234,56' (formato es-ES) como 1234.56", () => {
    const res = validateRows([{ price: "1.234,56" }]);
    expect(res.success).toBe(true);
    expect(res.data![0].price).toBeCloseTo(1234.56, 5);
  });

  it("interpreta '1,234.56' (formato en-US) como 1234.56", () => {
    const res = validateRows([{ price: "1,234.56" }]);
    expect(res.success).toBe(true);
    expect(res.data![0].price).toBeCloseTo(1234.56, 5);
  });

  it("rechaza texto con basura al final ('4.23abc'), no lo trunca en silencio", () => {
    const res = validateRows([{ price: "4.23abc" }]);
    expect(res.success).toBe(false);
    expect(res.errors![0]).toContain("no es numérico");
  });

  it("rechaza texto no numérico ('abc123')", () => {
    const res = validateRows([{ price: "abc123" }]);
    expect(res.success).toBe(false);
  });
});

describe("sniffCsvFieldSeparator — hallazgo adicional de R02", () => {
  it("detecta ';' cuando la primera línea tiene más ';' que ','", () => {
    const bytes = enc("price;growth\n4,23;2,6\n4,45;2,7\n");
    expect(sniffCsvFieldSeparator(bytes)).toBe(";");
  });

  it("no detecta ';' en un CSV normal separado por comas", () => {
    const bytes = enc("price,growth\n4.23,2.6\n");
    expect(sniffCsvFieldSeparator(bytes)).toBeUndefined();
  });

  it("no entra en la heurística para binarios reales (bytes nulos al inicio)", () => {
    // ZIP (.xlsx) y OLE2 (.xls) tienen NUL muy temprano; nunca deben sniffearse como CSV.
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 59, 59, 59]); // "PK\x03\x04" + NULs + ';;;'
    expect(sniffCsvFieldSeparator(bytes)).toBeUndefined();
  });
});
