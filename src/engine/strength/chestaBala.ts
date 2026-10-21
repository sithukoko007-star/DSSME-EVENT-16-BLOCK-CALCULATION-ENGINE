/**
 * DSSME EVENT ENGINE V1.0 - CHESTA BALA (MOTIONAL STRENGTH) -- METHOD 2: SPEED & RETROGRADE
 * Source of truth: Brihat Parashara Hora Shastra (BPHS) Ch.27
 */

import { PlanetState } from '../types.js';
import { SHADBALA_PLANETS } from './shadbalaConstants.js';

// ── Planet index constants ────────────────────────────────────────────────────
const SUN = 0, MOON = 1;

// ── Mean daily motions (degrees/day) — Surya-Siddhanta / BPHS ───────────────
export const MEAN_DAILY_MOTION: Record<string, number> = {
  Mars:    0.524,
  Mercury: 4.0923,
  Jupiter: 0.0831,
  Venus:   1.60215,
  Saturn:  0.033439,
};

/** Fraction of mean motion below which a planet is considered stationary. */
export const STATIONARY_THRESHOLD = 0.05;

// ── Ayana declination table (7-point, Surya-Siddhanta) ───────────────────────
const AYANA_BHUJA      = [0, 15, 30, 45, 60, 75, 90];
const AYANA_DECL_TABLE = [0, 362 / 60, 703 / 60, 1002 / 60, 1238 / 60, 1388 / 60, 1440 / 60];

// ── Pure math helpers ────────────────────────────────────────────────────────

/** Python-compatible round(x, 2): exact 0.5 ties → nearest even digit. */
function pyRound2(x: number): number {
  const s = x * 100, fl = Math.floor(s);
  if (s - fl === 0.5) return (fl % 2 === 0 ? fl : fl + 1) / 100;
  return Math.round(s) / 100;
}

const mod360 = (x: number): number => ((x % 360) + 360) % 360;

/** Lagrange inverse interpolation (7-point table). */
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

// ── Sun Chesta Bala (Ayana model) ─────────────────────────────────────────────
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

// ── Moon Chesta Bala (Paksha model) ──────────────────────────────────────────
export function calculateMoonChestaBala(moonSiderealLon: number, sunSiderealLon: number): number {
  return pyRound2(Math.abs(moonSiderealLon - sunSiderealLon) / 3);
}

// ── Outer planet Chesta Bala (Speed & Retrograde — BPHS Method 2) ────────────
export function calculateOuterPlanetChestaBala(planetName: string, speedLonDeg: number): number {
  const meanSpeed = MEAN_DAILY_MOTION[planetName];
  if (!meanSpeed) return 0;

  // Retrograde motion → full 60 virupas
  if (speedLonDeg < 0) return 60.0;

  const absSpeed = Math.abs(speedLonDeg);

  // Stationary (speed < 5% of mean) → 0 virupas
  if (absSpeed < meanSpeed * STATIONARY_THRESHOLD) return 0.0;

  // Direct motion → proportional, capped at 60
  return Math.min(pyRound2((absSpeed / meanSpeed) * 60), 60);
}

// ── Context interface ─────────────────────────────────────────────────────────
export interface ChestaContext {
  ayanamsaDegrees?: number;
  localJulianDay?:  number;
  placeLongitude?:  number;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function calculateChestaBalaAll(
  planets: Record<string, PlanetState>,
  ctx?: ChestaContext
): number[] {
  const getLon = (name: string): number => {
    const v = planets[name]?.totalLongitude;
    if (typeof v !== 'number' || !Number.isFinite(v))
      throw new Error(`Chesta Bala: missing longitude for "${name}"`);
    return v;
  };

  const getSpeed = (name: string): number => {
    const v = planets[name]?.speedLongitude;
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return 0;
    }
    return v;
  };

  const sunLon  = getLon('Sun');
  const moonLon = getLon('Moon');

  // ── Sun (Ayana model) ──
  let sunChesta = 0;
  if (typeof ctx?.ayanamsaDegrees === 'number' && Number.isFinite(ctx.ayanamsaDegrees)) {
    sunChesta = calculateSunChestaBala(sunLon, ctx.ayanamsaDegrees);
  }

  // ── Moon (Paksha model) ──
  const moonChesta = calculateMoonChestaBala(moonLon, sunLon);

  // ── Outer 5 (Speed & Retrograde method) ──
  return SHADBALA_PLANETS.map((name, i) => {
    if (i === SUN)  return sunChesta;
    if (i === MOON) return moonChesta;
    return calculateOuterPlanetChestaBala(name, getSpeed(name));
  });
}
