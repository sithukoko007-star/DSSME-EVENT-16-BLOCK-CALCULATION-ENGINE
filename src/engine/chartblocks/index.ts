/**
 * DSSME 16-Block Chartblocks Orchestrator & Barrel Export
 * Module: src/engine/chartblocks/index.ts
 *
 * Wires all 21 canonical keys + _meta of Dssme16BlockResult in strict dependency order:
 *   Level 1: IDENTITY, HOUSES, HOUSE_POSITIONS, RETROGRADE
 *   Level 2: DIGNITY, COMBUST, NAVAMSHA
 *   Level 3: BAV, SAV, BAV_CURRENT_SIGN, SIGN_CLUSTERS, ASPECTS_PLANETS, ASPECTS_BHAVAS, DASHA, HORA
 *   Level 4: SHADBALA, BHAVA_BALA
 *   Level 5: PANCHANGA, PHASE_STRESS, PLANETS, YOGA_LIST
 *
 * Preserves Checkpoint 3 closed-gate fixes (machine-timezone-safe UTC date parsing,
 * T-09 amavasya_zone tithi 29/30/1, JD-based day/night detection) and integrates
 * full Parashara's Light 9.0 (PL9) Parity Mode across SHADBALA, BHAVA_BALA, and ASPECTS.
 */

import type {
  CanonicalChart,
  ClassicalPlanet,
  ClassicalPlanetEntry,
  CombustBlock,
  Dignity,
  DignityBlock,
  Dssme16BlockResult,
  HouseKey,
  LagnaEntry,
  NativeMeta,
  NineBody,
  NodeEntry,
  PanchangaBlock,
  PlanetsBlock,
  ZodiacSign,
} from "../../types/dssme-canonical-types.ts";
import { ZODIAC_SIGNS_ARIES_FIRST } from "../../types/dssme-canonical-types.ts";
import type { PanchangaResult } from "../panchanga/panchangaTypes.ts";
import { createBlockContext } from "../blocks/blockResult.ts";
import type { BlockContext, BlockIssue, BlockResult } from "../blocks/blockTypes.ts";
import { finalizeBlock } from "../blocks/blockResult.ts";

// Level 1: Pure Projections & Identity
import {
  buildIdentityBlock,
  getLagnaType,
  type IdentitySessionParams,
} from "./identity.ts";
import { buildHousesBlock } from "../blocks/houses.ts";
import { buildHousePositionsBlock } from "../blocks/housePositions.ts";
import { buildRetrogradeBlock } from "../blocks/retrograde.ts";

// Level 2: Dignity, Combustion, Navamsha (D-9)
import { buildDignityBlock, getClassicalDignity } from "./dignity.ts";
import { buildCombustBlock } from "./combust.ts";
import { buildNavamshaBlock } from "./navamsha.ts";

// Level 3: Ashtakavarga, Aspects, Dasha, Hora
import { computeAshtakavarga } from "./ashtakavarga.ts";
import { buildSignClustersBlock } from "./signClusters.ts";
import {
  type AspectsBlockOptions,
  type AspectBodyInput,
  buildAspectsBhavasBlock,
  buildAspectsBlocks,
  buildAspectsPlanetsBlock,
  calculateAspectsOnBhavas,
  calculateAspectsOnPlanets,
  computeAspects,
  evaluateAspectScoreAndFraction,
  evaluatePasIAspectFactor,
  evaluateZ2LunarMaleficAspects,
} from "./aspects.ts";
import { buildDashaBlock } from "./dasha.ts";
import { buildHoraBlock } from "./hora.ts";

