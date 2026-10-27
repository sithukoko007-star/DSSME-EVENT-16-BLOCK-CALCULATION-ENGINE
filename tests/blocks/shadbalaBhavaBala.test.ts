/**
 * Deterministic Unit & PL9 Parity Test Suite for:
 *   - BLOCK_6  : SHADBALA        (src/engine/chartblocks/shadbala.ts)
 *   - BLOCK_7  : BHAVA_BALA      (src/engine/chartblocks/bhavaBala.ts)
 *   - BLOCK_11 : ASPECTS_PLANETS (src/engine/chartblocks/aspects.ts)
 *   - BLOCK_12 : ASPECTS_BHAVAS  (src/engine/chartblocks/aspects.ts)
 *   - Orchestrator integration   (src/engine/chartblocks/index.ts)
 *
 * Verifies exact parity against Parashara's Light 9.0 (PL9) reference exports:
 *   - Aspects.pdf ('Aspects on Planets' & 'Aspects on Bhavas')
 *   - Shadbala Summary Table.png (Chofu Reference Chart: 2026-09-16T18:50:00+09:00)
 */

import assert from "node:assert/strict";
import type {
  CanonicalBodyPosition,
  CanonicalChart,
  CanonicalHouse,
  ClassicalPlanet,
  HouseKey,
  NineBody,
  ZodiacSign,
} from "../../src/types/dssme-canonical-types.ts";
import type { BlockContext } from "../../src/engine/blocks/blockTypes.ts";
import {
  type AspectBodyInput,
  buildAllChartBlocks,
  buildAspectsBhavasBlock,
  buildAspectsPlanetsBlock,
  buildBhavaBalaBlock,
  buildShadbalaBlock,
  calculateAspectsOnBhavas,
  calculateAspectsOnPlanets,
  calculateBhavaBala,
  calculateBhavaDigBala,
  calculateDetailedDrigBala,
  calculateIshtaKashta,
  calculatePanchadhaSaptavargaja,
  calculateShadbala,
  classifyBhavaSignNature,
  evaluatePasIAspectFactor,
  evaluateZ2LunarMaleficAspects,
  type PlanetPositionInput,
} from "../../src/engine/chartblocks/index.ts";
import {
  CLASSICAL_PLANETS_ORDER,
  MINIMUM_REQUIRED_VIRUPAS,
  norm360,
} from "../../src/engine/chartblocks/shadbala.ts";

// ============================================================================
// TEST FIXTURE: CHOFU REFERENCE CHART (2026-09-16T18:50:00+09:00, JST)
// ============================================================================

const CHOFU_JD_UT = 2461299.909722222;
const CHOFU_TZ_OFFSET = 9.0;
const CHOFU_LAT = 35.6528;
const CHOFU_LON = 139.5407;
const CHOFU_AYANAMSA = 24.23;
const CHOFU_LAGNA_LON = 355.1458; // Pisces 25°08'45"

const CHOFU_PLANETS_INPUT: readonly PlanetPositionInput[] = [
  { planet: "Sun", lon: 149.3275, speed: 0.9751, retro: false, house: 6, lat: 0.0 },
  { planet: "Moon", lon: 212.2951, speed: 12.15, retro: false, house: 9, lat: 1.2 },
  { planet: "Mars", lon: 88.7524, speed: 0.58, retro: false, house: 4, lat: 0.5 },
  { planet: "Mercury", lon: 165.1552, speed: 1.42, retro: false, house: 7, lat: 1.1 },
  { planet: "Jupiter", lon: 112.6102, speed: 0.18, retro: false, house: 5, lat: 0.3 },
  { planet: "Venus", lon: 189.3875, speed: 0.75, retro: false, house: 8, lat: -1.5 },
  { planet: "Saturn", lon: 348.4514, speed: -0.072, retro: true, house: 1, lat: -2.1 },
];

const CHOFU_NINE_BODIES_INPUT: readonly AspectBodyInput[] = [
  ...CHOFU_PLANETS_INPUT.map((p) => ({
    body: p.planet as NineBody,
    lon: p.lon,
    house: p.house,
  })),
  { body: "Rahu", lon: 305.3167, house: 12 }, // 305:19 in Aspects.pdf
  { body: "Ketu", lon: 125.3167, house: 6 },  // 125:19 in Aspects.pdf
];

const ZODIAC_SIGNS: readonly ZodiacSign[] = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

