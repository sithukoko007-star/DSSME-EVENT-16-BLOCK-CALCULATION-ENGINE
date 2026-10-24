/**
 * Chartblocks Orchestrator — assembles all 16 DSSME blocks into Dssme16BlockResult.
 *
 * Call order (dependencies respected):
 *   1. identity, combust, dignity, signClusters(no SAV), hora, phaseStress
 *   2. shadbala (needs panchanga hora/paksha)
 *   3. ashtakavarga (BAV/SAV/BAV_CURRENT_SIGN)
 *   4. bhavaBala (needs shadbala totals)
 *   5. navamsha, yoga, aspects, dasha
 *   6. signClusters (with SAV from step 3)
 *   7. Assemble Dssme16BlockResult
 *
 * Note: PLANETS, HOUSES, RETROGRADE, HOUSE_POSITIONS are computed by the
 * existing frozen blocks in src/engine/blocks/. We call them here and
 * merge into the final result.
 */

import type {
  CanonicalChart,
  ClassicalPlanet,
  Dssme16BlockResult,
  HouseKey,
  NativeMeta,
  NineBody,
  PlanetsBlock,
  ClassicalPlanetEntry,
  NodeEntry,
  LagnaEntry,
  Dignity,
  ZodiacSign,
} from "../../types/dssme-canonical-types.ts";
import { ZODIAC_SIGNS_ARIES_FIRST } from "../../types/dssme-canonical-types.ts";
import type { PanchangaResult } from "../panchanga/panchangaTypes.ts";
import { createBlockContext } from "../blocks/blockResult.ts";
import { buildHousesBlock } from "../blocks/houses.ts";
import { buildHousePositionsBlock } from "../blocks/housePositions.ts";
import { buildRetrogradeBlock } from "../blocks/retrograde.ts";

import { buildIdentityBlock, IdentitySessionParams } from "./identity.ts";
import { buildDashaBlock } from "./dasha.ts";
import {
  buildShadbalaBlock,
  CLASSICAL_PLANETS_ORDER,
  computeLocalSunriseSunsetHours,
  ShadbalaInput,
} from "./shadbala.ts";
import { buildBhavaBalaBlock } from "./bhavaBala.ts";
import { computeAshtakavarga } from "./ashtakavarga.ts";
import { computeAspects } from "./aspects.ts";
import { buildDignityBlock, getClassicalDignity } from "./dignity.ts";
import { buildCombustBlock } from "./combust.ts";
import { buildSignClustersBlock } from "./signClusters.ts";
import { buildHoraBlock } from "./hora.ts";
import { buildPhaseStressBlock } from "./phaseStress.ts";
import { buildNavamshaBlock } from "./navamsha.ts";
import { buildYogaListBlock } from "./yoga.ts";
import { SIGN_LORDS, NINE_BODIES_ORDER } from "../astronomy/planetaryPositions.ts";

export interface ChartblocksOptions {
  /** Session parameters passed through to IDENTITY block */
  session?: IdentitySessionParams;
  /** Sunrise JD UT for HORA accuracy */
  sunriseJdUt?: number;
  /** Sunset JD UT for HORA accuracy */
  sunsetJdUt?: number;
}

/** Format degree as "XX°XX'XX\"" */
function formatDeg(deg: number): string {
  const total = Math.abs(deg);
  const d = Math.floor(total);
  const mFrac = (total - d) * 60;
  const m = Math.floor(mFrac);
  const s = Math.round((mFrac - m) * 60);
  return `${d}°${m.toString().padStart(2, "0")}'${s.toString().padStart(2, "0")}"`;
}