// Level 4: Shadbala (BLOCK_6) & Bhava Bala (BLOCK_7)
import {
  buildShadbalaBlock,
  calculateAyanaBala,
  calculateChestaBala,
  calculateDegreeDigBala,
  calculateDetailedDrigBala,
  calculateDigBala,
  calculateDrigBala,
  calculateIshtaKashta,
  calculateIshtaKashtaFromShadbala,
  calculateKaalaBala,
  calculateNathonnathaBala,
  calculatePanchadhaSaptavargaja,
  calculateSaptavargajaBala,
  calculateSavanaAharganaVarshaMasaLords,
  calculateShadbala,
  calculateSthanaBala,
  calculateYuddhaBala,
  type ChestaBalaMode,
  CLASSICAL_PLANETS_ORDER,
  computeLocalSunriseSunsetHours,
  type DrigCalculationMode,
  type DrigWeightingMode,
  type PlanetPositionInput,
  type ShadbalaChartInput,
  type ShadbalaInput,
} from "./shadbala.ts";
import {
  type BhavaBalaInput,
  type BhavaBalaOptions,
  type BhavaDrigWeightingMode,
  buildBhavaBalaBlock,
  calculateBhavaAdhipatiBala,
  calculateBhavaBala,
  calculateBhavaDigBala,
  calculateBhavaDrigBala,
  classifyBhavaSignNature,
} from "./bhavaBala.ts";

// Level 5: Phase Stress (BLOCK_14), Panchanga (BLOCK_2), Planets (BLOCK_4) & Yoga List (BLOCK_16)
import { buildPhaseStressBlock } from "./phaseStress.ts";
import { buildYogaListBlock } from "./yoga.ts";
import { SIGN_LORDS } from "../astronomy/planetaryPositions.ts";

export type IdentityBlockOptions = IdentitySessionParams;
export type ChestaCalculationMode = ChestaBalaMode;
export const calculateMasaBala = calculateSavanaAharganaVarshaMasaLords;

// ============================================================================
// BARREL RE-EXPORTS
// ============================================================================

export {
  // Level 1
  buildIdentityBlock,
  getLagnaType,
  type IdentitySessionParams,
  buildHousesBlock,
  buildHousePositionsBlock,
  buildRetrogradeBlock,
  // Level 2
  buildDignityBlock,
  getClassicalDignity,
  buildCombustBlock,
  buildNavamshaBlock,
  // Level 3
  computeAshtakavarga,
  buildSignClustersBlock,
  buildAspectsPlanetsBlock,
  buildAspectsBhavasBlock,
  buildAspectsBlocks,
  computeAspects,
  calculateAspectsOnPlanets,
  calculateAspectsOnBhavas,
  evaluateAspectScoreAndFraction,
  evaluateZ2LunarMaleficAspects,
  evaluatePasIAspectFactor,
  type AspectsBlockOptions,
  type AspectBodyInput,
  buildDashaBlock,
  buildHoraBlock,
  // Level 4
  buildShadbalaBlock,
  calculateShadbala,
  calculateSthanaBala,
  calculateSaptavargajaBala,
  calculatePanchadhaSaptavargaja,
  calculateDigBala,
  calculateDegreeDigBala,
  calculateKaalaBala,
  calculateNathonnathaBala,
  calculateAyanaBala,
  calculateSavanaAharganaVarshaMasaLords,
  calculateYuddhaBala,
  calculateChestaBala,
  calculateDrigBala,
  calculateDetailedDrigBala,
  calculateIshtaKashta,
  calculateIshtaKashtaFromShadbala,
  type ShadbalaInput,
  type ShadbalaChartInput,
  type PlanetPositionInput,
  type DrigCalculationMode,
  type DrigWeightingMode,
  type ChestaBalaMode,
  CLASSICAL_PLANETS_ORDER,
  computeLocalSunriseSunsetHours,
  buildBhavaBalaBlock,
  calculateBhavaBala,
  calculateBhavaAdhipatiBala,
  calculateBhavaDigBala,
  calculateBhavaDrigBala,
  classifyBhavaSignNature,
  type BhavaBalaOptions,
  type BhavaDrigWeightingMode,
  type BhavaBalaInput,
  // Level 5
  buildYogaListBlock,
  buildPhaseStressBlock,
};

// ============================================================================
// TIMEZONE-SAFE HELPERS (CHECKPOINT 3 CLOSED-GATE FIXES)
// ============================================================================

