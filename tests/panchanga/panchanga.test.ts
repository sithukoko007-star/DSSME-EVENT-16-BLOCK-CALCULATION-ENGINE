/**
 * DSSME Phase 2: Panchanga Engine Test Suite
 *
 * Verifies:
 * 1. Pure element mathematics (Tithi, Nakshatra, Yoga, Karana, Vara) without ephemeris access.
 * 2. Boundary clamping (360° wrapping cannot produce 28th nakshatra).
 * 3. 60-Karana cycle (k=0 Kimstughna, 7 repeating movables, k=57 Shakuni, k=58 Chatushpada, k=59 Naga).
 * 4. Vara calculation in both 'sunrise' and 'civil' modes, including pre-sunrise day shift.
 * 5. Numerical bisection boundary searches for all transition windows.
 * 6. Strict validation across Gates A through G (including Gate G 1e-9° parity check).
 * 7. Reference fixture verification (Chofu 2026-09-16 and PVR 1970-04-04).
 */

import assert from "node:assert/strict";
import { generateCanonicalChart } from "../../src/engine/canonical/canonicalChart.ts";
import {
  fromCanonicalChart,
  computePanchanga,
  validatePanchanga,
  computeTithi,
  computeNakshatra,
  computeYoga,
  computeKarana,
  computeVara,
  createSwissLongitudeProvider,
  createSunriseProvider,
  findBoundary,
  boundaryWindows,
} from "../../src/engine/panchanga/index.ts";
import { SiderealLongitudes } from "../../src/engine/panchanga/panchangaTypes.ts";

