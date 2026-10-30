/**
 * Tests: Tatkalika Maitri & Panchadha Maitri (DRF §22.2.4 fix)
 *
 * Verifies:
 *   1. getTemporaryFriendship() — BPHS house-offset rule (houses 2,3,4,10,11,12 = Friend)
 *   2. compoundFriendship() — all 6 cells of the Panchadha Maitri table
 *   3. getCompoundFriendLevel() — end-to-end integration
 *   4. computeDRF() (via computeAllCPS) — Grt.Friend/Grt.Enemy now reachable
 *   5. DRF identity guards (Step 1/2) — unchanged by Tatkalika
 *   6. TM_v3 — still uses natural friendship (unchanged)
 *   7. getFriendLevel() — still returns natural-table values only
 */

import {
  getFriendLevel,
  getTemporaryFriendship,
  compoundFriendship,
  getCompoundFriendLevel,
  computeAllCPS,
} from "../../src/engine/dssme/cpsFactors.ts";
import type { Dssme16BlockResult } from "../../src/types/dssme-canonical-types.ts";

// ============================================================================
// Fixture builder — follows acceptance.test.ts pattern (any + cast)
// ============================================================================

function makeChart(
  houseOverrides: Partial<Record<string, { house: number; type: string }>>,
  dashaMD: string,
  dashaAD: string
): Dssme16BlockResult {
  const base: any = {
    IDENTITY: {
      lagna_sign: "Aries", lagna_degree: 0.0, lagna_type: "Movable",
      lagna_lord: "Mars", geometry: "ordered_2_digit", ayanamsa: "Lahiri", _version: "1.0",
    },
    PANCHANGA: {
      tithi_name: "Shukla 3", tithi_1_30: 3, paksha: "Shukla",
      nakshatra_name: "Rohini", nakshatra_lord: "Moon",
      weekday: "Sunday", yoga_name: "Shubha", karana_name: "Bava",
      eclipse_proximity: false, gandanta_active: false,
      ingress_stacking: false, amavasya_zone: false, purnima_zone: false,
    },
    DASHA: {
      mahadasha_planet: dashaMD,
      antardasha_planet: dashaAD,
      pratyantara: "Sun",
      dasha_string: `${dashaMD}-${dashaAD}`,
      upcoming_ad: [],
      next_mahadasha_planet: "Moon",
    },
    PLANETS: {
      Sun:     { sign: "Leo",          degree: 15.0, dignity: "Own",     dispositor: "Sun",     house: 5 },
      Moon:    { sign: "Cancer",       degree: 10.0, dignity: "Exalted", dispositor: "Moon",    house: 4 },
      Mars:    { sign: "Aries",        degree: 20.0, dignity: "Own",     dispositor: "Mars",    house: 1 },
      Mercury: { sign: "Virgo",        degree: 5.0,  dignity: "Exalted", dispositor: "Mercury", house: 6 },
      Jupiter: { sign: "Cancer",       degree: 25.0, dignity: "Exalted", dispositor: "Moon",    house: 4 },
      Venus:   { sign: "Libra",        degree: 12.0, dignity: "Own",     dispositor: "Venus",   house: 7 },
      Saturn:  { sign: "Aquarius",     degree: 8.0,  dignity: "Own",     dispositor: "Saturn",  house: 11 },
      Rahu:    { sign: "Pisces",       degree: 15.0, dignity: "Neutral", dispositor: "Jupiter", house: 12 },
      Ketu:    { sign: "Virgo",        degree: 15.0, dignity: "Neutral", dispositor: "Mercury", house: 6 },
    },
    DIGNITY: {
      Sun: "Own", Moon: "Exalted", Mars: "Own", Mercury: "Exalted",
      Jupiter: "Exalted", Venus: "Own", Saturn: "Own", Rahu: "Neutral", Ketu: "Neutral",
    },
    HOUSES: Object.fromEntries(
      ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"]
        .map((s, i) => [`${i+1}`, { sign: s, degree: 0.0 }])
    ),
    HOUSE_POSITIONS: {
      Sun:     { house: 5,  type: "Succedent" },
      Moon:    { house: 4,  type: "Angular" },
      Mars:    { house: 1,  type: "Angular" },
      Mercury: { house: 6,  type: "Cadent" },
      Jupiter: { house: 4,  type: "Angular" },
      Venus:   { house: 7,  type: "Angular" },
      Saturn:  { house: 11, type: "Succedent" },
      Rahu:    { house: 12, type: "Cadent" },
      Ketu:    { house: 6,  type: "Cadent" },
      ...houseOverrides,
    },
    RETROGRADE: {
      Sun: false, Moon: false, Mars: false, Mercury: false,
      Jupiter: false, Venus: false, Saturn: true, Rahu: true, Ketu: true,
    },
    SHADBALA: {
      _columns: ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"],
      total_virupas:   [600, 550, 480, 520, 580, 510, 490],
      sthana_total:    [200, 180, 160, 170, 190, 165, 160],
      dig_bala:        [ 80,  70,  60,  75,  85,  70,  55],
      kaala_total:     [120, 110,  90, 100, 120, 105,  95],
      chesta_bala:     [ 90,  80,  70,  75,  85,  70,  80],
      naisargika_bala: [ 60,  51,  42,  51,  51,  42,  30],
      drig_bala:       [ 50,  59,  58,  49,  49,  58,  70],
      kaala_pct:       [ 20,  20,  19,  19,  21,  21,  19],
      sthana_pct:      [ 33,  30,  27,  28,  33,  27,  27],
      dig_pct:         [ 13,  12,  10,  13,  15,  12,   9],
      chesta_pct:      [ 15,  14,  12,  13,  15,  12,  13],
      drig_pct:        [  8,  10,  10,   8,   8,  10,  12],
    },
    SAV: { spec_sum: 62, sav_by_house: [28,25,26,30,32,24,27,29,31,26,35,24] },
    BAV_CURRENT_SIGN: {
      Sun: { bav: 5 }, Moon: { bav: 6 }, Mars: { bav: 4 }, Mercury: { bav: 5 },
      Jupiter: { bav: 7 }, Venus: { bav: 6 }, Saturn: { bav: 5 }, Rahu: { bav: 4 }, Ketu: { bav: 3 },
    },
    SAV_CURRENT_SIGNS: {
      Aries: 28, Taurus: 25, Gemini: 26, Cancer: 30, Leo: 32, Virgo: 24,
      Libra: 27, Scorpio: 29, Sagittarius: 31, Capricorn: 26, Aquarius: 35, Pisces: 24,
    },
    COMBUST: {
      Sun: { combust: false }, Moon: { combust: false }, Mars: { combust: false },
      Mercury: { combust: false }, Jupiter: { combust: false },
      Venus: { combust: false }, Saturn: { combust: false },
      Rahu: { combust: false }, Ketu: { combust: false },
    },
    ASPECTS_PLANETS: [],
    ASPECTS_BHAVAS: [],
    SIGN_CLUSTERS: [],
    BHAVA_BALA: {
      "1":  { total: 28.5, rashis: 7.0, graha: 14.5, drishti: 7.0 },
      "2":  { total: 22.0, rashis: 5.0, graha: 10.0, drishti: 7.0 },
      "3":  { total: 19.0, rashis: 4.0, graha:  8.0, drishti: 7.0 },
      "4":  { total: 32.0, rashis: 8.0, graha: 16.0, drishti: 8.0 },
      "5":  { total: 35.0, rashis: 9.0, graha: 17.0, drishti: 9.0 },
      "6":  { total: 18.0, rashis: 4.0, graha:  8.0, drishti: 6.0 },
      "7":  { total: 30.0, rashis: 7.0, graha: 15.0, drishti: 8.0 },
      "8":  { total: 20.0, rashis: 5.0, graha:  9.0, drishti: 6.0 },
      "9":  { total: 27.0, rashis: 6.0, graha: 13.0, drishti: 8.0 },
      "10": { total: 31.0, rashis: 8.0, graha: 15.0, drishti: 8.0 },
      "11": { total: 38.0, rashis: 9.0, graha: 19.0, drishti: 10.0 },
      "12": { total: 15.0, rashis: 3.0, graha:  7.0, drishti: 5.0 },
    },
    HORA: { current_lord: "Sun", hora_sequence: ["Sun"] },
    VOLATILITY_FLAGS: { eclipse_proximity: false, gandanta_active: false, ingress_stacking: false },
    PHASE_STRESS: {
      stress_level: "LOW", new_moon_proximity_hrs: 96, full_moon_proximity_hrs: 168,
      ingress_within_24h: [], sign_boundary_planets: [],
    },
    NAVAMSHA: { _available: false },
    YOGA_LIST: [],
    _meta: { birth_location: "Test", birth_datetime_utc: "2024-01-01T00:00:00Z" },
    BAV: { total_bindus: 337, spec_triangle_bindus: 96 },
  };

  return base as Dssme16BlockResult;
}