const WEEKDAY_LORDS: readonly ClassicalPlanet[] = [
  "Sun",     // 0: Sunday
  "Moon",    // 1: Monday
  "Mars",    // 2: Tuesday
  "Mercury", // 3: Wednesday
  "Jupiter", // 4: Thursday
  "Venus",   // 5: Friday
  "Saturn",  // 6: Saturday
];

/**
 * Parses `YYYY-MM-DD` from a local ISO string using `Date.UTC()` so machine
 * timezone never contaminates weekday derivation (Checkpoint 3 Priority 1 fix).
 */
export function parseUtcWeekdayFromLocalIso(localIso: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(localIso.trim());
  if (match) {
    const yr = Number(match[1]);
    const mo = Number(match[2]);
    const dy = Number(match[3]);
    return new Date(Date.UTC(yr, mo - 1, dy)).getUTCDay();
  }
  return 0;
}

/**
 * Parses local hour [0, 24) directly from a local ISO string `YYYY-MM-DDTHH:mm:ss`
 * without invoking `new Date(localIso).getHours()`.
 */
export function parseLocalHourFromIso(localIso: string): number {
  const match = /T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(localIso.trim());
  if (match) {
    const hh = Number(match[1]);
    const mm = Number(match[2]);
    const ss = match[3] ? Number(match[3]) : 0;
    return hh + mm / 60 + ss / 3600;
  }
  return 12;
}

/**
 * Checks whether a sidereal longitude lies within any of the 3 classical Gandanta zones (§15.3):
 *   - Cancer 26°40' – Leo 3°20'      (116.6667° – 123.3333°)
 *   - Scorpio 26°40' – Sag 3°20'     (236.6667° – 243.3333°)
 *   - Pisces 26°40' – Aries 3°20'    (356.6667° – 360° or 0° – 3.3333°)
 */
export function isGandantaLongitude(siderealLon: number): boolean {
  const lon = ((siderealLon % 360) + 360) % 360;
  const band = 3 + 20 / 60; // 3.3333333333333335 deg
  if (lon >= 120 - band && lon <= 120 + band) return true;
  if (lon >= 240 - band && lon <= 240 + band) return true;
  if (lon >= 360 - band || lon <= band) return true;
  return false;
}

/** Format degree as "XX°XX'XX\"" */
export function formatDeg(deg: number): string {
  const total = Math.abs(deg);
  const d = Math.floor(total);
  const mFrac = (total - d) * 60;
  const m = Math.floor(mFrac);
  const s = Math.round((mFrac - m) * 60);
  return `${d}°${m.toString().padStart(2, "0")}'${s.toString().padStart(2, "0")}"`;
}