const SIGN_LORDS_MAP: Record<ZodiacSign, ClassicalPlanet> = {
  Aries: "Mars",
  Taurus: "Venus",
  Gemini: "Mercury",
  Cancer: "Moon",
  Leo: "Sun",
  Virgo: "Mercury",
  Libra: "Venus",
  Scorpio: "Mars",
  Sagittarius: "Jupiter",
  Capricorn: "Saturn",
  Aquarius: "Saturn",
  Pisces: "Jupiter",
};

function assertApprox(
  actual: number,
  expected: number,
  tolerance: number,
  label: string
): void {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= tolerance,
    `${label}: expected ${expected} (±${tolerance}), got ${actual} (diff=${diff.toFixed(4)})`
  );
}

function buildChofuCanonicalChartFixture(): CanonicalChart {
  const makeBody = (
    body: NineBody,
    siderealLon: number,
    speed: number,
    isRetro: boolean,
    house: number,
    lat = 0
  ): CanonicalBodyPosition => {
    const normLon = norm360(siderealLon);
    const signIdx = Math.floor(normLon / 30);
    const sign = ZODIAC_SIGNS[signIdx]!;
    const degreeInSign = normLon - signIdx * 30;
    const nakIdx = Math.floor((normLon * 27) / 360);
    const pada = (Math.floor((normLon * 108) / 360) % 4) + 1;

    return {
      body,
      siderealLongitude: normLon,
      tropicalLongitude: norm360(normLon + CHOFU_AYANAMSA),
      sign,
      degreeInSign,
      signDegree: degreeInSign,
      nakshatra: `Nakshatra_${nakIdx + 1}`,
      pada: pada as 1 | 2 | 3 | 4,
      nakshatraPada: pada as 1 | 2 | 3 | 4,
      house: house as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12,
      speedLongitude: speed,
      isRetrograde: isRetro,
      latitude: lat,
      provenance: {
        source: "swisseph-wasm",
        isDegraded: false,
      },
    } as unknown as CanonicalBodyPosition;
  };

  const planets = {
    Sun: makeBody("Sun", 149.3275, 0.9751, false, 6, 0.0),
    Moon: makeBody("Moon", 212.2951, 12.15, false, 9, 1.2),
    Mars: makeBody("Mars", 88.7524, 0.58, false, 4, 0.5),
    Mercury: makeBody("Mercury", 165.1552, 1.42, false, 7, 1.1),
    Jupiter: makeBody("Jupiter", 112.6102, 0.18, false, 5, 0.3),
    Venus: makeBody("Venus", 189.3875, 0.75, false, 8, -1.5),
    Saturn: makeBody("Saturn", 348.4514, -0.072, true, 1, -2.1),
    Rahu: makeBody("Rahu", 305.3167, -0.053, true, 12, 0.0),
    Ketu: makeBody("Ketu", 125.3167, -0.053, true, 6, 0.0),
  } as Record<NineBody, CanonicalBodyPosition>;

  const houses = {} as Record<HouseKey, CanonicalHouse>;
  for (let h = 1; h <= 12; h++) {
    const hKey = String(h) as HouseKey;
    const signIdx = (11 + (h - 1)) % 12; // H1 = Pisces (11)
    const sign = ZODIAC_SIGNS[signIdx]!;
    const occupants: NineBody[] = [];
    for (const b of Object.keys(planets) as NineBody[]) {
      if (planets[b].house === h) occupants.push(b);
    }
    houses[hKey] = {
      house: h as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12,
      houseNumber: h as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12,
      sign,
      lord: SIGN_LORDS_MAP[sign],
      occupants,
      type:
        h === 1 || h === 4 || h === 7 || h === 10
          ? "Angular"
          : h === 2 || h === 5 || h === 8 || h === 11
          ? "Succedent"
          : "Cadent",
      cuspLongitude: signIdx * 30,
    } as unknown as CanonicalHouse;
  }

  return {
    input: {
      date: "2026-09-16",
      time: "18:50:00",
      timezone: "Asia/Tokyo",
      timezoneOffset: 9,
      latitude: CHOFU_LAT,
      longitude: CHOFU_LON,
      locationName: "Chofu, Japan",
      bodyMode: "9-body",
      objective: "short-cycle speculative extraction",
      risk: "MEDIUM",
      geometry: "ordered_3_digit",
    },
    time: {
      utcIso: "2026-09-16T09:50:00.000Z",
      localIso: "2026-09-16T18:50:00+09:00",
      timezone: "Asia/Tokyo",
      timezoneOffsetHours: CHOFU_TZ_OFFSET,
      julianDayUt: CHOFU_JD_UT,
    },
    location: {
      name: "Chofu, Japan",
      city: "Chofu",
      country: "Japan",
      latitude: CHOFU_LAT,
      longitude: CHOFU_LON,
    },
    ayanamsa: {
      model: "Lahiri",
      value: CHOFU_AYANAMSA,
      valueDegrees: CHOFU_AYANAMSA,
    },
    lagna: {
      siderealLongitude: CHOFU_LAGNA_LON,
      tropicalLongitude: norm360(CHOFU_LAGNA_LON + CHOFU_AYANAMSA),
      sign: "Pisces",
      degreeInSign: 25.1458,
      nakshatra: "Revati",
      pada: 3,
      lagnaType: "Dual",
    },
    planets,
    houses,
    provenance: {
      ephemeris: "swisseph-wasm",
      isDegraded: false,
      sources: {},
      runtime: "node",
    },
  } as unknown as CanonicalChart;
}

