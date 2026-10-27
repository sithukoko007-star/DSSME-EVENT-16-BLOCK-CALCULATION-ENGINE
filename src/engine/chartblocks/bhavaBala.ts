/**
 * BLOCK_7 - BHAVA_BALA (BPHS Chapter 27 Canonical Implementation + PL9 Parity Mode)
 * Module: src/engine/chartblocks/bhavaBala.ts
 *
 * Authority: Brihat Parashara Hora Shastra (BPHS), Chapter 27, Slokas 26-29
 *            & B.V. Raman, Graha and Bhava Balas, Chapter 9, Sections 55-58
 *            & Parashara's Light 9.0 (PL9) Aspects on Bhavas / Bhava Bala Parity
 *
 * Three components (in Virupas):
 *   1. Bhava Adhipati Bala - Full 1.0x Shadbala Pinda of the House Lord (no 0.5x scaling bug)
 *   2. Bhava Dig Bala      - Sign nature classification (NARA->H1, JALA->H4, CHATUSHPADA->H10, KEETA->H7)
 *                            including 15 deg half-sign splits for Sagittarius and Capricorn
 *   3. Bhava Drig Bala     - Signed piecewise / Continuous Knot aspectual strength onto each Bhava Madhya,
 *                            supporting BPHS_EQUAL_DIV_4, RAMAN_JUP_MERC_FULL (PL9 Parity), and SRIPATI_JUP_FULL_MERC_HALF
 *
 * CRITICAL: Bhava Bala NEVER enters the Shadbala RS(p) sum (Hard Rule 10 / Section 3.1 Rule 11).
 * It only enters the pipeline as the BHF multiplier in S10b (Section 9.1).
 */

import type {
  BhavaBalaBlock,
  BhavaBalaEntry,
  ClassicalPlanet,
  HouseKey,
  ZodiacSign,
} from "../../types/dssme-canonical-types.ts";
import type { BlockContext, BlockResult } from "../blocks/blockTypes.ts";
import {
  finalizeBlock,
  mapHouseKeys,
  warningIssue,
} from "../blocks/blockResult.ts";
import {
  type CardinalHouse,
  CLASSICAL_PLANETS_ORDER,
  computeBaseDrishti,
  computeContinuousKnotDrishti,
  computeDrishtiKona,
  computeRamanSpecialBonus,
  type DrigCalculationMode,
  norm360,
  PLANET_ORDER,
  type PlanetId,
  type PlanetPositionInput,
  type RasiIndex,
  shortestArc,
  SIGN_LORDS,
} from "./shadbala.ts";

// ============================================================================
// CORE TYPES & CONSTANTS (BPHS CHAPTER 27 SLOKAS 26-29 & PL9 PARITY)
// ============================================================================

export type HouseNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const HOUSE_NUMBERS: readonly HouseNumber[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
];

export const ZODIAC_SIGNS_BY_RASI: Record<RasiIndex, ZodiacSign> = {
  0: "Aries",
  1: "Taurus",
  2: "Gemini",
  3: "Cancer",
  4: "Leo",
  5: "Virgo",
  6: "Libra",
  7: "Scorpio",
  8: "Sagittarius",
  9: "Capricorn",
  10: "Aquarius",
  11: "Pisces",
};

export type BhavaSignNature =
  | "NARA"        // Human / Biped -> peaks in H1 (60), zero in H7 (0)
  | "JALA"        // Aquatic / Water -> peaks in H4 (60), zero in H10 (0)
  | "CHATUSHPADA" // Quadruped -> peaks in H10 (60), zero in H4 (0)
  | "KEETA";      // Insect / Reptile -> peaks in H7 (60), zero in H1 (0)

export const BHAVA_NATURE_MAX_HOUSE: Record<BhavaSignNature, CardinalHouse> = {
  NARA: 1,
  JALA: 4,
  KEETA: 7,
  CHATUSHPADA: 10,
};

