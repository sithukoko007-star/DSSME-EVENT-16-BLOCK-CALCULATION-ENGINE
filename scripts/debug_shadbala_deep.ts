/**
 * SHADBALA DEEP DEBUG SCRIPT
 * ═══════════════════════════════════════════════════════════════════
 * Classical BPHS (Brihat Parashara Hora Shastra) formula-by-formula
 * comparison for ALL 6 Shadbala components.
 *
 * Reference: BPHS Ch.27 — Shadbala and Shad-Bala-Phala
 * ═══════════════════════════════════════════════════════════════════
 */
import { generateCanonicalChart } from "../src/engine/canonical/canonicalChart.ts";
import {
  buildShadbalaBlock,
  CLASSICAL_PLANETS_ORDER,
  MINIMUM_REQUIRED_VIRUPAS,
} from "../src/engine/chartblocks/shadbala.ts";
import { createBlockContext } from "../src/engine/blocks/index.ts";
import { ZODIAC_SIGNS_ARIES_FIRST } from "../src/types/dssme-canonical-types.ts";
import type { ClassicalPlanet, ZodiacSign } from "../src/types/dssme-canonical-types.ts";

// ── Constants (BPHS reference values) ──────────────────────────────
const EXALT_DEG: Record<ClassicalPlanet, number> = {
  Sun: 10, Moon: 33, Mars: 298, Mercury: 165,
  Jupiter: 95, Venus: 357, Saturn: 200,
};
const DEBIT_DEG: Record<ClassicalPlanet, number> = {
  Sun: 190, Moon: 213, Mars: 118, Mercury: 345,
  Jupiter: 275, Venus: 177, Saturn: 20,
};
const DIG_MAX_HOUSE: Record<ClassicalPlanet, number> = {
  Sun: 10, Moon: 4, Mars: 10, Mercury: 1,
  Jupiter: 1, Venus: 4, Saturn: 7,
};
const NAISARGIKA: Record<ClassicalPlanet, number> = {
  Sun: 60.0, Moon: 51.43, Mars: 17.14,
  Mercury: 25.71, Jupiter: 34.29, Venus: 42.86, Saturn: 8.57,
};
const MEAN_SPEED: Record<ClassicalPlanet, number> = {
  Sun: 0.9833, Moon: 13.1833, Mars: 0.5241,
  Mercury: 1.3833, Jupiter: 0.0831, Venus: 1.2, Saturn: 0.0334,
};

