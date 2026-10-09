/**
 * Phase 3 — shared helpers for building BlockResult values.
 * Pure, deterministic, no ephemeris access.
 */

import {
  ZODIAC_SIGNS_ARIES_FIRST,
  type CanonicalChart,
  type ChartProvenance,
  type HouseKey,
  type NineBody,
  type ZodiacSign,
} from "../../types/dssme-canonical-types.ts";
import type { PanchangaResult } from "../panchanga/panchangaTypes.ts";
import type {
  BlockContext,
  BlockId,
  BlockInput,
  BlockIssue,
  BlockProvenance,
  BlockResult,
  BlockStatus,
} from "./blockTypes.ts";

const EPHEMERIS_VALUES: readonly ChartProvenance["ephemeris"][] = ["swisseph-wasm", "fallback", "mixed"];

export const HOUSE_KEYS: readonly HouseKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export function errorIssue(field: string, message: string): BlockIssue {
  return { field, message, severity: "error" };
}

export function warningIssue(field: string, message: string): BlockIssue {
  return { field, message, severity: "warning" };
}

/**
 * Builds the context every block consumes. Provenance is MANDATORY and never defaulted:
 * a chart without valid provenance is a precondition failure (same family as the frozen
 * "PROVENANCE_ERROR" in canonicalChart.ts), not a block-level FAILED_CLOSED.
 *
 * A DEGRADED chart (fallback/mixed) is accepted here: state blocks may consume it and carry the flag.
 */
export function createBlockContext(chart: CanonicalChart, panchanga?: PanchangaResult): BlockContext {
  // The type says mandatory; a chart loaded from JSON may violate it at runtime.
  const prov: ChartProvenance | undefined = chart.provenance;
  if (!prov) {
    throw new Error("PROVENANCE_ERROR: CanonicalChart is missing mandatory provenance");
  }
  if (!EPHEMERIS_VALUES.includes(prov.ephemeris)) {
    throw new Error(`PROVENANCE_ERROR: invalid chart provenance ephemeris "${String(prov.ephemeris)}"`);
  }
  if (typeof prov.isDegraded !== "boolean") {
    throw new Error("PROVENANCE_ERROR: chart provenance isDegraded must be boolean");
  }
  const jd: number = chart.time ? chart.time.julianDayUt : Number.NaN;
  if (!Number.isFinite(jd)) {
    throw new Error("INVALID_INPUT: chart.time.julianDayUt must be a finite number");
  }
  return panchanga === undefined ? { chart } : { chart, panchanga };
}

export function provenanceFor(ctx: BlockContext, inputs: readonly BlockInput[]): BlockProvenance {
  const p = ctx.chart.provenance;
  return {
    chart: { ephemeris: p.ephemeris, isDegraded: p.isDegraded },
    inputs: [...inputs],
    auxSources: [],
  };
}

export interface FinalizeArgs<T> {
  readonly blockId: BlockId;
  readonly ctx: BlockContext;
  readonly inputs: readonly BlockInput[];
  readonly value: T | null;
  readonly issues: readonly BlockIssue[];
  /** Set only when a graceful spec-default (never an error) was applied. */
  readonly defaulted?: boolean;
}

/**
 * The single place status is decided:
 *   any error issue          -> FAILED_CLOSED, value null
 *   else spec-default applied -> DEFAULTED
 *   else                      -> OK
 */
export function finalizeBlock<T>(args: FinalizeArgs<T>): BlockResult<T> {
  const hasError = args.issues.some((i) => i.severity === "error");
  const status: BlockStatus = hasError ? "FAILED_CLOSED" : args.defaulted === true ? "DEFAULTED" : "OK";
  if (!hasError && args.value === null) {
    throw new Error(`BLOCK_ERROR: ${args.blockId} produced a null value without an error issue`);
  }
  return {
    blockId: args.blockId,
    status,
    value: hasError ? null : args.value,
    instantJdUt: args.ctx.chart.time.julianDayUt,
    provenance: provenanceFor(args.ctx, args.inputs),
    issues: [...args.issues],
  };
}

/** Typed, ordered builders — no casts. Key insertion order is the canonical order. */
export function mapNineBodies<T>(f: (body: NineBody) => T): Record<NineBody, T> {
  return {
    Sun: f("Sun"),
    Moon: f("Moon"),
    Mars: f("Mars"),
    Mercury: f("Mercury"),
    Jupiter: f("Jupiter"),
    Venus: f("Venus"),
    Saturn: f("Saturn"),
    Rahu: f("Rahu"),
    Ketu: f("Ketu"),
  };
}

export function mapHouseKeys<T>(f: (key: HouseKey) => T): Record<HouseKey, T> {
  return {
    "1": f("1"),
    "2": f("2"),
    "3": f("3"),
    "4": f("4"),
    "5": f("5"),
    "6": f("6"),
    "7": f("7"),
    "8": f("8"),
    "9": f("9"),
    "10": f("10"),
    "11": f("11"),
    "12": f("12"),
  };
}

/** Sign at a (possibly out-of-range / negative) Aries-first index, wrapped modulo 12. */
export function signAt(index: number): ZodiacSign {
  const wrapped = ((index % 12) + 12) % 12;
  const sign = ZODIAC_SIGNS_ARIES_FIRST[wrapped];
  if (sign === undefined) {
    throw new Error(`BLOCK_ERROR: sign index ${index} out of range`);
  }
  return sign;
}

/** House (1..12) of a sign relative to a Lagna sign (whole-sign). Returns null if either sign is invalid. */
export function wholeSignHouse(lagnaSign: ZodiacSign, sign: ZodiacSign): number | null {
  const lagnaIndex = ZODIAC_SIGNS_ARIES_FIRST.indexOf(lagnaSign);
  const signIndex = ZODIAC_SIGNS_ARIES_FIRST.indexOf(sign);
  if (lagnaIndex < 0 || signIndex < 0) return null;
  return ((signIndex - lagnaIndex + 12) % 12) + 1;
}

export type { CanonicalChart };
