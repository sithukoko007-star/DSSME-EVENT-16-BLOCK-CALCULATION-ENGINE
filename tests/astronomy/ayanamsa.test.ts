/**
 * Deterministic Test Suite: Lahiri Ayanamsa
 */

import assert from "node:assert/strict";
import { formatDms, getLahiriAyanamsa } from "../../src/engine/astronomy/ayanamsa.ts";

export async function runAyanamsaTests() {
  console.log("Running Lahiri Ayanamsa Tests...");

  // Benchmark J2000.0: standard Lahiri Ayanamsa is approximately 23.857° (23°51'25.5")
  const jd2000 = 2451545.0;
  const ayanamsa2000 = await getLahiriAyanamsa(jd2000);
  assert(
    Math.abs(ayanamsa2000 - 23.857) < 0.05,
    `J2000 ayanamsa should be ~23.857°, received: ${ayanamsa2000}`
  );

  // Benchmark 2026-09-16 05:30:00 UT (JD 2461299.7291666665)
  const jd2026 = 2461299.7291666665;
  const ayanamsa2026 = await getLahiriAyanamsa(jd2026);
  assert(
    Math.abs(ayanamsa2026 - 24.230) < 0.05,
    `2026 ayanamsa should be ~24.230°, received: ${ayanamsa2026}`
  );

  // Formatting DMS check
  const dms = formatDms(24.23018);
  assert.equal(dms, "24°13'49\"");

  console.log("✓ Lahiri Ayanamsa Tests Passed!");
}
