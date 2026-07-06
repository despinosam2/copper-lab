import React from 'react';

interface SliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (val: number) => void;
  unit?: string;
}

export function Slider({ label, min, max, step, value, onChange, unit }: SliderProps) {
  const id = `slider-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-1">
        <label htmlFor={id} className="font-body text-sm text-ink-300">{label}</label>
        <span className="font-mono text-sm text-copper-light" aria-live="polite">
          {value.toFixed(step < 1 ? (step < 0.01 ? 3 : 2) : 0)}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        id={id}
        type="range"
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-slate-700 rounded-full appearance-none cursor-pointer
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina focus-visible:ring-offset-2 focus-visible:ring-offset-slate-850
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[radial-gradient(circle_at_center,_#e0a274_0%,_#4fb3a0_100%)]
          [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(79,179,160,0.6)]
          [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:border-none
          [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[radial-gradient(circle_at_center,_#e0a274_0%,_#4fb3a0_100%)]
        "
      />
    </div>
  );
}
