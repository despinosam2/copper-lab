import { CopperRow } from './generator';

// A simple parser interface, we will use dynamic import for xlsx (SheetJS) to keep the initial bundle small if possible,
// but the specs mention xlsx is in package.json, so we can import it directly.
import * as XLSX from 'xlsx';

export interface ParseResult {
  success: boolean;
  data?: CopperRow[];
  errors?: string[];
}

// Alias de columnas reconocidas, en minúsculas (el matching ignora mayúsculas
// y espacios). Incluye los nombres del dataset real del curso:
// "Precio", "Dolarindex", "Pindustrial", y la primera columna sin encabezado
// (SheetJS la expone como "__EMPTY"), que suele traer el período.
const PRICE_ALIASES = ['price', 'precio'];
const DATE_ALIASES = ['date', 'fecha', 'periodo', 'período', 'trimestre', 'mes', '__empty'];
const GROWTH_ALIASES = ['globalgrowth', 'growth', 'crecimiento', 'pindustrial', 'actividad'];
const USD_ALIASES = ['usdindex', 'usd', 'dolarindex', 'dólarindex', 'dolar', 'dólar', 'dxy'];

function findValue(row: any, aliases: string[]): unknown {
  for (const key of Object.keys(row)) {
    if (aliases.includes(key.trim().toLowerCase())) return row[key];
  }
  return undefined;
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

/** Formatea la fecha; los períodos numéricos tipo 1986.2 se redondean a un decimal. */
function formatDate(rawDate: unknown, fallbackIndex: number): string {
  if (isEmpty(rawDate)) return `T+${fallbackIndex}`;
  if (typeof rawDate === 'number') return String(Math.round(rawDate * 10) / 10);
  return String(rawDate);
}

export function validateRows(rawRows: any[]): { success: boolean, data?: CopperRow[], errors?: string[] } {
  if (rawRows.length === 0) {
    return { success: false, errors: ['El archivo está vacío.'] };
  }

  const hasPriceColumn = rawRows.some(row => findValue(row, PRICE_ALIASES) !== undefined);
  if (!hasPriceColumn) {
    return { success: false, errors: ['No se encontró una columna de precio (price / precio).'] };
  }

  const parsedRows: CopperRow[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

    const rawPrice = findValue(row, PRICE_ALIASES);
    // Filas con precio vacío se omiten sin rechazar el archivo: los datasets
    // reales suelen traer filas finales de proyección aún sin precio observado.
    if (isEmpty(rawPrice)) continue;

    const price = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice));

    if (isNaN(price)) {
      errors.push(`Fila ${i + 1}: El campo precio no es numérico.`);
      if (errors.length >= 3) break;
      continue;
    }
    if (price <= 0) {
      errors.push(`Fila ${i + 1}: El precio debe ser mayor a cero.`);
      if (errors.length >= 3) break;
      continue;
    }

    const date = formatDate(findValue(row, DATE_ALIASES), parsedRows.length);

    const rawGrowth = findValue(row, GROWTH_ALIASES);
    const globalGrowth = isEmpty(rawGrowth) ? 2.5 : parseFloat(String(rawGrowth));

    const rawUsd = findValue(row, USD_ALIASES);
    const usdIndex = isEmpty(rawUsd) ? 100 : parseFloat(String(rawUsd));

    parsedRows.push({
      date,
      t: parsedRows.length,
      price,
      globalGrowth: isNaN(globalGrowth) ? 2.5 : globalGrowth,
      usdIndex: isNaN(usdIndex) ? 100 : usdIndex
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }
  if (parsedRows.length === 0) {
    return { success: false, errors: ['El archivo no contiene filas con precio válido.'] };
  }

  return { success: true, data: parsedRows };
}

export async function parseFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: null }) as any[];
        
        const validation = validateRows(rawRows);
        resolve(validation);
      } catch (err) {
        resolve({ success: false, errors: ['Error al leer el archivo. Asegúrate de que sea un CSV o Excel válido.'] });
      }
    };

    reader.onerror = () => {
      resolve({ success: false, errors: ['Error al cargar el archivo.'] });
    };

    reader.readAsArrayBuffer(file);
  });
}