export type BhavaDrigWeightingMode =
  | "BPHS_EQUAL_DIV_4"            // All 7 planets weighted at 1/4 of raw Drishti (BPHS Ch. 27)
  | "RAMAN_JUP_MERC_FULL"         // PL9 / B.V. Raman: Jupiter & Mercury at 1.0 (100%), other 5 planets at 1/4 (25%)
  | "SRIPATI_JUP_FULL_MERC_HALF"; // Sripati: Jupiter at 1.0 (100%), Mercury at 1/2 (50%), others at 1/4 (25%)

export type BhavaDigCalculationMode = "HOUSE_STEP" | "DEGREE_ARC";

export interface BhavaBalaOptions {
  drigMode?: DrigCalculationMode;
  drigCurveMode?: DrigCalculationMode; // Backward-compatibility alias
  drigWeightingMode?: BhavaDrigWeightingMode;
  bhavaDrigWeighting?: BhavaDrigWeightingMode; // Backward-compatibility alias
  digCalculationMode?: BhavaDigCalculationMode;
  dynamicMoonBenefic?: boolean;
  /**
   * When true (default in buildBhavaBalaBlock), enables Parashara's Light 9.0 (PL9) Parity Mode:
   * - Uses DEGREE_CONTINUOUS_KNOT + PL9 Jupiter trine curve (matching Aspects.pdf 'Aspects on Bhavas')
   * - Uses RAMAN_JUP_MERC_FULL weighting (Jupiter & Mercury 1.0x, others 0.25x)
   * - Preserves 2-decimal precision
   */
  pl9ParityMode?: boolean;
}

export interface BhavaPlanetaryAspect {
  aspector: PlanetId;
  house?: HouseNumber;
  drishtiKonaDeg: number;
  baseVirupas?: number;
  specialBonusVirupas?: number;
  rawDrishtiVirupas: number;
  totalRawVirupas?: number;
  pl9PrintedScore?: number;
  polarity: 1 | -1;
  weightMultiplier: number;
  weightFactor?: number;
  netBhavaDrigVirupas: number;
  weightedVirupas?: number;
}

export type BhavaAspectContribution = BhavaPlanetaryAspect;

export interface HouseBhavaBalaResult {
  house: HouseNumber;
  sign: ZodiacSign;
  rasi: RasiIndex;
  cuspRasi: RasiIndex;
  signLord: PlanetId;
  bhavaLord: PlanetId;
  cuspLon: number;
  nature: BhavaSignNature;
  signNature: BhavaSignNature;
  maxDigHouse: CardinalHouse;
  digPeakHouse: CardinalHouse;
  degInSign: number;
  degInCuspSign: number;
  adhipatiVirupas: number;
  adhipatiBala: number;
  digVirupas: number;
  digBala: number;
  drigVirupas: number;
  drigBala: number;
  totalVirupas: number;
  totalRupas: number;
  rank: number;
  aspects: BhavaPlanetaryAspect[];
  receivedAspects: BhavaPlanetaryAspect[];
  drigBreakdown?: BhavaDrigBalaDetail;
}

export type BhavaHouseResult = HouseBhavaBalaResult;

export interface BhavaBalaEngineOutput {
  houses: Record<HouseNumber, HouseBhavaBalaResult>;
  byHouse: Record<HouseNumber, HouseBhavaBalaResult>;
  orderedByHouse: HouseBhavaBalaResult[];
  ordered: HouseBhavaBalaResult[];
  rankedByStrength: HouseBhavaBalaResult[];
  strongestHouse: HouseBhavaBalaResult;
  weakestHouse: HouseBhavaBalaResult;
  meanVirupas: number;
}

export interface BhavaDigBalaDetail {
  house: HouseNumber;
  cuspLon: number;
  rasi: RasiIndex;
  degInSign: number;
  nature: BhavaSignNature;
  signNature: BhavaSignNature;
  maxHouse: CardinalHouse;
  digPeakHouse: CardinalHouse;
  houseDistance: number;
  arcDistanceDeg?: number;
  digVirupas: number;
  digBalaVirupas: number;
}

export interface BhavaDrigBalaDetail {
  house: HouseNumber;
  cuspLon: number;
  rawSignedSum: number;
  drigVirupas: number;
  drigBalaVirupas: number;
  aspects: BhavaPlanetaryAspect[];
  receivedAspects: BhavaPlanetaryAspect[];
}

