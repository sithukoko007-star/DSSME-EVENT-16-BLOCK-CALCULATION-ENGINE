/**
 * PyJHora-Derived Reference Fixtures Test Suite
 * Compares DSSME native calculation results against independent PyJHora / JHora reference fixtures.
 * Reference pinned commit: 48e57d29b47a3143519910a24866758116467485.
 * Note: These are PyJHora-derived reference fixtures, not live PyJHora execution.
 */

import assert from "node:assert/strict";
import { generateCanonicalChart } from "../../src/engine/canonical/canonicalChart.ts";
import { DssmeCalculationInput } from "../../src/types/dssme-canonical-types.ts";

export async function runPyjhoraDifferentialTests() {
  console.log("Running PyJHora-Derived Reference Fixture Tests...");

  // Benchmark Fixture 1: 1970-11-01 07:20:00 IST (+5.5), Machilipatnam, India (16.18 N, 81.13 E)
  // Input Hash: 46c4d4beeb9e
  // Independent verification data from PyJHora standard reference
  const input_19701101: DssmeCalculationInput = {
    date: "1970-11-01",
    time: "07:20:00",
    latitude: 16.18,
    longitude: 81.13,
    timezone: "Asia/Kolkata",
    timezoneOffset: 5.5,
    ayanamsa: "Lahiri",
  };

  const chart_19701101 = await generateCanonicalChart(input_19701101);

  // Expected Independent Values:
  // Lagna: Scorpio (Vrishchika)
  assert.equal(chart_19701101.lagna.sign, "Scorpio", "Lagna must be Scorpio");
  assert(Math.abs(chart_19701101.lagna.signDegree - 1.72) < 0.25, "Lagna degree ~1.72°");

  // Sun in Libra (Tula), House 12
  assert.equal(chart_19701101.planets.Sun.sign, "Libra");
  assert.equal(chart_19701101.planets.Sun.house, 12);
  assert.equal(chart_19701101.planets.Sun.isRetrograde, false);

  // Moon in Scorpio (Vrishchika), House 1
  assert.equal(chart_19701101.planets.Moon.sign, "Scorpio");
  assert.equal(chart_19701101.planets.Moon.house, 1);
  assert.equal(chart_19701101.planets.Moon.nakshatra, "Anuradha");

  // Mars in Virgo (Kanya), House 11
  assert.equal(chart_19701101.planets.Mars.sign, "Virgo");
  assert.equal(chart_19701101.planets.Mars.house, 11);

  // Venus in Libra (Tula), Retrograde
  assert.equal(chart_19701101.planets.Venus.sign, "Libra");
  assert.equal(chart_19701101.planets.Venus.isRetrograde, true);

  // Saturn in Aries (Mesha), Retrograde, House 6
  assert.equal(chart_19701101.planets.Saturn.sign, "Aries");
  assert.equal(chart_19701101.planets.Saturn.isRetrograde, true);
  assert.equal(chart_19701101.planets.Saturn.house, 6);

  // Rahu in Aquarius (Kumbha), Ketu in Leo (Simha)
  assert.equal(chart_19701101.planets.Rahu.sign, "Aquarius");
  assert.equal(chart_19701101.planets.Ketu.sign, "Leo");
  assert.equal(chart_19701101.planets.Rahu.isRetrograde, true);
  assert.equal(chart_19701101.planets.Ketu.isRetrograde, true);

  // Reference Fixture 2: Chofu 2026-09-16 Chart
  const chofuInput: DssmeCalculationInput = {
    date: "2026-09-16",
    time: "14:30:00",
    latitude: 35.65,
    longitude: 139.54,
    timezone: "Asia/Tokyo",
    timezoneOffset: 9,
    ayanamsa: "Lahiri",
  };

  const chofuChart = await generateCanonicalChart(chofuInput);

  assert.equal(chofuChart.lagna.sign, "Sagittarius");
  assert.equal(chofuChart.planets.Sun.sign, "Leo");
  assert.equal(chofuChart.planets.Moon.sign, "Scorpio");
  assert.equal(chofuChart.planets.Mars.sign, "Gemini");
  assert.equal(chofuChart.planets.Mercury.sign, "Virgo");
  assert.equal(chofuChart.planets.Jupiter.sign, "Cancer");
  assert.equal(chofuChart.planets.Venus.sign, "Libra");
  assert.equal(chofuChart.planets.Saturn.sign, "Pisces");
  assert.equal(chofuChart.planets.Saturn.isRetrograde, true);
  assert.equal(chofuChart.planets.Rahu.sign, "Aquarius");
  assert.equal(chofuChart.planets.Ketu.sign, "Leo");

  console.log("✓ PyJHora Differential Tests Passed!");
}
