import React from 'react';

export function Readout({ value, label, unit }: { value: string | number, label: string, unit?: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 mb-1">{label}</span>
      <div className="font-mono text-2xl tabular-nums text-ink-100 flex items-baseline gap-1">
        {value}
        {unit && <span className="text-sm text-ink-500">{unit}</span>}
      </div>
    </div>
  );
}
