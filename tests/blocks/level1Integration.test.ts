/**
 * Phase 3, Level 1 — integration: live CanonicalChart -> Level 1 blocks.
 *
 * Uses the real Swiss engine. Assertions are SIGN-LEVEL / structural only (valid regardless of the
 * degree-level reference-JSON discrepancy). The Chofu reference JSON is NOT used as a numeric golden.
 */

import assert from "node:assert/strict";
import { generateCanonicalChart } from "../../src/engine/canonical/canonicalChart.ts";
import {
  HOUSE_KEYS,
  buildHousePositionsBlock,
  buildHousesBlock,
  buildRetrogradeBlock,
  createBlockContext,
} from "../../src/engine/blocks/index.ts";
import type { CanonicalChart, HouseEntry } from "../../src/types/dssme-canonical-types.ts";

export async function runLevel1IntegrationTests(): Promise<void> {
  console.log("Running Phase 3 Level 1 Integration Tests (CanonicalChart -> blocks)...");

  const chart = await generateCanonicalChart({
    date: "2026-09-16",
    time: "18:50:00",
    latitude: 35.65,
    longitude: 139.54,
    timezone: "Asia/Tokyo",
    timezoneOffset: 9,
    ayanamsa: "Lahiri",
  });
  assert.equal(chart.provenance.ephemeris, "swisseph-wasm");
  assert.equal(chart.provenance.isDegraded, false);

  const ctx = createBlockContext(chart);
  const houses = buildHousesBlock(ctx);
  const positions = buildHousePositionsBlock(ctx);
  const retro = buildRetrogradeBlock(ctx);

  for (const r of [houses, positions, retro]) {
    assert.equal(r.status, "OK", `${r.blockId}: ${JSON.stringify(r.issues)}`);
    assert.deepEqual(r.issues, []);
    assert.equal(r.instantJdUt, chart.time.julianDayUt);
    assert.deepEqual(r.provenance.chart, { ephemeris: "swisseph-wasm", isDegraded: false });
    assert.equal(JSON.stringify(r), JSON.stringify(r), "stable serialization");
  }

  // Sign-level structure (Lagna Pisces at this instant; confirmed by the Phase 2 ascendant fixtures).
  assert.equal(chart.lagna.sign, "Pisces");
  const signs = HOUSE_KEYS.map((k) => houses.value?.[k].sign);
  assert.deepEqual(signs, ["Pisces", "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius"]);
  assert.deepEqual(houses.value?.["6"].occupants, ["Sun", "Ketu"], "canonical body order");
  assert.deepEqual(houses.value?.["1"].occupants, ["Saturn"]);
  assert.deepEqual(houses.value?.["12"].occupants, ["Rahu"]);
  assert.equal(positions.value?.Saturn.house, 1);
  assert.equal(positions.value?.Moon.house, 9);
  assert.equal(retro.value?.Saturn, true);
  assert.equal(retro.value?.Rahu, true);
  assert.equal(retro.value?.Ketu, true);
  assert.equal(retro.value?.Sun, false);

  // Projection fidelity: HOUSES equals the frozen chart.houses field-for-field.
  for (const key of HOUSE_KEYS) {
    const frozen = chart.houses[key];
    const projected: HouseEntry | undefined = houses.value?.[key];
    assert.ok(projected);
    assert.equal(projected.sign, frozen.sign);
    assert.equal(projected.lord, frozen.lord);
    assert.equal(projected.type, frozen.type);
    assert.deepEqual(projected.occupants, [...frozen.occupants]);
  }

  // Determinism across two independent builds from the same chart.
  assert.equal(JSON.stringify(buildHousesBlock(ctx)), JSON.stringify(houses));

  // Degraded chart provenance: state blocks still build and carry the flag.
  const degradedChart: CanonicalChart = {
    ...chart,
    provenance: { ...chart.provenance, ephemeris: "fallback", isDegraded: true },
  };
  const degradedCtx = createBlockContext(degradedChart);
  for (const r of [buildHousesBlock(degradedCtx), buildHousePositionsBlock(degradedCtx), buildRetrogradeBlock(degradedCtx)]) {
    assert.equal(r.status, "OK");
    assert.deepEqual(r.provenance.chart, { ephemeris: "fallback", isDegraded: true });
  }

  console.log("✓ Phase 3 Level 1 Integration Tests Passed!");
}
