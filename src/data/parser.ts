import { CopperRow } from './generator';

// A simple parser interface, we will use dynamic import for xlsx (SheetJS) to keep the initial bundle small if possible,
// but the specs mention xlsx is in package.json, so we can import it directly.
import * as XLSX from 'xlsx';

/**
 * R03: qué columnas de covariables se detectaron realmente en el archivo,
 * a diferencia de las que se rellenaron con el valor por defecto (2.5,
 * 100, 4, 100, 0.7) porque la columna no existía. Sin esto, un estudiante
 * puede "activar" o "medir importancia" sobre una covariable inventada sin
 * ninguna señal en la UI. No cubre el caso de una columna presente pero con
 * celdas vacías sólo en algunas filas (limitación conocida, fuera de
 * alcance de esta tarea).
 */
export interface DetectedColumns {
  date: boolean;
  globalGrowth: boolean;
  usdIndex: boolean;
  stocks: boolean;
  libor: boolean;
  partLargas: boolean;
}

export interface ParseResult {
  success: boolean;
  data?: CopperRow[];
  errors?: string[];
  detectedColumns?: DetectedColumns;
}

// Alias de columnas reconocidas, en minúsculas y sin espacios/guiones bajos
// (el matching normaliza ambos lados). Incluye los nombres del dataset real
// del curso: "Precio", "Dolarindex", "Pindustrial", "Stocks", "Libor",
// "PartLargas", y la primera columna sin encabezado (SheetJS la expone como
// "__EMPTY"), que suele traer el período.
const PRICE_ALIASES = ['price', 'precio'];
const DATE_ALIASES = ['date', 'fecha', 'periodo', 'período', 'trimestre', 'mes', '__empty'];
const GROWTH_ALIASES = ['globalgrowth', 'growth', 'crecimiento', 'pindustrial', 'actividad'];
const USD_ALIASES = ['usdindex', 'usd', 'dolarindex', 'dólarindex', 'dolar', 'dólar', 'dxy'];
const STOCKS_ALIASES = ['stocks', 'inventario', 'inventarios', 'inventory'];
const LIBOR_ALIASES = ['libor', 'tasalibor', 'indicelibor'];
const PART_LARGAS_ALIASES = ['partlargas', 'posicionespeculativa', 'netlong', 'speculativepositioning'];

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function findValue(row: any, aliases: string[]): unknown {
  const normAliases = aliases.map(normalize);
  for (const key of Object.keys(row)) {
    if (normAliases.includes(normalize(key))) return row[key];
  }
  return undefined;
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

/**
 * R02 (bug B1): parsea números respetando el formato decimal local, en vez
 * de parseFloat, que trunca en silencio en la coma decimal ("4,23" → 4) y
 * acepta basura al final ("4.23abc" → 4.23). Usa Number() al final, que
 * devuelve NaN ante cualquier resto no numérico — así ambos problemas se
 * cierran a la vez.
 *
 * Regla: si hay coma y punto, el separador que aparece MÁS A LA DERECHA es
 * el decimal. Si sólo hay coma, se asume separador de miles cuando TODOS
 * los grupos después del primero tienen exactamente 3 dígitos (ambiguo con
 * pocos grupos, ver 09 EXECUTION BLUEPRINT §0-D-C); si no, la ÚLTIMA coma
 * es el separador decimal.
 */
function parseLocaleNumber(raw: string): number {
  const s = raw.trim();
  if (/^-?\d+$/.test(s)) return Number(s);

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    const normalized =
      lastComma > lastDot
        ? s.replace(/\./g, '').replace(',', '.') // coma decimal, punto de miles
        : s.replace(/,/g, ''); // punto decimal, coma de miles
    return Number(normalized);
  }

  if (hasComma) {
    const groups = s.split(',');
    const afterFirst = groups.slice(1);
    const allThreeDigitGroups = afterFirst.length > 0 && afterFirst.every(g => /^\d{3}$/.test(g));
    if (allThreeDigitGroups) {
      return Number(groups.join(''));
    }
    // Última coma = separador decimal; se quitan las comas anteriores (de miles).
    const lastComma = s.lastIndexOf(',');
    const normalized = s.slice(0, lastComma).replace(/,/g, '') + '.' + s.slice(lastComma + 1);
    return Number(normalized);
  }

  return Number(s); // sólo punto, o ni coma ni punto: comportamiento estándar
}

/**
 * R02 (hallazgo adicional, descubierto al implementar el fix de B1): sin
 * esto, un CSV real en es-CL/es-ES (';' como separador de campo, ',' como
 * decimal — el formato que exportan Excel/Numbers en esa configuración
 * regional) ni siquiera separa columnas correctamente: SheetJS asume ','
 * como separador salvo que se le indique lo contrario.
 *
 * Heurística: si el archivo es texto plano (no un binario real de Excel) y
 * su primera línea tiene más ';' que ',', se asume separador ';'. Los
 * binarios reales (.xlsx = ZIP, .xls = OLE2) tienen bytes nulos muy al
 * inicio y nunca entran a esta rama — verificado contra el Excel del curso.
 */
