import { useState, useMemo, useCallback } from 'react';
import { generateSyntheticData, CopperRow } from './generator';
import { parseFile } from './parser';

export function useDataset() {
  const [seed, setSeed] = useState(42);
  const [noise, setNoise] = useState(0.1);
  const [importedData, setImportedData] = useState<CopperRow[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const syntheticData = useMemo(() => generateSyntheticData(seed, noise), [seed, noise]);

  const activeData = importedData ?? syntheticData;
  const isImported = importedData !== null;

  const handleImport = useCallback(async (file: File) => {
    setErrorMsg(null);
    const result = await parseFile(file);
    if (result.success && result.data) {
      setImportedData(result.data);
    } else if (result.errors) {
      setErrorMsg(result.errors.join('\n'));
    }
  }, []);

  const clearImport = useCallback(() => {
    setImportedData(null);
    setErrorMsg(null);
  }, []);

  return {
    data: activeData,
    isImported,
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