export interface BhavaBalaChartInput {
  /** 12 house cusp longitudes (array of 12, 1-indexed array of 13, or Record<1..12, number>) */
  houseCusps: readonly number[] | Record<number, number>;
  /** Shadbala total Virupas for each of the 7 classical planets */
  shadbalaByPlanet: Record<PlanetId, number>;
  /** Positions of the 7 classical planets */
  planets: readonly PlanetPositionInput[];
  options?: BhavaBalaOptions;
}

function round1(val: number): number {
  return Math.round((val + Number.EPSILON) * 10) / 10;
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function round4(val: number): number {
  return Math.round((val + Number.EPSILON) * 10000) / 10000;
}

// ============================================================================
// 1. BHAVA ADHIPATI BALA (BPHS CH. 27 SLOKA 26)
// ============================================================================

/**
 * Component 1: Bhava Adhipati Bala
 * BPHS Ch. 27 Sloka 26: The house lord's full (1.0x) Shadbala Pinda (total Virupas)
 * is contributed directly to every Bhava ruled by that planet.
 */
export function calculateBhavaAdhipatiBala(
  cuspSiderealLon: number,
  shadbalaByPlanet: Record<PlanetId, number>
): {
  rasi: RasiIndex;
  sign: ZodiacSign;
  signLord: PlanetId;
  adhipatiVirupas: number;
  adhipatiBala: number;
} {
  const normalized = norm360(cuspSiderealLon);
  const rasi = Math.floor(normalized / 30) as RasiIndex;
  const sign = ZODIAC_SIGNS_BY_RASI[rasi];
  const signLord = SIGN_LORDS[rasi];
  const rawVirupas = shadbalaByPlanet[signLord];

  if (typeof rawVirupas !== "number" || Number.isNaN(rawVirupas)) {
    throw new Error(`Missing Shadbala total for house lord ${signLord}`);
  }

  const adhipatiVirupas = round2(rawVirupas);
  return {
    rasi,
    sign,
    signLord,
    adhipatiVirupas,
    adhipatiBala: adhipatiVirupas,
  };
}

// ============================================================================
// 2. BHAVA DIG BALA (BPHS CH. 27 SLOKAS 27-28)
// ============================================================================

/**
 * Classify a Bhava Madhya longitude into one of the 4 BPHS Ch. 27 sign natures:
 *   - NARA (Human/Biped): Gemini (2), Virgo (5), Libra (6), Sagittarius 0-15 deg (8), Aquarius (10) -> Max in H1
 *   - JALA (Aquatic/Water): Cancer (3), Capricorn 15-30 deg (9), Pisces (11) -> Max in H4
 *   - CHATUSHPADA (Quadruped): Aries (0), Taurus (1), Leo (4), Sagittarius 15-30 deg (8), Capricorn 0-15 deg (9) -> Max in H10
 *   - KEETA (Insect/Reptile): Scorpio (7) -> Max in H7
 */
export function classifyBhavaSignNature(cuspSiderealLon: number): BhavaSignNature {
  const norm = norm360(cuspSiderealLon);
  const rasi = Math.floor(norm / 30) as RasiIndex;
  const degInSign = norm - rasi * 30;

  switch (rasi) {
    case 2:  // Gemini
    case 5:  // Virgo
    case 6:  // Libra
    case 10: // Aquarius
      return "NARA";

    case 3:  // Cancer
    case 11: // Pisces
      return "JALA";

    case 0:  // Aries
    case 1:  // Taurus
    case 4:  // Leo
      return "CHATUSHPADA";

    case 7:  // Scorpio
      return "KEETA";

    case 8:  // Sagittarius: 0-15 deg Nara (H1), 15-30 deg Chatushpada (H10)
      return degInSign < 15.0 ? "NARA" : "CHATUSHPADA";

    case 9:  // Capricorn: 0-15 deg Chatushpada (H10), 15-30 deg Jala (H4)
      return degInSign < 15.0 ? "CHATUSHPADA" : "JALA";
  }
}

export function getBhavaSignNature(cuspSiderealLon: number): BhavaSignNature {
  return classifyBhavaSignNature(cuspSiderealLon);
}

export function getBhavaDigMaxHouse(cuspSiderealLon: number): CardinalHouse {
  const nature = classifyBhavaSignNature(cuspSiderealLon);
  return BHAVA_NATURE_MAX_HOUSE[nature];
}

/**
 * Component 2: Bhava Dig Bala [0, 60]
 */
export function calculateBhavaDigBala(
  house: HouseNumber,
  cuspSiderealLon: number,
  mode: BhavaDigCalculationMode = "HOUSE_STEP",
  cardinalCuspLongitudes?: Partial<Record<CardinalHouse, number>>
): BhavaDigBalaDetail {
  const normalized = norm360(cuspSiderealLon);
  const rasi = Math.floor(normalized / 30) as RasiIndex;
  const degInSign = normalized - rasi * 30;
  const nature = classifyBhavaSignNature(normalized);
  const maxHouse = BHAVA_NATURE_MAX_HOUSE[nature];

  const rawHouseDiff = Math.abs(house - maxHouse) % 12;
  const houseDistance = Math.min(rawHouseDiff, 12 - rawHouseDiff);

  if (
    mode === "DEGREE_ARC" &&
    cardinalCuspLongitudes &&
    typeof cardinalCuspLongitudes[maxHouse] === "number"
  ) {
    const peakLon = norm360(cardinalCuspLongitudes[maxHouse]!);
    const arcDistanceDeg = shortestArc(normalized, peakLon);
    const digVirupas = round2(Math.max(0, Math.min(60, 60 - arcDistanceDeg / 3)));
    return {
      house,
      cuspLon: round2(normalized),
      rasi,
      degInSign: round2(degInSign),
      nature,
      signNature: nature,
      maxHouse,
      digPeakHouse: maxHouse,
      houseDistance,
      arcDistanceDeg: round4(arcDistanceDeg),
      digVirupas,
      digBalaVirupas: digVirupas,
    };
  }

  const digVirupas = (6 - houseDistance) * 10;
  return {
    house,
    cuspLon: round2(normalized),
    rasi,
    degInSign: round2(degInSign),
    nature,
    signNature: nature,
    maxHouse,
    digPeakHouse: maxHouse,
    houseDistance,
    digVirupas,
    digBalaVirupas: digVirupas,
  };
}

export const calculateSingleBhavaDigBala = calculateBhavaDigBala;

// ============================================================================
// 3. BHAVA DRIG BALA (BPHS CH. 27 SLOKA 29 & PL9 'ASPECTS ON BHAVAS')
// ============================================================================

export function getBhavaDrigWeightFactor(
  aspector: PlanetId,
  weightingMode: BhavaDrigWeightingMode = "RAMAN_JUP_MERC_FULL"
): number {
  switch (weightingMode) {
    case "RAMAN_JUP_MERC_FULL":
      if (aspector === "Jupiter" || aspector === "Mercury") return 1.0;
      return 0.25;
    case "SRIPATI_JUP_FULL_MERC_HALF":
      if (aspector === "Jupiter") return 1.0;
      if (aspector === "Mercury") return 0.5;
      return 0.25;
    case "BPHS_EQUAL_DIV_4":
    default:
      return 0.25;
  }
}

/**
 * Computes raw Drishti (0..60 Virupas) from a planet onto a Bhava Madhya cusp,
 * matching Parashara's Light 9.0 `Aspects on Bhavas` (`Aspects.pdf`) when `pl9ParityMode = true`.
 */
export function computePlanetToBhavaRawDrishti(
  aspector: PlanetPositionInput,
  house: HouseNumber,
  cuspSiderealLon: number,
  mode: DrigCalculationMode = "DEGREE_CONTINUOUS_KNOT",
  pl9ParityMode = true
): {
  drishtiKonaDeg: number;
  baseVirupas: number;
  specialBonusVirupas: number;
  totalRawVirupas: number;
  pl9PrintedScore: number;
} {
  const drishtiKonaDeg = computeDrishtiKona(aspector.lon, cuspSiderealLon);

  if (mode === "WHOLE_HOUSE") {
    const houseSpan = (((house - aspector.house) % 12) + 12) % 12 + 1;
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
      drishtiKonaDeg: round2(drishtiKonaDeg),
      baseVirupas,
      specialBonusVirupas,
      totalRawVirupas,
      pl9PrintedScore: Math.floor(totalRawVirupas),
    };
  }

  if (mode === "DEGREE_CONTINUOUS_KNOT") {
    // In PL9 'Aspects on Bhavas', Jupiter in [120, 150) and [240, 270) follows 60 - (theta - 120) and 60 - (theta - 240)
    if (
      pl9ParityMode &&
      aspector.planet === "Jupiter" &&
      ((drishtiKonaDeg >= 120 && drishtiKonaDeg < 150) ||
        (drishtiKonaDeg >= 240 && drishtiKonaDeg < 270))
    ) {
      const baseVirupas = computeBaseDrishti(drishtiKonaDeg);
      const offset =
        drishtiKonaDeg < 150 ? drishtiKonaDeg - 120 : drishtiKonaDeg - 240;
      const totalRawVirupas = 60.0 - offset;
      const specialBonusVirupas = Math.max(0, totalRawVirupas - baseVirupas);
      return {
        drishtiKonaDeg: round2(drishtiKonaDeg),
        baseVirupas: round2(baseVirupas),
        specialBonusVirupas: round2(specialBonusVirupas),
        totalRawVirupas: round2(totalRawVirupas),
        pl9PrintedScore: Math.floor(totalRawVirupas + 1e-9),
      };
    }

    const { baseVirupas, specialBonusVirupas, totalRawVirupas } =
      computeContinuousKnotDrishti(aspector.planet, drishtiKonaDeg);
    return {
      drishtiKonaDeg: round2(drishtiKonaDeg),
      baseVirupas: round2(baseVirupas),
      specialBonusVirupas: round2(specialBonusVirupas),
      totalRawVirupas: round2(totalRawVirupas),
      pl9PrintedScore: Math.floor(totalRawVirupas + 1e-9),
    };
  }

  const baseVirupas = computeBaseDrishti(drishtiKonaDeg);
  const specialBonusVirupas = computeRamanSpecialBonus(
    aspector.planet,
    drishtiKonaDeg
  );
  const totalRawVirupas = Math.min(60, baseVirupas + specialBonusVirupas);

  return {
    drishtiKonaDeg: round2(drishtiKonaDeg),
    baseVirupas: round2(baseVirupas),
    specialBonusVirupas: round2(specialBonusVirupas),
    totalRawVirupas: round2(totalRawVirupas),
    pl9PrintedScore: Math.floor(totalRawVirupas + 1e-9),
  };
}

