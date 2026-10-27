/**
 * DSSME Native Test Suite — Chesta Bala (Motional Strength) & Shadbala Constants
 * File: tests/strength/chestaBala.test.ts
 *
 * Comprehensive TDD unit tests covering positive, negative, and edge cases for:
 *   - SHADBALA_PLANETS, MEAN_DAILY_MOTION, STATIONARY_THRESHOLD
 *   - calculateSunChestaBala (Ayana declination interpolation across all 4 quadrants & wrap-around)
 *   - calculateMoonChestaBala (Paksha elongation & banker's rounding ties)
 *   - calculateOuterPlanetChestaBala (Retrograde, stationary threshold, exact 5% boundary, direct proportional & cap)
 *   - calculateChestaBalaAll (7-planet batch calculation, context handling, missing/invalid input errors)
 */

import assert from "node:assert/strict";
import {
  MEAN_DAILY_MOTION,
  STATIONARY_THRESHOLD,
  calculateSunChestaBala,
  calculateMoonChestaBala,
  calculateOuterPlanetChestaBala,
  calculateChestaBalaAll,
} from "../../src/engine/strength/chestaBala.ts";
import { SHADBALA_PLANETS } from "../../src/engine/strength/shadbalaConstants.ts";
import type { PlanetState } from "../../src/engine/types.ts";

