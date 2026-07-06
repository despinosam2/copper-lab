import { useMemo } from 'react';
import { CopperRow } from '../data/generator';
import { useModelParams } from '../state/ModelParams';
import { fitArimax } from '../models/arimax';
import { calculateMetrics } from '../models/metrics';
import { Panel } from '../components/Panel';
import { Slider } from '../components/Slider';
import { Chart } from '../components/Chart';
import { Readout } from '../components/Readout';
import { Note } from '../components/Note';

export function ArimaxView({ data }: { data: CopperRow[] }) {
  const { arimax, setArimax } = useModelParams();
  const { p, d, useGrowth, useUsd } = arimax;
  const setP = (v: number) => setArimax({ ...arimax, p: v });
  const setD = (v: number) => setArimax({ ...arimax, d: v });
  const setUseGrowth = (v: boolean) => setArimax({ ...arimax, useGrowth: v });
  const setUseUsd = (v: boolean) => setArimax({ ...arimax, useUsd: v });

  const { chartData, metrics, coefficients, exogCoefficients } = useMemo(() => {
    const y = data.map(r => r.price);
    
    // Build exog matrix
    const exog = data.map(r => {
      const row = [];
      if (useGrowth) row.push(r.globalGrowth);
      if (useUsd) row.push(r.usdIndex);
      return row;
    });

    const model = fitArimax(y, exog, p, d);
    
    const chartData = data.map((row, i) => ({
      date: row.date,
      Actual: row.price,
      Model: i < p + d ? null : model.fitted[i]
    }));

    const actual = y.slice(p + d);
    const pred = model.fitted.slice(p + d);
    const metrics = calculateMetrics(actual, pred);

    return { chartData, metrics, coefficients: model.coefficients, exogCoefficients: model.exogCoefficients };
  }, [data, p, d, useGrowth, useUsd]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
        <Panel title="Ajuste ARIMAX" eyebrow="GRÁFICO">
          <Chart 
            data={chartData}
            lines={[
              { key: 'Actual', name: 'Observado', color: '#78838d', strokeWidth: 2, strokeDasharray: '4 4' },
              { key: 'Model', name: 'Modelo', color: '#e0a274', strokeWidth: 2 }
            ]}
          />
        </Panel>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Panel title={metrics.rmse.toFixed(3)} eyebrow="RMSE" />
          <Panel title={metrics.mae.toFixed(3)} eyebrow="MAE" />
          <Panel title={metrics.mape.toFixed(1) + '%'} eyebrow="MAPE" />
          <Panel title={metrics.r2.toFixed(4)} eyebrow="R²" />
        </div>

        <Note>
          ARIMAX añade covariables al modelo base. Apaga todas las covariables (debería verse idéntico a ARIMA). Luego enciéndelas y observa el cambio en el error para evaluar si aportan información.
        </Note>
      </div>

      <div className="col-span-1 flex flex-col gap-6">
        <Panel title="Hiperparámetros & Exógenas" eyebrow="CONTROLES">
          <Slider label="Rezagos AR (p)" min={1} max={6} step={1} value={p} onChange={setP} />
          <Slider label="Diferenciación (d)" min={0} max={2} step={1} value={d} onChange={setD} />
          
          <div className="mt-6 flex flex-col gap-3">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={useGrowth} onChange={e => setUseGrowth(e.target.checked)} className="form-checkbox bg-slate-850 border-slate-700 text-patina focus:ring-patina" />
              <span className="font-body text-sm text-ink-300 group-hover:text-ink-100 transition-colors">Incluir Crecimiento Global</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={useUsd} onChange={e => setUseUsd(e.target.checked)} className="form-checkbox bg-slate-850 border-slate-700 text-patina focus:ring-patina" />
              <span className="font-body text-sm text-ink-300 group-hover:text-ink-100 transition-colors">Incluir Índice Dólar</span>
            </label>
          </div>
        </Panel>

        <Panel title="Coeficientes" eyebrow="ANÁLISIS">
          <div className="flex flex-col gap-2">
            {coefficients.map((coef, idx) => (
              <Readout key={idx} label={`φ${idx + 1}`} value={coef.toFixed(3)} />
            ))}
            {useGrowth && exogCoefficients[0] !== undefined && (
              <Readout label="β (Crecimiento)" value={exogCoefficients[0].toFixed(3)} />
            )}
            {useUsd && exogCoefficients[useGrowth ? 1 : 0] !== undefined && (
              <Readout label="β (Dólar)" value={exogCoefficients[useGrowth ? 1 : 0].toFixed(3)} />
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
