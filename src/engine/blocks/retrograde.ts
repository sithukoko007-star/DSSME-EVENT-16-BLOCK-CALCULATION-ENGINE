/**
 * Block 13 (RETROGRADE) — Level 1, pure projection of CanonicalBodyPosition.isRetrograde.
 *
 * This is a chart-INSTANT speed-sign flag (speedLongitude < 0), NOT a station event.
 * Station events are explicitly out of Phase 3 scope.
 *
 * Source-level alignment (PyJHora @ 48e57d29b47a3143519910a24866758116467485, drik.planets_in_retrograde):
 *   Sun/Moon never retrograde; Mean Rahu/Ketu always retrograde; others retrograde iff speed < 0.
 */

import type { NineBody, RetrogradeBlock } from "../../types/dssme-canonical-types.ts";
import type { BlockContext, BlockIssue, BlockResult } from "./blockTypes.ts";
import { errorIssue, finalizeBlock, mapNineBodies } from "./blockResult.ts";

function validateRetrograde(ctx: BlockContext): BlockIssue[] {
  const { chart } = ctx;
  const issues: BlockIssue[] = [];
  const bodies: readonly NineBody[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
  for (const body of bodies) {
    const planet = chart.planets[body];
    if (!planet) {
      issues.push(errorIssue(`planets.${body}`, `${body} is missing`));
      continue;
    }
    if (typeof planet.isRetrograde !== "boolean") {
      issues.push(errorIssue(`planets.${body}.isRetrograde`, "isRetrograde must be boolean"));
      continue;
    }
    if (body === "Sun" || body === "Moon") {
      if (planet.isRetrograde) issues.push(errorIssue(`planets.${body}.isRetrograde`, `${body} can never be retrograde`));
    } else if (body === "Rahu" || body === "Ketu") {
      if (!planet.isRetrograde) {
        issues.push(errorIssue(`planets.${body}.isRetrograde`, `${body} (mean node) must always be retrograde`));
      }
    } else if (planet.isRetrograde !== planet.speedLongitude < 0) {
      issues.push(
        errorIssue(
          `planets.${body}.isRetrograde`,
          `flag ${planet.isRetrograde} contradicts speedLongitude ${planet.speedLongitude}`,
        ),
      );
    }
  }
  return issues;
}

export function buildRetrogradeBlock(ctx: BlockContext): BlockResult<RetrogradeBlock> {
  const issues = validateRetrograde(ctx);
  const hasError = issues.some((i) => i.severity === "error");
  const value: RetrogradeBlock | null = hasError ? null : mapNineBodies((body) => ctx.chart.planets[body].isRetrograde);
  return finalizeBlock({ blockId: "RETROGRADE", ctx, inputs: ["CanonicalChart"], value, issues });
}
