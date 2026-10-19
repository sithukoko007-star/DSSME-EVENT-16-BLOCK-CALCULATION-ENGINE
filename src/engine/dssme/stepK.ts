/**
 * Step K: DIGIT VECTOR FORMATION
 *
 * Converts surviving planets → digit-strength vector D₀…D₉.
 * Identical for 2D and 3D geometries.
 *
 * Hard rules:
 *   K.5: Moon → skip entirely (contributes the EMPTY SET, full stop)
 *   K.1: Base digit families are IMMUTABLE
 *   K.6: Emphasis tiers with volatile/debilitated/exalted modifiers
 *   K.7-K.9: D_d = Σ CPS_pre_v3(p) × E(p,d)
 *   K.10: Rank and cluster
 */

import type { NineBody, Dignity } from "../../types/dssme-canonical-types.ts";
import type { Dssme16BlockResult } from "../../types/dssme-canonical-types.ts";
import type { PlanetCpsFactors, DigitVector } from "./types.ts";

// ============================================================================
// K.1 — Base planet digit families (IMMUTABLE)
// ============================================================================

interface DigitFamily {
  primary: number[];
  secondary: number[];
}

const BASE_DIGITS: Record<NineBody, DigitFamily> = {
  Sun:     { primary: [1], secondary: [4] },
  Moon:    { primary: [], secondary: [] },    // Moon: NO digits ever
  Mars:    { primary: [9], secondary: [3] },
  Mercury: { primary: [5], secondary: [0, 2, 8] },
  Jupiter: { primary: [3], secondary: [7] },
  Venus:   { primary: [6], secondary: [2, 9] },
  Saturn:  { primary: [8], secondary: [4] },
  Rahu:    { primary: [4], secondary: [0, 8] },
  Ketu:    { primary: [7], secondary: [2] },
};

// ============================================================================
// K.2 — Sign overlay digits
// ============================================================================

const SIGN_OVERLAY: Record<string, number[]> = {
  Aries:       [9, 1],
  Taurus:      [6],
  Gemini:      [5],
  Cancer:      [2],
  Leo:         [1],
  Virgo:       [5, 2],
  Libra:       [6],
  Scorpio:     [8],
  Sagittarius: [3, 9],
  Capricorn:   [8, 4],
  Aquarius:    [4, 7],
  Pisces:      [0],
};

// ============================================================================
// K.3 — Nakshatra digit overlay
// ============================================================================

interface NakshatraDigits { primary: number; secondary: number[] }

const NAKSHATRA_OVERLAY: Record<string, NakshatraDigits> = {
  "Ashwini":           { primary: 3, secondary: [1] },
  "Bharani":           { primary: 9, secondary: [1, 6] },
  "Krittika":          { primary: 1, secondary: [3, 6] },
  "Rohini":            { primary: 6, secondary: [2] },
  "Mrigashira":        { primary: 5, secondary: [2, 3] },
  "Ardra":             { primary: 8, secondary: [4, 5] },
  "Punarvasu":         { primary: 7, secondary: [1, 2] },
  "Pushya":            { primary: 8, secondary: [2, 6] },
  "Aslesha":           { primary: 4, secondary: [2, 7] },
  "Magha":             { primary: 1, secondary: [9] },
  "Purva Phalguni":    { primary: 6, secondary: [1, 9] },
  "Uttara Phalguni":   { primary: 6, secondary: [5, 1] },
  "Hasta":             { primary: 5, secondary: [2, 1] },
  "Chitra":            { primary: 3, secondary: [6, 5] },
  "Swati":             { primary: 4, secondary: [8, 6] },
  "Vishakha":          { primary: 8, secondary: [2, 6] },
  "Anuradha":          { primary: 8, secondary: [2, 9] },
  "Jyeshtha":          { primary: 3, secondary: [8, 1] },
  "Mula":              { primary: 7, secondary: [3, 9] },
  "Purva Ashadha":     { primary: 9, secondary: [4, 3] },
  "Uttara Ashadha":    { primary: 1, secondary: [8, 6] },
  "Shravana":          { primary: 8, secondary: [4, 1] },
  "Dhanishta":         { primary: 8, secondary: [7, 4] },
  "Shatabhisha":       { primary: 4, secondary: [8, 0] },
  "Purva Bhadrapada":  { primary: 7, secondary: [1, 0] },
  "Uttara Bhadrapada": { primary: 7, secondary: [0, 2] },
  "Revati":            { primary: 5, secondary: [0, 2] },
};

