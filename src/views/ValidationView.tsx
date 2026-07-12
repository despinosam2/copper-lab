import { useMemo, useState } from 'react';
import { CopperRow } from '../data/generator';
import { DetectedColumns } from '../data/parser';
import { useModelParams, PredictorId } from '../state/ModelParams';
import { buildExogMatrix, activeExogDefs } from '../state/exogDefs';
import { arimaxForecast, gprForecast, gprOneStepForecast, hybridForecast, ForecastResult } from '../models/forecast';
import { buildMlDataset, reintegrateDeltas, ridgeForecast, knnForecast, forestForecast, ML_FEATURE_DEFS } from '../models/ml';
import { evaluateSplit, walkForwardFolds, walkForwardRmse, testRmse } from '../models/evaluation';
import { autoTuneArimaxBic } from '../models/arimaxTune';
import { autoTuneGpr } from '../models/gpr';
import { Panel } from '../components/Panel';
import { Slider } from '../components/Slider';
import { Chart } from '../components/Chart';
import { Note } from '../components/Note';
import { fmt } from '../components/format';
import { DownloadCsvButton } from '../components/DownloadCsvButton';
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

// R03: por defecto todo detectado (dataset sintético siempre trae las 6
// columnas) — sólo difiere con un archivo importado con columnas ausentes.
const ALL_DETECTED: DetectedColumns = { date: true, globalGrowth: true, usdIndex: true, stocks: true, libor: true, partLargas: true };

