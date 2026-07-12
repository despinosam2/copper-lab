import { ReactNode, useId } from 'react';

// R23 (hallazgo C2): término técnico con definición en tooltip accesible —
// visible al pasar el mouse Y al enfocar con teclado (group-focus-within),
// enlazado por aria-describedby. Sin librerías: posicionamiento CSS puro.
export function Term({ children, def }: { children: ReactNode; def: string }) {
  const id = useId();
  return (
    <span className="relative inline-block group">
      <button
        type="button"
        aria-describedby={id}
        className="underline decoration-dotted decoration-ink-500 underline-offset-2 cursor-help text-inherit font-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina rounded-sm"
      >
        {children}
      </button>
      <span
        id={id}
        role="tooltip"
        className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100
          transition-opacity absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64
          bg-slate-900 border border-slate-700 rounded-[3px] p-3 text-xs text-ink-300 font-body leading-relaxed
          shadow-lg pointer-events-none normal-case tracking-normal"
      >
        {def}
      </span>
    </span>
  );
}
