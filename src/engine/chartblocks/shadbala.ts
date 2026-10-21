/**
 * BLOCK_6 — SHADBALA
 * Computes the six Shadbala components for each of the 7 classical planets.
 *
 * Six components (all in Virupas = 1/60 Rupa):
 *   1. Sthana Bala  — Positional strength
 *   2. Dig Bala     — Directional strength
 *   3. Kaala Bala   — Temporal strength (9 sub-components)
 *   4. Chesta Bala  — Motional strength
 *   5. Naisargika Bala — Natural/constant strength
 *   6. Drig Bala    — Aspectual strength (can be negative)
 *
 * Minimum required virupas: Sun 390, Moon 360, Mars 300,
 *   Mercury 420, Jupiter 390, Venus 330, Saturn 300.
 *
 * NOTE: Bhava Bala NEVER enters RS(p) — Hard Rule 10 / §3.1 Rule 11.
 *
 * Implementation uses classical Parashari formulas. Several sub-components
 * require chart instant data (hora, weekday, paksha) which are passed in.
 */

import type {
  ClassicalPlanet,
  KaalaBalaComponents,
  ShadbalaBlock,
  ZodiacSign,
} from "../../types/dssme-canonical-types.ts";
import { ZODIAC_SIGNS_ARIES_FIRST } from "../../types/dssme-canonical-types.ts";
import type { BlockContext, BlockResult } from "../blocks/blockTypes.ts";
import { finalizeBlock, warningIssue } from "../blocks/blockResult.ts";
import { SIGN_LORDS } from "../astronomy/planetaryPositions.ts";
import {
  calculateChestaBalaAll,
  calculateOuterPlanetChestaBala,
} from "../strength/chestaBala.ts";

export const CLASSICAL_PLANETS_ORDER: ClassicalPlanet[] = [
  "Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn",
];

// §2.2 BLOCK_6: minimum required virupas per planet
export const MINIMUM_REQUIRED_VIRUPAS: number[] = [390, 360, 300, 420, 390, 330, 300];

// Naisargika Bala — natural constant strength (virupas)
const NAISARGIKA_BALA: Record<ClassicalPlanet, number> = {
  Sun: 60.0,
  Moon: 51.43,
  Mars: 17.14,
  Mercury: 25.71,
  Jupiter: 34.29,
  Venus: 42.86,
  Saturn: 8.57,
};

// Exaltation degrees (exact degrees for Uchcha Bala)
const EXALTATION_DEG: Record<ClassicalPlanet, number> = {
  Sun: 10,        // 10° Aries
  Moon: 33,       // 3° Taurus = 30+3
  Mars: 298,      // 28° Capricorn = 270+28
  Mercury: 165,   // 15° Virgo = 150+15
  Jupiter: 95,    // 5° Cancer = 90+5
  Venus: 357,     // 27° Pisces = 330+27
  Saturn: 200,    // 20° Libra = 180+20
};

// Debilitation degrees (opposite)
const DEBILITATION_DEG: Record<ClassicalPlanet, number> = {
  Sun: 190,
  Moon: 213,
  Mars: 118,
  Mercury: 345,
  Jupiter: 275,
  Venus: 177,
  Saturn: 20,
};

// Dig Bala: which house gives maximum directional strength
const DIG_BALA_MAX_HOUSE: Record<ClassicalPlanet, number> = {
  Sun: 10,
  Moon: 4,
  Mars: 10,
  Mercury: 1,
  Jupiter: 1,
  Venus: 4,
  Saturn: 7,
};

/**
 * Uchcha Bala (exaltation component of Sthana Bala).
 * = 60 - |longitude - exaltation_longitude| / 3 (virupas, 0–60)
 */
function uchhaBala(planet: ClassicalPlanet, siderealLon: number): number {
  const exaltLon = EXALTATION_DEG[planet];
  const debitLon = DEBILITATION_DEG[planet];
  // Use shorter arc distance to exaltation
  let diff = Math.abs(siderealLon - exaltLon) % 360;
  if (diff > 180) diff = 360 - diff;
  return Math.max(0, 60 - diff / 3);
}

/**
 * Kendradi Bala: Angular = 60, Succedent = 30, Cadent = 15 virupas
 */
function kendradiBala(house: number): number {
  const angular = [1, 4, 7, 10];
  const succedent = [2, 5, 8, 11];
  if (angular.includes(house)) return 60;
  if (succedent.includes(house)) return 30;
  return 15; // Cadent
}

/**
 * Drekkana Bala: 15 virupas for planets in odd positions of odd signs,
 * or even positions of even signs (classical formula).
 */
function drekkana(planet: ClassicalPlanet, signDegree: number, sign: ZodiacSign): number {
  const signIdx = ZODIAC_SIGNS_ARIES_FIRST.indexOf(sign);
  const isOddSign = signIdx % 2 === 0; // 0-indexed Aries, Gemini etc.
  const drekkanaPos = Math.floor(signDegree / 10) + 1; // 1, 2, or 3
  const isOddDrekkana = drekkanaPos % 2 === 1;

  if ((isOddSign && isOddDrekkana) || (!isOddSign && !isOddDrekkana)) return 15;
  return 0;
}

