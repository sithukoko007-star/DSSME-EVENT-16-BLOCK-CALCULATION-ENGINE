/**
 * BLOCK_13 — SIGN_CLUSTERS
 * Groups planets by occupied sign (only occupied signs appear).
 * §3.1 Rule 10: include sign_index (Ari=0…Pis=11); sav cross-checked
 * against SAV.values[sign_index].
 *
 * SAV is passed in as a parameter (computed after ASHTAKAVARGA block);
 * if unavailable, sav defaults to 0 with a warning.
 */

import type {
  NineBody,
  SignClustersBlock,
  SignClusterEntry,
  ZodiacSign,
} from "../../types/dssme-canonical-types.ts";
import { ZODIAC_SIGNS_ARIES_FIRST } from "../../types/dssme-canonical-types.ts";
import type { BlockContext, BlockResult } from "../blocks/blockTypes.ts";
import { finalizeBlock, warningIssue } from "../blocks/blockResult.ts";
import { NINE_BODIES_ORDER } from "../astronomy/planetaryPositions.ts";

/**
 * Build SIGN_CLUSTERS from canonical chart.
 * @param savValues optional SAV per-sign values (Aries-first, length 12)
 */
export function buildSignClustersBlock(
  ctx: BlockContext,
  savValues?: number[]
): BlockResult<SignClustersBlock> {
  const { chart } = ctx;
  const issues = [];

  // Group all 9 bodies by sign
  const clusterMap = new Map<ZodiacSign, NineBody[]>();

  for (const body of NINE_BODIES_ORDER) {
    const sign = chart.planets[body].sign;
    const existing = clusterMap.get(sign) ?? [];
    existing.push(body);
    clusterMap.set(sign, existing);
  }

  // Build ordered cluster array (by sign_index ascending)
  const clusters: SignClusterEntry[] = [];

  for (const [sign, planets] of clusterMap.entries()) {
    const signIndex = ZODIAC_SIGNS_ARIES_FIRST.indexOf(sign);
    if (signIndex < 0) continue;

    const sav = savValues !== undefined ? (savValues[signIndex] ?? 0) : 0;
    if (savValues === undefined) {
      // Only warn once
    }

    clusters.push({ sign, sign_index: signIndex, planets, sav });
  }

  // Sort by sign_index ascending
  clusters.sort((a, b) => a.sign_index - b.sign_index);

  // Cross-check SAV values
  if (savValues !== undefined) {
    for (const cluster of clusters) {
      const expected = savValues[cluster.sign_index] ?? 0;
      if (cluster.sav !== expected) {
        issues.push(
          warningIssue(
            `SIGN_CLUSTERS[${cluster.sign}].sav`,
            `SAV mismatch: cluster has ${cluster.sav}, SAV.values[${cluster.sign_index}] = ${expected}`
          )
        );
      }
    }
  } else {
    issues.push(
      warningIssue(
        "SIGN_CLUSTERS.sav",
        "SAV values not provided; all cluster SAV values defaulted to 0"
      )
    );
  }

  return finalizeBlock({
    blockId: "SIGN_CLUSTERS",
    ctx,
    inputs: ["CanonicalChart"],
    value: clusters,
    issues,
    defaulted: savValues === undefined,
  });
}
