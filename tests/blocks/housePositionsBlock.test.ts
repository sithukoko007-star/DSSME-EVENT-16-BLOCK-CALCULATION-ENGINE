/**
 * Phase 3 — HOUSE_POSITIONS block tests (hand-built chart, no ephemeris).
 */

import assert from "node:assert/strict";
import { buildHousePositionsBlock, createBlockContext } from "../../src/engine/blocks/index.ts";
import type { HousePositionsBlock } from "../../src/types/dssme-canonical-types.ts";
import { HAND_JD_UT, makeHandChart } from "./fixtures/handChart.ts";

const EXPECTED: HousePositionsBlock = {
  Sun: { house: 6, type: "Cadent" },
  Moon: { house: 9, type: "Cadent" },
  Mars: { house: 4, type: "Angular" },
  Mercury: { house: 7, type: "Angular" },
  Jupiter: { house: 5, type: "Succedent" },
  Venus: { house: 8, type: "Succedent" },
  Saturn: { house: 1, type: "Angular" },
  Rahu: { house: 12, type: "Cadent" },
  Ketu: { house: 6, type: "Cadent" },
};

export function runHousePositionsBlockTests(): void {
  console.log("Running Phase 3 HOUSE_POSITIONS Block Tests...");

  const result = buildHousePositionsBlock(createBlockContext(makeHandChart()));
  assert.equal(result.blockId, "HOUSE_POSITIONS");
  assert.equal(result.status, "OK");
  assert.deepEqual(result.issues, []);
  assert.equal(result.instantJdUt, HAND_JD_UT);
  assert.deepEqual(result.value, EXPECTED);
  // Correct, canonical planet ordering — no reordered output permitted.
  assert.deepEqual(Object.keys(result.value ?? {}), ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"]);

  // Determinism and degraded provenance.
  const ctx = createBlockContext(makeHandChart());
  assert.equal(JSON.stringify(buildHousePositionsBlock(ctx)), JSON.stringify(buildHousePositionsBlock(ctx)));
  const degraded = buildHousePositionsBlock(createBlockContext(makeHandChart("mixed")));
  assert.equal(degraded.status, "OK");
  assert.deepEqual(degraded.provenance.chart, { ephemeris: "mixed", isDegraded: true });

  // Sign / house disagreement => FAILED_CLOSED.
  const wrongHouse = makeHandChart();
  wrongHouse.planets.Saturn.house = 2; // Saturn is in Pisces = Lagna sign = house 1
  const f1 = buildHousePositionsBlock(createBlockContext(wrongHouse));
  assert.equal(f1.status, "FAILED_CLOSED");
  assert.equal(f1.value, null);
  assert.ok(f1.issues.some((i) => i.severity === "error" && i.field === "planets.Saturn.house"));

  // Out-of-range house => FAILED_CLOSED.
  const outOfRange = makeHandChart();
  outOfRange.planets.Moon.house = 13;
  const f2 = buildHousePositionsBlock(createBlockContext(outOfRange));
  assert.equal(f2.status, "FAILED_CLOSED");
  assert.ok(f2.issues.some((i) => i.severity === "error" && i.field === "planets.Moon.house"));

  // Fractional house => FAILED_CLOSED.
  const fractional = makeHandChart();
  fractional.planets.Mars.house = 4.5;
  assert.equal(buildHousePositionsBlock(createBlockContext(fractional)).status, "FAILED_CLOSED");

  // The house TYPE comes from the house number (spec Rule 6), checked for all 12 numbers.
  const angular = [1, 4, 7, 10];
  const succedent = [2, 5, 8, 11];
  const cadent = [3, 6, 9, 12];
  for (let h = 1; h <= 12; h++) {
    const chart = makeHandChart();
    // Put Sun in house h by choosing the matching sign relative to Lagna Pisces (index 11).
    const signs = ["Pisces", "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius"] as const;
    const sign = signs[h - 1];
    assert.ok(sign !== undefined);
    chart.planets.Sun.sign = sign;
    chart.planets.Sun.house = h;
    const r = buildHousePositionsBlock(createBlockContext(chart));
    assert.equal(r.status, "OK", `house ${h}`);
    const expectedType = angular.includes(h) ? "Angular" : succedent.includes(h) ? "Succedent" : cadent.includes(h) ? "Cadent" : "?";
    assert.equal(r.value?.Sun.type, expectedType, `house ${h}`);
  }

  console.log("✓ Phase 3 HOUSE_POSITIONS Block Tests Passed!");
}
