/**
 * BLOCK_6 - SHADBALA (BPHS Chapter 27 Canonical Implementation)
 * Module: src/engine/chartblocks/shadbala.ts
 *
 * Computes the six Shadbala components for each of the 7 classical planets:
 *   1. Sthana Bala     - Positional strength (Uchcha + 7-Varga Panchadha Saptavargaja + D1/D9 Ojha-Yugma + Kendradi + Drekkana)
 *   2. Dig Bala        - Directional strength (Degree-based Placidus/Equal cusp arc / 3, with whole-house fallback)
 *   3. Kaala Bala      - Temporal strength (Nathonnatha, Paksha, Tribhaga with permanent Jupiter +60, Abda, Masa, Vaara, Hora, Ayana, Yuddha)
 *   4. Chesta Bala     - Motional strength (Geocentric Speed & Ashta Gati 8-state machine; Sun=Ayana, Moon=Paksha)
 *   5. Naisargika Bala - Natural constant luminosity strength
 *   6. Drig Bala       - Aspectual strength (BPHS Ch.27 30-300 deg piecewise Drishti Kona & Whole-House with /4 divisor)
 *
 * Also provides BPHS Ch.27 Ishta Phala & Kashta Phala radiation tendencies.
 * NOTE: Bhava Bala NEVER enters RS(p) - Hard Rule 10 / Section 3.1 Rule 11.
 */

import type {
  ClassicalPlanet,
  ShadbalaBlock,
} from "../../types/dssme-canonical-types.ts";
import type { BlockContext, BlockResult } from "../blocks/blockTypes.ts";
import { finalizeBlock, warningIssue } from "../blocks/blockResult.ts";

// ============================================================================
// CORE TYPES & CONSTANTS (BPHS CHAPTER 3 & CHAPTER 27)
// ============================================================================

export type PlanetId = ClassicalPlanet;
export type RasiIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export type VargaKey = "D1" | "D2" | "D3" | "D7" | "D9" | "D12" | "D30";
export type CardinalHouse = 1 | 4 | 7 | 10;
export type TaraGrahaId = Exclude<PlanetId, "Sun" | "Moon">;

export const PLANET_ORDER: readonly PlanetId[] = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
];

export const CLASSICAL_PLANETS_ORDER: ClassicalPlanet[] = [...PLANET_ORDER];

export const TARA_GRAHAS: readonly TaraGrahaId[] = [
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
];

// Section 2.2 BLOCK_6: minimum required virupas per planet
export const MINIMUM_REQUIRED_VIRUPAS: number[] = [
  390, 360, 300, 420, 390, 330, 300,
];

export const MIN_REQUIRED_VIRUPAS: Record<PlanetId, number> = {
  Sun: 390,
  Moon: 360,
  Mars: 300,
  Mercury: 420,
  Jupiter: 390,
  Venus: 330,
  Saturn: 300,
};

// Component 5: Naisargika Bala - BPHS Ch.27 Sloka 14 natural constant strength (virupas)
export const NAISARGIKA_BALA: Record<PlanetId, number> = {
  Sun: 60.0,
  Moon: 51.43,
  Venus: 42.86,
  Jupiter: 34.29,
  Mercury: 25.71,
  Mars: 17.14,
  Saturn: 8.57,
};

// Deep Exaltation degrees (Paramochcha - BPHS Ch.3)
export const EXALTATION_DEG: Record<PlanetId, number> = {
  Sun: 10,      // 10 deg Aries
  Moon: 33,     // 3 deg Taurus
  Mars: 298,    // 28 deg Capricorn
  Mercury: 165, // 15 deg Virgo
  Jupiter: 95,  // 5 deg Cancer
  Venus: 357,   // 27 deg Pisces
  Saturn: 200,  // 20 deg Libra
};

// Sign rulers (0 = Aries ... 11 = Pisces)
export const SIGN_LORDS: Record<RasiIndex, PlanetId> = {
  0: "Mars",     // Aries
  1: "Venus",    // Taurus
  2: "Mercury",  // Gemini
  3: "Moon",     // Cancer
  4: "Sun",      // Leo
  5: "Mercury",  // Virgo
  6: "Venus",    // Libra
  7: "Mars",     // Scorpio
  8: "Jupiter",  // Sagittarius
  9: "Saturn",   // Capricorn
  10: "Saturn",  // Aquarius
  11: "Jupiter", // Pisces
};

export const DIG_MAX_HOUSE: Record<PlanetId, CardinalHouse> = {
  Mercury: 1, // East (Ascendant / H1 Cusp)
  Jupiter: 1, // East (Ascendant / H1 Cusp)
  Moon: 4,    // North (Nadir / IC / H4 Cusp)
  Venus: 4,   // North (Nadir / IC / H4 Cusp)
  Saturn: 7,  // West (Descendant / H7 Cusp)
  Sun: 10,    // South (Zenith / MC / H10 Cusp)
  Mars: 10,   // South (Zenith / MC / H10 Cusp)
};

export const VAARA_LORDS: readonly PlanetId[] = [
  "Sun",     // 0: Sunday
  "Moon",    // 1: Monday
  "Mars",    // 2: Tuesday
  "Mercury", // 3: Wednesday
  "Jupiter", // 4: Thursday
  "Venus",   // 5: Friday
  "Saturn",  // 6: Saturday
];

// Mean obliquity of ecliptic (J2000)
const OBLIQUITY_DEG = 23.4393;

// ============================================================================
// MATHEMATICAL HELPERS
// ============================================================================

export function norm360(lon: number): number {
  return ((lon % 360) + 360) % 360;
}