export async function runPanchangaTests() {
  console.log("Running Panchanga Engine (Phase 2) Tests...");

  // ==========================================================================
  // Section 1: Pure Element Mathematics
  // ==========================================================================

  // 1.1 Tithi Math
  // New Moon (Sun = Moon = 100°) -> Tithi 1 (Shukla Pratipada)
  const tithiNew = computeTithi({ sun: 100, moon: 100 });
  assert.equal(tithiNew.index, 1);
  assert.equal(tithiNew.paksha, "shukla");
  assert.equal(tithiNew.numberInPaksha, 1);
  assert.equal(tithiNew.name, "Pratipada");
  assert.equal(tithiNew.elongationDeg, 0);

  // Full Moon (Sun = 0°, Moon = 175°) -> Tithi 15 (Shukla Purnima, span 168°..180°)
  const tithiFull = computeTithi({ sun: 0, moon: 175 });
  assert.equal(tithiFull.index, 15);
  assert.equal(tithiFull.paksha, "shukla");
  assert.equal(tithiFull.numberInPaksha, 15);
  assert.equal(tithiFull.name, "Purnima");

  // Krishna Pratipada starts at exact opposition (Sun = 0°, Moon = 180°) -> Tithi 16
  const tithiKrishnaPratipada = computeTithi({ sun: 0, moon: 180 });
  assert.equal(tithiKrishnaPratipada.index, 16);
  assert.equal(tithiKrishnaPratipada.paksha, "krishna");
  assert.equal(tithiKrishnaPratipada.numberInPaksha, 1);
  assert.equal(tithiKrishnaPratipada.name, "Pratipada");

  // Amavasya (Sun = 0°, Moon = 350°) -> Tithi 30 (Krishna Amavasya)
  const tithiAma = computeTithi({ sun: 0, moon: 350 });
  assert.equal(tithiAma.index, 30);
  assert.equal(tithiAma.paksha, "krishna");
  assert.equal(tithiAma.numberInPaksha, 15);
  assert.equal(tithiAma.name, "Amavasya");

  // 1.2 Nakshatra Math & Clamping
  // 0° -> Ashwini Pada 1
  const nak0 = computeNakshatra({ sun: 0, moon: 0 });
  assert.equal(nak0.index, 1);
  assert.equal(nak0.name, "Ashwini");
  assert.equal(nak0.pada, 1);

  // 359.999999° -> Clamped to Revati Pada 4 (never 28th nakshatra)
  const nak360 = computeNakshatra({ sun: 0, moon: 359.999999 });
  assert.equal(nak360.index, 27);
  assert.equal(nak360.name, "Revati");
  assert.equal(nak360.pada, 4);

  // 1.3 Yoga Math & Precision Boundaries (±1 arcsec and 360°->0° wrap-around)
  // Standard interior point: Sun 50° + Moon 50° = 100° (Span = 13°20' = 13.3333°) -> Index 8 (Dhriti)
  const yoga1 = computeYoga({ sun: 50, moon: 50 });
  assert.equal(yoga1.index, 8);
  assert.equal(yoga1.name, "Dhriti");

  // Yoga Boundary Case 1: Sun + Moon = 359° 59' 59" (359.9997222°) -> Yoga 27 (Vaidhriti)
  const arcsec = 1 / 3600;
  const yogaWrapPre = computeYoga({ sun: 180, moon: 180 - arcsec }); // 359°59'59"
  assert.equal(yogaWrapPre.index, 27);
  assert.equal(yogaWrapPre.name, "Vaidhriti");
  assert(yogaWrapPre.fractionElapsed > 0.9999, "Must be in the final micro-fraction of Vaidhriti");

  // Yoga Boundary Case 2: Sun + Moon = 360° 00' 00" (Exact zero wrap) -> Yoga 1 (Vishkambha)
  const yogaWrapExact = computeYoga({ sun: 180, moon: 180 }); // 360° == 0°
  assert.equal(yogaWrapExact.index, 1);
  assert.equal(yogaWrapExact.name, "Vishkambha");
  assert.equal(yogaWrapExact.fractionElapsed, 0);

  // Yoga Boundary Case 3: Sun + Moon = 360° 00' 01" (+1 arcsec wrap) -> Yoga 1 (Vishkambha)
  const yogaWrapPost = computeYoga({ sun: 180, moon: 180 + arcsec }); // 360°00'01"
  assert.equal(yogaWrapPost.index, 1);
  assert.equal(yogaWrapPost.name, "Vishkambha");
  assert(yogaWrapPost.fractionElapsed > 0 && yogaWrapPost.fractionElapsed < 0.001);

  // Yoga Boundary Case 4: Yoga 1 -> Yoga 2 transition at 13° 20' 00" (13.3333333°)
  const spanYoga = 360 / 27;
  const yoga1End = computeYoga({ sun: 0, moon: spanYoga - arcsec }); // 13°19'59"
  assert.equal(yoga1End.index, 1);
  assert.equal(yoga1End.name, "Vishkambha");

  const yoga2Start = computeYoga({ sun: 0, moon: spanYoga }); // 13°20'00"
  assert.equal(yoga2Start.index, 2);
  assert.equal(yoga2Start.name, "Priti");

  const yoga2Post = computeYoga({ sun: 0, moon: spanYoga + arcsec }); // 13°20'01"
  assert.equal(yoga2Post.index, 2);
  assert.equal(yoga2Post.name, "Priti");

  // 1.4 Karana Math (60 half-tithis)
  // k=0 -> Kimstughna (fixed)
  const karana0 = computeKarana({ sun: 100, moon: 102 });
  assert.equal(karana0.halfTithiIndex, 1);
  assert.equal(karana0.name, "Kimstughna");
  assert.equal(karana0.kind, "fixed");

  // k=1 -> Bava (movable)
  const karana1 = computeKarana({ sun: 100, moon: 107 });
  assert.equal(karana1.halfTithiIndex, 2);
  assert.equal(karana1.name, "Bava");
  assert.equal(karana1.kind, "movable");

  // k=57 -> Shakuni (fixed, index 58)
  const karana57 = computeKarana({ sun: 0, moon: 345 });
  assert.equal(karana57.halfTithiIndex, 58);
  assert.equal(karana57.name, "Shakuni");
  assert.equal(karana57.kind, "fixed");

  // k=58 -> Chatushpada (fixed, index 59)
  const karana58 = computeKarana({ sun: 0, moon: 350 });
  assert.equal(karana58.halfTithiIndex, 59);
  assert.equal(karana58.name, "Chatushpada");
  assert.equal(karana58.kind, "fixed");

  // k=59 -> Naga (fixed, index 60)
  const karana59 = computeKarana({ sun: 0, moon: 357 });
  assert.equal(karana59.halfTithiIndex, 60);
  assert.equal(karana59.name, "Naga");
  assert.equal(karana59.kind, "fixed");

  // 1.5 Vara Math (Sunrise vs Civil Mode)
  const mockSrc = {
    julianDayUT: 2461299.7291666665, // Wednesday 14:30 JST (2026-09-16)
    timezone: "Asia/Tokyo",
    location: { latitude: 35.65, longitude: 139.54 },
  };

  // Civil mode: Wednesday
  const varaCivil = computeVara(mockSrc, "civil");
  assert.equal(varaCivil.name, "Wednesday");
  assert.equal(varaCivil.weekday, 3);

  // Sunrise mode: After sunrise (sunrise ~ 05:25 JST = 2461299.3506 JD) -> Wednesday
  const mockSunrise = () => 2461299.3506;
  const varaSunriseAfter = computeVara(mockSrc, "sunrise", mockSunrise);
  assert.equal(varaSunriseAfter.name, "Wednesday");
  assert.equal(varaSunriseAfter.weekday, 3);

  // Sunrise mode: Before sunrise (e.g. 03:00 JST = 2461299.25 JD < sunrise) -> Preceding day (Tuesday)
  const mockSrcPreSunrise = { ...mockSrc, julianDayUT: 2461299.25 };
  const varaSunriseBefore = computeVara(mockSrcPreSunrise, "sunrise", mockSunrise);
  assert.equal(varaSunriseBefore.name, "Tuesday");
  assert.equal(varaSunriseBefore.weekday, 2);

  // ==========================================================================
  // Section 2: Real Integration with Chofu Reference Chart
  // ==========================================================================
  const chofuChart = await generateCanonicalChart({
    date: "2026-09-16",
    time: "14:30:00",
    latitude: 35.65,
    longitude: 139.54,
    timezone: "Asia/Tokyo",
    timezoneOffset: 9,
    ayanamsa: "Lahiri",
  });

  const chofuSrc = fromCanonicalChart(chofuChart);
  const swissProvider = await createSwissLongitudeProvider();
  const sunriseProvider = createSunriseProvider();

  const chofuPanchanga = computePanchanga(
    chofuSrc,
    { provider: swissProvider, sunrise: sunriseProvider },
    { includeBoundaries: true, varaMode: "sunrise" }
  );

  // Golden assertions for Chofu 2026-09-16 14:30 JST
  assert.equal(chofuPanchanga.tithi.name, "Shashthi");
  assert.equal(chofuPanchanga.tithi.paksha, "shukla");
  assert.equal(chofuPanchanga.tithi.numberInPaksha, 6);
  assert.equal(chofuPanchanga.tithi.index, 6);

  assert.equal(chofuPanchanga.nakshatra.name, "Vishakha");
  assert.equal(chofuPanchanga.nakshatra.pada, 4);

  assert.equal(chofuPanchanga.yoga.name, "Vaidhriti");
  assert.equal(chofuPanchanga.yoga.index, 27);

  assert.equal(chofuPanchanga.karana.name, "Kaulava");
  assert.equal(chofuPanchanga.karana.halfTithiIndex, 11);

  assert.equal(chofuPanchanga.vara.name, "Wednesday");
  assert.equal(chofuPanchanga.vara.weekday, 3);

  // Boundary window verification: chart JD must be strictly inside [startJdUT, endJdUT]
  const tWindow = chofuPanchanga.tithi.window!;
  assert(tWindow.startJdUT! <= chofuSrc.julianDayUT, "Tithi start <= chart JD");
  assert(chofuSrc.julianDayUT <= tWindow.endJdUT!, "Chart JD <= Tithi end");

  const nWindow = chofuPanchanga.nakshatra.window!;
  assert(nWindow.startJdUT! <= chofuSrc.julianDayUT, "Nakshatra start <= chart JD");
  assert(chofuSrc.julianDayUT <= nWindow.endJdUT!, "Chart JD <= Nakshatra end");

  const yWindow = chofuPanchanga.yoga.window!;
  assert(yWindow.startJdUT! <= chofuSrc.julianDayUT, "Yoga start <= chart JD");
  assert(chofuSrc.julianDayUT <= yWindow.endJdUT!, "Chart JD <= Yoga end");

  const kWindow = chofuPanchanga.karana.window!;
  assert(kWindow.startJdUT! <= chofuSrc.julianDayUT, "Karana start <= chart JD");
  assert(chofuSrc.julianDayUT <= kWindow.endJdUT!, "Chart JD <= Karana end");

  // Tithi / Karana Shared Angular-Separation Boundary Identity:
  // Because half-tithi 11 (Kaulava) is the first half of Tithi 6 (Shashthi),
  // Karana start JD and Tithi start JD MUST be mathematically and numerically identical.
  const tithiKaranaStartDelta = Math.abs(tWindow.startJdUT! - kWindow.startJdUT!);
  assert(
    tithiKaranaStartDelta < 1e-9,
    `Tithi and Karana start boundary must derive identically from shared elongation stream: delta = ${tithiKaranaStartDelta}`
  );

  // ==========================================================================
  // Section 3: Gates A Through G Validation
  // ==========================================================================
  const validIssues = validatePanchanga(chofuPanchanga, chofuSrc, swissProvider);
  assert.equal(validIssues.length, 0, `Valid Panchanga must pass all gates: ${JSON.stringify(validIssues)}`);

  // Gate G Parity Test (Provider must match CanonicalChart Sun and Moon within 1e-9°)
  const auxPositions = swissProvider(chofuSrc.julianDayUT);
  const sunError = Math.abs(auxPositions.sun - chofuSrc.longitudes.sun);
  const moonError = Math.abs(auxPositions.moon - chofuSrc.longitudes.moon);
  const tolerance = 1e-9;

  assert(
    sunError <= tolerance,
    `Auxiliary provider Sun parity must be within ${tolerance}°, got ${sunError}°`
  );
  assert(
    moonError <= tolerance,
    `Auxiliary provider Moon parity must be within ${tolerance}°, got ${moonError}°`
  );

  // Corrupted Parity failure test
  const corruptedSrc = {
    ...chofuSrc,
    longitudes: { sun: chofuSrc.longitudes.sun + 0.001, moon: chofuSrc.longitudes.moon },
  };
  const parityIssues = validatePanchanga(chofuPanchanga, corruptedSrc, swissProvider);
  assert(
    parityIssues.some((i) => i.gate === "G.parity"),
    "Must catch divergence between auxiliary provider and CanonicalChart"
  );

  // ==========================================================================
  // Section 4: PVR Narasimha Rao Reference Fixture
  // ==========================================================================
  const pvrChart = await generateCanonicalChart({
    date: "1970-04-04",
    time: "17:47:00",
    latitude: 16.18,
    longitude: 81.13,
    timezone: "Asia/Kolkata",
    timezoneOffset: 5.5,
    ayanamsa: "Lahiri",
  });

  const pvrSrc = fromCanonicalChart(pvrChart);
  const pvrPanchanga = computePanchanga(
    pvrSrc,
    { provider: swissProvider, sunrise: sunriseProvider },
    { includeBoundaries: true, varaMode: "sunrise" }
  );

  assert.equal(pvrPanchanga.tithi.name, "Chaturdashi");
  assert.equal(pvrPanchanga.tithi.paksha, "krishna");
  assert.equal(pvrPanchanga.tithi.numberInPaksha, 14);
  assert.equal(pvrPanchanga.nakshatra.name, "Purva Bhadrapada");
  assert.equal(pvrPanchanga.nakshatra.pada, 3);
  assert.equal(pvrPanchanga.yoga.name, "Shukla");
  assert.equal(pvrPanchanga.yoga.index, 24);
  assert.equal(pvrPanchanga.karana.name, "Vishti");
  assert.equal(pvrPanchanga.vara.name, "Saturday");
  assert.equal(pvrPanchanga.vara.weekday, 6);

  const pvrIssues = validatePanchanga(pvrPanchanga, pvrSrc, swissProvider);
  assert.equal(pvrIssues.length, 0, "PVR Panchanga must pass all gates");

  console.log("✓ Panchanga Engine (Phase 2) Tests Passed (Gates A-G Verified)!");
}
