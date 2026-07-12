import { useMemo } from 'react';
import { CopperRow } from '../data/generator';
import { useModelParams } from '../state/ModelParams';
import { fitArima } from '../models/arima';
import { calculateMetrics } from '../models/metrics';
import { Panel } from '../components/Panel';
import { Slider } from '../components/Slider';
import { Chart } from '../components/Chart';
import { Readout } from '../components/Readout';
import { Note } from '../components/Note';
import { fmt } from '../components/format';
import { ResidualsPanel } from '../components/ResidualsPanel';

export function ArimaView({ data }: { data: CopperRow[] }) {
  const { arima, setArima } = useModelParams();
  const { p, d } = arima;
  const setP = (v: number) => setArima({ ...arima, p: v });
  const setD = (v: number) => setArima({ ...arima, d: v });

  const { chartData, metrics, coefficients, residuals } = useMemo(() => {
    const y = data.map(r => r.price);
    const model = fitArima(y, p, d);

    // For ARIMA, fitted starts at p+d. We keep original y for history.
    const chartData = data.map((row, i) => ({
      date: row.date,
      Actual: row.price,
      Model: i < p + d ? null : model.fitted[i] // show null or prediction
    }));

    // Calculate metrics only on the predicted part
    const actual = y.slice(p + d);
    const pred = model.fitted.slice(p + d);
    const metrics = calculateMetrics(actual, pred);
    // R11: residuos sólo del tramo predicho (mismo tramo que las métricas).
    const residuals = actual.map((v, i) => v - pred[i]);

    return { chartData, metrics, coefficients: model.coefficients, residuals };
  }, [data, p, d]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
        <Panel title="Ajuste ARIMA(p, d, 0)" eyebrow="GRÁFICO">
          <Chart 
            data={chartData}
            lines={[
              { key: 'Actual', name: 'Observado', color: '#78838d', strokeWidth: 2, strokeDasharray: '4 4' },
              { key: 'Model', name: 'Modelo', color: '#e0a274', strokeWidth: 2 }
            ]}
          />
        </Panel>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Panel title={fmt(metrics.rmse)} eyebrow="RMSE" />
          <Panel title={fmt(metrics.mae)} eyebrow="MAE" />
          <Panel title={metrics.mape === null ? '—' : `${metrics.mape.toFixed(1)}%`} eyebrow="MAPE" />
          <Panel title={fmt(metrics.r2, 4)} eyebrow="R²" />
        </div>

        <Note>
          El modelo ARIMA ajusta la serie usando sólo su propio pasado. Experimenta fijando p=2 y comparando d=0 vs d=1; observa cómo diferenciar mejora el ajuste de una serie con tendencia.
        </Note>

        <ResidualsPanel residuals={residuals} />
      </div>

      <div className="col-span-1 flex flex-col gap-6">
        <Panel title="Hiperparámetros" eyebrow="CONTROLES">
          <Slider label="Rezagos AR (p)" min={1} max={6} step={1} value={p} onChange={setP} />
          <Slider label="Diferenciación (d)" min={0} max={2} step={1} value={d} onChange={setD} />
        </Panel>

        <Panel title="Coeficientes AR" eyebrow="ANÁLISIS">
          <div className="flex flex-col gap-2">
            {coefficients.map((coef, idx) => (
              <Readout key={idx} label={`φ${idx + 1}`} value={coef.toFixed(3)} />
            ))}
            {coefficients.length === 0 && <span className="text-ink-500 text-sm">Ajustando...</span>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