/**
 * Ojha Yugma Rasyamsha Bala (BPHS Ch.27):
 *   Male planets (Sun, Mars, Jupiter, Saturn) → 15 virupas in odd signs
 *   Female planets (Moon, Venus)              → 15 virupas in even signs
 *   Mercury is NAPUMSAKA (hermaphrodite)      → 15 virupas in ALL signs
 *
 * BPHS: "Mercury being a eunuch (napumsaka) has strength in both kinds of signs."
 */
function ojhaYugmaBala(planet: ClassicalPlanet, sign: ZodiacSign): number {
  // Mercury is hermaphrodite — always 15 (BPHS explicit rule)
  if (planet === "Mercury") return 15;

  const signIdx = ZODIAC_SIGNS_ARIES_FIRST.indexOf(sign);
  const isOddSign = signIdx % 2 === 0; // 0-indexed: Aries=0(odd), Taurus=1(even), etc.
  const malePlanets: ClassicalPlanet[] = ["Sun", "Mars", "Jupiter", "Saturn"];
  const femalePlanets: ClassicalPlanet[] = ["Moon", "Venus"];

  if (isOddSign && malePlanets.includes(planet)) return 15;
  if (!isOddSign && femalePlanets.includes(planet)) return 15;
  return 0;
}

/**
 * Dig Bala — directional strength.
 * Max at specific house (60 virupas); drops linearly to 0 at opposite house.
 */
function digBala(planet: ClassicalPlanet, house: number): number {
  const maxHouse = DIG_BALA_MAX_HOUSE[planet];
  let diff = Math.abs(house - maxHouse);
  if (diff > 6) diff = 12 - diff;
  // Scale: at 0 diff → 60; at 6 diff → 0
  return Math.max(0, 60 - (diff * 10));
}

/**
 * Dignity score mapping for Saptavargaja Bala computation.
 * Full Saptavargaja uses 7 vargas (D1,D2,D3,D7,D9,D12,D30).
 * This partial implementation uses D1+D9 (2 of 7 vargas available).
 *
 * Per-varga score (Parashari):
 *   Exalted/Moolatrikona → 20; Own → 15; Grt.Friend → 12; Friend → 10;
 *   Neutral → 7; Enemy → 5; Grt.Enemy → 3; Debilitated → 2
 * Maximum per varga (Exalted) = 20 → max 2 vargas = 40.
 * We scale D1+D9 score to fit within the partial range:
 *   Full Saptavargaja range: 15 (all debilitated) → 150 (all exalted).
 *   D1+D9 partial contribution (2/7): scaled proportionally.
 */
function dignityScore(dignity: string): number {
  switch (dignity) {
    case "Exalted":      return 20;
    case "Moolatrikona": return 20;
    case "Own":          return 15;
    case "Grt.Friend":   return 12;
    case "Friend":       return 10;
    case "Neutral":      return 7;
    case "Enemy":        return 5;
    case "Grt.Enemy":    return 3;
    case "Debilitated":  return 2;
    default:             return 7; // neutral fallback
  }
}

function saptavargajaBalaPartial(
  planet: ClassicalPlanet,
  d1Sign: ZodiacSign,
  d1Degree: number,
  d9Sign: ZodiacSign
): number {
  // D1 dignity
  const d1Dignity = getClassicalDignityForSapta(planet, d1Sign, d1Degree);
  const d1Score = dignityScore(d1Dignity);

  // D9 dignity
  const d9Dignity = getClassicalDignityForSapta(planet, d9Sign, undefined);
  const d9Score = dignityScore(d9Dignity);

  // Sum of D1+D9 (max=40 if both exalted, min=4 if both debilitated)
  const rawScore = d1Score + d9Score;

  // Scale to Saptavargaja partial range.
  // We approximate: treating D1+D9 as 2 of 7 vargas, each max=20.
  // Full range (7 vargas): min=7*2=14, max=7*20=140.
  // D1+D9 range: min=4, max=40.
  // Scale linearly into [14, 140] proportional to 2/7:
  // partial = 14 + (rawScore - 4) / (40 - 4) * (140 - 14)
  const scaled = 14 + ((rawScore - 4) / 36) * 126;
  return parseFloat(Math.min(140, Math.max(14, scaled)).toFixed(2));
}

