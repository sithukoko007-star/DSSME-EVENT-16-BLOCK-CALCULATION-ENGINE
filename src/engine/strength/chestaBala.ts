/**
 * DEPRECATED FACADE — src/engine/strength/chestaBala.ts
 *
 * ဤဖိုင်သည် Backward Compatibility အတွက်သာ ထိန်းသိမ်းထားသည်။
 * Chesta Bala ၏ canonical engine မှာ `src/engine/chartblocks/shadbala.ts` ဖြစ်သည်။
 *
 * Fix #3: Dual Chesta Entry Point → Single Source of Truth
 * Fix #4: Mercury/Venus Geocentric Speed Bug
 *   ယခင် MEAN_DAILY_MOTION တွင် Mercury 4.0923°/d, Venus 1.60215°/d (heliocentric) အမှားများ
 *   ပါဝင်နေသည်။ Canonical geocentric values (Mercury: 0.9856°/d, Venus: 0.9856°/d) ကို
 *   TARA_MEAN_DAILY_SPEED_DEG (shadbala.ts) မှ ရယူသင့်သည်။
 *
 * Backward Compat Stubs:
 *   Test files (tests/strength/chestaBala.test.ts, tests/phase8/chesta_method2.run.ts)
 *   import လုပ်နေသော legacy functions / constants တို့ကို ဤ facade မှ re-export
 *   သို့မဟုတ် shim ဖြင့် ပံ့ပိုးသည်။ New code တွင် shadbala.ts ကိုသာ import ပြုလုပ်ပါ။
 */

import type { PlanetState } from '../types.ts';
export { SHADBALA_PLANETS, type ShadbalaPlanet } from "./shadbalaConstants.ts";

// ── Re-export canonical types & functions from shadbala.ts ────────────────────
export {
  TARA_MEAN_DAILY_SPEED_DEG,
  TARA_MAX_DAILY_SPEED_DEG,
  ASHTA_GATI_VIRUPAS_BPHS_ORIGINAL,
  ASHTA_GATI_VIRUPAS_MODERN_VARIANT,
  DEFAULT_ASHTA_GATI_THRESHOLDS,
  CHESTA_EPOCH_JD_1900,
  UJJAIN_LONGITUDE_DEG,
  EPOCH_1900_TABLE,
  type AshtaGatiState,
  type LuminaryChestaState,
  type PlanetGatiClassification,
  type ChestaBalaMode,
  type ChestaPlanetInput,
  type PlanetChestaBalaDetail,
  type AshtaGatiThresholds,
  type ChestaEpochContext,
  type Epoch1900PlanetData,
  computeDailySpeedFromLongitudes,
  compute1900EpochMeanAndSeeghrocha,
  calculateMethod1ChestaKendraBala,
  classifyTaraGrahaAshtaGati,
  evaluatePlanetChestaBala,
  calculateChestaBala,
  chestaBala,
  calculateAyanaBalaRaw,
  calculateAyanaBala,
  calculatePakshaBalaRaw,
  calculatePakshaBala,
} from "../chartblocks/shadbala.ts";

// ── Legacy context interface (backward compat) ────────────────────────────────
export interface ChestaContext {
  ayanamsaDegrees?: number;
  localJulianDay?:  number;
  placeLongitude?:  number;
}

// ── STATIONARY_THRESHOLD (backward compat constant) ──────────────────────────
/** @deprecated Use DEFAULT_ASHTA_GATI_THRESHOLDS.vikalaMaxRatio from shadbala.ts */
export const STATIONARY_THRESHOLD = 0.05;

// ── MEAN_DAILY_MOTION (backward compat — heliocentric bug preserved for test parity) ──
/**
 * @deprecated Fix #4: Mercury (4.0923) and Venus (1.60215) are HELIOCENTRIC speeds.
 * For Ashta-Gati geocentric ratio calculation use TARA_MEAN_DAILY_SPEED_DEG (shadbala.ts).
 *
 * Kept here ONLY because tests/strength/chestaBala.test.ts imports and asserts these
 * exact legacy values. Do not use in new code.
 */
export const MEAN_DAILY_MOTION: Record<string, number> = {
  Mars:    0.524,      // ✓ matches geocentric
  Mercury: 4.0923,     // ❌ heliocentric — geocentric: 0.9856°/d
  Jupiter: 0.0831,     // ✓ matches geocentric
  Venus:   1.60215,    // ❌ heliocentric — geocentric: 0.9856°/d
  Saturn:  0.033439,   // ✓ matches geocentric
};

