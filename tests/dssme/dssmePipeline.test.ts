/**
 * DSSME Native Test Suite — DSSME S0→S15 Pipeline Unit Tests
 * File: tests/dssme/dssmePipeline.test.ts
 *
 * Comprehensive TDD unit and contract tests covering:
 *   - S0-S4: Constitution Layer (classifyRegime, selectMode, getEligiblePlanets)
 *   - Z1-Z4: Zero-Wave Safety Gate (computeZ1, computeZ2, computeZ3, computeZ4, reconcileRegime)
 *   - S5-S10d: CPS Construction & Math (computeS, getFriendLevel, Role Bias RB, computeAllCPS)
 *   - S11: Survival Gate (applyS11SurvivalGate, uniform threshold, MD-lord divergence)
 *   - S12: Field Classification (classifyField with Moon exclusion from P_digit)
 *   - Step K: Digit Vector Formation (computeDigitVector, Moon empty set rule)
 *   - Step L: Pair/Triplet Matrices (buildPairMatrix [100 pairs], buildTripletTensor [1000 triplets])
 *   - S15: Final Authorization (authorizeOutput2D, authorizeOutput3D)
 *   - End-to-End Pipeline Execution (runDssmeEngine for 2D and 3D geometries, CLOSED regime abort, determinism)
 */

import assert from "node:assert/strict";
import { generateCanonicalChart } from "../../src/engine/canonical/canonicalChart.ts";
import { computePanchanga, fromCanonicalChart } from "../../src/engine/panchanga/index.ts";
import { buildDssme16BlockResult } from "../../src/engine/chartblocks/index.ts";
import {
  classifyRegime,
  selectMode,
  getEligiblePlanets,
} from "../../src/engine/dssme/s0Phase0.ts";
import {
  computeZ1,
  computeZ2,
  computeZ3,
  computeZ4,
  computeZeroWaveGate,
  reconcileRegime,
} from "../../src/engine/dssme/zeroWaveGate.ts";
import {
  RB,
  computeS,
  getFriendLevel,
  computeAllCPS,
} from "../../src/engine/dssme/cpsFactors.ts";
import { applyS11SurvivalGate } from "../../src/engine/dssme/s11SurvivalGate.ts";
import { classifyField } from "../../src/engine/dssme/s12FieldClassification.ts";
import { computeDigitVector } from "../../src/engine/dssme/stepK.ts";
import { buildPairMatrix, buildTripletTensor } from "../../src/engine/dssme/stepL.ts";
import { authorizeOutput2D, authorizeOutput3D } from "../../src/engine/dssme/s15FinalAuth.ts";
import { runDssmeEngine } from "../../src/engine/dssme/dssmeEngine.ts";
import type {
  DssmeOutput2D,
  DssmeOutput3D,
  DssmeAbortResult,
} from "../../src/engine/dssme/types.ts";
import type { Dssme16BlockResult } from "../../src/types/dssme-canonical-types.ts";

