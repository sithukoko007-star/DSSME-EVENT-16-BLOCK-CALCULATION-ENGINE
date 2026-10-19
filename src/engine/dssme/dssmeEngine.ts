/**
 * DSSME Main Orchestrator: S0→S15 Pipeline
 *
 * Runs the complete DSSME deterministic pipeline:
 *   S0-S4: Constitution Layer (Regime, Mode, Eligibility)
 *   Z1-Z4: Zero-Wave Gate
 *   S5-S10: CPS Construction (all continuous, multiplicative, non-eliminative)
 *   S11: Survival Gate (Discontinuity #1)
 *   S12: Field Classification
 *   Step K: Digit Vector Formation
 *   Step L: Pair/Triplet Bias Matrix
 *   S15: Final Authorization (Discontinuity #2)
 *
 * Exactly 2 discontinuities: S11 and S15.
 * All other transformations are continuous, multiplicative, deterministic, non-adaptive.
 */

import type { NineBody } from "../../types/dssme-canonical-types.ts";
import type {
  DssmeRunInput,
  DssmeRunResult,
  DssmeOutput2D,
  DssmeOutput3D,
  DssmeAbortResult,
} from "./types.ts";

import { classifyRegime, selectMode, getEligiblePlanets } from "./s0Phase0.ts";
import { computeZeroWaveGate, reconcileRegime } from "./zeroWaveGate.ts";
import { computeAllCPS, type CpsInputContext } from "./cpsFactors.ts";
import { applyS11SurvivalGate } from "./s11SurvivalGate.ts";
import { classifyField } from "./s12FieldClassification.ts";
import { computeDigitVector } from "./stepK.ts";
import { buildPairMatrix, buildTripletTensor } from "./stepL.ts";
import { authorizeOutput2D, authorizeOutput3D } from "./s15FinalAuth.ts";

/**
 * Run the complete DSSME engine pipeline.
 *
 * Deterministic: same input → same output, always.
 * Non-adaptive: no feedback from outcomes to digit weights, ever.
 */
