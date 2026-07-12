import { useState, useMemo, useCallback } from 'react';
import { generateSyntheticData, CopperRow } from './generator';
import { parseFile, DetectedColumns } from './parser';

// R03: el dataset sintético siempre tiene las 6 columnas por construcción
// (generator.ts las genera todas), así que se reportan como "detectadas".
const SYNTHETIC_DETECTED_COLUMNS: DetectedColumns = {
  date: true,
  globalGrowth: true,
  usdIndex: true,
  stocks: true,
  libor: true,
  partLargas: true
};

// R19: seed/noise iniciales opcionales (vienen de un enlace compartido).
export function useDataset(initialSeed = 42, initialNoise = 0.1) {
  const [seed, setSeed] = useState(initialSeed);
  const [noise, setNoise] = useState(initialNoise);
  const [importedData, setImportedData] = useState<CopperRow[] | null>(null);
  const [detectedColumns, setDetectedColumns] = useState<DetectedColumns>(SYNTHETIC_DETECTED_COLUMNS);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const syntheticData = useMemo(() => generateSyntheticData(seed, noise), [seed, noise]);

  const activeData = importedData ?? syntheticData;
  const isImported = importedData !== null;

  const handleImport = useCallback(async (file: File) => {
    setErrorMsg(null);
    const result = await parseFile(file);
    if (result.success && result.data) {
      setImportedData(result.data);
      setDetectedColumns(result.detectedColumns ?? SYNTHETIC_DETECTED_COLUMNS);
    } else if (result.errors) {
      setErrorMsg(result.errors.join('\n'));
    }
  }, []);

  const clearImport = useCallback(() => {
    setImportedData(null);
    setDetectedColumns(SYNTHETIC_DETECTED_COLUMNS);
    setErrorMsg(null);
  }, []);

  return {
    data: activeData,
    isImported,
    detectedColumns,
    seed,
    setSeed,
    noise,
    setNoise,
    handleImport,
    clearImport,
    errorMsg,
    clearError: () => setErrorMsg(null)
  };
}
