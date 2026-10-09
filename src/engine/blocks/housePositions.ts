/**
 * Block 13 (HOUSE_POSITIONS) — Level 1, pure projection of each body's house + house type.
 * Spec: extraction Rule 6 (Angular 1,4,7,10 / Succedent 2,5,8,11 / Cadent 3,6,9,12).
 */

import type { HousePositionsBlock, NineBody } from "../../types/dssme-canonical-types.ts";
import { getHouseType } from "../astronomy/houses.ts";
import { NINE_BODIES_ORDER } from "../astronomy/planetaryPositions.ts";
import type { BlockContext, BlockIssue, BlockResult } from "./blockTypes.ts";
import { errorIssue, finalizeBlock, mapNineBodies, wholeSignHouse } from "./blockResult.ts";

function validatePositions(ctx: BlockContext): BlockIssue[] {
  const { chart } = ctx;
  const issues: BlockIssue[] = [];
  for (const body of NINE_BODIES_ORDER) {
    const planet = chart.planets[body];
    if (!planet) {
      issues.push(errorIssue(`planets.${body}`, `${body} is missing`));
      continue;
    }
    if (!Number.isInteger(planet.house) || planet.house < 1 || planet.house > 12) {
      issues.push(errorIssue(`planets.${body}.house`, `house must be an integer 1-12, found ${String(planet.house)}`));
      continue;
    }
    const expected = wholeSignHouse(chart.lagna.sign, planet.sign);
    if (expected === null) {
      issues.push(errorIssue(`planets.${body}.sign`, `invalid sign "${String(planet.sign)}" or Lagna sign`));
    } else if (expected !== planet.house) {
      issues.push(
        errorIssue(
          `planets.${body}.house`,
          `${planet.sign} relative to Lagna ${chart.lagna.sign} is house ${expected}, found ${planet.house}`,
        ),
      );
    }
  }
  return issues;
}

export function buildHousePositionsBlock(ctx: BlockContext): BlockResult<HousePositionsBlock> {
  const issues = validatePositions(ctx);
  const hasError = issues.some((i) => i.severity === "error");
  const value: HousePositionsBlock | null = hasError
    ? null
    : mapNineBodies((body: NineBody) => {
        const house = ctx.chart.planets[body].house;
        return { house, type: getHouseType(house) };
      });
  return finalizeBlock({ blockId: "HOUSE_POSITIONS", ctx, inputs: ["CanonicalChart"], value, issues });
}
