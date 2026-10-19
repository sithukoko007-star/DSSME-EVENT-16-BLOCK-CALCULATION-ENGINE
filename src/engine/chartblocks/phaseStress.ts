/**
 * BLOCK_14 — PHASE_STRESS
 * Derives phase stress from Moon/Sun proximity and ingress data.
 *
 * §6 Z-4 Phase Stress rules:
 *   new_moon_proximity_hrs  < 24  → HIGH stress (CLOSED pressure)
 *   new_moon_proximity_hrs 24–48  → MEDIUM stress (DAMPED pressure)
 *   new_moon_proximity_hrs 48–72  → LOW stress (note only)
 *   full_moon_proximity_hrs < 24  → HIGH distortion (DAMPED/CLOSED)
 *   full_moon_proximity_hrs 24–72 → LOW distortion (note only)
 *   len(ingress_within_24h) ≥ 2   → ingress cliff (DAMPED pressure)
 *   len(sign_boundary_planets) ≥ 3 → transition boundary (DAMPED)
 *   all fields empty/zero          → no phase stress
 *
 * §3.1 Rule 9 derivation:
 *   - new_moon/full_moon proximity: hours to/from nearest event (0 if >72h)
 *   - ingress_within_24h: planets changing sign within 24h of chart time
 *   - sign_boundary_planets: within 1° of sign edge
 *   - stress_level: NONE/LOW/MEDIUM/HIGH
 */

import type {
  NineBody,
  PhaseStressBlock,
  StressLevel,
} from "../../types/dssme-canonical-types.ts";
import { ZODIAC_SIGNS_ARIES_FIRST } from "../../types/dssme-canonical-types.ts";
import type { BlockContext, BlockIssue, BlockResult } from "../blocks/blockTypes.ts";
import { finalizeBlock, warningIssue } from "../blocks/blockResult.ts";
import { NINE_BODIES_ORDER } from "../astronomy/planetaryPositions.ts";

const HOURS_PER_DAY = 24;
const JD_PER_HOUR = 1 / 24;

/**
 * Compute Moon-Sun elongation (0–360) from sidereal longitudes.
 * Amavasya (New Moon) ≈ 0° or 360°; Purnima (Full Moon) ≈ 180°.
 */
function moonSunElongation(moonLon: number, sunLon: number): number {
  return ((moonLon - sunLon) + 360) % 360;
}

/**
 * Hours to/from nearest new moon (elongation ≈ 0° / 360°).
 * Uses lunar speed ≈ 12.2° per day = 0.508°/hr.
 * Returns 0 if the nearest event is more than 72h away.
 */
function hoursToNewMoon(elongation: number): number {
  const LUNAR_SPEED_DEG_PER_HOUR = 12.2 / HOURS_PER_DAY;
  // Distance to 0° (new moon) going forward or backward
  const distForward = elongation === 0 ? 0 : 360 - elongation;
  const distBackward = elongation;
  const minDist = Math.min(distForward, distBackward);
  const hrs = minDist / LUNAR_SPEED_DEG_PER_HOUR;
  return hrs > 72 ? 0 : parseFloat(hrs.toFixed(1));
}

/**
 * Hours to/from nearest full moon (elongation ≈ 180°).
 * Returns 0 if the nearest event is more than 72h away.
 */
function hoursToFullMoon(elongation: number): number {
  const LUNAR_SPEED_DEG_PER_HOUR = 12.2 / HOURS_PER_DAY;
  const distToFull = Math.abs(elongation - 180);
  const hrs = distToFull / LUNAR_SPEED_DEG_PER_HOUR;
  return hrs > 72 ? 0 : parseFloat(hrs.toFixed(1));
}

/**
 * Planets within 1° of a sign boundary (signDegree < 1° or > 29°).
 */
function signBoundaryPlanets(ctx: BlockContext): NineBody[] {
  const { chart } = ctx;
  const result: NineBody[] = [];
  for (const body of NINE_BODIES_ORDER) {
    const deg = chart.planets[body].signDegree;
    if (deg < 1.0 || deg > 29.0) {
      result.push(body);
    }
  }
  return result;
}

/**
 * Planets changing sign within 24h.
 * Approximated by: distance to sign boundary / planetary speed.
 * Returns list of planet names that are within 24h of a sign change.
 */
function ingressWithin24h(ctx: BlockContext): NineBody[] {
  const { chart } = ctx;
  const result: NineBody[] = [];

  for (const body of NINE_BODIES_ORDER) {
    const pos = chart.planets[body];
    const speed = Math.abs(pos.speedLongitude); // deg/day
    if (speed <= 0) continue;

    // Distance to sign boundary
    const degInSign = pos.signDegree;
    const distToEnd = pos.isRetrograde ? degInSign : (30 - degInSign);
    const daysToIngress = distToEnd / speed;
    const hoursToIngress = daysToIngress * HOURS_PER_DAY;

    if (hoursToIngress <= 24) {
      result.push(body);
    }
  }
  return result;
}

/**
 * Determine stress_level from the computed fields per Z-4 rules.
 */
function computeStressLevel(
  newMoonHrs: number,
  fullMoonHrs: number,
  ingressCount: number,
  boundaryCount: number
): StressLevel {
  if (newMoonHrs > 0 && newMoonHrs < 24) return "HIGH";
  if (fullMoonHrs > 0 && fullMoonHrs < 24) return "HIGH";
  if (newMoonHrs >= 24 && newMoonHrs <= 48) return "MEDIUM";
  if (fullMoonHrs >= 24 && fullMoonHrs <= 72) return "LOW";
  if (ingressCount >= 2) return "MEDIUM";
  if (boundaryCount >= 3) return "MEDIUM";
  if (newMoonHrs >= 48 && newMoonHrs <= 72) return "LOW";
  if (ingressCount >= 1 || boundaryCount >= 1) return "LOW";
  return "NONE";
}

export function buildPhaseStressBlock(ctx: BlockContext): BlockResult<PhaseStressBlock> {
  const { chart } = ctx;
  const issues: BlockIssue[] = [];

  const moonLon = chart.planets.Moon.siderealLongitude;
  const sunLon = chart.planets.Sun.siderealLongitude;
  const elongation = moonSunElongation(moonLon, sunLon);

  const newMoonHrs = hoursToNewMoon(elongation);
  const fullMoonHrs = hoursToFullMoon(elongation);

  const ingress = ingressWithin24h(ctx);
  const boundary = signBoundaryPlanets(ctx);

  const stressLevel = computeStressLevel(newMoonHrs, fullMoonHrs, ingress.length, boundary.length);

  const value: PhaseStressBlock = {
    new_moon_proximity_hrs: newMoonHrs,
    full_moon_proximity_hrs: fullMoonHrs,
    ingress_within_24h: ingress,
    sign_boundary_planets: boundary,
    stress_level: stressLevel,
  };

  return finalizeBlock({
    blockId: "PHASE_STRESS",
    ctx,
    inputs: ["CanonicalChart"],
    value,
    issues,
  });
}