export function runDssmeEngine(input: DssmeRunInput): DssmeRunResult {
  const { chart, bodyMode, risk, geometry } = input;
  const allWarnings: string[] = [];

  // ============================================================
  // S0–S4: Constitution Layer
  // ============================================================

  // S1: Classify Regime
  const regimeResult = classifyRegime(chart);
  allWarnings.push(...regimeResult.notes);

  // Z1-Z4: Zero-Wave Gate (runs before CPS analysis)
  const zwResult = computeZeroWaveGate(chart);
  allWarnings.push(...zwResult.notes);

  // Reconcile Regime vs ZW_STATE (more restrictive wins)
  const effectiveRegime = reconcileRegime(regimeResult.regime, zwResult.zw_state);

  // If CLOSED → immediate abort
  if (effectiveRegime === "CLOSED" || zwResult.zw_state === "CLOSED") {
    const abortResult: DssmeAbortResult = {
      status: "CLOSED",
      reason: effectiveRegime === "CLOSED"
        ? `Regime=${regimeResult.regime}, ZW_STATE=${zwResult.zw_state} → CLOSED. No output.`
        : `ZW_STATE=CLOSED. No output.`,
      regime: effectiveRegime,
      zw_state: zwResult.zw_state,
      warnings: allWarnings,
    };
    return abortResult;
  }

  // S3: Mode selection — θ_s and k_max declared BEFORE computing CPS (Hard Rules 3 & 4)
  const modeResult = selectMode(effectiveRegime, risk, geometry);

  if (modeResult.mode === "ABORT") {
    const abortResult: DssmeAbortResult = {
      status: "ABORT",
      reason: `Mode=ABORT selected for Regime=${effectiveRegime}, Risk=${risk}`,
      regime: effectiveRegime,
      zw_state: zwResult.zw_state,
      warnings: allWarnings,
    };
    return abortResult;
  }

  // θ_s is now locked — never changes after this point
  const theta_s = modeResult.theta_s;
  const k_max = modeResult.k_max;

  // S4: Eligibility Filter
  const eligiblePlanets = getEligiblePlanets(bodyMode, effectiveRegime, modeResult.mode);

  // ============================================================
  // S5–S10: CPS Construction
  // Build CpsInputContext from chart data
  // ============================================================

  const panchanga = chart.PANCHANGA;
  const identity = chart.IDENTITY;
  const dasha = chart.DASHA;
  const hora = chart.HORA;

  // Build context for CPS computation
  const cpsCtx: CpsInputContext = {
    zw_state: zwResult.zw_state,
    z3AmplifierCount: zwResult.z3.amplifiers.length,
    z3Amplifiers: zwResult.amplifiers,
    tithiIndex: extractTithiIndex(panchanga.tithi_name ?? ""),
    paksha: panchanga.paksha ?? "Shukla",
    weekdayLord: panchanga.weekday_lord ?? resolveWeekdayLord((panchanga as any).weekday ?? "Sun"),
    moonNakshatra: panchanga.nakshatra_name ?? "Ashwini",
    horaLord: (hora?.planet ?? (hora as any)?.current_lord ?? "Sun") as NineBody,
  };

  // Compute CPS for all eligible planets
  const allCPS = computeAllCPS(chart, eligiblePlanets, cpsCtx);

  // ============================================================
  // S11: CORE SURVIVAL GATE (Discontinuity #1)
  // θ_s pre-declared above — cannot change
  // ============================================================

  const mdLord = (dasha.mahadasha_planet ?? "Sun") as NineBody;
  const s11 = applyS11SurvivalGate(allCPS, theta_s, mdLord);
  allWarnings.push(...s11.warnings);

  if (s11.aborted) {
    const abortResult: DssmeAbortResult = {
      status: "ABORT",
      reason: `S11 Survival Gate: no planets survived θ_s=${theta_s}. ABORT.`,
      regime: effectiveRegime,
      zw_state: zwResult.zw_state,
      warnings: allWarnings,
    };
    return abortResult;
  }

  // Build full CPS audit (survivors + eliminated, all with survived flag)
  const allCpsAudit = [
    ...s11.P_S,
    ...allCPS.filter(pf => !s11.P_S.some(s => s.planet === pf.planet))
      .map(pf => ({ ...pf, survived: false })),
  ];

  // ============================================================
  // S12: FIELD CLASSIFICATION
  // ============================================================

  const s12 = classifyField(s11.P_S, chart);

  // ============================================================
  // Step K: DIGIT VECTOR FORMATION
  // ============================================================

  const digitVector = computeDigitVector(s11.P_S, chart);

  // Check if total digit mass = 0 → ABORT
  const totalDigitMass = Object.values(digitVector.raw).reduce((a, b) => a + b, 0);
  if (totalDigitMass === 0) {
    const abortResult: DssmeAbortResult = {
      status: "ABORT",
      reason: "Step K: all digit weights are zero (no digit contributions from survivors). ABORT.",
      regime: effectiveRegime,
      zw_state: zwResult.zw_state,
      warnings: allWarnings,
    };
    return abortResult;
  }

  // ============================================================
  // Step L + S15: Geometry-specific pair/triplet output
  // ============================================================

  const lagnaType = identity.lagna_type ?? "Fixed";
  const volatilityFlagCount = regimeResult.volatilityFlagCount;
  const phaseStressLevel = chart.PHASE_STRESS?.stress_level ?? "LOW";

  if (geometry === "ordered_2_digit") {
    // Step L: 2D pair matrix
    const stepL2D = buildPairMatrix(digitVector);
    allWarnings.push(...stepL2D.warnings);

    if (stepL2D.aborted) {
      const abortResult: DssmeAbortResult = {
        status: "ABORT",
        reason: "Step L 2D: normalization sum S=0. Re-run Step K.",
        regime: effectiveRegime,
        zw_state: zwResult.zw_state,
        warnings: allWarnings,
      };
      return abortResult;
    }

    // S15: Final Authorization
    const s15 = authorizeOutput2D(stepL2D, digitVector, k_max);
    allWarnings.push(...s15.warnings);

    const output: DssmeOutput2D = {
      version: "V3.0",
      geometry: "ordered_2_digit",
      regime: effectiveRegime,
      zw_state: zwResult.zw_state,
      mode: modeResult.mode,
      threshold: theta_s,
      lagna_type: lagnaType,
      volatility_flag_count: volatilityFlagCount,
      phase_stress_level: phaseStressLevel,
      survivors: s11.P_S.map(pf => pf.planet),
      dasha_divergence: s11.dasha_divergence,
      dasha_divergence_note: s11.dasha_divergence_note,
      field_type: s12.fieldType,
      field_type_enriched: s12.fieldTypeEnriched,
      digit_vector: digitVector.raw,
      primary_cluster: digitVector.primaryCluster,
      volatile_digits: digitVector.volatileDigits,
      authorized_pairs: s15.authorized_pairs,
      compact_4: s15.compact_4,
      compact_6: s15.compact_6,
      k_max,
      soft_mode_active: s15.soft_mode_active,
      warnings: allWarnings,
      cps_audit: allCpsAudit,
    };

    return output;

  } else {
    // Step L: 3D triplet tensor
    const stepL3D = buildTripletTensor(digitVector);
    allWarnings.push(...stepL3D.warnings);

    if (stepL3D.aborted) {
      const abortResult: DssmeAbortResult = {
        status: "ABORT",
        reason: "Step L 3D: normalization sum S=0. Re-run Step K.",
        regime: effectiveRegime,
        zw_state: zwResult.zw_state,
        warnings: allWarnings,
      };
      return abortResult;
    }

    // S15: Final Authorization (3D)
    const s15 = authorizeOutput3D(stepL3D, digitVector, k_max);
    allWarnings.push(...s15.warnings);

    // Volatile mass for output
    const volatile_mass_pct = stepL3D.volatile_mass_pct;

    const output: DssmeOutput3D = {
      version: "V3.0-3D",
      geometry: "ordered_3_digit",
      regime: effectiveRegime,
      zw_state: zwResult.zw_state,
      mode: modeResult.mode,
      threshold: theta_s,
      lagna_type: lagnaType,
      volatility_flag_count: volatilityFlagCount,
      phase_stress_level: phaseStressLevel,
      survivors: s11.P_S.map(pf => pf.planet),
      dasha_divergence: s11.dasha_divergence,
      dasha_divergence_note: s11.dasha_divergence_note,
      field_type: s12.fieldType,
      field_type_enriched: s12.fieldTypeEnriched,
      digit_vector_raw: digitVector.raw,
      digit_vector_normalized: digitVector.normalized,
      primary_cluster: digitVector.primaryCluster,
      secondary_cluster: digitVector.secondaryCluster,
      volatile_digits: digitVector.volatileDigits,
      volatile_mass_pct,
      triplet_normalization_sum: stepL3D.normalization_sum,
      authorized_triplets: s15.authorized_triplets,
      compact_3: s15.compact_3,
      compact_5: s15.compact_5,
      compact_10: s15.compact_10,
      k_max,
      soft_mode_active: s15.soft_mode_active,
      warnings: allWarnings,
      cps_audit: allCpsAudit,
    };

    return output;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function extractTithiIndex(tithiName: string): number {
  const match = tithiName.match(/(\d+)/);
  return match ? parseInt(match[1]!, 10) : 8;
}

const WEEKDAY_LORDS: Record<string, NineBody> = {
  Sun: "Sun",   Sunday: "Sun",
  Mon: "Moon",  Monday: "Moon",
  Tue: "Mars",  Tuesday: "Mars",
  Wed: "Mercury", Wednesday: "Mercury",
  Thu: "Jupiter", Thursday: "Jupiter",
  Fri: "Venus", Friday: "Venus",
  Sat: "Saturn", Saturday: "Saturn",
};

function resolveWeekdayLord(weekday: string): NineBody {
  return WEEKDAY_LORDS[weekday] ?? "Sun";
}
