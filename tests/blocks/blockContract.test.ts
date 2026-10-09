/**
 * Phase 3 — BlockResult contract tests (no ephemeris).
 */

import assert from "node:assert/strict";
import {
  createBlockContext,
  errorIssue,
  finalizeBlock,
  mapHouseKeys,
  mapNineBodies,
  provenanceFor,
  signAt,
  warningIssue,
  wholeSignHouse,
} from "../../src/engine/blocks/index.ts";
import { validateAstronomicalConsistency, validateCanonicalChart } from "../../src/engine/canonical/canonicalValidation.ts";
import { HAND_JD_UT, corruptChart, makeHandChart } from "./fixtures/handChart.ts";

export function runBlockContractTests(): void {
  console.log("Running Phase 3 BlockResult Contract Tests...");

  // 0. Fixture sanity: the hand-built chart is a VALID CanonicalChart under the frozen validators.
  const chart = makeHandChart();
  assert.deepEqual(validateCanonicalChart(chart).issues, [], "hand chart must pass structural validation");
  assert.deepEqual(validateAstronomicalConsistency(chart).issues, [], "hand chart must pass consistency validation");

  // 1. Context: provenance is mandatory and never defaulted.
  const ctx = createBlockContext(chart);
  assert.equal(ctx.chart, chart);
  assert.throws(() => createBlockContext(corruptChart((d) => { delete d["provenance"]; })), /PROVENANCE_ERROR/);
  assert.throws(
    () => createBlockContext(corruptChart((d) => { d["provenance"] = { ephemeris: "bogus", isDegraded: false }; })),
    /PROVENANCE_ERROR: invalid chart provenance ephemeris/,
  );
  assert.throws(
    () => createBlockContext(corruptChart((d) => { d["provenance"] = { ephemeris: "swisseph-wasm", isDegraded: "no" }; })),
    /PROVENANCE_ERROR: chart provenance isDegraded must be boolean/,
  );
  assert.throws(
    () => createBlockContext(corruptChart((d) => { d["time"] = { julianDayUt: Number.NaN }; })),
    /INVALID_INPUT/,
  );

  // 2. A DEGRADED chart is accepted by state blocks and carries its flag.
  const degradedCtx = createBlockContext(makeHandChart("fallback"));
  assert.deepEqual(provenanceFor(degradedCtx, ["CanonicalChart"]).chart, { ephemeris: "fallback", isDegraded: true });
  const mixedCtx = createBlockContext(makeHandChart("mixed"));
  assert.equal(provenanceFor(mixedCtx, ["CanonicalChart"]).chart.ephemeris, "mixed", "three-valued provenance is preserved");

  // 3. Status rules live in exactly one place.
  const base = { blockId: "HOUSES", ctx, inputs: ["CanonicalChart"] } as const;
  const failed = finalizeBlock({ ...base, value: { x: 1 }, issues: [errorIssue("f", "boom")] });
  assert.equal(failed.status, "FAILED_CLOSED");
  assert.equal(failed.value, null, "FAILED_CLOSED forces value to null");
  const warned = finalizeBlock({ ...base, value: { x: 1 }, issues: [warningIssue("f", "careful")] });
  assert.equal(warned.status, "OK", "warnings never fail a block");
  assert.deepEqual(warned.value, { x: 1 });
  const defaulted = finalizeBlock({ ...base, value: { x: 1 }, issues: [], defaulted: true });
  assert.equal(defaulted.status, "DEFAULTED");
  const defaultedButError = finalizeBlock({ ...base, value: { x: 1 }, issues: [errorIssue("f", "boom")], defaulted: true });
  assert.equal(defaultedButError.status, "FAILED_CLOSED", "error outranks DEFAULTED");
  assert.throws(() => finalizeBlock({ ...base, value: null, issues: [] }), /BLOCK_ERROR/, "null value without an error is a bug");
  assert.deepEqual(failed.issues.map((i) => i.severity), ["error"]);
  assert.deepEqual(warned.issues.map((i) => i.severity), ["warning"]);

  // 4. Shape: exactly the six contract fields; instant is the chart instant; nothing wall-clock.
  assert.deepEqual(Object.keys(warned), ["blockId", "status", "value", "instantJdUt", "provenance", "issues"]);
  assert.equal(warned.instantJdUt, HAND_JD_UT);
  assert.equal(warned.instantJdUt, chart.time.julianDayUt);
  const json = JSON.stringify(warned);
  assert.ok(!/generatedAt|calculatedAt|timestamp|durationMs/i.test(json), "no wall-clock/duration field may appear");
  assert.deepEqual(warned.provenance.auxSources, []);
  assert.equal("temporal" in warned.provenance, false, "state blocks carry no temporal provenance");

  // 5. Determinism of serialization.
  const again = finalizeBlock({ ...base, value: { x: 1 }, issues: [warningIssue("f", "careful")] });
  assert.equal(JSON.stringify(again), JSON.stringify(warned));

  // 6. Canonical ordering helpers.
  assert.deepEqual(Object.keys(mapNineBodies((b) => b)), ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"]);
  assert.deepEqual(Object.keys(mapHouseKeys((k) => k)), ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);

  // 7. Sign arithmetic (whole-sign), hand-checked: Lagna Pisces -> Pisces=1, Aries=2, Aquarius=12.
  assert.equal(signAt(0), "Aries");
  assert.equal(signAt(12), "Aries");
  assert.equal(signAt(-1), "Pisces");
  assert.equal(wholeSignHouse("Pisces", "Pisces"), 1);
  assert.equal(wholeSignHouse("Pisces", "Aries"), 2);
  assert.equal(wholeSignHouse("Pisces", "Aquarius"), 12);
  assert.equal(wholeSignHouse("Aries", "Pisces"), 12);

  console.log("✓ Phase 3 BlockResult Contract Tests Passed!");
}