/**
 * Component 3: Bhava Drig Bala
 */
export function calculateBhavaDrigBala(
  house: HouseNumber,
  cuspSiderealLon: number,
  planets: readonly PlanetPositionInput[],
  options: BhavaBalaOptions = {}
): BhavaDrigBalaDetail {
  const isPl9Parity = options.pl9ParityMode ?? false;
  const mode: DrigCalculationMode =
    options.drigMode ??
    options.drigCurveMode ??
    (isPl9Parity ? "DEGREE_CONTINUOUS_KNOT" : "DEGREE_RAMAN_BAND");
  const weightingMode: BhavaDrigWeightingMode =
    options.drigWeightingMode ??
    options.bhavaDrigWeighting ??
    (isPl9Parity ? "RAMAN_JUP_MERC_FULL" : "BPHS_EQUAL_DIV_4");
  const dynamicMoonBenefic = options.dynamicMoonBenefic ?? false;

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

  let rawSignedSum = 0;
  let weightedSum = 0;
  const aspects: BhavaPlanetaryAspect[] = [];

  for (const p of PLANET_ORDER) {
    const aspector = planets.find((item) => item.planet === p);
    if (!aspector) continue;

    const polarity: 1 | -1 = benefics.has(p) ? 1 : -1;
    const weightFactor = getBhavaDrigWeightFactor(p, weightingMode);

    const rawEval = computePlanetToBhavaRawDrishti(
      aspector,
      house,
      cuspSiderealLon,
      mode,
      isPl9Parity
    );

    const weightedVirupas = round2(
      polarity * rawEval.totalRawVirupas * weightFactor
    );

    rawSignedSum += polarity * rawEval.totalRawVirupas;
    weightedSum += polarity * rawEval.totalRawVirupas * weightFactor;

    aspects.push({
      aspector: p,
      house,
      drishtiKonaDeg: rawEval.drishtiKonaDeg,
      baseVirupas: rawEval.baseVirupas,
      specialBonusVirupas: rawEval.specialBonusVirupas,
      rawDrishtiVirupas: rawEval.totalRawVirupas,
      totalRawVirupas: rawEval.totalRawVirupas,
      pl9PrintedScore: rawEval.pl9PrintedScore,
      polarity,
      weightMultiplier: weightFactor,
      weightFactor,
      netBhavaDrigVirupas: weightedVirupas,
      weightedVirupas,
    });
  }

  const drigVirupas = round2(weightedSum);

  return {
    house,
    cuspLon: round4(norm360(cuspSiderealLon)),
    rawSignedSum: round2(rawSignedSum),
    drigVirupas,
    drigBalaVirupas: drigVirupas,
    aspects,
    receivedAspects: aspects,
  };
}

