/**
 * BLOCK_11 (ASPECTS_PLANETS) & BLOCK_12 (ASPECTS_BHAVAS)
 * Module: src/engine/chartblocks/aspects.ts
 *
 * Canonical BPHS Ch. 26/27 & Parashara's Light 9.0 (PL9) 'Aspects.pdf' Parity Implementation.
 *
 * Key features:
 *   1. Supports all 9 bodies (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu).
 *   2. Exact PL9 'Aspects on Planets' parity:
 *      - Sign-to-sign Parashari fraction ('1/4', '1/2', '3/4', '4/4') with special aspects
 *        for Mars (4th/8th), Jupiter/Rahu/Ketu (5th/9th), and Saturn (3rd/10th).
 *      - Continuous Knot degree-based Sphuta Drishti score (0..60, integer floor in PL9 mode).
 *   3. Exact PL9 'Aspects on Bhavas' parity:
 *      - Evaluates aspects onto Equal-House Bhava Madhya cusps (Lagna + (h - 1) * 30 deg),
 *        matching every cell in 'Aspects.pdf' (including Rahu & Ketu columns).
 *   4. Provides downstream DSSME v1.6 helpers for Zero-Wave Z-2 and Stage S9 PAS_v3 (I_aspect).
 */

import type {
  AspectsBhavasBlock,
  AspectsPlanetsBlock,
  BhavaAspectDetail,
  BhavaAspectEntry,
  ClassicalPlanet,
  HouseKey,
  NineBody,
  PlanetAspect,
} from "../../types/dssme-canonical-types.ts";
import { NINE_BODIES_ORDER } from "../astronomy/planetaryPositions.ts";
import type { BlockContext, BlockResult } from "../blocks/blockTypes.ts";
import { finalizeBlock, mapHouseKeys } from "../blocks/blockResult.ts";
import {
  CLASSICAL_PLANETS_ORDER,
  computeBaseDrishti,
  computeDrishtiKona,
  computeRamanSpecialBonus,
  type DrigCalculationMode,
  norm360,
  type RasiIndex,
} from "./shadbala.ts";

// ============================================================================
// CORE TYPES & CONSTANTS
// ============================================================================

export type AspectFraction = "1/4" | "1/2" | "3/4" | "4/4";
export type PlanetAspectEntry = PlanetAspect;
export type HouseNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const HOUSE_NUMBERS: readonly HouseNumber[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
];

const BASE_KNOTS: readonly number[] = [
  0, 0, 15, 45, 30, 0, 60, 45, 30, 15, 0, 0,
];

export interface AspectBodyInput {
  body: NineBody;
  lon: number;
  house: number;
}

