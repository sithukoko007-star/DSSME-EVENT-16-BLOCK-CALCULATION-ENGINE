/**
 * DSSME Native Test Suite - BPHS Ch. 27 Shadbala & Bhava Bala
 * File: tests/blocks/shadbalaBhavaBala.test.ts
 *
 * Runs under `tsx tests/run_all_tests.ts` using `node:assert/strict`.
 */

import assert from "node:assert/strict";
import {
  norm360,
  shortestArc,
  computeSevenVargaSigns,
  evaluateVargaDignity,
  calculateSthanaBala,
  calculateDigBala,
  getVedicWeekdayAtJd,
  calculateKaalaBala,
  chestaBala,
  calculateDrigBala,
  calculateDetailedDrigBala,
  calculatePanchadhaSaptavargaja,
  calculateYuddhaBala,
  calculateIshtaKashtaFromShadbala,
  calculateShadbala,
  EXALTATION_DEG,
  PlanetId,
  PlanetPositionInput,
  ShadbalaChartInput,
} from "../../src/engine/chartblocks/shadbala.ts";
import { calculateOuterPlanetChestaBala } from "../../src/engine/strength/chestaBala.ts";
import {
  classifyBhavaSignNature,
  calculateSingleBhavaDigBala,
  calculateBhavaBala,
} from "../../src/engine/chartblocks/bhavaBala.ts";

const CHOFU_PLANETS: readonly PlanetPositionInput[] = [
  { planet: "Sun", lon: 149.33, speed: 0.9751, retro: false, house: 6 },
  { planet: "Moon", lon: 212.30, speed: 12.1881, retro: false, house: 9 },
  { planet: "Mars", lon: 88.75, speed: 0.6096, retro: false, house: 4 },
  { planet: "Mercury", lon: 165.16, speed: 1.5871, retro: false, house: 7 },
  { planet: "Jupiter", lon: 112.61, speed: 0.1968, retro: false, house: 5 },
  { planet: "Venus", lon: 189.39, speed: 0.5312, retro: false, house: 8 },
  { planet: "Saturn", lon: 348.45, speed: -0.0718, retro: true, house: 1 },
];

const CHOFU_CHART_INPUT: ShadbalaChartInput = {
  planets: CHOFU_PLANETS,
  jdUt: 2461299.90972222,
  tzOffsetHours: 9,
  geoLonDeg: 139.54,
  localSunriseHour: 6.0,
  localSunsetHour: 18.0,
  ayanamsaDeg: 24.22,
  houseCusps: {
    1: 350.63,
    4: 92.39,
    7: 170.63,
    10: 272.39,
  },
  masaConvention: "AMANTA_LUNAR",
};

const CHOFU_PLACIDUS_CUSPS: readonly number[] = [
  350.63, 29.05, 63.18, 92.39, 118.45, 143.88,
  170.63, 209.05, 243.18, 272.39, 298.45, 319.12,
];

