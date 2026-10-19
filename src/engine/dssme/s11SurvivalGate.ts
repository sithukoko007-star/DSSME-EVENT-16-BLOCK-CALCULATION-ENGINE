/**
 * S11: CORE SURVIVAL GATE (DISCONTINUITY #1)
 *
 * First and only-so-far irreversible binary elimination.
 *
 * Pre-declaration (MANDATORY, before inspecting any CPS value):
 *   θ_s = f(Regime, Mode)  — supplied from ModeResult (declared at S3)
 *
 * Survive(p) = 1  if CPS_pre_v3(p) ≥ θ_s,  else 0
 * P_S = { p ∈ P_E | CPS_pre_v3(p) ≥ θ_s }
 *
 * Rules:
 *   - θ_s declared BEFORE seeing CPS distribution (Hard Rule 3)
 *   - Uniform across all planets (no planet-specific thresholds)
 *   - Cannot be adjusted after seeing results
 *   - Eliminated planets cannot re-enter
 *   - |P_S| = 0 → ABORT
 *   - DASHA_DIVERGENCE flag if MD lord does not survive
 */

import type { NineBody } from "../../types/dssme-canonical-types.ts";
import type { PlanetCpsFactors } from "./types.ts";

export interface S11Result {
  /** Survivors: all planets with CPS_pre_v3 ≥ θ_s */
  P_S: PlanetCpsFactors[];
  /** Whether P_S is empty (requires ABORT upstream) */
  aborted: boolean;
  /** True if MD lord was eliminated */
  dasha_divergence: boolean;
  dasha_divergence_note?: string;
  warnings: string[];
}

/**
 * Apply the S11 survival gate.
 *
 * @param allCPS      - all planet CPS factors (from computeAllCPS)
 * @param theta_s     - pre-declared survival threshold (from ModeResult, §10 table)
 * @param mdLord      - Mahadasha lord planet (for DASHA_DIVERGENCE check)
 */
export function applyS11SurvivalGate(
  allCPS: PlanetCpsFactors[],
  theta_s: number,
  mdLord: NineBody
): S11Result {
  const warnings: string[] = [];

  // Apply uniform threshold
  const survivors: PlanetCpsFactors[] = [];
  const eliminated: PlanetCpsFactors[] = [];

  for (const pf of allCPS) {
    if (pf.CPS_pre_v3 >= theta_s) {
      survivors.push({ ...pf, survived: true });
    } else {
      eliminated.push({ ...pf, survived: false });
    }
  }

  // DASHA_DIVERGENCE: MD lord eliminated at S11
  const mdSurvived = survivors.some(pf => pf.planet === mdLord);
  const dasha_divergence = !mdSurvived;
  let dasha_divergence_note: string | undefined;

  if (dasha_divergence) {
    dasha_divergence_note = `DASHA_DIVERGENCE - MD lord (${mdLord}) eliminated at survival gate.`;
    warnings.push(dasha_divergence_note);
  }

  // |P_S| = 0 → ABORT
  if (survivors.length === 0) {
    warnings.push(`S11 ABORT: no planets survived threshold θ_s=${theta_s}. Eliminated: ${eliminated.map(p => p.planet).join(", ")}`);
    return {
      P_S: [],
      aborted: true,
      dasha_divergence,
      dasha_divergence_note,
      warnings,
    };
  }

  return {
    P_S: survivors,
    aborted: false,
    dasha_divergence,
    dasha_divergence_note,
    warnings,
  };
}