export interface AspectsBlockOptions {
  /**
   * Calculation mode for aspect scores:
   * - 'DEGREE_CONTINUOUS_KNOT': PL9 continuous piecewise interpolation (default in PL9 parity)
   * - 'DEGREE_RAMAN_BAND': BPHS base Drishti + flat special-aspect band bonus
   * - 'WHOLE_HOUSE': Classical whole-sign aspect scores (15, 30, 45, 60)
   */
  mode?: DrigCalculationMode;
  /**
   * When true (default), matches Parashara's Light 9.0 'Aspects.pdf':
   * - Includes all 9 bodies (Sun..Saturn + Rahu, Ketu)
   * - Rahu & Ketu receive 5th/9th special aspects (matching Jupiter)
   * - Scores are integer-floored `Math.floor(rawScore)` to match printed `(score)`
   * - Bhava aspects use Equal-House Bhava Madhya (Lagna + (h - 1) * 30)
   */
  pl9ParityMode?: boolean;
  /**
   * Whether to include Rahu & Ketu in ASPECTS_PLANETS & ASPECTS_BHAVAS (defaults to true in PL9 mode)
   */
  includeNodes?: boolean;
  /**
   * Minimum integer score threshold to emit an aspect entry (defaults to 1, matching Aspects.pdf)
   */
  minScoreThreshold?: number;
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

// ============================================================================
// 1. PARASHARI RASI FRACTION & CONTINUOUS KNOT DRISHTI FOR 9 BODIES
// ============================================================================

/**
 * Computes the inclusive sign span (1..12) from `fromLon` to `toLon`.
 */
export function computeSignSpan(fromLon: number, toLon: number): number {
  const fromSign = Math.floor(norm360(fromLon) / 30) as RasiIndex;
  const toSign = Math.floor(norm360(toLon) / 30) as RasiIndex;
  return (((toSign - fromSign) % 12) + 12) % 12 + 1;
}

/**
 * Determines the Parashari Rasi-to-Rasi aspect fraction ('1/4', '1/2', '3/4', '4/4' or null)
 * exactly as printed in the upper line of each cell in PL9's `Aspects on Planets` (`Aspects.pdf`).
 */
export function getParashariSignAspectFraction(
  aspector: NineBody,
  fromLon: number,
  toLon: number,
  includeNodesSpecial = true
): AspectFraction | null {
  const signSpan = computeSignSpan(fromLon, toLon);

  if (signSpan === 7) {
    return "4/4";
  }

  if (signSpan === 4 || signSpan === 8) {
    return aspector === "Mars" ? "4/4" : "3/4";
  }

  if (signSpan === 5 || signSpan === 9) {
    if (
      aspector === "Jupiter" ||
      (includeNodesSpecial && (aspector === "Rahu" || aspector === "Ketu"))
    ) {
      return "4/4";
    }
    return "1/2";
  }

  if (signSpan === 3 || signSpan === 10) {
    return aspector === "Saturn" ? "4/4" : "1/4";
  }

  return null;
}

/**
 * Fallback fraction derived from numerical score when a non-nullable `AspectFraction`
 * is required by `PlanetAspectEntry` for 2nd/6th/11th/12th sign spans (where PL9 prints only `(score)`).
 */
export function scoreToCanonicalFraction(score: number): AspectFraction {
  if (score >= 52.5) return "4/4";
  if (score >= 37.5) return "3/4";
  if (score >= 22.5) return "1/2";
  return "1/4";
}

/**
 * Computes continuous-knot Sphuta Drishti (0..60 Virupas) for all 9 bodies,
 * including Rahu & Ketu 5th/9th special aspects (knots[4]=60, knots[8]=60).
 */
export function computeNineBodyContinuousKnotDrishti(
  aspector: NineBody,
  thetaDeg: number,
  isBhavaTarget = false,
  pl9ParityMode = true
): {
  baseVirupas: number;
  specialBonusVirupas: number;
  totalRawVirupas: number;
  printedScore: number;
} {
  const theta = norm360(thetaDeg);
  const baseVirupas = computeBaseDrishti(theta);
  if (theta <= 30 || theta >= 300) {
    return {
      baseVirupas: 0,
      specialBonusVirupas: 0,
      totalRawVirupas: 0,
      printedScore: 0,
    };
  }

  const isTrineSpecialBody =
    aspector === "Jupiter" ||
    (pl9ParityMode && (aspector === "Rahu" || aspector === "Ketu"));

  // In PL9 'Aspects on Bhavas' (and Rahu->Moon in 'Aspects on Planets'),
  // trine special bodies (Jupiter, Rahu, Ketu) in [120, 150) and [240, 270)
  // follow 60 - (theta - 120) and 60 - (theta - 240).
  if (
    pl9ParityMode &&
    isTrineSpecialBody &&
    (isBhavaTarget || aspector === "Rahu" || aspector === "Ketu") &&
    ((theta >= 120 && theta < 150) || (theta >= 240 && theta < 270))
  ) {
    const offset = theta < 150 ? theta - 120 : theta - 240;
    const totalRawVirupas = 60.0 - offset;
    const specialBonusVirupas = Math.max(0, totalRawVirupas - baseVirupas);
    return {
      baseVirupas: round2(baseVirupas),
      specialBonusVirupas: round2(specialBonusVirupas),
      totalRawVirupas: round2(totalRawVirupas),
      printedScore: Math.floor(totalRawVirupas + 1e-9),
    };
  }

  const knots = [...BASE_KNOTS];
  if (aspector === "Mars") {
    knots[3] = 60;
    knots[7] = 60;
  } else if (isTrineSpecialBody) {
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

  return {
    baseVirupas: round2(baseVirupas),
    specialBonusVirupas: round2(specialBonusVirupas),
    totalRawVirupas: round2(totalRawVirupas),
    printedScore: Math.floor(totalRawVirupas + 1e-9),
  };
}

/**
 * Evaluates a single directed aspect from `aspector` onto a target longitude (planet or Bhava cusp).
 */
export function evaluateAspectScoreAndFraction(
  aspector: NineBody,
  fromLon: number,
  toLon: number,
  options: AspectsBlockOptions = {},
  isBhavaTarget = false
): {
  drishtiKonaDeg: number;
  signSpan: number;
  rasiFraction: AspectFraction | null;
  canonicalFraction: AspectFraction;
  rawScore: number;
  score: number;
} {
  const pl9ParityMode = options.pl9ParityMode ?? true;
  const mode: DrigCalculationMode =
    options.mode ??
    (pl9ParityMode ? "DEGREE_CONTINUOUS_KNOT" : "DEGREE_RAMAN_BAND");

  const drishtiKonaDeg = computeDrishtiKona(fromLon, toLon);
  const signSpan = computeSignSpan(fromLon, toLon);
  const rasiFraction = getParashariSignAspectFraction(
    aspector,
    fromLon,
    toLon,
    pl9ParityMode
  );

  if (mode === "WHOLE_HOUSE") {
    const scoreMap: Record<AspectFraction, number> = {
      "1/4": 15,
      "1/2": 30,
      "3/4": 45,
      "4/4": 60,
    };
    const rawScore = rasiFraction ? scoreMap[rasiFraction] : 0;
    return {
      drishtiKonaDeg: round2(drishtiKonaDeg),
      signSpan,
      rasiFraction,
      canonicalFraction: rasiFraction ?? "1/4",
      rawScore,
      score: rawScore,
    };
  }

  if (mode === "DEGREE_CONTINUOUS_KNOT") {
    const knotEval = computeNineBodyContinuousKnotDrishti(
      aspector,
      drishtiKonaDeg,
      isBhavaTarget,
      pl9ParityMode
    );
    const score = pl9ParityMode
      ? knotEval.printedScore
      : round2(knotEval.totalRawVirupas);
    const canonicalFraction =
      rasiFraction ?? scoreToCanonicalFraction(knotEval.totalRawVirupas);

    return {
      drishtiKonaDeg: round2(drishtiKonaDeg),
      signSpan,
      rasiFraction,
      canonicalFraction,
      rawScore: knotEval.totalRawVirupas,
      score,
    };
  }

  // DEGREE_RAMAN_BAND
  const baseVirupas = computeBaseDrishti(drishtiKonaDeg);
  const bonusPlanet: ClassicalPlanet | null =
    aspector === "Rahu" || aspector === "Ketu"
      ? "Jupiter"
      : (aspector as ClassicalPlanet);
  const specialBonus = bonusPlanet
    ? computeRamanSpecialBonus(bonusPlanet, drishtiKonaDeg)
    : 0;
  const rawScore = round2(Math.min(60, baseVirupas + specialBonus));
  const score = pl9ParityMode ? Math.floor(rawScore + 1e-9) : rawScore;
  const canonicalFraction =
    rasiFraction ?? scoreToCanonicalFraction(rawScore);

  return {
    drishtiKonaDeg: round2(drishtiKonaDeg),
    signSpan,
    rasiFraction,
    canonicalFraction,
    rawScore,
    score,
  };
}

// ============================================================================
// 2. STANDALONE CALCULATORS FOR BLOCK_11 & BLOCK_12
// ============================================================================

export interface DetailedPlanetAspectEntry extends PlanetAspectEntry {
  /** Rasi-based fraction printed in PL9 ('1/4'..'4/4'), or null when PL9 prints only '(score)' */
  pl9PrintedFraction: AspectFraction | null;
  /** Unrounded continuous Virupa score (0..60) */
  rawScore: number;
  /** Angular separation (targetLon - aspectorLon) mod 360 */
  drishtiKonaDeg: number;
  /** Inclusive sign span (1..12) */
  signSpan: number;
}

/**
 * Computes all planet-to-planet aspects (BLOCK_11 `ASPECTS_PLANETS`).
 */
export function calculateAspectsOnPlanets(
  bodies: readonly AspectBodyInput[],
  options: AspectsBlockOptions = {}
): {
  entries: PlanetAspectEntry[];
  detailedEntries: DetailedPlanetAspectEntry[];
} {
  const pl9ParityMode = options.pl9ParityMode ?? true;
  const includeNodes = options.includeNodes ?? pl9ParityMode;
  const minScoreThreshold = options.minScoreThreshold ?? 1;

  const activeOrder: readonly NineBody[] = includeNodes
    ? NINE_BODIES_ORDER
    : CLASSICAL_PLANETS_ORDER;

  const entries: PlanetAspectEntry[] = [];
  const detailedEntries: DetailedPlanetAspectEntry[] = [];

  for (const fromBodyId of activeOrder) {
    const fromBody = bodies.find((b) => b.body === fromBodyId);
    if (!fromBody) continue;

    for (const toBodyId of activeOrder) {
      if (fromBodyId === toBodyId) continue;

      const toBody = bodies.find((b) => b.body === toBodyId);
      if (!toBody) continue;

      const evaluated = evaluateAspectScoreAndFraction(
        fromBody.body,
        fromBody.lon,
        toBody.lon,
        options,
        false
      );

      if (evaluated.score < minScoreThreshold) continue;

      const entry: PlanetAspectEntry = {
        from: fromBody.body,
        to: toBody.body,
        fraction: evaluated.canonicalFraction,
        score: evaluated.score,
      };

      entries.push(entry);
      detailedEntries.push({
        ...entry,
        pl9PrintedFraction: evaluated.rasiFraction,
        rawScore: evaluated.rawScore,
        drishtiKonaDeg: evaluated.drishtiKonaDeg,
        signSpan: evaluated.signSpan,
      });
    }
  }

  return { entries, detailedEntries };
}

/**
 * Computes all planet-to-Bhava aspects (BLOCK_12 `ASPECTS_BHAVAS`).
 */
export function calculateAspectsOnBhavas(
  bodies: readonly AspectBodyInput[],
  houseCusps: Record<HouseNumber, number>,
  houseDisplayDegrees?: Record<HouseNumber, number>,
  options: AspectsBlockOptions = {}
): AspectsBhavasBlock {
  const pl9ParityMode = options.pl9ParityMode ?? true;
  const includeNodes = options.includeNodes ?? pl9ParityMode;
  const minScoreThreshold = options.minScoreThreshold ?? 1;

  const activeOrder: readonly NineBody[] = includeNodes
    ? NINE_BODIES_ORDER
    : CLASSICAL_PLANETS_ORDER;

  return mapHouseKeys((hKey: HouseKey) => {
    const hNum = Number(hKey) as HouseNumber;
    const cuspLon = houseCusps[hNum];
    const displayDeg = houseDisplayDegrees?.[hNum] ?? round2(cuspLon);

    const aspects: Partial<Record<NineBody, BhavaAspectDetail>> = {};

    for (const fromBodyId of activeOrder) {
      const fromBody = bodies.find((b) => b.body === fromBodyId);
      if (!fromBody) continue;

      const evaluated = evaluateAspectScoreAndFraction(
        fromBody.body,
        fromBody.lon,
        cuspLon,
        options,
        true
      );

      if (evaluated.score < minScoreThreshold) continue;

      aspects[fromBody.body] = {
        score: evaluated.score,
        fraction: evaluated.canonicalFraction,
      };
    }

    return {
      degree: displayDeg,
      aspects,
    };
  });
}

// ============================================================================
// 3. DOWNSTREAM DSSME v1.6 PIPELINE HELPERS (Z-2 & STAGE S9 PAS_v3 I_aspect)
// ============================================================================

/**
 * Zero-Wave Gate Z-2 check (§6):
 * "else if >= 2 malefics (Mars/Saturn/Rahu/Ketu) aspect Moon with score >= 40 -> DAMPED pressure"
 */
export function evaluateZ2LunarMaleficAspects(
  aspectsPlanets: AspectsPlanetsBlock,
  scoreThreshold = 40
): {
  maleficCount: number;
  qualifyingMalefics: Array<{ from: NineBody; score: number }>;
  triggersDampedPressure: boolean;
} {
  const malefics = new Set<NineBody>(["Mars", "Saturn", "Rahu", "Ketu"]);
  const qualifyingMalefics: Array<{ from: NineBody; score: number }> = [];

  for (const entry of aspectsPlanets) {
    if (
      entry.to === "Moon" &&
      malefics.has(entry.from) &&
      entry.score >= scoreThreshold
    ) {
      qualifyingMalefics.push({ from: entry.from, score: entry.score });
    }
  }

  return {
    maleficCount: qualifyingMalefics.length,
    qualifyingMalefics,
    triggersDampedPressure: qualifyingMalefics.length >= 2,
  };
}

/**
 * Stage S9 PAS_v3 `I_aspect` classifier (§8 S9):
 *   - Clean (no/neutral aspect)   -> 1.00
 *   - Mild hostile aspect         -> 0.97
 *   - Severe hostile aspect       -> 0.88
 *   - Benefic support aspect      -> 1.02
 */
export function evaluatePasIAspectFactor(
  targetPlanet: NineBody,
  aspectsPlanets: AspectsPlanetsBlock
): {
  iAspect: 1.02 | 1.0 | 0.97 | 0.88;
  classification:
    | "BeneficSupport"
    | "Clean"
    | "MildHostile"
    | "SevereHostile";
  maxMaleficScore: number;
  maxBeneficScore: number;
} {
  const benefics = new Set<NineBody>(["Jupiter", "Venus", "Mercury", "Moon"]);
  const malefics = new Set<NineBody>(["Saturn", "Mars", "Rahu", "Ketu", "Sun"]);

  let maxMaleficScore = 0;
  let maxBeneficScore = 0;

  for (const entry of aspectsPlanets) {
    if (entry.to !== targetPlanet) continue;
    if (malefics.has(entry.from)) {
      maxMaleficScore = Math.max(maxMaleficScore, entry.score);
    } else if (benefics.has(entry.from)) {
      maxBeneficScore = Math.max(maxBeneficScore, entry.score);
    }
  }

  if (maxMaleficScore >= 45 && maxMaleficScore > maxBeneficScore) {
    return {
      iAspect: 0.88,
      classification: "SevereHostile",
      maxMaleficScore,
      maxBeneficScore,
    };
  }

  if (maxMaleficScore >= 20 && maxMaleficScore >= maxBeneficScore) {
    return {
      iAspect: 0.97,
      classification: "MildHostile",
      maxMaleficScore,
      maxBeneficScore,
    };
  }

  if (maxBeneficScore >= 30 && maxBeneficScore > maxMaleficScore) {
    return {
      iAspect: 1.02,
      classification: "BeneficSupport",
      maxMaleficScore,
      maxBeneficScore,
    };
  }

  return {
    iAspect: 1.0,
    classification: "Clean",
    maxMaleficScore,
    maxBeneficScore,
  };
}

// ============================================================================
// 4. DSSME BLOCK_11 & BLOCK_12 BUILDERS (`buildAspectsPlanetsBlock`, `buildAspectsBhavasBlock`, `computeAspects`)
// ============================================================================

function extractNineBodiesFromChart(ctx: BlockContext): AspectBodyInput[] {
  const { chart } = ctx;
  return NINE_BODIES_ORDER.map((body) => {
    const pos = chart.planets[body];
    return {
      body,
      lon: pos.siderealLongitude,
      house: pos.house,
    };
  });
}

export function buildAspectsPlanetsBlock(
  ctx: BlockContext,
  options: AspectsBlockOptions = {}
): BlockResult<AspectsPlanetsBlock> {
  const bodies = extractNineBodiesFromChart(ctx);
  const { entries } = calculateAspectsOnPlanets(bodies, {
    pl9ParityMode: true,
    ...options,
  });

  return finalizeBlock({
    blockId: "ASPECTS_PLANETS",
    ctx,
    inputs: ["CanonicalChart"],
    value: entries,
    issues: [],
  });
}

export function buildAspectsBhavasBlock(
  ctx: BlockContext,
  options: AspectsBlockOptions = {}
): BlockResult<AspectsBhavasBlock> {
  const { chart } = ctx;
  const bodies = extractNineBodiesFromChart(ctx);
  const pl9ParityMode = options.pl9ParityMode ?? true;

  const lagnaLon = chart.lagna.siderealLongitude;
  const houseCusps = {} as Record<HouseNumber, number>;
  const houseDisplayDegrees = {} as Record<HouseNumber, number>;

  for (const h of HOUSE_NUMBERS) {
    const hKey = String(h) as HouseKey;
    const rawCusp = chart.houses[hKey]?.cuspLongitude;
    const equalCusp = norm360(lagnaLon + (h - 1) * 30);

    if (typeof rawCusp === "number" && !Number.isNaN(rawCusp)) {
      const isWholeSignStart =
        Math.abs(rawCusp % 30) < 1e-4 && Math.abs(lagnaLon % 30) > 1e-2;
      houseCusps[h] =
        pl9ParityMode && isWholeSignStart ? equalCusp : norm360(rawCusp);
      houseDisplayDegrees[h] = round2(rawCusp);
    } else {
      houseCusps[h] = equalCusp;
      houseDisplayDegrees[h] = round2(equalCusp);
    }
  }

  const value = calculateAspectsOnBhavas(
    bodies,
    houseCusps,
    houseDisplayDegrees,
    {
      pl9ParityMode,
      ...options,
    }
  );

  return finalizeBlock({
    blockId: "ASPECTS_BHAVAS",
    ctx,
    inputs: ["CanonicalChart"],
    value,
    issues: [],
  });
}

export function buildAspectsBlocks(
  ctx: BlockContext,
  options: AspectsBlockOptions = {}
): {
  aspectsPlanets: BlockResult<AspectsPlanetsBlock>;
  aspectsBhavas: BlockResult<AspectsBhavasBlock>;
} {
  return {
    aspectsPlanets: buildAspectsPlanetsBlock(ctx, options),
    aspectsBhavas: buildAspectsBhavasBlock(ctx, options),
  };
}

/**
 * Backward-compatible adapter for orchestrator & existing tests:
 * computes both ASPECTS_PLANETS and ASPECTS_BHAVAS.
 */
export function computeAspects(
  ctx: BlockContext,
  options: AspectsBlockOptions = {}
): {
  ASPECTS_PLANETS: AspectsPlanetsBlock;
  ASPECTS_BHAVAS: AspectsBhavasBlock;
} {
  const planetsResult = buildAspectsPlanetsBlock(ctx, options);
  const bhavasResult = buildAspectsBhavasBlock(ctx, options);
  return {
    ASPECTS_PLANETS: planetsResult.value!,
    ASPECTS_BHAVAS: bhavasResult.value!,
  };
}
