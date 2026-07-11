import { useMemo, useState } from 'react';
import { CopperRow } from '../data/generator';
import { useModelParams, PredictorId } from '../state/ModelParams';
import { buildExogMatrix } from '../state/exogDefs';
import { arimaxForecast, gprForecast, hybridForecast, ForecastResult } from '../models/forecast';
import { buildMlDataset, ridgeForecast, knnForecast, forestForecast, ML_FEATURE_DEFS } from '../models/ml';
import { evaluateSplit, walkForwardFolds, walkForwardRmse, testRmse } from '../models/evaluation';
import { Panel } from '../components/Panel';
import { Slider } from '../components/Slider';
import { Chart } from '../components/Chart';
import { Note } from '../components/Note';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const MODEL_LABELS: Record<PredictorId, string> = {
  arima: 'ARIMA',
  arimax: 'ARIMAX',
  gpr: 'GPR',
  hybrid: 'Híbrido',
  ridge: 'Ridge (lineal regularizado)',
  knn: 'k-NN (vecinos más cercanos)',
  forest: 'Bosque aleatorio'
};

const fmt = (v: number | null | undefined, digits = 3) =>
  v === null || v === undefined || !isFinite(v) ? '—' : v.toFixed(digits);

export function ValidationView({ data }: { data: CopperRow[] }) {
  const { validation, setValidation, arima, arimax, gpr, hybrid } = useModelParams();
  const v = validation;
  const set = (patch: Partial<typeof v>) => setValidation({ ...v, ...patch });

  const n = data.length;
  const trainEnd = Math.max(3, Math.round((n * v.trainPct) / 100));
  const y = useMemo(() => data.map(r => r.price), [data]);

  // Ejecuta un modelo con la configuración compartida (los clásicos usan los
  // parámetros de sus propias pestañas, misma regla que el Comparador).
  const runModel = useMemo(() => {
    return (id: PredictorId, cut: number): ForecastResult => {
      switch (id) {
        case 'arima':
          return arimaxForecast(y, [], arima.p, arima.d, cut);
        case 'arimax':
          return arimaxForecast(y, buildExogMatrix(data, arimax), arimax.p, arimax.d, cut);
        case 'gpr':
          return gprForecast(y, { lengthScale: gpr.lengthScale, signalVariance: gpr.signalVariance, noiseVariance: gpr.noiseVariance }, cut, gpr.bandSigma);
        case 'hybrid': {
          const exog = data.map(r => [r.globalGrowth, r.usdIndex, r.stocks, r.libor, r.partLargas]);
          return hybridForecast(y, exog, hybrid.p, hybrid.d, { lengthScale: hybrid.lengthScale, signalVariance: 1.0, noiseVariance: 0.05 }, cut);
        }
        case 'ridge':
          return { fitted: ridgeForecast(buildMlDataset(data, v.mlLags), n, cut, v.ridgeLambda) };
        case 'knn':
          return { fitted: knnForecast(buildMlDataset(data, v.mlLags), n, cut, v.knnK) };
        case 'forest':
          return { fitted: forestForecast(buildMlDataset(data, v.mlLags), n, cut, v.forestTrees, v.forestDepth) };
      }
    };
  }, [y, data, n, arima, arimax, gpr, hybrid, v.mlLags, v.ridgeLambda, v.knnK, v.forestTrees, v.forestDepth]);

  // ---- Ajuste principal del modelo seleccionado ----
  const { chartData, evalResult, hasBand } = useMemo(() => {
    const result = runModel(v.model, trainEnd);
    const evalResult = evaluateSplit(y, result.fitted, trainEnd);
    const hasBand = Boolean(result.bandLo && result.bandHi);
    const chartData = data.map((row, i) => ({
      date: row.date,
      Observado: row.price,
      Entrenamiento: i < trainEnd ? result.fitted[i] : null,
      Prueba: i >= trainEnd - 1 ? result.fitted[i] : null,
      Upper: hasBand ? result.bandHi![i] : null,
      Lower: hasBand ? result.bandLo![i] : null
    }));
    return { chartData, evalResult, hasBand };
  }, [runModel, v.model, trainEnd, y, data]);

  // ---- Validación cruzada walk-forward (asíncrona, con cesión de hilo) ----
  const [cvRunning, setCvRunning] = useState(false);
  const [cvResults, setCvResults] = useState<{ id: PredictorId; mean: number | null; std: number | null; perFold: (number | null)[] }[] | null>(null);

  const runWalkForward = (ids: PredictorId[]) => {
    setCvRunning(true);
    setCvResults(null);
    setTimeout(async () => {
      const folds = walkForwardFolds(n, v.folds);
      const out: { id: PredictorId; mean: number | null; std: number | null; perFold: (number | null)[] }[] = [];
      for (const id of ids) {
        const r = walkForwardRmse(y, folds, cut => runModel(id, cut).fitted);
        out.push({ id, ...r });
        await new Promise(res => setTimeout(res, 0)); // ceder el hilo entre modelos
      }
      out.sort((a, b) => (a.mean ?? Infinity) - (b.mean ?? Infinity));
      setCvResults(out);
      setCvRunning(false);
    }, 0);
  };

  // ---- Importancia de variables por ablación ----
  const supportsImportance = v.model === 'arimax' || v.model === 'hybrid' || v.model === 'ridge' || v.model === 'knn' || v.model === 'forest';
  const [impRunning, setImpRunning] = useState(false);
  const [importance, setImportance] = useState<{ name: string; delta: number }[] | null>(null);

  const runImportance = () => {
    setImpRunning(true);
    setImportance(null);
    setTimeout(async () => {
      const base = testRmse(y, runModel(v.model, trainEnd).fitted, trainEnd);
      const out: { name: string; delta: number }[] = [];
      for (const def of ML_FEATURE_DEFS) {
        let fitted: (number | null)[];
        if (v.model === 'ridge') fitted = ridgeForecast(buildMlDataset(data, v.mlLags, def.label), n, trainEnd, v.ridgeLambda);
        else if (v.model === 'knn') fitted = knnForecast(buildMlDataset(data, v.mlLags, def.label), n, trainEnd, v.knnK);
        else if (v.model === 'forest') fitted = forestForecast(buildMlDataset(data, v.mlLags, def.label), n, trainEnd, v.forestTrees, v.forestDepth);
        else {
          // ARIMAX / Híbrido: quitar la covariable de la matriz de exógenas
          const exog = data.map(r =>
            ML_FEATURE_DEFS.filter(f => f.key !== def.key).map(f => r[f.key])
          );
          fitted = v.model === 'hybrid'
            ? hybridForecast(y, exog, hybrid.p, hybrid.d, { lengthScale: hybrid.lengthScale, signalVariance: 1.0, noiseVariance: 0.05 }, trainEnd).fitted
            : arimaxForecast(y, exog, arimax.p, arimax.d, trainEnd).fitted;
        }
        const rmse = testRmse(y, fitted, trainEnd);
        if (base !== null && rmse !== null) out.push({ name: def.label, delta: rmse - base });
        await new Promise(res => setTimeout(res, 0));
      }
      out.sort((a, b) => b.delta - a.delta);
      setImportance(out);
      setImpRunning(false);
    }, 0);
  };

  const isMl = v.model === 'ridge' || v.model === 'knn' || v.model === 'forest';
  const cutDate = data[Math.min(trainEnd, n - 1)]?.date;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
          <Panel title={`Predicción out-of-sample · ${MODEL_LABELS[v.model]}`} eyebrow="VALIDACIÓN">
            <Chart
              data={chartData}
              lines={[
                { key: 'Observado', name: 'Observado', color: '#78838d', strokeWidth: 2, strokeDasharray: '4 4' },
                { key: 'Entrenamiento', name: 'Ajuste (entrenamiento)', color: '#79d4c2', strokeWidth: 1.5 },
                { key: 'Prueba', name: 'Predicción (prueba)', color: '#e0a274', strokeWidth: 2.5 }
              ]}
              area={hasBand ? { keyLower: 'Lower', keyUpper: 'Upper', color: '#4fb3a0', name: 'Incertidumbre' } : undefined}
              referenceX={cutDate}
            />
            <p className="text-ink-500 text-xs mt-2 font-body">
              La línea vertical marca el corte: a la izquierda el modelo aprende; a la derecha predice datos que nunca vio
              (un paso adelante, con historia real y covariables observadas).
            </p>
          </Panel>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Panel title={fmt(evalResult.train?.rmse)} eyebrow="RMSE ENTREN." />
            <Panel title={fmt(evalResult.test?.rmse)} eyebrow="RMSE PRUEBA" />
            <Panel
              title={evalResult.degradationPct === null ? '—' : `${evalResult.degradationPct >= 0 ? '+' : ''}${evalResult.degradationPct.toFixed(0)}%`}
              eyebrow="DEGRADACIÓN"
            />
            <Panel title={fmt(evalResult.test?.r2, 3)} eyebrow="R² PRUEBA" />
          </div>

          <Note>
            El corte es temporal, nunca aleatorio: barajar dejaría al modelo "viendo el futuro".
            La <strong>degradación</strong> (cuánto peor es el error en datos no vistos) es la medida honesta de un modelo
            predictivo — un RMSE bajísimo de entrenamiento con degradación enorme es la firma del sobreajuste.
            Prueba: pon el GPR con escala de longitud mínima en su pestaña y mira qué pasa aquí. Para replicar el estudio
            del curso, importa el Excel en la barra de datos.
          </Note>
        </div>

        <div className="col-span-1 flex flex-col gap-6">
          <Panel title="Configuración" eyebrow="CONTROLES">
            <div className="mb-4">
              <label htmlFor="model-select" className="font-body text-sm text-ink-300 block mb-1.5">Modelo</label>
              <select
                id="model-select"
                value={v.model}
                onChange={e => set({ model: e.target.value as PredictorId })}
                className="w-full bg-slate-850 border border-slate-700 rounded-[3px] px-3 py-2 text-sm text-ink-100 font-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina"
              >
                <optgroup label="Modelos del curso">
                  <option value="arima">ARIMA</option>
                  <option value="arimax">ARIMAX</option>
                  <option value="gpr">GPR</option>
                  <option value="hybrid">Híbrido (ARIMAX + GPR)</option>
                </optgroup>
                <optgroup label="ML avanzado (v2)">
                  <option value="ridge">Ridge (lineal regularizado)</option>
                  <option value="knn">k-NN (vecinos más cercanos)</option>
                  <option value="forest">Bosque aleatorio</option>
                </optgroup>
              </select>
            </div>

            <Slider label="% de entrenamiento" min={50} max={90} step={5} value={v.trainPct} onChange={val => set({ trainPct: val })} />

            {!isMl && (
              <p className="text-ink-500 text-xs mt-3 font-body leading-relaxed">
                Los modelos del curso usan la configuración que dejaste en su propia pestaña (p, d, covariables,
                hiperparámetros) — igual que el Comparador.
              </p>
            )}

            {isMl && (
              <div className="mt-4">
                <Slider label="Rezagos de precio (features)" min={1} max={6} step={1} value={v.mlLags} onChange={val => set({ mlLags: val })} />
                {v.model === 'ridge' && (
                  <Slider label="Regularización (λ)" min={0.01} max={5} step={0.01} value={v.ridgeLambda} onChange={val => set({ ridgeLambda: val })} />
                )}
                {v.model === 'knn' && (
                  <Slider label="Vecinos (k)" min={1} max={15} step={1} value={v.knnK} onChange={val => set({ knnK: val })} />
                )}
                {v.model === 'forest' && (
                  <>
                    <Slider label="Árboles" min={10} max={100} step={10} value={v.forestTrees} onChange={val => set({ forestTrees: val })} />
                    <Slider label="Profundidad máxima" min={2} max={8} step={1} value={v.forestDepth} onChange={val => set({ forestDepth: val })} />
                  </>
                )}
                <p className="text-ink-500 text-xs mt-3 font-body leading-relaxed">
                  Características: {v.mlLags} rezago(s) del precio + las 5 covariables del dataset del curso
                  (crecimiento, dólar, inventarios, libor, posición especulativa).
                </p>
              </div>
            )}
          </Panel>

          <Panel title="Importancia de variables" eyebrow="ABLACIÓN">
            {supportsImportance ? (
              <>
                <button
                  onClick={runImportance}
                  disabled={impRunning}
                  className="w-full px-4 py-2 text-sm font-medium font-body bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-wait text-ink-100 rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina"
                >
                  {impRunning ? 'Calculando…' : 'Medir importancia (quitar de a una)'}
                </button>
                {importance && (
                  <div className="mt-4 h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={importance} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                        <XAxis type="number" tick={{ fill: '#78838d', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickFormatter={(val: number) => val.toFixed(2)} stroke="#28313b" />
                        <YAxis type="category" dataKey="name" width={90} tick={{ fill: '#aab4bd', fontSize: 10, fontFamily: 'IBM Plex Mono' }} stroke="#28313b" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#171c22', border: '1px solid #28313b', borderRadius: '3px', color: '#e8ecef', fontFamily: 'IBM Plex Mono', fontSize: 12 }}
                          labelStyle={{ color: '#e8ecef' }}
                          itemStyle={{ color: '#e8ecef' }}
                          formatter={(val: number) => [`${val >= 0 ? '+' : ''}${val.toFixed(3)} RMSE`, 'Δ al quitarla']}
                          cursor={{ fill: 'rgba(121, 212, 194, 0.06)' }}
                        />
                        <Bar dataKey="delta" isAnimationActive={false} radius={[0, 2, 2, 0]}>
                          {importance.map(item => (
                            <Cell key={item.name} fill={item.delta >= 0 ? '#e0a274' : '#4fb3a0'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="text-ink-500 text-xs mt-3 font-body leading-relaxed">
                  Re-ajusta el modelo sin cada covariable y mide cuánto empeora el RMSE de <strong>prueba</strong>.
                  Barra cobre = quitar la variable empeora la predicción (aporta). Barra pátina = no aporta, o incluso estorba.
                  Ojo con covariables correlacionadas: si una sustituye a otra, la importancia individual puede subestimarse.
                </p>
              </>
            ) : (
              <p className="text-ink-500 text-sm font-body leading-relaxed">
                {v.model === 'arima'
                  ? 'ARIMA no usa covariables: no hay variables que ablacionar.'
                  : 'El GPR de la app es univariado (sólo el índice temporal): no hay covariables que ablacionar.'}
              </p>
            )}
          </Panel>
        </div>
      </div>

      <Panel title="Validación cruzada walk-forward" eyebrow="ROLLING ORIGIN">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="w-full sm:w-56">
            <Slider label="Folds" min={3} max={6} step={1} value={v.folds} onChange={val => set({ folds: val })} />
          </div>
          <button
            onClick={() => runWalkForward([v.model])}
            disabled={cvRunning}
            className="px-4 py-2 text-sm font-medium font-body bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-wait text-ink-100 rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina"
          >
            {cvRunning ? 'Calculando…' : `Validar ${MODEL_LABELS[v.model]}`}
          </button>
          <button
            onClick={() => runWalkForward(['arima', 'arimax', 'gpr', 'hybrid', 'ridge', 'knn', 'forest'])}
            disabled={cvRunning}
            className="px-4 py-2 text-sm font-medium font-body bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-wait text-ink-100 rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina"
          >
            {cvRunning ? 'Calculando…' : 'Validar los 7 modelos'}
          </button>
        </div>

        {cvResults && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-slate-700 text-ink-300 text-left">
                  <th className="pb-2 font-medium">Modelo</th>
                  {cvResults[0].perFold.map((_, i) => (
                    <th key={i} className="pb-2 font-medium text-right">Fold {i + 1}</th>
                  ))}
                  <th className="pb-2 font-medium text-right">RMSE medio ± σ</th>
                </tr>
              </thead>
              <tbody>
                {cvResults.map((r, idx) => (
                  <tr key={r.id} className={`border-b border-slate-700/50 ${idx === 0 ? 'bg-patina/10' : ''}`}>
                    <td className="py-2 text-ink-100">
                      {idx === 0 && <span className="w-2 h-2 rounded-full bg-patina inline-block mr-2"></span>}
                      {MODEL_LABELS[r.id]}
                    </td>
                    {r.perFold.map((f, i) => (
                      <td key={i} className="py-2 text-right font-mono text-ink-300">{fmt(f)}</td>
                    ))}
                    <td className={`py-2 text-right font-mono ${idx === 0 ? 'text-patina font-semibold' : 'text-ink-100'}`}>
                      {fmt(r.mean)} ± {fmt(r.std)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-ink-500 text-xs mt-3 font-body leading-relaxed">
          Cada fold entrena con todo lo anterior a su bloque de prueba y predice el bloque siguiente (origen rodante,
          ventana expansiva) — el k-fold barajado clásico es inválido en series de tiempo. La desviación σ entre folds
          mide la <strong>estabilidad</strong>: un modelo que gana en un corte y pierde en otro no es un ganador confiable.
        </p>
      </Panel>
    </div>
  );
}