// ============================================================================
// K.4 — House overlay
// ============================================================================

const HOUSE_OVERLAY: Record<number, number[]> = {
  5:  [3, 9],
  11: [6, 8],
  9:  [1, 6],
  2:  [4, 1],
  8:  [7],
  // 6 and 12 → weaken (handled separately)
};
const WEAKENING_HOUSES = new Set([6, 12]);

// ============================================================================
// K.6 — Emphasis tiers
// ============================================================================

const E_STRONG      = 1.00;  // Base planet digit (primary)
const E_SEMI_STRONG = 0.85;  // Reinforced by sign or nakshatra
const E_MEDIUM      = 0.60;  // Normal secondary source
const E_WEAK_MEDIUM = 0.50;  // Weak secondary
const E_WEAK        = 0.40;  // Minor source
const E_ECHO        = 0.20;  // Dispositor echo only

const VOLATILE_PLANETS = new Set<NineBody>(["Rahu", "Mars", "Ketu"]);

function computePlanetDigitEmphasis(
  planet: NineBody,
  chart: Dssme16BlockResult
): Map<number, number> {
  // Moon: empty set — skip (K.5 hard rule)
  if (planet === "Moon") return new Map();

  const emphasisMap = new Map<number, number>();

  function addDigit(d: number, e: number) {
    const cur = emphasisMap.get(d) ?? 0;
    emphasisMap.set(d, Math.max(cur, e));
  }

  const family = BASE_DIGITS[planet];

  // Get planet sign and nakshatra from chart
  const planetEntry = chart.PLANETS[planet as keyof typeof chart.PLANETS] as
    { sign?: string; nakshatra?: string; dignity?: Dignity; dispositor_sign?: string } | undefined;
  const planetSign = planetEntry?.sign ?? "";
  const planetNakshatra = planetEntry?.nakshatra ?? "";
  const dignity = (planetEntry?.dignity ?? "Neutral") as Dignity;
  const dispositorSign = planetEntry?.dispositor_sign ?? "";

  // K.1 — Base digits
  for (const d of family.primary) addDigit(d, E_STRONG);
  for (const d of family.secondary) addDigit(d, E_MEDIUM);

  // K.2 — Sign overlay
  const signDigits = SIGN_OVERLAY[planetSign] ?? [];
  for (const d of signDigits) {
    const existing = emphasisMap.get(d) ?? 0;
    if (existing >= E_STRONG) {
      // Already primary — semi-strong reinforcement
      addDigit(d, E_SEMI_STRONG);
    } else if (existing >= E_MEDIUM) {
      // Was secondary — semi-strong reinforcement
      addDigit(d, E_SEMI_STRONG);
    } else {
      addDigit(d, E_WEAK_MEDIUM);
    }
  }

  // K.3 — Nakshatra overlay
  const nakEntry = NAKSHATRA_OVERLAY[planetNakshatra];
  if (nakEntry) {
    const existingPri = emphasisMap.get(nakEntry.primary) ?? 0;
    if (existingPri >= E_STRONG) {
      addDigit(nakEntry.primary, E_SEMI_STRONG);
    } else if (existingPri >= E_MEDIUM) {
      addDigit(nakEntry.primary, E_SEMI_STRONG);
    } else {
      addDigit(nakEntry.primary, E_WEAK_MEDIUM);
    }
    for (const d of nakEntry.secondary) {
      addDigit(d, E_WEAK);
    }
  }

  // K.4 — House overlay
  const housePos = chart.HOUSE_POSITIONS[planet];
  const houseNum = housePos?.house ?? 0;
  const houseDigits = HOUSE_OVERLAY[houseNum] ?? [];
  for (const d of houseDigits) {
    addDigit(d, E_WEAK_MEDIUM);
  }

  // K.5 — Dispositor sign (soft echo only)
  if (dispositorSign && dispositorSign !== planetSign) {
    const dispDigits = SIGN_OVERLAY[dispositorSign] ?? [];
    for (const d of dispDigits) {
      addDigit(d, E_ECHO);
    }
  }

  // K.6 — Apply modifiers to existing emphases
  const isVolatile = VOLATILE_PLANETS.has(planet);
  const isDebilitated = dignity === "Debilitated";
  const isExalted = dignity === "Exalted" || dignity === "Own" || dignity === "Moolatrikona";

  // Volatile planet: +10-15% to base-digit emphasis
  if (isVolatile) {
    for (const d of family.primary) {
      const cur = emphasisMap.get(d) ?? 0;
      if (cur > 0) emphasisMap.set(d, Math.min(1.20, cur * 1.12));
    }
  }

  // Exalted/Own: +10% to strongest-digit emphasis
  if (isExalted && family.primary.length > 0) {
    const strongestDigit = family.primary[0]!;
    const cur = emphasisMap.get(strongestDigit) ?? 0;
    if (cur > 0) emphasisMap.set(strongestDigit, Math.min(1.20, cur * 1.10));
  }

  // Debilitated: -20% to weakest-digit emphasis
  if (isDebilitated && family.secondary.length > 0) {
    const weakestDigit = family.secondary[family.secondary.length - 1]!;
    const cur = emphasisMap.get(weakestDigit) ?? 0;
    if (cur > 0) emphasisMap.set(weakestDigit, cur * 0.80);
  }

  // H6/H12 weakening: reduce smallest digit
  if (WEAKENING_HOUSES.has(houseNum) && emphasisMap.size > 0) {
    let minDigit = -1;
    let minVal = Infinity;
    for (const [d, e] of emphasisMap) {
      if (e < minVal) { minVal = e; minDigit = d; }
    }
    if (minDigit >= 0) emphasisMap.set(minDigit, minVal * 0.80);
  }

  return emphasisMap;
}