export function shortestArc(lonA: number, lonB: number): number {
  const diff = Math.abs(norm360(lonA - lonB));
  return diff > 180 ? 360 - diff : diff;
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function round4(val: number): number {
  return Math.round((val + Number.EPSILON) * 10000) / 10000;
}

// ============================================================================
// INPUT & OUTPUT INTERFACES
// ============================================================================

export interface PlanetPositionInput {
  planet: PlanetId;
  lon: number;
  speed: number;
  retro?: boolean;
  house: number;
  lat?: number;
}

export type MasaConvention = "AMANTA_LUNAR" | "SAURA_SANKRANTI";
export type DrigCalculationMode =
  | "DEGREE_RAMAN_BAND"
  | "DEGREE_CONTINUOUS_KNOT"
  | "WHOLE_HOUSE";

export interface ShadbalaChartInput {
  planets: readonly PlanetPositionInput[];
  jdUt: number;
  tzOffsetHours: number;
  geoLonDeg: number;
  localSunriseHour?: number;
  localSunsetHour?: number;
  sunriseJdUt?: number;
  sunsetJdUt?: number;
  ayanamsaDeg: number;
  houseCusps?: readonly number[] | Record<number, number>;
  masaConvention?: MasaConvention;
  usePanchadhaSaptavargaja?: boolean;
  drigMode?: DrigCalculationMode;
  weekday?: number | ClassicalPlanet;
  horaLord?: ClassicalPlanet;
  doubleMoonPaksha?: boolean;
  doubleSunAyana?: boolean;
}

// ============================================================================
// 1. STHANA BALA & 7-VARGA SAPTAVARGAJA (P2, P3, & PANCHADHA MAITRI)
// ============================================================================

export type DignityTier =
  | "Exalted"
  | "Moolatrikona"
  | "Own"
  | "Friend"
  | "Neutral"
  | "Enemy"
  | "Debilitated";

export const DIGNITY_VIRUPAS: Record<DignityTier, number> = {
  Exalted: 20,
  Moolatrikona: 20,
  Own: 15,
  Friend: 10,
  Neutral: 7,
  Enemy: 5,
  Debilitated: 2,
};

const EXALTATION_SIGN: Record<PlanetId, RasiIndex> = {
  Sun: 0,      // Aries
  Moon: 1,     // Taurus
  Mars: 9,     // Capricorn
  Mercury: 5,  // Virgo
  Jupiter: 3,  // Cancer
  Venus: 11,  // Pisces
  Saturn: 6,   // Libra
};

const DEBILITATION_SIGN: Record<PlanetId, RasiIndex> = {
  Sun: 6,      // Libra
  Moon: 7,     // Scorpio
  Mars: 3,     // Cancer
  Mercury: 11, // Pisces
  Jupiter: 9,  // Capricorn
  Venus: 5,    // Virgo
  Saturn: 0,   // Aries
};

const MOOLATRIKONA_RULES: Record<
  PlanetId,
  { sign: RasiIndex; startDeg: number; endDeg: number }
> = {
  Sun: { sign: 4, startDeg: 0, endDeg: 20 },      // Leo 0-20 deg
  Moon: { sign: 1, startDeg: 3, endDeg: 30 },     // Taurus 3-30 deg
  Mars: { sign: 0, startDeg: 0, endDeg: 12 },     // Aries 0-12 deg
  Mercury: { sign: 5, startDeg: 15, endDeg: 20 }, // Virgo 15-20 deg
  Jupiter: { sign: 8, startDeg: 0, endDeg: 10 },  // Sagittarius 0-10 deg
  Venus: { sign: 6, startDeg: 0, endDeg: 15 },    // Libra 0-15 deg
  Saturn: { sign: 10, startDeg: 0, endDeg: 20 },  // Aquarius 0-20 deg
};

const NATURAL_FRIENDS: Record<PlanetId, ReadonlySet<PlanetId>> = {
  Sun: new Set(["Moon", "Mars", "Jupiter"]),
  Moon: new Set(["Sun", "Mercury"]),
  Mars: new Set(["Sun", "Moon", "Jupiter"]),
  Mercury: new Set(["Sun", "Venus"]),
  Jupiter: new Set(["Sun", "Moon", "Mars"]),
  Venus: new Set(["Mercury", "Saturn"]),
  Saturn: new Set(["Mercury", "Venus"]),
};

const NATURAL_ENEMIES: Record<PlanetId, ReadonlySet<PlanetId>> = {
  Sun: new Set(["Venus", "Saturn"]),
  Moon: new Set([]),
  Mars: new Set(["Mercury"]),
  Mercury: new Set(["Moon"]),
  Jupiter: new Set(["Mercury", "Venus"]),
  Venus: new Set(["Sun", "Moon"]),
  Saturn: new Set(["Sun", "Moon", "Mars"]),
};

/**
 * Compute resolved RasiIndex (0..11) for all 7 Saptavarga divisions (D1, D2, D3, D7, D9, D12, D30)
 * per BPHS Ch. 6 (Shodashavarga Adhyaya).
 */
export function computeSevenVargaSigns(lon: number): Record<VargaKey, RasiIndex> {
  const normalized = norm360(lon);
  const rasi = Math.floor(normalized / 30) as RasiIndex;
  const degInSign = normalized - rasi * 30;
  const isOddSign = rasi % 2 === 0;

  // 1. D1 - Rasi
  const D1: RasiIndex = rasi;

  // 2. D2 - Parashari Hora (Odd: 0-15 deg Leo(4), 15-30 deg Cancer(3); Even: 0-15 deg Cancer(3), 15-30 deg Leo(4))
  const D2: RasiIndex = isOddSign
    ? ((degInSign < 15 ? 4 : 3) as RasiIndex)
    : ((degInSign < 15 ? 3 : 4) as RasiIndex);

  // 3. D3 - Parashari Drekkana (each 10 deg: 1st, 5th, 9th from sign)
  const drekIndex = Math.min(Math.floor(degInSign / 10), 2);
  const D3 = ((rasi + drekIndex * 4) % 12) as RasiIndex;

  // 4. D7 - Saptamsha (Odd starts from same sign; Even starts from 7th sign)
  const saptIndex = Math.min(Math.floor((degInSign * 7) / 30), 6);
  const saptBase = isOddSign ? rasi : (rasi + 6) % 12;
  const D7 = ((saptBase + saptIndex) % 12) as RasiIndex;

  // 5. D9 - Navamsha (continuous 3 deg 20 min zodiacal wheel)
  const totalNavamshas = Math.floor((normalized * 9) / 30);
  const D9 = (totalNavamshas % 12) as RasiIndex;

  // 6. D12 - Dwadashamsha (each 2.5 deg from same sign)
  const dwadIndex = Math.min(Math.floor((degInSign * 12) / 30), 11);
  const D12 = ((rasi + dwadIndex) % 12) as RasiIndex;

  // 7. D30 - Parashari Trimsamsha
  let D30: RasiIndex;
  if (isOddSign) {
    if (degInSign < 5) D30 = 0;        // Aries (Mars)
    else if (degInSign < 10) D30 = 10; // Aquarius (Saturn)
    else if (degInSign < 18) D30 = 8;  // Sagittarius (Jupiter)
    else if (degInSign < 25) D30 = 2;  // Gemini (Mercury)
    else D30 = 1;                      // Taurus (Venus)
  } else {
    if (degInSign < 5) D30 = 1;        // Taurus (Venus)
    else if (degInSign < 12) D30 = 5;  // Virgo (Mercury)
    else if (degInSign < 20) D30 = 11; // Pisces (Jupiter)
    else if (degInSign < 25) D30 = 9;  // Capricorn (Saturn)
    else D30 = 7;                      // Scorpio (Mars)
  }

  return { D1, D2, D3, D7, D9, D12, D30 };
}

export function evaluateVargaDignity(
  planet: PlanetId,
  varga: VargaKey,
  vargaSign: RasiIndex,
  d1Longitude: number
): DignityTier {
  const degInD1Sign = norm360(d1Longitude) % 30;
  const moola = MOOLATRIKONA_RULES[planet];

  if (varga === "D1") {
    if (planet === "Moon" && vargaSign === 1) {
      return degInD1Sign < 3 ? "Exalted" : "Moolatrikona";
    }
    if (planet === "Mercury" && vargaSign === 5) {
      if (degInD1Sign < 15) return "Exalted";
      if (degInD1Sign < 20) return "Moolatrikona";
      return "Own";
    }
    if (
      vargaSign === moola.sign &&
      degInD1Sign >= moola.startDeg &&
      degInD1Sign < moola.endDeg
    ) {
      return "Moolatrikona";
    }
  } else {
    if (vargaSign === moola.sign && planet !== "Moon" && planet !== "Mercury") {
      return "Moolatrikona";
    }
  }

  if (vargaSign === EXALTATION_SIGN[planet]) return "Exalted";
  if (vargaSign === DEBILITATION_SIGN[planet]) return "Debilitated";

  const signLord = SIGN_LORDS[vargaSign];
  if (signLord === planet) return "Own";

  if (NATURAL_FRIENDS[planet].has(signLord)) return "Friend";
  if (NATURAL_ENEMIES[planet].has(signLord)) return "Enemy";
  return "Neutral";
}

export interface SaptavargajaBreakdown {
  totalVirupas: number;
  byVarga: Record<
    VargaKey,
    { sign: RasiIndex; dignity: DignityTier; virupas: number }
  >;
}

export function calculateSaptavargajaBala(
  planet: PlanetId,
  siderealLon: number
): SaptavargajaBreakdown {
  const vargaSigns = computeSevenVargaSigns(siderealLon);
  const vargaKeys: VargaKey[] = ["D1", "D2", "D3", "D7", "D9", "D12", "D30"];

  let totalVirupas = 0;
  const byVarga = {} as SaptavargajaBreakdown["byVarga"];

  for (const key of vargaKeys) {
    const sign = vargaSigns[key];
    const dignity = evaluateVargaDignity(planet, key, sign, siderealLon);
    const virupas = DIGNITY_VIRUPAS[dignity];
    byVarga[key] = { sign, dignity, virupas };
    totalVirupas += virupas;
  }

  return { totalVirupas, byVarga };
}

// -- Panchadha Maitri (5-Fold Compound Friendship - BPHS Ch. 3 Slokas 55-58 & Ch. 27 Slokas 2-3) --

export type NaisargikaTier = "Friend" | "Neutral" | "Enemy";
export type TatkalikaTier = "TemporalFriend" | "TemporalEnemy";
export type PanchadhaTier =
  | "AdhiMitra"
  | "Mitra"
  | "Sama"
  | "Shatru"
  | "AdhiShatru";
export type SaptavargajaDignity = "Moolatrikona" | "Swakshetra" | PanchadhaTier;
export type VirupaScalePreset = "BPHS_EXACT_45_TO_1_875" | "ROUNDED_45_TO_2";

export const SAPTAVARGAJA_SCALE_BPHS_EXACT: Record<SaptavargajaDignity, number> = {
  Moolatrikona: 45.0,
  Swakshetra: 30.0,
  AdhiMitra: 22.5,
  Mitra: 15.0,
  Sama: 7.5,
  Shatru: 3.75,
  AdhiShatru: 1.875,
};

export const SAPTAVARGAJA_SCALE_45_TO_2: Record<SaptavargajaDignity, number> = {
  Moolatrikona: 45.0,
  Swakshetra: 30.0,
  AdhiMitra: 22.5,
  Mitra: 15.0,
  Sama: 7.5,
  Shatru: 3.75,
  AdhiShatru: 2.0,
};

export interface PairwiseMaitriDetail {
  planet: PlanetId;
  otherPlanet: PlanetId;
  planetRasi: RasiIndex;
  otherRasi: RasiIndex;
  inclusiveHouseSpan: number;
  naisargika: NaisargikaTier;
  naisargikaScore: -1 | 0 | 1;
  tatkalika: TatkalikaTier;
  tatkalikaScore: -1 | 1;
  compoundScore: -2 | -1 | 0 | 1 | 2;
  panchadha: PanchadhaTier;
}

export type PanchadhaMaitriMatrix = Record<
  PlanetId,
  Record<PlanetId, PairwiseMaitriDetail | null>
>;

export function getNaisargikaMaitri(
  planet: PlanetId,
  otherPlanet: PlanetId
): { tier: NaisargikaTier; score: -1 | 0 | 1 } {
  if (NATURAL_FRIENDS[planet].has(otherPlanet)) {
    return { tier: "Friend", score: 1 };
  }
  if (NATURAL_ENEMIES[planet].has(otherPlanet)) {
    return { tier: "Enemy", score: -1 };
  }
  return { tier: "Neutral", score: 0 };
}

export function getTatkalikaMaitri(
  planetRasi: RasiIndex,
  otherRasi: RasiIndex
): { tier: TatkalikaTier; score: -1 | 1; inclusiveHouseSpan: number } {
  const inclusiveHouseSpan = (((otherRasi - planetRasi) % 12) + 12) % 12 + 1;
  const isTemporalFriend =
    inclusiveHouseSpan === 2 ||
    inclusiveHouseSpan === 3 ||
    inclusiveHouseSpan === 4 ||
    inclusiveHouseSpan === 10 ||
    inclusiveHouseSpan === 11 ||
    inclusiveHouseSpan === 12;

  return {
    tier: isTemporalFriend ? "TemporalFriend" : "TemporalEnemy",
    score: isTemporalFriend ? 1 : -1,
    inclusiveHouseSpan,
  };
}

export function scoreToPanchadhaTier(
  compoundScore: -2 | -1 | 0 | 1 | 2
): PanchadhaTier {
  switch (compoundScore) {
    case 2:
      return "AdhiMitra";
    case 1:
      return "Mitra";
    case 0:
      return "Sama";
    case -1:
      return "Shatru";
    case -2:
      return "AdhiShatru";
  }
}

export function buildPanchadhaMaitriMatrix(
  rasiByPlanet: Record<PlanetId, RasiIndex>
): PanchadhaMaitriMatrix {
  const matrix = {} as PanchadhaMaitriMatrix;
  for (const pA of PLANET_ORDER) {
    matrix[pA] = {} as Record<PlanetId, PairwiseMaitriDetail | null>;
    for (const pB of PLANET_ORDER) {
      if (pA === pB) {
        matrix[pA][pB] = null;
        continue;
      }
      const rasiA = rasiByPlanet[pA];
      const rasiB = rasiByPlanet[pB];
      const naisargika = getNaisargikaMaitri(pA, pB);
      const tatkalika = getTatkalikaMaitri(rasiA, rasiB);
      const compoundScore = (naisargika.score + tatkalika.score) as
        | -2
        | -1
        | 0
        | 1
        | 2;

      matrix[pA][pB] = {
        planet: pA,
        otherPlanet: pB,
        planetRasi: rasiA,
        otherRasi: rasiB,
        inclusiveHouseSpan: tatkalika.inclusiveHouseSpan,
        naisargika: naisargika.tier,
        naisargikaScore: naisargika.score,
        tatkalika: tatkalika.tier,
        tatkalikaScore: tatkalika.score,
        compoundScore,
        panchadha: scoreToPanchadhaTier(compoundScore),
      };
    }
  }
  return matrix;
}

export function evaluatePanchadhaVargaDignity(
  planet: PlanetId,
  varga: VargaKey,
  vargaSign: RasiIndex,
  d1Longitude: number,
  maitriMatrix: PanchadhaMaitriMatrix,
  moolatrikonaScope: "D1_ONLY" | "ALL_VARGAS" = "D1_ONLY"
): SaptavargajaDignity {
  const signLord = SIGN_LORDS[vargaSign];
  const moola = MOOLATRIKONA_RULES[planet];
  const degInD1Sign = norm360(d1Longitude) % 30;

  if (varga === "D1") {
    if (
      vargaSign === moola.sign &&
      degInD1Sign >= moola.startDeg &&
      degInD1Sign < moola.endDeg
    ) {
      return "Moolatrikona";
    }
  } else if (moolatrikonaScope === "ALL_VARGAS" && vargaSign === moola.sign) {
    return "Moolatrikona";
  }

  if (signLord === planet) {
    return "Swakshetra";
  }

  const relation = maitriMatrix[planet][signLord];
  if (!relation) return "Swakshetra";
  return relation.panchadha;
}

export interface VargaSaptavargajaDetail {
  varga: VargaKey;
  sign: RasiIndex;
  signLord: PlanetId;
  dignity: SaptavargajaDignity;
  virupas: number;
}

export interface PlanetSaptavargajaResult {
  planet: PlanetId;
  rawTotalVirupas: number;
  totalVirupas: number;
  byVarga: Record<VargaKey, VargaSaptavargajaDetail>;
}

export interface PanchadhaSaptavargajaOptions {
  scalePreset?: VirupaScalePreset;
  moolatrikonaScope?: "D1_ONLY" | "ALL_VARGAS";
  tatkalikaScope?: "D1_RASI" | "PER_VARGA";
}

export function calculatePanchadhaSaptavargaja(
  planets: readonly PlanetPositionInput[],
  options: PanchadhaSaptavargajaOptions = {}
): {
  byPlanet: Record<PlanetId, PlanetSaptavargajaResult>;
  d1MaitriMatrix: PanchadhaMaitriMatrix;
} {
  const {
    scalePreset = "BPHS_EXACT_45_TO_1_875",
    moolatrikonaScope = "D1_ONLY",
    tatkalikaScope = "D1_RASI",
  } = options;

  const scaleTable =
    scalePreset === "ROUNDED_45_TO_2"
      ? SAPTAVARGAJA_SCALE_45_TO_2
      : SAPTAVARGAJA_SCALE_BPHS_EXACT;

  const vargaKeys: readonly VargaKey[] = [
    "D1",
    "D2",
    "D3",
    "D7",
    "D9",
    "D12",
    "D30",
  ];

  const vargaSignsByPlanet = {} as Record<PlanetId, Record<VargaKey, RasiIndex>>;
  const d1RasiByPlanet = {} as Record<PlanetId, RasiIndex>;

  for (const pos of planets) {
    const signs = computeSevenVargaSigns(pos.lon);
    vargaSignsByPlanet[pos.planet] = signs;
    d1RasiByPlanet[pos.planet] = signs.D1;
  }

  const d1MaitriMatrix = buildPanchadhaMaitriMatrix(d1RasiByPlanet);
  const maitriByVarga = {} as Record<VargaKey, PanchadhaMaitriMatrix>;

  for (const vKey of vargaKeys) {
    if (tatkalikaScope === "D1_RASI" || vKey === "D1") {
      maitriByVarga[vKey] = d1MaitriMatrix;
    } else {
      const rasiMap = {} as Record<PlanetId, RasiIndex>;
      for (const p of PLANET_ORDER) {
        rasiMap[p] = vargaSignsByPlanet[p][vKey];
      }
      maitriByVarga[vKey] = buildPanchadhaMaitriMatrix(rasiMap);
    }
  }

  const byPlanet = {} as Record<PlanetId, PlanetSaptavargajaResult>;

  for (const pos of planets) {
    const { planet, lon } = pos;
    let rawTotalVirupas = 0;
    const byVarga = {} as Record<VargaKey, VargaSaptavargajaDetail>;

    for (const vKey of vargaKeys) {
      const sign = vargaSignsByPlanet[planet][vKey];
      const signLord = SIGN_LORDS[sign];
      const dignity = evaluatePanchadhaVargaDignity(
        planet,
        vKey,
        sign,
        lon,
        maitriByVarga[vKey],
        moolatrikonaScope
      );
      const virupas = scaleTable[dignity];
      byVarga[vKey] = { varga: vKey, sign, signLord, dignity, virupas };
      rawTotalVirupas += virupas;
    }

    byPlanet[planet] = {
      planet,
      rawTotalVirupas,
      totalVirupas: round2(rawTotalVirupas),
      byVarga,
    };
  }

  return { byPlanet, d1MaitriMatrix };
}

export interface SthanaBalaBreakdown {
  uchcha: number;
  saptavargaja: number;
  ojhaYugma: number;
  kendradi: number;
  drekkana: number;
  total: number;
}

/**
 * Component 1: Sthana Bala (BPHS Ch. 27 Slokas 1-6)
 */
export function calculateSthanaBala(
  pos: PlanetPositionInput,
  saptavargajaOverride?: number
): SthanaBalaBreakdown {
  const { planet, lon, house } = pos;
  const normLon = norm360(lon);
  const degInSign = normLon % 30;

  // 1. Uchcha Bala [0, 60]
  const uchcha = round2(60 - shortestArc(normLon, EXALTATION_DEG[planet]) / 3);

  // 2. 7-Varga Saptavargaja Bala
  const vargaSigns = computeSevenVargaSigns(normLon);
  let saptavargaja = saptavargajaOverride ?? 0;
  if (saptavargajaOverride === undefined) {
    const vargaKeys: VargaKey[] = ["D1", "D2", "D3", "D7", "D9", "D12", "D30"];
    for (const k of vargaKeys) {
      const dignity = evaluateVargaDignity(planet, k, vargaSigns[k], normLon);
      saptavargaja += DIGNITY_VIRUPAS[dignity];
    }
  }
  saptavargaja = round2(saptavargaja);

  // 3. Ojha-Yugma Rasyamsha Bala (BPHS Ch. 27 Sloka 4: D1 + D9, range 0, 15, 30)
  const isEvenBeneficiary = planet === "Moon" || planet === "Venus";
  const d1IsOdd = vargaSigns.D1 % 2 === 0;
  const d9IsOdd = vargaSigns.D9 % 2 === 0;
  let ojhaYugma = 0;
  if (isEvenBeneficiary) {
    if (!d1IsOdd) ojhaYugma += 15;
    if (!d9IsOdd) ojhaYugma += 15;
  } else {
    if (d1IsOdd) ojhaYugma += 15;
    if (d9IsOdd) ojhaYugma += 15;
  }

  // 4. Kendradi Bala (BPHS Ch. 27 Sloka 5)
  let kendradi = 15;
  if (house === 1 || house === 4 || house === 7 || house === 10) {
    kendradi = 60;
  } else if (house === 2 || house === 5 || house === 8 || house === 11) {
    kendradi = 30;
  }

  // 5. Drekkana Bala (BPHS Ch. 27 Sloka 6)
  const decanate = Math.min(Math.floor(degInSign / 10), 2);
  let drekkana = 0;
  if (
    decanate === 0 &&
    (planet === "Sun" || planet === "Mars" || planet === "Jupiter")
  ) {
    drekkana = 15;
  } else if (
    decanate === 1 &&
    (planet === "Mercury" || planet === "Saturn")
  ) {
    drekkana = 15;
  } else if (
    decanate === 2 &&
    (planet === "Moon" || planet === "Venus")
  ) {
    drekkana = 15;
  }

  const total = round2(uchcha + saptavargaja + ojhaYugma + kendradi + drekkana);
  return { uchcha, saptavargaja, ojhaYugma, kendradi, drekkana, total };
}

// ============================================================================
// 2. DIG BALA (P4 DEGREE-BASED & WHOLE-HOUSE FALLBACK)
// ============================================================================

export interface HouseCuspsInput {
  cusps: readonly number[] | Record<number, number>;
}

export function getCardinalCuspLongitude(
  houseNumber: CardinalHouse,
  input: HouseCuspsInput
): number {
  const { cusps } = input;
  let rawLon: number | undefined;

  if (Array.isArray(cusps)) {
    rawLon = cusps.length === 13 ? cusps[houseNumber] : cusps[houseNumber - 1];
  } else {
    rawLon = (cusps as Record<number, number>)[houseNumber];
  }

  if (typeof rawLon !== "number" || Number.isNaN(rawLon)) {
    throw new Error(
      `Missing or invalid sidereal cusp longitude for House ${houseNumber}`
    );
  }

  return norm360(rawLon);
}

export function calculateDegreeDigBala(
  planet: PlanetId,
  planetSiderealLon: number,
  cuspsInput: HouseCuspsInput
): {
  digBalaVirupas: number;
  maxHouse: CardinalHouse;
  maxCuspLon: number;
  arcDistanceDeg: number;
} {
  const maxHouse = DIG_MAX_HOUSE[planet];
  const maxCuspLon = getCardinalCuspLongitude(maxHouse, cuspsInput);
  const arcDistanceDeg = shortestArc(planetSiderealLon, maxCuspLon);
  const digBalaVirupas = Math.max(0, Math.min(60, 60 - arcDistanceDeg / 3));

  return {
    digBalaVirupas: round2(digBalaVirupas),
    maxHouse,
    maxCuspLon,
    arcDistanceDeg: round4(arcDistanceDeg),
  };
}

export function calculateDigBala(
  pos: PlanetPositionInput,
  houseCusps?: readonly number[] | Record<number, number>
): number {
  const maxHouse = DIG_MAX_HOUSE[pos.planet];

  if (houseCusps !== undefined) {
    let cuspLon: number | undefined;
    if (Array.isArray(houseCusps)) {
      cuspLon =
        houseCusps.length === 13
          ? houseCusps[maxHouse]
          : houseCusps[maxHouse - 1];
    } else {
      cuspLon = (houseCusps as Record<number, number>)[maxHouse];
    }

    if (typeof cuspLon === "number" && !Number.isNaN(cuspLon)) {
      const dist = shortestArc(pos.lon, cuspLon);
      return round2(Math.max(0, Math.min(60, 60 - dist / 3)));
    }
  }

  // Whole-house modulo-12 fallback
  const rawDiff = Math.abs(pos.house - maxHouse) % 12;
  const distHouses = Math.min(rawDiff, 12 - rawDiff);
  return round2(Math.max(0, 60 - distHouses * 10));
}

// ============================================================================
// KAALA BALA — EXACT CLASSICAL BPHS / PL9 IMPLEMENTATION
// ============================================================================

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * ဟောရာအရှင် စဉ်ဆက် (Chaldean Order — အနှေးမှ အမြန်):
 * Saturn -> Jupiter -> Mars -> Sun -> Venus -> Mercury -> Moon
 */
const CHALDEAN_ORDER: readonly ClassicalPlanet[] = [
  "Saturn",
  "Jupiter",
  "Mars",
  "Sun",
  "Venus",
  "Mercury",
  "Moon",
];

function norm24(hours: number): number {
  return ((hours % 24) + 24) % 24;
}

/**
 * Equation of Time (မိနစ်ဖြင့်) — Smart's formula အရ Apparent Solar Time နှင့် Mean Solar Time ခြားနားချက်
 */
function equationOfTimeMinutes(jdUt: number): number {
  const T = (jdUt - 2451545.0) / 36525.0;
  const eps = (23.4392911 - 0.0130042 * T) * DEG2RAD;
  const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T) * DEG2RAD;
  const M = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T) * DEG2RAD;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;

  const y = Math.tan(eps / 2) * Math.tan(eps / 2);
  const eqRad =
    y * Math.sin(2 * L0) -
    2 * e * Math.sin(M) +
    4 * e * y * Math.sin(M) * Math.cos(2 * L0) -
    0.5 * y * y * Math.sin(4 * L0) -
    1.25 * e * e * Math.sin(2 * M);

  return eqRad * RAD2DEG * 4.0;
}

