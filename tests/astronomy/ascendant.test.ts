/**
 * Deterministic Test Suite: Ascendant (Lagna) & Houses
 */

import assert from "node:assert/strict";
import {
  calculateCanonicalLagna,
  getLagnaType,
  getNakshatraInfo,
} from "../../src/engine/astronomy/ascendant.ts";
import { buildCanonicalHouses, getHouseType } from "../../src/engine/astronomy/houses.ts";
import { calculateAllCanonicalBodies } from "../../src/engine/astronomy/planetaryPositions.ts";

export async function runAscendantAndHousesTests() {
  console.log("Running Ascendant & Houses Tests...");

  const jd2026 = 2461299.7291666665;
  const ayanamsa2026 = 24.230181023168825;
  const latChofu = 35.65;
  const lonChofu = 139.54;

  const lagna = await calculateCanonicalLagna(jd2026, latChofu, lonChofu, ayanamsa2026);

  assert.equal(lagna.body, "Lagna");
  assert.equal(lagna.sign, "Sagittarius");
  assert.equal(getLagnaType(lagna.sign), "Dual");
  assert.equal(lagna.house, 1);
  assert(lagna.signDegree >= 20 && lagna.signDegree <= 26);
  assert.equal(lagna.nakshatra, "Purva Ashadha");
  assert.equal(lagna.nakshatraPada, 4);

  // Nakshatra boundaries test
  const ashwiniStart = getNakshatraInfo(0.1);
  assert.equal(ashwiniStart.nakshatra, "Ashwini");
  assert.equal(ashwiniStart.pada, 1);

  const revatiEnd = getNakshatraInfo(359.5);
  assert.equal(revatiEnd.nakshatra, "Revati");
  assert.equal(revatiEnd.pada, 4);

  // Houses test
  const planets = await calculateAllCanonicalBodies(jd2026, ayanamsa2026, lagna.sign);
  const houses = buildCanonicalHouses(lagna, planets);

  // Check 12 houses exist
  for (let i = 1; i <= 12; i++) {
    const k = i.toString() as keyof typeof houses;
    assert(houses[k], `House ${i} must exist`);
    assert.equal(houses[k].houseNumber, i);
  }

  // House 1 is Sagittarius, lord Jupiter, type Angular
  assert.equal(houses["1"].sign, "Sagittarius");
  assert.equal(houses["1"].lord, "Jupiter");
  assert.equal(houses["1"].type, "Angular");

  // House 4 is Pisces, lord Jupiter, type Angular
  assert.equal(houses["4"].sign, "Pisces");
  assert.equal(houses["4"].type, "Angular");

  // House 9 is Leo, lord Sun, type Cadent, occupants include Sun and Ketu
  assert.equal(houses["9"].sign, "Leo");
  assert.equal(houses["9"].lord, "Sun");
  assert.equal(houses["9"].type, "Cadent");
  assert(houses["9"].occupants.includes("Sun"));
  assert(houses["9"].occupants.includes("Ketu"));

  // Check house types helper
  assert.equal(getHouseType(1), "Angular");
  assert.equal(getHouseType(2), "Succedent");
  assert.equal(getHouseType(3), "Cadent");

  console.log("✓ Ascendant & Houses Tests Passed!");
}