/** Format Julian Day into local HH:mm:ss */
export function jdToTimeStr(jdUt: number, offsetHours: number): string {
  const utcMs = (jdUt - 2440587.5) * 86400000;
  const localMs = utcMs + offsetHours * 3600000;
  const d = new Date(localMs);
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  const s = d.getUTCSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// ============================================================================
// LEVEL 5: PLANETS BLOCK BUILDER (BLOCK_4)
// ============================================================================

export function buildPlanetsBlock(
  chart: CanonicalChart,
  shadbalaTotals: number[],
  shadbalaRanks: number[],
  dignityBlock: Record<NineBody, Dignity>,
  combustBlock?: CombustBlock
): PlanetsBlock {
  function dispositorFor(sign: ZodiacSign): ClassicalPlanet {
    return SIGN_LORDS[sign];
  }

  function sbRatio(planet: ClassicalPlanet): number {
    const idx = CLASSICAL_PLANETS_ORDER.indexOf(planet);
    if (idx < 0) return 1.0;
    const minReq = [390, 360, 300, 420, 390, 330, 300][idx]!;
    return parseFloat(((shadbalaTotals[idx] ?? 0) / minReq).toFixed(4));
  }

  function sbRank(planet: ClassicalPlanet): number {
    const idx = CLASSICAL_PLANETS_ORDER.indexOf(planet);
    return idx >= 0 ? (shadbalaRanks[idx] ?? 0) : 0;
  }

  const makeDegStr = (pos: { sign: ZodiacSign; signDegree: number }) =>
    `${pos.sign} ${formatDeg(pos.signDegree)}`;

  const classicalEntry = (p: ClassicalPlanet): ClassicalPlanetEntry => {
    const pos = chart.planets[p];
    const isCombust =
      combustBlock && p !== "Sun"
        ? combustBlock[p]?.combust === true
        : false;

    return {
      sign: pos.sign,
      degree: makeDegStr(pos),
      nakshatra: pos.nakshatra,
      pada: pos.nakshatraPada,
      house: pos.house,
      retro: pos.isRetrograde ? "Y" : "N",
      combust: isCombust ? "Y" : "N",
      dispositor: dispositorFor(pos.sign),
      dignity: dignityBlock[p],
      sb_ratio: sbRatio(p),
      sb_rank: sbRank(p),
    };
  };

  const nodeEntry = (p: "Rahu" | "Ketu"): NodeEntry => {
    const pos = chart.planets[p];
    return {
      sign: pos.sign,
      degree: makeDegStr(pos),
      nakshatra: pos.nakshatra,
      pada: pos.nakshatraPada,
      house: pos.house,
      retro: "R",
      combust: "N",
      dispositor: dispositorFor(pos.sign),
      dignity: "—",
      sb_ratio: null,
      sb_rank: null,
    };
  };

  const lagnaPos = chart.lagna;
  const lagnaEntry: LagnaEntry = {
    sign: lagnaPos.sign,
    degree: makeDegStr(lagnaPos),
    nakshatra: lagnaPos.nakshatra,
    pada: lagnaPos.nakshatraPada,
    house: 1,
    retro: "N",
    combust: "N",
    dispositor: dispositorFor(lagnaPos.sign),
    dignity: "—",
  };

  return {
    Sun: classicalEntry("Sun"),
    Moon: classicalEntry("Moon"),
    Mars: classicalEntry("Mars"),
    Mercury: classicalEntry("Mercury"),
    Jupiter: classicalEntry("Jupiter"),
    Venus: classicalEntry("Venus"),
    Saturn: classicalEntry("Saturn"),
    Rahu: nodeEntry("Rahu"),
    Ketu: nodeEntry("Ketu"),
    Lagna: lagnaEntry,
  };
}

// ============================================================================
// LEVEL 5: PANCHANGA BLOCK BUILDER (BLOCK_2)
// ============================================================================

export interface BuildPanchangaBlockOptions {
  panchanga?: PanchangaResult;
  sunriseJd?: number;
  sunsetJd?: number;
  eclipseProximity?: boolean;
  ingressStacking?: boolean;
}

export function buildPanchangaBlock(
  ctx: BlockContext,
  options: BuildPanchangaBlockOptions = {}
): BlockResult<PanchangaBlock> {
  const { chart } = ctx;
  const { panchanga, sunriseJd, sunsetJd } = options;
  const tzOffset = chart.time.timezoneOffsetHours;

  const sunLon = chart.planets.Sun.siderealLongitude;
  const moonLon = chart.planets.Moon.siderealLongitude;
  const lagnaLon = chart.lagna.siderealLongitude;

  // Elongation & Tithi (1..30)
  const elongation = (((moonLon - sunLon) % 360) + 360) % 360;
  const derivedTithiIndex = Math.min(30, Math.floor(elongation / 12) + 1);
  const tithiIndex = panchanga?.tithi?.index ?? derivedTithiIndex;
  const paksha: "Shukla" | "Krishna" =
    tithiIndex <= 15 ? "Shukla" : "Krishna";

  // Weekday lord: Panchanga vara is authoritative when available; fallback uses Date.UTC on localIso
  const utcWeekday = parseUtcWeekdayFromLocalIso(chart.time.localIso);
  const varaWeekday = panchanga?.vara?.weekday ?? utcWeekday;
  const weekdayLord: ClassicalPlanet =
    WEEKDAY_LORDS[((varaWeekday % 7) + 7) % 7]!;

  // Nakshatra of Moon
  const nakshatraName = panchanga?.nakshatra?.name ?? chart.planets.Moon.nakshatra;
  const nakshatraPada = panchanga?.nakshatra?.pada ?? chart.planets.Moon.nakshatraPada;

  // Sunrise & Sunset formatting
  const resolvedSunriseJd = sunriseJd ?? panchanga?.vara?.sunriseJdUT;
  const sunriseTime =
    resolvedSunriseJd !== undefined
      ? jdToTimeStr(resolvedSunriseJd, tzOffset)
      : "06:00:00";

  const sunsetTime =
    sunsetJd !== undefined
      ? jdToTimeStr(sunsetJd, tzOffset)
      : "18:00:00";

  const sunDegreeFormatted = `${chart.planets.Sun.sign} ${formatDeg(chart.planets.Sun.signDegree)}`;

  // 5 Volatility Flags (§3.1 Rule 8 & Checkpoint 3 T-09 fix)
  const gandantaActive =
    isGandantaLongitude(moonLon) || isGandantaLongitude(lagnaLon);

  // T-09: Amavasya zone includes tithi 29, 30, and 1 (Krishna 14/15 + Shukla 1)
  const amavasyaZone =
    tithiIndex === 29 || tithiIndex === 30 || tithiIndex === 1;

  // Purnima zone includes tithi 14, 15, and 16 (Shukla 14/15 + Krishna 1)
  const purnimaZone =
    tithiIndex === 14 || tithiIndex === 15 || tithiIndex === 16;

  const tithiAtBirth =
    panchanga?.tithi?.window?.endLocal ??
    panchanga?.tithi?.window?.endUtcIso ??
    `Tithi ${tithiIndex}`;

  const nakAtBirth =
    panchanga?.nakshatra?.window?.endLocal ??
    panchanga?.nakshatra?.window?.endUtcIso ??
    nakshatraName;

  const moonNakEntry =
    panchanga?.nakshatra?.window?.startLocal ??
    panchanga?.nakshatra?.window?.startUtcIso ??
    "NOT_FOUND";

  const moonNakExit =
    panchanga?.nakshatra?.window?.endLocal ??
    panchanga?.nakshatra?.window?.endUtcIso ??
    "NOT_FOUND";

  const value: PanchangaBlock = {
    paksha,
    tithi_name: panchanga?.tithi?.name ?? `${paksha} ${tithiIndex}`,
    tithi_at_birth: tithiAtBirth,
    nakshatra_name: nakshatraName,
    nakshatra_pada: nakshatraPada,
    nak_at_birth: nakAtBirth,
    yoga_at_birth: panchanga?.yoga?.name ?? "Unknown",
    karana_at_birth: panchanga?.karana?.name ?? "Unknown",
    weekday_lord: weekdayLord,
    sunrise_time: sunriseTime,
    sunrise_degree: sunDegreeFormatted,
    sunset_time: sunsetTime,
    sun_degree: sunDegreeFormatted,
    moon_nak_entry: moonNakEntry,
    moon_nak_exit: moonNakExit,
    eclipse_proximity: options.eclipseProximity ?? false,
    gandanta_active: gandantaActive,
    ingress_stacking: options.ingressStacking ?? false,
    amavasya_zone: amavasyaZone,
    purnima_zone: purnimaZone,
  };

  return finalizeBlock({
    blockId: "PANCHANGA",
    ctx,
    inputs: panchanga ? ["CanonicalChart", "PanchangaResult"] : ["CanonicalChart"],
    value,
    issues: [],
  });
}

// ============================================================================
// MASTER 16-BLOCK ASSEMBLER (`buildAllChartBlocks` / `assemble16BlockResult`)
// ============================================================================

export interface AssembleChartBlocksOptions extends IdentitySessionParams {
  session?: IdentitySessionParams;
  panchanga?: PanchangaResult;
  sunriseJd?: number;
  sunsetJd?: number;
  sunriseJdUt?: number;
  sunsetJdUt?: number;
  eclipseProximity?: boolean;
  /**
   * Enables Parashara's Light 9.0 (PL9) Parity Mode across SHADBALA, BHAVA_BALA,
   * ASPECTS_PLANETS, and ASPECTS_BHAVAS (defaults to true).
   */
  pl9ParityMode?: boolean;
  /** Optional override for Saptavargaja calculation (defaults to true = Panchadha 45-point scale) */
  usePanchadhaSaptavargaja?: boolean;
  /** Optional override for Shadbala/Aspects Drig mode */
  drigMode?: DrigCalculationMode;
  /** Optional override for Shadbala Drig weighting mode */
  drigWeightingMode?: DrigWeightingMode;
  /** Optional override for Bhava Bala Drig weighting mode */
  bhavaDrigWeightingMode?: BhavaDrigWeightingMode;
  /** Optional override for Chesta Bala mode */
  chestaMode?: ChestaCalculationMode;
}

export type ChartblocksOptions = AssembleChartBlocksOptions;

export interface AssembledChartBlocksBundle {
  result: Dssme16BlockResult;
  issues: BlockIssue[];
}

/**
 * Builds all 16 canonical DSSME blocks (21 top-level keys + `_meta`) from a `BlockContext`.
 * Operates in strict 5-level dependency graph order.
 */
export function buildAllChartBlocks(
  ctx: BlockContext,
  options: AssembleChartBlocksOptions = {}
): AssembledChartBlocksBundle {
  const { chart } = ctx;
  const allIssues: BlockIssue[] = [];
  const pl9ParityMode = options.pl9ParityMode ?? true;

  // --------------------------------------------------------------------------
  // LEVEL 1: Pure Projections & Identity
  // --------------------------------------------------------------------------
  const session = options.session ?? {};
  const identityBlock = buildIdentityBlock(ctx, session);
  const housesBlock = buildHousesBlock(ctx);
  const housePositionsBlock = buildHousePositionsBlock(ctx);
  const retrogradeBlock = buildRetrogradeBlock(ctx);

  allIssues.push(
    ...identityBlock.issues,
    ...housesBlock.issues,
    ...housePositionsBlock.issues,
    ...retrogradeBlock.issues
  );

  // --------------------------------------------------------------------------
  // LEVEL 2: Dignity, Combustion & Navamsha (D-9)
  // --------------------------------------------------------------------------
  const dignityBlock = buildDignityBlock(ctx);
  const combustBlock = buildCombustBlock(ctx);
  const navamshaBlock = buildNavamshaBlock(ctx);

  allIssues.push(
    ...dignityBlock.issues,
    ...combustBlock.issues,
    ...navamshaBlock.issues
  );

  // --------------------------------------------------------------------------
  // LEVEL 3: Ashtakavarga (BAV/SAV/Clusters), Aspects (BLOCK_11/12), Dasha & Hora
  // --------------------------------------------------------------------------
  const { BAV, SAV, BAV_CURRENT_SIGN } = computeAshtakavarga(ctx);
  const signClustersBlock = buildSignClustersBlock(ctx, SAV.values);

  const aspectsOptions: AspectsBlockOptions = {
    pl9ParityMode,
    mode:
      options.drigMode ??
      (pl9ParityMode ? "DEGREE_CONTINUOUS_KNOT" : "DEGREE_RAMAN_BAND"),
    includeNodes: true,
  };
  const aspectsPlanetsBlock = buildAspectsPlanetsBlock(ctx, aspectsOptions);
  const aspectsBhavasBlock = buildAspectsBhavasBlock(ctx, aspectsOptions);

  const dashaBlock = buildDashaBlock(ctx);

  // Determine effective sunrise/sunset JD UT
  const resolvedSunriseJd =
    options.sunriseJd ??
    options.sunriseJdUt ??
    options.panchanga?.vara?.sunriseJdUT;

  const solarEvents = computeLocalSunriseSunsetHours(
    chart.time.julianDayUt,
    chart.time.timezoneOffsetHours,
    chart.location.longitude,
    chart.location.latitude
  );

  const localJd = chart.time.julianDayUt + chart.time.timezoneOffsetHours / 24.0;
  const currentLocalHour = (localJd + 0.5 - Math.floor(localJd + 0.5)) * 24.0;
  const resolvedSunsetJd =
    options.sunsetJd ??
    options.sunsetJdUt ??
    chart.time.julianDayUt + (solarEvents.sunsetHour - currentLocalHour) / 24.0;

  const horaBlock = buildHoraBlock(ctx, resolvedSunriseJd, resolvedSunsetJd);

  allIssues.push(
    ...signClustersBlock.issues,
    ...aspectsPlanetsBlock.issues,
    ...aspectsBhavasBlock.issues,
    ...dashaBlock.issues,
    ...horaBlock.issues
  );

  // --------------------------------------------------------------------------
  // LEVEL 4: Shadbala (BLOCK_6) & Bhava Bala (BLOCK_7)
  // --------------------------------------------------------------------------
  const sunLon = chart.planets.Sun.siderealLongitude;
  const moonLon = chart.planets.Moon.siderealLongitude;
  const elongation = (((moonLon - sunLon) % 360) + 360) % 360;
  const derivedTithiIndex = Math.min(30, Math.floor(elongation / 12) + 1);
  const tithiIndex = options.panchanga?.tithi?.index ?? derivedTithiIndex;
  const pakshaLower: "shukla" | "krishna" =
    tithiIndex <= 15 ? "shukla" : "krishna";

  // Authoritative weekday & day/night detection (Checkpoint 3 Priority 1 fix)
  const utcWeekday = parseUtcWeekdayFromLocalIso(chart.time.localIso);
  const weekday = options.panchanga?.vara?.weekday ?? utcWeekday;

  let isNight: boolean;
  if (resolvedSunriseJd !== undefined && resolvedSunsetJd !== undefined) {
    isNight =
      chart.time.julianDayUt >= resolvedSunsetJd ||
      chart.time.julianDayUt < resolvedSunriseJd;
  } else {
    const localHour = parseLocalHourFromIso(chart.time.localIso);
    isNight = localHour >= 18 || localHour < 6;
  }

  const shadbalaInput: ShadbalaInput = {
    paksha: pakshaLower,
    tithiIndex,
    weekday,
    hora: (horaBlock.value?.planet ?? "Sun") as ClassicalPlanet,
    isNight,
    chartJd: chart.time.julianDayUt,
    longitude: chart.location.longitude,
    ayanamsaDeg: chart.ayanamsa.value,
    usePanchadhaSaptavargaja: options.usePanchadhaSaptavargaja ?? true,
    pl9ParityMode,
    drigMode:
      options.drigMode ??
      (pl9ParityMode ? "DEGREE_CONTINUOUS_KNOT" : "DEGREE_RAMAN_BAND"),
    drigWeightingMode:
      options.drigWeightingMode ??
      (pl9ParityMode ? "PL9_JUP_MERC_FULL" : "BPHS_EQUAL_DIV_4"),
    chestaMode: options.chestaMode ?? "BPHS_ORIGINAL_27_23",
  };

  const shadbalaBlock = buildShadbalaBlock(ctx, shadbalaInput);
  const shadbalaTotals =
    shadbalaBlock.value?.total_virupas ?? new Array(7).fill(300);
  const shadbalaRanks =
    shadbalaBlock.value?.rank ?? new Array(7).fill(1);

  const bhavaBalaOptions: BhavaBalaOptions = {
    pl9ParityMode,
    drigMode:
      options.drigMode ??
      (pl9ParityMode ? "DEGREE_CONTINUOUS_KNOT" : "DEGREE_RAMAN_BAND"),
    drigWeightingMode:
      options.bhavaDrigWeightingMode ??
      (pl9ParityMode ? "RAMAN_JUP_MERC_FULL" : "BPHS_EQUAL_DIV_4"),
  };

  // Hard Rule 10: BHAVA_BALA consumes SHADBALA.total_virupas as lord_contrib,
  // and NEVER feeds back into SHADBALA RS(p).
  const bhavaBalaBlock = buildBhavaBalaBlock(
    ctx,
    shadbalaTotals,
    bhavaBalaOptions
  );

  allIssues.push(...shadbalaBlock.issues, ...bhavaBalaBlock.issues);

  // --------------------------------------------------------------------------
  // LEVEL 5: Phase Stress (BLOCK_14), Panchanga (BLOCK_2), Planets (BLOCK_4) & Yoga List (BLOCK_16)
  // --------------------------------------------------------------------------
  const phaseStressBlock = buildPhaseStressBlock(ctx);
  const ingressStacking =
    (phaseStressBlock.value?.ingress_within_24h?.length ?? 0) >= 2;

  const panchangaBlock = buildPanchangaBlock(ctx, {
    panchanga: options.panchanga,
    sunriseJd: resolvedSunriseJd,
    sunsetJd: resolvedSunsetJd,
    eclipseProximity: options.eclipseProximity ?? false,
    ingressStacking,
  });

  const planetsBlock: PlanetsBlock = buildPlanetsBlock(
    chart,
    shadbalaTotals,
    shadbalaRanks,
    dignityBlock.value ?? ({} as Record<NineBody, Dignity>),
    combustBlock.value ?? undefined
  );

  const yogaListBlock = buildYogaListBlock(ctx);

  allIssues.push(
    ...phaseStressBlock.issues,
    ...panchangaBlock.issues,
    ...yogaListBlock.issues
  );

  // --------------------------------------------------------------------------
  // META & FINAL 16-BLOCK RESULT ASSEMBLY
  // --------------------------------------------------------------------------
  const meta: NativeMeta = {
    engine: "DSSME",
    engineVersion: "V3.0",
    calculationMode: "NATIVE",
    ephemeris: chart.provenance.ephemeris,
    ayanamsa: "Lahiri",
    generatedAt: new Date().toISOString(),
    deterministic: true,
    pyjhoraReference: {
      repository: "https://github.com/naturalstupid/PyJHora",
      commit: "48e57d29b47a3143519910a24866758116467485",
      tag: "V4.9.3",
    },
  };

  const result: Dssme16BlockResult = {
    IDENTITY: identityBlock.value!,
    PANCHANGA: panchangaBlock.value!,
    DASHA: dashaBlock.value!,
    PLANETS: planetsBlock,
    HOUSES: housesBlock.value!,
    SHADBALA: shadbalaBlock.value!,
    BHAVA_BALA: bhavaBalaBlock.value!,
    BAV,
    SAV,
    BAV_CURRENT_SIGN,
    ASPECTS_PLANETS: aspectsPlanetsBlock.value!,
    ASPECTS_BHAVAS: aspectsBhavasBlock.value!,
    DIGNITY: dignityBlock.value as DignityBlock,
    RETROGRADE: retrogradeBlock.value!,
    COMBUST: combustBlock.value!,
    HOUSE_POSITIONS: housePositionsBlock.value!,
    SIGN_CLUSTERS: signClustersBlock.value!,
    HORA: horaBlock.value!,
    PHASE_STRESS: phaseStressBlock.value!,
    NAVAMSHA: navamshaBlock.value!,
    YOGA_LIST: yogaListBlock.value!,
    _meta: meta,
  };

  return { result, issues: allIssues };
}

/**
 * Convenience alias returning `Dssme16BlockResult` directly.
 */
export function assemble16BlockResult(
  ctx: BlockContext,
  options: AssembleChartBlocksOptions = {}
): Dssme16BlockResult {
  return buildAllChartBlocks(ctx, options).result;
}

/**
 * Assembles all 16 DSSME blocks from a CanonicalChart + optional Panchanga.
 * Backward-compatible async entry point used across App.tsx and test suites.
 */
export async function buildDssme16BlockResult(
  chart: CanonicalChart,
  panchanga?: PanchangaResult,
  options: ChartblocksOptions = {}
): Promise<Dssme16BlockResult> {
  const ctx = createBlockContext(chart, panchanga);
  const bundle = buildAllChartBlocks(ctx, {
    ...options,
    session: options.session,
    panchanga,
    sunriseJd: options.sunriseJdUt ?? panchanga?.vara?.sunriseJdUT,
    sunsetJd: options.sunsetJdUt,
  });
  return bundle.result;
}
