/**
 * S12: FIELD CLASSIFICATION
 *
 * Entropy-neutral topology labeling.
 * No amplitude modification — this step only classifies,
 * it never eliminates or reweights.
 *
 * Hard invariant:
 *   Moon is excluded from S12 `n` and `D` (digit-field statistics).
 *   Moon may survive S11, appear in cps_audit, contribute to T̄ and archetype counts.
 *   But P_digit = P_S - {Moon}.
 *
 * Archetype classification (§11):
 *   Expansion: Jupiter, Venus
 *   Trigger:   Mars, Rahu, Sun
 *   Contraction: Saturn, Ketu
 *   Neutral:   Mercury, Moon
 *
 * Classification priority order (first match wins):
 *   1. n ≤ 2       → COMPRESSED
 *   2. n ≤ 4 AND D ≥ 0.30 → STRIKE
 *   3. T̄ < 0.70   → VOLATILE
 *   4. n ≥ 5 AND D < 0.20 → STABLE
 *   5. else        → FRAGMENTED
 */

import type { NineBody } from "../../types/dssme-canonical-types.ts";
import type { Dssme16BlockResult } from "../../types/dssme-canonical-types.ts";
import type { PlanetCpsFactors, S12Result, FieldType, FieldTypeEnriched } from "./types.ts";

// Planet archetype mapping (§11)
const ARCHETYPE: Record<NineBody, "expansion" | "trigger" | "contraction" | "neutral"> = {
  Jupiter: "expansion",
  Venus:   "expansion",
  Mars:    "trigger",
  Rahu:    "trigger",
  Sun:     "trigger",
  Saturn:  "contraction",
  Ketu:    "contraction",
  Mercury: "neutral",
  Moon:    "neutral", // Moon participates in archetype counts over P_S
};

/**
 * Classify the field topology from P_S (survivors from S11).
 *
 * @param P_S   - surviving planet factors (with survived=true), from S11
 * @param chart - the full canonical chart (for SAV enrichment)
 */
export function classifyField(
  P_S: PlanetCpsFactors[],
  chart: Dssme16BlockResult
): S12Result {
  // P_digit = P_S - {Moon}
  const P_digit = P_S.filter(pf => pf.planet !== "Moon");
  const n = P_digit.length;

  // Dominance ratio D over P_digit
  let D = 0;
  if (n > 0) {
    const cpsValues = P_digit.map(pf => pf.CPS_pre_v3);
    const maxCPS = Math.max(...cpsValues);
    const sumCPS = cpsValues.reduce((a, b) => a + b, 0);
    D = sumCPS > 0 ? maxCPS / sumCPS : 0;
  }

  // T̄ = mean(T_v3) over P_S (includes Moon — §22.2 clarification)
  const T_bar = P_S.length > 0
    ? P_S.reduce((sum, pf) => sum + pf.T_v3, 0) / P_S.length
    : 0;

  // Archetype composition over P_S (includes Moon — §22.2)
  const archetype = { expansion: 0, trigger: 0, contraction: 0, neutral: 0 };
  for (const pf of P_S) {
    const a = ARCHETYPE[pf.planet];
    archetype[a]++;
  }

  // Classification (strict priority order — first match wins)
  let fieldType: FieldType;
  if (n <= 2) {
    fieldType = "COMPRESSED";
  } else if (n <= 4 && D >= 0.30) {
    fieldType = "STRIKE";
  } else if (T_bar < 0.70) {
    fieldType = "VOLATILE";
  } else if (n >= 5 && D < 0.20) {
    fieldType = "STABLE";
  } else {
    fieldType = "FRAGMENTED";
  }

  // SAV enrichment label
  const sav = chart.SAV;
  // spec_triangle = SAV_H5 + SAV_H8 + SAV_H11
  // Support both sav_by_house array and canonical SavBlock spec_houses/values
  const savByHouse: number[] = (sav as any).sav_by_house ?? sav.values ?? [];
  const savH5  = sav.spec_houses?.H5?.sav ?? savByHouse[4]  ?? 0;
  const savH8  = sav.spec_houses?.H8?.sav ?? savByHouse[7]  ?? 0;
  const savH11 = sav.spec_houses?.H11?.sav ?? savByHouse[10] ?? 0;
  const specTriangle = sav.spec_triangle ?? (savH5 + savH8 + savH11);

  let fieldTypeEnriched: FieldTypeEnriched = fieldType;

  if (fieldType === "STABLE") {
    if (specTriangle >= 88) fieldTypeEnriched = "STABLE_STRONG";
    else if (specTriangle < 75) fieldTypeEnriched = "STABLE_WEAK";
  } else if (fieldType === "STRIKE") {
    if (savH11 >= 30) fieldTypeEnriched = "STRIKE_GAIN";
    else if (savH11 < 26) fieldTypeEnriched = "STRIKE_BLIND";
  } else if (fieldType === "FRAGMENTED") {
    if (specTriangle < 72) fieldTypeEnriched = "FRAGMENTED_LOW";
  }

  return {
    n,
    D,
    T_bar,
    archetype,
    fieldType,
    fieldTypeEnriched,
    P_digit: P_digit.map(pf => pf.planet),
    P_S: P_S.map(pf => pf.planet),
  };
}