// ============================================================================
// SUITE 1: SHADBALA (BLOCK_6) — PL9 PARITY & BPHS CH. 27 VERIFICATION
// ============================================================================

function testShadbalaPl9Parity(): void {
  const equalCusps: Record<number, number> = {
    1: CHOFU_LAGNA_LON,
    4: norm360(CHOFU_LAGNA_LON + 90),
    7: norm360(CHOFU_LAGNA_LON + 180),
    10: norm360(CHOFU_LAGNA_LON + 270),
  };

  const out = calculateShadbala({
    planets: CHOFU_PLANETS_INPUT,
    jdUt: CHOFU_JD_UT,
    tzOffsetHours: CHOFU_TZ_OFFSET,
    geoLonDeg: CHOFU_LON,
    geoLatDeg: CHOFU_LAT,
    ayanamsaDeg: CHOFU_AYANAMSA,
    houseCusps: equalCusps,
    usePanchadhaSaptavargaja: true,
    pl9ParityMode: true,
  });

  // 1. Sthana Bala sub-components & totals (Shadbala Summary Table.png)
  const expectedSapta: Record<ClassicalPlanet, number> = {
    Sun: 129.38,
    Moon: 101.25,
    Mars: 67.50,
    Mercury: 153.75,
    Jupiter: 97.50,
    Venus: 127.50,
    Saturn: 52.50,
  };
  const expectedOjha: Record<ClassicalPlanet, number> = {
    Sun: 30,
    Moon: 30,
    Mars: 30,
    Mercury: 0,
    Jupiter: 0,
    Venus: 0,
    Saturn: 15,
  };
  const expectedKendradi: Record<ClassicalPlanet, number> = {
    Sun: 15,
    Moon: 15,
    Mars: 60,
    Mercury: 60,
    Jupiter: 30,
    Venus: 30,
    Saturn: 60,
  };
  const expectedDrekkana: Record<ClassicalPlanet, number> = {
    Sun: 0,
    Moon: 0,
    Mars: 0,
    Mercury: 15,
    Jupiter: 0,
    Venus: 0,
    Saturn: 15,
  };
  const expectedSthanaTotal: Record<ClassicalPlanet, number> = {
    Sun: 187.93,
    Moon: 146.48,
    Mars: 167.25,
    Mercury: 288.70,
    Jupiter: 181.63,
    Venus: 161.63,
    Saturn: 153.02,
  };

  for (const p of CLASSICAL_PLANETS_ORDER) {
    const sb = out.results[p].sthanaBreakdown;
    assertApprox(sb.saptavargaja, expectedSapta[p], 0.01, `${p} Saptavargaja`);
    assert.equal(sb.ojhaYugma, expectedOjha[p], `${p} Ojha-Yugma`);
    assert.equal(sb.kendradi, expectedKendradi[p], `${p} Kendradi`);
    assert.equal(sb.drekkana, expectedDrekkana[p], `${p} Drekkana`);
    assertApprox(
      out.results[p].sthana,
      expectedSthanaTotal[p],
      0.02,
      `${p} Sthana Bala Total`
    );
  }

  // 2. Dig Bala (Astronomical MC/IC Meridian Cusps in PL9 Parity Mode)
  const expectedDig: Record<ClassicalPlanet, number> = {
    Sun: 24.05,
    Moon: 14.96,
    Mars: 3.86,
    Mercury: 3.33,
    Jupiter: 20.85,
    Venus: 22.60,
    Saturn: 2.24,
  };
  for (const p of CLASSICAL_PLANETS_ORDER) {
    assertApprox(out.results[p].dig, expectedDig[p], 0.02, `${p} Dig Bala`);
  }

  // 3. Kaala Bala sub-components & totals (Shadbala Summary Table.png)
  const expectedNathonnatha: Record<ClassicalPlanet, number> = {
    Sun: 24.04,
    Moon: 35.96,
    Mars: 35.96,
    Mercury: 60.00,
    Jupiter: 24.04,
    Venus: 24.04,
    Saturn: 35.96,
  };
  const expectedPaksha: Record<ClassicalPlanet, number> = {
    Sun: 39.01,
    Moon: 20.99,
    Mars: 39.01,
    Mercury: 20.99,
    Jupiter: 20.99,
    Venus: 20.99,
    Saturn: 39.01,
  };
  const expectedTribhaga: Record<ClassicalPlanet, number> = {
    Sun: 0,
    Moon: 60,
    Mars: 0,
    Mercury: 0,
    Jupiter: 60,
    Venus: 0,
    Saturn: 0,
  };
  const expectedAyana: Record<ClassicalPlanet, number> = {
    Sun: 33.36,
    Moon: 55.03,
    Mars: 57.62,
    Mercury: 34.89,
    Jupiter: 50.52,
    Venus: 13.39,
    Saturn: 23.41,
  };
  const expectedKaalaTotal: Record<ClassicalPlanet, number> = {
    Sun: 111.41,
    Moon: 171.98,
    Mars: 132.59,
    Mercury: 160.88,
    Jupiter: 155.55,
    Venus: 118.42,
    Saturn: 128.39,
  };

  for (const p of CLASSICAL_PLANETS_ORDER) {
    const kb = out.results[p].kaalaBreakdown;
    assertApprox(
      kb.nathonnatha,
      expectedNathonnatha[p],
      0.02,
      `${p} Nathonnatha Bala`
    );
    assertApprox(kb.paksha, expectedPaksha[p], 0.02, `${p} Paksha Bala`);
    assert.equal(kb.tribhaga, expectedTribhaga[p], `${p} Tribhaga Bala`);
    assert.equal(kb.abda, p === "Sun" ? 15 : 0, `${p} Varsha/Abda Bala`);
    assert.equal(kb.masa, p === "Saturn" ? 30 : 0, `${p} Maasa Bala`);
    assert.equal(kb.vaara, p === "Mercury" ? 45 : 0, `${p} Vaara Bala`);
    assert.equal(kb.hora, p === "Venus" ? 60 : 0, `${p} Hora Bala`);
    assertApprox(kb.ayana, expectedAyana[p], 0.02, `${p} Ayana Bala`);
    assert.equal(kb.yuddha, 0, `${p} Yuddha Bala`);
    assertApprox(
      out.results[p].kaala,
      expectedKaalaTotal[p],
      0.02,
      `${p} Kaala Bala Total`
    );
  }

  // 4. Naisargika Bala (PL9 3-decimal Rupa table)
  const expectedNaisargika: Record<ClassicalPlanet, number> = {
    Sun: 60.00,
    Moon: 51.42,
    Mars: 17.16,
    Mercury: 25.74,
    Jupiter: 34.26,
    Venus: 42.84,
    Saturn: 8.58,
  };
  for (const p of CLASSICAL_PLANETS_ORDER) {
    assert.equal(
      out.results[p].naisargika,
      expectedNaisargika[p],
      `${p} Naisargika Bala`
    );
  }

  // 5. Drig Bala (PL9 DEGREE_CONTINUOUS_KNOT + PL9_JUP_MERC_FULL)
  const expectedDrig: Record<ClassicalPlanet, number> = {
    Sun: -5.67,
    Moon: 37.79,
    Mars: 11.19,
    Mercury: -11.98,
    Jupiter: 0.60,
    Venus: 5.80,
    Saturn: 106.62,
  };
  for (const p of CLASSICAL_PLANETS_ORDER) {
    assertApprox(out.results[p].drig, expectedDrig[p], 0.01, `${p} Drig Bala`);
  }

  // 6. Verify Sripati Arithmetic Ishta & Kashta Phala against PL9 table
  const pl9Chesta: Record<ClassicalPlanet, number> = {
    Sun: 32.15, // Sun Uttarayana Chesta Kendra for Ishta Phala in PL9
    Moon: 20.99,
    Mars: 45.90,
    Mercury: 25.87,
    Jupiter: 24.65,
    Venus: 57.34,
    Saturn: 54.03,
  };
  const pl9Uchcha: Record<ClassicalPlanet, number> = {
    Sun: 13.56,
    Moon: 0.23,
    Mars: 9.75,
    Mercury: 59.95,
    Jupiter: 54.13,
    Venus: 4.13,
    Saturn: 10.52,
  };
  const ishtaKashta = calculateIshtaKashta(
    pl9Uchcha,
    pl9Chesta,
    "SRIPATI_ARITHMETIC"
  );
  const expectedIshta: Record<ClassicalPlanet, number> = {
    Sun: 22.85,
    Moon: 10.61,
    Mars: 27.82,
    Mercury: 42.91,
    Jupiter: 39.39,
    Venus: 30.73,
    Saturn: 32.27,
  };
  const expectedKashta: Record<ClassicalPlanet, number> = {
    Sun: 37.15,
    Moon: 49.39,
    Mars: 32.18,
    Mercury: 17.09,
    Jupiter: 20.61,
    Venus: 29.27,
    Saturn: 27.73,
  };
  for (const p of CLASSICAL_PLANETS_ORDER) {
    assertApprox(
      ishtaKashta.byPlanet[p].ishtaVirupas,
      expectedIshta[p],
      0.01,
      `${p} Ishta Phala`
    );
    assertApprox(
      ishtaKashta.byPlanet[p].kashtaVirupas,
      expectedKashta[p],
      0.01,
      `${p} Kashta Phala`
    );
  }
}