// ============================================================================
// Main Step K computation
// ============================================================================

export function computeDigitVector(
  P_S: PlanetCpsFactors[],
  chart: Dssme16BlockResult
): DigitVector {
  // K.7-K.9: D_d = Σ CPS_pre_v3(p) × E(p,d)
  const rawVector: Record<string, number> = {};
  const perPlanetContributions: Record<string, Record<string, number>> = {};

  for (let d = 0; d <= 9; d++) rawVector[d.toString()] = 0;

  for (const pf of P_S) {
    // Moon: skip (K.5)
    if (pf.planet === "Moon") continue;

    const emphMap = computePlanetDigitEmphasis(pf.planet, chart);
    const contributions: Record<string, number> = {};

    for (const [d, e] of emphMap) {
      const contrib = pf.CPS_pre_v3 * e;
      rawVector[d.toString()] = (rawVector[d.toString()] ?? 0) + contrib;
      contributions[d.toString()] = (contributions[d.toString()] ?? 0) + contrib;
    }

    perPlanetContributions[pf.planet] = contributions;
  }

  // Normalize vector
  const total = Object.values(rawVector).reduce((a, b) => a + b, 0);
  const normalized: Record<string, number> = {};
  for (let d = 0; d <= 9; d++) {
    normalized[d.toString()] = total > 0
      ? (rawVector[d.toString()] ?? 0) / total
      : 0;
  }

  // K.10 — Rank and identify clusters
  const maxRaw = Math.max(...Object.values(rawVector));

  // Sort digits by descending strength
  const ranked = Object.entries(rawVector)
    .map(([d, v]) => ({ d: parseInt(d), v }))
    .sort((a, b) => b.v - a.v);

  // Primary: top 3-4
  const primaryCluster = ranked.slice(0, 4)
    .filter(x => x.v > 0)
    .map(x => x.d);

  // Secondary: positions 5-7 (indices 4-6)
  const secondaryCluster = ranked.slice(4, 7)
    .filter(x => x.v > 0)
    .map(x => x.d);

  // Volatile digits: {0,4,7,9} present among survivors' contributions
  const VOLATILE_SET = new Set([0, 4, 7, 9]);
  const volatileDigits = ranked
    .filter(x => VOLATILE_SET.has(x.d) && x.v > 0)
    .map(x => x.d);

  // Shadow/Noise: strength < 0.08 × max(D)
  const shadowThreshold = 0.08 * maxRaw;
  const shadowDigits = ranked
    .filter(x => x.v > 0 && x.v < shadowThreshold)
    .map(x => x.d);

  return {
    raw: rawVector,
    normalized,
    primaryCluster,
    secondaryCluster,
    volatileDigits,
    shadowDigits,
    perPlanetContributions,
  };
}
