/**
 * Block 5 — HOUSES (Level 1, pure projection of CanonicalChart.houses).
 *
 * No new astronomy and no Jyotish calculation: whole-sign houses come from the frozen Phase 1
 * builder. This module projects CanonicalHouse -> HouseEntry and independently re-validates
 * the spec invariants (sign sequence, lord, type, occupant coherence).
 */

import type {
  CanonicalHouse,
  HouseEntry,
  HouseKey,
  HousesBlock,
  NineBody,
} from "../../types/dssme-canonical-types.ts";
import { getHouseType } from "../astronomy/houses.ts";
import { NINE_BODIES_ORDER, SIGN_LORDS } from "../astronomy/planetaryPositions.ts";
import type { BlockContext, BlockIssue, BlockResult } from "./blockTypes.ts";
import {
  HOUSE_KEYS,
  errorIssue,
  finalizeBlock,
  mapHouseKeys,
  signAt,
} from "./blockResult.ts";
import { ZODIAC_SIGNS_ARIES_FIRST } from "../../types/dssme-canonical-types.ts";

function canonicalOccupants(occupants: readonly NineBody[]): NineBody[] {
  return NINE_BODIES_ORDER.filter((body) => occupants.includes(body));
}

function validateHouses(ctx: BlockContext): BlockIssue[] {
  const { chart } = ctx;
  const issues: BlockIssue[] = [];

  const lagnaIndex = ZODIAC_SIGNS_ARIES_FIRST.indexOf(chart.lagna.sign);
  if (lagnaIndex < 0) {
    issues.push(errorIssue("lagna.sign", `invalid Lagna sign "${String(chart.lagna.sign)}"`));
    return issues;
  }

  const appearances = new Map<NineBody, number>();

  for (const key of HOUSE_KEYS) {
    const house: CanonicalHouse | undefined = chart.houses[key];
    if (!house) {
      issues.push(errorIssue(`houses.${key}`, `house ${key} is missing`));
      continue;
    }
    const n = Number(key);

    const expectedSign = signAt(lagnaIndex + n - 1);
    if (house.sign !== expectedSign) {
      issues.push(
        errorIssue(`houses.${key}.sign`, `expected ${expectedSign} (Lagna + ${n - 1}), found ${String(house.sign)}`),
      );
    }

    const expectedLord = SIGN_LORDS[house.sign];
    if (expectedLord === undefined) {
      issues.push(errorIssue(`houses.${key}.lord`, `no sign lord defined for "${String(house.sign)}"`));
    } else if (house.lord !== expectedLord) {
      issues.push(errorIssue(`houses.${key}.lord`, `expected ${expectedLord}, found ${String(house.lord)}`));
    }

    const expectedType = getHouseType(n);
    if (house.type !== expectedType) {
      issues.push(errorIssue(`houses.${key}.type`, `expected ${expectedType}, found ${String(house.type)}`));
    }

    if (new Set(house.occupants).size !== house.occupants.length) {
      issues.push(errorIssue(`houses.${key}.occupants`, "duplicate occupant"));
    }
    for (const occupant of house.occupants) {
      const planet = chart.planets[occupant];
      if (!planet) {
        issues.push(errorIssue(`houses.${key}.occupants`, `unknown occupant "${String(occupant)}"`));
        continue;
      }
      if (planet.house !== n) {
        issues.push(
          errorIssue(`houses.${key}.occupants`, `${occupant} is listed in house ${n} but planet.house is ${planet.house}`),
        );
      }
      appearances.set(occupant, (appearances.get(occupant) ?? 0) + 1);
    }
  }

  for (const body of NINE_BODIES_ORDER) {
    const count = appearances.get(body) ?? 0;
    if (count !== 1) {
      issues.push(errorIssue(`houses.occupants.${body}`, `${body} must appear in exactly one house, found ${count}`));
    }
  }
  return issues;
}

function entryFor(ctx: BlockContext, key: HouseKey): HouseEntry {
  const house = ctx.chart.houses[key];
  return {
    sign: house.sign,
    lord: house.lord,
    occupants: canonicalOccupants(house.occupants),
    type: house.type,
  };
}

export function buildHousesBlock(ctx: BlockContext): BlockResult<HousesBlock> {
  const issues = validateHouses(ctx);
  const hasError = issues.some((i) => i.severity === "error");
  const value: HousesBlock | null = hasError ? null : mapHouseKeys((key) => entryFor(ctx, key));
  return finalizeBlock({ blockId: "HOUSES", ctx, inputs: ["CanonicalChart"], value, issues });
}