export function sniffCsvFieldSeparator(bytes: Uint8Array): ';' | undefined {
  const head = bytes.slice(0, 8);
  for (const b of head) {
    if (b === 0) return undefined; // binario (ZIP/OLE2 empiezan con NUL)
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 2000));
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons > commas ? ';' : undefined;
}

/** Formatea la fecha; los períodos numéricos tipo 1986.2 se redondean a un decimal. */
function formatDate(rawDate: unknown, fallbackIndex: number): string {
  if (isEmpty(rawDate)) return `T+${fallbackIndex}`;
  if (typeof rawDate === 'number') return String(Math.round(rawDate * 10) / 10);
  return String(rawDate);
}

// R05: techo superior de filas. El walk-forward del GPR (pestaña 07) es
// síncrono y ~O(n³); verificado en la auditoría que a n=400 ya tarda 2.4s
// congelando el navegador. 2000 es conservador (deja margen amplio sobre el
// peor caso medido) — ver 09 EXECUTION BLUEPRINT §0-D-I para el contexto de
// esta cifra.
const MAX_ROWS = 2000;

export function validateRows(rawRows: any[]): ParseResult {
  if (rawRows.length === 0) {
    return { success: false, errors: ['El archivo está vacío.'] };
  }

  if (rawRows.length > MAX_ROWS) {
    return {
      success: false,
      errors: [`El archivo tiene ${rawRows.length} filas; el máximo soportado es ${MAX_ROWS}. Agrega los datos a una frecuencia menor (ej. mensual o trimestral) y vuelve a intentar.`]
    };
  }

  const hasPriceColumn = rawRows.some(row => findValue(row, PRICE_ALIASES) !== undefined);
  if (!hasPriceColumn) {
    return { success: false, errors: ['No se encontró una columna de precio (price / precio).'] };
  }

  // R03: se detecta por columna, no por fila — una columna "existe" si
  // aparece con algún valor en al menos una fila del archivo.
  const detectedColumns: DetectedColumns = {
    date: rawRows.some(row => findValue(row, DATE_ALIASES) !== undefined),
    globalGrowth: rawRows.some(row => findValue(row, GROWTH_ALIASES) !== undefined),
    usdIndex: rawRows.some(row => findValue(row, USD_ALIASES) !== undefined),
    stocks: rawRows.some(row => findValue(row, STOCKS_ALIASES) !== undefined),
    libor: rawRows.some(row => findValue(row, LIBOR_ALIASES) !== undefined),
    partLargas: rawRows.some(row => findValue(row, PART_LARGAS_ALIASES) !== undefined)
  };

  const parsedRows: CopperRow[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

    const rawPrice = findValue(row, PRICE_ALIASES);
    // Filas con precio vacío se omiten sin rechazar el archivo: los datasets
    // reales suelen traer filas finales de proyección aún sin precio observado.
    if (isEmpty(rawPrice)) continue;

    const price = typeof rawPrice === 'number' ? rawPrice : parseLocaleNumber(String(rawPrice));

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
    const globalGrowth = isEmpty(rawGrowth) ? 2.5 : parseLocaleNumber(String(rawGrowth));

    const rawUsd = findValue(row, USD_ALIASES);
    const usdIndex = isEmpty(rawUsd) ? 100 : parseLocaleNumber(String(rawUsd));

    const rawStocks = findValue(row, STOCKS_ALIASES);
    const stocks = isEmpty(rawStocks) ? 4 : parseLocaleNumber(String(rawStocks));

    const rawLibor = findValue(row, LIBOR_ALIASES);
    const libor = isEmpty(rawLibor) ? 100 : parseLocaleNumber(String(rawLibor));

    const rawPartLargas = findValue(row, PART_LARGAS_ALIASES);
    const partLargas = isEmpty(rawPartLargas) ? 0.7 : parseLocaleNumber(String(rawPartLargas));

    parsedRows.push({
      date,
      t: parsedRows.length,
      price,
      globalGrowth: isNaN(globalGrowth) ? 2.5 : globalGrowth,
      usdIndex: isNaN(usdIndex) ? 100 : usdIndex,
      stocks: isNaN(stocks) ? 4 : stocks,
      libor: isNaN(libor) ? 100 : libor,
      partLargas: isNaN(partLargas) ? 0.7 : partLargas
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }
  if (parsedRows.length === 0) {
    return { success: false, errors: ['El archivo no contiene filas con precio válido.'] };
  }

  return { success: true, data: parsedRows, detectedColumns };
}

export async function parseFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const fieldSeparator = sniffCsvFieldSeparator(data);
        const workbook = XLSX.read(data, { type: 'array', ...(fieldSeparator ? { FS: fieldSeparator } : {}) });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON. raw:false devuelve el texto formateado de cada
        // celda en vez del valor JS auto-coercido: sin esto, SheetJS asume
        // que la coma es separador de miles y "4,23" se convierte en el
        // número 423 antes de llegar a parseLocaleNumber (verificado contra
        // el Excel del curso: no afecta la columna de fecha ni el precio,
        // sólo evita la coerción prematura de comas decimales).
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: false }) as any[];
        
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