/** Shared CPS context (OPEN, neutral conditions) */
const CTX_OPEN = {
  zw_state: "OPEN" as const,
  z3AmplifierCount: 0,
  z3Amplifiers: [],
  tithiIndex: 3,        // Shukla 3 → Jaya → TF=1.03
  paksha: "Shukla",
  weekdayLord: "Sun" as const,
  moonNakshatra: "Rohini",
  horaLord: "Sun" as const,
};

// ============================================================================
// Test Suite
// ============================================================================

export function runTatkalikaMaitriTests(): void {
  console.log("\n=== Tatkalika Maitri & DRF §22.2.4 Fix Tests ===\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string): void {
    if (condition) {
      console.log(`  ✓ ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 1: getTemporaryFriendship() — BPHS house offset rule
  // ─────────────────────────────────────────────────────────────────────────
  console.log("Section 1: getTemporaryFriendship() — BPHS house offset rule");

  // Offsets in {2,3,4,10,11,12} → Temporary Friend
  const FRIEND_OFFSETS = [2, 3, 4, 10, 11, 12];
  // Offsets in {1,5,6,7,8,9} → Temporary Enemy
  const ENEMY_OFFSETS  = [1, 5, 6, 7, 8, 9];

  let allFriendOk = true;
  for (const offset of FRIEND_OFFSETS) {
    // Place Sun at H1, Moon at H<offset>
    const c = makeChart({ Sun: { house: 1, type: "Angular" }, Moon: { house: offset, type: "Succedent" } }, "Mars", "Saturn");
    const tf = getTemporaryFriendship("Sun", "Moon", c);
    if (tf !== "Friend") { allFriendOk = false; console.error(`  ✗ offset ${offset}: expected Friend, got ${tf}`); failed++; }
  }
  if (allFriendOk) { console.log(`  ✓ All 6 Tatkalika friend offsets {2,3,4,10,11,12} → "Friend"`); passed++; }

  let allEnemyOk = true;
  for (const offset of ENEMY_OFFSETS) {
    const c = makeChart({ Sun: { house: 1, type: "Angular" }, Moon: { house: offset, type: "Succedent" } }, "Mars", "Saturn");
    const tf = getTemporaryFriendship("Sun", "Moon", c);
    if (tf !== "Enemy") { allEnemyOk = false; console.error(`  ✗ offset ${offset}: expected Enemy, got ${tf}`); failed++; }
  }
  if (allEnemyOk) { console.log(`  ✓ All 6 Tatkalika enemy offsets {1,5,6,7,8,9} → "Enemy"`); passed++; }

  // Wrap-around: Jupiter H3, Saturn H12 → offset=(12-3+12)%12+1=10 → Friend
  {
    const c = makeChart({ Jupiter: { house: 3, type: "Cadent" }, Saturn: { house: 12, type: "Cadent" } }, "Mars", "Moon");
    assert(getTemporaryFriendship("Jupiter", "Saturn", c) === "Friend",
      "Jupiter(H3)→Saturn(H12): offset=10 → Temporary Friend (wrap-around check)");
  }

  // Wrap-around: Venus H8, Mercury H2 → offset=(2-8+12)%12+1=7 → Enemy
  {
    const c = makeChart({ Venus: { house: 8, type: "Succedent" }, Mercury: { house: 2, type: "Succedent" } }, "Sun", "Moon");
    assert(getTemporaryFriendship("Venus", "Mercury", c) === "Enemy",
      "Venus(H8)→Mercury(H2): offset=7 → Temporary Enemy (wrap-around check)");
  }

  // Missing house data → Neutral (conservative, no promotion/demotion)
  {
    const c = makeChart({}, "Mars", "Saturn");
    (c.HOUSE_POSITIONS as any)["Jupiter"] = undefined;
    assert(getTemporaryFriendship("Jupiter", "Mars", c) === "Neutral",
      "Missing HOUSE_POSITIONS → Neutral (conservative fallback)");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 2: compoundFriendship() — Panchadha Maitri table (all 6 cells)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\nSection 2: compoundFriendship() — Panchadha Maitri table (6 cells + identity)");

  assert(compoundFriendship("Friend",  "Friend") === "Grt.Friend", "Friend  + Friend = Grt.Friend");
  assert(compoundFriendship("Friend",  "Enemy")  === "Neutral",    "Friend  + Enemy  = Neutral");
  assert(compoundFriendship("Neutral", "Friend") === "Friend",     "Neutral + Friend = Friend");
  assert(compoundFriendship("Neutral", "Enemy")  === "Enemy",      "Neutral + Enemy  = Enemy");
  assert(compoundFriendship("Enemy",   "Friend") === "Neutral",    "Enemy   + Friend = Neutral");
  assert(compoundFriendship("Enemy",   "Enemy")  === "Grt.Enemy",  "Enemy   + Enemy  = Grt.Enemy");
  // Identity when temporary data absent
  assert(compoundFriendship("Friend",  "Neutral") === "Friend",    "Friend  + Neutral(absent) = Friend  (identity)");
  assert(compoundFriendship("Enemy",   "Neutral") === "Enemy",     "Enemy   + Neutral(absent) = Enemy   (identity)");
  assert(compoundFriendship("Neutral", "Neutral") === "Neutral",   "Neutral + Neutral(absent) = Neutral (identity)");

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 3: getCompoundFriendLevel() — end-to-end integration
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\nSection 3: getCompoundFriendLevel() — end-to-end");

  // Sun(H1)→Moon(H2): Natural=Friend, Temporary=Friend → Grt.Friend
  {
    const c = makeChart({ Sun: { house: 1, type: "Angular" }, Moon: { house: 2, type: "Succedent" } }, "Mars", "Saturn");
    assert(getCompoundFriendLevel("Sun", "Moon", c) === "Grt.Friend",
      "Sun(H1)→Moon(H2): Natural=Friend + Temp=Friend → Grt.Friend");
  }

  // Sun(H1)→Saturn(H6): Natural=Enemy, Temporary=Enemy → Grt.Enemy
  {
    const c = makeChart({ Sun: { house: 1, type: "Angular" }, Saturn: { house: 6, type: "Cadent" } }, "Mars", "Venus");
    assert(getCompoundFriendLevel("Sun", "Saturn", c) === "Grt.Enemy",
      "Sun(H1)→Saturn(H6): Natural=Enemy + Temp=Enemy(offset=6) → Grt.Enemy");
  }

  // Sun(H1)→Venus(H3): Natural=Enemy, Temporary=Friend(offset=3) → Neutral
  {
    const c = makeChart({ Sun: { house: 1, type: "Angular" }, Venus: { house: 3, type: "Cadent" } }, "Moon", "Jupiter");
    assert(getCompoundFriendLevel("Sun", "Venus", c) === "Neutral",
      "Sun(H1)→Venus(H3): Natural=Enemy + Temp=Friend(offset=3) → Neutral");
  }

  // Moon(H4)→Mercury(H6): Natural=Friend (Moon's table: Mercury="Friend"), Temp=Friend(offset=3) → Grt.Friend
  {
    const c = makeChart({ Moon: { house: 4, type: "Angular" }, Mercury: { house: 6, type: "Cadent" } }, "Jupiter", "Saturn");
    assert(getCompoundFriendLevel("Moon", "Mercury", c) === "Grt.Friend",
      "Moon(H4)→Mercury(H6): Natural=Friend + Temp=Friend(offset=3) → Grt.Friend");
  }

  // Jupiter(H1)→Mercury(H7): Natural=Enemy, Temp=Enemy(offset=7) → Grt.Enemy
  {
    const c = makeChart({ Jupiter: { house: 1, type: "Angular" }, Mercury: { house: 7, type: "Angular" } }, "Sun", "Saturn");
    assert(getCompoundFriendLevel("Jupiter", "Mercury", c) === "Grt.Enemy",
      "Jupiter(H1)→Mercury(H7): Natural=Enemy + Temp=Enemy(offset=7) → Grt.Enemy");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 4: DRF range — Grt.Friend/Grt.Enemy now reachable via computeAllCPS
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\nSection 4: DRF range — §22.2.4 fix verification");

  // Case A: DRF Grt.Friend tier (drfBase=1.04)
  // MD=Moon. Sun→Moon: Natural=Friend, Temp=Friend(Moon at H2 from Sun H1) → Grt.Friend
  // AD=Saturn: Sun→Saturn = Enemy → adMod=0.98
  // Expected DRF = clamp(1.04 * 0.98, 0.88, 1.08) = 1.0192
  {
    const c = makeChart(
      { Sun: { house: 1, type: "Angular" }, Moon: { house: 2, type: "Succedent" }, Saturn: { house: 5, type: "Succedent" } },
      "Moon", "Saturn"
    );
    const cps = computeAllCPS(c, ["Sun"], CTX_OPEN);
    const drf = cps[0]!.DRF;
    const expected = Math.min(Math.max(1.04 * 0.98, 0.88), 1.08); // 1.0192
    assert(Math.abs(drf - expected) < 1e-9,
      `DRF Grt.Friend: Sun DRF=${drf.toFixed(6)} ≈ ${expected.toFixed(6)} (drfBase=1.04×adMod=0.98)`);
    assert(drf > 1.00,
      `DRF Grt.Friend > 1.00 (Grt.Friend tier=1.04, net 1.0192 after adMod=0.98; previously natural Friend gave 1.02×0.98=0.9996<1.00): ${drf.toFixed(6)} ✓`);
  }

  // Case B: DRF Grt.Enemy tier (drfBase=0.88)
  // MD=Venus. Sun→Venus: Natural=Enemy, Temp=Enemy(Venus at H6 from Sun H1, offset=6) → Grt.Enemy
  // AD=Jupiter: Sun→Jupiter = Friend → adMod=1.01
  // Expected DRF = clamp(0.88 * 1.01, 0.88, 1.08) = 0.8888
  {
    const c = makeChart(
      { Sun: { house: 1, type: "Angular" }, Venus: { house: 6, type: "Cadent" }, Jupiter: { house: 4, type: "Angular" } },
      "Venus", "Jupiter"
    );
    const cps = computeAllCPS(c, ["Sun"], CTX_OPEN);
    const drf = cps[0]!.DRF;
    const expected = Math.min(Math.max(0.88 * 1.01, 0.88), 1.08); // 0.8888
    assert(Math.abs(drf - expected) < 1e-9,
      `DRF Grt.Enemy: Sun DRF=${drf.toFixed(6)} ≈ ${expected.toFixed(6)} (drfBase=0.88×adMod=1.01)`);
    assert(drf < 0.94,
      `DRF Grt.Enemy < 0.94 (previously dead-code floor): ${drf.toFixed(6)} < 0.94 ✓`);
  }

  // Case C: Natural Friend only (no Tatkalika upgrade) — drfBase=1.02
  // MD=Moon. Sun→Moon: Natural=Friend, Temp=Enemy(Moon at H5 from Sun H1, offset=5) → Neutral (1.00)
  // AD=Mars: Sun→Mars = Friend → adMod=1.01
  // Expected DRF = clamp(1.00 * 1.01, 0.88, 1.08) = 1.01
  {
    const c = makeChart(
      { Sun: { house: 1, type: "Angular" }, Moon: { house: 5, type: "Succedent" }, Mars: { house: 3, type: "Cadent" } },
      "Moon", "Mars"
    );
    const cps = computeAllCPS(c, ["Sun"], CTX_OPEN);
    const drf = cps[0]!.DRF;
    const expected = Math.min(Math.max(1.00 * 1.01, 0.88), 1.08); // 1.01
    assert(Math.abs(drf - expected) < 1e-9,
      `DRF Friend+Enemy=Neutral: Sun DRF=${drf.toFixed(6)} ≈ ${expected.toFixed(6)} (drfBase=1.00, adMod=1.01)`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 5: DRF identity guards (Step 1 / Step 2) — unchanged
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\nSection 5: DRF identity guards — unchanged by Tatkalika");

  // Step 1: p == MD → 1.08 immediately (no compound lookup)
  {
    const c = makeChart({ Sun: { house: 1, type: "Angular" }, Moon: { house: 2, type: "Succedent" } }, "Sun", "Moon");
    const cps = computeAllCPS(c, ["Sun"], CTX_OPEN);
    assert(cps[0]!.DRF === 1.08,
      "DRF Step 1: p=Sun == MD=Sun → 1.08 (identity, no compound lookup)");
  }

  // Step 2: p == AD (and p ≠ MD) → 1.05 immediately
  {
    const c = makeChart(
      { Sun: { house: 1, type: "Angular" }, Mars: { house: 3, type: "Cadent" } },
      "Mars", "Sun"
    );
    const cps = computeAllCPS(c, ["Sun"], CTX_OPEN);
    assert(cps[0]!.DRF === 1.05,
      "DRF Step 2: p=Sun == AD=Sun, MD=Mars → 1.05 (identity, no compound lookup)");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 6: TM_v3 uses natural friendship only (unchanged)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\nSection 6: TM_v3 — natural friendship only (Tatkalika has no effect)");

  // Moon at H4 (default) vs Moon at H2 from Sun → both should give same TM_v3 for Moon
  // because TM_v3 uses weekdayLord relationship (natural), not HOUSE_POSITIONS
  {
    const c1 = makeChart({ Moon: { house: 4, type: "Angular" } }, "Jupiter", "Saturn");
    const c2 = makeChart({ Moon: { house: 2, type: "Succedent" } }, "Jupiter", "Saturn");
    const cps1 = computeAllCPS(c1, ["Moon"], CTX_OPEN);
    const cps2 = computeAllCPS(c2, ["Moon"], CTX_OPEN);
    assert(Math.abs(cps1[0]!.TM_v3 - cps2[0]!.TM_v3) < 1e-9,
      `TM_v3 unchanged by house position: ${cps1[0]!.TM_v3.toFixed(6)} == ${cps2[0]!.TM_v3.toFixed(6)} (natural only)`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 7: getFriendLevel() still returns only natural-table values
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\nSection 7: getFriendLevel() — natural-table values only");

  const planets = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"] as const;
  const naturalLevels: string[] = [];
  for (const a of planets) {
    for (const b of planets) { naturalLevels.push(getFriendLevel(a, b)); }
  }
  const onlyNaturalTiers = naturalLevels.every(l => ["Friend","Neutral","Enemy"].includes(l));
  assert(onlyNaturalTiers,
    "getFriendLevel() returns only Friend/Neutral/Enemy (never Grt.Friend or Grt.Enemy)");

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n=== Tatkalika Maitri Tests: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) throw new Error(`${failed} test(s) failed in runTatkalikaMaitriTests`);
  console.log("✓ TATKALIKA MAITRI & DRF §22.2.4 FIX — All Passed!\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct-run entrypoint (Finding #1)
// Allows: `npx bun run ./tests/dssme/tatkalikaMaitri.test.ts`
// ─────────────────────────────────────────────────────────────────────────────
const isDirectRun =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  Boolean(
    process.argv[1] &&
      process.argv[1].replace(/\\/g, "/").endsWith("tatkalikaMaitri.test.ts")
  );

if (isDirectRun) {
  runTatkalikaMaitriTests();
}
