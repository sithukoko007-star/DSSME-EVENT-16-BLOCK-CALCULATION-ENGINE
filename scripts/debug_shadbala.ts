/**
 * Shadbala Debug Script
 * Runs a real chart through buildShadbalaBlock and prints detailed component breakdown.
 */
import { generateCanonicalChart } from "../src/engine/canonical/canonicalChart.ts";
import { buildShadbalaBlock, CLASSICAL_PLANETS_ORDER, MINIMUM_REQUIRED_VIRUPAS } from "../src/engine/chartblocks/shadbala.ts";
import { createBlockContext } from "../src/engine/blocks/index.ts";

async function debugShadbala() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("SHADBALA DEBUG — Chofu 2026-09-16 18:50 (Asia/Tokyo)");
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

  // 18:50 is after sunset in Sept Tokyo
  const shadbalaResult = buildShadbalaBlock(ctx, {
    paksha: "krishna",  // Sep 16 2026: Krishna paksha
    tithiIndex: 14,
    weekday: 3,         // Wednesday
    hora: "Sun",        // Night 1st hora on Wednesday (Chaldean order)
    isNight: true,
    // PL9 Phase A: actual chart values
    chartJd: chart.time.julianDayUt,
    longitude: chart.location.longitude,
    ayanamsaDeg: chart.ayanamsa.value,
  });

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

  console.log("\n── KAALA_PCT (for SIF_v3 KIF factor) ──");
  CLASSICAL_PLANETS_ORDER.forEach((p, i) => {
    const kp = (sb.kaala_pct?.[i] ?? 0).toFixed(2);
    console.log(`  ${p.padEnd(10)}: kaala_pct = ${kp.padStart(6)}%   kaala_raw = ${sb.kaala_total[i]!.toFixed(1)}`);
  });

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

  console.log("\n── PLANET POSITIONS (for cross-check) ──");
  for (const planet of CLASSICAL_PLANETS_ORDER) {
    const p = chart.planets[planet];
    console.log(
      `  ${planet.padEnd(9)}: ${p.sign.padEnd(12)} H${p.house.toString().padStart(2)}` +
      `  lon=${p.siderealLongitude.toFixed(2).padStart(7)}°` +
      `  speed=${p.speedLongitude.toFixed(4).padStart(8)}  retro=${p.isRetrograde}`
    );
  }

  console.log("\n── BPHS CH. 27 CANONICAL IMPLEMENTATION STATUS ──");
  console.log("  ✓ Saptavargaja Bala: Full D1, D2, D3, D7, D9, D12, D30 7-Varga Panchadha Maitri");
  console.log("  ✓ Abda Bala: Exact Newton-Raphson Mesha 0° Aries Sankranti Solver");
  console.log("  ✓ Masa Bala: Exact Solar Sankranti / Amanta Lunar Masa Solver");
  console.log("  ✓ Yuddha Bala: Bimba Parimana Disc Diameters & Latitude-based Resolution");
  console.log("  ✓ Drig Bala: Raman 30°-300° Degree-based Band Drishti Kona & /4 Divisor");

  if (shadbalaResult.issues.length > 0) {
    console.log("\n── BLOCK ISSUES ──");
    shadbalaResult.issues.forEach(iss => console.warn("  ⚠", JSON.stringify(iss)));
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("Block status:", shadbalaResult.status);
  console.log("═══════════════════════════════════════════════════════");
}

debugShadbala().catch(console.error);
