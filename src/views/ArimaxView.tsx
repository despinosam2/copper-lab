import { useMemo, useState } from 'react';
import { CopperRow } from '../data/generator';
import { DetectedColumns } from '../data/parser';
import { useModelParams } from '../state/ModelParams';
import { EXOG_DEFS, buildExogMatrix, activeExogDefs } from '../state/exogDefs';
import { fitArimax } from '../models/arimax';
import { autoTuneArimaxBic } from '../models/arimaxTune';
import { calculateMetrics } from '../models/metrics';
import { Panel } from '../components/Panel';
import { Slider } from '../components/Slider';
import { Chart } from '../components/Chart';
import { Readout } from '../components/Readout';
import { Note } from '../components/Note';

// R03: por defecto todo detectado (dataset sintético siempre trae las 6
// columnas) — sólo difiere cuando App.tsx pasa el detectedColumns real de
// un archivo importado con columnas ausentes.
const ALL_DETECTED: DetectedColumns = { date: true, globalGrowth: true, usdIndex: true, stocks: true, libor: true, partLargas: true };

export function ArimaxView({ data, detectedColumns = ALL_DETECTED }: { data: CopperRow[]; detectedColumns?: DetectedColumns }) {
  const { arimax, setArimax } = useModelParams();
  const { p, d } = arimax;
  const setP = (v: number) => setArimax({ ...arimax, p: v });
  const setD = (v: number) => setArimax({ ...arimax, d: v });

  const [autoTuning, setAutoTuning] = useState(false);
  const [tuneMsg, setTuneMsg] = useState<string | null>(null);
  const handleAutoTune = () => {
    setAutoTuning(true);
    setTuneMsg(null);
    setTimeout(async () => {
      const best = await autoTuneArimaxBic(data);
      if (best) {
        setArimax({ ...arimax, p: best.p, d: best.d, ...best.flags });
        const nVars = Object.values(best.flags).filter(Boolean).length;
        setTuneMsg(`BIC mínimo: p=${best.p}, d=${best.d}, ${nVars} covariable${nVars === 1 ? '' : 's'}.`);
      } else {
        setTuneMsg('Datos insuficientes para comparar los 576 candidatos.');
      }
      setAutoTuning(false);
    }, 0);
  };

  const { chartData, metrics, coefficients, exogCoefficients, activeDefs } = useMemo(() => {
    const y = data.map(r => r.price);
    const exog = buildExogMatrix(data, arimax);
    const activeDefs = activeExogDefs(arimax);

    const model = fitArimax(y, exog, p, d);

    const chartData = data.map((row, i) => ({
      date: row.date,
      Actual: row.price,
      Model: i < p + d ? null : model.fitted[i]
    }));

    const actual = y.slice(p + d);
    const pred = model.fitted.slice(p + d);
    const metrics = calculateMetrics(actual, pred);

    return { chartData, metrics, coefficients: model.coefficients, exogCoefficients: model.exogCoefficients, activeDefs };
  }, [data, arimax, p, d]);

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
            {EXOG_DEFS.map(def => {
              const isDetected = detectedColumns[def.key];
              return (
                <label key={def.flag} className={`flex items-center gap-2 group ${isDetected ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                  <input
                    type="checkbox"
                    checked={arimax[def.flag]}
                    disabled={!isDetected}
                    onChange={e => setArimax({ ...arimax, [def.flag]: e.target.checked })}
                    className="form-checkbox bg-slate-850 border-slate-700 text-patina focus:ring-patina disabled:cursor-not-allowed"
                  />
                  <span className="font-body text-sm text-ink-300 group-hover:text-ink-100 transition-colors">
                    {def.label}
                    {!isDetected && <span className="text-ink-500"> (sin datos — usa un valor constante)</span>}
                  </span>
                </label>
              );
            })}
          </div>

          <button
            onClick={handleAutoTune}
            disabled={autoTuning}
            className="mt-6 w-full px-4 py-2 text-sm font-medium font-body bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-wait text-ink-100 rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina"
          >
            {autoTuning ? 'Calculando…' : 'Autoajustar (BIC)'}
          </button>
          {tuneMsg && <p className="text-patina-light text-xs mt-2 font-mono">{tuneMsg}</p>}
          <p className="text-ink-500 text-xs mt-2 font-body leading-relaxed">
            Prueba las 576 combinaciones de p, d y covariables, y elige la de menor BIC — un criterio
            que penaliza la complejidad. Ojo: el RMSE puro siempre "mejora" al agregar variables;
            el BIC pregunta si la mejora justifica los parámetros extra.
          </p>
        </Panel>

        <Panel title="Coeficientes" eyebrow="ANÁLISIS">
          <div className="flex flex-col gap-2">
            {coefficients.map((coef, idx) => (
              <Readout key={idx} label={`φ${idx + 1}`} value={coef.toFixed(3)} />
            ))}
            {activeDefs.map((def, idx) => (
              exogCoefficients[idx] !== undefined && (
                <Readout
                  key={def.key}
                  label={`β (${def.shortLabel[0].toUpperCase()}${def.shortLabel.slice(1)})`}
                  value={exogCoefficients[idx].toFixed(3)}
                />
              )
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
