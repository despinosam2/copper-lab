import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDataset } from './data/useDataset';
import { ModelParamsProvider } from './state/ModelParams';
import { StructuralView } from './views/StructuralView';
import { ArimaView } from './views/ArimaView';
import { ArimaxView } from './views/ArimaxView';
import { GprView } from './views/GprView';
import { HybridView } from './views/HybridView';
import { ComparatorView } from './views/ComparatorView';
import { ValidationView } from './views/ValidationView';

const TABS = [
  { id: '01', name: 'Estructural', component: StructuralView },
  { id: '02', name: 'ARIMA', component: ArimaView },
  { id: '03', name: 'ARIMAX', component: ArimaxView },
  { id: '04', name: 'GPR', component: GprView },
  { id: '05', name: 'Híbrido', component: HybridView },
  { id: '06', name: 'Comparador', component: ComparatorView },
  { id: '07', name: 'Predicción', component: ValidationView }
];

export default function App() {
  const dataset = useDataset();
  const [activeTab, setActiveTab] = useState(0);

  const ActiveComponent = TABS[activeTab].component;

  return (
    <ModelParamsProvider>
    <div className="min-h-screen flex flex-col items-center">
      <div className="w-full max-w-6xl px-4 py-8 flex flex-col gap-8">
        
        {/* Header — fixed marca + contexto (05 UI SPEC) */}
        <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-sm pb-4 pt-2 -mx-4 px-4 flex items-center justify-between border-b border-slate-700/50 mb-2">
          <div>
            <h1 className="font-display font-bold text-[20px] tracking-tight text-ink-100 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-copper-light to-patina flex-shrink-0"></span>
              <span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-copper-light to-patina">COPPER</span>{' '}
                LAB
              </span>
            </h1>
            <p className="text-ink-500 font-body text-sm mt-1">Modelado interactivo de precios de commodities · Caso del cobre</p>
          </div>
        </header>

        {/* Dataset Bar — F1: semilla, ruido, importar CSV/Excel (01 PRD) */}
        <div className="bg-slate-850 border border-slate-700 rounded-[3px] p-4 flex flex-col md:flex-row gap-6 md:items-center justify-between">
          <div className="flex gap-8 items-center flex-1 flex-wrap">
            <div className="flex flex-col gap-1 w-full max-w-[200px]">
              <div className="flex justify-between items-baseline">
                <label htmlFor="seed-slider" className="font-body text-sm text-ink-300">Semilla</label>
                <span className="font-mono text-sm text-copper-light">{dataset.seed}</span>
              </div>
              <input 
                id="seed-slider"
                type="range" min="1" max="200" step="1" 
                role="slider"
                aria-label="Semilla aleatoria"
                aria-valuemin={1}
                aria-valuemax={200}
                aria-valuenow={dataset.seed}
                value={dataset.seed} 
                onChange={e => dataset.setSeed(parseInt(e.target.value))}
                disabled={dataset.isImported}
                className="w-full h-1 bg-slate-700 rounded-full appearance-none cursor-pointer disabled:opacity-50
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina focus-visible:ring-offset-2 focus-visible:ring-offset-slate-850
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-copper-light [&::-webkit-slider-thumb]:to-copper-deep
                [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(224,162,116,0.4)]"
              />
            </div>
            
            <div className="flex flex-col gap-1 w-full max-w-[200px]">
              <div className="flex justify-between items-baseline">
                <label htmlFor="noise-slider" className="font-body text-sm text-ink-300">Ruido</label>
                <span className="font-mono text-sm text-copper-light">{dataset.noise.toFixed(2)}</span>
              </div>
              <input 
                id="noise-slider"
                type="range" min="0.02" max="0.25" step="0.01" 
                role="slider"
                aria-label="Nivel de ruido"
                aria-valuemin={0.02}
                aria-valuemax={0.25}
                aria-valuenow={dataset.noise}
                value={dataset.noise} 
                onChange={e => dataset.setNoise(parseFloat(e.target.value))}
                disabled={dataset.isImported}
                className="w-full h-1 bg-slate-700 rounded-full appearance-none cursor-pointer disabled:opacity-50
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina focus-visible:ring-offset-2 focus-visible:ring-offset-slate-850
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-copper-light [&::-webkit-slider-thumb]:to-copper-deep
                [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(224,162,116,0.4)]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
                {dataset.isImported ? 'IMPORTADO' : 'SINTÉTICO'}
              </span>
              <span className="font-mono text-sm text-ink-300">
                {dataset.data.length} pts
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex gap-2">
              {dataset.isImported && (
                <button 
                  onClick={dataset.clearImport}
                  className="px-3 py-1.5 text-sm font-body text-ink-300 hover:text-ink-100 transition-colors border border-slate-700 rounded-[3px] hover:border-slate-500"
                >
                  Restaurar Sintético
                </button>
              )}
              <label className="px-4 py-1.5 text-sm font-medium font-body bg-slate-700 hover:bg-slate-600 text-ink-100 rounded-[3px] cursor-pointer transition-colors">
                Importar CSV/Excel
                <input 
                  type="file" 
                  accept=".csv,.xlsx,.xls" 
                  className="hidden" 
                  onChange={e => {
                    if (e.target.files && e.target.files.length > 0) {
                      dataset.handleImport(e.target.files[0]);
                    }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            {dataset.isImported && !dataset.errorMsg && (
              <div className="text-patina-light text-xs font-mono">Usando dataset importado</div>
            )}
            {dataset.errorMsg && (
              <div role="alert" className="text-red-400 text-xs font-mono max-w-xs text-right whitespace-pre-line">
                {dataset.errorMsg}
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-850/50 border-l-4 border-patina p-3 rounded-r-[3px] text-sm text-ink-300 font-body">
          <strong>Datos:</strong> Todo modelo depende de los datos. El ruido afecta la dificultad del problema. Sube el ruido y observa cómo se degradan las métricas.
        </div>

        {/* Tab Navigation — 05 UI SPEC: numbered tabs, patina underline, ARIA tablist */}
        <nav role="tablist" aria-label="Modelos" className="flex gap-1 border-b border-slate-700 overflow-x-auto no-scrollbar">
          {TABS.map((tab, idx) => {
            const isActive = activeTab === idx;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(idx)}
                className={`relative px-4 py-3 flex items-center gap-3 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded-sm ${isActive ? 'text-ink-100' : 'text-ink-500 hover:text-ink-300'}`}
              >
                <span className="font-mono text-[11px] opacity-60">{tab.id}</span>
                <span className="font-display font-medium">{tab.name}</span>
                {isActive && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-patina"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Active View — with AnimatePresence for tab transitions (05 UI SPEC) */}
        <main
          role="tabpanel"
          id={`tabpanel-${TABS[activeTab].id}`}
          aria-labelledby={`tab-${TABS[activeTab].id}`}
          className="relative"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <ActiveComponent data={dataset.data} />
            </motion.div>
          </AnimatePresence>
        </main>

      </div>
    </div>
    </ModelParamsProvider>
  );
}
