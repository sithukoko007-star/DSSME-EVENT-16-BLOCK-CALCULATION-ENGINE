/**
 * Master Test Runner for DSSME Native Calculation Engine (Phase 1)
 * Dynamically registers, executes, and audits all deterministic test suites.
 */

import { runAscendantAndHousesTests } from "./astronomy/ascendant.test.ts";
import { runAscendantFallbackTests } from "./astronomy/ascendantFallback.test.ts";
import { runAyanamsaTests } from "./astronomy/ayanamsa.test.ts";
import { runJulianDayTests } from "./astronomy/julianDay.test.ts";
import { runPlanetaryPositionsTests } from "./astronomy/planetaryPositions.test.ts";
import { runTimezoneTests } from "./astronomy/timezone.test.ts";
import { runTimezoneHelperTests } from "./astronomy/timezoneHelper.test.ts";
import { runCanonicalChartTests } from "./canonical/canonicalChart.test.ts";
import { runCanonicalValidationTests } from "./canonical/canonicalValidation.test.ts";
import { runPyjhoraDifferentialTests } from "./differential/pyjhoraDifferential.test.ts";
import { runPanchangaTests } from "./panchanga/panchanga.test.ts";

interface TestSuiteEntry {
  name: string;
  run: () => Promise<void> | void;
}

const REGISTERED_SUITES: TestSuiteEntry[] = [
  { name: "Timezone & UTC Resolution", run: runTimezoneTests },
  { name: "Timezone Helper & IANA Offset Derivation", run: runTimezoneHelperTests },
  { name: "Julian Day UT Calculation", run: runJulianDayTests },
  { name: "Lahiri Ayanamsa Calculation", run: runAyanamsaTests },
  { name: "Planetary Positions Calculation", run: runPlanetaryPositionsTests },
  { name: "Ascendant & Houses Calculation", run: runAscendantAndHousesTests },
  { name: "Swiss-vs-Fallback Ascendant Regression", run: runAscendantFallbackTests },
  { name: "CanonicalChart Builder & Determinism", run: runCanonicalChartTests },
  { name: "Canonical Validation & Consistency", run: runCanonicalValidationTests },
  { name: "PyJHora-Derived Reference Fixtures", run: runPyjhoraDifferentialTests },
  { name: "Panchanga Engine (Phase 2 - Gates A-G)", run: runPanchangaTests },
];

async function runAll() {
  console.log("============================================================");
  console.log("DSSME NATIVE ENGINE (PHASES 1 & 2) — DETERMINISTIC TEST SUITE");
  console.log("============================================================\n");

  const totalRegistered = REGISTERED_SUITES.length;
  let passedCount = 0;
  const failedSuites: { name: string; error: unknown }[] = [];

  for (const suite of REGISTERED_SUITES) {
    try {
      await suite.run();
      passedCount++;
    } catch (err) {
      console.error(`\n❌ [FAILED] Suite "${suite.name}":`, err);
      failedSuites.push({ name: suite.name, error: err });
    }
  }

  console.log("\n============================================================");
  if (failedSuites.length === 0) {
    console.log(
      `ALL DSSME DETERMINISTIC TESTS PASSED SUCCESSFULLY (${passedCount}/${totalRegistered})`
    );
  } else {
    console.error(
      `DSSME TEST AUDIT FAILED: ${failedSuites.length} of ${totalRegistered} suites failed.`
    );
    for (const f of failedSuites) {
      console.error(` - ${f.name}`);
    }
    process.exit(1);
  }
  console.log("============================================================");
}

runAll();