export const calculateSingleBhavaDrigBala = calculateBhavaDrigBala;

// ============================================================================
// MASTER BHAVA BALA ENGINE (STANDALONE + DSSME BLOCK_7 ADAPTER)
// ============================================================================

export function normalizeTwelveHouseCusps(
  cuspsInput: readonly number[] | Record<number, number>
): Record<HouseNumber, number> {
  const result = {} as Record<HouseNumber, number>;

  for (const h of HOUSE_NUMBERS) {
    let raw: number | undefined;
    if (Array.isArray(cuspsInput)) {
      raw = cuspsInput.length === 13 ? cuspsInput[h] : cuspsInput[h - 1];
    } else {
      raw = (cuspsInput as Record<number, number>)[h];
    }

    if (typeof raw !== "number" || Number.isNaN(raw)) {
      throw new Error(
        `Missing or invalid sidereal cusp longitude for House ${h}`
      );
    }
    result[h] = norm360(raw);
  }

  return result;
}

export const resolveTwelveHouseCusps = normalizeTwelveHouseCusps;

/**
 * Master BPHS Chapter 27 Bhava Bala Orchestrator across all 12 houses.
 * Supports both:
 *   1. calculateBhavaBala(houseCusps, planets, shadbalaVirupasByPlanet, options?)
 *   2. calculateBhavaBala({ houseCusps, shadbalaByPlanet, planets, options? })
 */
