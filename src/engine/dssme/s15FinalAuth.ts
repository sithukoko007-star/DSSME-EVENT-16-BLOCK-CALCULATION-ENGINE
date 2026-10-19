/**
 * S15: FINAL AUTHORIZATION (DISCONTINUITY #2)
 *
 * Second and final discontinuity — top-k selection.
 *
 * 2D Algorithm:
 *   1. Sort pairs descending by W_pair
 *   2. Diversity cap: no single digit > 40% of k_max pairs
 *   3. Core participation: ≥ 60% of selected pairs include a Core/Primary-tier digit
 *   4. Select top k_max satisfying both constraints (relax diversity first if needed)
 *   5. Deterministic tie-break: lexicographic by pair code
 *   Soft Mode: top-10 cumulative P < 25% → 50% exposure reduction
 *
 * 3D Algorithm:
 *   1. Sort triplets descending by W(XYZ)
 *   2. Diversity cap: no single digit > 50% of k_max in hundreds OR tens position
 *   3. Core participation: ≥ 60% of triplets include Core-tier digit in at least 1 position
 *   4. Select top k_max satisfying all constraints (relax diversity first if needed)
 *   5. Deterministic tie-break: lexicographic ascending (000–999)
 *   Soft Mode: top-20 cumulative P < 15% → 50% exposure reduction
 */

import type { AuthorizedPair, AuthorizedTriplet } from "./types.ts";
import type { StepL2DResult, StepL3DResult } from "./stepL.ts";
import type { DigitVector } from "./types.ts";

// ============================================================================
// 2D Final Authorization
// ============================================================================

export interface S15_2DResult {
  authorized_pairs: AuthorizedPair[];
  compact_4: string[];
  compact_6: string[];
  k_max: number;
  soft_mode_active: boolean;
  under_filled: boolean;
  warnings: string[];
}

export function authorizeOutput2D(
  stepL: StepL2DResult,
  dv: DigitVector,
  k_max: number
): S15_2DResult {
  const warnings: string[] = [];
  const coreDigits = new Set(dv.primaryCluster);

  if (stepL.aborted) {
    return {
      authorized_pairs: [],
      compact_4: [],
      compact_6: [],
      k_max,
      soft_mode_active: false,
      under_filled: false,
      warnings: ["S15 2D: StepL was aborted, cannot authorize."],
    };
  }

  // Soft Mode check: top-10 cumulative P < 25%
  const top10CumP = stepL.all_pairs
    .slice(0, 10)
    .reduce((sum, p) => sum + p.P_raw, 0);
  const soft_mode_active = top10CumP < 0.25;
  if (soft_mode_active) {
    warnings.push(`Soft Mode active: top-10 cumulative P=${top10CumP.toFixed(4)} < 0.25. 50% exposure reduction recommended.`);
  }

  // Sort all pairs descending by W_raw (already sorted from StepL, but re-sort for safety)
  const sorted = [...stepL.all_pairs].sort((a, b) =>
    b.W_raw - a.W_raw || a.pair.localeCompare(b.pair)
  );

  // Apply constraints: diversity cap (40%) + core participation (60%)
  const diversityCap = Math.ceil(k_max * 0.40);

  function trySelect(relaxDiversity: boolean): { selected: AuthorizedPair[]; under_filled: boolean } {
    const digitCount = new Map<number, number>();
    const selected: AuthorizedPair[] = [];

    for (const pair of sorted) {
      if (selected.length >= k_max) break;

      const d0 = parseInt(pair.pair[0]!);
      const d1 = parseInt(pair.pair[1]!);

      // Diversity cap check
      if (!relaxDiversity) {
        const c0 = digitCount.get(d0) ?? 0;
        const c1 = digitCount.get(d1) ?? 0;
        if (c0 >= diversityCap || c1 >= diversityCap) continue;
      }

      selected.push(pair);
      digitCount.set(d0, (digitCount.get(d0) ?? 0) + 1);
      digitCount.set(d1, (digitCount.get(d1) ?? 0) + 1);
    }

    return { selected, under_filled: selected.length < k_max };
  }

  // Try strict first
  let { selected, under_filled } = trySelect(false);

  // Core participation check: ≥ 60% must include a Core-tier digit
  const coreParticipation = selected.filter(p =>
    coreDigits.has(parseInt(p.pair[0]!)) || coreDigits.has(parseInt(p.pair[1]!))
  ).length;
  const coreRatio = selected.length > 0 ? coreParticipation / selected.length : 0;

  if (coreRatio < 0.60 || under_filled) {
    // Relax diversity cap
    const relaxed = trySelect(true);
    selected = relaxed.selected;
    under_filled = relaxed.under_filled;

    if (under_filled) {
      warnings.push(`S15 2D under-filled: only ${selected.length} of ${k_max} pairs authorized.`);
    } else if (coreRatio < 0.60) {
      warnings.push(`S15 2D diversity cap relaxed: core participation was ${(coreRatio * 100).toFixed(0)}% (needed 60%).`);
    }
  }

  if (under_filled) {
    warnings.push(`under_filled: true — ${selected.length}/${k_max} pairs authorized.`);
  }

  // Enrich authorized pairs with top contributing planets
  const authorizedPairs = selected.map(p => enrichPairWithPlanets(p, dv));

  // Build compact lists
  // Compact-4: top 4 stable pairs (non-volatile primary)
  const stableSelected = authorizedPairs.filter(p =>
    !VOLATILE_DIGITS.has(parseInt(p.pair[0]!)) && !VOLATILE_DIGITS.has(parseInt(p.pair[1]!))
  );
  const compact_4 = stableSelected.slice(0, 4).map(p => p.pair);
  const compact_6 = authorizedPairs
    .filter(p => p.category === "Primary")
    .slice(0, 6)
    .map(p => p.pair);

  return {
    authorized_pairs: authorizedPairs,
    compact_4,
    compact_6,
    k_max,
    soft_mode_active,
    under_filled,
    warnings,
  };
}

