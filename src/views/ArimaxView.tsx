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
import { fmt } from '../components/format';
import { ResidualsPanel } from '../components/ResidualsPanel';
import { DownloadCsvButton } from '../components/DownloadCsvButton';
import { Term } from '../components/Term';
import { standardErrors, tStatistics } from '../models/diagnostics';

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
  // R17: guardar la configuración previa al autoajuste para poder volver
  // (antes, un clic destruía el trabajo del usuario sin deshacer).
  const [preTuneArimax, setPreTuneArimax] = useState<typeof arimax | null>(null);
  const handleAutoTune = () => {
    setAutoTuning(true);
    setTuneMsg(null);
    setPreTuneArimax(arimax);
    setTimeout(async () => {
      const best = await autoTuneArimaxBic(data);
      if (best) {
        setArimax({ ...arimax, p: best.p, d: best.d, ...best.flags });
        const nVars = Object.values(best.flags).filter(Boolean).length;
        setTuneMsg(`BIC mínimo: p=${best.p}, d=${best.d}, ${nVars} covariable${nVars === 1 ? '' : 's'}.`);
      } else {
        setTuneMsg('Datos insuficientes para comparar los 576 candidatos.');
        setPreTuneArimax(null); // no hubo cambio que deshacer
      }
      setAutoTuning(false);
    }, 0);
  };
  const handleRestore = () => {
    if (preTuneArimax) {
      setArimax(preTuneArimax);
      setPreTuneArimax(null);
      setTuneMsg(null);
    }
  };

  const { chartData, metrics, coefficients, exogCoefficients, activeDefs, residuals, se, t } = useMemo(() => {
    const y = data.map(r => r.price);
    const exog = buildExogMatrix(data, arimax);
    const activeDefs = activeExogDefs(arimax);

    const model = fitArimax(y, exog, p, d, arimax.diffExog);

    const chartData = data.map((row, i) => ({
      date: row.date,
      Actual: row.price,
      Model: i < p + d ? null : model.fitted[i]
    }));

    const actual = y.slice(p + d);
    const pred = model.fitted.slice(p + d);
    const metrics = calculateMetrics(actual, pred);
    // R11: residuos sólo del tramo predicho (mismo tramo que las métricas).
    const residuals = actual.map((v, i) => v - pred[i]);

    // R12: SE/t sobre el espacio de estimación real (designMatrix/diffResiduals
    // de fitArimax) — no sobre `residuals` de arriba, que está en otro espacio
    // (reintegrado al nivel del precio) y en otro tramo.
    const k = 1 + model.coefficients.length + model.exogCoefficients.length;
    const beta = [model.intercept, ...model.coefficients, ...model.exogCoefficients];
    const se = model.designMatrix.length > k
      ? standardErrors(model.designMatrix, model.diffResiduals, k)
      : Array(k).fill(0);
    const t = tStatistics(beta, se);

    return { chartData, metrics, coefficients: model.coefficients, exogCoefficients: model.exogCoefficients, activeDefs, residuals, se, t };
  }, [data, arimax, p, d]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
        <Panel title="Ajuste ARIMAX" eyebrow="GRÁFICO">
          <Chart 
            data={chartData}
            lines={[
              { key: 'Actual', name: 'Observado', color: '#7d8892', strokeWidth: 2, strokeDasharray: '4 4' },
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
          ARIMAX añade covariables al modelo base. Apaga todas las covariables (debería verse idéntico a ARIMA). Luego enciéndelas y observa el cambio en el error para evaluar si aportan información.
        </Note>

        <DownloadCsvButton
          filename={`arimax_p${p}_d${d}.csv`}
          rows={chartData.map((row, i) => ({
            fecha: row.date,
            observado: row.Actual,
            modelo: row.Model,
            ...(i === 0 ? { rmse: metrics.rmse, mae: metrics.mae, mape: metrics.mape, r2: metrics.r2 } : {})
          }))}
        />

        <ResidualsPanel residuals={residuals} />
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

          {/* R22 (hallazgo A4): con d≥1 el modelo regresa Δᵈy; dejar las
              exógenas en NIVELES mezcla objetivo diferenciado con regresores
              posiblemente no estacionarios. El toggle las diferencia junto
              con la serie. Apagado por defecto: los números dorados del
              manual no cambian sin acción explícita. */}
          <label className={`mt-4 flex items-center gap-2 group ${d >= 1 ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
            <input
              type="checkbox"
              checked={arimax.diffExog}
              disabled={d < 1}
              onChange={e => setArimax({ ...arimax, diffExog: e.target.checked })}
              className="form-checkbox bg-slate-850 border-slate-700 text-patina focus:ring-patina disabled:cursor-not-allowed"
            />
            <span className="font-body text-sm text-ink-300 group-hover:text-ink-100 transition-colors">
              Diferenciar exógenas con la serie (ΔᵈX)
            </span>
          </label>
          <p className="text-ink-500 text-xs mt-1.5 font-body leading-relaxed">
            {d >= 1
              ? 'Con d≥1 el modelo explica el CAMBIO del precio; dejar el dólar o el libor en niveles mezcla un objetivo diferenciado con regresores posiblemente no estacionarios (riesgo de relación espuria) y hace extraña la lectura del β. Diferenciarlas iguala los espacios: Δprecio explicado por Δdólar.'
              : 'Sólo aplica con d≥1 (con d=0 el objetivo ya está en niveles, igual que las exógenas).'}
          </p>

          <button
            onClick={handleAutoTune}
            disabled={autoTuning}
            className="mt-6 w-full px-4 py-2 text-sm font-medium font-body bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-wait text-ink-100 rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina"
          >
            {autoTuning ? 'Calculando…' : 'Autoajustar (BIC)'}
          </button>
          {tuneMsg && <p className="text-patina-light text-xs mt-2 font-mono">{tuneMsg}</p>}
          {preTuneArimax && !autoTuning && (
            <button
              onClick={handleRestore}
              className="mt-2 w-full px-4 py-1.5 text-xs font-body text-ink-300 hover:text-ink-100 border border-slate-700 hover:border-slate-500 rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina"
            >
              Restaurar mi configuración (p={preTuneArimax.p}, d={preTuneArimax.d}, {activeExogDefs(preTuneArimax).length} covariable{activeExogDefs(preTuneArimax).length === 1 ? '' : 's'})
            </button>
          )}
          <p className="text-ink-500 text-xs mt-2 font-body leading-relaxed">
            Prueba las 576 combinaciones de p, d y covariables, y elige la de menor{' '}
            <Term def="Criterio de información bayesiano: mide el ajuste penalizando el número de parámetros. Comparar BICs pregunta si la mejora del ajuste justifica la complejidad extra — el RMSE puro nunca hace esa pregunta.">BIC</Term>
            {' '}— un criterio que penaliza la complejidad. Ojo: el RMSE puro siempre "mejora" al agregar variables;
            el BIC pregunta si la mejora justifica los parámetros extra.
          </p>
        </Panel>

        <Panel title="Coeficientes" eyebrow="ANÁLISIS">
          <div className="flex flex-col gap-2 mb-3">
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

          {/* R12: errores estándar y t-stat — mismo orden que se/t: [intercepto, φ1..φp, β1..βN]. */}
          <table className="w-full text-left font-body text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-ink-500">
                <th className="pb-2 font-medium">Coef.</th>
                <th className="pb-2 font-medium text-right">SE</th>
                <th className="pb-2 font-medium text-right">t</th>
              </tr>
            </thead>
            <tbody>
              {coefficients.map((_, idx) => (
                <tr key={`phi-${idx}`} className="border-b border-slate-800/50">
                  <td className="py-1.5 text-ink-300 font-mono">φ{idx + 1}</td>
                  <td className="py-1.5 text-right font-mono text-ink-100">{fmt(se[1 + idx])}</td>
                  <td className="py-1.5 text-right font-mono text-ink-100">{fmt(t[1 + idx], 2)}</td>
                </tr>
              ))}
              {activeDefs.map((def, idx) => (
                exogCoefficients[idx] !== undefined && (
                  <tr key={def.key} className="border-b border-slate-800/50">
                    <td className="py-1.5 text-ink-300 font-mono">β ({def.shortLabel})</td>
                    <td className="py-1.5 text-right font-mono text-ink-100">{fmt(se[1 + coefficients.length + idx])}</td>
                    <td className="py-1.5 text-right font-mono text-ink-100">{fmt(t[1 + coefficients.length + idx], 2)}</td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
          <p className="text-ink-500 text-xs mt-3 font-body leading-relaxed">
            Debido a que el modelo incorpora una estructura AR(1), los errores estándar OLS pueden no ser
            consistentes en presencia de autocorrelación serial. En este proyecto se mantienen los errores
            estándar clásicos para preservar la simplicidad y consistencia de la implementación. En
            consecuencia, los coeficientes estimados se utilizan principalmente con fines predictivos e
            interpretativos, mientras que las pruebas de significancia estadística deben interpretarse con
            cautela. En trabajos futuros podría emplearse un estimador robusto HAC (Newey–West) para
            mejorar la inferencia.
          </p>
        </Panel>
      </div>
    </div>
  );
}
