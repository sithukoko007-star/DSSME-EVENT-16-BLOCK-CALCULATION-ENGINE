/**
 * BLOCK_7 — BHAVA_BALA
 * Bhava Bala (house strength) for each of the 12 houses.
 *
 * Three components:
 *   1. Bhavadhipati Bala (lord's contribution) — proportional to lord's Shadbala
 *   2. Bhava Drishti Bala (aspect on house) — from ASPECTS_BHAVAS
 *   3. Bhava Digbala (directional strength of house) — angular/succedent/cadent
 *
 * CRITICAL: Bhava Bala NEVER enters the Shadbala RS(p) sum.
 * It only enters the pipeline as the BHF multiplier in S10b (§9.1).
 */

import type {
  BhavaBalaBlock,
  BhavaBalaEntry,
  ClassicalPlanet,
  HouseKey,
  ZodiacSign,
} from "../../types/dssme-canonical-types.ts";
import type { BlockContext, BlockResult } from "../blocks/blockTypes.ts";
import { HOUSE_KEYS, finalizeBlock, mapHouseKeys, warningIssue } from "../blocks/blockResult.ts";

// Bhava Digbala: Angular=60, Succedent=30, Cadent=15 (same as Kendradi Bala)
function bhavaDig(houseNumber: number): number {
  const angular = [1, 4, 7, 10];
  const succedent = [2, 5, 8, 11];
  if (angular.includes(houseNumber)) return 60;
  if (succedent.includes(houseNumber)) return 30;
  return 15;
}

export interface BhavaBalaInput {
  /** Shadbala total_virupas for each lord (length 7, Sun..Saturn order). */
  shadbalaTotals: number[];
  /** Aspect scores on each bhava (1–12); use ASPECTS_BHAVAS if available. */
  bhavaAspectScores?: Partial<Record<HouseKey, number>>;
}

export function buildBhavaBalaBlock(
  ctx: BlockContext,
  input: BhavaBalaInput
): BlockResult<BhavaBalaBlock> {
  const { chart } = ctx;
  const issues = [];
  const defaulted = !input.bhavaAspectScores;

  if (defaulted) {
    issues.push(
      warningIssue("BHAVA_BALA.drishti", "Aspect scores not provided; Drishti Bala defaulted to 0")
    );
  }

  // Map lord → Shadbala virupas (from total_virupas array, Sun..Saturn order)
  const lordToVirupas: Record<ClassicalPlanet, number> = {
    Sun: input.shadbalaTotals[0] ?? 0,
    Moon: input.shadbalaTotals[1] ?? 0,
    Mars: input.shadbalaTotals[2] ?? 0,
    Mercury: input.shadbalaTotals[3] ?? 0,
    Jupiter: input.shadbalaTotals[4] ?? 0,
    Venus: input.shadbalaTotals[5] ?? 0,
    Saturn: input.shadbalaTotals[6] ?? 0,
  };

  const value: BhavaBalaBlock = mapHouseKeys((key: HouseKey): BhavaBalaEntry => {
    const n = parseInt(key, 10);
    const house = chart.houses[key];
    const sign: ZodiacSign = house.sign;

    // Bhavadhipati Bala: lord's total virupas / 100 (scale to reasonable range)
    const lord = house.lord;
    const lordVirupas = lordToVirupas[lord] ?? 0;
    const lord_contrib = parseFloat((lordVirupas * 0.5).toFixed(2)); // scale factor

    // Bhava Drishti Bala
    const drishti = parseFloat((input.bhavaAspectScores?.[key] ?? 0).toFixed(2));

    // Bhava Digbala
    const digStrength = bhavaDig(n);

    const total = parseFloat((lord_contrib + drishti + digStrength).toFixed(2));

    return { sign, lord_contrib, drishti, total };
  });

  // Warn if all-zero (V3 BHF will default to 1.00)
  const allZero = Object.values(value).every(e => (e as BhavaBalaEntry).total === 0);
  if (allZero) {
    issues.push(warningIssue("BHAVA_BALA.total", "All Bhava Bala totals are zero; BHF will default to 1.00"));
  }

  return finalizeBlock({
    blockId: "BHAVA_BALA",
    ctx,
    inputs: ["CanonicalChart"],
    value,
    issues,
    defaulted,
  });
}
