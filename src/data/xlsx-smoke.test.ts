// R04-T4 (09 EXECUTION BLUEPRINT) — Smoke test de la nueva versión de xlsx
// (0.20.3, cdn.sheetjs.com — reemplaza 0.18.5 con 2 CVEs high).
//
// parseFile() usa FileReader (API de navegador, no disponible en el entorno
// 'node' de Vitest), así que este test ejercita directamente XLSX.read /
// XLSX.utils.sheet_to_json — las mismas funciones que parseFile usa por
// debajo — para confirmar que la superficie de la librería no cambió.

import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { validateRows } from "./parser";

describe("xlsx 0.20.3 — lectura de un workbook real", () => {
  it("XLSX.read + sheet_to_json + validateRows funcionan de punta a punta", () => {
    const worksheet = XLSX.utils.json_to_sheet([
      { price: 4.5, date: "2024-01", growth: 2.6, usd: 101 },
      { price: 4.6, date: "2024-02", growth: 2.7, usd: 102 },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    // Simula el ciclo real: escribir a buffer binario, releer con XLSX.read
    // (idéntico a lo que hace parseFile con el ArrayBuffer del archivo subido).
    const buf = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const reread = XLSX.read(buf, { type: "array" });
    const rawRows = XLSX.utils.sheet_to_json(
      reread.Sheets[reread.SheetNames[0]],
      { defval: null },
    ) as any[];

    const result = validateRows(rawRows);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data![0].price).toBeCloseTo(4.5);
    expect(result.data![1].usdIndex).toBeCloseTo(102);
  });
});
