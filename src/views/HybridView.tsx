import { useMemo } from 'react';
import { CopperRow } from '../data/generator';
import { useModelParams } from '../state/ModelParams';
import { fitHybrid } from '../models/hybrid';
import { fitArimax } from '../models/arimax'; // to compare
import { calculateMetrics } from '../models/metrics';
import { Panel } from '../components/Panel';
import { Slider } from '../components/Slider';
import { Chart } from '../components/Chart';
import { Readout } from '../components/Readout';
import { Note } from '../components/Note';
import { fmt } from '../components/format';
import { DownloadCsvButton } from '../components/DownloadCsvButton';

export function HybridView({ data }: { data: CopperRow[] }) {
  const { hybrid, setHybrid } = useModelParams();
  const { p, d, lengthScale } = hybrid;
  const setP = (v: number) => setHybrid({ ...hybrid, p: v });
  const setD = (v: number) => setHybrid({ ...hybrid, d: v });
  const setLengthScale = (v: number) => setHybrid({ ...hybrid, lengthScale: v });

  const { chartData, hybridMetrics, arimaxMetrics, improvement } = useMemo(() => {
    const y = data.map(r => r.price);
    // El híbrido no tiene toggles propios: usa siempre las 5 exógenas disponibles
    // (crecimiento, dólar, inventarios, libor, posición especulativa).
    const exog = data.map(r => [r.globalGrowth, r.usdIndex, r.stocks, r.libor, r.partLargas]);

    // Fit isolated ARIMAX for comparison
    const arimaxModel = fitArimax(y, exog, p, d);
    const actualArimax = y.slice(p + d);
    const predArimax = arimaxModel.fitted.slice(p + d);
    const arimaxMetrics = calculateMetrics(actualArimax, predArimax);

    // Fit Hybrid
    const hybridModel = fitHybrid(y, exog, p, d, {
      lengthScale,
      signalVariance: 1.0,
      noiseVariance: 0.05
    });
    
    const chartData = data.map((row, i) => {
      // Show hybrid only for valid predictions
      const isPredicted = i >= p + d;
      const stdDev = Math.sqrt(Math.max(0, hybridModel.variance[i]));
      
      return {
        date: row.date,
        Actual: row.price,
        Model: isPredicted ? hybridModel.fitted[i] : null,
        ArimaxOnly: isPredicted ? hybridModel.arimaxFitted[i] : null, // GPR uses residuals from here
        Upper: isPredicted ? hybridModel.fitted[i] + 2 * stdDev : null,
        Lower: isPredicted ? Math.max(0, hybridModel.fitted[i] - 2 * stdDev) : null,
      };
    });

    const predHybrid = hybridModel.fitted.slice(p + d);
    const hybridMetrics = calculateMetrics(actualArimax, predHybrid);

    // R08: rmse puede ser null cuando p+d >= n (muy pocos datos); antes
    // "mejora 0%" se confundía con "los residuos ya eran ruido".
    const improvement = arimaxMetrics.rmse != null && hybridMetrics.rmse != null && arimaxMetrics.rmse > 0
      ? ((arimaxMetrics.rmse - hybridMetrics.rmse) / arimaxMetrics.rmse) * 100
      : null;

    return { chartData, hybridMetrics, arimaxMetrics, improvement };
  }, [data, p, d, lengthScale]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
        <Panel title="Híbrido: ARIMAX + GPR en Residuos" eyebrow="GRÁFICO">
          <Chart 
            data={chartData}
            lines={[
              { key: 'Actual', name: 'Observado', color: '#7d8892', strokeWidth: 2, strokeDasharray: '4 4' },
              // Violeta: distinguible del gris de "Observado" y del cobre de "Híbrido"
              // (antes casi calcaba el tono del observado y no se distinguía a simple vista).
              { key: 'ArimaxOnly', name: 'ARIMAX Base', color: '#9b8cd6', strokeWidth: 1.5, strokeDasharray: '3 3' },
              { key: 'Model', name: 'Híbrido', color: '#e0a274', strokeWidth: 2 }
            ]}
            area={{ keyLower: 'Lower', keyUpper: 'Upper', color: '#4fb3a0', name: 'Incertidumbre ±2σ' }}
          />
        </Panel>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Panel title={fmt(hybridMetrics.rmse)} eyebrow="RMSE HÍBRIDO" />
          <Panel title={fmt(arimaxMetrics.rmse)} eyebrow="RMSE ARIMAX" />
          <Panel title={improvement === null ? '—' : `${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`} eyebrow="MEJORA (RMSE)" />
          <Panel title={fmt(hybridMetrics.r2, 4)} eyebrow="R² HÍBRIDO" />
        </div>

        <Note>
          Este modelo usa ARIMAX para capturar la estructura lineal y covariables, y luego ajusta un GPR sobre los errores (residuos). Si ARIMAX ya explica casi todo, la mejora del GPR será cercana al 0%.
        </Note>

        {/* R14: preset clicable — l grande ⇒ el GPR de residuos no puede
            capturar estructura fina, la mejora tiende a 0%. */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setLengthScale(0.5)}
            className="px-3 py-1.5 text-xs font-medium font-body bg-slate-700 hover:bg-slate-600 text-ink-100 rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina"
          >
            Buscar mejora ≈ 0% (l=0.5)
          </button>
          <DownloadCsvButton
            filename={`hibrido_p${p}_d${d}_l${lengthScale.toFixed(2)}.csv`}
            rows={chartData.map((row, i) => ({
              fecha: row.date,
              observado: row.Actual,
              arimax_base: row.ArimaxOnly,
              hibrido: row.Model,
              banda_inf: row.Lower,
              banda_sup: row.Upper,
              ...(i === 0 ? { rmse_hibrido: hybridMetrics.rmse, rmse_arimax: arimaxMetrics.rmse, mejora_pct: improvement, r2_hibrido: hybridMetrics.r2 } : {})
            }))}
          />
        </div>
      </div>

      <div className="col-span-1 flex flex-col gap-6">
        <Panel title="Parámetros Combinados" eyebrow="CONTROLES">
          <div className="mb-6">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 mb-4">Etapa Lineal (ARIMAX)</h3>
            <Slider label="Rezagos AR (p)" min={1} max={6} step={1} value={p} onChange={setP} />
            <Slider label="Diferenciación (d)" min={0} max={2} step={1} value={d} onChange={setD} />
          </div>
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 mb-4">Etapa No Lineal (GPR)</h3>
            <Slider label="Escala Longitud (l)" min={0.01} max={0.5} step={0.01} value={lengthScale} onChange={setLengthScale} />
            <p className="text-ink-500 text-xs mt-2 font-body">σf² = 1.0 y σn² = 0.05 fijos para simplificar visualización.</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
