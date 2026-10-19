/**
 * BLOCK_13 — COMBUST
 * Determines combustion status for each classical planet vs. Sun.
 *
 * §3.1 Rule 5 thresholds:
 *   Moon 12°, Mars 17°, Mercury direct 14° / retro 13°,
 *   Jupiter 11°, Venus direct 10° / retro 8°, Saturn 15°
 *
 * Severity: outer 50% of threshold = Mild; inner 50% = Severe.
 * Sun itself is never combust; Rahu/Ketu are never combust.
 */

import type {
  ClassicalPlanet,
  CombustBlock,
  CombustEntry,
  CombustSeverity,
} from "../../types/dssme-canonical-types.ts";
import type { BlockContext, BlockResult } from "../blocks/blockTypes.ts";
import { finalizeBlock } from "../blocks/blockResult.ts";

/** Combustion thresholds in degrees (§3.1 Rule 5). */
const COMBUST_THRESHOLD_DIRECT: Record<ClassicalPlanet, number | null> = {
  Sun: null,  // Sun is never combust
  Moon: 12,
  Mars: 17,
  Mercury: 14,
  Jupiter: 11,
  Venus: 10,
  Saturn: 15,
};

const COMBUST_THRESHOLD_RETRO: Partial<Record<ClassicalPlanet, number>> = {
  Mercury: 13,
  Venus: 8,
};

/** Angular separation between two longitudes (0–180). */
function angularSeparation(lon1: number, lon2: number): number {
  const diff = Math.abs(lon1 - lon2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function computeCombust(
  planet: ClassicalPlanet,
  planetLon: number,
  isRetrograde: boolean,
  sunLon: number
): CombustEntry {
  const threshold = isRetrograde
    ? (COMBUST_THRESHOLD_RETRO[planet] ?? COMBUST_THRESHOLD_DIRECT[planet] ?? null)
    : COMBUST_THRESHOLD_DIRECT[planet];

  if (threshold === null) {
    return { combust: false, sep_deg: null, severity: null };
  }

  const sep = angularSeparation(planetLon, sunLon);

  if (sep >= threshold) {
    return { combust: false, sep_deg: parseFloat(sep.toFixed(4)), severity: null };
  }

  // Combust — determine severity
  // Mild = outer 50% = sep in (threshold/2, threshold)
  // Severe = inner 50% = sep in [0, threshold/2]
  const midpoint = threshold / 2;
  const severity: CombustSeverity = sep <= midpoint ? "Severe" : "Mild";

  return {
    combust: true,
    sep_deg: parseFloat(sep.toFixed(4)),
    severity,
  };
}

export function buildCombustBlock(ctx: BlockContext): BlockResult<CombustBlock> {
  const { chart } = ctx;
  const sunLon = chart.planets.Sun.siderealLongitude;

  const planets: ClassicalPlanet[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];

  const value: CombustBlock = {} as CombustBlock;
  for (const planet of planets) {
    const pos = chart.planets[planet];
    value[planet] = computeCombust(
      planet,
      pos.siderealLongitude,
      pos.isRetrograde,
      sunLon
    );
  }

  return finalizeBlock({
    blockId: "COMBUST",
    ctx,
    inputs: ["CanonicalChart"],
    value,
    issues: [],
  });
}
