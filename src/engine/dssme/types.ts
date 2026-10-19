/**
 * DSSME Engine Types
 * Internal types for the S0→S15 pipeline.
 * These are NOT part of the frozen dssme-canonical-types.ts.
 */

import type {
  ClassicalPlanet,
  Dssme16BlockResult,
  NineBody,
} from "../../types/dssme-canonical-types.ts";

// ============================================================================
// Pipeline state types
// ============================================================================

export type Regime = "OPEN" | "DAMPED" | "CLOSED";
export type ZwState = "OPEN" | "DAMPED" | "CLOSED";
export type Mode = "PRECISION" | "ACCUMULATION" | "OBSERVATION" | "ABORT";
export type FieldType = "COMPRESSED" | "STRIKE" | "VOLATILE" | "STABLE" | "FRAGMENTED";
export type FieldTypeEnriched =
  | "STABLE_STRONG" | "STABLE_WEAK"
  | "STRIKE_GAIN" | "STRIKE_BLIND"
  | "FRAGMENTED_LOW"
  | FieldType; // fallback = primary label unchanged

// ============================================================================
// Engine input
// ============================================================================

export interface DssmeRunInput {
  /** The fully assembled 16-block DSSME chart result. */
  chart: Dssme16BlockResult;
  /** Body mode — 7 classical or 9 bodies. */
  bodyMode: "7-body" | "9-body";
  /** Single explicit goal (e.g. "short-cycle speculative extraction"). */
  objective: string;
  /** Risk posture declared by operator. */
  risk: "LOW" | "MEDIUM" | "HIGH" | "OBSERVE";
  /** Geometry: 2D pair (00–99) or 3D triplet (000–999). */
  geometry: "ordered_2_digit" | "ordered_3_digit";
}

// ============================================================================
// Per-planet CPS factors (for audit output)
// ============================================================================

export interface PlanetCpsFactors {
  planet: NineBody;
  RS: number;          // raw Shadbala virupas
  S: number;           // RS / max(RS)
  KIF: number;
  DIF: number;
  AIF: number;
  CIF: number;
  YIF: number;
  SIF_v3: number;
  ZC: number;
  PC: number;
  VR: number;
  SS_dignity: number;
  SS_house: number;
  SS_bav: number;
  SS_nav: number;
  T_v3: number;
  RB: number;
  D: number;           // PAS_D
  C: number;           // PAS_C
  R: number;           // PAS_R
  I_aspect: number;
  H: number;           // PAS_H
  DCF: number;
  PAS_v3: number;
  DLR: number;
  TF: number;
  NF: number;
  HP: number;
  TM_v3: number;
  BHF: number;
  DRF: number;
  VGF: number;
  CPS_pre_v3: number;
  survived: boolean;
  warnings: string[];
}

// ============================================================================
// S12 field classification
// ============================================================================

export interface S12Result {
  n: number;           // |P_digit|
  D: number;           // dominance ratio
  T_bar: number;       // mean T_v3 over P_S
  archetype: {
    expansion: number;
    trigger: number;
    contraction: number;
    neutral: number;
  };
  fieldType: FieldType;
  fieldTypeEnriched: FieldTypeEnriched;
  P_digit: NineBody[];
  P_S: NineBody[];
}

// ============================================================================
// Step K: Digit vector
// ============================================================================

export interface DigitVector {
  raw: Record<string, number>;      // "0".."9" → strength
  normalized: Record<string, number>;
  primaryCluster: number[];
  secondaryCluster: number[];
  volatileDigits: number[];
  shadowDigits: number[];
  perPlanetContributions: Record<string, Record<string, number>>; // planet → digit → contribution
}

// ============================================================================
// Step L / S15: Authorized pairs/triplets
// ============================================================================

export interface AuthorizedPair {
  pair: string;        // "XY" e.g. "47"
  P_raw: number;       // P(XY) = W(XY) / S
  W_raw: number;
  D_X: number;
  D_Y: number;
  top_planets_X: string[];
  top_planets_Y: string[];
  category: "Primary" | "Secondary" | "Burst" | "Shadow";
  time_gate: string | null;
  notes: string;
  audit_line: string;
}

export interface AuthorizedTriplet {
  triplet: string;     // "XYZ" e.g. "479"
  P_raw: number;
  W_raw: number;
  D_X: number;
  D_Y: number;
  D_Z: number;
  top_planets_X: string[];
  top_planets_Y: string[];
  top_planets_Z: string[];
  category: "Primary" | "Secondary" | "Burst" | "Shadow";
  volatile_positions: number;
  time_gate: string | null;
  notes: string;
  audit_line: string;
}

// ============================================================================
// Engine output (per §17 JSON schema)
// ============================================================================

export interface DssmeOutput2D {
  version: "V3.0";
  geometry: "ordered_2_digit";
  regime: Regime;
  zw_state: ZwState;
  mode: Mode;
  threshold: number;
  lagna_type: string;
  volatility_flag_count: number;
  phase_stress_level: string;
  survivors: NineBody[];
  dasha_divergence: boolean;
  dasha_divergence_note?: string;
  field_type: FieldType;
  field_type_enriched: FieldTypeEnriched;
  digit_vector: Record<string, number>;
  primary_cluster: number[];
  volatile_digits: number[];
  authorized_pairs: AuthorizedPair[];
  compact_4: string[];
  compact_6: string[];
  k_max: number;
  soft_mode_active: boolean;
  warnings: string[];
  cps_audit: PlanetCpsFactors[];
}

export interface DssmeOutput3D {
  version: "V3.0-3D";
  geometry: "ordered_3_digit";
  regime: Regime;
  zw_state: ZwState;
  mode: Mode;
  threshold: number;
  lagna_type: string;
  volatility_flag_count: number;
  phase_stress_level: string;
  survivors: NineBody[];
  dasha_divergence: boolean;
  dasha_divergence_note?: string;
  field_type: FieldType;
  field_type_enriched: FieldTypeEnriched;
  digit_vector_raw: Record<string, number>;
  digit_vector_normalized: Record<string, number>;
  primary_cluster: number[];
  secondary_cluster: number[];
  volatile_digits: number[];
  volatile_mass_pct: number;
  triplet_normalization_sum: number;
  authorized_triplets: AuthorizedTriplet[];
  compact_3: string[];
  compact_5: string[];
  compact_10: string[];
  k_max: number;
  soft_mode_active: boolean;
  warnings: string[];
  cps_audit: PlanetCpsFactors[];
  digit_graph_html?: string;
}

export type DssmeOutput = DssmeOutput2D | DssmeOutput3D;

// ============================================================================
// Abort / closed result
// ============================================================================

export interface DssmeAbortResult {
  status: "ABORT" | "CLOSED";
  reason: string;
  regime: Regime;
  zw_state?: ZwState;
  warnings: string[];
}

export type DssmeRunResult = DssmeOutput | DssmeAbortResult;

export function isAbort(r: DssmeRunResult): r is DssmeAbortResult {
  return "status" in r && ("status" in r) && (r as DssmeAbortResult).status !== undefined;
}