export function calculateBhavaBala(
  arg1: readonly number[] | Record<number, number> | BhavaBalaChartInput,
  arg2?: readonly PlanetPositionInput[],
  arg3?: Record<PlanetId, number>,
  arg4?: BhavaBalaOptions
): BhavaBalaEngineOutput {
  let houseCusps: readonly number[] | Record<number, number>;
  let planets: readonly PlanetPositionInput[];
  let shadbalaByPlanet: Record<PlanetId, number>;
  let options: BhavaBalaOptions;

  if (typeof arg1 === "object" && !Array.isArray(arg1) && ("shadbalaByPlanet" in arg1 || "planets" in (arg1 as object))) {
    const input = arg1 as BhavaBalaChartInput;
    houseCusps = input.houseCusps;
    planets = input.planets;
    shadbalaByPlanet = input.shadbalaByPlanet;
    options = input.options ?? {};
  } else {
    houseCusps = arg1 as readonly number[] | Record<number, number>;
    planets = arg2!;
    shadbalaByPlanet = arg3!;
    options = arg4 ?? {};
  }

  const resolvedCusps = normalizeTwelveHouseCusps(houseCusps);

  const isPl9Parity = Boolean(options.pl9ParityMode);
  const effectiveOptions: BhavaBalaOptions = {
    ...options,
    pl9ParityMode: isPl9Parity,
    drigMode:
      options.drigMode ??
      options.drigCurveMode ??
      (isPl9Parity ? "DEGREE_CONTINUOUS_KNOT" : "DEGREE_RAMAN_BAND"),
    drigWeightingMode:
      options.drigWeightingMode ??
      options.bhavaDrigWeighting ??
      (isPl9Parity ? "RAMAN_JUP_MERC_FULL" : "BPHS_EQUAL_DIV_4"),
    digCalculationMode: options.digCalculationMode ?? "HOUSE_STEP",
  };

  const roundFn =
    isPl9Parity ||
    effectiveOptions.drigWeightingMode === "RAMAN_JUP_MERC_FULL"
      ? round2
      : round1;

  const cardinalCusps: Record<CardinalHouse, number> = {
    1: resolvedCusps[1],
    4: resolvedCusps[4],
    7: resolvedCusps[7],
    10: resolvedCusps[10],
  };

  const houses = {} as Record<HouseNumber, HouseBhavaBalaResult>;
  const orderedByHouse: HouseBhavaBalaResult[] = [];

  for (const h of HOUSE_NUMBERS) {
    const cuspLon = resolvedCusps[h];

    const adhipati = calculateBhavaAdhipatiBala(cuspLon, shadbalaByPlanet);
    const dig = calculateBhavaDigBala(
      h,
      cuspLon,
      effectiveOptions.digCalculationMode,
      cardinalCusps
    );
    const drig = calculateBhavaDrigBala(
      h,
      cuspLon,
      planets,
      effectiveOptions
    );

    const adhipatiVirupas = roundFn(adhipati.adhipatiVirupas);
    const digVirupas = roundFn(dig.digVirupas);
    const drigVirupas = roundFn(drig.drigVirupas);
    const totalVirupas = roundFn(adhipatiVirupas + digVirupas + drigVirupas);
    const totalRupas = round2(totalVirupas / 60.0);

    const item: HouseBhavaBalaResult = {
      house: h,
      sign: adhipati.sign,
      rasi: adhipati.rasi,
      cuspRasi: adhipati.rasi,
      signLord: adhipati.signLord,
      bhavaLord: adhipati.signLord,
      cuspLon: round2(cuspLon),
      degInSign: dig.degInSign,
      degInCuspSign: dig.degInSign,
      nature: dig.nature,
      signNature: dig.nature,
      maxDigHouse: dig.maxHouse,
      digPeakHouse: dig.maxHouse,
      adhipatiVirupas,
      adhipatiBala: adhipatiVirupas,
      digVirupas,
      digBala: digVirupas,
      drigVirupas,
      drigBala: drigVirupas,
      totalVirupas,
      totalRupas,
      rank: 0,
      aspects: drig.aspects,
      receivedAspects: drig.aspects,
      drigBreakdown: drig,
    };

    houses[h] = item;
    orderedByHouse.push(item);
  }

  const rankedByStrength = [...orderedByHouse].sort(
    (a, b) => b.totalVirupas - a.totalVirupas || a.house - b.house
  );
  rankedByStrength.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  const sumVirupas = orderedByHouse.reduce((acc, item) => acc + item.totalVirupas, 0);
  const meanVirupas = round2(sumVirupas / 12.0);
  const strongestHouse = rankedByStrength[0]!;
  const weakestHouse = rankedByStrength[rankedByStrength.length - 1]!;

  return {
    houses,
    byHouse: houses,
    orderedByHouse,
    ordered: orderedByHouse,
    rankedByStrength,
    strongestHouse,
    weakestHouse,
    meanVirupas,
  };
}

