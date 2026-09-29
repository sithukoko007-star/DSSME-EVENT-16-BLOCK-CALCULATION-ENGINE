/**
 * Ascendant Fallback vs Swiss Ephemeris Numerical Regression Test Suite
 *
 * Verifies that calculateAscendantPure() trigonometric fallback formula:
 * 1. Has no quadrant error (no 180° inversion).
 * 2. Matches Swiss Ephemeris ascendant within declared tolerance (< 0.05° = 3 arcminutes).
 * 3. Correctly predicts Lagna sign across Northern, Southern, and Equatorial latitudes.
 * 4. Yields identical whole-sign house mappings.
 */

import assert from "node:assert/strict";
import { HouseSystem } from "@swisseph/browser";
import {
  calculateAscendantPure,
  getSwissEphemeris,
  normalize360,
} from "../../src/engine/astronomy/ephemeris.ts";
import { getLahiriAyanamsa } from "../../src/engine/astronomy/ayanamsa.ts";
import { ZODIAC_SIGNS_ARIES_FIRST } from "../../src/types/dssme-canonical-types.ts";

export async function runAscendantFallbackTests() {
  console.log("Running Swiss-vs-Fallback Ascendant Regression Tests...");

  const swe = await getSwissEphemeris();

  const testCases = [
    {
      name: "Chofu (Tokyo) 2026-09-16 14:30 (Existing Golden Fixture)",
      jd: 2461299.7291666665,
      lat: 35.65,
      lon: 139.54,
      expectedSign: "Sagittarius",
    },
    {
      name: "Chofu (Tokyo) 2026-09-16 18:50",
      jd: 2461299.909722222,
      lat: 35.65,
      lon: 139.54,
      expectedSign: "Pisces",
    },
    {
      name: "London (Greenwich) J2000 Epoch",
      jd: 2451545.0,
      lat: 51.5074,
      lon: -0.1278,
      expectedSign: "Aries",
    },
    {
      name: "Sydney, Australia (Southern Hemisphere)",
      jd: 2451545.0,
      lat: -33.8688,
      lon: 151.2093,
      expectedSign: "Leo",
    },
    {
      name: "New York, USA (Western Hemisphere)",
      jd: 2451545.0,
      lat: 40.7128,
      lon: -74.006,
      expectedSign: "Sagittarius",
    },
    {
      name: "Equator (0.0° Lat, 0.0° Lon)",
      jd: 2451545.0,
      lat: 0.0,
      lon: 0.0,
      expectedSign: "Pisces",
    },
  ];

  for (const tc of testCases) {
    const ayanamsa = await getLahiriAyanamsa(tc.jd);

    // Primary: Swiss Ephemeris
    const houses = swe.calculateHouses(tc.jd, tc.lat, tc.lon, HouseSystem.WholeSign);
    const sweTrop = normalize360(houses.ascendant);
    const sweSid = normalize360(sweTrop - ayanamsa);
    const sweSignIndex = Math.floor(sweSid / 30.0);
    const sweSign = ZODIAC_SIGNS_ARIES_FIRST[sweSignIndex];

    // Fallback: Pure trigonometric formula
    const fb = calculateAscendantPure(tc.jd, tc.lat, tc.lon, ayanamsa);
    const fbSignIndex = Math.floor(fb.siderealLongitude / 30.0);
    const fbSign = ZODIAC_SIGNS_ARIES_FIRST[fbSignIndex];

    // 1. Quadrant and angular delta assertion
    let diff = Math.abs(fb.tropicalLongitude - sweTrop);
    if (diff > 180.0) diff = Math.abs(diff - 360.0);

    assert(
      diff < 0.05,
      `[${tc.name}] Fallback Ascendant delta (${diff.toFixed(4)}°) exceeds 0.05° tolerance! ` +
        `SwissEph=${sweTrop.toFixed(4)}°, Fallback=${fb.tropicalLongitude.toFixed(4)}°`
    );

    // 2. Lagna Sign matching
    assert.equal(
      fbSign,
      sweSign,
      `[${tc.name}] Fallback Lagna sign (${fbSign}) must match Swiss Ephemeris (${sweSign})`
    );

    assert.equal(
      fbSign,
      tc.expectedSign,
      `[${tc.name}] Fallback Lagna sign (${fbSign}) must match expected sign (${tc.expectedSign})`
    );

    // 3. Provenance flag
    assert.equal(fb.provenance, "fallback", "Fallback result must declare fallback provenance");
  }

  console.log("✓ Swiss-vs-Fallback Ascendant Regression Tests Passed!");
}
