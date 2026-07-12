import { useMemo, useState } from 'react';
import { CopperRow } from '../data/generator';
import { useModelParams } from '../state/ModelParams';
import { fitGpr, autoTuneGpr } from '../models/gpr';
import { calculateMetrics } from '../models/metrics';
import { Panel } from '../components/Panel';
import { Slider } from '../components/Slider';
import { Chart } from '../components/Chart';
import { Note } from '../components/Note';
import { fmt } from '../components/format';
import { DownloadCsvButton } from '../components/DownloadCsvButton';

const AUTOTUNE_BOUNDS = {
  lengthScale: [0.01, 0.5] as [number, number],
  signalVariance: [0.1, 5.0] as [number, number],
  noiseVariance: [0.001, 0.5] as [number, number]
};

export function GprView({ data }: { data: CopperRow[] }) {
  const { gpr, setGpr } = useModelParams();
  const { lengthScale, signalVariance, noiseVariance, bandSigma, kernelMode, periodicLengthScale, periodicVariance } = gpr;
  const setLengthScale = (v: number) => setGpr({ ...gpr, lengthScale: v });
  const setSignalVariance = (v: number) => setGpr({ ...gpr, signalVariance: v });
  const setNoiseVariance = (v: number) => setGpr({ ...gpr, noiseVariance: v });
  const setBandSigma = (v: 1 | 2) => setGpr({ ...gpr, bandSigma: v });

  // R20: período de 12 observaciones (ciclo anual del dataset sintético
  // mensual) en unidades del índice temporal normalizado x = i/(n−1).
  const period = 12 / Math.max(data.length - 1, 1);
  const gprParams = {
    lengthScale, signalVariance, noiseVariance,
    kernelMode, period, periodicLengthScale, periodicVariance
  };

  const [autoTuning, setAutoTuning] = useState(false);
  // R17: el autoajuste sobreescribía la configuración del usuario sin
  // posibilidad de volver — y el propio texto del botón invita a "comparar
  // dónde te deja el algoritmo con dónde estabas tú", comparación que se
  // destruía al ejecutarlo. Se guarda la config previa para restaurarla.
  const [preTuneGpr, setPreTuneGpr] = useState<typeof gpr | null>(null);
  const handleAutoTune = () => {
    setAutoTuning(true);
    setPreTuneGpr(gpr);
    // setTimeout(0): deja pintar "Calculando…" antes de iniciar la búsqueda
    // (autoTuneGpr además cede el hilo internamente durante la grilla).
    setTimeout(async () => {
      const y = data.map(r => r.price);
      const x = Array(data.length).fill(0).map((_, i) => i / (data.length > 1 ? data.length - 1 : 1));
      // R20: en modo compuesto, la grilla se extiende a lp y σp² (4 valores
      // por dimensión — ver la resolución de rendimiento en autoTuneGpr).
      const best = await autoTuneGpr(x, y, AUTOTUNE_BOUNDS, 6,
        kernelMode === 'rbf+periodic'
          ? { period, lpBounds: [0.1, 3.0], sp2Bounds: [0.01, 2.0] }
          : undefined);
      setGpr({ ...gpr, ...best });
      setAutoTuning(false);
    }, 0);
  };
  const handleRestore = () => {
    if (preTuneGpr) {
      setGpr(preTuneGpr);
      setPreTuneGpr(null);
    }
  };

  const { chartData, metrics } = useMemo(() => {
    const y = data.map(r => r.price);
    const x = Array(data.length).fill(0).map((_, i) => i / (data.length > 1 ? data.length - 1 : 1));

    const model = fitGpr(x, y, gprParams);

    const chartData = data.map((row, i) => {
      const stdDev = Math.sqrt(Math.max(0, model.variance[i]));
      return {
        date: row.date,
        Actual: row.price,
        Model: model.mean[i],
        Upper: model.mean[i] + bandSigma * stdDev,
        Lower: Math.max(0, model.mean[i] - bandSigma * stdDev) // Ensure no negative prices in band
      };
    });

    const metrics = calculateMetrics(y, model.mean);

    return { chartData, metrics };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, lengthScale, signalVariance, noiseVariance, bandSigma, kernelMode, periodicLengthScale, periodicVariance]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
        <Panel title="Regresión de Proceso Gaussiano (GPR)" eyebrow="GRÁFICO">
          <Chart 
            data={chartData}
            lines={[
              { key: 'Actual', name: 'Observado', color: '#7d8892', strokeWidth: 2, strokeDasharray: '4 4' },
              { key: 'Model', name: 'Modelo (Media)', color: '#e0a274', strokeWidth: 2 }
            ]}
            area={{ keyLower: 'Lower', keyUpper: 'Upper', color: '#4fb3a0', name: `Incertidumbre ±${bandSigma}σ` }}
          />
        </Panel>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Panel title={fmt(metrics.rmse)} eyebrow="RMSE" />
          <Panel title={fmt(metrics.mae)} eyebrow="MAE" />
          <Panel title={metrics.mape === null ? '—' : `${metrics.mape.toFixed(1)}%`} eyebrow="MAPE" />
          <Panel title={fmt(metrics.r2, 4)} eyebrow="R²" />
        </div>

        <Note>
          GPR es un modelo no paramétrico que cuantifica incertidumbre. Baja la Escala de Longitud (l) al mínimo y observa cómo la curva sobreajusta persiguiendo el ruido, mientras la banda se estrecha.
        </Note>

        {/* R14: preset clicable de la nota de arriba. */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setLengthScale(0.01)}
            className="px-3 py-1.5 text-xs font-medium font-body bg-slate-700 hover:bg-slate-600 text-ink-100 rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina"
          >
            Provocar sobreajuste (l=0.01)
          </button>
          <DownloadCsvButton
            filename={`gpr_l${lengthScale.toFixed(2)}.csv`}
            rows={chartData.map((row, i) => ({
              fecha: row.date,
              observado: row.Actual,
              media: row.Model,
              banda_inf: row.Lower,
              banda_sup: row.Upper,
              ...(i === 0 ? { rmse: metrics.rmse, mae: metrics.mae, mape: metrics.mape, r2: metrics.r2 } : {})
            }))}
          />
        </div>
      </div>

      <div className="col-span-1 flex flex-col gap-6">
        <Panel title="Hiperparámetros Kernel RBF" eyebrow="CONTROLES">
          <Slider label="Escala de Longitud (l)" min={0.01} max={0.5} step={0.01} value={lengthScale} onChange={setLengthScale} />
          <Slider label="Varianza Señal (σf²)" min={0.1} max={5.0} step={0.1} value={signalVariance} onChange={setSignalVariance} />
          <Slider label="Varianza Ruido (σn²)" min={0.001} max={0.5} step={0.001} value={noiseVariance} onChange={setNoiseVariance} />

          {/* R20: kernel compuesto opcional — captura la estacionalidad anual
              que el RBF puro no puede representar (hallazgo A6). */}
          <div className="mt-4">
            <p className="font-body text-sm text-ink-300 mb-1.5">Kernel</p>
            <div className="flex gap-2" role="group" aria-label="Modo de kernel">
              {([['rbf', 'RBF'], ['rbf+periodic', 'RBF + periódico']] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setGpr({ ...gpr, kernelMode: mode })}
                  aria-pressed={kernelMode === mode}
                  className={`flex-1 px-3 py-2 rounded-[3px] border font-body text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina ${
                    kernelMode === mode
                      ? 'border-patina text-patina-light bg-patina/10'
                      : 'border-slate-700 text-ink-300 hover:text-ink-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {kernelMode === 'rbf+periodic' && (
              <div className="mt-3">
                <Slider label="Escala periódica (lp)" min={0.1} max={3.0} step={0.05} value={periodicLengthScale} onChange={v => setGpr({ ...gpr, periodicLengthScale: v })} />
                <Slider label="Varianza periódica (σp²)" min={0.01} max={2.0} step={0.01} value={periodicVariance} onChange={v => setGpr({ ...gpr, periodicVariance: v })} />
              </div>
            )}
            <p className="text-ink-500 text-xs mt-2 font-body leading-relaxed">
              {kernelMode === 'rbf+periodic'
                ? 'RBF (tendencia suave) + kernel periódico con período fijo de 12 observaciones — el ciclo anual del dataset sintético mensual. Dos puntos separados exactamente un año se tratan como vecinos aunque estén lejos en el tiempo. Ojo: con datos trimestrales el ciclo anual es de 4 observaciones y este kernel no lo capturará.'
                : 'El RBF puro no puede representar ciclos: la estacionalidad anual del dataset sintético (0.25·sin(2πt/12)) queda estructuralmente fuera de su alcance — prueba el kernel compuesto y compara el RMSE.'}
            </p>
          </div>

          <button
            onClick={handleAutoTune}
            disabled={autoTuning}
            className="mt-6 w-full px-4 py-2 text-sm font-medium font-body bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-wait text-ink-100 rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina"
          >
            {autoTuning ? 'Calculando…' : 'Autoajustar (verosimilitud marginal)'}
          </button>
          {preTuneGpr && !autoTuning && (
            <button
              onClick={handleRestore}
              className="mt-2 w-full px-4 py-1.5 text-xs font-body text-ink-300 hover:text-ink-100 border border-slate-700 hover:border-slate-500 rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina"
            >
              Restaurar mi configuración (l={preTuneGpr.lengthScale.toFixed(2)}, σf²={preTuneGpr.signalVariance.toFixed(1)}, σn²={preTuneGpr.noiseVariance.toFixed(3)})
            </button>
          )}
          <p className="text-ink-500 text-xs mt-2 font-body leading-relaxed">
            Busca los valores de l, σf² y σn² que mejor explican estos datos según el
            criterio estándar de la literatura (máxima verosimilitud marginal), en vez
            de ajustarlos a ojo. Compara dónde los deja el algoritmo con dónde los
            habías dejado tú.
          </p>
        </Panel>

        <Panel title="Banda de incertidumbre" eyebrow="VISUALIZACIÓN">
          <div className="flex gap-2" role="group" aria-label="Ancho de la banda de incertidumbre">
            {([1, 2] as const).map(s => (
              <button
                key={s}
                onClick={() => setBandSigma(s)}
                aria-pressed={bandSigma === s}
                className={`flex-1 px-3 py-2 rounded-[3px] border font-mono text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina ${
                  bandSigma === s
                    ? 'border-patina text-patina-light bg-patina/10'
                    : 'border-slate-700 text-ink-300 hover:text-ink-100'
                }`}
              >
                ±{s}σ ({s === 1 ? '68%' : '95%'})
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-500 font-body mt-3 leading-relaxed">
            La presentación del curso usa ±1σ (68% de cobertura); ±2σ cubre el 95%.
            Es la misma incertidumbre, distinto nivel de confianza.
          </p>
        </Panel>
      </div>
    </div>
  );
}
