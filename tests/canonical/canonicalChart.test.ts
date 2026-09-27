/**
 * Deterministic Test Suite: CanonicalChart Builder & Determinism Verification
 */

import assert from "node:assert/strict";
import { generateCanonicalChart } from "../../src/engine/canonical/canonicalChart.ts";
import { validateCanonicalChart } from "../../src/engine/canonical/canonicalValidation.ts";
import { DssmeCalculationInput } from "../../src/types/dssme-canonical-types.ts";

export async function runCanonicalChartTests() {
  console.log("Running CanonicalChart Builder & Determinism Tests...");

  const input: DssmeCalculationInput = {
    date: "2026-09-16",
    time: "14:30:00",
    latitude: 35.65,
    longitude: 139.54,
    timezone: "Asia/Tokyo",
    timezoneOffset: 9,
    ayanamsa: "Lahiri",
    bodyMode: "Full",
    chartMode: "Standard",
  };

  // Run 1
  const chart1 = await generateCanonicalChart(input);

  // Schema validation
  const valResult = validateCanonicalChart(chart1);
  assert.equal(valResult.isValid, true, `Chart validation failed: ${JSON.stringify(valResult.issues)}`);

  // Run 2 (Determinism Verification)
  const chart2 = await generateCanonicalChart(input);

  // Compare every field
  assert.equal(chart1.time.utcIso, chart2.time.utcIso);
  assert.equal(chart1.time.julianDayUt, chart2.time.julianDayUt);
  assert.equal(chart1.ayanamsa.value, chart2.ayanamsa.value);
  assert.equal(chart1.lagna.siderealLongitude, chart2.lagna.siderealLongitude);
  assert.equal(chart1.lagna.sign, chart2.lagna.sign);

  for (const body of ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"] as const) {
    assert.equal(
      chart1.planets[body].siderealLongitude,
      chart2.planets[body].siderealLongitude,
      `Determinism failure for body ${body}`
    );
    assert.equal(
      chart1.planets[body].isRetrograde,
      chart2.planets[body].isRetrograde,
      `Retrograde status mismatch for body ${body}`
    );
    assert.equal(
      chart1.planets[body].house,
      chart2.planets[body].house,
      `House assignment mismatch for body ${body}`
    );
  }

  // Verify pass-through parameters
  assert.equal(chart1.input.bodyMode, "Full");
  assert.equal(chart1.input.chartMode, "Standard");

  console.log("✓ CanonicalChart Builder & Determinism Tests Passed!");
}
