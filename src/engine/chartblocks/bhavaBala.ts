/**
 * BLOCK_7 - BHAVA_BALA (BPHS Chapter 27 Canonical Implementation)
 * Module: src/engine/chartblocks/bhavaBala.ts
 *
 * Authority: Brihat Parashara Hora Shastra (BPHS), Chapter 27, Slokas 26-29
 *            & B.V. Raman, Graha and Bhava Balas, Chapter 9, Sections 55-58
 *
 * Three components (in Virupas):
 *   1. Bhava Adhipati Bala - Full 1.0x Shadbala Pinda of the House Lord (no 0.5x scaling bug)
 *   2. Bhava Dig Bala      - Sign nature classification (NARA->H1, JALA->H4, CHATUSHPADA->H10, KEETA->H7)
 *                            including 15 deg half-sign splits for Sagittarius and Capricorn
 *   3. Bhava Drig Bala     - Signed BPHS piecewise aspectual strength onto each Bhava Madhya (/4 divisor)
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
  CardinalHouse,
  CLASSICAL_PLANETS_ORDER,
  DrigCalculationMode,
  evaluatePairwiseDrishti,
  norm360,
  PlanetId,
  PlanetPositionInput,
  RasiIndex,
  SIGN_LORDS,
} from "./shadbala.ts";

export type HouseNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type BhavaSignNature =
  | "NARA"        // Human / Biped -> peaks in H1 (60), zero in H7 (0)
  | "JALA"        // Aquatic / Water -> peaks in H4 (60), zero in H10 (0)
  | "CHATUSHPADA" // Quadruped -> peaks in H10 (60), zero in H4 (0)
  | "KEETA";      // Insect / Reptile -> peaks in H7 (60), zero in H1 (0)

export type BhavaDrigWeightingMode =
  | "BPHS_EQUAL_DIV_4"            // All 7 planets weighted at 1/4 of raw Drishti
  | "RAMAN_JUP_MERC_FULL"         // Jupiter & Mercury at 1.0 (100%), other 5 planets at 1/4 (25%)
  | "SRIPATI_JUP_FULL_MERC_HALF"; // Jupiter at 1.0 (100%), Mercury at 1/2 (50%), others at 1/4 (25%)

export interface BhavaBalaOptions {
  drigCurveMode?: DrigCalculationMode;
  bhavaDrigWeighting?: BhavaDrigWeightingMode;
  dynamicMoonBenefic?: boolean;
}

export interface BhavaPlanetaryAspect {
  aspector: PlanetId;
  drishtiKonaDeg: number;
  rawDrishtiVirupas: number;
  polarity: 1 | -1;
  weightMultiplier: number;
  netBhavaDrigVirupas: number;
}

export interface HouseBhavaBalaResult {
  house: HouseNumber;
  cuspLon: number;
  cuspRasi: RasiIndex;
  degInCuspSign: number;
  bhavaLord: PlanetId;
  signNature: BhavaSignNature;
  digPeakHouse: CardinalHouse;
  adhipatiBala: number;
  digBala: number;
  drigBala: number;
  receivedAspects: BhavaPlanetaryAspect[];
  totalVirupas: number;
  totalRupas: number;
  rank: number;
}

export interface BhavaBalaEngineOutput {
  houses: Record<HouseNumber, HouseBhavaBalaResult>;
  orderedByHouse: HouseBhavaBalaResult[];
  rankedByStrength: HouseBhavaBalaResult[];
  strongestHouse: HouseBhavaBalaResult;
  weakestHouse: HouseBhavaBalaResult;
}

export const HOUSE_NUMBERS: readonly HouseNumber[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
];

function round1(val: number): number {
  return Math.round((val + Number.EPSILON) * 10) / 10;
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Classify the Bhava Sign Nature (NARA, JALA, CHATUSHPADA, KEETA) and its
 * directional peak house (1, 4, 7, or 10) from a sidereal cusp longitude.
 */
export function classifyBhavaSignNature(cuspLon: number): {
  rasi: RasiIndex;
  degInSign: number;
  nature: BhavaSignNature;
  peakHouse: CardinalHouse;
} {
  const norm = norm360(cuspLon);
  const rasi = Math.floor(norm / 30) as RasiIndex;
  const degInSign = norm - rasi * 30;

  let nature: BhavaSignNature;
  let peakHouse: CardinalHouse;

  switch (rasi) {
    case 2:  // Gemini
    case 5:  // Virgo
    case 6:  // Libra
    case 10: // Aquarius
      nature = "NARA";
      peakHouse = 1;
      break;

    case 3:  // Cancer
    case 11: // Pisces
      nature = "JALA";
      peakHouse = 4;
      break;

    case 0: // Aries
    case 1: // Taurus
    case 4: // Leo
      nature = "CHATUSHPADA";
      peakHouse = 10;
      break;

    case 7: // Scorpio
      nature = "KEETA";
      peakHouse = 7;
      break;

    case 8: // Sagittarius: 0-15 deg Nara (H1), 15-30 deg Chatushpada (H10)
      if (degInSign < 15) {
        nature = "NARA";
        peakHouse = 1;
      } else {
        nature = "CHATUSHPADA";
        peakHouse = 10;
      }
      break;

    case 9: // Capricorn: 0-15 deg Chatushpada (H10), 15-30 deg Jala (H4)
      if (degInSign < 15) {
        nature = "CHATUSHPADA";
        peakHouse = 10;
      } else {
        nature = "JALA";
        peakHouse = 4;
      }
      break;
  }

  return { rasi, degInSign, nature, peakHouse };
}

