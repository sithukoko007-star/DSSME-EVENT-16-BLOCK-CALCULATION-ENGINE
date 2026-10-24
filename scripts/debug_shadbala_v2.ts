/**
 * Shadbala Debug Script v2 — Extended
 * Runs a real chart through buildShadbalaBlock and prints detailed component breakdown.
 * Includes per-sub-component Kaala Bala breakdown for deeper diagnosis.
 */
import { generateCanonicalChart } from "../src/engine/canonical/canonicalChart.ts";
import {
  buildShadbalaBlock,
  CLASSICAL_PLANETS_ORDER,
  MINIMUM_REQUIRED_VIRUPAS,
} from "../src/engine/chartblocks/shadbala.ts";
import { createBlockContext } from "../src/engine/blocks/index.ts";
import { ZODIAC_SIGNS_ARIES_FIRST } from "../src/types/dssme-canonical-types.ts";

async function debugShadbala() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("SHADBALA DEBUG v2 — Chofu 2026-09-16 18:50 (Asia/Tokyo)");
  console.log("═══════════════════════════════════════════════════════\n");

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

  const shadbalaInput = {
    paksha: "krishna" as const,
    tithiIndex: 14,
    weekday: 3,        // Wednesday
    hora: "Mercury" as const,
    isNight: true,
    chartJd: chart.time.julianDayUt,
    longitude: chart.location.longitude,
    ayanamsaDeg: chart.ayanamsa.value,
  };

  const shadbalaResult = buildShadbalaBlock(ctx, shadbalaInput);

  if (shadbalaResult.status !== "OK") {
    console.error("Block status:", shadbalaResult.status, shadbalaResult.issues);
  }

  const sb = shadbalaResult.value!;

  // ── Component table ───────────────────────────────────────
  console.log("PLANET       │ STHANA │ DIG   │ KAALA │ CHESTA│ NAISA │ DRIG  │ TOTAL  │ MIN  │ %REQ │ RANK");
  console.log("─────────────┼────────┼───────┼───────┼───────┼───────┼───────┼────────┼──────┼──────┼─────");

  CLASSICAL_PLANETS_ORDER.forEach((planet, i) => {
    const fmt = (n: number) => n.toFixed(1).padStart(6);
    const pct = (sb.percent_required[i] ?? 0).toFixed(1).padStart(5);
    const belowMin = (sb.total_virupas[i]! < MINIMUM_REQUIRED_VIRUPAS[i]!) ? " ⚠" : "";
    console.log(
      `${planet.padEnd(12)} │${fmt(sb.sthana_total[i]!)} │${fmt(sb.dig_bala[i]!)} │${fmt(sb.kaala_total[i]!)} │${fmt(sb.chesta_bala[i]!)} │${fmt(sb.naisargika_bala[i]!)} │${fmt(sb.drig_bala[i]!)} │${sb.total_virupas[i]!.toFixed(1).padStart(7)} │${MINIMUM_REQUIRED_VIRUPAS[i]!.toString().padStart(5)} │${pct}% │  ${sb.rank[i]}${belowMin}`
    );
  });

  // ── Sthana Bala breakdown (manual recalc) ────────────────
  console.log("\n── STHANA BALA BREAKDOWN ──");
  console.log("PLANET       │ UCHCHA │ SAPTA │ OJHA  │ KEND  │ DREK  │ TOTAL");
  console.log("─────────────┼────────┼───────┼───────┼───────┼───────┼──────");
  for (const planet of CLASSICAL_PLANETS_ORDER) {
    const pos = chart.planets[planet];
    const exaltDeg: Record<string, number> = {
      Sun: 10, Moon: 33, Mars: 298, Mercury: 165, Jupiter: 95, Venus: 357, Saturn: 200,
    };
    const lon = pos.siderealLongitude;
    const exLon = exaltDeg[planet]!;
    let diff = Math.abs(lon - exLon) % 360;
    if (diff > 180) diff = 360 - diff;
    const uchcha = Math.max(0, 60 - diff / 3);
    const sapta = 75; // placeholder
    const signIdx = ZODIAC_SIGNS_ARIES_FIRST.indexOf(pos.sign);
    const isOddSign = signIdx % 2 === 0;
    const oddPlanets = ["Sun", "Mars", "Jupiter", "Saturn"];
    const evenPlanets = ["Moon", "Mercury", "Venus"];
    const ojha = (isOddSign && oddPlanets.includes(planet)) || (!isOddSign && evenPlanets.includes(planet)) ? 15 : 0;
    const angular = [1, 4, 7, 10];
    const succedent = [2, 5, 8, 11];
    const kend = angular.includes(pos.house) ? 60 : succedent.includes(pos.house) ? 30 : 15;
    const drekkanaPos = Math.floor(pos.signDegree / 10) + 1;
    const isOddDrek = drekkanaPos % 2 === 1;
    const drek = ((isOddSign && isOddDrek) || (!isOddSign && !isOddDrek)) ? 15 : 0;
    const total = uchcha + sapta + ojha + kend + drek;
    console.log(
      `${planet.padEnd(12)} │${uchcha.toFixed(1).padStart(6)} │${sapta.toFixed(1).padStart(6)} │${ojha.toFixed(1).padStart(6)} │${kend.toFixed(1).padStart(6)} │${drek.toFixed(1).padStart(6)} │${total.toFixed(1).padStart(6)}`
    );
    console.log(
      `             │       │       │       │H${pos.house.toString().padEnd(5)} │D${drekkanaPos}     │ sign=${pos.sign} (${isOddSign?'odd':'even'})`
    );
  }

  // ── Kaala Bala sub-component breakdown ───────────────────
  console.log("\n── KAALA BALA SUB-COMPONENTS ──");
  console.log("  Input: paksha=krishna, tithi=14, weekday=3(Wed), hora=Mercury, isNight=true");
  console.log("  SunLon=" + chart.planets.Sun.siderealLongitude.toFixed(2) + " (sunInNorth=" + (chart.planets.Sun.siderealLongitude < 180) + ")");
  console.log("");
  console.log("PLANET     │ NATH │ PAKSHA│ TRIB │ ABDA │ MASA │ VAARA│ HORA │ AYANA│ TOTAL");
  console.log("───────────┼──────┼───────┼──────┼──────┼──────┼──────┼──────┼──────┼──────");

  const sunInNorth = chart.planets.Sun.siderealLongitude < 180;
  const isNight = true;
  const diurnal = ["Sun", "Jupiter", "Venus"];
  const nocturnal = ["Moon", "Mars", "Saturn"];
  const benefics = ["Moon", "Mercury", "Jupiter", "Venus"];
  const malefics = ["Sun", "Mars", "Saturn"];
  const masaLords: string[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  const vaaraLords: string[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];

  for (const planet of CLASSICAL_PLANETS_ORDER) {
    // Nathonnatha
    let nath = 15;
    if (diurnal.includes(planet)) nath = isNight ? 15 : 60;
    else if (nocturnal.includes(planet)) nath = isNight ? 60 : 15;
    else nath = 30; // Mercury

    // Paksha
    const pakshaIsShukla = false; // krishna
    let paksha = 30;
    const isBenefic = benefics.includes(planet);
    const isMalefic = malefics.includes(planet);
    if ((isBenefic && pakshaIsShukla) || (isMalefic && !pakshaIsShukla)) paksha = 60;
    else if ((isBenefic && !pakshaIsShukla) || (isMalefic && pakshaIsShukla)) paksha = 0;

    // Tribhaga
    let tribhaga = 0;
    // Night: Mercury=first, Moon=middle, Mars=last (of 3 night thirds)
    const nightLords: string[] = ["Mars", "Mercury", "Moon"];
    if (isNight && nightLords.includes(planet)) tribhaga = 60;

    // Abda
    const abda = 15;

    // Masa
    const masaLord = masaLords[(3 + 14) % 7]!; // weekday=3, tithiIndex=14 → (17)%7=3 → Mercury
    const masa = masaLord === planet ? 60 : 0;

    // Vaara
    const vaaraLord = vaaraLords[3]!; // weekday=3 → Mercury
    const vaara = vaaraLord === planet ? 45 : 0;

    // Hora
    const hora = "Mercury" === planet ? 60 : 0;

    // Ayana
    let ayana = 30;
    if (sunInNorth && diurnal.includes(planet)) ayana = 60;
    else if (!sunInNorth && nocturnal.includes(planet)) ayana = 60;
    else if (!sunInNorth && diurnal.includes(planet)) ayana = 0;
    else if (sunInNorth && nocturnal.includes(planet)) ayana = 0;

    const total = nath + paksha + tribhaga + abda + masa + vaara + hora + ayana;
    console.log(
      `${planet.padEnd(10)} │${nath.toString().padStart(5)} │${paksha.toString().padStart(6)} │${tribhaga.toString().padStart(5)} │${abda.toString().padStart(5)} │${masa.toString().padStart(5)} │${vaara.toString().padStart(5)} │${hora.toString().padStart(5)} │${ayana.toString().padStart(5)} │${total.toString().padStart(5)}`
    );
  }
  console.log(`  Masa lord = ${masaLords[(3 + 14) % 7]} (idx ${(3+14)%7})`);
  console.log(`  Vaara lord = ${vaaraLords[3]} (weekday 3)`);

  // ── Drig Bala breakdown ───────────────────────────────────
  console.log("\n── DRIG BALA ASPECT ANALYSIS ──");
  for (const planet of CLASSICAL_PLANETS_ORDER) {
    const targetH = chart.planets[planet].house;
    let drigTotal = 0;
    const aspects: string[] = [];
    for (const other of CLASSICAL_PLANETS_ORDER) {
      if (other === planet) continue;
      const otherH = chart.planets[other].house;
      // Current formula: diff = ((targetHouse - otherHouse + 12) % 12) + 1
      const diffCurrent = ((targetH - otherH + 12) % 12) + 1;
      // Classical: the aspecting planet's FORWARD count to target
      const diffClassical = ((targetH - otherH + 12) % 12) + 1;
      let frac = 0;
      if (diffCurrent === 7) frac = 1.0;
      else if (other === "Mars" && (diffCurrent === 4 || diffCurrent === 8)) frac = 1.0;
      else if (other === "Jupiter" && (diffCurrent === 5 || diffCurrent === 9)) frac = 1.0;
      else if (other === "Saturn" && (diffCurrent === 3 || diffCurrent === 10)) frac = 1.0;
      if (frac === 0) continue;
      const isMalOther = ["Sun", "Mars", "Saturn"].includes(other);
      const contribution = frac * 60 * (isMalOther ? -1 : 1);
      drigTotal += contribution;
      aspects.push(`${other}(H${otherH})→${contribution > 0 ? "+" : ""}${contribution.toFixed(0)}`);
    }
    console.log(`  ${planet.padEnd(9)} H${targetH}: drig=${drigTotal.toFixed(1)}  aspects=[${aspects.join(", ")}]`);
  }

  // ── Below minimum ─────────────────────────────────────────
  console.log("\n── BELOW MINIMUM VIRUPAS? ──");
  let allOk = true;
  CLASSICAL_PLANETS_ORDER.forEach((p, i) => {
    const total = sb.total_virupas[i]!;
    const min = MINIMUM_REQUIRED_VIRUPAS[i]!;
    if (total < min) {
      console.log(`  ⚠ ${p}: ${total.toFixed(1)} < ${min} → ${((total/min)*100).toFixed(1)}% (deficit: ${(min - total).toFixed(1)} virupas)`);
      allOk = false;
    }
  });
  if (allOk) console.log("  ✓ All planets meet minimum required virupas");

  console.log("\n── PLANET POSITIONS ──");
  for (const planet of CLASSICAL_PLANETS_ORDER) {
    const p = chart.planets[planet];
    const d9lon = (p.siderealLongitude * 9) % 360;
    const d9signIdx = Math.floor(d9lon / 30);
    const d9sign = ZODIAC_SIGNS_ARIES_FIRST[d9signIdx];
    console.log(
      `  ${planet.padEnd(9)}: ${p.sign.padEnd(12)} H${p.house.toString().padStart(2)}` +
      `  lon=${p.siderealLongitude.toFixed(2).padStart(7)}°` +
      `  deg=${p.signDegree.toFixed(2).padStart(5)}°` +
      `  speed=${p.speedLongitude.toFixed(4).padStart(8)}` +
      `  D9=${d9sign}` +
      `  retro=${p.isRetrograde}`
    );
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("Block status:", shadbalaResult.status);
  console.log("═══════════════════════════════════════════════════════");
}

debugShadbala().catch(console.error);