// ============================================================================
// SUITE 2: BHAVA_BALA (BLOCK_7) & HARD RULE 10 VERIFICATION
// ============================================================================

function testBhavaBalaAndHardRule10(): void {
  // 1. Verify BPHS Ch. 27 sign nature classifications & 15° splits for Sagittarius and Capricorn
  assert.equal(classifyBhavaSignNature(65), "NARA", "Gemini -> NARA");
  assert.equal(classifyBhavaSignNature(100), "JALA", "Cancer -> JALA");
  assert.equal(classifyBhavaSignNature(15), "CHATUSHPADA", "Aries -> CHATUSHPADA");
  assert.equal(classifyBhavaSignNature(220), "KEETA", "Scorpio -> KEETA");
  assert.equal(
    classifyBhavaSignNature(245),
    "NARA",
    "Sagittarius 5° (first half) -> NARA"
  );
  assert.equal(
    classifyBhavaSignNature(265.15),
    "CHATUSHPADA",
    "Sagittarius 25°09' (second half) -> CHATUSHPADA"
  );
  assert.equal(
    classifyBhavaSignNature(275),
    "CHATUSHPADA",
    "Capricorn 5° (first half) -> CHATUSHPADA"
  );
  assert.equal(
    classifyBhavaSignNature(295.15),
    "JALA",
    "Capricorn 25°09' (second half) -> JALA"
  );

  // 2. Verify Bhava Dig Bala house steps
  const h1Dig = calculateBhavaDigBala(1, CHOFU_LAGNA_LON); // Pisces (JALA -> max in H4, dist=3 -> 30)
  assert.equal(h1Dig.nature, "JALA");
  assert.equal(h1Dig.maxHouse, 4);
  assert.equal(h1Dig.digVirupas, 30);

  const h10Dig = calculateBhavaDigBala(10, norm360(CHOFU_LAGNA_LON + 9 * 30)); // Sag 25°09' (CHATUSHPADA -> max in H10 -> 60)
  assert.equal(h10Dig.nature, "CHATUSHPADA");
  assert.equal(h10Dig.maxHouse, 10);
  assert.equal(h10Dig.digVirupas, 60);

  // 3. Verify full 12-house Bhava Bala calculation with PL9 Shadbala totals
  const pl9ShadbalaByPlanet: Record<ClassicalPlanet, number> = {
    Sun: 411.08,
    Moon: 443.62,
    Mars: 377.94,
    Mercury: 492.54,
    Jupiter: 417.53,
    Venus: 408.62,
    Saturn: 452.86,
  };

  const equalCusps: Record<number, number> = {};
  for (let h = 1; h <= 12; h++) {
    equalCusps[h] = norm360(CHOFU_LAGNA_LON + (h - 1) * 30);
  }

  const bhavaOut = calculateBhavaBala({
    houseCusps: equalCusps,
    shadbalaByPlanet: pl9ShadbalaByPlanet,
    planets: CHOFU_PLANETS_INPUT,
    options: { pl9ParityMode: true },
  });

  // Verify 1.0x full lord Shadbala (no 0.5x scaling bug)
  assert.equal(bhavaOut.byHouse[1].adhipatiVirupas, 417.53, "H1 Lord Jupiter 1.0x");
  assert.equal(bhavaOut.byHouse[4].adhipatiVirupas, 492.54, "H4 Lord Mercury 1.0x");
  assert.equal(bhavaOut.byHouse[11].adhipatiVirupas, 452.86, "H11 Lord Saturn 1.0x");

  // Verify H1 printed aspect scores in drigBreakdown match Aspects.pdf First Bhava row:
  // Sun=47, Moon=7, Mars=16, Mercury=54, Jupiter=57, Venus=31, Saturn=0
  const h1Aspects = (bhavaOut.byHouse as any)[1]?.drigBreakdown?.aspects ?? [];
  const expectedH1Printed: Record<ClassicalPlanet, number> = {
    Sun: 47,
    Moon: 7,
    Mars: 16,
    Mercury: 54,
    Jupiter: 57,
    Venus: 31,
    Saturn: 0,
  };
  for (const asp of h1Aspects) {
    const p = asp.aspector as ClassicalPlanet;
    const score = asp.pl9PrintedScore ?? 0;
    const expected = expectedH1Printed[p];
    if (p === "Mercury") {
      assert.ok(
        Math.abs(score - expected) <= 1,
        `Aspects on Bhavas H1 from ${p}`
      );
    } else {
      assert.equal(
        score,
        expected,
        `Aspects on Bhavas H1 from ${p}`
      );
    }
  }
}

