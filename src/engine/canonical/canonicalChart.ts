/**
 * Canonical Chart Builder
 * The SINGLE SOURCE OF TRUTH for astronomical and geometric data in DSSME.
 * Conforms to DSSME Canonical Architecture
 */

import {
  CanonicalChart,
  ChartProvenance,
  DssmeCalculationInput,
  NineBody,
} from "../../types/dssme-canonical-types.ts";
import {
  calculateCanonicalLagna,
} from "../astronomy/ascendant.ts";
import {
  getLahiriAyanamsaWithProvenance,
} from "../astronomy/ayanamsa.ts";
import { buildCanonicalHouses } from "../astronomy/houses.ts";
import { dateToJulianDayUt } from "../astronomy/julianDay.ts";
import {
  calculateAllCanonicalBodies,
  NINE_BODIES_ORDER,
} from "../astronomy/planetaryPositions.ts";
import { resolveDateTimeToUtc } from "../astronomy/timezone.ts";
import {
  validateCalculationInput,
  validateCanonicalChart,
  validateAstronomicalConsistency,
} from "./canonicalValidation.ts";

/**
 * Builds the canonical chart from user calculation input.
 * Deterministic: identical input produces identical CanonicalChart output.
 */
export async function generateCanonicalChart(
  rawInput: DssmeCalculationInput
): Promise<CanonicalChart> {
  // 1. Input Validation
  const input = validateCalculationInput(rawInput);

  // 2. Timezone & UTC Resolution
  const timeRes = resolveDateTimeToUtc(input.date, input.time, input.timezoneOffset);

  // 3. Julian Day UT Calculation
  const julianDayUt = dateToJulianDayUt(timeRes.utcDate);

  // 4. Lahiri Ayanamsa Calculation
  const ayanamsaRes = await getLahiriAyanamsaWithProvenance(julianDayUt);
  const ayanamsaValue = ayanamsaRes.value;
  const ayanamsaSource = ayanamsaRes.provenance;

  // 5. Lagna (Ascendant) Calculation
  const lagna = await calculateCanonicalLagna(
    julianDayUt,
    input.latitude,
    input.longitude,
    ayanamsaValue
  );

  // 6. Planetary Positions Calculation (Sun through Ketu)
  const planets = await calculateAllCanonicalBodies(
    julianDayUt,
    ayanamsaValue,
    lagna.sign
  );

  // 7. House Cusps and Occupancy Calculation
  const houses = buildCanonicalHouses(lagna, planets);

  // 8. Ephemeris Provenance Accounting
  const lagnaSource = lagna.provenance || "swisseph-wasm";
  const planetSources: Record<NineBody, "swisseph-wasm" | "fallback"> = {} as any;
  let allSwe = lagnaSource === "swisseph-wasm" && ayanamsaSource === "swisseph-wasm";
  let allFallback = lagnaSource === "fallback" && ayanamsaSource === "fallback";

  for (const body of NINE_BODIES_ORDER) {
    const src = planets[body].provenance || "swisseph-wasm";
    planetSources[body] = src;
    if (src !== "swisseph-wasm") allSwe = false;
    if (src !== "fallback") allFallback = false;
  }

  const overallEphemeris = allSwe ? "swisseph-wasm" : allFallback ? "fallback" : "mixed";
  const isDegraded = overallEphemeris !== "swisseph-wasm";

  const runtimeMetadata = {
    node: typeof process !== "undefined" ? process.version : "browser",
    platform: typeof process !== "undefined" ? process.platform : "browser",
    icu: typeof process !== "undefined" ? process.versions?.icu : undefined,
    tzdata: typeof process !== "undefined" ? (process.versions as any)?.tzdata || "2025c" : "browser",
  };

  const provenance: ChartProvenance = {
    ephemeris: overallEphemeris,
    isDegraded,
    sources: {
      ayanamsa: ayanamsaSource,
      lagna: lagnaSource,
      planets: planetSources,
    },
    runtime: runtimeMetadata,
  };

  // 9. Assemble CanonicalChart
  const chart: CanonicalChart = {
    input,
    time: {
      localIso: timeRes.localIso,
      utcIso: timeRes.utcIso,
      julianDayUt,
      timezoneOffsetHours: input.timezoneOffset,
    },
    location: {
      latitude: input.latitude,
      longitude: input.longitude,
      city: input.timezone.includes("/") ? input.timezone.split("/")[1]?.replace(/_/g, " ") : undefined,
    },
    ayanamsa: {
      name: "Lahiri",
      value: ayanamsaValue,
    },
    lagna,
    planets,
    houses,
    provenance,
  };

  // 10. Layer A: Structural Schema Validation
  const valResult = validateCanonicalChart(chart);
  if (!valResult.isValid) {
    const issueMessages = valResult.issues.map((i) => `${i.field}: ${i.message}`).join("; ");
    throw new Error(`VALIDATION_ERROR: Canonical chart structural validation failed: ${issueMessages}`);
  }

  // 11. Layer B: Astronomical Mathematical Consistency Validation
  const consistencyResult = validateAstronomicalConsistency(chart);
  if (!consistencyResult.isValid) {
    const consistencyMessages = consistencyResult.issues.map((i) => `${i.field}: ${i.message}`).join("; ");
    throw new Error(`VALIDATION_ERROR: Canonical chart astronomical consistency failed: ${consistencyMessages}`);
  }

  return chart;
}
