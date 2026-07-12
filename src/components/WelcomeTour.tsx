import { useState } from 'react';

// R23 (hallazgo C2): primera pantalla = un instrumento de 7 pestañas sin
// ninguna indicación de por dónde empezar; la guía que lo resuelve vivía en
// el repo. Tour mínimo de 4 pasos como tarjeta central paso-a-paso — sin
// flechas posicionadas (frágiles ante cambios de layout) y sin librerías.
// localStorage evita repetirlo; el enlace del header permite reabrirlo.

const STORAGE_KEY = 'copperlab_tour_visto';

const STEPS: { title: string; body: string }[] = [
  {
    title: '1 de 4 · Los datos mandan',
    body: 'La barra superior controla la fuente de datos de TODA la app: semilla y ruido del generador sintético (96 meses, reproducible), o importa tu propio CSV/Excel. Cambiar el dataset recalcula las 7 pestañas a la vez.'
  },
  {
    title: '2 de 4 · Las pestañas son una secuencia',
    body: 'La numeración 01→07 es el orden pedagógico real: de la economía (Estructural) a las series de tiempo (ARIMA/ARIMAX), la incertidumbre (GPR), la combinación (Híbrido), la comparación (06) y la evaluación honesta fuera de muestra (07).'
  },
  {
    title: '3 de 4 · Mueve UN control a la vez',
    body: 'El valor de la app está en aislar efectos: mueve un slider, mira qué cambia. Cada pantalla tiene una nota al pie con su experimento clave — y botones que dejan los controles listos para verlo (ej. "Ver la telaraña").'
  },
  {
    title: '4 de 4 · La guía de estudio',
    body: 'El enlace "Guía de estudio (8 noches)" del encabezado abre el plan completo: teoría, práctica guiada y auto-test por sesión. La pregunta que ata todo: ¿qué supuesto económico hay detrás de cada número que ves?'
  }
];

export function seenTour(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return true; // sin localStorage (modo privado estricto): no molestar
  }
}

export function WelcomeTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const close = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* sin localStorage: se cierra igual, sólo que reaparecerá */
    }
    onClose();
  };
  const isLast = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
    >
      <div className="bg-slate-850 border border-slate-700 rounded-[3px] max-w-md w-full p-6 flex flex-col gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-patina mb-1">Bienvenido a COPPER LAB</div>
          <h2 id="tour-title" className="font-display font-semibold text-lg text-ink-100">{STEPS[step].title}</h2>
        </div>
        <p className="text-sm text-ink-300 font-body leading-relaxed">{STEPS[step].body}</p>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={close}
            className="px-3 py-1.5 text-xs font-body text-ink-500 hover:text-ink-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina rounded-sm"
          >
            Saltar
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-1.5 text-sm font-body text-ink-300 hover:text-ink-100 border border-slate-700 rounded-[3px] hover:border-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina"
              >
                Anterior
              </button>
            )}
            <button
              onClick={() => (isLast ? close() : setStep(step + 1))}
              className="px-4 py-1.5 text-sm font-medium font-body bg-patina/20 border border-patina text-patina-light rounded-[3px] hover:bg-patina/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina"
            >
              {isLast ? 'Empezar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
