export interface CopperRow {
  date: string;
  t: number;
  price: number;
  globalGrowth: number;
  usdIndex: number;
}

// PRNG: Mulberry32
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller transform for normal distribution N(0,1)
function gaussianRandom(prng: () => number) {
  let u = 1 - prng(); 
  let v = prng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function generateSyntheticData(seed: number = 42, noiseLevel: number = 0.1): CopperRow[] {
  const prng = mulberry32(seed);
  const rows: CopperRow[] = [];
  let eps_prev = 0;

  for (let t = 0; t < 96; t++) {
    // Generate dates starting from 2015-01
    const year = 2015 + Math.floor(t / 12);
    const month = (t % 12) + 1;
    const dateStr = `${year}-${month.toString().padStart(2, '0')}`;

    // Covariates with some cyclical pattern and their own small noise
    const growthNoise = gaussianRandom(prng) * 0.5;
    const usdNoise = gaussianRandom(prng) * 2.0;
    const globalGrowth = 2.5 + 1.5 * Math.sin(t / 20) + growthNoise;
    const usdIndex = 100 + 10 * Math.sin((t / 15) + Math.PI) + usdNoise;

    // Price components
    const trend = 3.2 + 0.012 * t;
    const seasonality = 0.25 * Math.sin(2 * Math.PI * t / 12);
    const covEffect = 0.18 * (globalGrowth - 2.5) - 0.03 * (usdIndex - 100);
    
    // AR(1) error
    const innovation = gaussianRandom(prng);
    const eps = 0.6 * eps_prev + noiseLevel * innovation;
    eps_prev = eps;

    const price = trend + seasonality + covEffect + eps;

    rows.push({
      date: dateStr,
      t,
      price: Math.max(0, price), // ensuring price is positive
      globalGrowth,
      usdIndex
    });
  }

  return rows;
}