/** Build PLANETS block from CanonicalChart (matches PlanetsBlock shape). */
function buildPlanetsBlock(
  chart: CanonicalChart,
  shadbalaTotals: number[],
  shadbalaRanks: number[],
  dignityBlock: Record<NineBody, Dignity>
): PlanetsBlock {
  const SIGN_LORDS_LOCAL = SIGN_LORDS;
  const lagnaIdx = ZODIAC_SIGNS_ARIES_FIRST.indexOf(chart.lagna.sign);

  function dispositorFor(sign: ZodiacSign): ClassicalPlanet {
    return SIGN_LORDS_LOCAL[sign];
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
    return {
      sign: pos.sign,
      degree: makeDegStr(pos),
      nakshatra: pos.nakshatra,
      pada: pos.nakshatraPada,
      house: pos.house,
      retro: pos.isRetrograde ? "Y" : "N",
      combust: "N", // will be populated by COMBUST block
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

/**
 * Build all 16 DSSME blocks from a CanonicalChart + optional Panchanga.
 */
export async function buildDssme16BlockResult(
  chart: CanonicalChart,
  panchanga: PanchangaResult | undefined,
  options: ChartblocksOptions = {}
): Promise<Dssme16BlockResult> {
  const ctx = createBlockContext(chart, panchanga);
  const session = options.session ?? {};

  // --- Shadbala input (needs panchanga) ---
  const tithiIndex = panchanga?.tithi.index ?? 1;
  const paksha = (panchanga?.tithi.paksha === "krishna" ? "krishna" : "shukla") as "shukla" | "krishna";

  // Weekday: always derive from localIso date string directly (timezone-safe).
  // localIso is already in the chart's local timezone by construction from Phase 1.
  // Using new Date(localIso).getDay() would interpret in the *machine* timezone,
  // which is wrong for e.g. a 05:00 JST chart running on a UTC server.
  // The panchanga vara weekday is computed sunrise-based and is authoritative when available.
  const weekday: number = (() => {
    if (panchanga?.vara.weekday !== undefined) return panchanga.vara.weekday;
    // Fallback: parse date component from localIso string without involving Date.getDay()
    const datePart = chart.time.localIso.split("T")[0] ?? "1970-01-01";
    const [yr, mo, dy] = datePart.split("-").map(Number) as [number, number, number];
    // Zeller / deterministic UTC date → weekday (no machine-TZ involvement)
    return new Date(Date.UTC(yr, mo - 1, dy)).getUTCDay();
  })();

  const effectiveSunriseJdUt = options.sunriseJdUt ?? panchanga?.vara.sunriseJdUT;

  const solarEvents = computeLocalSunriseSunsetHours(
    chart.time.julianDayUt,
    chart.time.timezoneOffsetHours,
    chart.location.longitude,
    chart.location.latitude
  );

  const localJd = chart.time.julianDayUt + chart.time.timezoneOffsetHours / 24.0;
  const currentLocalHour = (localJd + 0.5 - Math.floor(localJd + 0.5)) * 24.0;
  const effectiveSunsetJdUt =
    options.sunsetJdUt ??
    chart.time.julianDayUt + (solarEvents.sunsetHour - currentLocalHour) / 24.0;

  // Estimate if night using JD comparison when sunriseJdUt/sunsetJdUt are available,
  // or by parsing the hour from the localIso string (not new Date().getHours() which
  // is machine-timezone dependent).
  const isNight = (() => {
    if (effectiveSunriseJdUt !== undefined && effectiveSunsetJdUt !== undefined) {
      return (
        chart.time.julianDayUt >= effectiveSunsetJdUt ||
        chart.time.julianDayUt < effectiveSunriseJdUt
      );
    }
    if (effectiveSunsetJdUt !== undefined) {
      return chart.time.julianDayUt >= effectiveSunsetJdUt;
    }
    // Fallback: parse hour from localIso directly (timezone-safe)
    const timePart = chart.time.localIso.split("T")[1] ?? "12:00:00";
    const localHour = parseInt(timePart.substring(0, 2), 10);
    return localHour >= 18 || localHour < 6;
  })();

  // Step 1: Shadbala (needed for BhavaBala and PLANETS block)
  const horaResult = buildHoraBlock(ctx, effectiveSunriseJdUt, effectiveSunsetJdUt);
  const horaLord = horaResult.value?.planet ?? "Sun";

  const shadbalaInput: ShadbalaInput = {
    paksha,
    tithiIndex,
    weekday,
    hora: horaLord,
    isNight,
    // PL9 Phase A — required for accurate Kaala Bala
    chartJd: chart.time.julianDayUt,
    longitude: chart.location.longitude,
    ayanamsaDeg: chart.ayanamsa.value,
    sunriseJdUt: effectiveSunriseJdUt,
    sunsetJdUt: effectiveSunsetJdUt,
    doubleMoonPaksha: false, // PL9 standard: 1x (20.99 Virupas for Chofu)
    doubleSunAyana: false,   // PL9 standard: 1x (33.36 Virupas for Chofu)
  };
  const shadbalaResult = buildShadbalaBlock(ctx, shadbalaInput);
  const shadbalaTotals = shadbalaResult.value?.total_virupas ?? new Array(7).fill(300);
  const shadbalaRanks = shadbalaResult.value?.rank ?? new Array(7).fill(1);

  // Step 2: Ashtakavarga (BAV/SAV/BAV_CURRENT_SIGN)
  const { BAV, SAV, BAV_CURRENT_SIGN } = computeAshtakavarga(ctx);

  // Step 3: Aspects & BhavaBala (BPHS Ch. 27 1.0x Adhipati + Sign-Nature Dig + Signed Drig)
  const { ASPECTS_PLANETS, ASPECTS_BHAVAS } = computeAspects(ctx);
  const bhavaBalaResult = buildBhavaBalaBlock(ctx, {
    shadbalaTotals,
  });

  // Step 4: Dignity block (needed for PLANETS)
  const dignityResult = buildDignityBlock(ctx);
  const dignityBlock = dignityResult.value ?? ({} as Record<NineBody, Dignity>);

  // Step 5: Core identity/state blocks
  const identityResult = buildIdentityBlock(ctx, session);
  const dashaResult = buildDashaBlock(ctx);
  const combustResult = buildCombustBlock(ctx);
  const retrogradeResult = buildRetrogradeBlock(ctx);
  const housesResult = buildHousesBlock(ctx);
  const housePositionsResult = buildHousePositionsBlock(ctx);
  const phaseStressResult = buildPhaseStressBlock(ctx);
  const navamshaResult = buildNavamshaBlock(ctx);
  const yogaResult = buildYogaListBlock(ctx);

  // Step 6: Sign clusters with SAV
  const signClustersResult = buildSignClustersBlock(ctx, SAV.values);

  // Step 7: Build PLANETS block
  const planetsBlock = buildPlanetsBlock(chart, shadbalaTotals, shadbalaRanks, dignityBlock);

  // Meta
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

  // Assemble all 16 blocks
  const result: Dssme16BlockResult = {
    IDENTITY: identityResult.value!,
    PANCHANGA: {
      paksha: paksha === "shukla" ? "Shukla" : "Krishna",
      tithi_name: `${paksha === "shukla" ? "Shukla" : "Krishna"} ${tithiIndex}`,
      tithi_at_birth: `Tithi ${tithiIndex}`,
      nakshatra_name: chart.planets.Moon.nakshatra,
      nakshatra_pada: chart.planets.Moon.nakshatraPada,
      nak_at_birth: chart.planets.Moon.nakshatra,
      yoga_at_birth: panchanga?.yoga.name ?? "Unknown",
      karana_at_birth: panchanga?.karana.name ?? "Unknown",
      weekday_lord: (["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"] as ClassicalPlanet[])[weekday] ?? "Sun",
      sunrise_time: options.sunriseJdUt ? jdToTimeStr(options.sunriseJdUt, chart.time.timezoneOffsetHours) : "06:00:00",
      sunrise_degree: `${chart.planets.Sun.sign} ${formatDeg(chart.planets.Sun.signDegree)}`,
      sunset_time: options.sunsetJdUt ? jdToTimeStr(options.sunsetJdUt, chart.time.timezoneOffsetHours) : "18:00:00",
      sun_degree: `${chart.planets.Sun.sign} ${formatDeg(chart.planets.Sun.signDegree)}`,
      moon_nak_entry: "NOT_FOUND",
      moon_nak_exit: "NOT_FOUND",
      eclipse_proximity: false,
      gandanta_active: isGandanta(chart),
      ingress_stacking: (phaseStressResult.value?.ingress_within_24h.length ?? 0) >= 2,
      amavasya_zone: tithiIndex === 29 || tithiIndex === 30 || tithiIndex === 1,
      purnima_zone: tithiIndex === 15 || tithiIndex === 14 || tithiIndex === 16,
    },
    DASHA: dashaResult.value!,
    PLANETS: planetsBlock,
    HOUSES: housesResult.value!,
    SHADBALA: shadbalaResult.value!,
    BHAVA_BALA: bhavaBalaResult.value!,
    BAV,
    SAV,
    BAV_CURRENT_SIGN,
    ASPECTS_PLANETS,
    ASPECTS_BHAVAS,
    DIGNITY: dignityBlock as Record<NineBody, import("../../types/dssme-canonical-types.ts").Dignity>,
    RETROGRADE: retrogradeResult.value!,
    COMBUST: combustResult.value!,
    HOUSE_POSITIONS: housePositionsResult.value!,
    SIGN_CLUSTERS: signClustersResult.value!,
    HORA: horaResult.value!,
    PHASE_STRESS: phaseStressResult.value!,
    NAVAMSHA: navamshaResult.value!,
    YOGA_LIST: yogaResult.value!,
    _meta: meta,
  };

  return result;
}

function jdToTimeStr(jdUt: number, offsetHours: number): string {
  const utcMs = (jdUt - 2440587.5) * 86400000;
  const localMs = utcMs + offsetHours * 3600000;
  const d = new Date(localMs);
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  const s = d.getUTCSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function isGandanta(chart: CanonicalChart): boolean {
  // §15.3: Moon or Lagna within last 3°20' (3.333°) of Cancer/Scorpio/Pisces
  // or first 3°20' of Aries/Leo/Sagittarius
  const gandantaEnd = ["Cancer", "Scorpio", "Pisces"] as const;
  const gandantaStart = ["Aries", "Leo", "Sagittarius"] as const;
  const GAP = 3.333;

  for (const body of ["Moon", "Lagna"] as const) {
    const pos = body === "Lagna" ? chart.lagna : chart.planets[body];
    const sign = pos.sign;
    const deg = pos.signDegree;

    if (gandantaEnd.some(s => s === sign) && deg >= (30 - GAP)) return true;
    if (gandantaStart.some(s => s === sign) && deg < GAP) return true;
  }
  return false;
}
