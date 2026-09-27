/**
 * Deterministic Test Suite: Julian Day UT
 */

import assert from "node:assert/strict";
import {
  calculateJulianDayUt,
  dateToJulianDayUt,
  julianDayUtToDate,
} from "../../src/engine/astronomy/julianDay.ts";

export function runJulianDayTests() {
  console.log("Running Julian Day UT Tests...");

  // Benchmark 1: J2000.0 Epoch (2000-01-01 12:00:00 UT = JD 2451545.0)
  const jd2000 = calculateJulianDayUt(2000, 1, 1, 12.0);
  assert.equal(jd2000, 2451545.0);

  // Benchmark 2: Unix Epoch (1970-01-01 00:00:00 UT = JD 2440587.5)
  const jdUnix = calculateJulianDayUt(1970, 1, 1, 0.0);
  assert.equal(jdUnix, 2440587.5);

  // Benchmark 3: 2026-09-16 05:30:00 UT
  const jdTest = calculateJulianDayUt(2026, 9, 16, 5.5);
  assert.equal(jdTest, 2461299.7291666665);

  // Date conversion round-trip
  const testDate = new Date("2026-09-16T05:30:00.000Z");
  const jdFromDate = dateToJulianDayUt(testDate);
  assert.equal(jdFromDate, jdTest);

  const recoveredDate = julianDayUtToDate(jdFromDate);
  assert.equal(recoveredDate.toISOString(), "2026-09-16T05:30:00.000Z");

  console.log("✓ Julian Day UT Tests Passed!");
}
