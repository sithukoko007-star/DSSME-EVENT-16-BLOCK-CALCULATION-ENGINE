/**
 * Master Test Runner for DSSME Native Calculation Engine (Phase 1)
 */

import { runAscendantAndHousesTests } from "./astronomy/ascendant.test.ts";
import { runAyanamsaTests } from "./astronomy/ayanamsa.test.ts";
import { runJulianDayTests } from "./astronomy/julianDay.test.ts";
import { runPlanetaryPositionsTests } from "./astronomy/planetaryPositions.test.ts";
import { runTimezoneTests } from "./astronomy/timezone.test.ts";
import { runCanonicalChartTests } from "./canonical/canonicalChart.test.ts";
import { runPyjhoraDifferentialTests } from "./differential/pyjhoraDifferential.test.ts";

async function runAll() {
  console.log("============================================================");
  console.log("DSSME NATIVE ENGINE PHASE 1 — FOUNDATION TEST SUITE");
  console.log("============================================================\n");

  try {
    runTimezoneTests();
    runJulianDayTests();
    await runAyanamsaTests();
    await runPlanetaryPositionsTests();
    await runAscendantAndHousesTests();
    await runCanonicalChartTests();
    await runPyjhoraDifferentialTests();

    console.log("\n============================================================");
    console.log("ALL PHASE 1 DETERMINISTIC TESTS PASSED SUCCESSFULLY (7/7)");
    console.log("============================================================");
  } catch (err) {
    console.error("\nTEST SUITE FAILED:", err);
    process.exit(1);
  }
}

runAll();
