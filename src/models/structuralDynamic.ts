// Simulador dinámico del mercado del cobre — versión discreta del modelo
// estructural estándar para mercados de commodities:
//
//   Vial, J. (1988, 2003); Labys, W. (2006)
//
//   Dt = D(Dt-1, Pt, PCt, At, Tt)      demanda
//   Qt = Q(Qt-1, Pt-L, Nt, Zt)         oferta (responde al precio con rezago L)
//   It = It-1 + Qt − Dt                acumulación de inventarios
//   Pt = P(Pt-1, dIt)                  el precio responde a la escasez de inventarios
//
// Forma funcional elegida: log-lineal con elasticidades constantes, la más
// simple que reproduce la dinámica cualitativa del sistema (ciclos de
// telaraña, amortiguación por inventarios, tendencias seculares).
//
// Simplificaciones honestas (documentadas en pantalla): la actividad Aₜ
// recoge el ingreso A y los factores técnicos T; los sustitutos PC, los
// recursos N y las políticas Z se subsumen en las elasticidades y en el
// shock de oferta δₜ.

export interface DynamicsParams {
  /** εD — elasticidad-precio de la demanda (corto plazo, inelástica). */
  demandElasticity: number;
  /** εS — elasticidad-precio de la oferta. */
  supplyElasticity: number;
  /** L — trimestres que tarda la oferta en responder al precio. */
  supplyLag: number;
  /** φ — sensibilidad del precio a la escasez de inventarios. */
  priceSensitivity: number;
  /** gA — crecimiento de la actividad global, % por trimestre. */
  activityGrowth: number;
  /** δ — magnitud del shock de oferta (%), aplicado durante un trimestre. */
  shockMagnitude: number;
  /** Trimestre en que ocurre el shock. */
  shockQuarter: number;
}

export interface DynamicsPoint {
  t: number;
  price: number; // USD/lb
  demand: number; // Mt/trimestre
  supply: number; // Mt/trimestre
  inventory: number; // Mt
}

export interface DynamicsResult {
  series: DynamicsPoint[];
  /** (P máx − P mín) / P̄, en %. */
  cycleAmplitudePct: number;
  /** Cobertura mínima de inventarios alcanzada, en semanas de demanda. */
  minCoverageWeeks: number;
  priceMax: number;
  priceMin: number;
  /** true si el precio se estabiliza en los últimos trimestres. */
  converged: boolean;
}

/** Horizonte de simulación en trimestres. */
export const HORIZON = 40;

// Estado estacionario: precio base del modelo estático y flujos trimestrales
// (~25 Mt/año de cobre refinado). El inventario objetivo I* equivale a 4
// semanas de demanda (un trimestre cubre 13 semanas).
const P_BAR = 4.2;
const D_BAR = 6.25;
const Q_BAR = 6.25;
const TARGET_WEEKS = 4;
const I_STAR = D_BAR * (TARGET_WEEKS / 13);
/**
 * Velocidad de ajuste del precio hacia el nivel implicado por la escasez.
 * Calibrada junto a los defaults de εS y φ para que el escenario base sea un
 * ciclo amortiguado que converge, y la telaraña (L alto, εD bajo) oscile de
 * forma sostenida sin tocar el cortacircuito.
 */
const LAMBDA = 0.15;

export function simulateDynamics(p: DynamicsParams): DynamicsResult {
  // Historia inicial en equilibrio (necesaria para el rezago P_{t-L})
  const prices: number[] = Array(p.supplyLag + 1).fill(P_BAR);
  let inventory = I_STAR;
  let activity = 1;
  const series: DynamicsPoint[] = [];

  for (let t = 1; t <= HORIZON; t++) {
    activity *= 1 + p.activityGrowth / 100;

    const pPrev = prices[prices.length - 1]; // P_{t-1}
    const pLagged = prices[prices.length - p.supplyLag]; // P_{t-L}

    // Dt = D̄ · Aₜ · (Pₜ₋₁/P̄)^(−εD)
    const demand = D_BAR * activity * Math.pow(pPrev / P_BAR, -p.demandElasticity);

    // Qt = Q̄ · (Pₜ₋L/P̄)^(εS) · (1 − δₜ)
    const shock = t === p.shockQuarter ? p.shockMagnitude / 100 : 0;
    const supply = Q_BAR * Math.pow(pLagged / P_BAR, p.supplyElasticity) * (1 - shock);

    // It = It-1 + Qt − Dt, con piso técnico (no hay inventarios negativos)
    inventory = Math.max(inventory + supply - demand, 0.05 * I_STAR);

    // Pt = Pt-1 + λ·(P̄·(I*/It)^φ − Pt-1): el precio se ajusta parcialmente
    // hacia el nivel que implica la escasez de inventarios. El ancla en P̄
    // evita que el precio derive sin límite (un integrador puro haría el
    // sistema explosivo para casi cualquier parámetro). λ = 0.5 fijo.
    const scarcityPrice = P_BAR * Math.pow(I_STAR / inventory, p.priceSensitivity);
    let price = pPrev + LAMBDA * (scarcityPrice - pPrev);
    // Cortacircuito numérico (RNF-3): un stockout extremo dispara el precio
    // pero no puede romper la simulación.
    price = Math.min(Math.max(price, 0.25 * P_BAR), 4 * P_BAR);
    prices.push(price);

    series.push({ t, price, demand, supply, inventory });
  }

  const ps = series.map(s => s.price);
  const priceMax = Math.max(...ps);
  const priceMin = Math.min(...ps);
  const cycleAmplitudePct = ((priceMax - priceMin) / P_BAR) * 100;
  const minCoverageWeeks = Math.min(...series.map(s => (s.inventory / s.demand) * 13));

  // Estable si los retornos trimestrales del tramo final son pequeños
  // (medimos retornos, no niveles, para que una tendencia por gA no cuente
  // como oscilación).
  const tail = series.slice(-8);
  const returns = tail.slice(1).map((s, i) => s.price / tail[i].price - 1);
  const vol = Math.sqrt(returns.reduce((acc, r) => acc + r * r, 0) / returns.length);
  const converged = vol < 0.005;

  return { series, cycleAmplitudePct, minCoverageWeeks, priceMax, priceMin, converged };
}
