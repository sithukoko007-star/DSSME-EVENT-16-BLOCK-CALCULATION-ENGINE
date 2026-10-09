/**
 * Phase 3 — RETROGRADE block tests (hand-built chart, no ephemeris).
 * RETROGRADE is a chart-instant speed-sign flag; it is not a station event.
 */

import assert from "node:assert/strict";
import { buildRetrogradeBlock, createBlockContext } from "../../src/engine/blocks/index.ts";
import type { RetrogradeBlock } from "../../src/types/dssme-canonical-types.ts";
import { HAND_JD_UT, makeHandChart } from "./fixtures/handChart.ts";

const EXPECTED: RetrogradeBlock = {
  Sun: false,
  Moon: false,
  Mars: false,
  Mercury: false,
  Jupiter: false,
  Venus: false,
  Saturn: true,
  Rahu: true,
  Ketu: true,
};

export function runRetrogradeBlockTests(): void {
  console.log("Running Phase 3 RETROGRADE Block Tests...");

  const result = buildRetrogradeBlock(createBlockContext(makeHandChart()));
  assert.equal(result.blockId, "RETROGRADE");
  assert.equal(result.status, "OK");
  assert.deepEqual(result.issues, []);
  assert.equal(result.instantJdUt, HAND_JD_UT);
  assert.deepEqual(result.value, EXPECTED);
  assert.deepEqual(Object.keys(result.value ?? {}), ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"]);

  // Determinism / degraded provenance.
  const ctx = createBlockContext(makeHandChart());
  assert.equal(JSON.stringify(buildRetrogradeBlock(ctx)), JSON.stringify(buildRetrogradeBlock(ctx)));
  const degraded = buildRetrogradeBlock(createBlockContext(makeHandChart("fallback")));
  assert.equal(degraded.status, "OK");
  assert.equal(degraded.provenance.chart.isDegraded, true);

  // A retrograde Mars (negative speed, flag true) is valid.
  const retroMars = makeHandChart();
  retroMars.planets.Mars.speedLongitude = -0.2;
  retroMars.planets.Mars.isRetrograde = true;
  const rm = buildRetrogradeBlock(createBlockContext(retroMars));
  assert.equal(rm.status, "OK");
  assert.equal(rm.value?.Mars, true);

  const expectFailed = (mutate: (c: ReturnType<typeof makeHandChart>) => void, field: string): void => {
    const chart = makeHandChart();
    mutate(chart);
    const r = buildRetrogradeBlock(createBlockContext(chart));
    assert.equal(r.status, "FAILED_CLOSED");
    assert.equal(r.value, null);
    assert.ok(r.issues.some((i) => i.severity === "error" && i.field === field), `${field}: ${JSON.stringify(r.issues)}`);
  };

  // Sun / Moon can never be retrograde.
  expectFailed((c) => { c.planets.Sun.isRetrograde = true; }, "planets.Sun.isRetrograde");
  expectFailed((c) => { c.planets.Moon.isRetrograde = true; }, "planets.Moon.isRetrograde");
  // Mean nodes are always retrograde.
  expectFailed((c) => { c.planets.Rahu.isRetrograde = false; }, "planets.Rahu.isRetrograde");
  expectFailed((c) => { c.planets.Ketu.isRetrograde = false; }, "planets.Ketu.isRetrograde");
  // Flag must agree with the speed sign for the five true planets.
  expectFailed((c) => { c.planets.Mars.isRetrograde = true; }, "planets.Mars.isRetrograde");
  expectFailed((c) => { c.planets.Saturn.speedLongitude = 0.05; }, "planets.Saturn.isRetrograde");

  console.log("✓ Phase 3 RETROGRADE Block Tests Passed!");
}
