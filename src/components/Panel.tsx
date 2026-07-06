import React from 'react';

export function Panel({ title, eyebrow, children, className = '' }: { title: string, eyebrow?: string, children?: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-slate-850 border border-slate-700 rounded-[3px] p-4 flex flex-col ${className}`}>
      <div className="mb-4">
        {eyebrow && <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 mb-1">{eyebrow}</div>}
        <h2 className="font-display font-semibold text-lg text-ink-100">{title}</h2>
      </div>
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
