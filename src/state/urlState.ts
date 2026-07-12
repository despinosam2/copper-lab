// R19 (09 EXECUTION BLUEPRINT, hallazgo C5) — Configuración compartible por
// URL: el profesor puede enviar un enlace con el escenario exacto (sliders,
// covariables, dataset sintético) y el estudiante lo abre tal cual.
//
// Formato: parámetro ?config= con JSON versionado ({v:1, ...}). El JSON va
// URL-encodeado por URLSearchParams — legible al decodificar, depurable, y
// tolerante a esquemas viejos (los campos ausentes caen a los defaults del
// provider al hacer merge). Sólo cubre el dataset SINTÉTICO (seed/noise):
// un archivo importado no puede viajar en un enlace.

import { StructuralState, DynamicsState, ArimaState, ArimaxState, GprState, HybridState, ValidationState } from './ModelParams';

export interface ShareableState {
  seed: number;
  noise: number;
  structural: StructuralState;
  dynamics: DynamicsState;
  arima: ArimaState;
  arimax: ArimaxState;
  gpr: GprState;
  hybrid: HybridState;
  validation: ValidationState;
}

const VERSION = 1;

/** Serializa el estado a un string apto para el parámetro ?config=. */
export function encodeState(state: ShareableState): string {
  return JSON.stringify({ v: VERSION, ...state });
}

/**
 * Parsea el valor crudo del parámetro ?config=. Devuelve null ante cualquier
 * cosa que no sea un JSON válido con la forma mínima esperada — un enlace
 * corrupto abre la app con los defaults, nunca la rompe (RNF-3).
 */
export function decodeState(raw: string | null): Partial<ShareableState> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || parsed.v !== VERSION) return null;
    if (typeof parsed.seed !== 'number' || typeof parsed.noise !== 'number') return null;
    const { v: _v, ...state } = parsed;
    return state as Partial<ShareableState>;
  } catch {
    return null;
  }
}
