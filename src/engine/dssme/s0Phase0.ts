/**
 * S0–S4: Constitution Layer (Phase 0)
 *
 * S0 — State Lock: freeze all immutable identity fields
 * S1 — Environmental Gate: classify Regime ∈ {OPEN, DAMPED, CLOSED}
 * S2 — Intent Lock: freeze Objective/Risk/Geometry
 * S3 — Compression Policy: Mode = f(Regime, Risk); declare θ_s and k_max BEFORE CPS
 * S4 — Eligibility Filter: which planets may participate
 *
 * §5 CONTRACT:
 *   - S0 locked before any computation
 *   - CLOSED regime → TERMINATE immediately
 *   - θ_s and k_max declared BEFORE computing CPS (Hard Rules 3 & 4)
 */

import type { Dssme16BlockResult, NineBody } from "../../types/dssme-canonical-types.ts";
import type { Mode, Regime } from "./types.ts";

// ============================================================================
// S1 — Regime classification
// ============================================================================

export interface RegimeResult {
  regime: Regime;
  volatilityFlagCount: number;
  coherence: "HIGH" | "MEDIUM" | "LOW";
  savSpecSum: number;
  savBias: "OPEN" | "NEUTRAL" | "DAMPED";
  notes: string[];
}

export function classifyRegime(chart: Dssme16BlockResult): RegimeResult {
  const panchanga = chart.PANCHANGA;
  const identity = chart.IDENTITY;
  const sav = chart.SAV;
  const notes: string[] = [];

  // Count active volatility flags
  const flags = [
    panchanga.eclipse_proximity,
    panchanga.gandanta_active,
    panchanga.ingress_stacking,
    panchanga.amavasya_zone,
    panchanga.purnima_zone,
  ];
  const flagCount = flags.filter(Boolean).length;

  // Step 1: hard CLOSED at 3+ flags
  if (flagCount >= 3) {
    notes.push(`${flagCount} volatility flags active → CLOSED (hard rule)`);
    return {
      regime: "CLOSED",
      volatilityFlagCount: flagCount,
      coherence: "LOW",
      savSpecSum: sav.spec_sum,
      savBias: "DAMPED",
      notes,
    };
  }

  // Step 2: structural coherence
  const paksha = panchanga.paksha; // "Shukla" or "Krishna"
  const tithiMatch = panchanga.tithi_name ?? "";
  const tithiNum = extractTithiNum(tithiMatch);
  const lagnaType = identity.lagna_type;
  const nakshatra = panchanga.nakshatra_name;
  const gandanta = panchanga.gandanta_active;

  const isShukla = paksha === "Shukla";
  const tithiStable = isShukla ? (tithiNum >= 2 && tithiNum <= 12) : false;
  const tithiUnstable = tithiNum === 1 || tithiNum >= 14;
  const lagnaMovable = lagnaType === "Movable";
  const lagnaFixed = lagnaType === "Fixed";
  const gandantaNak = gandanta;

  let coherence: "HIGH" | "MEDIUM" | "LOW";
  if (isShukla && tithiStable && lagnaMovable && !gandantaNak) {
    coherence = "HIGH";
  } else if (!isShukla && tithiUnstable && lagnaFixed && gandantaNak) {
    coherence = "LOW";
  } else {
    coherence = "MEDIUM";
  }

  // SAV spec_sum bias (§5)
  const specSum = sav.spec_sum;
  let savBias: "OPEN" | "NEUTRAL" | "DAMPED";
  if (specSum > 58) savBias = "OPEN";
  else if (specSum < 48) savBias = "DAMPED";
  else savBias = "NEUTRAL";

  // Step 3: combine coherence + flags + SAV
  let regime: Regime;
  if (coherence === "HIGH" && flagCount <= 1) {
    regime = savBias === "DAMPED" ? "DAMPED" : "OPEN";
    if (savBias === "DAMPED") notes.push("SAV spec_sum < 48 converts OPEN → DAMPED");
  } else if (coherence === "LOW" && flagCount >= 2) {
    regime = "CLOSED";
    notes.push("LOW coherence + 2+ flags → CLOSED");
  } else if (flagCount >= 2) {
    regime = "DAMPED";
    notes.push(`${flagCount} flags → DAMPED`);
  } else {
    regime = "DAMPED"; // default medium
  }

  return {
    regime,
    volatilityFlagCount: flagCount,
    coherence,
    savSpecSum: specSum,
    savBias,
    notes,
  };
}

function extractTithiNum(tithiName: string): number {
  const match = tithiName.match(/(\d+)/);
  return match ? parseInt(match[1]!, 10) : 8; // default stable
}

// ============================================================================
// S3 — Mode selection and threshold/k_max declaration
// ============================================================================

export interface ModeResult {
  mode: Mode;
  theta_s: number;    // survival threshold θ_s
  k_max: number;      // maximum pairs/triplets to authorize
  k_max_2d: number;
  k_max_3d: number;
}

const MODE_TABLE: Record<Regime, Record<string, Mode>> = {
  OPEN: {
    HIGH: "PRECISION",
    MEDIUM: "ACCUMULATION",
    LOW: "ACCUMULATION",
    OBSERVE: "OBSERVATION",
  },
  DAMPED: {
    HIGH: "PRECISION",
    MEDIUM: "ACCUMULATION",
    LOW: "OBSERVATION",
    OBSERVE: "OBSERVATION",
  },
  CLOSED: {
    HIGH: "ABORT",
    MEDIUM: "ABORT",
    LOW: "ABORT",
    OBSERVE: "ABORT",
  },
};

const THETA_S_TABLE: Record<Regime, Record<Mode, number>> = {
  OPEN: {
    ACCUMULATION: 0.45,
    PRECISION: 0.55,
    OBSERVATION: 0.35,
    ABORT: 0,
  },
  DAMPED: {
    ACCUMULATION: 0.55,
    PRECISION: 0.60,
    OBSERVATION: 0.45,
    ABORT: 0,
  },
  CLOSED: {
    ACCUMULATION: 0,
    PRECISION: 0,
    OBSERVATION: 0,
    ABORT: 0,
  },
};

// §7 Step B k_max bands (defaults)
const K_MAX_2D: Record<Mode, number> = {
  PRECISION: 5,       // default in 3–8 band
  ACCUMULATION: 10,   // default in 8–15 band
  OBSERVATION: 20,    // default in 15–25 band
  ABORT: 0,
};
const K_MAX_3D: Record<Mode, number> = {
  PRECISION: 4,       // default in 3–6 band
  ACCUMULATION: 8,    // default in 6–12 band
  OBSERVATION: 15,    // default in 12–20 band
  ABORT: 0,
};

export function selectMode(
  regime: Regime,
  risk: string,
  geometry: string
): ModeResult {
  const mode = MODE_TABLE[regime]?.[risk] ?? "ABORT";
  const theta_s = THETA_S_TABLE[regime]?.[mode] ?? 0;
  const k_max_2d = K_MAX_2D[mode];
  const k_max_3d = K_MAX_3D[mode];
  const k_max = geometry === "ordered_3_digit" ? k_max_3d : k_max_2d;

  return { mode, theta_s, k_max, k_max_2d, k_max_3d };
}

// ============================================================================
// S4 — Eligibility Filter
// ============================================================================

export function getEligiblePlanets(
  bodyMode: "7-body" | "9-body",
  regime: Regime,
  mode: Mode
): NineBody[] {
  const base: NineBody[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  if (bodyMode === "9-body") {
    base.push("Rahu", "Ketu");
  }
  // In ABORT mode, no planets are eligible
  if (mode === "ABORT") return [];
  return base;
}
