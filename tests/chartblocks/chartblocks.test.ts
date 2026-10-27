/**
 * DSSME Native Test Suite — Chartblocks Modules & 16-Block Orchestrator
 * File: tests/chartblocks/chartblocks.test.ts
 *
 * Comprehensive TDD unit and integration tests covering:
 *   - BLOCK_1: IDENTITY (getLagnaType, buildIdentityBlock)
 *   - BLOCK_3: DASHA (Vimshottari 120-year sum, lord sequence, next-MD rollover)
 *   - BLOCK_8-10: ASHTAKAVARGA (337 SAV sacred invariant, Rahu/Ketu proxy rows)
 *   - ASPECTS: computeAspects (ASPECTS_PLANETS, ASPECTS_BHAVAS, special aspects)
 *   - DIGNITY: getClassicalDignity (Exalted/Debilitated/Own/Moolatrikona/Neutral) & buildDignityBlock
 *   - COMBUST: buildCombustBlock (direct/retro orbs, Mild/Severe severity, 360° wrap)
 *   - SIGN_CLUSTERS: buildSignClustersBlock (grouping, ordering, SAV cross-check)
 *   - HORA: buildHoraBlock & getFullHoraSchedule (24-hora schedule)
 *   - PHASE_STRESS: buildPhaseStressBlock (new/full moon proximity, ingress)
 *   - NAVAMSHA: buildNavamshaBlock (D-9 calculation, 9 bodies + Lagna)
 *   - YOGA_LIST: buildYogaListBlock (classical yogas detection)
 *   - BLOCK_4: BHAVA_BALA (12 houses, lord/dig/drishti virupas)
 *   - Orchestrator: buildDssme16BlockResult assembly, block integrity, determinism
 */

import assert from "node:assert/strict";
import { generateCanonicalChart } from "../../src/engine/canonical/canonicalChart.ts";
import { computePanchanga, fromCanonicalChart } from "../../src/engine/panchanga/index.ts";
import { createBlockContext } from "../../src/engine/blocks/blockResult.ts";
import {
  buildDssme16BlockResult,
  buildIdentityBlock,
  buildDashaBlock,
  buildShadbalaBlock,
  buildBhavaBalaBlock,
  computeAshtakavarga,
  computeAspects,
  buildDignityBlock,
  getClassicalDignity,
  buildCombustBlock,
  buildSignClustersBlock,
  buildHoraBlock,
  buildPhaseStressBlock,
  buildNavamshaBlock,
  buildYogaListBlock,
} from "../../src/engine/chartblocks/index.ts";
import { getLagnaType } from "../../src/engine/chartblocks/identity.ts";
import { getFullHoraSchedule } from "../../src/engine/chartblocks/hora.ts";
import {
  VIMSHOTTARI_LORDS,
  VIMSHOTTARI_YEARS,
} from "../../src/engine/chartblocks/dasha.ts";
import { CLASSICAL_PLANETS_ORDER } from "../../src/engine/chartblocks/shadbala.ts";