// ============================================================================
// 3D Final Authorization
// ============================================================================

export interface S15_3DResult {
  authorized_triplets: AuthorizedTriplet[];
  compact_3: string[];
  compact_5: string[];
  compact_10: string[];
  k_max: number;
  soft_mode_active: boolean;
  under_filled: boolean;
  warnings: string[];
}

export function authorizeOutput3D(
  stepL: StepL3DResult,
  dv: DigitVector,
  k_max: number
): S15_3DResult {
  const warnings: string[] = [];
  const coreDigits = new Set(dv.primaryCluster);

  if (stepL.aborted) {
    return {
      authorized_triplets: [],
      compact_3: [], compact_5: [], compact_10: [],
      k_max,
      soft_mode_active: false,
      under_filled: false,
      warnings: ["S15 3D: StepL was aborted, cannot authorize."],
    };
  }

  // Soft Mode check: top-20 cumulative P < 15% (3D-adjusted)
  const top20CumP = stepL.all_triplets
    .slice(0, 20)
    .reduce((sum, t) => sum + t.P_raw, 0);
  const soft_mode_active = top20CumP < 0.15;
  if (soft_mode_active) {
    warnings.push(`Soft Mode (3D) active: top-20 cumulative P=${top20CumP.toFixed(4)} < 0.15. 50% exposure reduction recommended.`);
  }

  // Sort descending W, tie-break lexicographic ascending
  const sorted = [...stepL.all_triplets].sort((a, b) =>
    b.W_raw - a.W_raw || a.triplet.localeCompare(b.triplet)
  );

  // Diversity cap (3D): no single digit > 50% of k_max in hundreds OR tens position
  const diversityCap = Math.ceil(k_max * 0.50);

  function trySelect3D(relaxDiversity: boolean): { selected: AuthorizedTriplet[]; under_filled: boolean } {
    const hundredsCount = new Map<number, number>();
    const tensCount = new Map<number, number>();
    const selected: AuthorizedTriplet[] = [];

    for (const triplet of sorted) {
      if (selected.length >= k_max) break;

      const d0 = parseInt(triplet.triplet[0]!);
      const d1 = parseInt(triplet.triplet[1]!);

      // All-volatile triplets → Burst hora ONLY (never relax this)
      if (triplet.volatile_positions === 3) {
        // Only include if it would naturally be in Burst category
        if (triplet.category !== "Burst") continue;
      }

      // Diversity cap: hundreds OR tens
      if (!relaxDiversity) {
        const h = hundredsCount.get(d0) ?? 0;
        const t = tensCount.get(d1) ?? 0;
        if (h >= diversityCap || t >= diversityCap) continue;
      }

      selected.push(triplet);
      hundredsCount.set(d0, (hundredsCount.get(d0) ?? 0) + 1);
      tensCount.set(d1, (tensCount.get(d1) ?? 0) + 1);
    }

    return { selected, under_filled: selected.length < k_max };
  }

  // Try strict
  let { selected, under_filled } = trySelect3D(false);

  // Core participation: ≥ 60% include Core-tier digit in at least 1 position
  const coreParticipation = selected.filter(t =>
    coreDigits.has(parseInt(t.triplet[0]!)) ||
    coreDigits.has(parseInt(t.triplet[1]!)) ||
    coreDigits.has(parseInt(t.triplet[2]!))
  ).length;
  const coreRatio = selected.length > 0 ? coreParticipation / selected.length : 0;

  if (coreRatio < 0.60 || under_filled) {
    const relaxed = trySelect3D(true);
    selected = relaxed.selected;
    under_filled = relaxed.under_filled;

    if (under_filled) {
      warnings.push(`S15 3D under-filled: only ${selected.length} of ${k_max} triplets authorized.`);
    }
  }

  if (under_filled) {
    warnings.push(`under_filled: true — ${selected.length}/${k_max} triplets authorized.`);
  }

  // Enrich with top contributing planets
  const authorizedTriplets = selected.map(t => enrichTripletWithPlanets(t, dv));

  // Compact lists
  const compact_3 = authorizedTriplets.slice(0, 3).map(t => t.triplet);
  const compact_5 = authorizedTriplets
    .filter(t => t.category === "Primary")
    .slice(0, 5)
    .map(t => t.triplet);
  const compact_10 = authorizedTriplets
    .filter(t => t.category === "Primary" || t.category === "Secondary")
    .slice(0, 10)
    .map(t => t.triplet);

  return {
    authorized_triplets: authorizedTriplets,
    compact_3,
    compact_5,
    compact_10,
    k_max,
    soft_mode_active,
    under_filled,
    warnings,
  };
}