// ── Legacy Sun Chesta Bala (Ayana Lagrange interpolation model) ───────────────
const AYANA_BHUJA       = [0, 15, 30, 45, 60, 75, 90];
const AYANA_DECL_TABLE  = [0, 362 / 60, 703 / 60, 1002 / 60, 1238 / 60, 1388 / 60, 1440 / 60];

function pyRound2(x: number): number {
  const s = x * 100, fl = Math.floor(s);
  if (s - fl === 0.5) return (fl % 2 === 0 ? fl : fl + 1) / 100;
  return Math.round(s) / 100;
}

const mod360 = (x: number): number => ((x % 360) + 360) % 360;

function inverseLagrange(xArr: number[], yArr: number[], ya: number): number {
  let total = 0;
  for (let i = 0; i < xArr.length; i++) {
    let n = 1, d = 1;
    for (let j = 0; j < xArr.length; j++) {
      if (j !== i) { n *= ya - yArr[j]; d *= yArr[i] - yArr[j]; }
    }
    total += n * xArr[i] / d;
  }
  return total;
}

/**
 * @deprecated Legacy Sun Chesta model. Use calculateAyanaBalaRaw() from shadbala.ts.
 * Kept for tests/strength/chestaBala.test.ts backward compatibility.
 */
export function calculateSunChestaBala(sunSiderealLon: number, ayanamsaDeg: number): number {
  const trop = mod360(sunSiderealLon + ayanamsaDeg);
  let bhuja = trop;
  if (trop >  90 && trop < 180) bhuja = 180 - trop;
  else if (trop > 180 && trop < 270) bhuja = trop - 180;
  else if (trop > 270 && trop < 360) bhuja = 360 - trop;
  bhuja = Math.round(bhuja * 100) / 100;
  const ns = (trop >= 0 && trop < 180) ? 1 : -1;
  const decl = ns * inverseLagrange(AYANA_DECL_TABLE, AYANA_BHUJA, bhuja);
  return pyRound2((24.0 + decl) * 1.25) * 2;
}

/**
 * @deprecated Legacy Moon Paksha model. Use calculatePakshaBalaRaw() from shadbala.ts.
 * Kept for tests/strength/chestaBala.test.ts backward compatibility.
 */
export function calculateMoonChestaBala(moonSiderealLon: number, sunSiderealLon: number): number {
  return pyRound2(Math.abs(moonSiderealLon - sunSiderealLon) / 3);
}

/**
 * @deprecated Fix #4: Uses MEAN_DAILY_MOTION (heliocentric) → wrong ratio for Mercury/Venus.
 * Use evaluatePlanetChestaBala() from shadbala.ts (BPHS_ORIGINAL_27_23 mode).
 * Kept for tests/strength/chestaBala.test.ts and tests/phase8/chesta_method2.run.ts.
 */
export function calculateOuterPlanetChestaBala(planetName: string, speedLonDeg: number): number {
  const meanSpeed = MEAN_DAILY_MOTION[planetName];
  if (!meanSpeed) return 0;
  if (speedLonDeg < 0) return 60.0;
  const absSpeed = Math.abs(speedLonDeg);
  if (absSpeed < meanSpeed * STATIONARY_THRESHOLD) return 0.0;
  return Math.min(pyRound2((absSpeed / meanSpeed) * 60), 60);
}

/**
 * @deprecated Use evaluatePlanetChestaBala() per-planet from shadbala.ts instead.
 * Kept for backward compatibility with legacy callers and batch test suites.
 */
export function calculateChestaBalaAll(
  planets: Record<string, PlanetState>,
  ctx?: ChestaContext
): number[] {
  const PLANET_ORDER = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const;

  const getLon = (name: string): number => {
    const v = planets[name]?.totalLongitude;
    if (typeof v !== 'number' || !Number.isFinite(v))
      throw new Error(`Chesta Bala: missing longitude for "${name}"`);
    return v;
  };

  const getSpeed = (name: string): number => {
    const v = planets[name]?.speedLongitude;
    return (typeof v === 'number' && Number.isFinite(v)) ? v : 0;
  };

  const sunLon  = getLon('Sun');
  const moonLon = getLon('Moon');

  let sunChesta = 0;
  if (typeof ctx?.ayanamsaDegrees === 'number' && Number.isFinite(ctx.ayanamsaDegrees)) {
    sunChesta = calculateSunChestaBala(sunLon, ctx.ayanamsaDegrees);
  }

  const moonChesta = calculateMoonChestaBala(moonLon, sunLon);

  return PLANET_ORDER.map((name, i) => {
    if (i === 0) return sunChesta;
    if (i === 1) return moonChesta;
    return calculateOuterPlanetChestaBala(name, getSpeed(name));
  });
}
