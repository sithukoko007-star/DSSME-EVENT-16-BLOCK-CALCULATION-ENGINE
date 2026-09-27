/**
 * Deterministic Test Suite: Timezone & UTC Resolution
 */

import assert from "node:assert/strict";
import { resolveDateTimeToUtc } from "../../src/engine/astronomy/timezone.ts";

export function runTimezoneTests() {
  console.log("Running Timezone & UTC Resolution Tests...");

  // Test 1: Asia/Tokyo (UTC+9)
  const tokyo = resolveDateTimeToUtc("2026-09-16", "14:30:00", 9);
  assert.equal(tokyo.localIso, "2026-09-16T14:30:00+09:00");
  assert.equal(tokyo.utcIso, "2026-09-16T05:30:00.000Z");
  assert.equal(tokyo.decimalUtHours, 5.5);

  // Test 2: New York EDT (UTC-4)
  const ny = resolveDateTimeToUtc("2026-06-21", "08:15:30", -4);
  assert.equal(ny.localIso, "2026-06-21T08:15:30-04:00");
  assert.equal(ny.utcIso, "2026-06-21T12:15:30.000Z");
  assert.equal(ny.decimalUtHours, 12 + 15 / 60 + 30 / 3600);

  // Test 3: India IST (UTC+5.5)
  const india = resolveDateTimeToUtc("2024-01-01", "00:00:00", 5.5);
  assert.equal(india.localIso, "2024-01-01T00:00:00+05:30");
  assert.equal(india.utcIso, "2023-12-31T18:30:00.000Z");
  assert.equal(india.decimalUtHours, 18.5);

  // Test 4: Error Handling on invalid formats
  assert.throws(
    () => resolveDateTimeToUtc("invalid-date", "12:00:00", 0),
    /INVALID_INPUT/
  );
  assert.throws(
    () => resolveDateTimeToUtc("2026-09-16", "25:00:00", 0),
    /INVALID_INPUT/
  );
  assert.throws(
    () => resolveDateTimeToUtc("2026-09-16", "12:00:00", 25),
    /TIMEZONE_ERROR/
  );

  console.log("✓ Timezone & UTC Resolution Tests Passed!");
}