/**
 * Compute Bhava Dig Bala in Virupas [0, 60] for a given house number (1..12)
 * and sidereal cusp longitude.
 */
export function calculateSingleBhavaDigBala(
  house: HouseNumber,
  cuspLon: number
): {
  digBalaVirupas: number;
  signNature: BhavaSignNature;
  digPeakHouse: CardinalHouse;
  rasi: RasiIndex;
  degInSign: number;
} {
  const { rasi, degInSign, nature, peakHouse } =
    classifyBhavaSignNature(cuspLon);

  const rawDiff = Math.abs(house - peakHouse) % 12;
  const shortestHouseDist = Math.min(rawDiff, 12 - rawDiff);
  const digBalaVirupas = (6 - shortestHouseDist) * 10;

  return {
    digBalaVirupas,
    signNature: nature,
    digPeakHouse: peakHouse,
    rasi,
    degInSign: round2(degInSign),
  };
}

/**
 * Compute Bhava Drig Bala cast by all 7 planets onto a single house cusp (Bhava Madhya).
 */
export function calculateSingleBhavaDrigBala(
  house: HouseNumber,
  cuspLon: number,
  planets: readonly PlanetPositionInput[],
  options: BhavaBalaOptions = {}
): {
  drigBalaVirupas: number;
  receivedAspects: BhavaPlanetaryAspect[];
} {
  const {
    drigCurveMode = "DEGREE_RAMAN_BAND",
    bhavaDrigWeighting = "BPHS_EQUAL_DIV_4",
    dynamicMoonBenefic = false,
  } = options;

  const sunPos = planets.find((p) => p.planet === "Sun");
  const moonPos = planets.find((p) => p.planet === "Moon");

  let isMoonBenefic = true;
  if (dynamicMoonBenefic && sunPos && moonPos) {
    isMoonBenefic = norm360(moonPos.lon - sunPos.lon) < 180;
  }

  const benefics = new Set<PlanetId>(["Mercury", "Jupiter", "Venus"]);
  if (isMoonBenefic) {
    benefics.add("Moon");
  }

  const syntheticCuspTarget: PlanetPositionInput = {
    planet: "Sun",
    lon: norm360(cuspLon),
    speed: 0,
    house,
  };

  let netSum = 0;
  const receivedAspects: BhavaPlanetaryAspect[] = [];

  for (const aspector of planets) {
    const polarity: 1 | -1 = benefics.has(aspector.planet) ? 1 : -1;
    const detail = evaluatePairwiseDrishti(
      aspector,
      syntheticCuspTarget,
      polarity,
      drigCurveMode
    );

    let weightMultiplier = 0.25;
    if (bhavaDrigWeighting === "RAMAN_JUP_MERC_FULL") {
      if (aspector.planet === "Jupiter" || aspector.planet === "Mercury") {
        weightMultiplier = 1.0;
      }
    } else if (bhavaDrigWeighting === "SRIPATI_JUP_FULL_MERC_HALF") {
      if (aspector.planet === "Jupiter") weightMultiplier = 1.0;
      else if (aspector.planet === "Mercury") weightMultiplier = 0.5;
    }

    const netBhavaDrigVirupas = round2(
      polarity * detail.totalRawVirupas * weightMultiplier
    );
    netSum += polarity * detail.totalRawVirupas * weightMultiplier;

    receivedAspects.push({
      aspector: aspector.planet,
      drishtiKonaDeg: detail.drishtiKonaDeg,
      rawDrishtiVirupas: detail.totalRawVirupas,
      polarity,
      weightMultiplier,
      netBhavaDrigVirupas,
    });
  }

  return {
    drigBalaVirupas: round2(netSum),
    receivedAspects,
  };
}

/**
 * Normalize a 12-house cusp input into a strict Record<HouseNumber, number>.
 */
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

/**
 * Master BPHS Chapter 27 Bhava Bala Orchestrator across all 12 houses.
 */