// ============================================================================
// Helpers: enrich with top planet contributors per digit position
// ============================================================================

const VOLATILE_DIGITS = new Set([0, 4, 7, 9]);

function topPlanetsForDigit(digit: number, dv: DigitVector): string[] {
  const contribs = dv.perPlanetContributions;
  const ranked = Object.entries(contribs)
    .map(([planet, digitMap]) => ({
      planet,
      strength: digitMap[digit.toString()] ?? 0,
    }))
    .filter(x => x.strength > 0)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3)
    .map(x => x.planet);
  return ranked;
}

function enrichPairWithPlanets(pair: AuthorizedPair, dv: DigitVector): AuthorizedPair {
  return {
    ...pair,
    top_planets_X: topPlanetsForDigit(parseInt(pair.pair[0]!), dv),
    top_planets_Y: topPlanetsForDigit(parseInt(pair.pair[1]!), dv),
  };
}

function enrichTripletWithPlanets(triplet: AuthorizedTriplet, dv: DigitVector): AuthorizedTriplet {
  return {
    ...triplet,
    top_planets_X: topPlanetsForDigit(parseInt(triplet.triplet[0]!), dv),
    top_planets_Y: topPlanetsForDigit(parseInt(triplet.triplet[1]!), dv),
    top_planets_Z: topPlanetsForDigit(parseInt(triplet.triplet[2]!), dv),
  };
}