export function runShadbalaAndBhavaBalaTests(): void {
  console.log("Running Suite: Phase 3 BPHS Ch. 27 Shadbala & Bhava Bala...");

  // 1. Angle & Savana Weekday Helpers
  assert.equal(norm360(-0.5), 359.5);
  assert.equal(shortestArc(10, 350), 20);
  assert.equal(getVedicWeekdayAtJd(2461299.90972222, 9, 6.0), 3);

  // 2. 7-Varga Saptavargaja & Sthana Bala
  for (const [planet, exaltDeg] of Object.entries(EXALTATION_DEG) as [
    PlanetId,
    number,
  ][]) {
    assert.equal(
      calculateSthanaBala({ planet, lon: exaltDeg, speed: 1, house: 1 }).uchcha,
      60.0
    );
    assert.equal(
      calculateSthanaBala({
        planet,
        lon: norm360(exaltDeg + 180),
        speed: 1,
        house: 1,
      }).uchcha,
      0.0
    );
  }

  assert.deepEqual(computeSevenVargaSigns(149.33), {
    D1: 4,
    D2: 3,
    D3: 0,
    D7: 10,
    D9: 8,
    D12: 3,
    D30: 1,
  });

  assert.equal(evaluateVargaDignity("Mercury", "D1", 5, 160.0), "Exalted");
  assert.equal(evaluateVargaDignity("Mercury", "D1", 5, 165.16), "Moolatrikona");
  assert.equal(evaluateVargaDignity("Mercury", "D1", 5, 175.0), "Own");

  // Ojha-Yugma D1+D9 (0, 15, 30) & Decanate Drekkana
  assert.equal(calculateSthanaBala(CHOFU_PLANETS[0]!).ojhaYugma, 30); // Sun
  assert.equal(calculateSthanaBala(CHOFU_PLANETS[1]!).ojhaYugma, 30); // Moon
  assert.equal(calculateSthanaBala(CHOFU_PLANETS[6]!).ojhaYugma, 15); // Saturn
  assert.equal(calculateSthanaBala(CHOFU_PLANETS[3]!).ojhaYugma, 0);  // Mercury
  assert.equal(calculateSthanaBala(CHOFU_PLANETS[6]!).drekkana, 15);  // Saturn in 2nd decanate

  // 3. Panchadha Maitri 7-Varga Saptavargaja (45-to-1.875 scale)
  const panchadha = calculatePanchadhaSaptavargaja(CHOFU_PLANETS);
  assert.equal(panchadha.byPlanet.Sun.totalVirupas, 129.38);
  assert.equal(panchadha.byPlanet.Moon.totalVirupas, 101.25);
  assert.equal(panchadha.byPlanet.Mars.totalVirupas, 67.50);
  assert.equal(panchadha.byPlanet.Mercury.totalVirupas, 153.75);
  assert.equal(panchadha.byPlanet.Jupiter.totalVirupas, 97.50);
  assert.equal(panchadha.byPlanet.Venus.totalVirupas, 127.50);
  assert.equal(panchadha.byPlanet.Saturn.totalVirupas, 52.50);

  // 4. Degree-based Dig Bala & Whole-House Fallback
  assert.equal(
    calculateDigBala(CHOFU_PLANETS[0]!, CHOFU_CHART_INPUT.houseCusps),
    18.98
  );
  assert.equal(
    calculateDigBala({ planet: "Sun", lon: 0, speed: 1, house: 2 }),
    20.0
  );

  // 5. Kaala Bala (Permanent Jupiter +60 Tribhaga, Moon 2x Paksha, Single-Lord Abda/Masa/Vaara/Hora)
  const chofuKaala = calculateKaalaBala(CHOFU_CHART_INPUT);
  assert.equal(chofuKaala.byPlanet.Jupiter.tribhaga, 60);
  assert.equal(chofuKaala.byPlanet.Moon.tribhaga, 60);
  assert.equal(chofuKaala.byPlanet.Moon.paksha, 41.98);
  assert.equal(chofuKaala.byPlanet.Mercury.nathonnatha, 60.0);
  assert.equal(chofuKaala.lords.masaLord, "Venus");
  assert.equal(chofuKaala.lords.vaaraLord, "Mercury");
  assert.equal(chofuKaala.lords.horaLord, "Sun");

  // 6. Chesta Bala (Method 2: Speed & Retrograde BPHS Classical)
  assert.equal(calculateOuterPlanetChestaBala("Mars", -0.3), 60.0); // Retrograde
  assert.equal(calculateOuterPlanetChestaBala("Venus", 0.024), 0.0); // Stationary (<5% mean)
  assert.equal(calculateOuterPlanetChestaBala("Mars", 0.524), 60.0); // Mean speed direct
  assert.equal(calculateOuterPlanetChestaBala("Mars", 0.262), 30.0); // Half speed direct
  assert.equal(chestaBala("Sun", 0.98, 33.28, 20.99), 33.28);
  assert.equal(chestaBala("Moon", 12.18, 33.28, 20.99), 20.99);
  assert.equal(chestaBala("Saturn", -0.0718, 33.28, 20.99), 60.0);

  // 7. Drig Bala (Whole-House /4 Divisor & Degree-Based Piecewise Drishti Kona)
  const drigWhole = calculateDrigBala(CHOFU_PLANETS, "WHOLE_HOUSE");
  assert.equal(drigWhole.Saturn, 30.0);
  assert.equal(drigWhole.Mercury, -30.0);
  assert.equal(drigWhole.Moon, 15.0);

  const drigRaman = calculateDetailedDrigBala(CHOFU_PLANETS, {
    mode: "DEGREE_RAMAN_BAND",
  });
  assert.deepEqual(drigRaman.virupasByPlanet, {
    Sun: -8.12,
    Moon: -8.44,
    Mars: 5.04,
    Mercury: -18.39,
    Jupiter: 0.60,
    Venus: -19.37,
    Saturn: 12.96,
  });

  // 8. Yuddha Bala (Bimba Parimana Planetary War)
  const marsMercWar = CHOFU_PLANETS.map((p) => {
    if (p.planet === "Mars") return { ...p, lon: 164.80, lat: 0.40 };
    if (p.planet === "Mercury") return { ...p, lon: 165.16, lat: 1.25 };
    return p;
  });
  const yuddhaOut = calculateYuddhaBala(marsMercWar, {
    Sun: 144.2,
    Moon: 185.3,
    Mars: 84.6,
    Mercury: 169.32,
    Jupiter: 143.1,
    Venus: 82.8,
    Saturn: 102.3,
  });
  assert.equal(yuddhaOut.hasPlanetaryWar, true);
  assert.equal(yuddhaOut.yuddhaVirupasByPlanet.Mercury, 30.26);
  assert.equal(yuddhaOut.yuddhaVirupasByPlanet.Mars, -30.26);

  // 9. End-to-End Chofu Shadbala & Ishta/Kashta Phala
  const shadbala20Pt = calculateShadbala(CHOFU_CHART_INPUT);
  assert.equal(shadbala20Pt.results.Sun.totalVirupas, 414.4);
  assert.equal(shadbala20Pt.results.Moon.totalVirupas, 409.2);
  assert.equal(shadbala20Pt.results.Saturn.totalVirupas, 379.6);

  const ikOut = calculateIshtaKashtaFromShadbala(shadbala20Pt.results);
  assert.equal(ikOut.byPlanet.Mercury.ishtaVirupas, 42.41);
  assert.equal(ikOut.byPlanet.Jupiter.ishtaVirupas, 40.30);

  const shadbalaPanchadha = calculateShadbala({
    ...CHOFU_CHART_INPUT,
    usePanchadhaSaptavargaja: true,
    drigMode: "WHOLE_HOUSE",
  });
  assert.equal(shadbalaPanchadha.results.Sun.totalVirupas, 468.7);
  assert.equal(shadbalaPanchadha.results.Moon.totalVirupas, 434.5);
  assert.equal(shadbalaPanchadha.results.Mars.totalVirupas, 350.9);
  assert.equal(shadbalaPanchadha.results.Mercury.totalVirupas, 477.0);
  assert.equal(shadbalaPanchadha.results.Jupiter.totalVirupas, 432.6);
  assert.equal(shadbalaPanchadha.results.Venus.totalVirupas, 350.7);
  assert.equal(shadbalaPanchadha.results.Saturn.totalVirupas, 366.1);

  for (const item of shadbalaPanchadha.ordered) {
    assert.equal(item.meetsMinimum, true, `${item.planet} should meet minimum`);
  }

  // 10. 12-House Bhava Bala (Sign Nature Splits & Rankings)
  assert.equal(classifyBhavaSignNature(272.39).nature, "CHATUSHPADA"); // Cap 2.39 deg
  assert.equal(classifyBhavaSignNature(298.45).nature, "JALA");        // Cap 28.45 deg
  assert.equal(calculateSingleBhavaDigBala(10, 272.39).digBalaVirupas, 60);
  assert.equal(calculateSingleBhavaDigBala(11, 298.45).digBalaVirupas, 10);

  const bhavaOut = calculateBhavaBala(
    CHOFU_PLACIDUS_CUSPS,
    CHOFU_PLANETS,
    {
      Sun: 444.4,
      Moon: 439.2,
      Mars: 305.1,
      Mercury: 500.5,
      Jupiter: 423.3,
      Venus: 331.2,
      Saturn: 354.6,
    }
  );
  assert.equal(bhavaOut.houses[1].totalVirupas, 466.8);
  assert.equal(bhavaOut.houses[3].totalVirupas, 546.9);
  assert.equal(bhavaOut.strongestHouse.house, 3);
  assert.equal(bhavaOut.weakestHouse.house, 8);

  console.log("  [PASS] All BPHS Ch. 27 Shadbala & Bhava Bala assertions.");
}
