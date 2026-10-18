import assert from "node:assert/strict";
import {
  DEFAULT_TIMEZONE_LOCATIONS,
  ALL_CITY_LOCATIONS,
  getDefaultLocationForTimezone,
  searchLocations,
  getLocationsForTimezone,
  normalizeTimezoneAlias,
} from "../../src/data/timezoneLocations.ts";

export function runTimezoneLocationsTests(): void {
  console.log("Running Timezone Locations & Coordinates Tests...");

  // 1. Defaults for primary timezones
  const yangon = getDefaultLocationForTimezone("Asia/Yangon");
  assert.ok(yangon, "Asia/Yangon default location exists");
  assert.equal(yangon.city, "Yangon");
  assert.equal(yangon.country, "Myanmar");
  assert.equal(yangon.latitude, 16.8661);
  assert.equal(yangon.longitude, 96.1951);

  const tokyo = getDefaultLocationForTimezone("Asia/Tokyo");
  assert.ok(tokyo, "Asia/Tokyo default location exists");
  assert.equal(tokyo.city, "Tokyo/Chofu");
  assert.equal(tokyo.latitude, 35.65);
  assert.equal(tokyo.longitude, 139.54);

  const utc = getDefaultLocationForTimezone("UTC");
  assert.ok(utc, "UTC default location exists");
  assert.equal(utc.latitude, 51.4826);
  assert.equal(utc.longitude, 0.0);

  // 2. Alias normalization
  assert.equal(normalizeTimezoneAlias("Asia/Rangoon"), "Asia/Yangon");
  assert.equal(normalizeTimezoneAlias("Asia/Calcutta"), "Asia/Kolkata");
  assert.equal(normalizeTimezoneAlias("Asia/Katmandu"), "Asia/Kathmandu");
  const rangoon = getDefaultLocationForTimezone("Asia/Rangoon");
  assert.ok(rangoon, "Alias Asia/Rangoon resolves to Yangon coordinates");
  assert.equal(rangoon.city, "Yangon");

  // 3. Search locations
  const myanmarSearch = searchLocations("Myanmar");
  assert.ok(myanmarSearch.length >= 5, "Search for Myanmar returns multiple cities");
  assert.ok(myanmarSearch.some((l) => l.city === "Mandalay"));
  assert.ok(myanmarSearch.some((l) => l.city === "Naypyidaw"));

  const mandalay = searchLocations("Mandalay");
  assert.equal(mandalay.length, 1);
  assert.equal(mandalay[0].city, "Mandalay");
  assert.equal(mandalay[0].latitude, 21.9588);
  assert.equal(mandalay[0].longitude, 96.0891);

  // 4. Locations for timezone
  const yangonCities = getLocationsForTimezone("Asia/Yangon");
  assert.ok(yangonCities.length >= 8, "Asia/Yangon contains major Myanmar cities");
  assert.ok(yangonCities.some((c) => c.city === "Pathein"));
  assert.ok(yangonCities.some((c) => c.city === "Taunggyi"));

  // 5. Bounds and integrity check for all registered locations
  for (const loc of ALL_CITY_LOCATIONS) {
    assert.ok(Number.isFinite(loc.latitude) && loc.latitude >= -90 && loc.latitude <= 90, `Valid latitude for ${loc.city}`);
    assert.ok(Number.isFinite(loc.longitude) && loc.longitude >= -180 && loc.longitude <= 180, `Valid longitude for ${loc.city}`);
    assert.ok(loc.timezone && typeof loc.timezone === "string", `Valid timezone for ${loc.city}`);
  }

  console.log("✓ Timezone Locations & Coordinates Tests Passed!");
}
