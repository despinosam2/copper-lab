import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { autocorrelation, ljungBox } from '../models/diagnostics';
import { Panel } from './Panel';
import { fmt } from './format';

// R11 (hallazgo A5): panel de diagnóstico de residuos — ACF con bandas de
// significancia ±2/√n y el estadístico de Ljung-Box. Sin esto, la única
// señal disponible para elegir p era el RMSE, exactamente el anti-patrón
// que el propio BIC de ARIMAX (arimaxTune.ts) existe para evitar.
export function ResidualsPanel({ residuals }: { residuals: number[] }) {
  const { acf, lb, band } = useMemo(() => {
    const n = residuals.length;
    const maxLag = Math.max(1, Math.min(20, Math.floor(n / 4)));
    const acfValues = n > maxLag + 1 ? autocorrelation(residuals, maxLag) : [];
    const lb = acfValues.length > 0 ? ljungBox(residuals, maxLag) : null;
    const band = n > 0 ? 2 / Math.sqrt(n) : 0;
    const acf = acfValues.map((r, i) => ({ lag: i + 1, r }));
    return { acf, lb, band };
  }, [residuals]);

  return (
    <Panel title="Autocorrelación de los residuos" eyebrow="DIAGNÓSTICO">
      {acf.length === 0 ? (
        <p className="text-ink-500 text-sm font-body">Muy pocos residuos para diagnosticar.</p>
      ) : (
        <>
          <div className="h-40" role="img" aria-label={`Autocorrelación de los residuos en los rezagos 1 a ${acf.length}, con bandas de significancia de ±${band.toFixed(2)}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={acf} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="lag" tick={{ fill: '#7d8892', fontSize: 10, fontFamily: 'IBM Plex Mono' }} stroke="#28313b" />
                <YAxis domain={[-1, 1]} tick={{ fill: '#7d8892', fontSize: 10, fontFamily: 'IBM Plex Mono' }} stroke="#28313b" width={35} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#171c22', border: '1px solid #28313b', borderRadius: '3px', color: '#e8ecef', fontFamily: 'IBM Plex Mono', fontSize: 12 }}
                  labelStyle={{ color: '#e8ecef' }}
                  itemStyle={{ color: '#e8ecef' }}
                  formatter={(val: number) => [val.toFixed(3), 'ACF']}
                  labelFormatter={(lag: number) => `Rezago ${lag}`}
                  cursor={{ fill: 'rgba(121, 212, 194, 0.06)' }}
                />
                <ReferenceLine y={band} stroke="#4fb3a0" strokeDasharray="3 3" />
                <ReferenceLine y={-band} stroke="#4fb3a0" strokeDasharray="3 3" />
                <ReferenceLine y={0} stroke="#28313b" />
                <Bar dataKey="r" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                  {acf.map(pt => (
                    <Cell key={pt.lag} fill={Math.abs(pt.r) > band ? '#e0a274' : '#4fb3a0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {lb && (
            <p className="text-ink-500 text-xs mt-2 font-body leading-relaxed">
              <strong className="text-ink-300">Ljung-Box:</strong> Q={fmt(lb.statistic, 2)} (df={lb.df}),
              p-valor={fmt(lb.pValue, 3)}. {lb.pValue < 0.05
                ? 'Bajo — queda autocorrelación sin explicar: el modelo está subespecificado (sube p).'
                : 'Alto — no hay evidencia de autocorrelación residual: no está claro que sumar más rezagos ayude.'}
            </p>
          )}
        </>
      )}
    </Panel>
  );
}
