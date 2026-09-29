/**
 * Canonical Validation Test Suite
 * Tests Layer A (Structural Validation) and Layer B (Astronomical Consistency Validation),
 * explicitly asserting that corrupted astronomical charts are caught and rejected.
 */

import assert from "node:assert/strict";
import { generateCanonicalChart } from "../../src/engine/canonical/canonicalChart.ts";
import {
  validateCalculationInput,
  validateCanonicalChart,
  validateAstronomicalConsistency,
} from "../../src/engine/canonical/canonicalValidation.ts";
import { CanonicalChart, DssmeCalculationInput } from "../../src/types/dssme-canonical-types.ts";

export async function runCanonicalValidationTests() {
  console.log("Running Canonical Validation & Consistency Tests...");

  const baseInput: DssmeCalculationInput = {
    date: "2026-09-16",
    time: "14:30:00",
    latitude: 35.65,
    longitude: 139.54,
    timezone: "Asia/Tokyo",
    timezoneOffset: 9,
    ayanamsa: "Lahiri",
  };

  // 1. Valid chart must pass both structural and consistency validation
  const validChart = await generateCanonicalChart(baseInput);
  const structResult = validateCanonicalChart(validChart);
  assert.equal(structResult.isValid, true, "Valid chart must pass structural validation");
  assert.equal(structResult.issues.length, 0);

  const consistResult = validateAstronomicalConsistency(validChart);
  assert.equal(consistResult.isValid, true, "Valid chart must pass astronomical consistency validation");
  assert.equal(consistResult.issues.length, 0);

  // 2. Corruption Vector 1: Longitude ↔ Sign mismatch (35° with "Leo")
  const corruptedSign: CanonicalChart = JSON.parse(JSON.stringify(validChart));
  corruptedSign.planets.Sun.siderealLongitude = 35.0; // Taurus
  corruptedSign.planets.Sun.sign = "Leo"; // Corrupted sign!
  const res1 = validateAstronomicalConsistency(corruptedSign);
  assert.equal(res1.isValid, false, "Corrupted sign must fail consistency validation");
  assert(res1.issues.some((i) => i.field === "planets.Sun.sign"), "Must identify Sun sign mismatch");

  // 3. Corruption Vector 2: Mismatched signDegree
  const corruptedDegree: CanonicalChart = JSON.parse(JSON.stringify(validChart));
  corruptedDegree.planets.Mars.siderealLongitude = 40.0; // Taurus 10°
  corruptedDegree.planets.Mars.sign = "Taurus";
  corruptedDegree.planets.Mars.signDegree = 25.0; // Corrupted degree!
  const res2 = validateAstronomicalConsistency(corruptedDegree);
  assert.equal(res2.isValid, false, "Corrupted signDegree must fail consistency validation");
  assert(res2.issues.some((i) => i.field === "planets.Mars.signDegree"));

  // 4. Corruption Vector 3: Mismatched Nakshatra
  const corruptedNak: CanonicalChart = JSON.parse(JSON.stringify(validChart));
  corruptedNak.planets.Jupiter.siderealLongitude = 5.0; // Ashwini
  corruptedNak.planets.Jupiter.nakshatra = "Rohini"; // Corrupted nakshatra!
  const res3 = validateAstronomicalConsistency(corruptedNak);
  assert.equal(res3.isValid, false, "Corrupted nakshatra must fail consistency validation");
  assert(res3.issues.some((i) => i.field === "planets.Jupiter.nakshatra"));

  // 5. Corruption Vector 4: Mismatched Pada
  const corruptedPada: CanonicalChart = JSON.parse(JSON.stringify(validChart));
  corruptedPada.planets.Venus.siderealLongitude = 1.0; // Ashwini pada 1
  corruptedPada.planets.Venus.nakshatraPada = 4; // Corrupted pada!
  const res4 = validateAstronomicalConsistency(corruptedPada);
  assert.equal(res4.isValid, false, "Corrupted pada must fail consistency validation");
  assert(res4.issues.some((i) => i.field === "planets.Venus.nakshatraPada"));

  // 6. Corruption Vector 5: Rahu ↔ Ketu Non-Opposition
  const corruptedNodes: CanonicalChart = JSON.parse(JSON.stringify(validChart));
  corruptedNodes.planets.Rahu.siderealLongitude = 50.0;
  corruptedNodes.planets.Ketu.siderealLongitude = 100.0; // Not 180° opposite!
  const res5 = validateAstronomicalConsistency(corruptedNodes);
  assert.equal(res5.isValid, false, "Non-opposed Rahu/Ketu must fail consistency validation");
  assert(res5.issues.some((i) => i.field === "planets.Rahu_Ketu_opposition"));

  // 7. Corruption Vector 6: Speed ↔ Retrograde Contradiction
  const corruptedRetro: CanonicalChart = JSON.parse(JSON.stringify(validChart));
  corruptedRetro.planets.Sun.isRetrograde = true; // Sun can never be retrograde
  const res6 = validateAstronomicalConsistency(corruptedRetro);
  assert.equal(res6.isValid, false, "Retrograde Sun must fail consistency validation");
  assert(res6.issues.some((i) => i.field === "planets.Sun.isRetrograde"));

  // 8. Corruption Vector 7: House ↔ Occupants Incoherence
  const corruptedOccupants: CanonicalChart = JSON.parse(JSON.stringify(validChart));
  corruptedOccupants.planets.Saturn.house = 5;
  corruptedOccupants.houses["8"].occupants.push("Saturn"); // Listed in House 8, but planet in 5!
  const res7 = validateAstronomicalConsistency(corruptedOccupants);
  assert.equal(res7.isValid, false, "Mismatched occupant must fail consistency validation");

  // 9. Server-side Timezone Consistency Validation
  assert.throws(
    () => {
      validateCalculationInput({
        ...baseInput,
        timezone: "Asia/Tokyo",
        timezoneOffset: -4, // Inconsistent with Tokyo (which is +9)!
      });
    },
    /TIMEZONE_ERROR/,
    "Server must reject inconsistent timezoneOffset with IANA timezone"
  );

  console.log("✓ Canonical Validation & Consistency Tests Passed!");
}