// Inline dignity helper for Saptavargaja (avoids circular import)
const _SAPTA_EXALT: Record<ClassicalPlanet, ZodiacSign> = {
  Sun: "Aries", Moon: "Taurus", Mars: "Capricorn", Mercury: "Virgo",
  Jupiter: "Cancer", Venus: "Pisces", Saturn: "Libra",
};
const _SAPTA_DEBIT: Record<ClassicalPlanet, ZodiacSign> = {
  Sun: "Libra", Moon: "Scorpio", Mars: "Cancer", Mercury: "Pisces",
  Jupiter: "Capricorn", Venus: "Virgo", Saturn: "Aries",
};
const _SAPTA_OWN: Record<ClassicalPlanet, ZodiacSign[]> = {
  Sun: ["Leo"], Moon: ["Cancer"], Mars: ["Aries", "Scorpio"],
  Mercury: ["Gemini", "Virgo"], Jupiter: ["Sagittarius", "Pisces"],
  Venus: ["Taurus", "Libra"], Saturn: ["Capricorn", "Aquarius"],
};
const _SAPTA_MULA_SIGN: Record<ClassicalPlanet, ZodiacSign> = {
  Sun: "Leo", Moon: "Taurus", Mars: "Aries", Mercury: "Virgo",
  Jupiter: "Sagittarius", Venus: "Libra", Saturn: "Aquarius",
};
const _SAPTA_MULA_RANGE: Record<ClassicalPlanet, [number, number]> = {
  Sun: [0, 20], Moon: [4, 20], Mars: [0, 12], Mercury: [15, 20],
  Jupiter: [0, 10], Venus: [0, 15], Saturn: [0, 20],
};
const _SAPTA_FRIEND: Record<ClassicalPlanet, Partial<Record<ClassicalPlanet, string>>> = {
  Sun:     { Moon: "Friend", Mars: "Friend", Jupiter: "Friend", Mercury: "Neutral", Venus: "Enemy", Saturn: "Enemy" },
  Moon:    { Sun: "Friend", Mercury: "Friend", Mars: "Neutral", Jupiter: "Neutral", Venus: "Neutral", Saturn: "Neutral" },
  Mars:    { Sun: "Friend", Moon: "Friend", Jupiter: "Friend", Venus: "Neutral", Saturn: "Neutral", Mercury: "Enemy" },
  Mercury: { Sun: "Friend", Venus: "Friend", Mars: "Neutral", Jupiter: "Neutral", Saturn: "Neutral", Moon: "Enemy" },
  Jupiter: { Sun: "Friend", Moon: "Friend", Mars: "Friend", Saturn: "Neutral", Mercury: "Enemy", Venus: "Enemy" },
  Venus:   { Mercury: "Friend", Saturn: "Friend", Mars: "Neutral", Jupiter: "Neutral", Sun: "Enemy", Moon: "Enemy" },
  Saturn:  { Mercury: "Friend", Venus: "Friend", Jupiter: "Neutral", Sun: "Enemy", Moon: "Enemy", Mars: "Enemy" },
};
const _SAPTA_SIGN_LORDS: Record<ZodiacSign, ClassicalPlanet> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon",
  Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Mars",
  Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter",
};

function getClassicalDignityForSapta(
  planet: ClassicalPlanet,
  sign: ZodiacSign,
  signDegree?: number
): string {
  if (_SAPTA_EXALT[planet] === sign) return "Exalted";
  if (_SAPTA_DEBIT[planet] === sign) return "Debilitated";
  const mooSign = _SAPTA_MULA_SIGN[planet];
  const mooRange = _SAPTA_MULA_RANGE[planet];
  if (mooSign === sign && mooRange) {
    const deg = signDegree ?? 0;
    if (deg >= mooRange[0] && deg < mooRange[1]) return "Moolatrikona";
  }
  if ((_SAPTA_OWN[planet] ?? []).includes(sign)) return "Own";
  const signLord = _SAPTA_SIGN_LORDS[sign];
  if (signLord === planet) return "Own";
  const friendLevel = _SAPTA_FRIEND[planet]?.[signLord];
  return friendLevel ?? "Neutral";
}

/**
 * Sthana Bala (positional strength) = sum of sub-components.
 * Sub-components: Uchcha, Saptavargaja (D1+D9 partial), Ojha-Yugma, Kendradi, Drekkana
 */
function sthanaBala(
  planet: ClassicalPlanet,
  siderealLon: number,
  sign: ZodiacSign,
  signDegree: number,
  house: number
): number {
  const uchcha = uchhaBala(planet, siderealLon);

  // Saptavargaja Bala — D1+D9 partial computation (2 of 7 vargas)
  const d9Sign = navamshaSignForSapta(siderealLon);
  const saptavargaja = saptavargajaBalaPartial(planet, sign, signDegree, d9Sign);

  const ojhaYugma = ojhaYugmaBala(planet, sign);
  const kendradi = kendradiBala(house);
  const drekkanaB = drekkana(planet, signDegree, sign);

  return uchcha + saptavargaja + ojhaYugma + kendradi + drekkanaB;
}