/**
 * ① Nathonnatha Bala (နတောနတဗလ — Max 60 Virupas)
 * - နေ့အားကြီးဂြိုဟ် (Sun, Jupiter, Venus): မွန်းတည့် (Apparent Solar Noon) တွင် 60၊ သန်းခေါင်ယံတွင် 0
 * - ညအားကြီးဂြိုဟ် (Moon, Mars, Saturn): သန်းခေါင်ယံ (Apparent Midnight) တွင် 60၊ မွန်းတည့်တွင် 0
 * - ဗုဒ္ဓဟူးဂြိုဟ် (Mercury): အချိန်မရွေး အမြဲတမ်း 60
 */
export function calculateNathonnathaBala(
  planet: ClassicalPlanet,
  jdUt: number,
  geoLonDeg: number,
): number {
  if (planet === "Mercury") {
    return 60.0;
  }

  // UT hours from 00:00 UT
  const utHours = ((jdUt + 0.5) - Math.floor(jdUt + 0.5)) * 24.0;
  // Local Mean Time (LMT) + Equation of Time = Local Apparent Solar Time (LAST)
  const eotHours = equationOfTimeMinutes(jdUt) / 60.0;
  const lastHours = norm24(utHours + geoLonDeg / 15.0 + eotHours);

  // သန်းခေါင်ယံ (00:00 LAST) မှ ကွာဝေးချိန် နာရီ (0 = သန်းခေါင်ယံ, 12 = မွန်းတည့်)
  const distFromMidnightHours = lastHours <= 12.0 ? lastHours : 24.0 - lastHours;

  // Unnata Virupas (မွန်းတည့်၌ 60, သန်းခေါင်ယံ၌ 0)
  const unnataVirupas = (distFromMidnightHours / 12.0) * 60.0;
  // Nata Virupas (သန်းခေါင်ယံ၌ 60, မွန်းတည့်၌ 0)
  const nataVirupas = 60.0 - unnataVirupas;

  const diurnalPlanets: readonly ClassicalPlanet[] = ["Sun", "Jupiter", "Venus"];
  const raw = diurnalPlanets.includes(planet) ? unnataVirupas : nataVirupas;

  return round2(Math.min(60, Math.max(0, raw)));
}

/**
 * ② Paksha Bala (ပက္ခဗလ — Max 60 Virupas, သို့မဟုတ် BPHS Dvigunam အရ Moon = Max 120)
 * - သောမဂြိုဟ်များ (Moon, Mercury, Jupiter, Venus): လဆန်းပက္ခတွင် အားတက်သည် (phaseAngle / 3)
 * - ပါပဂြိုဟ်များ (Sun, Mars, Saturn): လဆုတ်ပက္ခတွင် အားတက်သည် (60 - phaseAngle / 3)
 */
export function calculatePakshaBala(
  planet: ClassicalPlanet,
  moonLonDeg: number,
  sunLonDeg: number,
  doubleMoonPaksha: boolean = false,
): number {
  const diff = norm360(moonLonDeg - sunLonDeg);
  const phaseAngle = diff > 180.0 ? 360.0 - diff : diff; // [0°, 180°]
  const beneficPaksha = phaseAngle / 3.0; // [0, 60]

  const benefics: readonly ClassicalPlanet[] = ["Moon", "Mercury", "Jupiter", "Venus"];
  const isBenefic = benefics.includes(planet);
  const baseVal = isBenefic ? beneficPaksha : 60.0 - beneficPaksha;

  if (planet === "Moon" && doubleMoonPaksha) {
    return round2(baseVal * 2.0);
  }
  return round2(baseVal);
}

/**
 * ⑧ Ayana Bala (အယနဗလ — Max 60 Virupas)
 * - Tropical Longitude (Sayana) မှ Declination (Kranti) ကို တွက်ချက်သည်
 * - Sun, Mars, Jupiter, Venus: မြောက်ယဉ်စွန်း (+declination) တွင် အားကြီးသည်
 * - Moon, Saturn: တောင်ယဉ်စွန်း (-declination) တွင် အားကြီးသည်
 * - Mercury: မြောက်/တောင် နှစ်ဖက်လုံး (|declination|) တွင် အားကြီးသည်
 */
export function calculatePlanetDeclinationDeg(
  siderealLonDeg: number,
  ayanamsaDeg: number,
  eclipticLatDeg: number = 0,
): number {
  const tropicalLonRad = norm360(siderealLonDeg + ayanamsaDeg) * DEG2RAD;
  const latRad = eclipticLatDeg * DEG2RAD;
  const epsRad = OBLIQUITY_DEG * DEG2RAD;

  const sinDec =
    Math.sin(latRad) * Math.cos(epsRad) +
    Math.cos(latRad) * Math.sin(epsRad) * Math.sin(tropicalLonRad);
  return Math.asin(Math.max(-1, Math.min(1, sinDec))) * RAD2DEG;
}

export function calculateAyanaBala(
  planet: ClassicalPlanet,
  declinationDeg: number,
  doubleSunAyana: boolean = false,
): number {
  const clampedDec = Math.max(-OBLIQUITY_DEG, Math.min(OBLIQUITY_DEG, declinationDeg));

  let signedDec: number;
  if (planet === "Mercury") {
    signedDec = Math.abs(clampedDec);
  } else if (planet === "Moon" || planet === "Saturn") {
    signedDec = -clampedDec; // တောင်ယဉ်စွန်းအားကြီး
  } else {
    signedDec = clampedDec;  // မြောက်ယဉ်စွန်းအားကြီး (Sun, Mars, Jupiter, Venus)
  }

  const val = ((OBLIQUITY_DEG + signedDec) / (2.0 * OBLIQUITY_DEG)) * 60.0;
  const clamped = Math.min(60, Math.max(0, val));

  return round2(planet === "Sun" && doubleSunAyana ? clamped * 2.0 : clamped);
}

/**
 * ④ & ⑤ အတွက် တနင်္ဂနွေဂြိုဟ်၏ ပတ်လမ်း ဘဲဥပုံ (Kepler Equation of Center) ဖြင့်
 * ပစ်မှတ် Sidereal Longitude (ဥပမာ Mesha 0° သို့မဟုတ် Masa 30°*k) သို့ ဝင်ရောက်သည့်
 * အတိအကျ Sankranti JD ကို ရှာဖွေပေးသော Solver (Aphelion ~4.7 ရက် လွဲချော်မှုကို အပြီးတိုင် ဖယ်ရှားပေးသည်)
 */