// ============================================================================
// DSSME BLOCK_7 ADAPTER (`buildBhavaBalaBlock`)
// ============================================================================

export interface BhavaBalaInput {
  /** Shadbala total_virupas for each lord (length 7, Sun..Saturn order). */
  shadbalaTotals?: readonly number[];
  /** Optional legacy aspect scores on each bhava (1-12); superseded by degree-based BPHS Bhava Drig Bala when chart planets are present. */
  bhavaAspectScores?: Partial<Record<HouseKey, number>>;
  /** Optional Bhava Bala calculation options. */
  options?: BhavaBalaOptions;
}

/**
 * Builds BLOCK_7 (BHAVA_BALA).
 * Supports both:
 *   1. buildBhavaBalaBlock(ctx, { shadbalaTotals, options? })
 *   2. buildBhavaBalaBlock(ctx, shadbalaTotalVirupasArray, options?)
 */
export function buildBhavaBalaBlock(
  ctx: BlockContext,
  inputOrTotals: BhavaBalaInput | readonly number[],
  maybeOptions?: BhavaBalaOptions
): BlockResult<BhavaBalaBlock> {
  const { chart } = ctx;
  const issues = [];

  let shadbalaTotals: readonly number[];
  let options: BhavaBalaOptions;

  if (Array.isArray(inputOrTotals)) {
    shadbalaTotals = inputOrTotals;
    options = maybeOptions ?? {};
  } else {
    const inputObj = inputOrTotals as BhavaBalaInput;
    shadbalaTotals = inputObj.shadbalaTotals ?? [];
    options = inputObj.options ?? maybeOptions ?? {};
  }

  const shadbalaByPlanet = {} as Record<ClassicalPlanet, number>;
  for (let i = 0; i < CLASSICAL_PLANETS_ORDER.length; i++) {
    const p = CLASSICAL_PLANETS_ORDER[i]!;
    shadbalaByPlanet[p] = shadbalaTotals[i] ?? 0;
  }

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

  // Extract 12 house cusps; in PL9 Parity Mode, use Equal-House Bhava Madhya (Lagna + (h - 1) * 30)
  // if canonical houses only store whole-sign start degrees (0, 30, 60...), matching Aspects.pdf.
  const pl9ParityMode = options.pl9ParityMode ?? true;
  const lagnaLon = chart.lagna.siderealLongitude;
  const houseCusps: Record<number, number> = {};

  for (const h of HOUSE_NUMBERS) {
    const hKey = String(h) as HouseKey;
    const rawCusp = chart.houses[hKey]?.cuspLongitude;
    const equalCusp = norm360(lagnaLon + (h - 1) * 30);

    if (typeof rawCusp === "number" && !Number.isNaN(rawCusp)) {
      const isWholeSignStart =
        Math.abs(rawCusp % 30) < 1e-4 && Math.abs(lagnaLon % 30) > 1e-2;
      houseCusps[h] =
        pl9ParityMode && isWholeSignStart ? equalCusp : norm360(rawCusp);
    } else {
      houseCusps[h] = equalCusp;
    }
  }

  const engineOut = calculateBhavaBala({
    houseCusps,
    shadbalaByPlanet,
    planets: planetsInput,
    options: {
      ...options,
      pl9ParityMode,
      drigMode:
        options.drigMode ??
        options.drigCurveMode ??
        (pl9ParityMode ? "DEGREE_CONTINUOUS_KNOT" : "DEGREE_RAMAN_BAND"),
      drigWeightingMode:
        options.drigWeightingMode ??
        options.bhavaDrigWeighting ??
        (pl9ParityMode ? "RAMAN_JUP_MERC_FULL" : "BPHS_EQUAL_DIV_4"),
    },
  });

  const value: BhavaBalaBlock = mapHouseKeys((hKey: HouseKey) => {
    const hNum = Number(hKey) as HouseNumber;
    const r = engineOut.houses[hNum];
    const houseData = chart.houses[hKey];

    const entry: BhavaBalaEntry = {
      sign: houseData?.sign ?? r.sign,
      lord_contrib: r.adhipatiVirupas,
      dig_bala: r.digVirupas,
      drishti: r.drigVirupas,
      total: r.totalVirupas,
    };
    return entry;
  });

  const allZero = HOUSE_NUMBERS.every(
    (h) => value[String(h) as HouseKey].total === 0
  );
  if (allZero) {
    issues.push(
      warningIssue("BHAVA_BALA", "All 12 Bhava Bala house totals are zero")
    );
  }

  return finalizeBlock({
    blockId: "BHAVA_BALA",
    ctx,
    inputs: ["CanonicalChart", "SHADBALA"],
    value,
    issues,
    defaulted: false,
  });
}
