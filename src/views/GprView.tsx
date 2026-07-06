import { useMemo } from 'react';
import { CopperRow } from '../data/generator';
import { useModelParams } from '../state/ModelParams';
import { fitGpr } from '../models/gpr';
import { calculateMetrics } from '../models/metrics';
import { Panel } from '../components/Panel';
import { Slider } from '../components/Slider';
import { Chart } from '../components/Chart';
import { Note } from '../components/Note';

export function GprView({ data }: { data: CopperRow[] }) {
  const { gpr, setGpr } = useModelParams();
  const { lengthScale, signalVariance, noiseVariance } = gpr;
  const setLengthScale = (v: number) => setGpr({ ...gpr, lengthScale: v });
  const setSignalVariance = (v: number) => setGpr({ ...gpr, signalVariance: v });
  const setNoiseVariance = (v: number) => setGpr({ ...gpr, noiseVariance: v });

  const { chartData, metrics } = useMemo(() => {
    const y = data.map(r => r.price);
    const x = Array(data.length).fill(0).map((_, i) => i / (data.length > 1 ? data.length - 1 : 1));
    
    const model = fitGpr(x, y, { lengthScale, signalVariance, noiseVariance });
    
    const chartData = data.map((row, i) => {
      const stdDev = Math.sqrt(Math.max(0, model.variance[i]));
      return {
        date: row.date,
        Actual: row.price,
        Model: model.mean[i],
        Upper: model.mean[i] + 2 * stdDev,
        Lower: Math.max(0, model.mean[i] - 2 * stdDev) // Ensure no negative prices in band
      };
    });

    const metrics = calculateMetrics(y, model.mean);

    return { chartData, metrics };
  }, [data, lengthScale, signalVariance, noiseVariance]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
        <Panel title="Regresión de Proceso Gaussiano (GPR)" eyebrow="GRÁFICO">
          <Chart 
            data={chartData}
            lines={[
              { key: 'Actual', name: 'Observado', color: '#78838d', strokeWidth: 2, strokeDasharray: '4 4' },
              { key: 'Model', name: 'Modelo (Media)', color: '#e0a274', strokeWidth: 2 }
            ]}
            area={{ keyLower: 'Lower', keyUpper: 'Upper', color: '#4fb3a0', name: 'Incertidumbre ±2σ' }}
          />
        </Panel>

        <div className="grid grid-cols-3 gap-4">
          <Panel title={metrics.rmse.toFixed(3)} eyebrow="RMSE" />
          <Panel title={metrics.mae.toFixed(3)} eyebrow="MAE" />
          <Panel title={metrics.mape.toFixed(1) + '%'} eyebrow="MAPE" />
        </div>

        <Note>
          GPR es un modelo no paramétrico que cuantifica incertidumbre. Baja la Escala de Longitud (l) al mínimo y observa cómo la curva sobreajusta persiguiendo el ruido, mientras la banda se estrecha.
        </Note>
      </div>

      <div className="col-span-1 flex flex-col gap-6">
        <Panel title="Hiperparámetros Kernel RBF" eyebrow="CONTROLES">
          <Slider label="Escala de Longitud (l)" min={0.01} max={0.5} step={0.01} value={lengthScale} onChange={setLengthScale} />
          <Slider label="Varianza Señal (σf²)" min={0.1} max={5.0} step={0.1} value={signalVariance} onChange={setSignalVariance} />
          <Slider label="Varianza Ruido (σn²)" min={0.001} max={0.5} step={0.001} value={noiseVariance} onChange={setNoiseVariance} />
        </Panel>
      </div>
    </div>
  );
}