export function ValidationView({ data, detectedColumns = ALL_DETECTED }: { data: CopperRow[]; detectedColumns?: DetectedColumns }) {
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
        case 'arimax': {
          // R06: si hay un autoajuste sin fuga (sólo entrenamiento), se usa
          // en vez de la configuración compartida de la pestaña 03.
          const cfg = v.arimaxOverride ?? arimax;
          return arimaxForecast(y, buildExogMatrix(data, cfg), cfg.p, cfg.d, cut);
        }
        case 'gpr': {
          // R06: idem para el GPR sin fuga (pestaña 04 si no hay override).
          // R20: incluye el modo de kernel de la pestaña 04 + period en
          // unidades de x (12 observaciones, mismo denominador n−1 que R09).
          const cfg = {
            ...(v.gprOverride ?? { lengthScale: gpr.lengthScale, signalVariance: gpr.signalVariance, noiseVariance: gpr.noiseVariance, kernelMode: gpr.kernelMode, periodicLengthScale: gpr.periodicLengthScale, periodicVariance: gpr.periodicVariance }),
            period: 12 / Math.max(n - 1, 1)
          };
          return v.gprMode === 'extrapolate'
            ? gprForecast(y, cfg, cut, gpr.bandSigma)
            : gprOneStepForecast(y, cfg, cut, gpr.bandSigma);
        }
        case 'hybrid': {
          const exog = data.map(r => [r.globalGrowth, r.usdIndex, r.stocks, r.libor, r.partLargas]);
          return hybridForecast(y, exog, hybrid.p, hybrid.d, { lengthScale: hybrid.lengthScale, signalVariance: 1.0, noiseVariance: 0.05 }, cut);
        }
        case 'ridge':
        case 'knn':
        case 'forest': {
          const ds = buildMlDataset(data, v.mlLags, undefined, v.mlDiff);
          let fitted =
            id === 'ridge' ? ridgeForecast(ds, n, cut, v.ridgeLambda)
            : id === 'knn' ? knnForecast(ds, n, cut, v.knnK)
            : forestForecast(ds, n, cut, v.forestTrees, v.forestDepth);
          if (v.mlDiff) fitted = reintegrateDeltas(fitted, y);
          return { fitted };
        }
      }
    };
  }, [y, data, n, arima, arimax, gpr, hybrid, v.gprMode, v.mlLags, v.mlDiff, v.ridgeLambda, v.knnK, v.forestTrees, v.forestDepth, v.arimaxOverride, v.gprOverride]);

  // ---- R06: autoajuste SIN FUGA (sólo con el tramo de entrenamiento) ----
  // A diferencia de los botones de "Autoajustar" de las pestañas 03/04 (que
  // siempre ven la serie completa — la fuga de selección que motivó esta
  // recomendación), estos re-ajustan usando sólo data.slice(0, trainEnd) y
  // escriben en v.arimaxOverride/v.gprOverride, no en arimax/gpr del
  // contexto — las pestañas 03/04 no se ven afectadas por este botón.
  const [noLeakTuning, setNoLeakTuning] = useState(false);
  const [noLeakMsg, setNoLeakMsg] = useState<string | null>(null);

  const handleNoLeakArimaxTune = () => {
    setNoLeakTuning(true);
    setNoLeakMsg(null);
    setTimeout(async () => {
      const best = await autoTuneArimaxBic(data.slice(0, trainEnd));
      if (best) {
        set({ arimaxOverride: { p: best.p, d: best.d, ...best.flags } });
        const nVars = Object.values(best.flags).filter(Boolean).length;
        setNoLeakMsg(`BIC mínimo (sólo entrenamiento): p=${best.p}, d=${best.d}, ${nVars} covariable${nVars === 1 ? '' : 's'}.`);
      } else {
        setNoLeakMsg('Datos insuficientes en el tramo de entrenamiento para comparar los 576 candidatos.');
      }
      setNoLeakTuning(false);
    }, 0);
  };

  const GPR_NO_LEAK_BOUNDS = {
    lengthScale: [0.01, 0.5] as [number, number],
    signalVariance: [0.1, 5.0] as [number, number],
    noiseVariance: [0.001, 0.5] as [number, number]
  };

  const handleNoLeakGprTune = () => {
    setNoLeakTuning(true);
    setNoLeakMsg(null);
    setTimeout(async () => {
      // Mismo criterio de normalización que forecast.ts tras R09: x = i/(n-1)
      // con n = largo de la serie COMPLETA, no del tramo de entrenamiento.
      const denom = Math.max(n - 1, 1);
      const xTrain = Array(trainEnd).fill(0).map((_, i) => i / denom);
      const yTrain = y.slice(0, trainEnd);
      // R20: si la pestaña 04 está en modo compuesto, el autoajuste sin fuga
      // también busca lp y σp² (mismos rangos que el botón de la pestaña 04).
      const best = await autoTuneGpr(xTrain, yTrain, GPR_NO_LEAK_BOUNDS, 6,
        gpr.kernelMode === 'rbf+periodic'
          ? { period: 12 / denom, lpBounds: [0.1, 3.0], sp2Bounds: [0.01, 2.0] }
          : undefined);
      set({ gprOverride: best });
      setNoLeakMsg(`l=${best.lengthScale.toFixed(3)} · σf²=${best.signalVariance.toFixed(2)} · σn²=${best.noiseVariance.toFixed(3)} (sólo entrenamiento).`);
      setNoLeakTuning(false);
    }, 0);
  };

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

  // R16: etiqueta de configuración por modelo — se captura en el momento de
  // correr la validación (no en vivo), para que la tabla sea trazable aunque
  // el usuario cambie sliders después. Mismo patrón de string que la columna
  // "Configuración" del Comparador (pestaña 06).
  const configLabel = (id: PredictorId): string => {
    switch (id) {
      case 'arima':
        return `p=${arima.p} · d=${arima.d}`;
      case 'arimax': {
        const cfg = v.arimaxOverride ?? arimax;
        const covars = activeExogDefs(cfg).map(def => def.shortLabel);
        return `p=${cfg.p} · d=${cfg.d}${covars.length > 0 ? ' · ' + covars.join(', ') : ' · sin covariables'}${v.arimaxOverride ? ' · sin fuga' : ''}`;
      }
      case 'gpr': {
        const cfg = v.gprOverride ?? gpr;
        return `l=${cfg.lengthScale.toFixed(2)} · σn²=${cfg.noiseVariance.toFixed(3)} · ${v.gprMode === 'extrapolate' ? 'extrapolación' : 'un paso'}${v.gprOverride ? ' · sin fuga' : ''}`;
      }
      case 'hybrid':
        return `p=${hybrid.p} · d=${hybrid.d} · l=${hybrid.lengthScale.toFixed(2)}`;
      case 'ridge':
        return `λ=${v.ridgeLambda.toFixed(2)} · ${v.mlLags} rezago(s)${v.mlDiff ? ' · Δprecio' : ''}`;
      case 'knn':
        return `k=${v.knnK} · ${v.mlLags} rezago(s)${v.mlDiff ? ' · Δprecio' : ''}`;
      case 'forest':
        return `${v.forestTrees} árboles · prof=${v.forestDepth} · ${v.mlLags} rezago(s)${v.mlDiff ? ' · Δprecio' : ''}`;
    }
  };

  // ---- Validación cruzada walk-forward (asíncrona, con cesión de hilo) ----
  const [cvRunning, setCvRunning] = useState(false);
  const [cvResults, setCvResults] = useState<{ id: PredictorId; config: string; mean: number | null; std: number | null; perFold: (number | null)[] }[] | null>(null);
  // R16 (hallazgo A9): folds solicitados vs realmente usados — antes la
  // reducción era silenciosa (el spec decía "se informa" y no se informaba).
  const [cvFolds, setCvFolds] = useState<{ requested: number; used: number } | null>(null);

  const runWalkForward = (ids: PredictorId[]) => {
    setCvRunning(true);
    setCvResults(null);
    setCvFolds(null);
    setTimeout(async () => {
      const folds = walkForwardFolds(n, v.folds, v.trainPct / 100);
      setCvFolds({ requested: v.folds, used: folds.length });
      if (folds.length === 0) {
        setCvResults([]);
        setCvRunning(false);
        return;
      }
      const out: { id: PredictorId; config: string; mean: number | null; std: number | null; perFold: (number | null)[] }[] = [];
      for (const id of ids) {
        const r = await walkForwardRmse(y, folds, cut => runModel(id, cut).fitted);
        out.push({ id, config: configLabel(id), ...r });
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
      // La ablación debe compararse contra el MISMO conjunto base de
      // covariables que usa el modelo: para ARIMAX, sólo las activas en su
      // pestaña; para Híbrido y los ML, siempre las cinco.
      const ablatable = v.model === 'arimax'
        ? activeExogDefs(arimax).map(d => ({ key: d.key, label: d.shortLabel }))
        : ML_FEATURE_DEFS.map(d => ({ key: d.key, label: d.label }));
      const out: { name: string; delta: number }[] = [];
      for (const def of ablatable) {
        let fitted: (number | null)[];
        if (v.model === 'ridge' || v.model === 'knn' || v.model === 'forest') {
          const ds = buildMlDataset(data, v.mlLags, def.label, v.mlDiff);
          fitted =
            v.model === 'ridge' ? ridgeForecast(ds, n, trainEnd, v.ridgeLambda)
            : v.model === 'knn' ? knnForecast(ds, n, trainEnd, v.knnK)
            : forestForecast(ds, n, trainEnd, v.forestTrees, v.forestDepth);
          if (v.mlDiff) fitted = reintegrateDeltas(fitted, y);
        }
        else if (v.model === 'hybrid') {
          const exog = data.map(r => ML_FEATURE_DEFS.filter(f => f.key !== def.key).map(f => r[f.key]));
          fitted = hybridForecast(y, exog, hybrid.p, hybrid.d, { lengthScale: hybrid.lengthScale, signalVariance: 1.0, noiseVariance: 0.05 }, trainEnd).fitted;
        } else {
          // ARIMAX: conjunto activo menos la covariable ablacionada
          const kept = activeExogDefs(arimax).filter(f => f.key !== def.key);
          const exog = data.map(r => kept.map(f => r[f.key]));
          fitted = arimaxForecast(y, exog, arimax.p, arimax.d, trainEnd).fitted;
        }
        const rmse = testRmse(y, fitted, trainEnd);
        // R03: el nombre de VISUALIZACIÓN se anota si la covariable fue
        // rellenada por defecto; def.label en sí no se toca porque también
        // se usa como clave de exclusión en buildMlDataset (líneas arriba).
        const displayName = detectedColumns[def.key] ? def.label : `${def.label} (sin datos)`;
        if (base !== null && rmse !== null) out.push({ name: displayName, delta: rmse - base });
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
      {/* R05: el aviso de "datos insuficientes" ahora vive en App.tsx,
          visible en cualquier pestaña (antes sólo aparecía aquí). */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
          <Panel title={`Predicción out-of-sample · ${MODEL_LABELS[v.model]}`} eyebrow="VALIDACIÓN">
            <Chart
              data={chartData}
              lines={[
                { key: 'Observado', name: 'Observado', color: '#7d8892', strokeWidth: 2, strokeDasharray: '4 4' },
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
            Una degradación <strong>negativa</strong> también es posible y no es un error: significa que el tramo de prueba
            resultó más fácil (menos volátil) que el de entrenamiento.
            Prueba: pon el GPR con escala de longitud mínima en su pestaña y mira qué pasa aquí. Para replicar el estudio
            del curso, importa el Excel en la barra de datos.
          </Note>

          {/* R18: serie graficada (entrenamiento/prueba) + métricas del split
              en la primera fila. */}
          <DownloadCsvButton
            filename={`prediccion_${v.model}_${v.trainPct}pct.csv`}
            rows={chartData.map((row, i) => ({
              fecha: row.date,
              observado: row.Observado,
              ajuste_entrenamiento: row.Entrenamiento,
              prediccion_prueba: row.Prueba,
              ...(i === 0 ? {
                rmse_entrenamiento: evalResult.train?.rmse ?? null,
                rmse_prueba: evalResult.test?.rmse ?? null,
                degradacion_pct: evalResult.degradationPct,
                r2_prueba: evalResult.test?.r2 ?? null
              } : {})
            }))}
          />
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

            {v.model === 'gpr' && (
              <div className="mt-4">
                <p className="font-body text-sm text-ink-300 mb-1.5">Modo de pronóstico GPR</p>
                <div className="flex gap-2" role="group" aria-label="Modo de pronóstico del GPR">
                  {([['onestep', 'Un paso'], ['extrapolate', 'Extrapolación']] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => set({ gprMode: mode })}
                      aria-pressed={v.gprMode === mode}
                      className={`flex-1 px-3 py-2 rounded-[3px] border font-body text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina ${
                        v.gprMode === mode
                          ? 'border-patina text-patina-light bg-patina/10'
                          : 'border-slate-700 text-ink-300 hover:text-ink-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-ink-500 text-xs mt-2 font-body leading-relaxed">
                  <strong>Un paso</strong> re-entrena con cada dato nuevo — comparable con los demás modelos.{' '}
                  <strong>Extrapolación</strong> predice todo el tramo de prueba de una vez: la media revierte a la
                  histórica y la banda se ensancha (honesto, pero espera métricas mucho peores — no es un bug, es
                  lo que significa extrapolar sin información).
                </p>
              </div>
            )}

            {!isMl && (
              <p className="text-ink-500 text-xs mt-3 font-body leading-relaxed">
                Los modelos del curso usan la configuración que dejaste en su propia pestaña (p, d, covariables,
                hiperparámetros) — igual que el Comparador.
              </p>
            )}

            {/* R06: autoajuste SIN FUGA — sólo ve el tramo de entrenamiento,
                a diferencia de los botones de las pestañas 03/04. */}
            {(v.model === 'arimax' || v.model === 'gpr') && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <button
                  onClick={v.model === 'arimax' ? handleNoLeakArimaxTune : handleNoLeakGprTune}
                  disabled={noLeakTuning}
                  className="w-full px-4 py-2 text-sm font-medium font-body bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-wait text-ink-100 rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina"
                >
                  {noLeakTuning ? 'Calculando…' : 'Autoajustar sin fuga (sólo entrenamiento)'}
                </button>
                {noLeakMsg && <p className="text-patina-light text-xs mt-2 font-mono">{noLeakMsg}</p>}
                {((v.model === 'arimax' && v.arimaxOverride) || (v.model === 'gpr' && v.gprOverride)) && (
                  <button
                    onClick={() => set(v.model === 'arimax' ? { arimaxOverride: undefined } : { gprOverride: undefined })}
                    className="mt-2 text-xs font-body text-ink-500 hover:text-ink-300 underline"
                  >
                    Usar la configuración de la pestaña {v.model === 'arimax' ? '03' : '04'} en vez de esta
                  </button>
                )}
                <p className="text-ink-500 text-xs mt-2 font-body leading-relaxed">
                  A diferencia del botón "Autoajustar" de la pestaña {v.model === 'arimax' ? '03' : '04'} (que ve
                  toda la serie), este re-ajusta usando <strong>sólo</strong> los datos de entrenamiento — el
                  tramo de prueba nunca influye en la elección de la configuración. Es la forma honesta de
                  autoajustar cuando el objetivo es evaluar out-of-sample.
                </p>
              </div>
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
                <label className="mt-4 flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={v.mlDiff}
                    onChange={e => set({ mlDiff: e.target.checked })}
                    className="form-checkbox bg-slate-850 border-slate-700 text-patina focus:ring-patina"
                  />
                  <span className="font-body text-sm text-ink-300 group-hover:text-ink-100 transition-colors">
                    Diferenciar (predecir Δprecio)
                  </span>
                </label>
                <p className="text-ink-500 text-xs mt-1.5 font-body leading-relaxed">
                  Árboles y vecinos no pueden extrapolar: nunca predicen sobre el máximo visto en
                  entrenamiento, y con una serie con tendencia colapsan. Prediciendo el <em>cambio</em> y
                  reintegrando, ese techo desaparece — la misma idea que la "d" de ARIMA.
                </p>
                <p className="text-ink-500 text-xs mt-3 font-body leading-relaxed">
                  Características: {v.mlLags} rezago(s) del precio + las 5 covariables del dataset del curso
                  (crecimiento, dólar, inventarios, libor, posición especulativa).
                </p>
                <p className="text-copper-light text-xs mt-3 font-body leading-relaxed">
                  <strong>Ojo:</strong> si mueves estos controles mirando el RMSE de <strong>prueba</strong> hasta
                  que baje, el conjunto de prueba deja de ser una prueba honesta — es sobreajuste manual al test,
                  el mismo vicio que esta pestaña existe para enseñar a evitar.
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
                  <div className="mt-4 h-44" role="img" aria-label="Importancia de variables por ablación: cuánto empeora el RMSE de prueba al quitar cada covariable">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={importance} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                        <XAxis type="number" tick={{ fill: '#7d8892', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickFormatter={(val: number) => val.toFixed(2)} stroke="#28313b" />
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

        {cvResults && cvResults.length === 0 && (
          <p className="mt-4 text-sm text-ink-300 font-body">
            Datos insuficientes para el walk-forward con este % de entrenamiento: baja el % o usa una serie más larga.
          </p>
        )}
        {/* R16 (A9): informar la reducción de folds — antes era silenciosa. */}
        {cvFolds && cvFolds.used > 0 && cvFolds.used < cvFolds.requested && (
          <p className="mt-4 text-xs text-copper-light font-body">
            Solicitaste {cvFolds.requested} folds; con estos datos se usan {cvFolds.used} (los bloques de
            prueba de menos de 2 observaciones se descartan).
          </p>
        )}
        {cvResults && cvResults.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-slate-700 text-ink-300 text-left">
                  <th className="pb-2 font-medium">Modelo</th>
                  <th className="pb-2 font-medium">Configuración</th>
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
                    <td className="py-2 font-mono text-xs text-ink-300">{r.config}</td>
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
            <div className="mt-3">
              <DownloadCsvButton
                filename="walkforward_ranking.csv"
                rows={cvResults.map(r => ({
                  modelo: MODEL_LABELS[r.id],
                  configuracion: r.config,
                  ...Object.fromEntries(r.perFold.map((f, i) => [`fold_${i + 1}`, f])),
                  rmse_medio: r.mean,
                  desviacion: r.std
                }))}
              />
            </div>
          </div>
        )}

        <p className="text-ink-500 text-xs mt-3 font-body leading-relaxed">
          Los folds dividen el tramo posterior al % de entrenamiento elegido: cada uno entrena con todo lo anterior a su
          bloque de prueba y predice el bloque siguiente (origen rodante, ventana expansiva) — el k-fold barajado clásico
          es inválido en series de tiempo. La desviación σ entre folds mide la <strong>estabilidad</strong>: un modelo que
          gana en un corte y pierde en otro no es un ganador confiable.
        </p>
      </Panel>
    </div>
  );
}
