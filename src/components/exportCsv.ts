// R18 (09 EXECUTION BLUEPRINT, hallazgo C5) — Exportación a CSV sin
// dependencias nuevas. Los estudiantes escriben informes con los números de
// la app; antes los transcribían a mano desde pantalla.

/**
 * Serializa filas homogéneas a un string CSV (RFC 4180: comillas dobles
 * escapadas duplicándolas; campos con coma/comilla/salto de línea van entre
 * comillas). Separado de la descarga para poder testearlo en node.
 */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const s = String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

/** Dispara la descarga de un CSV en el navegador (Blob + enlace temporal). */
export function downloadCsv(rows: Record<string, unknown>[], filename: string): void {
  // BOM UTF-8 para que Excel (es) abra las tildes correctamente.
  const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
