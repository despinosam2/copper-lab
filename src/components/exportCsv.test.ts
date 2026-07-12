// R18 — tests de la serialización CSV (toCsv es pura; downloadCsv usa DOM
// y no se testea en node).

import { describe, it, expect } from "vitest";
import { toCsv } from "./exportCsv";

describe("toCsv", () => {
  it("serializa filas simples con encabezados del primer objeto", () => {
    const csv = toCsv([
      { fecha: "2024-01", precio: 4.23 },
      { fecha: "2024-02", precio: 4.45 },
    ]);
    expect(csv).toBe("fecha,precio\n2024-01,4.23\n2024-02,4.45");
  });

  it("escapa comas, comillas y saltos de línea según RFC 4180", () => {
    const csv = toCsv([{ a: 'con,coma', b: 'con "comillas"', c: 'con\nsalto' }]);
    expect(csv).toBe('a,b,c\n"con,coma","con ""comillas""","con\nsalto"');
  });

  it("null/undefined se serializan como campo vacío", () => {
    const csv = toCsv([{ a: null, b: undefined, c: 0 }]);
    expect(csv).toBe("a,b,c\n,,0");
  });

  it("array vacío produce string vacío", () => {
    expect(toCsv([])).toBe("");
  });
});