function findExactSolarSankrantiJd(
  currentJdUt: number,
  currentSunSiderealLon: number,
  targetSiderealLon: number,
): number {
  // လက်ရှိ တနင်္ဂနွေဂြိုဟ်သည် targetSiderealLon မှ မည်မျှ ဒီဂရီ ကျော်လွန်လာပြီနည်း [0, 360)
  const deltaDeg = norm360(currentSunSiderealLon - targetSiderealLon);

  // Keplerian Solar Anomaly ဖြင့် t ၌ တနင်္ဂနွေဂြိုဟ် ရွေ့လျားခဲ့သော ဒီဂရီကို တွက်သည့် helper
  const solarMotionBetween = (jdStart: number, jdEnd: number): number => {
    const dt = jdEnd - jdStart;
    const meanMotion = 0.98560028 * dt;
    // J2000 မှ Mean Anomaly M (deg)
    const mStart = norm360(357.52911 + 0.98560028 * (jdStart - 2451545.0)) * DEG2RAD;
    const mEnd = norm360(357.52911 + 0.98560028 * (jdEnd - 2451545.0)) * DEG2RAD;
    // Equation of Center (C ≈ 1.9148° sin M + 0.0200° sin 2M)
    const cStart = 1.9148 * Math.sin(mStart) + 0.02 * Math.sin(2 * mStart);
    const cEnd = 1.9148 * Math.sin(mEnd) + 0.02 * Math.sin(2 * mEnd);
    return meanMotion + (cEnd - cStart);
  };

  // ကနဦး ခန့်မှန်းချက်
  let sankrantiJd = currentJdUt - deltaDeg / 0.98560028;

  // Newton-Raphson 4-step refinement (အမှား < 0.0005° ≈ 30 စက္ကန့်အောက်)
  for (let i = 0; i < 4; i++) {
    const moved = solarMotionBetween(sankrantiJd, currentJdUt);
    const residual = moved - deltaDeg; // moved == deltaDeg ဖြစ်ရမည်
    const mRad = norm360(357.52911 + 0.98560028 * (sankrantiJd - 2451545.0)) * DEG2RAD;
    const instSpeed = 0.98560028 + 0.03293 * Math.cos(mRad);
    sankrantiJd += residual / instSpeed;
  }

  return sankrantiJd;
}

/**
 * နေထွက်ချိန်အခြေပြု ဝေဒနေ့အရှင်ညွှန်းကိန်း (0 = Sunday .. 6 = Saturday)
 */
export function getVedicWeekdayAtJd(
  jdUt: number,
  tzOffsetHours: number,
  localSunriseHour: number,
): number {
  const localJd = jdUt + tzOffsetHours / 24.0;
  const civilDayIndex = Math.floor(localJd + 0.5);
  const localHour = (localJd + 0.5 - civilDayIndex) * 24.0;
  const civilWeekday = ((civilDayIndex + 1) % 7 + 7) % 7;

  if (localHour < localSunriseHour) {
    return (civilWeekday + 6) % 7;
  }
  return civilWeekday;
}

/**
 * Kaala Bala တွက်ချက်မှု ရလဒ် Interface
 */
export interface PlanetKaalaBreakdown {
  nathonnatha: number;
  paksha: number;
  tribhaga: number;
  abda: number;
  masa: number;
  vaara: number;
  hora: number;
  ayana: number;
  yuddha: number;
  total: number;
}

export interface KaalaBalaBreakdown {
  nathonnatha: Record<ClassicalPlanet, number>;
  paksha: Record<ClassicalPlanet, number>;
  tribhaga: Record<ClassicalPlanet, number>;
  abda: Record<ClassicalPlanet, number>;
  masa: Record<ClassicalPlanet, number>;
  vaara: Record<ClassicalPlanet, number>;
  hora: Record<ClassicalPlanet, number>;
  ayana: Record<ClassicalPlanet, number>;
  yuddha: Record<ClassicalPlanet, number>;
  total: Record<ClassicalPlanet, number>;
  abdaLord: ClassicalPlanet;
  masaLord: ClassicalPlanet;
  vaaraLord: ClassicalPlanet;
  horaLord: ClassicalPlanet;
  tribhagaLord: ClassicalPlanet;
  byPlanet: Record<ClassicalPlanet, PlanetKaalaBreakdown>;
  lords: {
    abdaLord: ClassicalPlanet;
    masaLord: ClassicalPlanet;
    vaaraLord: ClassicalPlanet;
    horaLord: ClassicalPlanet;
    tribhagaRuler: ClassicalPlanet;
  };
  sunAyana: number;
  unDoubledMoonPaksha: number;
}

export type KaalaBalaOutput = KaalaBalaBreakdown;

export interface CalculateKaalaBalaOptions {
  planets:
    | readonly PlanetPositionInput[]
    | Record<
        ClassicalPlanet,
        {
          lon: number;
          lat?: number;
          speed?: number;
          declinationDeg?: number;
        }
      >;
  jdUt: number;
  tzOffsetHours: number;
  geoLonDeg: number;
  ayanamsaDeg: number;
  /** PANCHANGA block မှ ပို့ပေးသော နေ့အရှင် (0=Sun..6=Sat သို့မဟုတ် ClassicalPlanet) */
  weekday?: number | ClassicalPlanet;
  /** HORA block မှ ပို့ပေးသော လက်ရှိ ဟောရာအရှင် */
  horaLord?: ClassicalPlanet;
  /** အစစ်အမှန် နေထွက်ချိန် JD (UT) */
  sunriseJdUt?: number;
  /** အစစ်အမှန် နေဝင်ချိန် JD (UT) */
  sunsetJdUt?: number;
  /** ဒေသစံတော်ချိန်အရ နေထွက်ချိန် နာရီ (sunriseJdUt မပါလျှင် သုံးရန်) */
  localSunriseHour?: number;
  /** ဒေသစံတော်ချိန်အရ နေဝင်ချိန် နာရီ (sunsetJdUt မပါလျှင် သုံးရန်) */
  localSunsetHour?: number;
  /** BPHS Dvigunam အရ တနင်္လာဂြိုဟ် Paksha Bala ကို ၂ ဆ (max 120) ပေးမည်လား (PL9 တွင် false) */
  doubleMoonPaksha?: boolean;
  /** BPHS အရ တနင်္ဂနွေဂြိုဟ် Ayana Bala ကို ၂ ဆ ပေးမည်လား (PL9 တွင် false) */
  doubleSunAyana?: boolean;
  /** Masa calculation convention (AMANTA_LUNAR or SAURA_SANKRANTI) */
  masaConvention?: MasaConvention;
}

// ============================================================================
// ⑨ YUDDHA BALA (BPHS CH. 27 SLOKA 20: PLANETARY WAR)
// ============================================================================

export const BIMBA_PARIMANA_ARCSEC: Record<TaraGrahaId, number> = {
  Mars: 9.4,
  Mercury: 6.6,
  Jupiter: 190.4,
  Venus: 16.6,
  Saturn: 158.0,
};

export type YuddhaStrengthBasis =
  | "KAALA_BALA_PRE_YUDDHA"
  | "STHANA_DIG_KAALA";

export type YuddhaVictorRule =
  | "NORTHERN_LATITUDE"
  | "VENUS_ALWAYS_WINS_NORTH"
  | "HIGHER_PRE_WAR_BALA";

export interface WarringPlanetInput extends PlanetPositionInput {
  lat?: number;
}

export interface YuddhaBalaOptions {
  warOrbDeg?: number;
  strengthBasis?: YuddhaStrengthBasis;
  victorRule?: YuddhaVictorRule;
  discDiametersArcsec?: Partial<Record<TaraGrahaId, number>>;
}

export function isTaraGraha(planet: PlanetId): planet is TaraGrahaId {
  return planet !== "Sun" && planet !== "Moon";
}

export interface PlanetaryWarEncounter {
  planetA: TaraGrahaId;
  planetB: TaraGrahaId;
  victor: TaraGrahaId;
  vanquished: TaraGrahaId;
  angularSeparationDeg: number;
  preWarBalaA: number;
  preWarBalaB: number;
  strengthDiffVirupas: number;
  discDiameterA: number;
  discDiameterB: number;
  discDiameterDiffArcsec: number;
  yuddhaTransferVirupas: number;
  victoryReason:
    | "NORTHERN_LATITUDE"
    | "VENUS_EXEMPTION"
    | "LONGITUDE_FALLBACK"
    | "STRENGTH_FALLBACK";
}

export interface YuddhaBalaOutput {
  yuddhaVirupasByPlanet: Record<PlanetId, number>;
  adjustedKaalaBalaByPlanet: Record<PlanetId, number>;
  encounters: PlanetaryWarEncounter[];
  hasPlanetaryWar: boolean;
}

export function resolvePlanetaryWarVictor(
  posA: WarringPlanetInput & { planet: TaraGrahaId },
  posB: WarringPlanetInput & { planet: TaraGrahaId },
  preWarBalaA: number,
  preWarBalaB: number,
  victorRule: YuddhaVictorRule = "NORTHERN_LATITUDE"
): {
  victor: TaraGrahaId;
  vanquished: TaraGrahaId;
  reason: PlanetaryWarEncounter["victoryReason"];
} {
  if (victorRule === "VENUS_ALWAYS_WINS_NORTH") {
    if (posA.planet === "Venus") {
      return {
        victor: "Venus",
        vanquished: posB.planet,
        reason: "VENUS_EXEMPTION",
      };
    }
    if (posB.planet === "Venus") {
      return {
        victor: "Venus",
        vanquished: posA.planet,
        reason: "VENUS_EXEMPTION",
      };
    }
  }

  if (
    victorRule !== "HIGHER_PRE_WAR_BALA" &&
    typeof posA.lat === "number" &&
    typeof posB.lat === "number" &&
    Math.abs(posA.lat - posB.lat) > 1e-6
  ) {
    if (posA.lat > posB.lat) {
      return {
        victor: posA.planet,
        vanquished: posB.planet,
        reason: "NORTHERN_LATITUDE",
      };
    }
    return {
      victor: posB.planet,
      vanquished: posA.planet,
      reason: "NORTHERN_LATITUDE",
    };
  }

  if (
    victorRule === "HIGHER_PRE_WAR_BALA" &&
    Math.abs(preWarBalaA - preWarBalaB) > 1e-6
  ) {
    if (preWarBalaA >= preWarBalaB) {
      return {
        victor: posA.planet,
        vanquished: posB.planet,
        reason: "STRENGTH_FALLBACK",
      };
    }
    return {
      victor: posB.planet,
      vanquished: posA.planet,
      reason: "STRENGTH_FALLBACK",
    };
  }

  const signedDelta = norm360(posB.lon - posA.lon);
  if (signedDelta <= 180 && signedDelta > 1e-6) {
    return {
      victor: posA.planet,
      vanquished: posB.planet,
      reason: "LONGITUDE_FALLBACK",
    };
  }
  return {
    victor: posB.planet,
    vanquished: posA.planet,
    reason: "LONGITUDE_FALLBACK",
  };
}

export function calculateYuddhaBala(
  planets: readonly WarringPlanetInput[],
  preYuddhaKaalaBala: Record<PlanetId, number>,
  sthanaAndDigBala?: Record<PlanetId, number>,
  options: YuddhaBalaOptions = {}
): YuddhaBalaOutput {
  const {
    warOrbDeg = 1.0,
    strengthBasis = "KAALA_BALA_PRE_YUDDHA",
    victorRule = "NORTHERN_LATITUDE",
    discDiametersArcsec,
  } = options;

  const diameters: Record<TaraGrahaId, number> = {
    ...BIMBA_PARIMANA_ARCSEC,
    ...discDiametersArcsec,
  };

  const yuddhaVirupasByPlanet: Record<PlanetId, number> = {
    Sun: 0,
    Moon: 0,
    Mars: 0,
    Mercury: 0,
    Jupiter: 0,
    Venus: 0,
    Saturn: 0,
  };

  const preWarStrength: Record<TaraGrahaId, number> = {
    Mars: 0,
    Mercury: 0,
    Jupiter: 0,
    Venus: 0,
    Saturn: 0,
  };

  for (const tg of TARA_GRAHAS) {
    const kaala = preYuddhaKaalaBala[tg] ?? 0;
    const sthanaDig =
      strengthBasis === "STHANA_DIG_KAALA" && sthanaAndDigBala
        ? (sthanaAndDigBala[tg] ?? 0)
        : 0;
    preWarStrength[tg] = round2(kaala + sthanaDig);
  }

  const taraPositions = TARA_GRAHAS.map((id) =>
    planets.find((p) => p.planet === id)
  ).filter(
    (p): p is WarringPlanetInput & { planet: TaraGrahaId } => p !== undefined
  );

  const encounters: PlanetaryWarEncounter[] = [];

  for (let i = 0; i < taraPositions.length; i++) {
    for (let j = i + 1; j < taraPositions.length; j++) {
      const posA = taraPositions[i]!;
      const posB = taraPositions[j]!;
      const sep = shortestArc(posA.lon, posB.lon);
      if (sep >= warOrbDeg) continue;

      const preA = preWarStrength[posA.planet];
      const preB = preWarStrength[posB.planet];
      const strengthDiff = Math.abs(preA - preB);
      const discA = diameters[posA.planet];
      const discB = diameters[posB.planet];
      const discDiff = Math.abs(discA - discB);
      if (discDiff < 1e-6) continue;

      const transfer = round2(strengthDiff / discDiff);
      const { victor, vanquished, reason } = resolvePlanetaryWarVictor(
        posA,
        posB,
        preA,
        preB,
        victorRule
      );

      yuddhaVirupasByPlanet[victor] = round2(
        yuddhaVirupasByPlanet[victor] + transfer
      );
      yuddhaVirupasByPlanet[vanquished] = round2(
        yuddhaVirupasByPlanet[vanquished] - transfer
      );

      encounters.push({
        planetA: posA.planet,
        planetB: posB.planet,
        victor,
        vanquished,
        angularSeparationDeg: round2(sep),
        preWarBalaA: preA,
        preWarBalaB: preB,
        strengthDiffVirupas: round2(strengthDiff),
        discDiameterA: discA,
        discDiameterB: discB,
        discDiameterDiffArcsec: round2(discDiff),
        yuddhaTransferVirupas: transfer,
        victoryReason: reason,
      });
    }
  }

  const adjustedKaalaBalaByPlanet = {} as Record<PlanetId, number>;
  for (const p of PLANET_ORDER) {
    adjustedKaalaBalaByPlanet[p] = round2(
      (preYuddhaKaalaBala[p] ?? 0) + yuddhaVirupasByPlanet[p]
    );
  }

  return {
    yuddhaVirupasByPlanet,
    adjustedKaalaBalaByPlanet,
    encounters,
    hasPlanetaryWar: encounters.length > 0,
  };
}

