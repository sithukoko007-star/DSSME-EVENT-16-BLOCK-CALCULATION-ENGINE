/**
 * Canonical Chart Builder
 * The SINGLE SOURCE OF TRUTH for astronomical and geometric data in DSSME.
 * Conforms to DSSME Canonical Architecture
 */

import {
  CanonicalChart,
  DssmeCalculationInput,
} from "../../types/dssme-canonical-types.ts";
import { calculateCanonicalLagna } from "../astronomy/ascendant.ts";
import { getLahiriAyanamsa } from "../astronomy/ayanamsa.ts";
import { buildCanonicalHouses } from "../astronomy/houses.ts";
import { dateToJulianDayUt } from "../astronomy/julianDay.ts";
import { calculateAllCanonicalBodies } from "../astronomy/planetaryPositions.ts";
import { resolveDateTimeToUtc } from "../astronomy/timezone.ts";
import {
  validateCalculationInput,
  validateCanonicalChart,
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
  const ayanamsaValue = await getLahiriAyanamsa(julianDayUt);

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

  // 8. Assemble CanonicalChart
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
  };

  // 9. Schema Validation
  const valResult = validateCanonicalChart(chart);
  if (!valResult.isValid) {
    const issueMessages = valResult.issues.map((i) => `${i.field}: ${i.message}`).join("; ");
    throw new Error(`VALIDATION_ERROR: Canonical chart validation failed: ${issueMessages}`);
  }

  return chart;
}