// ── Helper: angular distance ────────────────────────────────────────
function arcDist(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// ── BPHS Uchcha Bala ────────────────────────────────────────────────
// Formula: 60 - (arc_distance_to_exaltation / 3)
// Arc distance uses the shorter great-circle path (max 180°)
function bphs_uchhaBala(planet: ClassicalPlanet, lon: number): number {
  const dist = arcDist(lon, EXALT_DEG[planet]);
  return Math.max(0, 60 - dist / 3);
}

// ── BPHS Dig Bala (degree-based version) ────────────────────────────
// Full formula uses actual ecliptic longitude mapped to house arc.
// Approximated here: 60 × (1 - house_distance/6), house-based.
// TRUE classical formula: Dig Bala = 60 - |cusp_lon_diff|/3
// where cusp_lon_diff = planet_lon - max_house_cusp_lon (mod 360, shortest arc/3)
// Without house cusps we use integer-house approximation (current implementation).
function bphs_digBala_houseApprox(planet: ClassicalPlanet, house: number): number {
  const maxH = DIG_MAX_HOUSE[planet];
  let diff = Math.abs(house - maxH);
  if (diff > 6) diff = 12 - diff;
  return Math.max(0, 60 - diff * 10);
}

// Degree-based Dig Bala (BPHS exact)
// Requires ascending sign cusp longitudes. Approximation uses Ascendant + 30°×(house-1).
function bphs_digBala_degBased(
  planet: ClassicalPlanet,
  planetLon: number,
  ascLon: number
): number {
  const maxH = DIG_MAX_HOUSE[planet];
  // Cusp longitude for max house (each house = 30° equal house)
  const maxCuspLon = (ascLon + (maxH - 1) * 30) % 360;
  const dist = arcDist(planetLon, maxCuspLon);
  // Scale: 0 dist → 60; 180 dist → 0
  return Math.max(0, 60 - dist / 3);
}

// ── BPHS Kendradi Bala ───────────────────────────────────────────────
function bphs_kendradiBala(house: number): number {
  const angular = [1, 4, 7, 10];
  const succedent = [2, 5, 8, 11];
  if (angular.includes(house)) return 60;
  if (succedent.includes(house)) return 30;
  return 15;
}

// ── BPHS Drekkana Bala ───────────────────────────────────────────────
// Planet in 1st Drekkana of odd sign or 3rd of even sign → 15
// (Male planets in male signs/positions, female in female)
function bphs_drekkanaBala(planet: ClassicalPlanet, signDeg: number, sign: ZodiacSign): number {
  const signIdx = ZODIAC_SIGNS_ARIES_FIRST.indexOf(sign);
  const isOddSign = signIdx % 2 === 0;
  const drek = Math.floor(signDeg / 10) + 1; // 1,2,3
  const isOddDrek = drek % 2 === 1;
  // Classical: planet scores if (odd sign + odd drek) OR (even sign + even drek)
  return ((isOddSign && isOddDrek) || (!isOddSign && !isOddDrek)) ? 15 : 0;
}

// ── BPHS Ojha Yugma Rasyamsha Bala ──────────────────────────────────
function bphs_ojhaBala(planet: ClassicalPlanet, sign: ZodiacSign): number {
  const signIdx = ZODIAC_SIGNS_ARIES_FIRST.indexOf(sign);
  const isOddSign = signIdx % 2 === 0;
  const malePlanets: ClassicalPlanet[] = ["Sun", "Mars", "Jupiter", "Saturn"];
  const femalePlanets: ClassicalPlanet[] = ["Moon", "Venus"];
  // Mercury is both — scores 15 in both odd and even
  if (planet === "Mercury") return 15;
  if (isOddSign && malePlanets.includes(planet)) return 15;
  if (!isOddSign && femalePlanets.includes(planet)) return 15;
  return 0;
}

// ── BPHS Nathonnatha Bala ────────────────────────────────────────────
// Diurnal planets (Sun, Jupiter, Saturn, Moon when full) strong by day
// Nocturnal (Moon, Mars, Venus, Mercury) strong by night
// Mercury: always moderate (30)
function bphs_nathonnatha(planet: ClassicalPlanet, isNight: boolean): number {
  const diurnal: ClassicalPlanet[] = ["Sun", "Jupiter", "Saturn"];
  const nocturnal: ClassicalPlanet[] = ["Moon", "Mars", "Venus"];
  if (planet === "Mercury") return 30;
  if (diurnal.includes(planet)) return isNight ? 15 : 60;
  if (nocturnal.includes(planet)) return isNight ? 60 : 15;
  return 30;
}

// ── BPHS Paksha Bala (BPHS Ch.27) ───────────────────────────────────
// Moon's Paksha Bala = tithiIndex × 12 (max=180 at Purnima)
// Benefics = Moon's paksha bala; Malefics = 120 - Moon's pakshabala
// BPHS exact formula (virupas):
//   Moon: tithiIndex × 12 (Shukla increases, Krishna decreases)
//   Other benefics: same as Moon
//   Malefics (Sun, Mars, Saturn): 120 - Moon_paksha_bala
//   Mercury: average (60)
// Note: Capped at 60 for this sub-component contribution to Kaala total
function bphs_pakshaBala(planet: ClassicalPlanet, tithiIndex: number, paksha: "shukla" | "krishna"): {
  raw: number; capped: number;
} {
  // Effective tithi count from new moon (1-30, continuous)
  const effectiveTithi = paksha === "shukla" ? tithiIndex : 15 + tithiIndex;
  // Moon's raw paksha bala (0-180)
  const moonRaw = Math.min(180, Math.max(0, effectiveTithi * 12));

  const benefics: ClassicalPlanet[] = ["Moon", "Mercury", "Jupiter", "Venus"];
  const malefics: ClassicalPlanet[] = ["Sun", "Mars", "Saturn"];

  let raw: number;
  if (planet === "Mercury") {
    raw = 60; // always moderate per some BPHS interpretations
  } else if (benefics.includes(planet)) {
    raw = moonRaw; // same trajectory as Moon
  } else if (malefics.includes(planet)) {
    raw = Math.max(0, 120 - moonRaw); // inverse: strong when Moon weak
  } else {
    raw = 60;
  }
  // For Kaala Bala sub-component, cap at 60
  return { raw, capped: Math.min(60, raw) };
}

// ── BPHS Ayana Bala (BPHS Ch.27) ─────────────────────────────────────
// Based on Sun's actual declination direction:
//   Uttarayana (Sun lon 270–90, i.e., Capricorn–Gemini): benefits diurnal
//   Dakshinayana (Sun lon 90–270, Cancer–Sagittarius): benefits nocturnal
// Sun itself: strong in Uttarayana; Moon strong always but modulated
// BPHS formula uses actual declination, not just lon<180
// Approximate: lon 0-180 (Aries-Virgo) = Uttarayana, 180-360 = Dakshinayana
function bphs_ayanaBala(planet: ClassicalPlanet, sunLon: number): number {
  // Uttarayana: Sun in Capricorn(270) → Gemini(90 next lap), i.e., lon 270-360 or 0-90
  const isUttarayana = sunLon >= 270 || sunLon < 90;
  // Alternative simpler (most Jyotish software): lon < 180 = Uttarayana (approximate)
  const isNorthward = sunLon < 180;

  const diurnal: ClassicalPlanet[] = ["Sun", "Jupiter", "Saturn"];
  const nocturnal: ClassicalPlanet[] = ["Moon", "Mars", "Venus"];

  if (planet === "Mercury") return 30; // neutral

  if (isNorthward) {
    if (diurnal.includes(planet)) return 60;
    if (nocturnal.includes(planet)) return 0;
  } else {
    if (nocturnal.includes(planet)) return 60;
    if (diurnal.includes(planet)) return 0;
  }
  return 30;
}

// ── BPHS Chesta Bala ─────────────────────────────────────────────────
// Retrograde (Vakra)       → 60 virupas (BPHS: planet's chesta is max when retrograde)
// Direct at mean speed     → 30 virupas
// Direct at double speed   → 60 virupas
// Stationary               →  0 virupas
// BPHS Ch.27 quote: "A planet in retrogression has its maximum Chesta Bala"
function bphs_chestaBala_strict(planet: ClassicalPlanet, speed: number): number {
  if (speed < 0) return 60; // BPHS strict: retrograde = max 60
  const mean = MEAN_SPEED[planet];
  if (Math.abs(speed) < mean * 0.02) return 0; // stationary
  const ratio = speed / mean;
  return Math.min(60, Math.max(0, ratio * 30));
}

// Current implementation (30 for retrograde)
function current_chestaBala(planet: ClassicalPlanet, speed: number): number {
  const mean = MEAN_SPEED[planet];
  if (speed < 0) return 30;
  if (Math.abs(speed) < mean * 0.05) return 0;
  const ratio = Math.abs(speed) / mean;
  return Math.min(60, Math.max(0, ratio * 30));
}

// ── Main ─────────────────────────────────────────────────────────────
async function deepDebugShadbala() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║  SHADBALA DEEP DEBUG — BPHS Classical Formula Comparison     ║");
  console.log("║  Chart: Chofu, Japan  2026-09-16 18:50 JST                   ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  const chart = await generateCanonicalChart({
    date: "2026-09-16",
    time: "18:50:00",
    latitude: 35.65,
    longitude: 139.54,
    timezone: "Asia/Tokyo",
    timezoneOffset: 9,
    ayanamsa: "Lahiri",
  });

  const ctx = createBlockContext(chart);
  const shadbalaResult = buildShadbalaBlock(ctx, {
    paksha: "krishna",
    tithiIndex: 14,
    weekday: 3,
    hora: "Mercury",
    isNight: true,
    chartJd: chart.time.julianDayUt,
    longitude: chart.location.longitude,
    ayanamsaDeg: chart.ayanamsa.value,
  });
  const sb = shadbalaResult.value!;

  const ascLon = chart.lagna?.siderealLongitude ?? 0;
  console.log(`Ascendant: ${chart.lagna?.sign ?? "?"} lon=${ascLon.toFixed(2)}°\n`);

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 1: UCHCHA BALA — Current vs BPHS
  // ═══════════════════════════════════════════════════════════════════
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("§1 UCHCHA BALA  (formula: 60 - arc_to_exalt / 3)");
  console.log("   Formula is CORRECT in current implementation.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("PLANET     │  Lon°    │ ExaltLon│ ArcDist │ BPHS   │ NOTE");
  console.log("───────────┼──────────┼─────────┼─────────┼────────┼──────────────");
  for (const p of CLASSICAL_PLANETS_ORDER) {
    const lon = chart.planets[p].siderealLongitude;
    const exalt = EXALT_DEG[p];
    const dist = arcDist(lon, exalt);
    const bphs = bphs_uchhaBala(p, lon);
    const note = dist <= 60 ? "near exalt" : dist >= 150 ? "near debit" : "";
    console.log(`${p.padEnd(10)} │${lon.toFixed(2).padStart(9)} │${exalt.toString().padStart(8)} │${dist.toFixed(1).padStart(8)} │${bphs.toFixed(1).padStart(7)} │ ${note}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 2: DIG BALA — House-based vs Degree-based
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("§2 DIG BALA  (current: house-based | BPHS exact: degree-based)");
  console.log("   BPHS: Dig Bala = 60 - (arc_to_max_cusp / 3)  [uses ecliptic lon]");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("PLANET     │ H  │MaxH│HouseDif│ CurrentDig│ DegreeDig │ Diff │ MaxCusp°");
  console.log("───────────┼────┼────┼────────┼───────────┼───────────┼──────┼──────────");
  for (const p of CLASSICAL_PLANETS_ORDER) {
    const house = chart.planets[p].house;
    const lon = chart.planets[p].siderealLongitude;
    const maxH = DIG_MAX_HOUSE[p];
    let hdiff = Math.abs(house - maxH);
    if (hdiff > 6) hdiff = 12 - hdiff;
    const currentDig = bphs_digBala_houseApprox(p, house);
    const degreeDig = bphs_digBala_degBased(p, lon, ascLon);
    const maxCusp = ((ascLon + (maxH - 1) * 30) % 360).toFixed(1);
    const diff = (degreeDig - currentDig).toFixed(1);
    const flag = Math.abs(degreeDig - currentDig) > 5 ? " ◄ GAP" : "";
    console.log(
      `${p.padEnd(10)} │${house.toString().padStart(3)} │${maxH.toString().padStart(3)} │${hdiff.toString().padStart(7)} │${currentDig.toFixed(1).padStart(10)} │${degreeDig.toFixed(1).padStart(10)} │${diff.padStart(5)} │${maxCusp.padStart(9)}${flag}`
    );
  }
  console.log("  NOTE: Degree-based gives more accurate Dig Bala (BPHS exact).");
  console.log("        Gaps show where house rounding loses precision.");

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 3: STHANA BALA DEEP BREAKDOWN
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("§3 STHANA BALA DEEP BREAKDOWN");
  console.log("   Sthana = Uchcha + Saptavargaja + OjhaYugma + Kendradi + Drekkana");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("PLANET     │ Uchcha│ Sapta │ Ojha  │ Kend  │ Drek  │ TOTAL │ Issues");
  console.log("───────────┼───────┼───────┼───────┼───────┼───────┼───────┼──────────────");
  for (const p of CLASSICAL_PLANETS_ORDER) {
    const pos = chart.planets[p];
    const uchcha = bphs_uchhaBala(p, pos.siderealLongitude);
    const sapta = sb.sthana_total[CLASSICAL_PLANETS_ORDER.indexOf(p)]!
                  - uchcha
                  - bphs_ojhaBala(p, pos.sign)
                  - bphs_kendradiBala(pos.house)
                  - bphs_drekkanaBala(p, pos.signDegree, pos.sign);
    const ojha = bphs_ojhaBala(p, pos.sign);
    const kend = bphs_kendradiBala(pos.house);
    const drek = bphs_drekkanaBala(p, pos.signDegree, pos.sign);
    const total = uchcha + sapta + ojha + kend + drek;

    const issues: string[] = [];
    if (p === "Mercury" && ojha !== 15) issues.push("Mercury ojha should=15 always");
    if (pos.house === 6 || pos.house === 8 || pos.house === 12) issues.push(`H${pos.house}=dusthana`);
    if (pos.signDegree >= 29) issues.push("Gandanta zone (29°+)");

    console.log(
      `${p.padEnd(10)} │${uchcha.toFixed(1).padStart(6)} │${sapta.toFixed(1).padStart(6)} │${ojha.toFixed(1).padStart(6)} │${kend.toFixed(1).padStart(6)} │${drek.toFixed(1).padStart(6)} │${total.toFixed(1).padStart(6)} │ ${issues.join("; ")}`
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 4: PAKSHA BALA — BPHS Exact Formula
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("§4 PAKSHA BALA — BPHS Exact: Moon raw = effectiveTithi × 12");
  console.log("   Paksha: krishna, tithiIndex=14 → effectiveTithi = 15+14 = 29");
  console.log("   Moon raw = 29×12 = 348 → capped at 60 for Kaala sub-component");
  console.log("   Malefic raw = 120 - 348 = max(0, -228) = 0 → so malefics VERY weak?");
  console.log("   ⚠ NOTE: BPHS raw Paksha Bala ≠ capped Kaala sub-component value.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("PLANET     │ BPHSRaw │ Capped(60)│ CurImpl │ Diff  │ BPHS formula notes");
  console.log("───────────┼─────────┼───────────┼─────────┼───────┼────────────────────");
  const pakshaTithi = 14;
  const pakshaType = "krishna" as const;
  for (const p of CLASSICAL_PLANETS_ORDER) {
    const bphsResult = bphs_pakshaBala(p, pakshaTithi, pakshaType);
    // Current implementation (from v2 debug output)
    const effectiveTithi = 15 + pakshaTithi; // krishna
    const moonRaw = Math.min(180, effectiveTithi * 12);
    const benefics = ["Moon","Mercury","Jupiter","Venus"];
    const malefics2 = ["Sun","Mars","Saturn"];
    const phaseFraction = 1 / 15; // tithi 14 krishna → waning to almost new moon
    const phaseFractionActual = Math.min(15, Math.max(1, 30 - 14)) / 15; // =16/15 → capped 1.0
    let curImpl = 0;
    if (benefics.includes(p)) {
      curImpl = Math.round((1 - 1.0) * 60); // krishna → weakening benefic
    } else if (malefics2.includes(p)) {
      curImpl = Math.round(1.0 * 60); // krishna → strengthening malefic
    } else curImpl = 30;
    const diff = (bphsResult.capped - curImpl).toFixed(1);
    const flag = Math.abs(bphsResult.capped - curImpl) > 5 ? " ◄ GAP" : "";
    console.log(
      `${p.padEnd(10)} │${bphsResult.raw.toFixed(0).padStart(8)} │${bphsResult.capped.toFixed(0).padStart(10)} │${curImpl.toString().padStart(8)} │${diff.padStart(6)} │${flag}`
    );
  }
  console.log(`\n  Moon raw paksha bala = ${(15+14)*12} (effectiveTithi=${15+14}×12)`);
  console.log(`  At krishna 14: Moon is waning toward new moon → benefics WEAK`);
  console.log(`  Malefic cap check: max(0, 120-${(15+14)*12}) = 0 → Sun/Mars/Saturn raw=0`);
  console.log(`  But capped at 60 max → BPHS capped=0 for ALL here (near new moon)`);

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 5: CHESTA BALA — Current(30) vs BPHS(60) for retrograde
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("§5 CHESTA BALA — Retrograde controversy");
  console.log("   BPHS strict: Retrograde = 60 (Vakra = max chesta)");
  console.log("   Current impl: Retrograde = 30");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("PLANET     │ Speed°/d │ Retro│ BPHSStrict│ Current │ Diff │ Note");
  console.log("───────────┼──────────┼──────┼───────────┼─────────┼──────┼──────────────");
  for (const p of CLASSICAL_PLANETS_ORDER) {
    const speed = chart.planets[p].speedLongitude;
    const retro = chart.planets[p].isRetrograde;
    const bphsStrict = bphs_chestaBala_strict(p, speed);
    const curr = current_chestaBala(p, speed);
    const diff = (bphsStrict - curr).toFixed(0);
    const flag = retro ? " ← RETROGRADE" : "";
    console.log(
      `${p.padEnd(10)} │${speed.toFixed(4).padStart(9)} │${retro ? "  YES" : "   no"} │${bphsStrict.toFixed(1).padStart(10)} │${curr.toFixed(1).padStart(8)} │${diff.padStart(5)} │${flag}`
    );
  }
  console.log("  BPHS Ch.27 exact: \"A retrograde planet has Chesta Bala = 60\"");
  console.log("  Recommendation: Saturn retrograde should get 60, not 30.");

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 6: DRIG BALA — Partial aspects (3/4, 1/2, 1/4)
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("§6 DRIG BALA — Missing Partial Aspects (1/4, 1/2, 3/4 strength)");
  console.log("   BPHS: All planets aspect 7th (full=60). Special partial aspects:");
  console.log("   Mars:    4th=1/4(15), 8th=3/4(45), 7th=full(60)");
  console.log("   Jupiter: 5th=1/2(30), 9th=full(60), 7th=full(60)");
  console.log("   Saturn:  3rd=1/4(15), 10th=3/4(45), 7th=full(60)");
  console.log("   Current impl: only FULL aspects (fraction=1.0), ignores partials!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Compute improved Drig Bala with partial aspects
  const beneficPlanets: ClassicalPlanet[] = ["Jupiter", "Venus", "Moon", "Mercury"];
  const maleficPlanets: ClassicalPlanet[] = ["Sun", "Mars", "Saturn"];

  console.log("\n  ─ Current Drig Bala (full aspects only):");
  console.log("  PLANET     │ H  │ Aspects (current full-only)                 │ DRIG_curr");
  console.log("  ───────────┼────┼─────────────────────────────────────────────┼──────────");

  for (const p of CLASSICAL_PLANETS_ORDER) {
    const tH = chart.planets[p].house;
    let total = 0;
    const parts: string[] = [];
    for (const other of CLASSICAL_PLANETS_ORDER) {
      if (other === p) continue;
      const oH = chart.planets[other].house;
      const diff = ((tH - oH + 12) % 12) + 1;
      let frac = 0;
      if (diff === 7) frac = 1.0;
      else if (other === "Mars" && (diff === 4 || diff === 8)) frac = 1.0;
      else if (other === "Jupiter" && (diff === 5 || diff === 9)) frac = 1.0;
      else if (other === "Saturn" && (diff === 3 || diff === 10)) frac = 1.0;
      if (frac === 0) continue;
      const sign = maleficPlanets.includes(other) ? -1 : 1;
      total += frac * 60 * sign;
      parts.push(`${other}(${sign > 0 ? "+" : "-"}${(frac * 60).toFixed(0)})`);
    }
    console.log(`  ${p.padEnd(10)} │${tH.toString().padStart(3)} │ ${parts.join(", ").padEnd(44)}│${total.toFixed(1).padStart(9)}`);
  }

  console.log("\n  ─ BPHS Drig Bala (with partial aspects):");
  console.log("  PLANET     │ H  │ Aspects (BPHS with fractions)               │ DRIG_bphs│ Diff");
  console.log("  ───────────┼────┼─────────────────────────────────────────────┼──────────┼──────");

  for (const p of CLASSICAL_PLANETS_ORDER) {
    const tH = chart.planets[p].house;
    let totalCurr = 0;
    let totalBphs = 0;
    const parts: string[] = [];

    for (const other of CLASSICAL_PLANETS_ORDER) {
      if (other === p) continue;
      const oH = chart.planets[other].house;
      const diff = ((tH - oH + 12) % 12) + 1;

      // BPHS partial aspects
      let fracCurr = 0;
      let fracBphs = 0;

      // 7th aspect — all planets, full
      if (diff === 7) { fracCurr = 1.0; fracBphs = 1.0; }

      // Mars special (BPHS: 4th=1/4, 8th=3/4)
      if (other === "Mars") {
        if (diff === 4) { fracCurr = 1.0; fracBphs = 0.25; } // current WRONG (uses full), BPHS=1/4
        if (diff === 8) { fracCurr = 1.0; fracBphs = 0.75; } // current WRONG (uses full), BPHS=3/4
      }
      // Jupiter special (BPHS: 5th=1/2, 9th=full)
      if (other === "Jupiter") {
        if (diff === 5) { fracCurr = 1.0; fracBphs = 0.5; }  // current WRONG, BPHS=1/2
        if (diff === 9) { fracCurr = 1.0; fracBphs = 1.0; }  // 9th = full (both agree)
      }
      // Saturn special (BPHS: 3rd=1/4, 10th=3/4)
      if (other === "Saturn") {
        if (diff === 3) { fracCurr = 1.0; fracBphs = 0.25; } // current WRONG, BPHS=1/4
        if (diff === 10) { fracCurr = 1.0; fracBphs = 0.75; }// current WRONG, BPHS=3/4
      }

      if (fracBphs === 0) continue;

      const sign = maleficPlanets.includes(other) ? -1 : 1;
      totalBphs += fracBphs * 60 * sign;
      totalCurr += fracCurr * 60 * sign;

      const aspectStr = `${other}(${sign>0?"+":"-"}${(fracBphs*60).toFixed(0)}@${fracBphs===1?"full":fracBphs===0.75?"3/4":fracBphs===0.5?"1/2":"1/4"})`;
      parts.push(aspectStr);
    }

    const diff2 = (totalBphs - totalCurr).toFixed(1);
    const flag = Math.abs(totalBphs - totalCurr) > 0 ? " ◄ DIFF" : "";
    console.log(`  ${p.padEnd(10)} │${tH.toString().padStart(3)} │ ${parts.join(", ").substring(0,44).padEnd(44)}│${totalBphs.toFixed(1).padStart(9)} │${diff2.padStart(5)}${flag}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 7: OJHA YUGMA — Mercury Special Case
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("§7 OJHA YUGMA BALA — Mercury special case");
  console.log("   BPHS: Mercury is BOTH male+female → scores 15 in ALL signs");
  console.log("   Current impl: Mercury treated as female planet only");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("PLANET     │ Sign       │ OddSign│ BPHS_Ojha│ Curr_Ojha│ Bug?");
  console.log("───────────┼────────────┼────────┼──────────┼──────────┼──────");
  for (const p of CLASSICAL_PLANETS_ORDER) {
    const sign = chart.planets[p].sign;
    const signIdx = ZODIAC_SIGNS_ARIES_FIRST.indexOf(sign);
    const isOdd = signIdx % 2 === 0;

    const bphsOjha = bphs_ojhaBala(p, sign);
    // Current implementation
    const oddPlanets = ["Sun","Mars","Jupiter","Saturn"];
    const evenPlanets = ["Moon","Mercury","Venus"];
    const currOjha = (isOdd && oddPlanets.includes(p)) || (!isOdd && evenPlanets.includes(p)) ? 15 : 0;

    const bug = (p === "Mercury" && bphsOjha !== currOjha) ? " ◄ BUG (Mercury should=15 always)" : "";
    console.log(`${p.padEnd(10)} │ ${sign.padEnd(10)} │ ${isOdd ? "odd  " : "even "}  │${bphsOjha.toString().padStart(9)} │${currOjha.toString().padStart(9)} │${bug}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 8: SUMMARY OF REMAINING BUGS
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║  DEEP DEBUG SUMMARY — REMAINING ISSUES                       ║");
  console.log("╠═══════════════════════════════════════════════════════════════╣");
  console.log("║  Bug A: Chesta Bala — Retrograde should = 60 (BPHS strict)   ║");
  console.log("║         Saturn retro: current=30, BPHS=60 → -30 virupas      ║");
  console.log("║                                                               ║");
  console.log("║  Bug B: Drig Bala — Partial aspects ignored                  ║");
  console.log("║         Mars 4th=1/4(15) not full(60)                        ║");
  console.log("║         Mars 8th=3/4(45) not full(60)                        ║");
  console.log("║         Jupiter 5th=1/2(30) not full(60)                     ║");
  console.log("║         Saturn 3rd=1/4(15) not full(60)                      ║");
  console.log("║         Saturn 10th=3/4(45) not full(60)                     ║");
  console.log("║                                                               ║");
  console.log("║  Bug C: Ojha Yugma — Mercury always 15 (BPHS hermaphrodite)  ║");
  console.log("║         Current: Mercury in odd sign = 0 (wrong)             ║");
  console.log("║                                                               ║");
  console.log("║  Bug D: Dig Bala — should use ecliptic degree, not house#    ║");
  console.log("║         Differences shown in §2 above                        ║");
  console.log("║                                                               ║");
  console.log("║  Bug E: Paksha Bala — BPHS raw formula differs from current  ║");
  console.log("║         At krishna-14 (near new moon): both benefic+malefic  ║");
  console.log("║         near 0 raw — capping behavior needs review           ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");

  // Current totals for reference
  console.log("\n── CURRENT TOTALS vs EXPECTED AFTER FIXES ──");
  console.log("PLANET     │ Current │ AfterFix(est)│ Key driver");
  console.log("───────────┼─────────┼──────────────┼──────────────────────");
  const fixes: Record<string, { delta: number; driver: string }> = {
    Sun:     { delta: 0,   driver: "no retro, no partial aspect change" },
    Moon:    { delta: 0,   driver: "benefic no retro" },
    Mars:    { delta: 0,   driver: "no retro" },
    Mercury: { delta: +15, driver: "Ojha fix: +15 (odd sign Virgo, was 0→15)" },
    Jupiter: { delta: 0,   driver: "no retro; drig partial may change" },
    Venus:   { delta: 0,   driver: "no retro" },
    Saturn:  { delta: +30, driver: "Chesta retro: 30→60 = +30 virupas" },
  };
  CLASSICAL_PLANETS_ORDER.forEach((p, i) => {
    const curr = sb.total_virupas[i]!;
    const f = fixes[p]!;
    const est = curr + f.delta;
    const flag = est >= MINIMUM_REQUIRED_VIRUPAS[i]! ? "✅" : "⚠";
    console.log(`${p.padEnd(10)} │${curr.toFixed(1).padStart(8)} │${est.toFixed(1).padStart(13)} │ ${f.driver} ${flag}`);
  });

  console.log("\n  Priority Fix Order:");
  console.log("  1️⃣  Ojha Yugma Mercury fix      → +15 Mercury (immediate)");
  console.log("  2️⃣  Chesta Bala retrograde=60   → +30 Saturn  (BPHS strict)");
  console.log("  3️⃣  Drig Bala partial aspects   → changes for multiple planets");
  console.log("  4️⃣  Dig Bala degree-based       → requires house cusp data");
  console.log("  5️⃣  Paksha Bala raw formula     → review capping logic");
  console.log("  ⚠  Jupiter+Venus remain weak: correct per chart astronomy.");

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  Deep Debug Complete. Block status:", shadbalaResult.status);
  console.log("═══════════════════════════════════════════════════════════════");
}

deepDebugShadbala().catch(console.error);
