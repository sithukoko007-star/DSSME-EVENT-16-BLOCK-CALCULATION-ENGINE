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
 * Ojha Yugma Bala: odd signs favor Sun/Mars/Jupiter/Saturn for odd placements.
 * Simplified: 15 virupas if correctly placed.
 */
function ojhaYugmaBala(planet: ClassicalPlanet, sign: ZodiacSign): number {
  const signIdx = ZODIAC_SIGNS_ARIES_FIRST.indexOf(sign);
  const isOddSign = signIdx % 2 === 0;
  const oddPlanets: ClassicalPlanet[] = ["Sun", "Mars", "Jupiter", "Saturn"];
  const evenPlanets: ClassicalPlanet[] = ["Moon", "Mercury", "Venus"];
  if (isOddSign && oddPlanets.includes(planet)) return 15;
  if (!isOddSign && evenPlanets.includes(planet)) return 15;
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

/**
 * Kaala Bala — temporal strength.
 * 9 sub-components. We implement the key ones:
 * Nathonnatha, Paksha, Tribhaga, Abda, Masa, Vaara, Hora, Ayana, Yuddha.
 */
export interface KaalaInput {
  paksha: "shukla" | "krishna";
  tithiIndex: number;      // 1..30
  weekday: number;         // 0=Sun..6=Sat
  hora: ClassicalPlanet;   // current hora lord
  isNight: boolean;        // chart time is after sunset
  moonLon: number;         // sidereal longitude
  sunLon: number;
}

function kaalaBalaForPlanet(planet: ClassicalPlanet, input: KaalaInput): number {
  // 1. Nathonnatha Bala: diurnal planets strong by day, nocturnal by night
  const diurnal: ClassicalPlanet[] = ["Sun", "Jupiter", "Saturn"];
  const nocturnal: ClassicalPlanet[] = ["Moon", "Mars", "Venus"];
  let nathonnatha = 15;
  if (diurnal.includes(planet)) nathonnatha = input.isNight ? 15 : 60;
  else if (nocturnal.includes(planet)) nathonnatha = input.isNight ? 60 : 15;
  else nathonnatha = 30; // Mercury is neutral

  // 2. Paksha Bala: graduated by tithiIndex.
  //    Classical (Parashari): Moon's Paksha Bala = tithiIndex × 12 (max=180 at full moon).
  //    For Kaala Bala sub-component, cap contribution at 60 virupas.
  //    Benefics strengthen with waxing, malefics strengthen with waning.
  //    tithiIndex 1–15 = Shukla; 16–30 = Krishna (mapped as 30-tithiIndex+1 for waning count).
  const benefics: ClassicalPlanet[] = ["Moon", "Mercury", "Jupiter", "Venus"];
  const malefics: ClassicalPlanet[] = ["Sun", "Mars", "Saturn"];
  const pakshaIsShukla = input.paksha === "shukla";
  // Raw tithi phase (1=new moon direction, 15=opposition direction)
  const tithiPhase = pakshaIsShukla
    ? input.tithiIndex         // 1–15, waxing
    : (30 - input.tithiIndex + 1); // 1–15, waning (tithi 16→15, tithi 30→1)
  const phaseFraction = Math.min(15, Math.max(1, tithiPhase)) / 15; // 0.067–1.0

  let paksha: number;
  if (benefics.includes(planet)) {
    // Benefics strong in Shukla, weak in Krishna
    paksha = pakshaIsShukla
      ? Math.round(phaseFraction * 60)   // 4–60 in Shukla
      : Math.round((1 - phaseFraction) * 60); // 0–56 in Krishna (weakens as moon wanes)
  } else if (malefics.includes(planet)) {
    // Malefics strong in Krishna, weak in Shukla
    paksha = pakshaIsShukla
      ? Math.round((1 - phaseFraction) * 60)
      : Math.round(phaseFraction * 60);
  } else {
    paksha = 30; // neutral fallback
  }

  // 3. Tribhaga Bala: day split into thirds; each third has a lord.
  //    Day thirds: Saturn=1st, Mercury=2nd, Moon=3rd (each receives 60 if they are lord of any third)
  //    Night thirds: Moon=1st, Mercury=2nd, Mars=3rd
  //    Classical rule: planet gets 60 virupas if it lords ANY of the thirds for the period.
  //    Simplified: all lords of the 3 day or 3 night thirds receive 60; others get 0.
  let tribhaga = 0;
  if (!input.isNight) {
    // Day lords: Saturn, Mercury, Moon — all three receive 60 (any lord of any third)
    const dayLords: ClassicalPlanet[] = ["Saturn", "Mercury", "Moon"];
    if (dayLords.includes(planet)) tribhaga = 60;
  } else {
    // Night lords: Moon, Mercury, Mars — classical order
    const nightLords: ClassicalPlanet[] = ["Moon", "Mercury", "Mars"];
    if (nightLords.includes(planet)) tribhaga = 60;
  }

  // 4. Abda Bala (year lord) — simplified: weekday of solar new year
  // Not feasible without multi-year ephemeris. Set to neutral 15.
  const abda = 15;

  // 5. Masa Bala (month lord) — first day of lunar month
  const masaLords: ClassicalPlanet[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  const masaLord = masaLords[(input.weekday + input.tithiIndex) % 7]!;
  const masa = masaLord === planet ? 60 : 0;

  // 6. Vaara Bala (weekday): Sun=Sun, Mon=Moon, Tue=Mars, Wed=Mercury, Thu=Jupiter, Fri=Venus, Sat=Saturn
  const vaaraLords: ClassicalPlanet[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  const vaaraLord = vaaraLords[input.weekday]!;
  const vaara = vaaraLord === planet ? 45 : 0;

  // 7. Hora Bala: if planet matches hora lord
  const hora = input.hora === planet ? 60 : 0;

  // 8. Ayana Bala (solar declination)
  // Sun in north (Aries–Virgo, ~lon < 180): diurnal planets stronger
  const sunInNorth = input.sunLon < 180;
  let ayana = 30;
  if (sunInNorth && diurnal.includes(planet)) ayana = 60;
  else if (!sunInNorth && nocturnal.includes(planet)) ayana = 60;
  else if (!sunInNorth && diurnal.includes(planet)) ayana = 0;
  else if (sunInNorth && nocturnal.includes(planet)) ayana = 0;

  // 9. Yuddha Bala (planetary war): planets within 1° in same sign
  // Requires position data; set to neutral 0 (will be computed in full if positions provided)
  const yuddha = 0;

  return nathonnatha + paksha + tribhaga + abda + masa + vaara + hora + ayana + yuddha;
}

/**
 * Chesta Bala — motional strength (based on planetary speed relative to mean).
 * Direct & fast → higher; retrograde → lower.
 * Mean speeds (deg/day): Sun 0.9833, Moon 13.1833, Mars 0.5241,
 *   Mercury 1.3833, Jupiter 0.0831, Venus 1.2, Saturn 0.0334
 */
const MEAN_SPEED: Record<ClassicalPlanet, number> = {
  Sun: 0.9833,
  Moon: 13.1833,
  Mars: 0.5241,
  Mercury: 1.3833,
  Jupiter: 0.0831,
  Venus: 1.2,
  Saturn: 0.0334,
};

function chestaBala(planet: ClassicalPlanet, speedLon: number): number {
  const mean = MEAN_SPEED[planet];
  const speed = speedLon; // deg/day (negative = retrograde)

  if (speed < 0) {
    // Retrograde (Vakra): classical Parashari = 30 virupas.
    // Some texts say retrograde gets exaltation-level strength (≈30),
    // since retrograde motion indicates geocentric proximity/visibility.
    return 30;
  }

  if (Math.abs(speed) < mean * 0.05) {
    // Stationary (Vimala): near-zero speed = 0 virupas
    return 0;
  }

  // Direct motion: scale linearly from mean.
  // speed = mean → ratio 1.0 → 30 virupas (average Chesta)
  // speed = 2×mean → ratio 2.0 → 60 virupas (maximum Chesta)
  // speed = 0 → 0 virupas
  const ratio = Math.abs(speed) / mean;
  return Math.min(60, Math.max(0, ratio * 30));
}

/**
 * Drig Bala — aspectual strength received from other planets.
 * Full aspect = 60 virupas; 3/4 = 45; 1/2 = 30; 1/4 = 15.
 * Malefic aspects = negative. Benefic aspects = positive.
 * Result can be negative.
 *
 * This is a simplified calculation — full Drig Bala requires the
 * complete planetary position set and aspect fractions.
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
    const otherPos = allPlanets[other];
    const otherHouse = otherPos.house;

    // House difference (forward count FROM the aspecting planet TO the target).
    // diff=7 → aspecting planet is 7 houses behind target → 7th aspect (full; all planets).
    // diff=4/8 → Mars special aspects; diff=5/9 → Jupiter; diff=3/10 → Saturn.
    // Note: "target - other" gives forward count from other (aspecting) to target.
    const diff = ((targetHouse - otherHouse + 12) % 12) + 1;

    // Aspect fractions per Vedic rules
    let fraction = 0;
    if (diff === 7) fraction = 1.0; // Full aspect (all planets)
    else if (other === "Mars" && (diff === 4 || diff === 8)) fraction = 1.0;
    else if (other === "Jupiter" && (diff === 5 || diff === 9)) fraction = 1.0;
    else if (other === "Saturn" && (diff === 3 || diff === 10)) fraction = 1.0;

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

  const kaalaInput: KaalaInput = {
    paksha: shadbalaInput.paksha,
    tithiIndex: shadbalaInput.tithiIndex,
    weekday: shadbalaInput.weekday,
    hora: shadbalaInput.hora,
    isNight: shadbalaInput.isNight,
    moonLon: chart.planets.Moon.siderealLongitude,
    sunLon: chart.planets.Sun.siderealLongitude,
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
    const kaala = kaalaBalaForPlanet(planet, kaalaInput);
    const chesta = chestaBala(planet, pos.speedLongitude);
    const naisargika = NAISARGIKA_BALA[planet];
    const drig = drigBala(planet, planetPositions);

    sthanaTotals.push(parseFloat(sthana.toFixed(2)));
    digBalaValues.push(parseFloat(dig.toFixed(2)));
    kaalaTotals.push(parseFloat(kaala.toFixed(2)));
    chestaValues.push(parseFloat(chesta.toFixed(2)));
    naisargikaValues.push(parseFloat(naisargika.toFixed(2)));
    drigValues.push(parseFloat(drig.toFixed(2)));

    const total = sthana + dig + kaala + chesta + naisargika + drig;
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