// ============================================================================
// SUITE 3: ASPECTS_PLANETS (BLOCK_11) & ASPECTS_BHAVAS (BLOCK_12) — ASPECTS.PDF PARITY
// ============================================================================

function testAspectsPdfParityAndPipelineGates(): void {
  const { entries, detailedEntries } = calculateAspectsOnPlanets(
    CHOFU_NINE_BODIES_INPUT,
    { pl9ParityMode: true }
  );

  const findPair = (from: NineBody, to: NineBody) =>
    detailedEntries.find((e) => e.from === from && e.to === to);

  // Verify key cells from 'Aspects on Planets' table in Aspects.pdf:
  // Row 1 (Aspected = Sun): Moon 1/4 (1), Mars 1/4 (15), Jupiter (3), Saturn (21), Rahu 4/4 (48)
  assert.equal(findPair("Moon", "Sun")?.pl9PrintedFraction, "1/4");
  assert.equal(findPair("Moon", "Sun")?.score, 1);
  assert.equal(findPair("Mars", "Sun")?.pl9PrintedFraction, "1/4");
  assert.equal(findPair("Mars", "Sun")?.score, 15);
  assert.equal(findPair("Jupiter", "Sun")?.pl9PrintedFraction, null);
  assert.equal(findPair("Jupiter", "Sun")?.score, 3);
  assert.equal(findPair("Saturn", "Sun")?.pl9PrintedFraction, null);
  assert.equal(findPair("Saturn", "Sun")?.score, 21);
  assert.equal(findPair("Rahu", "Sun")?.pl9PrintedFraction, "4/4");
  assert.ok(Math.abs((findPair("Rahu", "Sun")?.score ?? 0) - 48) <= 1);

  // Row 2 (Aspected = Moon): Sun (17), Mars (26), Mercury (8), Jupiter (49), Saturn (38), Rahu (33), Ketu (41)
  assert.equal(findPair("Sun", "Moon")?.score, 17);
  assert.equal(findPair("Sun", "Moon")?.fraction, "3/4");
  assert.equal(findPair("Mars", "Moon")?.score, 26);
  assert.equal(findPair("Mercury", "Moon")?.score, 8);
  assert.equal(findPair("Mercury", "Moon")?.fraction, "1/4");
  assert.equal(findPair("Jupiter", "Moon")?.score, 49);
  assert.equal(findPair("Jupiter", "Moon")?.fraction, "4/4");
  assert.equal(findPair("Saturn", "Moon")?.score, 38);
  assert.equal(findPair("Rahu", "Moon")?.score, 33);
  assert.equal(findPair("Ketu", "Moon")?.score, 41);

  // Row 4 (Aspected = Mercury): Mars 4/4 (39), Jupiter 1/4 (11), Saturn 4/4 (53), Rahu 3/4 (49), Ketu (4)
  assert.equal(findPair("Mars", "Mercury")?.pl9PrintedFraction, "4/4");
  assert.equal(findPair("Mars", "Mercury")?.score, 39);
  assert.equal(findPair("Saturn", "Mercury")?.pl9PrintedFraction, "4/4");
  assert.equal(findPair("Saturn", "Mercury")?.score, 53);

  // Row 7 (Aspected = Saturn): Sun 3/4 (50), Moon 1/2 (13), Mars 1/4 (20), Mercury 4/4 (58), Jupiter 4/4 (57), Venus (18), Rahu (6), Ketu 3/4 (51)
  assert.equal(findPair("Mercury", "Saturn")?.pl9PrintedFraction, "4/4");
  assert.equal(findPair("Mercury", "Saturn")?.score, 58);
  assert.equal(findPair("Jupiter", "Saturn")?.pl9PrintedFraction, "4/4");
  assert.equal(findPair("Jupiter", "Saturn")?.score, 57);
  assert.equal(findPair("Ketu", "Saturn")?.pl9PrintedFraction, "3/4");
  assert.equal(findPair("Ketu", "Saturn")?.score, 51);

  // Verify Zero-Wave Z-2 Lunar Malefic Aspect check:
  // Malefics on Moon: Mars (26), Saturn (38), Rahu (33), Ketu (41) -> only Ketu >= 40 (count = 1 < 2 -> false)
  const z2Check = evaluateZ2LunarMaleficAspects(entries, 40);
  assert.equal(z2Check.maleficCount, 1);
  assert.equal(z2Check.qualifyingMalefics[0]?.from, "Ketu");
  assert.equal(z2Check.triggersDampedPressure, false);

  // Verify Stage S9 PAS_v3 I_aspect factor:
  // Saturn receives 58 from Mercury & 57 from Jupiter vs 50 from Sun -> BeneficSupport (1.02)
  const saturnPas = evaluatePasIAspectFactor("Saturn", entries);
  assert.equal(saturnPas.iAspect, 1.02);
  assert.equal(saturnPas.classification, "BeneficSupport");

  // Mercury receives 53 from Saturn & 49 from Rahu vs 11 from Jupiter -> SevereHostile (0.88)
  const mercuryPas = evaluatePasIAspectFactor("Mercury", entries);
  assert.equal(mercuryPas.iAspect, 0.88);
  assert.equal(mercuryPas.classification, "SevereHostile");

  // Verify 'Aspects on Bhavas' table (BLOCK_12) across all 12 houses including Rahu & Ketu
  const equalCusps = {} as Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12, number>;
  for (let h = 1; h <= 12; h++) {
    equalCusps[h as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12] = norm360(
      CHOFU_LAGNA_LON + (h - 1) * 30
    );
  }
  const bhavaAspects = calculateAspectsOnBhavas(
    CHOFU_NINE_BODIES_INPUT,
    equalCusps,
    undefined,
    { pl9ParityMode: true }
  );

  // Check First Bhava (H1): Sun=47, Moon=7, Mars=16, Mer=54, Jup=57, Ven=31, Rahu=9, Ketu=54
  assert.equal(bhavaAspects["1"].aspects.Sun?.score, 47);
  assert.equal(bhavaAspects["1"].aspects.Moon?.score, 7);
  assert.equal(bhavaAspects["1"].aspects.Mars?.score, 16);
  assert.ok(Math.abs((bhavaAspects["1"].aspects.Mercury?.score ?? 0) - 54) <= 1);
  assert.equal(bhavaAspects["1"].aspects.Jupiter?.score, 57);
  assert.equal(bhavaAspects["1"].aspects.Venus?.score, 31);
  assert.equal(bhavaAspects["1"].aspects.Saturn, undefined);
  assert.equal(bhavaAspects["1"].aspects.Rahu?.score, 9);
  assert.equal(bhavaAspects["1"].aspects.Ketu?.score, 54);

  // Check Eleventh Bhava (H11): Sun=4, Moon=37, Mars=60, Mer=19, Jup=58, Ven=37, Ketu=39
  assert.equal(bhavaAspects["11"].aspects.Sun?.score, 4);
  assert.equal(bhavaAspects["11"].aspects.Moon?.score, 37);
  assert.equal(bhavaAspects["11"].aspects.Mars?.score, 60);
  assert.ok(Math.abs((bhavaAspects["11"].aspects.Mercury?.score ?? 0) - 19) <= 1);
  assert.equal(bhavaAspects["11"].aspects.Jupiter?.score, 58);
  assert.equal(bhavaAspects["11"].aspects.Venus?.score, 37);
  assert.equal(bhavaAspects["11"].aspects.Ketu?.score, 39);
}

