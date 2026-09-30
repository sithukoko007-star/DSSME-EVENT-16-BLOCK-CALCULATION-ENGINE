/**
 * Test Suite: Timezone Helper & Automatic IANA Offset Derivation
 */

import assert from "node:assert/strict";
import {
  deriveTimezoneOffset,
  isValidIanaTimezone,
  formatOffsetDisplay,
  getAllIanaTimezones,
} from "../../src/utils/timezoneHelper.ts";

export function runTimezoneHelperTests() {
  console.log("Running Timezone Helper & IANA Offset Derivation Tests...");

  // 1. Validation of IANA identifiers
  assert.equal(isValidIanaTimezone("Asia/Tokyo"), true);
  assert.equal(isValidIanaTimezone("Asia/Yangon"), true);
  assert.equal(isValidIanaTimezone("America/New_York"), true);
  assert.equal(isValidIanaTimezone("Europe/London"), true);
  assert.equal(isValidIanaTimezone("UTC"), true);
  assert.equal(isValidIanaTimezone("Invalid/TzName"), false);
  assert.equal(isValidIanaTimezone(""), false);
  assert.equal(isValidIanaTimezone("   "), false);

  // 2. Chofu Preset: 2026-09-16 14:30:00 Asia/Tokyo => UTC+9
  const chofu = deriveTimezoneOffset("Asia/Tokyo", "2026-09-16", "14:30:00");
  assert.equal(chofu.valid, true);
  assert.equal(chofu.offsetHours, 9);
  assert.equal(chofu.formattedOffset, "UTC+09:00");

  // 3. Historical Timezone: 1980-11-04 21:35:00 Asia/Yangon => UTC+6.5
  const yangon = deriveTimezoneOffset("Asia/Yangon", "1980-11-04", "21:35:00");
  assert.equal(yangon.valid, true);
  assert.equal(yangon.offsetHours, 6.5);
  assert.equal(yangon.formattedOffset, "UTC+06:30");

  // 4. DST Historical Variation: New York (EDT summer UTC-4 vs EST winter UTC-5)
  const nySummer = deriveTimezoneOffset("America/New_York", "2026-06-21", "12:00:00");
  assert.equal(nySummer.valid, true);
  assert.equal(nySummer.offsetHours, -4);
  assert.equal(nySummer.formattedOffset, "UTC-04:00");

  const nyWinter = deriveTimezoneOffset("America/New_York", "2026-01-15", "12:00:00");
  assert.equal(nyWinter.valid, true);
  assert.equal(nyWinter.offsetHours, -5);
  assert.equal(nyWinter.formattedOffset, "UTC-05:00");

  // 5. London (BST summer UTC+1 vs GMT winter UTC+0)
  const londonSummer = deriveTimezoneOffset("Europe/London", "2026-07-01", "12:00:00");
  assert.equal(londonSummer.valid, true);
  assert.equal(londonSummer.offsetHours, 1);
  assert.equal(londonSummer.formattedOffset, "UTC+01:00");

  const londonWinter = deriveTimezoneOffset("Europe/London", "2026-01-01", "12:00:00");
  assert.equal(londonWinter.valid, true);
  assert.equal(londonWinter.offsetHours, 0);
  assert.equal(londonWinter.formattedOffset, "UTC+00:00");

  // 6. Fractional Offsets: India (UTC+5.5), Nepal (UTC+5.75)
  const india = deriveTimezoneOffset("Asia/Kolkata", "2024-01-01", "00:00:00");
  assert.equal(india.valid, true);
  assert.equal(india.offsetHours, 5.5);
  assert.equal(india.formattedOffset, "UTC+05:30");

  const nepal = deriveTimezoneOffset("Asia/Kathmandu", "2024-01-01", "00:00:00");
  assert.equal(nepal.valid, true);
  assert.equal(nepal.offsetHours, 5.75);
  assert.equal(nepal.formattedOffset, "UTC+05:45");

  // 7. Error handling
  const invalidTz = deriveTimezoneOffset("Fake/NonExistent", "2026-01-01", "12:00:00");
  assert.equal(invalidTz.valid, false);
  assert.ok(invalidTz.error?.includes("not a recognized IANA timezone"));

  const invalidDate = deriveTimezoneOffset("Asia/Tokyo", "bad-date", "12:00:00");
  assert.equal(invalidDate.valid, false);

  // 8. Offset display formatter
  assert.equal(formatOffsetDisplay(9), "UTC+09:00");
  assert.equal(formatOffsetDisplay(6.5), "UTC+06:30");
  assert.equal(formatOffsetDisplay(-4), "UTC-04:00");
  assert.equal(formatOffsetDisplay(-5.5), "UTC-05:30");
  assert.equal(formatOffsetDisplay(0), "UTC+00:00");
  assert.equal(formatOffsetDisplay(5.75), "UTC+05:45");

  // 9. Zone list returns values
  const list = getAllIanaTimezones();
  assert.ok(list.length > 50);
  assert.ok(list.includes("Asia/Tokyo"));
  assert.ok(list.includes("Asia/Yangon"));

  console.log("✓ Timezone Helper & IANA Offset Derivation Tests Passed!");
}
