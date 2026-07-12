import { useMemo } from 'react';
import { CopperRow } from '../data/generator';
import { useModelParams } from '../state/ModelParams';
import { evaluateStructuralModel } from '../models/structural';
import { simulateDynamics } from '../models/structuralDynamic';
import { Panel } from '../components/Panel';
import { Slider } from '../components/Slider';
import { Readout } from '../components/Readout';
import { Note } from '../components/Note';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
  ComposedChart, Line, Area, CartesianGrid
} from 'recharts';

const TOOLTIP_STYLE = {
  backgroundColor: '#171c22',
  border: '1px solid #28313b',
  borderRadius: '3px',
  color: '#e8ecef',
  fontFamily: 'IBM Plex Mono'
} as const;

// Pantalla 01 — F2 (01 PRD): sliders de crecimiento, oferta, inventario, dólar
// y energía; el precio surge del balance oferta–demanda y se muestra su
// descomposición en aportes interpretables. Es un modelo de ESCENARIO,
// determinista y transparente: no se ajusta a la serie.
export function StructuralView({ data: _data }: { data: CopperRow[] }) {
  const { structural, setStructural, dynamics, setDynamics } = useModelParams();
  const setDyn = (patch: Partial<typeof dynamics>) => setDynamics({ ...dynamics, ...patch });
  const sim = useMemo(() => simulateDynamics(dynamics), [dynamics]);
  const { growth, supplyInterruptPct, inventory, usdIndex, energyCost } = structural;
  const setGrowth = (v: number) => setStructural({ ...structural, growth: v });
  const setSupplyInterruptPct = (v: number) => setStructural({ ...structural, supplyInterruptPct: v });
  const setInventory = (v: number) => setStructural({ ...structural, inventory: v });
  const setUsdIndex = (v: number) => setStructural({ ...structural, usdIndex: v });
  const setEnergyCost = (v: number) => setStructural({ ...structural, energyCost: v });

  const result = useMemo(
    () =>
      evaluateStructuralModel({
        growth,
        supplyInterrupt: supplyInterruptPct / 100,
        inventory,
        usdIndex,
        energyCost
      }),
    [growth, supplyInterruptPct, inventory, usdIndex, energyCost]
  );

  const decompBars = useMemo(
    () => [
      { name: 'Base P₀', value: result.components.base, isBase: true },
      { name: 'Demanda', value: result.components.demandPush, isBase: false },
      { name: 'Oferta', value: result.components.supplyPull, isBase: false },
      { name: 'Inventarios', value: result.components.inventoryCushion, isBase: false },
      { name: 'Dólar', value: result.components.usdEffect, isBase: false },
      { name: 'Energía', value: result.components.costFloor, isBase: false }
    ],
    [result]
  );

  const isDeficit = result.balance < 0;

  return (
    <div className="flex flex-col gap-6">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
        <Panel title="Balance de mercado" eyebrow="LECTURAS">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Readout label="Precio" value={result.price.toFixed(2)} unit="USD/lb" />
            <div className="flex flex-col">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 mb-1">
                Balance (S − D)
              </span>
              <div className="font-mono text-2xl tabular-nums flex items-baseline gap-1">
                <span className={isDeficit ? 'text-copper-light' : 'text-patina-light'}>
                  {result.balance >= 0 ? '+' : ''}{result.balance.toFixed(2)}
                </span>
                <span className="text-sm text-ink-500">Mt</span>
              </div>
              <span className={`font-mono text-[11px] uppercase tracking-[0.2em] mt-1 ${isDeficit ? 'text-copper-light' : 'text-patina-light'}`}>
                {isDeficit ? 'déficit' : 'superávit'}
              </span>
            </div>
            <Readout label="Demanda D" value={result.demand.toFixed(1)} unit="Mt" />
            <Readout label="Oferta S" value={result.supply.toFixed(1)} unit="Mt" />
          </div>
        </Panel>

        <Panel title="Descomposición del precio" eyebrow="ANÁLISIS">
          <p className="font-mono text-xs text-ink-500 mb-3">
            P = P₀ + demanda + oferta + inventarios + dólar + energía
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={decompBars} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <XAxis type="number" stroke="#78838d" tick={{ fill: '#78838d', fontSize: 12, fontFamily: 'IBM Plex Mono' }} />
                <YAxis type="category" dataKey="name" stroke="#78838d" tick={{ fill: '#aab4bd', fontSize: 12, fontFamily: 'Inter' }} width={90} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#171c22', border: '1px solid #28313b', borderRadius: '3px', color: '#e8ecef', fontFamily: 'IBM Plex Mono' }}
                  labelStyle={{ color: '#e8ecef' }}
                  // Sin esto los ítems heredan el negro por defecto de Recharts
                  // (las barras con <Cell> no exponen color de serie)
                  itemStyle={{ color: '#e8ecef' }}
                  formatter={(val: number) => [`${val.toFixed(3)} USD/lb`, 'aporte']}
                  cursor={{ fill: 'rgba(121, 212, 194, 0.06)' }}
                />
                <ReferenceLine x={0} stroke="#28313b" />
                <Bar dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                  {decompBars.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.isBase ? '#9a5a36' : entry.value >= 0 ? '#e0a274' : '#4fb3a0'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Note>
          El precio no es magia: es la base P₀ = 4.20 USD/lb más cinco aportes económicos que
          puedes aislar moviendo un slider a la vez. Las barras cobre empujan al alza; las
          barras pátina, a la baja. <strong className="text-ink-100">Experimento:</strong>{' '}
          provoca un déficit subiendo el crecimiento y la interrupción de oferta, y observa
          qué barras de la descomposición dominan.
        </Note>
      </div>

      <div className="col-span-1 flex flex-col gap-6">
        <Panel title="Variables económicas" eyebrow="CONTROLES">
          <Slider label="Crecimiento global (g)" min={-2} max={6} step={0.1} value={growth} onChange={setGrowth} unit="%" />
          <Slider label="Interrupción oferta (δ)" min={0} max={15} step={0.5} value={supplyInterruptPct} onChange={setSupplyInterruptPct} unit="%" />
          <Slider label="Inventarios" min={2} max={8} step={0.1} value={inventory} onChange={setInventory} unit="sem" />
          <Slider label="Índice del dólar" min={85} max={115} step={0.5} value={usdIndex} onChange={setUsdIndex} />
          <Slider label="Costo energía relativo" min={0.5} max={2} step={0.05} value={energyCost} onChange={setEnergyCost} unit="×" />
        </Panel>

        <Panel title="Interpretación" eyebrow="MODELO">
          <ul className="flex flex-col gap-2 text-sm text-ink-300 font-body leading-relaxed">
            <li><span className="text-ink-100">Demanda:</span> mayor crecimiento empuja el precio al alza.</li>
            <li><span className="text-ink-100">Oferta:</span> interrupciones encarecen el cobre.</li>
            <li><span className="text-ink-100">Inventarios:</span> inventarios altos amortiguan el precio.</li>
            <li><span className="text-ink-100">Dólar:</span> un dólar fuerte deprime el precio (cotiza en USD).</li>
            <li><span className="text-ink-100">Energía:</span> energía cara sube el piso de costo.</li>
          </ul>
        </Panel>
      </div>
    </div>

    {/* ——— Simulador dinámico: Dt, Qt, It, Pt acoplados en el tiempo ——— */}
    <Panel title="Simulador dinámico del mercado" eyebrow="VIAL 1988/2003 · LABYS 2006">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-4">
          <pre className="font-mono text-xs text-ink-300 bg-slate-900/60 border border-slate-700 rounded-[3px] p-3 overflow-x-auto leading-relaxed">
{`Dₜ = D̄ · Aₜ · (Pₜ₋₁/P̄)^(−εD)             demanda
Qₜ = Q̄ · (Pₜ₋L/P̄)^(εS) · (1−δₜ)          oferta
Iₜ = Iₜ₋₁ + Qₜ − Dₜ                       inventarios
Pₜ = Pₜ₋₁ + λ·(P̄·(I*/Iₜ)^φ − Pₜ₋₁)       precio (λ=0.15)`}
          </pre>

          {/* R14: preset clicable — convierte la receta de la guía de estudio
              ("L=8, εD=0.1 → ciclo de telaraña persistente") en un botón. */}
          <button
            onClick={() => setDyn({ supplyLag: 8, demandElasticity: 0.1 })}
            className="self-start px-3 py-1.5 text-xs font-medium font-body bg-slate-700 hover:bg-slate-600 text-ink-100 rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina"
          >
            Ver la telaraña (L=8, εD=0.1)
          </button>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={sim.series} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#28313b" vertical={false} />
                <XAxis
                  dataKey="t"
                  stroke="#78838d"
                  tick={{ fill: '#78838d', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  tickFormatter={(t: number) => `T${t}`}
                  minTickGap={24}
                />
                <YAxis
                  yAxisId="price"
                  stroke="#e0a274"
                  tick={{ fill: '#e0a274', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  tickFormatter={(v: number) => v.toFixed(1)}
                  domain={['auto', 'auto']}
                  width={50}
                />
                <YAxis
                  yAxisId="mt"
                  orientation="right"
                  stroke="#78838d"
                  tick={{ fill: '#78838d', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  tickFormatter={(v: number) => v.toFixed(1)}
                  domain={[0, 'auto']}
                  width={45}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: '#e8ecef' }}
                  itemStyle={{ color: '#e8ecef' }}
                  labelFormatter={(t: number) => `Trimestre ${t}`}
                  formatter={(value: number, name: string) => {
                    const units: Record<string, string> = {
                      Precio: 'USD/lb', Demanda: 'Mt/trim', Oferta: 'Mt/trim', Inventarios: 'Mt'
                    };
                    return [`${value.toFixed(2)} ${units[name] ?? ''}`, name];
                  }}
                />
                {dynamics.shockMagnitude > 0 && (
                  <ReferenceLine yAxisId="price" x={dynamics.shockQuarter} stroke="#79d4c2" strokeDasharray="4 4" />
                )}
                <Area yAxisId="mt" dataKey="inventory" name="Inventarios" fill="#4fb3a0" fillOpacity={0.15} stroke="#4fb3a0" strokeOpacity={0.4} isAnimationActive={false} />
                <Line yAxisId="mt" dataKey="demand" name="Demanda" stroke="#78838d" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                <Line yAxisId="mt" dataKey="supply" name="Oferta" stroke="#79d4c2" dot={false} isAnimationActive={false} />
                <Line yAxisId="price" dataKey="price" name="Precio" stroke="#e0a274" strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-ink-300">
            <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded bg-copper-light" /> precio (eje izq.)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded bg-ink-500" /> demanda (eje der.)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded bg-patina-light" /> oferta (eje der.)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm bg-patina/25" /> inventarios (eje der.)</span>
            {dynamics.shockMagnitude > 0 && (
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-0.5 bg-patina-light" /> shock en T{dynamics.shockQuarter}</span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-700 pt-4">
            <Readout label="Amplitud del ciclo" value={sim.cycleAmplitudePct.toFixed(1)} unit="% de P̄" />
            <Readout label="Cobertura mínima" value={sim.minCoverageWeeks.toFixed(1)} unit="sem" />
            <Readout label="Precio máximo" value={sim.priceMax.toFixed(2)} unit="USD/lb" />
            <div className="flex flex-col">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 mb-1">Régimen</span>
              <span className={`font-mono text-2xl ${sim.converged ? 'text-patina-light' : 'text-copper-light'}`}>
                {sim.converged ? 'estable' : 'oscilando'}
              </span>
            </div>
          </div>
        </div>

        <div className="col-span-1 flex flex-col gap-6">
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 mb-4">Estructura del mercado</h3>
            <Slider label="Elasticidad demanda (εD)" min={0.05} max={0.8} step={0.05} value={dynamics.demandElasticity} onChange={v => setDyn({ demandElasticity: v })} />
            <Slider label="Elasticidad oferta (εS)" min={0.05} max={0.6} step={0.05} value={dynamics.supplyElasticity} onChange={v => setDyn({ supplyElasticity: v })} />
            <Slider label="Rezago de oferta (L)" min={1} max={8} step={1} value={dynamics.supplyLag} onChange={v => setDyn({ supplyLag: v })} unit="trim" />
            <Slider label="Sensibilidad a inventarios (φ)" min={0.05} max={0.6} step={0.05} value={dynamics.priceSensitivity} onChange={v => setDyn({ priceSensitivity: v })} />
          </div>
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 mb-4">Escenario</h3>
            <Slider label="Crecimiento actividad (gA)" min={-1} max={2} step={0.1} value={dynamics.activityGrowth} onChange={v => setDyn({ activityGrowth: v })} unit="%/trim" />
            <Slider label="Shock de oferta (δ)" min={0} max={30} step={1} value={dynamics.shockMagnitude} onChange={v => setDyn({ shockMagnitude: v })} unit="%" />
            <Slider label="Trimestre del shock" min={1} max={20} step={1} value={dynamics.shockQuarter} onChange={v => setDyn({ shockQuarter: v })} />
          </div>
        </div>
      </div>
    </Panel>

    <Note>
      Versión discreta del modelo estructural estándar de mercados de commodities
      (Vial 1988 y 2003; Labys 2006): demanda, oferta, inventarios y precio acoplados
      en el tiempo. La actividad Aₜ recoge el ingreso (A) y los factores técnicos (T);
      los sustitutos (PC), los recursos (N) y las políticas (Z) se subsumen en las
      elasticidades y en el shock δ — la misma simplificación honesta que hicimos con
      ARIMA(p,d,0). <strong className="text-ink-100">Experimentos:</strong>{' '}
      (1) sube el rezago L a 6–8 con εD ≈ 0.1 y observa el ciclo de telaraña: la oferta
      llega siempre tarde. (2) Con φ alto el precio absorbe el shock de golpe; con φ
      bajo lo absorben los inventarios. (3) Sube gA y verás el ciclo montado sobre una
      tendencia — la demanda crece más rápido que la capacidad. Aquí también nace la
      intuición de por qué la serie que ajustan los modelos 02–05 tiene persistencia:
      la autocorrelación emerge de la estructura económica.
    </Note>
    </div>
  );
}