/**
 * Kaala Bala (ကာလဗလ) အစိတ်အပိုင်း (၉) ခုလုံးကို အတိအကျ တွက်ချက်ပေးသော Function
 */
export function calculateKaalaBala(opts: CalculateKaalaBalaOptions | ShadbalaChartInput): KaalaBalaBreakdown {
  const {
    jdUt,
    tzOffsetHours,
    geoLonDeg,
    ayanamsaDeg,
    doubleMoonPaksha = false,
    doubleSunAyana = false,
  } = opts as any;

  let planetsRecord: Record<
    ClassicalPlanet,
    { lon: number; lat?: number; speed?: number; declinationDeg?: number }
  >;
  if (Array.isArray(opts.planets)) {
    planetsRecord = {} as any;
    for (const p of CLASSICAL_PLANETS_ORDER) {
      const pl = (opts.planets as readonly PlanetPositionInput[]).find(x => x.planet === p);
      planetsRecord[p] = { lon: pl?.lon ?? 0, lat: pl?.lat, speed: pl?.speed };
    }
  } else {
    planetsRecord = opts.planets as Record<ClassicalPlanet, any>;
  }

  const planets = planetsRecord;
  const sunLon = norm360(planets.Sun.lon);
  const moonLon = norm360(planets.Moon.lon);

  // နေထွက်/နေဝင်ချိန် (Local Hours) ကို sunriseJdUt / sunsetJdUt မှ တိုက်ရိုက်ယူမည် (မပါပါက Equation of Time ပါဝင်သော LMT ဖြင့် ချိန်ညှိမည်)
  const jdToLocalHours = (jd: number): number => {
    const localJd = jd + tzOffsetHours / 24.0;
    return (localJd + 0.5 - Math.floor(localJd + 0.5)) * 24.0;
  };

  const defaultMeridianOffset = tzOffsetHours - geoLonDeg / 15.0;
  const localSunriseHour =
    opts.localSunriseHour ??
    (opts.sunriseJdUt !== undefined
      ? jdToLocalHours(opts.sunriseJdUt)
      : 6.0 + defaultMeridianOffset);
  const localSunsetHour =
    opts.localSunsetHour ??
    (opts.sunsetJdUt !== undefined
      ? jdToLocalHours(opts.sunsetJdUt)
      : 18.0 + defaultMeridianOffset);

  const currentLocalHour = jdToLocalHours(jdUt);

  // နေ့ သို့မဟုတ် ည နှင့် သုံးပုံတစ်ပုံ (Tribhaga) / ဟောရာ (Hora) အပိုင်းအခြား ရှာဖွေခြင်း
  let isDaytime: boolean;
  let dayOrNightFraction: number; // [0, 1)

  if (
    opts.sunriseJdUt !== undefined &&
    opts.sunsetJdUt !== undefined &&
    opts.sunsetJdUt > opts.sunriseJdUt &&
    opts.sunsetJdUt - opts.sunriseJdUt < 0.95
  ) {
    const dayLengthJd = opts.sunsetJdUt - opts.sunriseJdUt;
    const nightLengthJd = 1.0 - dayLengthJd;

    if (jdUt >= opts.sunriseJdUt && jdUt < opts.sunsetJdUt) {
      isDaytime = true;
      dayOrNightFraction = (jdUt - opts.sunriseJdUt) / dayLengthJd;
    } else if (jdUt >= opts.sunsetJdUt) {
      isDaytime = false;
      dayOrNightFraction = (jdUt - opts.sunsetJdUt) / nightLengthJd;
    } else {
      // နံနက် နေမထွက်မီ (ယခင်နေ့ နေဝင်ချိန်မှ လက်ရှိနေထွက်ချိန်အကြား)
      isDaytime = false;
      const prevSunsetJd = opts.sunsetJdUt - 1.0;
      dayOrNightFraction = (jdUt - prevSunsetJd) / nightLengthJd;
    }
  } else {
    const dayDuration = localSunsetHour - localSunriseHour;
    const nightDuration = 24.0 - dayDuration;
    if (currentLocalHour >= localSunriseHour && currentLocalHour < localSunsetHour) {
      isDaytime = true;
      dayOrNightFraction = (currentLocalHour - localSunriseHour) / dayDuration;
    } else {
      isDaytime = false;
      const hoursSinceSunset =
        currentLocalHour >= localSunsetHour
          ? currentLocalHour - localSunsetHour
          : currentLocalHour + (24.0 - localSunsetHour);
      dayOrNightFraction = hoursSinceSunset / nightDuration;
    }
  }

  dayOrNightFraction = Math.max(0, Math.min(0.999999, dayOrNightFraction));

  // ⑥ Vaara Lord (နေ့အရှင်) — PANCHANGA မှ ပို့ပေးလျှင် တိုက်ရိုက်သုံးမည်
  let vaaraIndex: number;
  if (typeof opts.weekday === "number") {
    vaaraIndex = ((opts.weekday % 7) + 7) % 7;
  } else if (typeof opts.weekday === "string") {
    vaaraIndex = VAARA_LORDS.indexOf(opts.weekday);
  } else {
    vaaraIndex = getVedicWeekdayAtJd(jdUt, tzOffsetHours, localSunriseHour);
  }
  const vaaraLord = VAARA_LORDS[vaaraIndex]!;

  // ⑦ Hora Lord (ဟောရာအရှင်) — HORA block မှ ပို့ပေးလျှင် တိုက်ရိုက်သုံးမည်
  let horaLord: ClassicalPlanet;
  if (opts.horaLord) {
    horaLord = opts.horaLord;
  } else {
    const subHoraIndex = Math.min(11, Math.floor(dayOrNightFraction * 12));
    const horaNumberZeroBased = isDaytime ? subHoraIndex : 12 + subHoraIndex;
    const startIdx = CHALDEAN_ORDER.indexOf(vaaraLord);
    horaLord = CHALDEAN_ORDER[(startIdx + horaNumberZeroBased) % 7]!;
  }

  // ③ Tribhaga Lord (သုံးပုံတစ်ပုံအရှင်)
  const thirdIndex = Math.min(2, Math.floor(dayOrNightFraction * 3));
  const DAY_TRIBHAGA_LORDS: readonly ClassicalPlanet[] = ["Mercury", "Sun", "Saturn"];
  const NIGHT_TRIBHAGA_LORDS: readonly ClassicalPlanet[] = ["Moon", "Venus", "Mars"];
  const tribhagaLord = isDaytime
    ? DAY_TRIBHAGA_LORDS[thirdIndex]!
    : NIGHT_TRIBHAGA_LORDS[thirdIndex]!;

  // ④ Abda Lord (နှစ်အရှင် — Mesha Sankranti 0° Aries)
  const meshaSankrantiJd = findExactSolarSankrantiJd(jdUt, sunLon, 0.0);
  const abdaWeekday = getVedicWeekdayAtJd(meshaSankrantiJd, tzOffsetHours, localSunriseHour);
  const abdaLord = VAARA_LORDS[abdaWeekday]!;

  // ⑤ Masa Lord (လအရှင် — Current Solar Sign Sankranti)
  const currentSignStartLon = Math.floor(sunLon / 30.0) * 30.0;
  const masaSankrantiJd = findExactSolarSankrantiJd(jdUt, sunLon, currentSignStartLon);
  const masaWeekday = getVedicWeekdayAtJd(masaSankrantiJd, tzOffsetHours, localSunriseHour);
  const masaLord = VAARA_LORDS[masaWeekday]!;

  const nathonnatha = {} as Record<ClassicalPlanet, number>;
  const paksha = {} as Record<ClassicalPlanet, number>;
  const tribhaga = {} as Record<ClassicalPlanet, number>;
  const abda = {} as Record<ClassicalPlanet, number>;
  const masa = {} as Record<ClassicalPlanet, number>;
  const vaara = {} as Record<ClassicalPlanet, number>;
  const hora = {} as Record<ClassicalPlanet, number>;
  const ayana = {} as Record<ClassicalPlanet, number>;
  const yuddha = {} as Record<ClassicalPlanet, number>;
  const preYuddhaTotal = {} as Record<ClassicalPlanet, number>;
  const total = {} as Record<ClassicalPlanet, number>;

  for (const p of CLASSICAL_PLANETS_ORDER) {
    nathonnatha[p] = calculateNathonnathaBala(p, jdUt, geoLonDeg);
    paksha[p] = calculatePakshaBala(p, moonLon, sunLon, doubleMoonPaksha);

    // Tribhaga: Jupiter သည် အမြဲ 60 ရပြီး၊ လက်ရှိ သုံးပုံတစ်ပုံအရှင်လည်း 60 ရသည်
    tribhaga[p] = p === "Jupiter" || p === tribhagaLord ? 60.0 : 0.0;

    // Abda (15), Masa (30), Vaara (45), Hora (60)
    abda[p] = p === abdaLord ? 15.0 : 0.0;
    masa[p] = p === masaLord ? 30.0 : 0.0;
    vaara[p] = p === vaaraLord ? 45.0 : 0.0;
    hora[p] = p === horaLord ? 60.0 : 0.0;

    // Ayana Bala (Declination အခြေပြု)
    const dec =
      planets[p].declinationDeg ??
      calculatePlanetDeclinationDeg(planets[p].lon, ayanamsaDeg, planets[p].lat ?? 0);
    ayana[p] = calculateAyanaBala(p, dec, doubleSunAyana);

    yuddha[p] = 0.0;
    preYuddhaTotal[p] =
      nathonnatha[p] +
      paksha[p] +
      tribhaga[p] +
      abda[p] +
      masa[p] +
      vaara[p] +
      hora[p] +
      ayana[p];
  }

  // ⑨ Yuddha Bala (ဂြိုဟ်စစ်ထိုးခြင်း — တာရာဂြိုဟ် ၅ လုံးအကြား < 1° ပူးယှဉ်မှု)
  const warringPlanets: WarringPlanetInput[] = CLASSICAL_PLANETS_ORDER.map((p) => ({
    planet: p,
    lon: planets[p].lon,
    lat:
      planets[p].lat ??
      planets[p].declinationDeg ??
      calculatePlanetDeclinationDeg(planets[p].lon, ayanamsaDeg, 0),
    speed: planets[p].speed ?? 0,
    house: 1,
  }));
  const yuddhaResult = calculateYuddhaBala(warringPlanets, preYuddhaTotal);
  for (const p of CLASSICAL_PLANETS_ORDER) {
    yuddha[p] = yuddhaResult.yuddhaVirupasByPlanet[p] ?? 0.0;
  }

  for (const p of CLASSICAL_PLANETS_ORDER) {
    total[p] = round2(preYuddhaTotal[p] + yuddha[p]);
  }

  const byPlanet = {} as Record<ClassicalPlanet, PlanetKaalaBreakdown>;
  for (const p of CLASSICAL_PLANETS_ORDER) {
    byPlanet[p] = {
      nathonnatha: nathonnatha[p],
      paksha: paksha[p],
      tribhaga: tribhaga[p],
      abda: abda[p],
      masa: masa[p],
      vaara: vaara[p],
      hora: hora[p],
      ayana: ayana[p],
      yuddha: yuddha[p],
      total: total[p],
    };
  }

  const lords = {
    abdaLord,
    masaLord,
    vaaraLord,
    horaLord,
    tribhagaRuler: tribhagaLord,
  };

  const sunAyana = doubleSunAyana
    ? calculateAyanaBala(
        "Sun",
        planets.Sun.declinationDeg ??
          calculatePlanetDeclinationDeg(planets.Sun.lon, ayanamsaDeg, planets.Sun.lat ?? 0),
        false
      )
    : ayana.Sun;
  const unDoubledMoonPaksha = calculatePakshaBala("Moon", moonLon, sunLon, false);

  return {
    nathonnatha,
    paksha,
    tribhaga,
    abda,
    masa,
    vaara,
    hora,
    ayana,
    yuddha,
    total,
    abdaLord,
    masaLord,
    vaaraLord,
    horaLord,
    tribhagaLord,
    byPlanet,
    lords,
    sunAyana,
    unDoubledMoonPaksha,
  };
}







