/**
 * Step L: GEOMETRY-DEPENDENT PAIR/TRIPLET BIAS MATRIX
 *
 * Builds the full probability distribution over:
 *   - 2D: 100 ordered pairs (00–99)
 *   - 3D: 1000 ordered triplets (000–999)
 *
 * Core formulas (LOCKED):
 *   2D: W(XY) = D_X × D_Y,  S = Σ W(ij) for i,j∈{0..9},  P(XY) = W(XY)/S
 *   3D: W(XYZ) = D_X × D_Y × D_Z,  S = Σ W(ijk) for i,j,k∈{0..9},  P(XYZ) = W(XYZ)/S
 *
 * Checksum: Σ P = 1.0000 (±1e-9 tolerance)
 *
 * Hard rules:
 *   - 2D: All 100 ordered pairs generated — no filtering before normalization
 *   - 3D: All 1000 triplets generated — no filtering, digit repetition permitted
 *   - S = 0 → ABORT, require re-run of Step K
 */

import type { AuthorizedPair, AuthorizedTriplet, DigitVector } from "./types.ts";

// Volatile digit set (§15.2)
const VOLATILE_DIGITS = new Set([0, 4, 7, 9]);

// ============================================================================
// 2D Pair Matrix
// ============================================================================

export interface StepL2DResult {
  all_pairs: AuthorizedPair[];  // all 100 ordered pairs, pre-S15
  volatile_mass_pct: number;
  normalization_sum: number;
  aborted: boolean;
  warnings: string[];
}

export function buildPairMatrix(dv: DigitVector): StepL2DResult {
  const warnings: string[] = [];
  const rawVec = dv.raw;
  const coreDigits = new Set(dv.primaryCluster);

  // Build W(XY) for all 100 ordered pairs
  const pairs: Array<{ pair: string; W: number; D_X: number; D_Y: number }> = [];
  let S = 0;

  for (let x = 0; x <= 9; x++) {
    for (let y = 0; y <= 9; y++) {
      const D_X = rawVec[x.toString()] ?? 0;
      const D_Y = rawVec[y.toString()] ?? 0;
      const W = D_X * D_Y;
      S += W;
      pairs.push({ pair: `${x}${y}`, W, D_X, D_Y });
    }
  }

  if (S === 0) {
    warnings.push("Step L 2D ABORT: normalization sum S=0. Re-run Step K.");
    return { all_pairs: [], volatile_mass_pct: 0, normalization_sum: 0, aborted: true, warnings };
  }

  // Validate checksum
  const checksum = pairs.reduce((acc, p) => acc + (p.W / S), 0);
  if (Math.abs(checksum - 1.0) > 1e-9) {
    warnings.push(`Step L 2D checksum deviation: ${checksum} (expected 1.0000)`);
  }

  // Sort descending by W
  pairs.sort((a, b) => b.W - a.W || a.pair.localeCompare(b.pair));

  // Volatile mass warning
  const volatileMass = Array.from({ length: 10 }, (_, d) => rawVec[d.toString()] ?? 0)
    .filter((_, d) => VOLATILE_DIGITS.has(d))
    .reduce((a, b) => a + b, 0);
  const totalMass = Object.values(rawVec).reduce((a, b) => a + b, 0);
  const volatile_mass_pct = totalMass > 0 ? (volatileMass / totalMass) * 100 : 0;

  if (volatile_mass_pct > 30) {
    warnings.push(`High volatile-digit mass: ${volatile_mass_pct.toFixed(1)}% (>30%) — shift 5–10% stake from Primary to Burst.`);
  } else if (volatile_mass_pct > 25) {
    warnings.push(`Elevated volatile-digit mass: ${volatile_mass_pct.toFixed(1)}% (>25%) — consider Burst window restriction.`);
  }

  // Categorize pairs
  let cumulativeP = 0;
  const all_pairs: AuthorizedPair[] = pairs.map((p, rank) => {
    const P_raw = p.W / S;
    cumulativeP += P_raw;

    const hasVolatile = VOLATILE_DIGITS.has(parseInt(p.pair[0]!)) || VOLATILE_DIGITS.has(parseInt(p.pair[1]!));
    const hasCore = coreDigits.has(parseInt(p.pair[0]!)) || coreDigits.has(parseInt(p.pair[1]!));

    let category: "Primary" | "Secondary" | "Burst" | "Shadow";
    const prevCumP = cumulativeP - P_raw;

    if (rank < 6 || prevCumP < 0.35) {
      // Primary: top pairs until cumP ≥ 0.35 OR 6 pairs
      category = "Primary";
    } else if (prevCumP < 0.85 && rank < 12) {
      // Secondary: cumP 0.70–0.85 OR 10-12 pairs
      category = "Secondary";
    } else if (hasVolatile) {
      category = "Burst";
    } else {
      category = "Shadow";
    }

    // Time gate for volatile/burst pairs
    const time_gate = (category === "Burst" || (category === "Primary" && hasVolatile))
      ? "Rahu/Mars/Moon hora window"
      : null;

    return {
      pair: p.pair,
      P_raw,
      W_raw: p.W,
      D_X: p.D_X,
      D_Y: p.D_Y,
      top_planets_X: [],
      top_planets_Y: [],
      category,
      time_gate,
      notes: hasVolatile ? "volatile-digit pair" : hasCore ? "core-tier pair" : "secondary pair",
      audit_line: `pair=${p.pair} W=${p.W.toFixed(6)} P=${P_raw.toFixed(4)} cat=${category}`,
    };
  });

  return { all_pairs, volatile_mass_pct, normalization_sum: S, aborted: false, warnings };
}