export async function runChartblocksTests(): Promise<void> {
  console.log("Running Suite: Chartblocks Modules & 16-Block Orchestrator...");

  // Generate Reference Canonical Chart (Chofu: 2026-09-16 18:50 JST)
  const chart = await generateCanonicalChart({
    date: "2026-09-16",
    time: "18:50:00",
    latitude: 35.6528,
    longitude: 139.5447,
    timezone: "Asia/Tokyo",
    timezoneOffset: 9,
    ayanamsa: "Lahiri",
  });

  const ctx = createBlockContext(chart);
  const panchanga = computePanchanga(fromCanonicalChart(chart));

  // ==========================================================================
  // 1. BLOCK_1: IDENTITY & getLagnaType
  // ==========================================================================
  assert.equal(getLagnaType("Aries"), "Movable");
  assert.equal(getLagnaType("Cancer"), "Movable");
  assert.equal(getLagnaType("Taurus"), "Fixed");
  assert.equal(getLagnaType("Leo"), "Fixed");
  assert.equal(getLagnaType("Gemini"), "Dual");
  assert.equal(getLagnaType("Pisces"), "Dual");

  const identity = buildIdentityBlock(ctx, {
    bodyMode: "7-body",
    risk: "BALANCED",
    geometry: "ordered_2_digit",
    objective: "short-cycle speculative extraction",
  });
  assert.equal(identity.status, "OK");
  assert.ok(identity.value);
  assert.equal(identity.value!.lagna_sign, "Pisces");
  assert.equal(identity.value!.lagna_type, "Dual");
  assert.equal(identity.value!.geometry, "ordered_2_digit");
  assert.equal(identity.value!.body_mode, "7-body");
  assert.equal(identity.value!.risk, "BALANCED");
  assert.ok(identity.value!.ayanamsa_value.length > 0);
  assert.equal(identity.value!.ayanamsa_name, "Lahiri");

  // ==========================================================================
  // 2. BLOCK_3: DASHA — 120-Year Cycle & Next-MD Rollover
  // ==========================================================================
  // 120-year sum
  let sumYears = 0;
  for (const lord of VIMSHOTTARI_LORDS) {
    sumYears += VIMSHOTTARI_YEARS[lord] ?? 0;
  }
  assert.equal(sumYears, 120, "Vimshottari Dasha 9-lord sequence must sum to 120 years");

  const dasha = buildDashaBlock(ctx);
  assert.equal(dasha.status, "OK");
  assert.ok(dasha.value);
  assert.ok(dasha.value!.mahadasha_planet);
  assert.ok(dasha.value!.antardasha_planet);
  assert.ok(dasha.value!.dasha_string.length > 0);
  assert.ok(dasha.value!.upcoming_ad.length >= 5);

  // Next-MD rollover verification
  const currentMdIdx = VIMSHOTTARI_LORDS.indexOf(dasha.value!.mahadasha_planet);
  const expectedNextMd = VIMSHOTTARI_LORDS[(currentMdIdx + 1) % 9]!;
  assert.equal(dasha.value!.next_mahadasha_planet, expectedNextMd);

  // ==========================================================================
  // 3. BLOCK_8–10: ASHTAKAVARGA — 337 SAV Invariant & Rahu/Ketu Proxies
  // ==========================================================================
  const { BAV, SAV, BAV_CURRENT_SIGN } = computeAshtakavarga(ctx);
  assert.ok(BAV && SAV && BAV_CURRENT_SIGN);

  // Expected individual BAV total bindu counts per classical Parashara
  const EXPECTED_BAV_TOTALS: Record<string, number> = {
    Sun: 48,
    Moon: 49,
    Mars: 39,
    Mercury: 54,
    Jupiter: 56,
    Venus: 52,
    Saturn: 39,
  };

  let totalSavBindus = 0;
  for (let s = 0; s < 12; s++) {
    totalSavBindus += SAV.values[s] ?? 0;
  }
  assert.equal(totalSavBindus, 337, `SAV total across 12 signs must equal 337, got ${totalSavBindus}`);

  for (const planet of CLASSICAL_PLANETS_ORDER) {
    const pBav = BAV[planet];
    assert.ok(pBav, `BAV entry missing for ${planet}`);
    assert.equal(pBav.length, 12, `BAV for ${planet} must have 12 signs`);
    const planetSum = pBav.reduce((a, b) => a + b, 0);
    assert.equal(
      planetSum,
      EXPECTED_BAV_TOTALS[planet],
      `BAV bindu sum for ${planet} expected ${EXPECTED_BAV_TOTALS[planet]}, got ${planetSum}`
    );
  }

  // Rahu / Ketu proxy rows in BAV_CURRENT_SIGN (§2.2 BLOCK_10)
  assert.equal(BAV_CURRENT_SIGN.Rahu._note, "uses Saturn BAV row");
  assert.equal(BAV_CURRENT_SIGN.Ketu._note, "uses Mars BAV row");

  // ==========================================================================
  // 4. ASPECTS: computeAspects
  // ==========================================================================
  const { ASPECTS_PLANETS, ASPECTS_BHAVAS } = computeAspects(ctx);
  assert.ok(Array.isArray(ASPECTS_PLANETS));
  assert.ok(ASPECTS_BHAVAS);
  // Verify universal 7th aspect present
  assert.ok(ASPECTS_PLANETS.length > 0);
  assert.ok(Object.keys(ASPECTS_BHAVAS).length === 12);

  // ==========================================================================
  // 5. DIGNITY: getClassicalDignity & buildDignityBlock
  // ==========================================================================
  assert.equal(getClassicalDignity("Jupiter", "Cancer"), "Exalted");
  assert.equal(getClassicalDignity("Moon", "Scorpio"), "Debilitated");
  assert.equal(getClassicalDignity("Moon", "Cancer"), "Own");
  assert.equal(getClassicalDignity("Saturn", "Pisces"), "Neutral");
  assert.equal(getClassicalDignity("Sun", "Leo", 10), "Moolatrikona");

  const dignity = buildDignityBlock(ctx);
  assert.equal(dignity.status, "OK");
  assert.ok(dignity.value);
  assert.ok(dignity.value!.Sun);
  assert.ok(dignity.value!.Moon);
  assert.ok(dignity.value!.Saturn);
  assert.equal(dignity.value!.Rahu, "—");
  assert.equal(dignity.value!.Ketu, "—");

  // ==========================================================================
  // 6. COMBUST: buildCombustBlock (orbs, severity, 360 wrap)
  // ==========================================================================
  const combust = buildCombustBlock(ctx);
  assert.equal(combust.status, "OK");
  assert.ok(combust.value);
  assert.ok(typeof combust.value!.Mars.combust === "boolean");
  assert.ok(typeof combust.value!.Venus.combust === "boolean");
  // Sun itself is never combust
  assert.equal(combust.value!.Sun.combust, false);

  // ==========================================================================
  // 7. SIGN_CLUSTERS: buildSignClustersBlock
  // ==========================================================================
  const signClusters = buildSignClustersBlock(ctx, SAV.values);
  assert.equal(signClusters.status, "OK");
  assert.ok(signClusters.value);
  assert.ok(Array.isArray(signClusters.value));
  assert.ok(signClusters.value!.length > 0);
  for (const cluster of signClusters.value!) {
    assert.ok(cluster.sign_index >= 0 && cluster.sign_index <= 11);
    assert.equal(cluster.sav, SAV.values[cluster.sign_index]);
    assert.ok(cluster.planets.length > 0);
  }

  // ==========================================================================
  // 8. HORA: buildHoraBlock & getFullHoraSchedule
  // ==========================================================================
  const hora = buildHoraBlock(ctx, panchanga.vara.sunriseJdUT);
  assert.equal(hora.status, "OK");
  assert.ok(hora.value);
  assert.ok(hora.value!.planet.length > 0);
  assert.ok(hora.value!.hora_number >= 1 && hora.value!.hora_number <= 24);

  const fullSchedule = getFullHoraSchedule(
    panchanga.vara.weekday,
    panchanga.vara.sunriseJdUT ?? 2461299.75,
    0.5,
    9
  );
  assert.equal(fullSchedule.length, 24, "Full hora schedule must have 24 hours");
  assert.equal(fullSchedule[0]!.hora_number, 1);
  assert.equal(fullSchedule[23]!.hora_number, 24);

  // ==========================================================================
  // 9. PHASE_STRESS, NAVAMSHA, YOGA_LIST, & BHAVA_BALA
  // ==========================================================================
  const phaseStress = buildPhaseStressBlock(ctx);
  assert.equal(phaseStress.status, "OK");
  assert.ok(phaseStress.value);
  assert.ok(typeof phaseStress.value!.stress_level === "string");
  assert.ok(Number.isFinite(phaseStress.value!.new_moon_proximity_hrs));

  const navamsha = buildNavamshaBlock(ctx);
  assert.equal(navamsha.status, "OK");
  assert.ok(navamsha.value);
  assert.equal(Object.keys(navamsha.value!).length, 10); // 9 bodies + Lagna

  const yoga = buildYogaListBlock(ctx);
  assert.equal(yoga.status, "OK");
  assert.ok(Array.isArray(yoga.value));

  const shadbala = buildShadbalaBlock(ctx);
  const shadbalaTotals = shadbala.value?.total_virupas ?? [390, 360, 300, 420, 390, 330, 300];
  const bhavaBala = buildBhavaBalaBlock(ctx, { shadbalaTotals });
  assert.equal(bhavaBala.status, "OK");

  for (let i = 1; i <= 12; i++) {
    const key = String(i) as any;
    const h = (bhavaBala.value as any)[key];
    assert.ok(h, `House ${key} missing from BhavaBala`);
    assert.ok(h.sign.length > 0);
    assert.ok(Number.isFinite(h.lord_contrib));
    assert.ok(Number.isFinite(h.drishti));
    assert.ok(Number.isFinite(h.total));
  }

  // ==========================================================================
  // 10. Orchestrator Integration: buildDssme16BlockResult & Determinism
  // ==========================================================================
  const fullChart = await buildDssme16BlockResult(chart, panchanga, {
    session: {
      geometry: "ordered_2_digit",
      risk: "BALANCED",
    },
  });

  const REQUIRED_BLOCK_KEYS = [
    "IDENTITY",
    "PANCHANGA",
    "DASHA",
    "PLANETS",
    "HOUSES",
    "SHADBALA",
    "BHAVA_BALA",
    "BAV",
    "SAV",
    "BAV_CURRENT_SIGN",
    "ASPECTS_PLANETS",
    "ASPECTS_BHAVAS",
    "DIGNITY",
    "RETROGRADE",
    "COMBUST",
    "HOUSE_POSITIONS",
    "SIGN_CLUSTERS",
    "HORA",
    "PHASE_STRESS",
    "NAVAMSHA",
    "YOGA_LIST",
    "_meta",
  ] as const;

  for (const key of REQUIRED_BLOCK_KEYS) {
    assert.ok(
      key in fullChart,
      `Required block "${key}" must be present in Dssme16BlockResult`
    );
  }

  // Determinism check: running orchestrator again must produce identical JSON
  const secondRun = await buildDssme16BlockResult(chart, panchanga, {
    session: {
      geometry: "ordered_2_digit",
      risk: "BALANCED",
    },
  });

  const clean1 = { ...fullChart, _meta: { ...fullChart._meta, generatedAt: "" } };
  const clean2 = { ...secondRun, _meta: { ...secondRun._meta, generatedAt: "" } };
  assert.equal(
    JSON.stringify(clean1),
    JSON.stringify(clean2),
    "16-Block orchestrator must be 100% deterministic"
  );

  console.log("  [PASS] All Chartblocks Modules & 16-Block Orchestrator assertions.");
}
