export interface StructuralParams {
  growth: number; // g (%)
  supplyInterrupt: number; // delta (fraction)
  inventory: number; // inv (weeks)
  usdIndex: number; // usd index
  energyCost: number; // energy relative cost
}

export interface StructuralDecomp {
  base: number;
  demandPush: number;
  supplyPull: number;
  inventoryCushion: number;
  usdEffect: number;
  costFloor: number;
}

export interface StructuralResult {
  price: number;
  /** Demanda D = D₀·(1 + 0.9·g), en Mt. */
  demand: number;
  /** Oferta S = S₀·(1 − δ), en Mt. */
  supply: number;
  /** Balance B = S − D (B > 0 superávit, B < 0 déficit), en Mt. */
  balance: number;
  components: StructuralDecomp;
}

/**
 * Evaluates the structural model for a single point in time.
 * Per 03 MODEL SPEC: Price is a sum of interpretable drivers.
 * P = P0 + demandPush + supplyPull + inventoryCushion + usdEffect + costFloor
 */
export function evaluateStructuralModel(params: StructuralParams): StructuralResult {
  const P0 = 4.20;
  const D0 = 25; // Mt — demanda base de cobre refinado (aprox. mundial)
  const S0 = 25; // Mt — capacidad de oferta base

  const g = params.growth / 100;

  // Balance de mercado (03 MODEL SPEC)
  const demand = D0 * (1 + 0.9 * g);
  const supply = S0 * (1 - params.supplyInterrupt);
  const balance = supply - demand;

  const dPush = 0.9 * g * P0;
  const sPull = params.supplyInterrupt * 1.8 * P0;
  const invCushion = -((params.inventory - 4) / 4) * 0.35 * P0;
  const usdEff = -((params.usdIndex - 100) / 100) * 1.2 * P0;
  const costFl = (params.energyCost - 1) * 0.5 * P0;

  const price = P0 + dPush + sPull + invCushion + usdEff + costFl;

  return {
    price,
    demand,
    supply,
    balance,
    components: {
      base: P0,
      demandPush: dPush,
      supplyPull: sPull,
      inventoryCushion: invCushion,
      usdEffect: usdEff,
      costFloor: costFl
    }
  };
}
