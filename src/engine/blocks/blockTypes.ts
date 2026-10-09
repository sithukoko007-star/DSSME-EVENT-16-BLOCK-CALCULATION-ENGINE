/**
 * Phase 3 — BlockResult contract.
 *
 * A block is a pure, deterministic builder evaluated at the chart instant:
 *     (BlockContext) -> BlockResult<T>
 * where T is an EXISTING interface from dssme-canonical-types.ts (no parallel output types).
 *
 * BlockResult is deliberately separate from the (future) CanonicalEvent layer: state blocks never
 * call temporal solvers. Governing design: PHASE_3_ARCHITECTURE_DESIGN.md §5.
 *
 * Intentionally ABSENT: wall-clock timestamps, version strings, durations — none may enter
 * deterministic output.
 */

import type {
  CanonicalChart,
  ChartProvenance,
  Dssme16BlockResult,
} from "../../types/dssme-canonical-types.ts";
import type { PanchangaResult } from "../panchanga/panchangaTypes.ts";

/** Key of a block inside Dssme16BlockResult (everything except `_meta`). */
export type BlockId = Exclude<keyof Dssme16BlockResult, "_meta">;

export type IssueSeverity = "error" | "warning";

export interface BlockIssue {
  readonly field: string;
  readonly message: string;
  readonly severity: IssueSeverity;
}

/**
 * OK            — computed, no error issues.
 * DEFAULTED     — a graceful spec-default condition applied (spec §16 rule 18); never an error.
 * FAILED_CLOSED — at least one `error` issue; `value` is null.
 */
export type BlockStatus = "OK" | "DEFAULTED" | "FAILED_CLOSED";

export type BlockInput = BlockId | "CanonicalChart" | "PanchangaResult" | "EventEphemeris";

export type AuxSource = "astronomy-engine:sunrise" | "astronomy-engine:sunset";

export interface BlockProvenance {
  /** Copied verbatim from chart.provenance — never defaulted. */
  readonly chart: {
    readonly ephemeris: ChartProvenance["ephemeris"];
    readonly isDegraded: boolean;
  };
  readonly inputs: readonly BlockInput[];
  /** Auxiliary (non-chart) sources actually used, e.g. sunrise from astronomy-engine. */
  readonly auxSources: readonly AuxSource[];
  /** Present only for blocks that used the Swiss-only EventEphemeris session. */
  readonly temporal?: {
    readonly source: "swisseph-wasm";
    readonly nodeModel: "mean";
    readonly ayanamsa: "Lahiri";
    readonly flags: string;
  };
}

export interface BlockResult<T> {
  readonly blockId: BlockId;
  readonly status: BlockStatus;
  /** null iff status === "FAILED_CLOSED". */
  readonly value: T | null;
  /** Always chart.time.julianDayUt (the chart instant). */
  readonly instantJdUt: number;
  readonly provenance: BlockProvenance;
  readonly issues: readonly BlockIssue[];
}

export interface BlockContext {
  readonly chart: CanonicalChart;
  /** Optional: Level 1 blocks never need it; later blocks that do must check for it. */
  readonly panchanga?: PanchangaResult;
}
