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
    hora: "Mercury",    // approx hora lord at 18:50 Wed
    isNight: true,
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
    const ratio = sb.kaala_total[i]! / (MINIMUM_REQUIRED_VIRUPAS[i]! * 4); // rough ratio vs other components
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

  console.log("\n── KNOWN ISSUES / LIMITATIONS ──");
  console.log("  1. Saptavargaja Bala: uses placeholder 75 (full D1-D30 computation requires 6 additional varga charts)");
  console.log("  2. Abda Bala: fixed at 15 (year lord requires multi-year solar ingress data)");
  console.log("  3. Yuddha Bala: fixed at 0 (planetary war requires full position set)");
  console.log("  4. Masa Bala: uses (weekday + tithiIndex) % 7 approximation");
  console.log("  5. Drig Bala: uses whole-house aspect fractions (not degree-based)");

  if (shadbalaResult.issues.length > 0) {
    console.log("\n── BLOCK ISSUES ──");
    shadbalaResult.issues.forEach(iss => console.warn("  ⚠", JSON.stringify(iss)));
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("Block status:", shadbalaResult.status);
  console.log("═══════════════════════════════════════════════════════");
}

debugShadbala().catch(console.error);