export function runChestaBalaTests(): void {
  console.log("Running Suite: Chesta Bala (Motional Strength) & Shadbala Constants...");

  // ==========================================================================
  // 1. Constants & Contract Invariants
  // ==========================================================================
  assert.deepEqual(SHADBALA_PLANETS, [
    "Sun",
    "Moon",
    "Mars",
    "Mercury",
    "Jupiter",
    "Venus",
    "Saturn",
  ]);

  assert.equal(MEAN_DAILY_MOTION.Mars, 0.524);
  assert.equal(MEAN_DAILY_MOTION.Mercury, 4.0923);
  assert.equal(MEAN_DAILY_MOTION.Jupiter, 0.0831);
  assert.equal(MEAN_DAILY_MOTION.Venus, 1.60215);
  assert.equal(MEAN_DAILY_MOTION.Saturn, 0.033439);

  assert.equal(STATIONARY_THRESHOLD, 0.05);

  // ==========================================================================
  // 2. Sun Chesta Bala (Ayana Model)
  // ==========================================================================
  // Vernal equinox (trop = 0 -> decl = 0 -> (24 + 0) * 1.25 * 2 = 60.0)
  assert.equal(calculateSunChestaBala(0, 0), 60.0);

  // Summer solstice (trop = 90 -> decl = +24 -> (24 + 24) * 1.25 * 2 = 120.0)
  assert.equal(calculateSunChestaBala(90, 0), 120.0);

  // Near autumnal equinox (trop = 179.99 -> bhuja = 0.01 -> decl ≈ 0.007 -> 60.02)
  assert.equal(calculateSunChestaBala(179.99, 0), 60.02);

  // Near winter solstice (trop = 269.99 -> bhuja = 89.99, ns = -1 -> decl ≈ -24 -> 0.0)
  assert.equal(calculateSunChestaBala(269.99, 0), 0.0);

  // Modulo wrap-around (360 -> 0 -> 60.0)
  assert.equal(calculateSunChestaBala(360, 0), 60.0);
  assert.equal(calculateSunChestaBala(720, 0), 60.0);

  // Non-zero ayanamsa (sidereal 65.77 + ayanamsa 24.23 = 90.0 tropical -> 120.0)
  assert.equal(calculateSunChestaBala(65.77, 24.23), 120.0);

  // Quadrant symmetry
  const q1 = calculateSunChestaBala(30, 0);
  const q2 = calculateSunChestaBala(150, 0);
  assert.equal(q1, q2, "Quadrant 1 and Quadrant 2 symmetry at 30° from equinox");

  // ==========================================================================
  // 3. Moon Chesta Bala (Paksha Model & Banker's Rounding)
  // ==========================================================================
  // Conjunction (elongation = 0 -> 0.0)
  assert.equal(calculateMoonChestaBala(120, 120), 0.0);

  // Opposition (elongation = 180 -> 180 / 3 = 60.0)
  assert.equal(calculateMoonChestaBala(300, 120), 60.0);

  // Quadrature (elongation = 90 -> 90 / 3 = 30.0)
  assert.equal(calculateMoonChestaBala(210, 120), 30.0);
  assert.equal(calculateMoonChestaBala(30, 120), 30.0);

  // Symmetry: |moon - sun| / 3
  assert.equal(calculateMoonChestaBala(100, 145), 15.0);

  // Banker's rounding tests:
  // pyRound2 ties to nearest even digit
  // elongation = 0.75 -> 0.75 / 3 = 0.25 -> 0.25
  assert.equal(calculateMoonChestaBala(0.75, 0), 0.25);
  // elongation = 0.45 -> 0.45 / 3 = 0.15 -> 0.15
  assert.equal(calculateMoonChestaBala(0.45, 0), 0.15);

  // ==========================================================================
  // 4. Outer Planets Chesta Bala (BPHS Method 2: Speed & Retrograde)
  // ==========================================================================
  // Retrograde -> Always 60.0 virupas
  assert.equal(calculateOuterPlanetChestaBala("Mars", -0.1), 60.0);
  assert.equal(calculateOuterPlanetChestaBala("Jupiter", -0.05), 60.0);
  assert.equal(calculateOuterPlanetChestaBala("Saturn", -0.001), 60.0);

  // Stationary (|speed| < 5% mean motion) -> 0.0 virupas
  // Mars: mean = 0.524, 5% = 0.0262
  assert.equal(calculateOuterPlanetChestaBala("Mars", 0.02), 0.0);
  assert.equal(calculateOuterPlanetChestaBala("Mars", 0.0), 0.0);

  // Exact 5% boundary: speed = 0.0262 is not strictly less than 0.524 * 0.05 (0.0262)
  // absSpeed >= meanSpeed * STATIONARY_THRESHOLD -> direct proportional: round((0.0262/0.524)*60) = 3.0
  assert.equal(calculateOuterPlanetChestaBala("Mars", 0.0262), 3.0);

  // Direct motion: proportional to speed / meanSpeed * 60
  // Exactly at mean speed -> 60.0
  assert.equal(calculateOuterPlanetChestaBala("Mars", 0.524), 60.0);
  // Half of mean speed -> 30.0
  assert.equal(calculateOuterPlanetChestaBala("Mars", 0.262), 30.0);

  // Hard cap at 60.0 virupas
  assert.equal(calculateOuterPlanetChestaBala("Mars", 1.5), 60.0);
  assert.equal(calculateOuterPlanetChestaBala("Mercury", 8.0), 60.0);

  // Unknown planet -> 0.0
  assert.equal(calculateOuterPlanetChestaBala("Pluto", 0.1), 0.0);

  // ==========================================================================
  // 5. Batch calculateChestaBalaAll
  // ==========================================================================
  const samplePlanets: Record<string, PlanetState> = {
    Sun: { totalLongitude: 65.77, speedLongitude: 0.98 },
    Moon: { totalLongitude: 245.77, speedLongitude: 13.2 },
    Mars: { totalLongitude: 88.0, speedLongitude: -0.15 }, // Retrograde -> 60.0
    Mercury: { totalLongitude: 165.0, speedLongitude: 4.0923 }, // Mean -> 60.0
    Jupiter: { totalLongitude: 112.0, speedLongitude: 0.04155 }, // Half -> 30.0
    Venus: { totalLongitude: 189.0, speedLongitude: 0.01 }, // Stationary (< 0.08) -> 0.0
    Saturn: { totalLongitude: 348.0, speedLongitude: 0.033439 }, // Mean -> 60.0
  };

  const resultsWithAyanamsa = calculateChestaBalaAll(samplePlanets, { ayanamsaDegrees: 24.23 });
  assert.equal(resultsWithAyanamsa.length, 7);
  assert.equal(resultsWithAyanamsa[0], 120.0); // Sun (90 tropical)
  assert.equal(resultsWithAyanamsa[1], 60.0);  // Moon (180 diff)
  assert.equal(resultsWithAyanamsa[2], 60.0);  // Mars (retro)
  assert.equal(resultsWithAyanamsa[3], 60.0);  // Mercury (mean)
  assert.equal(resultsWithAyanamsa[4], 30.0);  // Jupiter (half)
  assert.equal(resultsWithAyanamsa[5], 0.0);   // Venus (stationary)
  assert.equal(resultsWithAyanamsa[6], 60.0);  // Saturn (mean)

  // Context without ayanamsa -> Sun is 0.0
  const resultsNoAyanamsa = calculateChestaBalaAll(samplePlanets, {});
  assert.equal(resultsNoAyanamsa[0], 0.0);

  // Context omitted entirely -> Sun is 0.0
  const resultsNoCtx = calculateChestaBalaAll(samplePlanets);
  assert.equal(resultsNoCtx[0], 0.0);

  // Missing planet longitude throws descriptive error
  const invalidPlanetsMoon: Record<string, PlanetState> = {
    Sun: { totalLongitude: 100 },
  };
  assert.throws(
    () => calculateChestaBalaAll(invalidPlanetsMoon),
    /missing longitude for "Moon"/
  );

  const invalidPlanetsSun: Record<string, PlanetState> = {
    Moon: { totalLongitude: 100 },
  };
  assert.throws(
    () => calculateChestaBalaAll(invalidPlanetsSun),
    /missing longitude for "Sun"/
  );

  console.log("  [PASS] All Chesta Bala (Motional Strength) & Shadbala Constants assertions.");
}