// ============================================================================
// 4. CHESTA BALA (BPHS CH. 27 SLOKAS 18, 21-25 CANONICAL IMPLEMENTATION)
// ============================================================================

/**
 * BPHS 27.21-22: 8 States of Planetary Motion (Ashta-Gati) for the 5 Tara Grahas
 */
export type AshtaGatiState =
  | "Vakra"      // ၁။ ဝကြ — လက်ရှိရာသီခွင်အတွင်း နောက်ပြန်သွားခြင်း (Full Retrograde)
  | "Anuvakra"   // ၂။ အနုဝကြ — နောက်ပြန်သွားရင်း အရှေ့ရာသီခွင်သို့ ပြန်ဝင်ခြင်း
  | "Vikala"     // ၃။ ဝိကလ (ကုဋိလ) — ရပ်တန့်နေခြင်း (Stationary: |R| < 0.05 or |v| < 1'/day)
  | "Manda"      // ၄။ မန္ဒ — ပုံမှန်သွားနှုန်းထက် အနည်းငယ်နှေးကွေးခြင်း (0.50 <= R < 0.90)
  | "Mandatara"  // ၅။ မန္ဒတရ — အလွန်နှေးကွေးခြင်း (0.05 <= R < 0.50)
  | "Sama"       // ၆။ သမ — ပုံမှန်သွားနှုန်းအတိုင်း သွားနေခြင်း (0.90 <= R <= 1.10)
  | "Chara"      // ၇။ စရ (သီဃြ) — ပုံမှန်သွားနှုန်းထက် မြန်ဆန်ခြင်း (1.10 < R <= 1.50)
  | "Atichara";  // ၈။ အတိစရ — အလွန်မြန်သောအရှိန်ဖြင့် နောက်ရာသီသို့ ကျော်ဝင်ခြင်း (R > 1.50)

export type LuminaryChestaState = "AyanaBalaProxy" | "PakshaBalaProxy";
export type PlanetGatiClassification = AshtaGatiState | LuminaryChestaState;

/**
 * Chesta Bala Calculation Mode:
 *   - BPHS_ORIGINAL_27_23 : BPHS မူရင်းဂါထာ (27.23) တန်ဖိုးများ (60, 30, 15, 30, 15, 7.5, 45, 30)
 *   - MODERN_SOFTWARE     : ခေတ်သစ် Software မူကွဲတန်ဖိုးများ (60, 30, 15, 15, 7.5, 30, 30, 45)
 *   - METHOD_1_KENDRA     : BPHS (27.24-25) Seeghrocha / Chesta Kendra နည်းလမ်း (Chesta Kendra / 3)
 */
export type ChestaBalaMode =
  | "BPHS_ORIGINAL_27_23"
  | "MODERN_SOFTWARE"
  | "METHOD_1_KENDRA";

/**
 * Geocentric Mean Daily Motion (degrees/day) for the 5 Tara Grahas
 */
export const TARA_MEAN_DAILY_SPEED_DEG: Record<TaraGrahaId, number> = {
  Mars: 0.5240,    // 0° 31' 26"
  Mercury: 0.9856, // 0° 59' 08" (Geocentric Mean)
  Jupiter: 0.0831, // 0° 04' 59"
  Venus: 0.9856,   // 0° 59' 08" (Geocentric Mean)
  Saturn: 0.0335,  // 0° 02' 00"
};

/**
 * Practical Maximum Daily Speed (degrees/day) for UI & reference diagnostics
 */
export const TARA_MAX_DAILY_SPEED_DEG: Record<TaraGrahaId, number> = {
  Mars: 0.79,
  Mercury: 2.20,
  Jupiter: 0.24,
  Venus: 1.25,
  Saturn: 0.13,
};

/**
 * BPHS Original Sloka 27.23 Virupa Table (R. Santhanam / G.C. Sharma)
 * Sequence: Vakra=60, Anuvakra=30, Vikala=15, Manda=30, Mandatara=15, Sama=7.5, Chara=45, Atichara=30
 */
export const ASHTA_GATI_VIRUPAS_BPHS_ORIGINAL: Record<AshtaGatiState, number> = {
  Vakra: 60.0,
  Anuvakra: 30.0,
  Vikala: 15.0,
  Manda: 30.0,
  Mandatara: 15.0,
  Sama: 7.5,
  Chara: 45.0,
  Atichara: 30.0,
};

/**
 * Modern Jyotish Software Variant Virupa Table
 * Sequence: Vakra=60, Anuvakra=30, Vikala=15, Manda=15, Mandatara=7.5, Sama=30, Chara=30, Atichara=45
 */
export const ASHTA_GATI_VIRUPAS_MODERN_VARIANT: Record<AshtaGatiState, number> = {
  Vakra: 60.0,
  Anuvakra: 30.0,
  Vikala: 15.0,
  Manda: 15.0,
  Mandatara: 7.5,
  Sama: 30.0,
  Chara: 30.0,
  Atichara: 45.0,
};

export interface AshtaGatiThresholds {
  /** Vikala stationary ratio cutoff (default 0.05 = 5% of mean speed) */
  vikalaMaxRatio: number;
  /** Vikala absolute daily motion cutoff in degrees (default 1 arcminute = 1/60 deg) */
  vikalaMaxAbsSpeedDeg: number;
  /** Mandatara upper bound (default 0.50 = 50% of mean speed) */
  mandataraMaxRatio: number;
  /** Manda upper bound (default 0.90 = 90% of mean speed) */
  mandaMaxRatio: number;
  /** Sama upper bound (default 1.10 = 110% of mean speed) */
  samaMaxRatio: number;
  /** Chara upper bound before Atichara (default 1.50 = 150% of mean speed) */
  charaMaxRatio: number;
}

export const DEFAULT_ASHTA_GATI_THRESHOLDS: Readonly<AshtaGatiThresholds> = {
  vikalaMaxRatio: 0.05,
  vikalaMaxAbsSpeedDeg: 1.0 / 60.0, // 0° 01' (1 arcminute/day)
  mandataraMaxRatio: 0.50,
  mandaMaxRatio: 0.90,
  samaMaxRatio: 1.10,
  charaMaxRatio: 1.50,
};

export interface ChestaPlanetInput extends PlanetPositionInput {
  /** Optional Day-2 longitude (if provided without speed, v = lonDay2 - lon) */
  lonDay2?: number;
  /** Optional longitude where retrograde station began (to detect Anuvakra sign change) */
  stationRetrogradeLon?: number;
  /** Explicit flag: retrograde planet crossed back into previous sign (Anuvakra) */
  isAnuvakra?: boolean;
  /** Explicit flag: accelerated planet crossed into next sign (Atichara) */
  isAtichara?: boolean;
  /** Optional Method 1 inputs: Mean Longitude (Madhyama) and Seeghrocha (degrees) */
  meanLon?: number;
  seeghrochaLon?: number;
}

export interface PlanetChestaBalaDetail {
  planet: PlanetId;
  mode: ChestaBalaMode;
  gatiState: PlanetGatiClassification;
  dailySpeedDeg: number;
  meanSpeedDeg: number;
  speedRatio: number;
  isRetrograde: boolean;
  currentRasi: RasiIndex;
  chestaKendraDeg?: number;
  chestaBalaVirupas: number;
  chestaBalaRupas: number;
}

/**
 * Compute True Daily Speed v = Longitude_Day2 - Longitude_Day1 (handling 360° wrap)
 */
export function computeDailySpeedFromLongitudes(
  lonDay1: number,
  lonDay2: number
): number {
  const diff = norm360(lonDay2) - norm360(lonDay1);
  if (diff > 180) return diff - 360;
  if (diff < -180) return diff + 360;
  return round4(diff);
}

/**
 * BPHS Method 1 (Slokas 27.24-25): Seeghrocha / Chesta Kendra Formula
 *   1. Average Longitude = (Mean Longitude + True Longitude) / 2
 *   2. Chesta Kendra = |Seeghrocha - Average Longitude| reduced to [0°, 180°]
 *   3. Chesta Bala (Virupas) = Chesta Kendra / 3
 */
export function calculateMethod1ChestaKendraBala(
  trueLonDeg: number,
  meanLonDeg: number,
  seeghrochaLonDeg: number
): { chestaKendraDeg: number; chestaBalaVirupas: number; chestaBalaRupas: number } {
  const avgLon = (norm360(meanLonDeg) + norm360(trueLonDeg)) / 2.0;
  const chestaKendraDeg = shortestArc(seeghrochaLonDeg, avgLon);
  const chestaBalaVirupas = round2(Math.max(0, Math.min(60, chestaKendraDeg / 3.0)));
  return {
    chestaKendraDeg: round4(chestaKendraDeg),
    chestaBalaVirupas,
    chestaBalaRupas: round4(chestaBalaVirupas / 60.0),
  };
}

/**
 * BPHS Method 2 (Slokas 27.21-23): Classify Tara Graha into 1 of the 8 Ashta-Gati states
 */
export function classifyTaraGrahaAshtaGati(
  input: ChestaPlanetInput & { planet: TaraGrahaId },
  thresholds: AshtaGatiThresholds = DEFAULT_ASHTA_GATI_THRESHOLDS
): {
  gatiState: AshtaGatiState;
  dailySpeedDeg: number;
  meanSpeedDeg: number;
  speedRatio: number;
  isRetrograde: boolean;
  currentRasi: RasiIndex;
} {
  const dailySpeedDeg =
    typeof input.lonDay2 === "number" && !Number.isNaN(input.lonDay2)
      ? computeDailySpeedFromLongitudes(input.lon, input.lonDay2)
      : input.speed;

  const meanSpeedDeg = TARA_MEAN_DAILY_SPEED_DEG[input.planet];
  const speedRatio = dailySpeedDeg / meanSpeedDeg;
  const absSpeed = Math.abs(dailySpeedDeg);
  const absRatio = Math.abs(speedRatio);
  const isRetrograde = Boolean(input.retro) || dailySpeedDeg < 0;

  const currentRasi = Math.floor(norm360(input.lon) / 30) as RasiIndex;
  const stationRasi =
    typeof input.stationRetrogradeLon === "number" &&
    !Number.isNaN(input.stationRetrogradeLon)
      ? (Math.floor(norm360(input.stationRetrogradeLon) / 30) as RasiIndex)
      : undefined;

  // 1. Vikala (Stationary): |R| < 0.05 OR |v| < 0°01' (1 arcminute/day)
  if (
    absRatio < thresholds.vikalaMaxRatio ||
    absSpeed < thresholds.vikalaMaxAbsSpeedDeg
  ) {
    return {
      gatiState: "Vikala",
      dailySpeedDeg,
      meanSpeedDeg,
      speedRatio: round4(speedRatio),
      isRetrograde,
      currentRasi,
    };
  }

  // 2 & 3. Retrograde States: Anuvakra (previous sign re-entry) vs Vakra (same sign)
  if (isRetrograde) {
    const crossedIntoPreviousSign =
      input.isAnuvakra === true ||
      (stationRasi !== undefined && stationRasi !== currentRasi);

    return {
      gatiState: crossedIntoPreviousSign ? "Anuvakra" : "Vakra",
      dailySpeedDeg,
      meanSpeedDeg,
      speedRatio: round4(speedRatio),
      isRetrograde: true,
      currentRasi,
    };
  }

  // 4. Mandatara: 0.05 <= R < 0.50
  if (speedRatio < thresholds.mandataraMaxRatio) {
    return {
      gatiState: "Mandatara",
      dailySpeedDeg,
      meanSpeedDeg,
      speedRatio: round4(speedRatio),
      isRetrograde: false,
      currentRasi,
    };
  }

  // 5. Manda: 0.50 <= R < 0.90
  if (speedRatio < thresholds.mandaMaxRatio) {
    return {
      gatiState: "Manda",
      dailySpeedDeg,
      meanSpeedDeg,
      speedRatio: round4(speedRatio),
      isRetrograde: false,
      currentRasi,
    };
  }

  // 6. Sama: 0.90 <= R <= 1.10
  if (speedRatio <= thresholds.samaMaxRatio) {
    return {
      gatiState: "Sama",
      dailySpeedDeg,
      meanSpeedDeg,
      speedRatio: round4(speedRatio),
      isRetrograde: false,
      currentRasi,
    };
  }

  // 7 & 8. Chara vs Atichara: R > 1.50 or explicit accelerated sign entry -> Atichara
  if (input.isAtichara === true || speedRatio > thresholds.charaMaxRatio) {
    return {
      gatiState: "Atichara",
      dailySpeedDeg,
      meanSpeedDeg,
      speedRatio: round4(speedRatio),
      isRetrograde: false,
      currentRasi,
    };
  }

  return {
    gatiState: "Chara",
    dailySpeedDeg,
    meanSpeedDeg,
    speedRatio: round4(speedRatio),
    isRetrograde: false,
    currentRasi,
  };
}