export async function runDssmePipelineTests(): Promise<void> {
  console.log("Running Suite: DSSME S0→S15 Pipeline Unit Tests...");

  // Build live Reference Chart (Chofu: 2026-09-16 18:50 JST)
  const chart = await generateCanonicalChart({
    date: "2026-09-16",
    time: "18:50:00",
    latitude: 35.6528,
    longitude: 139.5447,
    timezone: "Asia/Tokyo",
    timezoneOffset: 9,
    ayanamsa: "Lahiri",
  });
  const panchanga = computePanchanga(fromCanonicalChart(chart));
  const fullChart = await buildDssme16BlockResult(chart, panchanga);

  // ==========================================================================
  // 1. S0–S4: Constitution Layer
  // ==========================================================================
  // 1.1 Regime classification
  const regimeResult = classifyRegime(fullChart);
  assert.ok(["OPEN", "DAMPED", "CLOSED"].includes(regimeResult.regime));
  assert.ok(["HIGH", "MEDIUM", "LOW"].includes(regimeResult.coherence));
  assert.ok(typeof regimeResult.volatilityFlagCount === "number");

  // Hard Rule: 3+ volatility flags forces CLOSED regime
  const closedMockChart: Dssme16BlockResult = {
    ...fullChart,
    PANCHANGA: {
      ...fullChart.PANCHANGA,
      eclipse_proximity: true,
      gandanta_active: true,
      ingress_stacking: true,
    },
  };
  const closedRegime = classifyRegime(closedMockChart);
  assert.equal(closedRegime.regime, "CLOSED");
  assert.equal(closedRegime.coherence, "LOW");
  assert.ok(closedRegime.notes.some((n) => n.includes("CLOSED (hard rule)")));

  // 1.2 Mode selection
  const openHighMode = selectMode("OPEN", "HIGH", "ordered_2_digit");
  assert.equal(openHighMode.mode, "PRECISION");
  assert.equal(openHighMode.theta_s, 0.55);
  assert.equal(openHighMode.k_max, 5);

  const openMediumMode = selectMode("OPEN", "MEDIUM", "ordered_2_digit");
  assert.equal(openMediumMode.mode, "ACCUMULATION");
  assert.equal(openMediumMode.theta_s, 0.45);
  assert.equal(openMediumMode.k_max, 10);

  const closedMode = selectMode("CLOSED", "MEDIUM", "ordered_2_digit");
  assert.equal(closedMode.mode, "ABORT");
  assert.equal(closedMode.theta_s, 0);
  assert.equal(closedMode.k_max, 0);

  // 1.3 Eligibility filter
  const eligible7 = getEligiblePlanets("7-body", "OPEN", "PRECISION");
  assert.equal(eligible7.length, 7);
  assert.ok(!eligible7.includes("Rahu"));
  assert.ok(!eligible7.includes("Ketu"));

  const eligible9 = getEligiblePlanets("9-body", "OPEN", "PRECISION");
  assert.equal(eligible9.length, 9);
  assert.ok(eligible9.includes("Rahu"));
  assert.ok(eligible9.includes("Ketu"));

  const eligibleAbort = getEligiblePlanets("9-body", "CLOSED", "ABORT");
  assert.equal(eligibleAbort.length, 0);

  // ==========================================================================
  // 2. Z1–Z4: Zero-Wave Safety Gate
  // ==========================================================================
  // 2.1 Z1 Entropy
  const z1 = computeZ1(fullChart);
  assert.ok(z1.distinctHouses >= 1 && z1.distinctHouses <= 7);
  assert.ok(["OPEN", "DAMPED", "CLOSED"].includes(z1.z1State));

  // 2.2 Z2 Lunar Stability
  const z2 = computeZ2(fullChart);
  assert.ok(["OPEN", "DAMPED", "CLOSED"].includes(z2.z2State));

  // 2.3 Z3 Volatility Load
  const z3 = computeZ3(fullChart);
  assert.ok(["OPEN", "DAMPED", "CLOSED"].includes(z3.z3State));
  assert.ok(Array.isArray(z3.amplifiers));

  // 2.4 Z4 Phase Stress
  const z4 = computeZ4(fullChart);
  assert.ok(["OPEN", "DAMPED", "CLOSED"].includes(z4.z4State));

  // 2.5 Combined Zero-Wave Gate
  const zw = computeZeroWaveGate(fullChart);
  assert.ok(["OPEN", "DAMPED", "CLOSED"].includes(zw.zw_state));
  assert.equal(zw.notes.length >= 4, true);

  // 2.6 Regime Reconciliation (More restrictive wins)
  assert.equal(reconcileRegime("OPEN", "DAMPED"), "DAMPED");
  assert.equal(reconcileRegime("DAMPED", "OPEN"), "DAMPED");
  assert.equal(reconcileRegime("DAMPED", "CLOSED"), "CLOSED");
  assert.equal(reconcileRegime("CLOSED", "OPEN"), "CLOSED");
  assert.equal(reconcileRegime("OPEN", "OPEN"), "OPEN");

  // ==========================================================================
  // 3. S5–S10d: CPS Construction & Math Helpers
  // ==========================================================================
  // 3.1 computeS
  const sRes = computeS([300, 400, 200]);
  assert.deepEqual(sRes.RS, [300, 400, 200]);
  assert.equal(sRes.S[1], 1.0); // 400 / 400 = 1.0
  assert.equal(sRes.S[0], 0.75); // 300 / 400 = 0.75

  // 3.2 getFriendLevel
  assert.equal(getFriendLevel("Sun", "Moon"), "Friend");
  assert.equal(getFriendLevel("Sun", "Saturn"), "Enemy");
  assert.equal(getFriendLevel("Mars", "Mars"), "Friend"); // same planet = Friend
  assert.equal(getFriendLevel("Rahu", "Mercury"), "Friend"); // Rahu uses Saturn proxy

  // 3.3 Role Bias (RB) contractual constants
  assert.equal(RB.Jupiter, 1.15);
  assert.equal(RB.Venus, 1.15);
  assert.equal(RB.Mercury, 1.10);
  assert.equal(RB.Rahu, 1.10);
  assert.equal(RB.Mars, 1.05);
  assert.equal(RB.Moon, 0.95);
  assert.equal(RB.Sun, 0.95);
  assert.equal(RB.Ketu, 0.90);
  assert.equal(RB.Saturn, 0.85);

  // 3.4 computeAllCPS
  const cpsContext = {
    zw_state: zw.zw_state,
    z3AmplifierCount: zw.amplifiers.length,
    z3Amplifiers: zw.amplifiers,
    tithiIndex: panchanga.tithi.index,
    paksha: fullChart.PANCHANGA.paksha,
    weekdayLord: fullChart.PANCHANGA.weekday_lord as any,
    horaLord: fullChart.HORA.planet,
    moonNakshatra: fullChart.PLANETS.Moon.nakshatra,
  };

  const cpsList = computeAllCPS(fullChart, eligible7, cpsContext);
  assert.equal(cpsList.length, 7);

  for (const f of cpsList) {
    assert.ok(f.planet.length > 0);
    assert.ok(f.CPS_pre_v3 > 0, `CPS_pre_v3 for ${f.planet} must be positive, got ${f.CPS_pre_v3}`);
    assert.ok(Number.isFinite(f.SIF_v3));
    assert.ok(Number.isFinite(f.T_v3));
    assert.ok(Number.isFinite(f.PAS_v3));
    assert.ok(Number.isFinite(f.TM_v3));
    assert.ok(Number.isFinite(f.BHF));
    assert.ok(Number.isFinite(f.DRF));
    assert.ok(Number.isFinite(f.VGF));
    const expectedCps =
      f.S * f.SIF_v3 * f.T_v3 * f.RB * f.PAS_v3 * f.TM_v3 * f.BHF * f.DRF * f.VGF;
    assert.ok(
      Math.abs(f.CPS_pre_v3 - expectedCps) < 1e-6,
      `Master equation mismatch for ${f.planet}`
    );
  }

  // ==========================================================================
  // 4. S11: Survival Gate
  // ==========================================================================
  const s11 = applyS11SurvivalGate(cpsList, 0.45, fullChart.DASHA.mahadasha_planet);
  assert.ok(Array.isArray(s11.P_S));
  assert.equal(typeof s11.aborted, "boolean");
  assert.equal(typeof s11.dasha_divergence, "boolean");

  // ==========================================================================
  // 5. S12: Field Classification & Moon Exclusion
  // ==========================================================================
  const s12 = classifyField(s11.P_S, fullChart);
  assert.ok(s12.fieldType);
  assert.ok(s12.P_digit);
  // Invariant: Moon is excluded from P_digit
  assert.ok(!s12.P_digit.includes("Moon"), "Moon must be excluded from S12 P_digit");

  // ==========================================================================
  // 6. Step K: Digit Vector Formation
  // ==========================================================================
  const digitVector = computeDigitVector(s11.P_S, fullChart);
  assert.ok(digitVector.raw);
  assert.ok(digitVector.normalized);
  for (let d = 0; d <= 9; d++) {
    assert.ok(typeof digitVector.raw[d.toString()] === "number");
    assert.ok(typeof digitVector.normalized[d.toString()] === "number");
  }

  // ==========================================================================
  // 7. Step L: Pair/Triplet Matrices
  // ==========================================================================
  const pairMatrix = buildPairMatrix(digitVector);
  assert.equal(pairMatrix.all_pairs.length, 100, "2D pair matrix must generate all 100 ordered pairs (00-99)");
  assert.ok(pairMatrix.normalization_sum > 0, "2D normalization sum S must be positive");
  const pSum2D = pairMatrix.all_pairs.reduce((acc, p) => acc + p.P_raw, 0);
  assert.ok(Math.abs(pSum2D - 1.0) < 1e-6, "2D pairs probability sum must equal 1.0");

  const tripletTensor = buildTripletTensor(digitVector);
  assert.equal(tripletTensor.all_triplets.length, 1000, "3D triplet tensor must generate all 1000 ordered triplets (000-999)");
  assert.ok(tripletTensor.normalization_sum > 0, "3D normalization sum S must be positive");
  const pSum3D = tripletTensor.all_triplets.reduce((acc, t) => acc + t.P_raw, 0);
  assert.ok(Math.abs(pSum3D - 1.0) < 1e-6, "3D triplets probability sum must equal 1.0");

  // ==========================================================================
  // 8. S15: Final Authorization
  // ==========================================================================
  const auth2D = authorizeOutput2D(pairMatrix, digitVector, 5);
  assert.ok(Array.isArray(auth2D.authorized_pairs));
  assert.ok(auth2D.authorized_pairs.length <= 5);

  const auth3D = authorizeOutput3D(tripletTensor, digitVector, 4);
  assert.ok(Array.isArray(auth3D.authorized_triplets));
  assert.ok(auth3D.authorized_triplets.length <= 4);

  // ==========================================================================
  // 9. End-to-End Pipeline: runDssmeEngine for 2D & 3D Geometries
  // ==========================================================================
  // 9.1 Standard 2D run
  const engineResult2D = runDssmeEngine({
    chart: fullChart,
    bodyMode: "7-body",
    objective: "short-cycle speculative extraction",
    risk: "MEDIUM",
    geometry: "ordered_2_digit",
  });
  assert.ok(engineResult2D);
  const out2D = engineResult2D as DssmeOutput2D;
  assert.ok(out2D.regime);
  assert.ok(out2D.zw_state);
  assert.ok(out2D.mode);
  assert.ok(Array.isArray(out2D.survivors));
  assert.ok(Array.isArray(out2D.authorized_pairs));
  assert.ok(Array.isArray(out2D.cps_audit));

  // 9.2 Standard 3D run
  const engineResult3D = runDssmeEngine({
    chart: fullChart,
    bodyMode: "7-body",
    objective: "short-cycle speculative extraction",
    risk: "MEDIUM",
    geometry: "ordered_3_digit",
  });
  assert.ok(engineResult3D);
  const out3D = engineResult3D as DssmeOutput3D;
  assert.equal(out3D.geometry, "ordered_3_digit");
  assert.ok(Array.isArray(out3D.authorized_triplets));

  // 9.3 Closed chart abort test: when regime is CLOSED, pipeline cleanly aborts
  const closedEngineResult = runDssmeEngine({
    chart: closedMockChart,
    bodyMode: "7-body",
    objective: "short-cycle speculative extraction",
    risk: "MEDIUM",
    geometry: "ordered_2_digit",
  });
  const abortRes = closedEngineResult as DssmeAbortResult;
  assert.equal(abortRes.status, "CLOSED");
  assert.equal(abortRes.regime, "CLOSED");

  // 9.4 Determinism: two identical executions produce byte-for-byte identical output
  const run1 = runDssmeEngine({
    chart: fullChart,
    bodyMode: "9-body",
    objective: "short-cycle speculative extraction",
    risk: "MEDIUM",
    geometry: "ordered_2_digit",
  });
  const run2 = runDssmeEngine({
    chart: fullChart,
    bodyMode: "9-body",
    objective: "short-cycle speculative extraction",
    risk: "MEDIUM",
    geometry: "ordered_2_digit",
  });
  assert.equal(
    JSON.stringify(run1),
    JSON.stringify(run2),
    "runDssmeEngine must be 100% deterministic"
  );

  console.log("  [PASS] All DSSME S0→S15 Pipeline Unit Tests assertions.");
}