export function calculateBhavaBala(
  houseCusps: readonly number[] | Record<number, number>,
  planets: readonly PlanetPositionInput[],
  shadbalaVirupasByPlanet: Record<PlanetId, number>,
  options: BhavaBalaOptions = {}
): BhavaBalaEngineOutput {
  const normalizedCusps = normalizeTwelveHouseCusps(houseCusps);
  const houses = {} as Record<HouseNumber, HouseBhavaBalaResult>;
  const orderedByHouse: HouseBhavaBalaResult[] = [];

  for (const h of HOUSE_NUMBERS) {
    const cuspLon = normalizedCusps[h];
    const digInfo = calculateSingleBhavaDigBala(h, cuspLon);
    const bhavaLord = SIGN_LORDS[digInfo.rasi];
    const adhipatiBala = shadbalaVirupasByPlanet[bhavaLord];

    if (typeof adhipatiBala !== "number" || Number.isNaN(adhipatiBala)) {
      throw new Error(
        `Missing Shadbala total for Bhava Lord ${bhavaLord} (House ${h})`
      );
    }

    const drigInfo = calculateSingleBhavaDrigBala(h, cuspLon, planets, options);

    const totalVirupas = round1(
      adhipatiBala + digInfo.digBalaVirupas + drigInfo.drigBalaVirupas
    );
    const totalRupas = round2(totalVirupas / 60.0);

    const item: HouseBhavaBalaResult = {
      house: h,
      cuspLon: round2(cuspLon),
      cuspRasi: digInfo.rasi,
      degInCuspSign: digInfo.degInSign,
      bhavaLord,
      signNature: digInfo.signNature,
      digPeakHouse: digInfo.digPeakHouse,
      adhipatiBala: round1(adhipatiBala),
      digBala: digInfo.digBalaVirupas,
      drigBala: drigInfo.drigBalaVirupas,
      receivedAspects: drigInfo.receivedAspects,
      totalVirupas,
      totalRupas,
      rank: 0,
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

  return {
    houses,
    orderedByHouse,
    rankedByStrength,
    strongestHouse: rankedByStrength[0]!,
    weakestHouse: rankedByStrength[rankedByStrength.length - 1]!,
  };
}

// ============================================================================
// DSSME BLOCK_7 ADAPTER (`buildBhavaBalaBlock`)
// ============================================================================

export interface BhavaBalaInput {
  /** Shadbala total_virupas for each lord (length 7, Sun..Saturn order). */
  shadbalaTotals: number[];
  /** Optional legacy aspect scores on each bhava (1-12); superseded by degree-based BPHS Bhava Drig Bala when chart planets are present. */
  bhavaAspectScores?: Partial<Record<HouseKey, number>>;
  /** Optional Bhava Bala calculation options. */
  options?: BhavaBalaOptions;
}

export function buildBhavaBalaBlock(
  ctx: BlockContext,
  input: BhavaBalaInput
): BlockResult<BhavaBalaBlock> {
  const { chart } = ctx;
  const issues = [];

  const lordToVirupas: Record<ClassicalPlanet, number> = {
    Sun: input.shadbalaTotals[0] ?? 0,
    Moon: input.shadbalaTotals[1] ?? 0,
    Mars: input.shadbalaTotals[2] ?? 0,
    Mercury: input.shadbalaTotals[3] ?? 0,
    Jupiter: input.shadbalaTotals[4] ?? 0,
    Venus: input.shadbalaTotals[5] ?? 0,
    Saturn: input.shadbalaTotals[6] ?? 0,
  };

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

  const lagnaLon = chart.lagna.siderealLongitude;

  const value: BhavaBalaBlock = mapHouseKeys((key: HouseKey): BhavaBalaEntry => {
    const n = parseInt(key, 10) as HouseNumber;
    const house = chart.houses[key];
    const sign: ZodiacSign = house.sign;

    const cuspLon =
      house.cuspLongitude ?? norm360(lagnaLon + (n - 1) * 30.0);

    // 1. Bhava Adhipati Bala: Full 1.0x lord's Shadbala virupas (BPHS Ch. 27 Sloka 26)
    const lord = house.lord;
    const lord_contrib = round2(lordToVirupas[lord] ?? 0);

    // 2. Bhava Dig Bala: Sign nature classification (NARA/JALA/CHATUSHPADA/KEETA)
    const digInfo = calculateSingleBhavaDigBala(n, cuspLon);
    const digStrength = digInfo.digBalaVirupas;

    // 3. Bhava Drig Bala: Signed BPHS degree-based Drishti on the Bhava Madhya
    const drigInfo = calculateSingleBhavaDrigBala(
      n,
      cuspLon,
      planetsInput,
      input.options
    );
    const drishti = drigInfo.drigBalaVirupas;

    const total = round2(lord_contrib + digStrength + drishti);

    return { sign, lord_contrib, drishti, total };
  });

  const allZero = Object.values(value).every(
    (e) => (e as BhavaBalaEntry).total === 0
  );
  if (allZero) {
    issues.push(
      warningIssue(
        "BHAVA_BALA.total",
        "All Bhava Bala totals are zero; BHF will default to 1.00"
      )
    );
  }

  return finalizeBlock({
    blockId: "BHAVA_BALA",
    ctx,
    inputs: ["CanonicalChart"],
    value,
    issues,
    defaulted: false,
  });
}