/**
 * Evaluate full Chesta Bala detail for any of the 7 classical planets
 */
export function evaluatePlanetChestaBala(
  pos: ChestaPlanetInput,
  sunAyanaBala: number,
  unDoubledMoonPakshaBala: number,
  mode: ChestaBalaMode = "BPHS_ORIGINAL_27_23",
  thresholds: AshtaGatiThresholds = DEFAULT_ASHTA_GATI_THRESHOLDS
): PlanetChestaBalaDetail {
  const currentRasi = Math.floor(norm360(pos.lon) / 30) as RasiIndex;

  // BPHS 27.18: Sun's Chesta Bala = Ayana Bala
  if (pos.planet === "Sun") {
    const virupas = round2(Math.max(0, Math.min(60, sunAyanaBala)));
    return {
      planet: "Sun",
      mode,
      gatiState: "AyanaBalaProxy",
      dailySpeedDeg: pos.speed,
      meanSpeedDeg: 0.9856,
      speedRatio: round4(pos.speed / 0.9856),
      isRetrograde: false,
      currentRasi,
      chestaBalaVirupas: virupas,
      chestaBalaRupas: round4(virupas / 60.0),
    };
  }

  // BPHS 27.18: Moon's Chesta Bala = Paksha Bala (un-doubled)
  if (pos.planet === "Moon") {
    const virupas = round2(Math.max(0, Math.min(60, unDoubledMoonPakshaBala)));
    return {
      planet: "Moon",
      mode,
      gatiState: "PakshaBalaProxy",
      dailySpeedDeg: pos.speed,
      meanSpeedDeg: 13.1764,
      speedRatio: round4(pos.speed / 13.1764),
      isRetrograde: false,
      currentRasi,
      chestaBalaVirupas: virupas,
      chestaBalaRupas: round4(virupas / 60.0),
    };
  }

  const taraPos = pos as ChestaPlanetInput & { planet: TaraGrahaId };
  const classified = classifyTaraGrahaAshtaGati(taraPos, thresholds);

  // Optional Method 1 (Seeghrocha / Chesta Kendra) if requested and inputs exist
  if (
    mode === "METHOD_1_KENDRA" &&
    typeof pos.meanLon === "number" &&
    typeof pos.seeghrochaLon === "number"
  ) {
    const kendraOut = calculateMethod1ChestaKendraBala(
      pos.lon,
      pos.meanLon,
      pos.seeghrochaLon
    );
    return {
      planet: pos.planet,
      mode,
      gatiState: classified.gatiState,
      dailySpeedDeg: classified.dailySpeedDeg,
      meanSpeedDeg: classified.meanSpeedDeg,
      speedRatio: classified.speedRatio,
      isRetrograde: classified.isRetrograde,
      currentRasi: classified.currentRasi,
      chestaKendraDeg: kendraOut.chestaKendraDeg,
      chestaBalaVirupas: kendraOut.chestaBalaVirupas,
      chestaBalaRupas: kendraOut.chestaBalaRupas,
    };
  }

  const virupaTable =
    mode === "MODERN_SOFTWARE"
      ? ASHTA_GATI_VIRUPAS_MODERN_VARIANT
      : ASHTA_GATI_VIRUPAS_BPHS_ORIGINAL;

  const chestaBalaVirupas = virupaTable[classified.gatiState];

  return {
    planet: pos.planet,
    mode,
    gatiState: classified.gatiState,
    dailySpeedDeg: classified.dailySpeedDeg,
    meanSpeedDeg: classified.meanSpeedDeg,
    speedRatio: classified.speedRatio,
    isRetrograde: classified.isRetrograde,
    currentRasi: classified.currentRasi,
    chestaBalaVirupas,
    chestaBalaRupas: round4(chestaBalaVirupas / 60.0),
  };
}

/**
 * Component 4 Entry Point used by `calculateShadbala()`
 */
export function calculateChestaBala(
  pos: ChestaPlanetInput,
  sunAyanaBala: number,
  unDoubledMoonPakshaBala: number,
  mode: ChestaBalaMode = "BPHS_ORIGINAL_27_23"
): number {
  return evaluatePlanetChestaBala(
    pos,
    sunAyanaBala,
    unDoubledMoonPakshaBala,
    mode
  ).chestaBalaVirupas;
}

/**
 * Convenience wrapper for Chesta Bala by planet name and speed.
 */
export function chestaBala(
  planet: ClassicalPlanet,
  speedLon: number,
  sunAyanaBala: number,
  moonPakshaBala: number,
  mode: ChestaBalaMode = "BPHS_ORIGINAL_27_23"
): number {
  return calculateChestaBala(
    { planet, speed: speedLon, lon: 0, house: 1 },
    sunAyanaBala,
    moonPakshaBala,
    mode
  );
}



// ============================================================================
// 6. DRIG BALA (P0 DIVISOR & BPHS CH. 27 PIECEWISE EQUATIONS)
// ============================================================================

export function computeDrishtiKona(
  aspectorLon: number,
  targetLon: number
): number {
  return norm360(targetLon - aspectorLon);
}

export function computeBaseDrishti(thetaDeg: number): number {
  const theta = norm360(thetaDeg);
  if (theta <= 30 || theta >= 300) return 0;
  if (theta <= 60) return (theta - 30) / 2;
  if (theta <= 90) return theta - 60 + 15;
  if (theta <= 120) return 45 - (theta - 90) / 2;
  if (theta <= 150) return 150 - theta;
  if (theta <= 180) return (theta - 150) * 2;
  return (300 - theta) / 2;
}

export function computeRamanSpecialBonus(
  aspector: PlanetId,
  thetaDeg: number
): number {
  const theta = norm360(thetaDeg);
  if (aspector === "Mars") {
    if ((theta >= 90 && theta < 120) || (theta >= 210 && theta < 240)) return 15;
  } else if (aspector === "Jupiter") {
    if ((theta >= 120 && theta < 150) || (theta >= 240 && theta < 270)) return 30;
  } else if (aspector === "Saturn") {
    if ((theta >= 60 && theta < 90) || (theta >= 270 && theta < 300)) return 45;
  }
  return 0;
}

const BASE_KNOTS: readonly number[] = [
  0, 0, 15, 45, 30, 0, 60, 45, 30, 15, 0, 0,
];

export function computeContinuousKnotDrishti(
  aspector: PlanetId,
  thetaDeg: number
): { baseVirupas: number; specialBonusVirupas: number; totalRawVirupas: number } {
  const theta = norm360(thetaDeg);
  const baseVirupas = computeBaseDrishti(theta);
  if (theta <= 30 || theta >= 300) {
    return { baseVirupas: 0, specialBonusVirupas: 0, totalRawVirupas: 0 };
  }

  const knots = [...BASE_KNOTS];
  if (aspector === "Mars") {
    knots[3] = 60;
    knots[7] = 60;
  } else if (aspector === "Jupiter") {
    knots[4] = 60;
    knots[8] = 60;
  } else if (aspector === "Saturn") {
    knots[2] = 60;
    knots[9] = 60;
  }

  const segIndex = Math.floor(theta / 30);
  const segFrac = (theta - segIndex * 30) / 30;
  const y0 = knots[segIndex]!;
  const y1 = knots[(segIndex + 1) % 12]!;
  const totalRawVirupas = y0 + segFrac * (y1 - y0);
  const specialBonusVirupas = Math.max(0, totalRawVirupas - baseVirupas);

  return { baseVirupas, specialBonusVirupas, totalRawVirupas };
}

export interface PairwiseAspectDetail {
  aspector: PlanetId;
  target: PlanetId;
  drishtiKonaDeg: number;
  baseVirupas: number;
  specialBonusVirupas: number;
  totalRawVirupas: number;
  polarity: 1 | -1;
  netContributionVirupas: number;
}

export interface PlanetDrigBreakdown {
  planet: PlanetId;
  rawSignedSum: number;
  drigBalaVirupas: number;
  receivedAspects: PairwiseAspectDetail[];
}

export interface DrigBalaOptions {
  mode?: DrigCalculationMode;
  dynamicMoonBenefic?: boolean;
}

export function evaluatePairwiseDrishti(
  aspector: PlanetPositionInput,
  target: PlanetPositionInput,
  polarity: 1 | -1,
  mode: DrigCalculationMode = "DEGREE_RAMAN_BAND"
): PairwiseAspectDetail {
  const drishtiKonaDeg = computeDrishtiKona(aspector.lon, target.lon);

  if (mode === "WHOLE_HOUSE") {
    const houseSpan = (((target.house - aspector.house) % 12) + 12) % 12 + 1;
    let isFullAspect = houseSpan === 7;
    let isSpecial = false;

    if (aspector.planet === "Mars" && (houseSpan === 4 || houseSpan === 8)) {
      isFullAspect = true;
      isSpecial = true;
    } else if (
      aspector.planet === "Jupiter" &&
      (houseSpan === 5 || houseSpan === 9)
    ) {
      isFullAspect = true;
      isSpecial = true;
    } else if (
      aspector.planet === "Saturn" &&
      (houseSpan === 3 || houseSpan === 10)
    ) {
      isFullAspect = true;
      isSpecial = true;
    }

    const totalRawVirupas = isFullAspect ? 60 : 0;
    const baseVirupas = houseSpan === 7 ? 60 : 0;
    const specialBonusVirupas = isSpecial ? 60 : 0;

    return {
      aspector: aspector.planet,
      target: target.planet,
      drishtiKonaDeg: round2(drishtiKonaDeg),
      baseVirupas,
      specialBonusVirupas,
      totalRawVirupas,
      polarity,
      netContributionVirupas: round2((polarity * totalRawVirupas) / 4),
    };
  }

  if (mode === "DEGREE_CONTINUOUS_KNOT") {
    const { baseVirupas, specialBonusVirupas, totalRawVirupas } =
      computeContinuousKnotDrishti(aspector.planet, drishtiKonaDeg);

    return {
      aspector: aspector.planet,
      target: target.planet,
      drishtiKonaDeg: round2(drishtiKonaDeg),
      baseVirupas: round2(baseVirupas),
      specialBonusVirupas: round2(specialBonusVirupas),
      totalRawVirupas: round2(totalRawVirupas),
      polarity,
      netContributionVirupas: round2((polarity * totalRawVirupas) / 4),
    };
  }

  const baseVirupas = computeBaseDrishti(drishtiKonaDeg);
  const specialBonusVirupas = computeRamanSpecialBonus(
    aspector.planet,
    drishtiKonaDeg
  );
  const totalRawVirupas = Math.min(60, baseVirupas + specialBonusVirupas);

  return {
    aspector: aspector.planet,
    target: target.planet,
    drishtiKonaDeg: round2(drishtiKonaDeg),
    baseVirupas: round2(baseVirupas),
    specialBonusVirupas: round2(specialBonusVirupas),
    totalRawVirupas: round2(totalRawVirupas),
    polarity,
    netContributionVirupas: round2((polarity * totalRawVirupas) / 4),
  };
}

export function calculateDetailedDrigBala(
  planets: readonly PlanetPositionInput[],
  options: DrigBalaOptions = {}
): {
  virupasByPlanet: Record<PlanetId, number>;
  breakdowns: Record<PlanetId, PlanetDrigBreakdown>;
} {
  const { mode = "DEGREE_RAMAN_BAND", dynamicMoonBenefic = false } = options;

  const sunPos = planets.find((p) => p.planet === "Sun");
  const moonPos = planets.find((p) => p.planet === "Moon");

  let isMoonBenefic = true;
  if (dynamicMoonBenefic && sunPos && moonPos) {
    const elongation = norm360(moonPos.lon - sunPos.lon);
    isMoonBenefic = elongation < 180;
  }

  const benefics = new Set<PlanetId>(["Mercury", "Jupiter", "Venus"]);
  if (isMoonBenefic) {
    benefics.add("Moon");
  }

  const virupasByPlanet = {} as Record<PlanetId, number>;
  const breakdowns = {} as Record<PlanetId, PlanetDrigBreakdown>;

  for (const target of planets) {
    let rawSignedSum = 0;
    const receivedAspects: PairwiseAspectDetail[] = [];

    for (const aspector of planets) {
      if (aspector.planet === target.planet) continue;

      const polarity: 1 | -1 = benefics.has(aspector.planet) ? 1 : -1;
      const detail = evaluatePairwiseDrishti(aspector, target, polarity, mode);
      receivedAspects.push(detail);
      rawSignedSum += polarity * detail.totalRawVirupas;
    }

    const drigBalaVirupas = round2(rawSignedSum / 4.0);

    virupasByPlanet[target.planet] = drigBalaVirupas;
    breakdowns[target.planet] = {
      planet: target.planet,
      rawSignedSum: round2(rawSignedSum),
      drigBalaVirupas,
      receivedAspects,
    };
  }

  return { virupasByPlanet, breakdowns };
}

