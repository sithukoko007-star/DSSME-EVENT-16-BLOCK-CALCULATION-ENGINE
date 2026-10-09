/**
 * Phase 3 — HOUSES block tests (hand-built chart, no ephemeris).
 */

import assert from "node:assert/strict";
import { buildHousesBlock, createBlockContext, HOUSE_KEYS } from "../../src/engine/blocks/index.ts";
import type { BlockResult } from "../../src/engine/blocks/index.ts";
import type { HousesBlock } from "../../src/types/dssme-canonical-types.ts";
import { HAND_HOUSES_EXPECTED, HAND_JD_UT, corruptChart, makeHandChart } from "./fixtures/handChart.ts";

function expectFailed(result: BlockResult<HousesBlock>, field: string): void {
  assert.equal(result.status, "FAILED_CLOSED");
  assert.equal(result.value, null);
  assert.ok(
    result.issues.some((i) => i.severity === "error" && i.field === field),
    `expected an error issue on "${field}", got ${JSON.stringify(result.issues)}`,
  );
}

export function runHousesBlockTests(): void {
  console.log("Running Phase 3 HOUSES Block Tests...");

  // 1. Happy path equals the HAND-WRITTEN expectation.
  const ctx = createBlockContext(makeHandChart());
  const result = buildHousesBlock(ctx);
  assert.equal(result.blockId, "HOUSES");
  assert.equal(result.status, "OK");
  assert.deepEqual(result.issues, []);
  assert.equal(result.instantJdUt, HAND_JD_UT);
  assert.deepEqual(result.provenance, {
    chart: { ephemeris: "swisseph-wasm", isDegraded: false },
    inputs: ["CanonicalChart"],
    auxSources: [],
  });
  assert.ok(result.value);
  assert.deepEqual(Object.keys(result.value), [...HOUSE_KEYS]);
  for (const key of HOUSE_KEYS) {
    const expected = HAND_HOUSES_EXPECTED[key];
    assert.deepEqual(result.value[key], {
      sign: expected.sign,
      lord: expected.lord,
      occupants: [...expected.occupants],
      type: expected.type,
    });
  }

  // 2. Occupants are emitted in canonical body order regardless of input order.
  const scrambled = makeHandChart();
  scrambled.houses["6"].occupants = ["Ketu", "Sun"];
  const scrambledResult = buildHousesBlock(createBlockContext(scrambled));
  assert.equal(scrambledResult.status, "OK");
  assert.deepEqual(scrambledResult.value?.["6"].occupants, ["Sun", "Ketu"]);

  // 3. Determinism.
  assert.equal(JSON.stringify(buildHousesBlock(ctx)), JSON.stringify(buildHousesBlock(ctx)));

  // 4. Output does not alias the chart (mutating the result cannot corrupt the chart).
  const chart = makeHandChart();
  const aliasResult = buildHousesBlock(createBlockContext(chart));
  aliasResult.value?.["6"].occupants.push("Moon");
  assert.deepEqual(chart.houses["6"].occupants, ["Sun", "Ketu"]);

  // 5. Degraded chart provenance is consumed by a state block and flagged, not rejected.
  const degraded = buildHousesBlock(createBlockContext(makeHandChart("fallback")));
  assert.equal(degraded.status, "OK");
  assert.deepEqual(degraded.provenance.chart, { ephemeris: "fallback", isDegraded: true });

  // 6. FAILED_CLOSED on each invariant violation (severity = error, value = null).
  const wrongType = makeHandChart();
  wrongType.houses["4"].type = "Cadent";
  expectFailed(buildHousesBlock(createBlockContext(wrongType)), "houses.4.type");

  const wrongSign = makeHandChart();
  wrongSign.houses["2"].sign = "Taurus";
  expectFailed(buildHousesBlock(createBlockContext(wrongSign)), "houses.2.sign");

  const wrongLord = makeHandChart();
  wrongLord.houses["5"].lord = "Mars";
  expectFailed(buildHousesBlock(createBlockContext(wrongLord)), "houses.5.lord");

  const strayOccupant = makeHandChart();
  strayOccupant.houses["8"].occupants.push("Saturn");
  const stray = buildHousesBlock(createBlockContext(strayOccupant));
  expectFailed(stray, "houses.8.occupants");
  assert.ok(stray.issues.some((i) => i.field === "houses.occupants.Saturn"), "Saturn now appears twice");

  const duplicated = makeHandChart();
  duplicated.houses["6"].occupants = ["Sun", "Sun", "Ketu"];
  expectFailed(buildHousesBlock(createBlockContext(duplicated)), "houses.6.occupants");

  const missingBody = makeHandChart();
  missingBody.houses["1"].occupants = [];
  expectFailed(buildHousesBlock(createBlockContext(missingBody)), "houses.occupants.Saturn");

  const missingHouse = corruptChart((d) => {
    const houses = d["houses"];
    if (typeof houses === "object" && houses !== null) Reflect.deleteProperty(houses, "3");
  });
  expectFailed(buildHousesBlock(createBlockContext(missingHouse)), "houses.3");

  const badLagna = corruptChart((d) => {
    const lagna = d["lagna"];
    if (typeof lagna === "object" && lagna !== null) Reflect.set(lagna, "sign", "Nonsense");
  });
  expectFailed(buildHousesBlock(createBlockContext(badLagna)), "lagna.sign");

  console.log("✓ Phase 3 HOUSES Block Tests Passed!");
}
