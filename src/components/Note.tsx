import React from 'react';

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-4 border-patina pl-4 py-1 my-4 text-ink-300 text-sm leading-relaxed bg-slate-850/50 p-2 rounded-r-[3px]">
      {children}
    </div>
  );
}