// ============================================================================
// SUITE 4: FULL 16-BLOCK ORCHESTRATOR WIRING & DETERMINISM
// ============================================================================

function testChartblocksOrchestratorIntegration(): void {
  const chart = buildChofuCanonicalChartFixture();
  const ctx: BlockContext = { chart };

  const bundle1 = buildAllChartBlocks(ctx, { pl9ParityMode: true });
  const bundle2 = buildAllChartBlocks(ctx, { pl9ParityMode: true });

  assert.equal(
    bundle1.issues.filter((i) => i.severity === "error").length,
    0,
    "No error-severity issues in assembled 16-block bundle"
  );

  // Verify SHADBALA block wiring
  assert.deepEqual(bundle1.result.SHADBALA._columns, CLASSICAL_PLANETS_ORDER);
  assert.deepEqual(
    bundle1.result.SHADBALA.minimum_required,
    MINIMUM_REQUIRED_VIRUPAS
  );
  assert.deepEqual(
    bundle1.result.SHADBALA.drig_bala,
    [-5.67, 37.79, 11.19, -11.98, 0.6, 5.8, 106.62]
  );

  // Verify Hard Rule 10: BHAVA_BALA.lord_contrib equals SHADBALA.total_virupas of the house lord,
  // and BHAVA_BALA never feeds back into SHADBALA.total_virupas.
  const jupiterIdx = CLASSICAL_PLANETS_ORDER.indexOf("Jupiter");
  assert.equal(
    bundle1.result.BHAVA_BALA["1"].lord_contrib,
    bundle1.result.SHADBALA.total_virupas[jupiterIdx],
    "H1 (Pisces) lord_contrib equals Jupiter Shadbala total_virupas"
  );

  // Verify determinism across runs (excluding _meta.generatedAt)
  const clean1 = { ...bundle1.result, _meta: { ...bundle1.result._meta, generatedAt: "FIXED" } };
  const clean2 = { ...bundle2.result, _meta: { ...bundle2.result._meta, generatedAt: "FIXED" } };
  assert.deepEqual(
    JSON.stringify(clean1),
    JSON.stringify(clean2),
    "Assembled 16-block JSON is 100% deterministic across runs"
  );
}

// ============================================================================
// EXPORTED SUITE RUNNER (FOR `tests/run_all_tests.ts`)
// ============================================================================

export async function runShadbalaBhavaBalaTests(): Promise<void> {
  console.log("Running Suite: Phase 3 BPHS Ch. 27 Shadbala & Bhava Bala (PL9 Parity)...");
  testShadbalaPl9Parity();
  testBhavaBalaAndHardRule10();
  testAspectsPdfParityAndPipelineGates();
  testChartblocksOrchestratorIntegration();
  console.log("  [PASS] All BPHS Ch. 27 Shadbala, Bhava Bala & Aspects PL9 assertions.");
}

export const runShadbalaAndBhavaBalaTests = runShadbalaBhavaBalaTests;

// Allow direct standalone execution via: npx tsx tests/blocks/shadbalaBhavaBala.test.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  runShadbalaBhavaBalaTests()
    .then(() => {
      console.log("✅ shadbalaBhavaBala.test.ts: ALL TESTS PASSED");
    })
    .catch((err) => {
      console.error("❌ shadbalaBhavaBala.test.ts FAILED:", err);
      process.exit(1);
    });
}
