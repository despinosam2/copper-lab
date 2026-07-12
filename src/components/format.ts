// R08: extraído de ValidationView.tsx para reutilizarlo en las 4 vistas de
// modelo simple y en ComparatorView, donde calculateMetrics ahora puede
// devolver null (antes devolvía 0, que se leía como "ajuste perfecto").
export const fmt = (v: number | null | undefined, digits = 3) =>
  v === null || v === undefined || !isFinite(v) ? '—' : v.toFixed(digits);
