/**
 * Deterministic Test Suite: Timezone & UTC Resolution
 * Covers ISO 8601 formatting, UTC derivation, calendar validation,
 * DST spring-forward gaps, DST fall-back overlaps, and historical transitions.
 */

import assert from "node:assert/strict";
import { resolveDateTimeToUtc } from "../../src/engine/astronomy/timezone.ts";
import { deriveTimezoneOffset } from "../../src/utils/timezoneHelper.ts";

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

  // Test 5: Calendar round-trip validation regression tests
  // Non-existent calendar dates rejected
  assert.throws(
    () => resolveDateTimeToUtc("2024-02-30", "12:00:00", 0),
    /is not a valid calendar date/
  );
  assert.throws(
    () => resolveDateTimeToUtc("2023-04-31", "12:00:00", 0),
    /is not a valid calendar date/
  );
  assert.throws(
    () => resolveDateTimeToUtc("2023-02-29", "12:00:00", 0),
    /is not a valid calendar date/
  );

  // Valid leap year date accepted
  const leapDay = resolveDateTimeToUtc("2024-02-29", "10:00:00", 0);
  assert.equal(leapDay.localIso, "2024-02-29T10:00:00+00:00");
  assert.equal(leapDay.utcIso, "2024-02-29T10:00:00.000Z");

  // Test 6: DST Ambiguity - Spring-Forward Gap (Strictly rejected non-existent civil time)
  // In New York on 2026-03-08, clocks jump from 02:00 EST (-5) directly to 03:00 EDT (-4).
  // Time 02:30:00 does not exist locally. Must be detected as invalid DST gap.
  const springGap = deriveTimezoneOffset("America/New_York", "2026-03-08", "02:30:00");
  assert.equal(springGap.valid, false, "Non-existent local time must not be valid");
  assert.equal(springGap.isDstGap, true, "Must flag isDstGap");
  assert(springGap.error?.includes("spring-forward gap"));

  // Test 7: DST Ambiguity - Fall-Back Overlap (Detected as ambiguous with both valid offsets)
  // In New York on 2026-11-01, clocks repeat the 01:00-02:00 hour.
  // Standard handling identifies overlap and returns validOffsets [-5, -4].
  const fallOverlap = deriveTimezoneOffset("America/New_York", "2026-11-01", "01:30:00");
  assert.equal(fallOverlap.valid, true);
  assert.equal(fallOverlap.isDstOverlap, true, "Must flag isDstOverlap");
  assert.deepEqual(fallOverlap.validOffsets, [-5, -4], "Must identify both valid offsets during overlap");

  // Test 8: Historical Timezone Transitions
  // Nepal shifted from UTC+5:30 to UTC+5:45 on 1986-01-01
  const nepal1980 = deriveTimezoneOffset("Asia/Kathmandu", "1980-06-01", "12:00:00");
  assert.equal(nepal1980.valid, true);
  assert.equal(nepal1980.offsetHours, 5.5, "Historical Nepal (pre-1986) was UTC+5:30");

  const nepal2024 = deriveTimezoneOffset("Asia/Kathmandu", "2024-06-01", "12:00:00");
  assert.equal(nepal2024.valid, true);
  assert.equal(nepal2024.offsetHours, 5.75, "Modern Nepal is UTC+5:45");

  // Test 9: Historical Non-15-Minute Local Mean Time (LMT) & Second-Precision Offsets
  // Madras / Asia/Kolkata in 1887 had historical offset UTC+05:21:10 (5.3527777778h)
  const madras1887 = deriveTimezoneOffset("Asia/Kolkata", "1887-10-12", "12:00:00");
  assert.equal(madras1887.valid, true, "Historical Madras 1887 must be valid, not falsely rejected as DST gap");
  assert.equal(madras1887.isDstGap, false);
  assert.ok(Math.abs((madras1887.offsetHours ?? 0) - (5 + 21 / 60 + 10 / 3600)) < 0.0001, "Madras 1887 offset is UTC+05:21:10");

  // Kolkata / Asia/Kolkata in 1863 had historical offset UTC+05:53:20 (5.8888888889h)
  const kolkata1863 = deriveTimezoneOffset("Asia/Kolkata", "1863-01-12", "06:33:00");
  assert.equal(kolkata1863.valid, true, "Historical Kolkata 1863 must be valid");
  assert.ok(Math.abs((kolkata1863.offsetHours ?? 0) - (5 + 53 / 60 + 20 / 3600)) < 0.0001, "Kolkata 1863 offset is UTC+05:53:20");

  // Full round-trip resolution to UTC with second-precision offset
  const resMadras = resolveDateTimeToUtc("1887-10-12", "12:00:00", 5 + 21 / 60 + 10 / 3600);
  assert.equal(resMadras.localIso, "1887-10-12T12:00:00+05:21:10");

  console.log("✓ Timezone & UTC Resolution Tests Passed!");
}