/** D-9 sign from D-1 sidereal longitude (for Saptavargaja). */
function navamshaSignForSapta(siderealLon: number): ZodiacSign {
  const d9Lon = (siderealLon * 9) % 360;
  const signIdx = Math.floor(d9Lon / 30);
  return ZODIAC_SIGNS_ARIES_FIRST[signIdx]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// PL9 STANDARD — PHASE A (Checkpoint 3)
// Implements Parashara's Light 9 standard for Kaala Bala sub-components:
//   • Paksha Bala  — true Moon-Sun elongation formula (not tithi-index proxy)
//   • Ayana Bala   — true planetary declination formula (PL9 kranti method)
//   • Nathonnatha  — JD-based True Apparent Midnight (Equation of Time corrected)
//   • Sun/Moon Chesta Bala → filled by Ayana/Paksha Bala respectively (BPHS dviguṇa rule)
// ─────────────────────────────────────────────────────────────────────────────

// Mean obliquity of ecliptic (J2000 epoch; good to ±0.01° for 2020–2030)
const OBLIQUITY_DEG = 23.4393;
const OBLIQUITY_RAD = OBLIQUITY_DEG * (Math.PI / 180);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Degrees → Radians */
function toRad(d: number): number { return d * (Math.PI / 180); }
/** Radians → Degrees */
function toDeg(r: number): number { return r * (180 / Math.PI); }

/**
 * PL9 Paksha Bala (B.V. Raman, Graha & Bhava Balas Ch.II)
 *
 * Uses ACTUAL Moon-Sun elongation (degrees), not the tithi-index proxy.
 * "dviguṇa" rule: Moon's Paksha Bala fills BOTH the Paksha Bala slot AND
 * the Chesta Bala slot (Moon never retrogrades, so no separate Chesta Bala).
 *
 * beneficPB = |elongation - 180°| / 3  gives:
 *   0° (Amavasya) → 60 virupas for MALEFICS, 0 for BENEFICS
 *   180° (Purnima) → 60 virupas for BENEFICS, 0 for MALEFICS
 *   (continuous linear gradient between)
 *
 * Formula: elongation = (moonLon − sunLon + 360) mod 360
 *          beneficPB  = 60 − |elongation − 180| / 3   [0–60 virupas]
 *          maleficPB  = 60 − beneficPB               [0–60 virupas]
 *
 * @param moonLon sidereal Moon longitude (degrees)
 * @param sunLon  sidereal Sun longitude (degrees)
 * @param isBenefic true for Moon/Mercury/Jupiter/Venus
 */
function pakshaBalaValue(moonLon: number, sunLon: number, isBenefic: boolean): number {
  const elongation = (moonLon - sunLon + 360) % 360; // 0°=Amavasya, 180°=Purnima
  const beneficPB = Math.max(0, 60 - Math.abs(elongation - 180) / 3);
  return parseFloat((isBenefic ? beneficPB : 60 - beneficPB).toFixed(4));
}

/**
 * Planet declination from sidereal longitude + ayanamsa.
 * Converts sidereal → tropical longitude, then applies spherical formula.
 *
 * sin(δ) = sin(ε) × sin(λ_tropical)
 *
 * @param siderealLon sidereal longitude (degrees)
 * @param ayanamsaDeg Lahiri ayanamsa (degrees)
 */
function planetDeclination(siderealLon: number, ayanamsaDeg: number): number {
  const tropicalLon = (siderealLon + ayanamsaDeg) % 360;
  const sinDec = Math.sin(OBLIQUITY_RAD) * Math.sin(toRad(tropicalLon));
  return toDeg(Math.asin(Math.max(-1, Math.min(1, sinDec)))); // degrees, −23.44 to +23.44
}

/**
 * PL9 Ayana Bala — per-planet declination strength (B.V. Raman Ch.II §Ayana Bala).
 *
 * Formula: (kranti + ε) / (2ε) × 60
 *   ε = obliquity (23.4393°)
 *   kranti = planet's declination (north = +, south = −)
 *   At max north (+23.44°): 60 virupas
 *   At equator (0°):         30 virupas
 *   At max south (−23.44°):  0  virupas
 *
 * "ayanāt tu raver dvighnam" (BPHS Ch.27): Sun's Ayana Bala fills BOTH the
 * Ayana Bala slot AND the Chesta Bala slot (Sun never retrogrades).
 *
 * @param declinationDeg planet's declination in degrees
 */
function ayanaBalaFromDeclination(declinationDeg: number): number {
  const val = ((declinationDeg + OBLIQUITY_DEG) / (2 * OBLIQUITY_DEG)) * 60;
  return parseFloat(Math.min(60, Math.max(0, val)).toFixed(4));
}

/**
 * Equation of Time approximation (Spencer 1971, accurate to ±30 s).
 * Returns EoT in minutes (positive = apparent faster than mean).
 *
 * B = 2π × (N − 81) / 364  [radians, N = day-of-year 1..365]
 * EoT_min = 9.87 sin(2B) − 7.53 cos(B) − 1.5 sin(B)
 *
 * @param julianDayUt Julian Day UT
 */
function equationOfTimeMinutes(julianDayUt: number): number {
  // Day of year from JD
  const jd0 = Math.floor(julianDayUt - 0.5) + 0.5; // JD at UT noon of that day
  // Approximate Julian Day of Jan 1 of that year
  const year = new Date((julianDayUt - 2440587.5) * 86400000).getUTCFullYear();
  const jan1Jd = 2440587.5 + Date.UTC(year, 0, 1) / 86400000;
  const N = Math.round(jd0 - jan1Jd) + 1; // day of year (1..366)
  const B = 2 * Math.PI * (N - 81) / 364;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

/**
 * True Apparent Midnight JD UT (PL9 method).
 * This is when the Sun crosses the Nadir (IC / lower culmination) at the chart location.
 *
 * True Solar Noon UT = 12h − longitude/15 − EoT_hours
 * True Apparent Midnight = nearest True Solar Noon ± 12h to chartJd
 *
 * @param chartJd      Julian Day UT of birth
 * @param longitudeDeg geographic east longitude (degrees)
 */
function trueApparentMidnightJd(chartJd: number, longitudeDeg: number): number {
  const eotHours = equationOfTimeMinutes(chartJd) / 60;
  // True Solar Noon UT on the chart date (hours)
  const trueSolarNoonHours = 12 - longitudeDeg / 15 - eotHours;
  // Convert to JD: floor of chartJd gives integer JD at UT noon; offset to date
  const jdDate = Math.floor(chartJd - 0.5) + 0.5; // JD of UT noon on chart day
  const trueSolarNoonJd = jdDate + (trueSolarNoonHours - 12) / 24;
  // Two candidate midnights: previous (−12h) and next (+12h)
  const prevMidnightJd = trueSolarNoonJd - 0.5; // 12h before noon
  const nextMidnightJd = trueSolarNoonJd + 0.5; // 12h after noon
  // Return whichever is closest to chartJd
  return Math.abs(chartJd - prevMidnightJd) <= Math.abs(chartJd - nextMidnightJd)
    ? prevMidnightJd
    : nextMidnightJd;
}

/**
 * Nathonnatha Bala (PL9 method) — time-distance from True Apparent Midnight.
 *
 * Classical rules (B.V. Raman Ch.II, BPHS Ch.27):
 *   Nata ghatis  = time from True Apparent Midnight → birth  (0–30 ghatis, max at noon)
 *   Unnata ghatis = 30 − Nata ghatis                          (0–30 ghatis, max at midnight)
 *   (60 ghatis = 24 hours; 1 ghati = 24 min)
 *
 *   Diurnal (Sun, Jupiter, Saturn): Natonnata = Unnata ghatis [stronger by day]
 *   Nocturnal (Moon, Mars, Venus):  Natonnata = Nata ghatis   [stronger at midnight]
 *   Mercury:                        Natonnata = max(Nata, Unnata) [always ≥ 15]
 *
 * Returns virupas (= ghatis directly, max 30).
 */
function natonnathaBala(
  planet: ClassicalPlanet,
  chartJd: number,
  longitudeDeg: number,
): number {
  const midnightJd = trueApparentMidnightJd(chartJd, longitudeDeg);
  const distHours = Math.abs(chartJd - midnightJd) * 24; // 0 at midnight, 12 at noon
  // Nata ghatis (0 at midnight, 30 at noon)
  const nataGhatis = Math.min(30, (distHours / 24) * 60);
  const unnataGhatis = 30 - nataGhatis;

  const diurnal: ClassicalPlanet[] = ["Sun", "Jupiter", "Saturn"];
  const nocturnal: ClassicalPlanet[] = ["Moon", "Mars", "Venus"];

  let ghatis: number;
  if (diurnal.includes(planet)) {
    ghatis = unnataGhatis; // max at noon (12h from midnight)
  } else if (nocturnal.includes(planet)) {
    ghatis = nataGhatis;   // max at midnight (0h from midnight)
  } else {
    ghatis = Math.max(nataGhatis, unnataGhatis); // Mercury: always ≥ 15
  }

  return parseFloat(ghatis.toFixed(4)); // virupas (= ghatis, max 30)
}

// ── Kaala Bala ───────────────────────────────────────────────────────────────

/**
 * Kaala Bala — temporal strength (9 sub-components).
 *
 * PL9 Phase A improvements:
 *   ① Paksha Bala  — elongation-based (not tithi-index proxy)
 *   ② Ayana Bala   — per-planet declination (kranti) formula
 *   ③ Nathonnatha  — True Apparent Midnight via Equation of Time
 *
 * Remaining (open-gate, unchanged):
 *   Abda Bala  — fixed at 15 (requires multi-year ephemeris)
 *   Masa Bala  — weekday+tithi approximation
 *   Yuddha Bala — 0 (requires full position comparison pass)
 */
export interface KaalaInput {
  paksha: "shukla" | "krishna";
  tithiIndex: number;       // 1..30
  weekday: number;          // 0=Sun..6=Sat
  hora: ClassicalPlanet;    // current hora lord
  isNight: boolean;         // chart time is after sunset
  moonLon: number;          // sidereal Moon longitude
  sunLon: number;           // sidereal Sun longitude
  // PL9 Phase A additions:
  chartJd: number;          // Julian Day UT of birth (for Nathonnatha)
  longitude: number;        // geographic east longitude (for Nathonnatha)
  ayanamsaDeg: number;      // Lahiri ayanamsa (for Ayana Bala declination)
  /** Per-planet pre-computed Ayana Bala (passed by buildShadbalaBlock) */
  planetAyana?: number;
}

/**
 * Internal result carrying individual sub-bala values for reuse in Chesta Bala.
 */
interface KaalaResult {
  total: number;
  paksha: number;   // exported so Moon's Chesta Bala = paksha
  ayana: number;    // exported so Sun's Chesta Bala = ayana
}

function kaalaBalaForPlanet(planet: ClassicalPlanet, input: KaalaInput): KaalaResult {
  const benefics: ClassicalPlanet[] = ["Moon", "Mercury", "Jupiter", "Venus"];
  const isBenefic = benefics.includes(planet);

  // ① Nathonnatha Bala — PL9: JD-based True Apparent Midnight (max 30 virupas)
  const nathonnatha = natonnathaBala(planet, input.chartJd, input.longitude);

  // ② Paksha Bala — PL9: elongation-based formula (max 60 virupas)
  //    B.V. Raman: beneficPB = elongation/3 (0 at Amavasya, 60 at Purnima)
  //                maleficPB = 60 − beneficPB (inverse)
  const paksha = pakshaBalaValue(input.moonLon, input.sunLon, isBenefic);

  // ③ Tribhaga Bala — unchanged (day/night thirds)
  let tribhaga = 0;
  if (!input.isNight) {
    if (["Saturn", "Mercury", "Moon"].includes(planet)) tribhaga = 60;
  } else {
    if (["Moon", "Mercury", "Mars"].includes(planet)) tribhaga = 60;
  }

  // ④ Abda Bala — open gate; fixed at 15 (requires multi-year ephemeris for solar year lord)
  const abda = 15;

  // ⑤ Masa Bala — open gate; approximate lunar month lord
  const masaLords: ClassicalPlanet[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  const masaLord = masaLords[(input.weekday + input.tithiIndex) % 7]!;
  const masa = masaLord === planet ? 60 : 0;

  // ⑥ Vaara Bala — weekday lord
  const vaaraLords: ClassicalPlanet[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  const vaara = vaaraLords[input.weekday] === planet ? 45 : 0;

  // ⑦ Hora Bala
  const hora = input.hora === planet ? 60 : 0;

  // ⑧ Ayana Bala — PL9: uses pre-computed per-planet declination (passed as input.ayana)
  //    This field is set per-planet in buildShadbalaBlock before calling this function.
  const ayana = input.planetAyana ?? 30; // fallback 30 (neutral) if not supplied

  // ⑨ Yuddha Bala — open gate; 0 (requires full planetary-war comparison pass)
  const yuddha = 0;

  const total = nathonnatha + paksha + tribhaga + abda + masa + vaara + hora + ayana + yuddha;
  return { total: parseFloat(total.toFixed(4)), paksha, ayana };
}

/**
 * Chesta Bala — motional strength.
 *
 * PL9 dviguṇa rules (BPHS Ch.27):
 *   Sun  → Chesta Bala = Ayana Bala  (Sun never retrogrades; Ayana Bala fills both slots)
 *   Moon → Chesta Bala = Paksha Bala (Moon never retrogrades; Paksha Bala fills both slots)
 *   Others → speed-based (retrograde = max 60; stationary = 0; proportional otherwise)
 *
 * Mean speeds (deg/day): Sun 0.9833, Moon 13.1833, Mars 0.5241,
 *   Mercury 1.3833, Jupiter 0.0831, Venus 1.2, Saturn 0.0334
 */
/**
 * Chesta Bala — motional strength (Method 2: Speed & Retrograde BPHS Classical).
 *
 * Sun  → Sun Chesta Bala = Ayana Bala (BPHS Ch.27)
 * Moon → Moon Chesta Bala = Paksha Bala (BPHS Ch.27)
 * Mars, Mercury, Jupiter, Venus, Saturn → Delegated to calculateOuterPlanetChestaBala:
 *   - Retrograde (speed < 0) → 60 virupas (full max)
 *   - Stationary (|speed| < mean * 0.05) → 0 virupas
 *   - Direct (speed > 0) → min(round(|speed| / mean * 60, 2), 60)
 */
function chestaBala(
  planet: ClassicalPlanet,
  speedLon: number,
  sunAyanaBala: number,   // pre-computed Sun Ayana Bala (for Sun's Chesta slot)
  moonPakshaBala: number, // pre-computed Moon Paksha Bala (for Moon's Chesta slot)
): number {
  if (planet === "Sun")  return sunAyanaBala;
  if (planet === "Moon") return moonPakshaBala;
  return calculateOuterPlanetChestaBala(planet, speedLon);
}

/**
 * Drig Bala — aspectual strength received from other planets (BPHS Ch.27).
 *
 * BPHS Aspect Fractions (virupas = fraction × 60):
 *   ALL planets: 7th house = FULL (60 virupas)
 *   Mars special:    4th = 1/4 (15), 8th = 3/4 (45)
 *   Jupiter special: 5th = 1/2 (30), 9th = FULL (60)
 *   Saturn special:  3rd = 1/4 (15), 10th = 3/4 (45)
 *
 * Malefic aspects reduce Drig Bala (negative contribution).
 * Benefic aspects increase Drig Bala (positive contribution).
 * Result can be negative (net malefic influence).
 *
 * Note: "diff" = houses counted forward FROM aspecting planet TO target.
 * diff=7 means target is 7 houses ahead of aspecting planet.
 */
function drigBala(
  planet: ClassicalPlanet,
  allPlanets: Record<ClassicalPlanet, { house: number; sign: ZodiacSign; isRetrograde: boolean }>
): number {
  let total = 0;
  const beneficPlanets: ClassicalPlanet[] = ["Jupiter", "Venus", "Moon", "Mercury"];
  const maleficPlanets: ClassicalPlanet[] = ["Sun", "Mars", "Saturn"];

  const targetHouse = allPlanets[planet].house;

  for (const other of CLASSICAL_PLANETS_ORDER) {
    if (other === planet) continue;
    const otherHouse = allPlanets[other].house;

    // Forward count FROM aspecting planet (other) TO target planet.
    // diff=7 → "other" aspects "target" via 7th house (full aspect for all planets).
    const diff = ((targetHouse - otherHouse + 12) % 12) + 1;

    // BPHS exact aspect fractions
    let fraction = 0;

    // Universal 7th aspect (all planets, full strength)
    if (diff === 7) {
      fraction = 1.0; // 60 virupas
    }
    // Mars special aspects (BPHS Ch.27: 4th=quarter, 8th=three-quarters)
    else if (other === "Mars") {
      if (diff === 4) fraction = 0.25; // 15 virupas
      else if (diff === 8) fraction = 0.75; // 45 virupas
    }
    // Jupiter special aspects (BPHS Ch.27: 5th=half, 9th=full)
    else if (other === "Jupiter") {
      if (diff === 5) fraction = 0.5;  // 30 virupas
      else if (diff === 9) fraction = 1.0; // 60 virupas
    }
    // Saturn special aspects (BPHS Ch.27: 3rd=quarter, 10th=three-quarters)
    else if (other === "Saturn") {
      if (diff === 3) fraction = 0.25;  // 15 virupas
      else if (diff === 10) fraction = 0.75; // 45 virupas
    }

    if (fraction === 0) continue;

    const strength = fraction * 60;
    if (maleficPlanets.includes(other)) {
      total -= strength;
    } else if (beneficPlanets.includes(other)) {
      total += strength;
    }
  }

  return parseFloat(total.toFixed(2));
}

export interface ShadbalaInput {
  paksha: "shukla" | "krishna";
  tithiIndex: number;
  weekday: number;
  hora: ClassicalPlanet;
  isNight: boolean;
  // PL9 Phase A additions — required for accurate Kaala Bala computation
  chartJd: number;          // Julian Day UT (for Nathonnatha True Apparent Midnight)
  longitude: number;        // geographic east longitude (for Nathonnatha)
  ayanamsaDeg: number;      // Lahiri ayanamsa (for per-planet Ayana Bala declination)
}

export function buildShadbalaBlock(
  ctx: BlockContext,
  shadbalaInput: ShadbalaInput
): BlockResult<ShadbalaBlock> {
  const { chart } = ctx;
  const issues = [];

  const planetPositions: Record<ClassicalPlanet, { house: number; sign: ZodiacSign; isRetrograde: boolean }> = {
    Sun: { house: chart.planets.Sun.house, sign: chart.planets.Sun.sign, isRetrograde: chart.planets.Sun.isRetrograde },
    Moon: { house: chart.planets.Moon.house, sign: chart.planets.Moon.sign, isRetrograde: chart.planets.Moon.isRetrograde },
    Mars: { house: chart.planets.Mars.house, sign: chart.planets.Mars.sign, isRetrograde: chart.planets.Mars.isRetrograde },
    Mercury: { house: chart.planets.Mercury.house, sign: chart.planets.Mercury.sign, isRetrograde: chart.planets.Mercury.isRetrograde },
    Jupiter: { house: chart.planets.Jupiter.house, sign: chart.planets.Jupiter.sign, isRetrograde: chart.planets.Jupiter.isRetrograde },
    Venus: { house: chart.planets.Venus.house, sign: chart.planets.Venus.sign, isRetrograde: chart.planets.Venus.isRetrograde },
    Saturn: { house: chart.planets.Saturn.house, sign: chart.planets.Saturn.sign, isRetrograde: chart.planets.Saturn.isRetrograde },
  };

  // Pre-compute per-planet Ayana Bala and Moon/Sun special values for Chesta Bala (PL9 dviguṇa rule)
  const planetAyanaBala: Record<ClassicalPlanet, number> = {} as Record<ClassicalPlanet, number>;
  for (const planet of CLASSICAL_PLANETS_ORDER) {
    const siderealLon = chart.planets[planet].siderealLongitude;
    const decl = planetDeclination(siderealLon, shadbalaInput.ayanamsaDeg);
    planetAyanaBala[planet] = ayanaBalaFromDeclination(decl);
  }
  const sunAyanaBala  = planetAyanaBala["Sun"]!;
  const moonPakshaBala = pakshaBalaValue(
    chart.planets.Moon.siderealLongitude,
    chart.planets.Sun.siderealLongitude,
    true // Moon is benefic
  );

  const kaalaBase: KaalaInput = {
    paksha: shadbalaInput.paksha,
    tithiIndex: shadbalaInput.tithiIndex,
    weekday: shadbalaInput.weekday,
    hora: shadbalaInput.hora,
    isNight: shadbalaInput.isNight,
    moonLon: chart.planets.Moon.siderealLongitude,
    sunLon: chart.planets.Sun.siderealLongitude,
    chartJd: shadbalaInput.chartJd,
    longitude: shadbalaInput.longitude,
    ayanamsaDeg: shadbalaInput.ayanamsaDeg,
  };

  // Compute per-planet Shadbala
  const sthanaTotals: number[] = [];
  const digBalaValues: number[] = [];
  const kaalaTotals: number[] = [];
  const chestaValues: number[] = [];
  const naisargikaValues: number[] = [];
  const drigValues: number[] = [];
  const totalVirupas: number[] = [];

  for (const planet of CLASSICAL_PLANETS_ORDER) {
    const pos = chart.planets[planet];

    const sthana = sthanaBala(planet, pos.siderealLongitude, pos.sign, pos.signDegree, pos.house);
    const dig = digBala(planet, pos.house);

    // Inject per-planet pre-computed Ayana Bala into KaalaInput (PL9 per-planet declination)
    const planetKaalaInput: KaalaInput = {
      ...kaalaBase,
      planetAyana: planetAyanaBala[planet]!,
    };
    const kaalaResult = kaalaBalaForPlanet(planet, planetKaalaInput);
    const chesta = chestaBala(planet, pos.speedLongitude, sunAyanaBala, moonPakshaBala);
    const naisargika = NAISARGIKA_BALA[planet];
    const drig = drigBala(planet, planetPositions);

    sthanaTotals.push(parseFloat(sthana.toFixed(2)));
    digBalaValues.push(parseFloat(dig.toFixed(2)));
    kaalaTotals.push(parseFloat(kaalaResult.total.toFixed(2)));
    chestaValues.push(parseFloat(chesta.toFixed(2)));
    naisargikaValues.push(parseFloat(naisargika.toFixed(2)));
    drigValues.push(parseFloat(drig.toFixed(2)));

    const total = sthana + dig + kaalaResult.total + chesta + naisargika + drig;
    totalVirupas.push(parseFloat(total.toFixed(2)));
  }

  // Compute percent_required and rank
  const percentRequired = totalVirupas.map((v, i) =>
    parseFloat((v / MINIMUM_REQUIRED_VIRUPAS[i]! * 100).toFixed(2))
  );

  // Rank: 1=highest total_virupas, 7=lowest
  const sorted = [...totalVirupas].sort((a, b) => b - a);
  const rank = totalVirupas.map(v => sorted.indexOf(v) + 1);

  // kaala_pct for SIF_v3 KIF computation
  const kaala_pct = kaalaTotals.map((k, i) =>
    parseFloat((k / MINIMUM_REQUIRED_VIRUPAS[i]! * 100).toFixed(2))
  );

  const value: ShadbalaBlock = {
    _columns: [...CLASSICAL_PLANETS_ORDER],
    minimum_required: [...MINIMUM_REQUIRED_VIRUPAS],
    total_virupas: totalVirupas,
    percent_required: percentRequired,
    rank,
    sthana_total: sthanaTotals,
    dig_bala: digBalaValues,
    kaala_total: kaalaTotals,
    kaala_pct,
    chesta_bala: chestaValues,
    naisargika_bala: naisargikaValues,
    drig_bala: drigValues,
  };

  if (totalVirupas.every(v => v === 0)) {
    issues.push(warningIssue("SHADBALA.total_virupas", "All Shadbala totals are zero"));
  }

  return finalizeBlock({
    blockId: "SHADBALA",
    ctx,
    inputs: ["CanonicalChart"],
    value,
    issues,
  });
}
