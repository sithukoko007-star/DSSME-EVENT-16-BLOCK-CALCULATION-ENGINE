/**
 * Deterministic Test Suite: Planetary Positions & Retrograde Status
 */

import assert from "node:assert/strict";
import { calculateCanonicalBody } from "../../src/engine/astronomy/planetaryPositions.ts";

export async function runPlanetaryPositionsTests() {
  console.log("Running Planetary Positions Tests...");

  const jd2026 = 2461299.7291666665;
  const ayanamsa2026 = 24.230181023168825;
  const lagnaSign = "Sagittarius";

  // Test Sun: Expect late Leo (~29°), Direct
  const sun = await calculateCanonicalBody(jd2026, "Sun", ayanamsa2026, lagnaSign);
  assert.equal(sun.body, "Sun");
  assert.equal(sun.sign, "Leo");
  assert(sun.signDegree >= 28 && sun.signDegree <= 30);
  assert.equal(sun.house, 9);
  assert.equal(sun.isRetrograde, false);

  // Test Saturn: Expect mid Pisces (~18°), Retrograde
  const saturn = await calculateCanonicalBody(jd2026, "Saturn", ayanamsa2026, lagnaSign);
  assert.equal(saturn.body, "Saturn");
  assert.equal(saturn.sign, "Pisces");
  assert.equal(saturn.house, 4);
  assert.equal(saturn.isRetrograde, true);
  assert(saturn.speedLongitude < 0);

  // Test Rahu: Expect Aquarius (~4°), Retrograde
  const rahu = await calculateCanonicalBody(jd2026, "Rahu", ayanamsa2026, lagnaSign);
  assert.equal(rahu.body, "Rahu");
  assert.equal(rahu.sign, "Aquarius");
  assert.equal(rahu.house, 3);
  assert.equal(rahu.isRetrograde, true);

  // Test Ketu: Expect Leo (~4°), opposite Rahu by exactly 180°, Retrograde
  const ketu = await calculateCanonicalBody(jd2026, "Ketu", ayanamsa2026, lagnaSign);
  assert.equal(ketu.body, "Ketu");
  assert.equal(ketu.sign, "Leo");
  assert.equal(ketu.house, 9);
  assert.equal(ketu.isRetrograde, true);

  const diff = Math.abs((ketu.siderealLongitude - rahu.siderealLongitude + 360) % 360 - 180);
  assert(diff < 0.001, `Ketu must be exactly 180 degrees from Rahu, difference: ${diff}`);

  console.log("✓ Planetary Positions Tests Passed!");
}