export function calculateDrigBala(
  planets: readonly PlanetPositionInput[],
  mode: DrigCalculationMode = "WHOLE_HOUSE"
): Record<PlanetId, number> {
  return calculateDetailedDrigBala(planets, { mode }).virupasByPlanet;
}

// ============================================================================
// 7. ISHTA PHALA & KASHTA PHALA (BPHS CH. 27 SLOKAS 34-38)
// ============================================================================

export type IshtaKashtaMode =
  | "RAMAN_COMPLEMENT_60"
  | "BPHS_GEOMETRIC_DUAL"
  | "SRIPATI_ARITHMETIC";

export interface PlanetIshtaKashtaInput {
  planet: PlanetId;
  uchchaBala: number;
  chestaBala: number;
}

export interface PlanetIshtaKashtaResult {
  planet: PlanetId;
  uchchaBala: number;
  chestaBala: number;
  uchchaFraction: number;
  chestaFraction: number;
  ishtaVirupas: number;
  kashtaVirupas: number;
  ishtaRupas: number;
  kashtaRupas: number;
  netBalanceVirupas: number;
  subhaRatio: number;
  isPredominantlyBenefic: boolean;
}

export interface IshtaKashtaEngineOutput {
  mode: IshtaKashtaMode;
  byPlanet: Record<PlanetId, PlanetIshtaKashtaResult>;
  ordered: PlanetIshtaKashtaResult[];
}

export function clampVirupas60(val: number): number {
  if (Number.isNaN(val)) return 0;
  return Math.max(0, Math.min(60, val));
}

export function evaluatePlanetIshtaKashta(
  input: PlanetIshtaKashtaInput,
  mode: IshtaKashtaMode = "RAMAN_COMPLEMENT_60"
): PlanetIshtaKashtaResult {
  const { planet } = input;
  const U = clampVirupas60(input.uchchaBala);
  const C = clampVirupas60(input.chestaBala);

  const uchchaFraction = U / 60.0;
  const chestaFraction = C / 60.0;

  let rawIshta: number;
  let rawKashta: number;

  switch (mode) {
    case "SRIPATI_ARITHMETIC": {
      rawIshta = (U + C) / 2.0;
      rawKashta = 60.0 - rawIshta;
      break;
    }
    case "BPHS_GEOMETRIC_DUAL": {
      rawIshta = Math.sqrt(U * C);
      rawKashta = Math.sqrt((60.0 - U) * (60.0 - C));
      break;
    }
    case "RAMAN_COMPLEMENT_60":
    default: {
      rawIshta = Math.sqrt(U * C);
      rawKashta = 60.0 - rawIshta;
      break;
    }
  }

  const ishtaVirupas = round2(rawIshta);
  const kashtaVirupas = round2(rawKashta);
  const netBalanceVirupas = round2(rawIshta - rawKashta);
  const denom = rawIshta + rawKashta;
  const subhaRatio = denom > 1e-9 ? round4(rawIshta / denom) : 0.5;

  return {
    planet,
    uchchaBala: round2(U),
    chestaBala: round2(C),
    uchchaFraction: round4(uchchaFraction),
    chestaFraction: round4(chestaFraction),
    ishtaVirupas,
    kashtaVirupas,
    ishtaRupas: round4(rawIshta / 60.0),
    kashtaRupas: round4(rawKashta / 60.0),
    netBalanceVirupas,
    subhaRatio,
    isPredominantlyBenefic: rawIshta >= rawKashta,
  };
}

export function calculateIshtaKashta(
  uchchaBalaByPlanet: Record<PlanetId, number>,
  chestaBalaByPlanet: Record<PlanetId, number>,
  mode: IshtaKashtaMode = "RAMAN_COMPLEMENT_60"
): IshtaKashtaEngineOutput {
  const byPlanet = {} as Record<PlanetId, PlanetIshtaKashtaResult>;
  const ordered: PlanetIshtaKashtaResult[] = [];

  for (const planet of PLANET_ORDER) {
    const uchchaBala = uchchaBalaByPlanet[planet];
    const chestaBala = chestaBalaByPlanet[planet];

    if (typeof uchchaBala !== "number" || typeof chestaBala !== "number") {
      throw new Error(
        `Missing Uchcha or Chesta Bala input for planet ${planet}`
      );
    }

    const res = evaluatePlanetIshtaKashta(
      { planet, uchchaBala, chestaBala },
      mode
    );
    byPlanet[planet] = res;
    ordered.push(res);
  }

  return {
    mode,
    byPlanet,
    ordered,
  };
}

export function calculateIshtaKashtaFromShadbala(
  shadbalaResults: Record<PlanetId, PlanetShadbalaResult>,
  mode: IshtaKashtaMode = "RAMAN_COMPLEMENT_60"
): IshtaKashtaEngineOutput {
  const uchchaMap = {} as Record<PlanetId, number>;
  const chestaMap = {} as Record<PlanetId, number>;

  for (const planet of PLANET_ORDER) {
    const item = shadbalaResults[planet];
    if (!item) {
      throw new Error(`Missing Shadbala result for planet ${planet}`);
    }
    uchchaMap[planet] = item.sthanaBreakdown.uchcha;
    chestaMap[planet] = item.chesta;
  }

  return calculateIshtaKashta(uchchaMap, chestaMap, mode);
}

// ============================================================================
// MASTER SHADBALA CALCULATOR (STANDALONE + DSSME BLOCK BUILDER)
// ============================================================================

export interface PlanetShadbalaResult {
  planet: PlanetId;
  sthana: number;
  sthanaBreakdown: SthanaBalaBreakdown;
  dig: number;
  kaala: number;
  kaalaBreakdown: PlanetKaalaBreakdown;
  chesta: number;
  naisargika: number;
  drig: number;
  totalVirupas: number;
  totalRupas: number;
  minRequired: number;
  percentRequired: number;
  meetsMinimum: boolean;
  rank: number;
}

export interface ShadbalaEngineOutput {
  results: Record<PlanetId, PlanetShadbalaResult>;
  ordered: PlanetShadbalaResult[];
}

export function calculateShadbala(
  chart: ShadbalaChartInput
): ShadbalaEngineOutput {
  for (const p of PLANET_ORDER) {
    if (!chart.planets.some((item) => item.planet === p)) {
      throw new Error(`Missing planet position for ${p}`);
    }
  }

  const kaalaOut = calculateKaalaBala(chart);
  const drigMap = calculateDrigBala(
    chart.planets,
    chart.drigMode ?? "DEGREE_RAMAN_BAND"
  );

  const panchadhaSapta = chart.usePanchadhaSaptavargaja
    ? calculatePanchadhaSaptavargaja(chart.planets).byPlanet
    : undefined;

  const results = {} as Record<PlanetId, PlanetShadbalaResult>;
  const ordered: PlanetShadbalaResult[] = [];

  for (const p of PLANET_ORDER) {
    const pos = chart.planets.find((item) => item.planet === p)!;
    const saptaOverride = panchadhaSapta
      ? panchadhaSapta[p].totalVirupas
      : undefined;
    const sthanaBreakdown = calculateSthanaBala(pos, saptaOverride);
    const digVal = calculateDigBala(pos, chart.houseCusps);
    const kaalaBreakdown = kaalaOut.byPlanet[p];
    const chestaVal = calculateChestaBala(
      pos,
      kaalaOut.sunAyana,
      kaalaOut.unDoubledMoonPaksha
    );
    const naisargikaVal = NAISARGIKA_BALA[p];
    const drigVal = drigMap[p];

    const sthana = round2(sthanaBreakdown.total);
    const dig = round2(digVal);
    const kaala = round2(kaalaBreakdown.total);
    const chesta = round2(chestaVal);
    const naisargika = round2(naisargikaVal);
    const drig = round2(drigVal);

    const totalVirupas = round2(
      sthana + dig + kaala + chesta + naisargika + drig
    );
    const totalRupas = round2(totalVirupas / 60.0);
    const minRequired = MIN_REQUIRED_VIRUPAS[p];
    const percentRequired = round2((totalVirupas / minRequired) * 100);

    const item: PlanetShadbalaResult = {
      planet: p,
      sthana,
      sthanaBreakdown,
      dig,
      kaala,
      kaalaBreakdown,
      chesta,
      naisargika: naisargikaVal,
      drig,
      totalVirupas,
      totalRupas,
      minRequired,
      percentRequired,
      meetsMinimum: totalVirupas >= minRequired,
      rank: 0,
    };

    results[p] = item;
    ordered.push(item);
  }

  const sortedByTotal = [...ordered].sort(
    (a, b) => b.totalVirupas - a.totalVirupas
  );
  for (const item of ordered) {
    item.rank =
      sortedByTotal.findIndex((s) => s.planet === item.planet) + 1;
  }

  return { results, ordered };
}

// ============================================================================
// DSSME BLOCK_6 ADAPTER (`buildShadbalaBlock`)
// ============================================================================

export interface ShadbalaInput {
  paksha: "shukla" | "krishna";
  tithiIndex: number;
  weekday: number | ClassicalPlanet;
  hora: ClassicalPlanet;
  isNight: boolean;
  chartJd: number;
  longitude: number;
  ayanamsaDeg: number;
  sunriseJdUt?: number;
  sunsetJdUt?: number;
  localSunriseHour?: number;
  localSunsetHour?: number;
  doubleMoonPaksha?: boolean;
  doubleSunAyana?: boolean;
  /** Optional Saptavargaja mode (defaults to true = BPHS Panchadha 45-point scale) */
  usePanchadhaSaptavargaja?: boolean;
  /** Optional Drig Bala calculation mode (defaults to 'DEGREE_RAMAN_BAND') */
  drigMode?: DrigCalculationMode;
}

export function buildShadbalaBlock(
  ctx: BlockContext,
  shadbalaInput: ShadbalaInput
): BlockResult<ShadbalaBlock> {
  const { chart } = ctx;
  const issues = [];

  const planetsInput: PlanetPositionInput[] = CLASSICAL_PLANETS_ORDER.map(
    (p) => {
      const pos = chart.planets[p];
      return {
        planet: p,
        lon: pos.siderealLongitude,
        speed: pos.speedLongitude,
        retro: pos.isRetrograde,
        house: pos.house,
        lat: pos.eclipticLatitude,
      };
    }
  );

  // Extract cardinal house cusps from CanonicalChart.houses (or derive from Lagna siderealLongitude)
  const lagnaLon = chart.lagna.siderealLongitude;
  const houseCusps: Record<number, number> = {
    1: chart.houses["1"]?.cuspLongitude ?? norm360(lagnaLon),
    4: chart.houses["4"]?.cuspLongitude ?? norm360(lagnaLon + 90),
    7: chart.houses["7"]?.cuspLongitude ?? norm360(lagnaLon + 180),
    10: chart.houses["10"]?.cuspLongitude ?? norm360(lagnaLon + 270),
  };

  const engineOut = calculateShadbala({
    planets: planetsInput,
    jdUt: shadbalaInput.chartJd,
    tzOffsetHours: chart.time.timezoneOffsetHours,
    geoLonDeg: shadbalaInput.longitude,
    ayanamsaDeg: shadbalaInput.ayanamsaDeg,
    houseCusps,
    weekday: shadbalaInput.weekday,
    horaLord: shadbalaInput.hora,
    sunriseJdUt: shadbalaInput.sunriseJdUt,
    sunsetJdUt: shadbalaInput.sunsetJdUt,
    localSunriseHour: shadbalaInput.localSunriseHour,
    localSunsetHour: shadbalaInput.localSunsetHour,
    doubleMoonPaksha: shadbalaInput.doubleMoonPaksha ?? false,
    doubleSunAyana: shadbalaInput.doubleSunAyana ?? false,
    usePanchadhaSaptavargaja: shadbalaInput.usePanchadhaSaptavargaja ?? true,
    drigMode: shadbalaInput.drigMode ?? "DEGREE_RAMAN_BAND",
  });

  const sthanaTotals: number[] = [];
  const digBalaValues: number[] = [];
  const kaalaTotals: number[] = [];
  const chestaValues: number[] = [];
  const naisargikaValues: number[] = [];
  const drigValues: number[] = [];
  const totalVirupas: number[] = [];
  const percentRequired: number[] = [];
  const rank: number[] = [];

  for (const p of CLASSICAL_PLANETS_ORDER) {
    const r = engineOut.results[p];
    sthanaTotals.push(r.sthana);
    digBalaValues.push(r.dig);
    kaalaTotals.push(r.kaala);
    chestaValues.push(r.chesta);
    naisargikaValues.push(round2(r.naisargika));
    drigValues.push(r.drig);
    totalVirupas.push(r.totalVirupas);
    percentRequired.push(r.percentRequired);
    rank.push(r.rank);
  }

  const kaala_pct = kaalaTotals.map((k, i) =>
    round2((k / MINIMUM_REQUIRED_VIRUPAS[i]!) * 100)
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

  if (totalVirupas.every((v) => v === 0)) {
    issues.push(
      warningIssue("SHADBALA.total_virupas", "All Shadbala totals are zero")
    );
  }

  return finalizeBlock({
    blockId: "SHADBALA",
    ctx,
    inputs: ["CanonicalChart"],
    value,
    issues,
  });
}