// ============================================================================
// 3D Triplet Tensor
// ============================================================================

export interface StepL3DResult {
  all_triplets: AuthorizedTriplet[];  // all 1000 ordered triplets, pre-S15
  volatile_mass_pct: number;
  normalization_sum: number;
  aborted: boolean;
  warnings: string[];
}

export function buildTripletTensor(dv: DigitVector): StepL3DResult {
  const warnings: string[] = [];
  const rawVec = dv.raw;
  const coreDigits = new Set(dv.primaryCluster);

  // Count non-zero digits
  const nonZeroCount = Object.values(rawVec).filter(v => v > 0).length;
  if (nonZeroCount < 3) {
    warnings.push(`Step L 3D: only ${nonZeroCount} non-zero digits (need ≥3). Triplet space may be degenerate.`);
  }

  // Build W(XYZ) for all 1000 ordered triplets
  const triplets: Array<{
    triplet: string; W: number;
    D_X: number; D_Y: number; D_Z: number;
    volatile_positions: number;
  }> = [];
  let S = 0;

  for (let x = 0; x <= 9; x++) {
    for (let y = 0; y <= 9; y++) {
      for (let z = 0; z <= 9; z++) {
        const D_X = rawVec[x.toString()] ?? 0;
        const D_Y = rawVec[y.toString()] ?? 0;
        const D_Z = rawVec[z.toString()] ?? 0;
        const W = D_X * D_Y * D_Z;
        S += W;
        const volatile_positions =
          (VOLATILE_DIGITS.has(x) ? 1 : 0) +
          (VOLATILE_DIGITS.has(y) ? 1 : 0) +
          (VOLATILE_DIGITS.has(z) ? 1 : 0);
        triplets.push({
          triplet: `${x}${y}${z}`,
          W, D_X, D_Y, D_Z,
          volatile_positions,
        });
      }
    }
  }

  if (S === 0) {
    warnings.push("Step L 3D ABORT: normalization sum S=0. Re-run Step K.");
    return { all_triplets: [], volatile_mass_pct: 0, normalization_sum: 0, aborted: true, warnings };
  }

  // Validate checksum
  const checksum = triplets.reduce((acc, t) => acc + (t.W / S), 0);
  if (Math.abs(checksum - 1.0) > 1e-9) {
    warnings.push(`Step L 3D checksum deviation: ${checksum} (expected 1.0000)`);
  }

  // Volatile mass (3D thresholds: 35% warning, 50% restrict)
  const volatileMass = Array.from({ length: 10 }, (_, d) => rawVec[d.toString()] ?? 0)
    .filter((_, d) => VOLATILE_DIGITS.has(d))
    .reduce((a, b) => a + b, 0);
  const totalMass = Object.values(rawVec).reduce((a, b) => a + b, 0);
  const volatile_mass_pct = totalMass > 0 ? (volatileMass / totalMass) * 100 : 0;

  if (volatile_mass_pct > 50) {
    warnings.push(`CRITICAL volatile mass: ${volatile_mass_pct.toFixed(1)}% (>50%) — Primary compressed to Compact-3 only, full Burst restriction.`);
  } else if (volatile_mass_pct > 35) {
    warnings.push(`High volatile mass: ${volatile_mass_pct.toFixed(1)}% (>35%) — Burst-window restriction required.`);
  }

  // Sort descending by W, tie-break lexicographic ascending
  triplets.sort((a, b) => b.W - a.W || a.triplet.localeCompare(b.triplet));

  // Categorize (3D thresholds)
  let cumulativeP = 0;
  const all_triplets: AuthorizedTriplet[] = triplets.map((t, rank) => {
    const P_raw = t.W / S;
    cumulativeP += P_raw;
    const prevCumP = cumulativeP - P_raw;

    const isAllVolatile = t.volatile_positions === 3;
    const hasMajorVolatile = t.volatile_positions >= 2;
    const hasCore =
      coreDigits.has(parseInt(t.triplet[0]!)) ||
      coreDigits.has(parseInt(t.triplet[1]!)) ||
      coreDigits.has(parseInt(t.triplet[2]!));

    let category: "Primary" | "Secondary" | "Burst" | "Shadow";

    if (rank < 5 || prevCumP < 0.12) {
      category = "Primary";
    } else if (prevCumP < 0.45 && rank < 18) {
      category = "Secondary";
    } else if (hasMajorVolatile) {
      category = "Burst";
    } else {
      category = "Shadow";
    }

    // All-volatile triplets → Burst hora ONLY
    const time_gate = isAllVolatile
      ? "Burst hora ONLY — all-3-volatile-position restriction"
      : (hasMajorVolatile || category === "Burst")
        ? "Rahu/Mars/Moon hora window"
        : null;

    return {
      triplet: t.triplet,
      P_raw,
      W_raw: t.W,
      D_X: t.D_X,
      D_Y: t.D_Y,
      D_Z: t.D_Z,
      top_planets_X: [],
      top_planets_Y: [],
      top_planets_Z: [],
      category,
      volatile_positions: t.volatile_positions,
      time_gate,
      notes: isAllVolatile
        ? "all-volatile triplet — Burst hora only"
        : hasMajorVolatile
          ? "2+ volatile positions"
          : hasCore ? "core-tier triplet" : "secondary triplet",
      audit_line: `triplet=${t.triplet} W=${t.W.toFixed(8)} P=${P_raw.toFixed(6)} cat=${category} vol=${t.volatile_positions}`,
    };
  });

  return { all_triplets, volatile_mass_pct, normalization_sum: S, aborted: false, warnings };
}
