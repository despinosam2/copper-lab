import { useMemo } from 'react';
import { CopperRow } from '../data/generator';
import { useModelParams } from '../state/ModelParams';
import { buildExogMatrix, activeExogDefs } from '../state/exogDefs';
import { fitArima } from '../models/arima';
import { fitArimax } from '../models/arimax';
import { fitGpr } from '../models/gpr';
import { fitHybrid } from '../models/hybrid';
import { calculateMetrics } from '../models/metrics';
import { Panel } from '../components/Panel';
import { Note } from '../components/Note';

export function ComparatorView({ data }: { data: CopperRow[] }) {
  // Cada modelo se evalúa con la configuración que el estudiante dejó en su
  // pestaña (estado compartido), así los números coinciden con lo que vio ahí.
  const { arima, arimax, gpr, hybrid } = useModelParams();

  const comparison = useMemo(() => {
    const y = data.map(r => r.price);
    const x_gpr = Array(data.length).fill(0).map((_, i) => i / (data.length > 1 ? data.length - 1 : 1));
    // El híbrido no tiene toggles propios (pestaña 05): usa siempre las 5 exógenas disponibles.
    const allExog = data.map(r => [r.globalGrowth, r.usdIndex, r.stocks, r.libor, r.partLargas]);

    // Cada modelo se evalúa sólo sobre su tramo predicho (los primeros p+d
    // puntos no tienen predicción en los autorregresivos).
    const metricsFrom = (fitted: number[], start: number) =>
      calculateMetrics(y.slice(start), fitted.slice(start));

    // ARIMA — configuración de la pestaña 02
    const mArima = fitArima(y, arima.p, arima.d);
    const metArima = metricsFrom(mArima.fitted, arima.p + arima.d);

    // ARIMAX — configuración de la pestaña 03 (incluye toggles de covariables)
    const axExog = buildExogMatrix(data, arimax);
    const axCovars = activeExogDefs(arimax).map(def => def.shortLabel);
    const mArimax = fitArimax(y, axExog, arimax.p, arimax.d);
    const metArimax = metricsFrom(mArimax.fitted, arimax.p + arimax.d);

    // GPR — configuración de la pestaña 04
    const mGpr = fitGpr(x_gpr, y, gpr);
    const metGpr = metricsFrom(mGpr.mean, 0);

    // Híbrido — configuración de la pestaña 05 (σf² y σn² fijos como en esa vista)
    const mHyb = fitHybrid(y, allExog, hybrid.p, hybrid.d, {
      lengthScale: hybrid.lengthScale,
      signalVariance: 1.0,
      noiseVariance: 0.05
    });
    const metHyb = metricsFrom(mHyb.fitted, hybrid.p + hybrid.d);

    const results = [
      { name: 'ARIMA', config: `p=${arima.p} · d=${arima.d}`, ...metArima },
      {
        name: 'ARIMAX',
        config: `p=${arimax.p} · d=${arimax.d}${axCovars.length > 0 ? ' · ' + axCovars.join(', ') : ' · sin covariables'}`,
        ...metArimax
      },
      {
        name: 'GPR',
        config: `l=${gpr.lengthScale.toFixed(2)} · σf²=${gpr.signalVariance.toFixed(1)} · σn²=${gpr.noiseVariance.toFixed(3)}`,
        ...metGpr
      },
      {
        name: 'Híbrido',
        config: `p=${hybrid.p} · d=${hybrid.d} · l=${hybrid.lengthScale.toFixed(2)} · GPR en residuos`,
        ...metHyb
      }
    ];

    const minRmse = Math.min(...results.map(r => r.rmse));
    return { results, minRmse };
  }, [data, arima, arimax, gpr, hybrid]);

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <Panel title="Comparador de Modelos" eyebrow="EVALUACIÓN">
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left font-body">
            <thead>
              <tr className="border-b border-slate-700 text-ink-300">
                <th className="pb-3 font-medium">Modelo</th>
                <th className="pb-3 font-medium">Configuración</th>
                <th className="pb-3 font-medium text-right">RMSE</th>
                <th className="pb-3 font-medium text-right">MAE</th>
                <th className="pb-3 font-medium text-right">MAPE</th>
                <th className="pb-3 font-medium text-right">R²</th>
              </tr>
            </thead>
            <tbody>
              {comparison.results.map(row => {
                const isWinner = row.rmse === comparison.minRmse;
                return (
                  <tr key={row.name} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 text-ink-100 flex items-center gap-2">
                      {isWinner && <span className="w-2 h-2 rounded-full bg-patina inline-block"></span>}
                      {row.name}
                    </td>
                    <td className="py-4 font-mono text-xs text-ink-300">{row.config}</td>
                    <td className={`py-4 text-right font-mono ${isWinner ? 'text-patina font-semibold' : 'text-ink-100'}`}>{row.rmse.toFixed(3)}</td>
                    <td className="py-4 text-right font-mono text-ink-100">{row.mae.toFixed(3)}</td>
                    <td className="py-4 text-right font-mono text-ink-100">{row.mape.toFixed(2)}%</td>
                    <td className="py-4 text-right font-mono text-ink-100">{row.r2.toFixed(4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Note>
        Menor RMSE en el ajuste no garantiza mejor generalización. Un buen modelo debe equilibrar ajuste, interpretabilidad y honestidad sobre su incertidumbre. Observa qué pasa si cambias los datos (semilla/ruido).
      </Note>
    </div>
  );
}
