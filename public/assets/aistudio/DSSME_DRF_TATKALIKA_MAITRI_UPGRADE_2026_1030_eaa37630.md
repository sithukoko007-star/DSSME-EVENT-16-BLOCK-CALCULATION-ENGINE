# DSSME DRF Tatkalika Maitri Upgrade — Google Studio Install Prompt
## v1.7 Scope · §22.2.4 Dead-Code Fix · Panchadha Maitri Implementation
**File:** `DSSME_DRF_TATKALIKA_MAITRI_UPGRADE_2026_1030.md`
**Date:** 2026-10-30 · **Revision:** 2 (2026-10-30 — Finding #1 #3 included) · **Applies To:** `f:\dssme-event-calculation-engine`

> [!IMPORTANT]
> **Revision 2 changes (2026-10-30):**
> - **Finding #1:** `tatkalikaMaitri.test.ts` ₋ `isDirectRun` standalone entrypoint block added (bottom of file)
> - **Finding #3:** `getTemporaryFriendship()` ₋ strict `Number.isInteger` + range `1..12` validation replaces falsy guard
> - **Finding #2:** Existing test suites (`acceptance.test.ts`, `cpsAcceptanceA1ToA13.test.ts`, `dssmePipeline.test.ts`) use DRF range-checks only — **unaffected** by Tatkalika change
> - **Finding #4:** `HOUSE_POSITIONS` (1..12) vs rasi (0..11) — Whole-Sign system makes house distance = rasi distance — **no action needed**
> - All 25 test suites pass (exit 0). `runTatkalikaMaitriTests()` → 28/28 PASS standalone.

---

## Background & Why This Upgrade Is Needed

### The Dead-Code Problem (§22.2.4)

In `src/engine/dssme/cpsFactors.ts`, the DRF `friendLevelToDRF()` function declares
five tiers including `Grt.Friend → 1.04` and `Grt.Enemy → 0.88`. However, the
Natural Friendship Table (`FRIENDSHIP`) only stores `"Friend"`, `"Neutral"`, and
`"Enemy"` — so `getFriendLevel()` **never returned** `"Grt.Friend"` or `"Grt.Enemy"`.
This made the two extreme tiers permanently unreachable dead code.

**Effect:** DRF Step 3 effective range was `[0.94, 1.02]` instead of the declared
`[0.88, 1.04]`. All planets were silently penalized/capped by this gap.

### The Classical Fix: Tatkalika Maitri (Temporary Friendship)

In BPHS (Brihat Parashara Hora Shastra), compound friendship — called **Panchadha
Maitri** — is the sum of:

| Layer | Name | Source |
|---|---|---|
| Layer 1 | **Naisargika Maitri** (Natural) | Fixed planetary friendship table |
| Layer 2 | **Tatkalika Maitri** (Temporary) | Runtime: other planet's house FROM this planet's house |

**Tatkalika rule:** If planet B occupies the **2nd, 3rd, 4th, 10th, 11th, or 12th**
house counted from planet A's house → B is a Temporary Friend of A. Otherwise Enemy.

**Panchadha Maitri (compound) table:**

| Natural \ Temporary | Friend | Enemy |
|---|---|---|
| Friend | **Grt.Friend** | Neutral |
| Neutral | Friend | Enemy |
| Enemy | Neutral | **Grt.Enemy** |

This unlocks the two previously dead-code DRF tiers, expanding the effective
Step 3 range from `[0.94, 1.02]` to the full declared `[0.88, 1.04]`.

---

## Files Changed

### 1 · `src/engine/dssme/cpsFactors.ts` — Three new exported functions + `computeDRF` update

#### Step A — Replace the comment block above `getFriendLevel`

**FIND (exact):**
```typescript
// Natural Planetary Friendship Table (§9.2)
// Used by DRF, DLR, NF, HP.
// Rahu → use Saturn's row; Ketu → use Mars's row.
// ============================================================================
```

**REPLACE WITH:**
```typescript
// Natural Planetary Friendship Table (§9.2)
// Used by DRF (natural friendship baseline), DLR, NF, HP.
// Rahu → use Saturn's row; Ketu → use Mars's row.
// ============================================================================
```

#### Step B — Replace `getFriendLevel` export and add all new functions

**FIND (exact):**
```typescript
export function getFriendLevel(p: NineBody, other: NineBody): FriendLevel {
  const pProxy = proxyPlanet(p);
  const otherProxy = proxyPlanet(other);
  if (pProxy === otherProxy) return "Friend"; // same planet = friendly
  return FRIENDSHIP[pProxy]?.[otherProxy] ?? "Neutral";
}

function friendLevelToDRF(level: FriendLevel): number {
```

**REPLACE WITH:**
```typescript
/**
 * Natural friendship level (Naisargika Maitri) using the §9.2 table.
 * Rahu/Ketu use Saturn/Mars as proxy. Returns "Friend", "Neutral", or "Enemy"
 * (never "Grt.Friend" / "Grt.Enemy" — those require compound friendship; see getCompoundFriendLevel).
 */
export function getFriendLevel(p: NineBody, other: NineBody): FriendLevel {
  const pProxy = proxyPlanet(p);
  const otherProxy = proxyPlanet(other);
  if (pProxy === otherProxy) return "Friend"; // same planet = friendly
  return FRIENDSHIP[pProxy]?.[otherProxy] ?? "Neutral";
}

// ============================================================================
// Tatkalika Maitri (Temporary Friendship) & Panchadha Maitri (Compound Friendship)
// BPHS: a planet is a temporary friend of p if it occupies the 2nd, 3rd, 4th,
// 10th, 11th, or 12th house counted FROM p's house at the time of the chart.
// Used only in DRF Step 3 to unlock the Grt.Friend / Grt.Enemy tiers.
// ============================================================================

/** Houses counted from p's house that make another planet a temporary friend. */
const TATKALIKA_FRIEND_OFFSETS = new Set([2, 3, 4, 10, 11, 12]);

/**
 * Temporary (Tatkalika) friendship of `other` toward `p`.
 * Uses actual HOUSE_POSITIONS (Rahu/Ketu use their own house, not proxy).
 * Returns "Friend" or "Enemy"; if house data is missing, returns "Neutral"
 * (conservative — avoids promoting/demoting without data).
 */
export function getTemporaryFriendship(
  p: NineBody,
  other: NineBody,
  chart: Dssme16BlockResult
): "Friend" | "Enemy" | "Neutral" {
  const pHouse = chart.HOUSE_POSITIONS[p]?.house;
  const otherHouse = chart.HOUSE_POSITIONS[other]?.house;
  // Finding #3: strict validation — guard against undefined, NaN, non-integer, out-of-range
  if (
    typeof pHouse !== "number" || !Number.isInteger(pHouse) || pHouse < 1 || pHouse > 12 ||
    typeof otherHouse !== "number" || !Number.isInteger(otherHouse) || otherHouse < 1 || otherHouse > 12
  ) return "Neutral"; // data absent or invalid → no change to natural
  // Offset: which house is `other` counted FROM `p`'s house? (1 = same house)
  const offset = ((otherHouse - pHouse + 12) % 12) + 1;
  return TATKALIKA_FRIEND_OFFSETS.has(offset) ? "Friend" : "Enemy";
}

/**
 * Panchadha Maitri (Five-fold / Compound Friendship).
 * Combines Naisargika (natural) and Tatkalika (temporary) friendship.
 *
 * | Natural \ Temporary | Friend     | Enemy   |
 * |---------------------|-----------|---------|
 * | Friend              | Grt.Friend | Neutral |
 * | Neutral             | Friend     | Enemy   |
 * | Enemy               | Neutral    | Grt.Enemy |
 *
 * If temporary is "Neutral" (data absent), natural friendship is preserved unchanged.
 */
export function compoundFriendship(
  natural: FriendLevel,
  temporary: "Friend" | "Enemy" | "Neutral"
): FriendLevel {
  if (temporary === "Neutral") return natural; // no data → identity
  if (natural === "Friend"  && temporary === "Friend") return "Grt.Friend";
  if (natural === "Friend"  && temporary === "Enemy")  return "Neutral";
  if (natural === "Neutral" && temporary === "Friend") return "Friend";
  if (natural === "Neutral" && temporary === "Enemy")  return "Enemy";
  if (natural === "Enemy"   && temporary === "Friend") return "Neutral";
  if (natural === "Enemy"   && temporary === "Enemy")  return "Grt.Enemy";
  // Pass-through for Grt.Friend/Grt.Enemy (shouldn't occur from FRIENDSHIP table)
  return natural;
}

/**
 * Compound (Panchadha Maitri) friend level of `p` toward `other`.
 * Used exclusively by DRF Step 3 (§9.2) to unlock the Grt.Friend / Grt.Enemy
 * tiers that were dead-code when using natural friendship alone (§22.2.4 fix).
 * TM_v3 sub-factors (DLR/NF/HP) continue to use natural friendship only per §10.
 */
export function getCompoundFriendLevel(
  p: NineBody,
  other: NineBody,
  chart: Dssme16BlockResult
): FriendLevel {
  const natural = getFriendLevel(p, other);
  const temporary = getTemporaryFriendship(p, other, chart);
  return compoundFriendship(natural, temporary);
}

function friendLevelToDRF(level: FriendLevel): number {
```

#### Step C — Update `computeDRF()` Step 3

**FIND (exact):**
```typescript
  // Step 3: Primary MD relationship tier
  const mdLevel = getFriendLevel(p, md);
  const drfBase = friendLevelToDRF(mdLevel);

  // Step 4: AD-secondary modifier (applied exactly once)
  const adLevel = getFriendLevel(p, ad);
```

**REPLACE WITH:**
```typescript
  // Step 3: Primary MD relationship tier — uses Panchadha Maitri (compound friendship,
  // §22.2.4 fix) to unlock Grt.Friend (1.04) and Grt.Enemy (0.88) tiers.
  // Tatkalika Maitri is computed from HOUSE_POSITIONS at chart time.
  const mdLevel = getCompoundFriendLevel(p, md, chart);
  const drfBase = friendLevelToDRF(mdLevel);

  // Step 4: AD-secondary modifier (applied exactly once).
  // Uses natural (Naisargika) friendship only per §10 — no compound expansion here.
  const adLevel = getFriendLevel(p, ad);
```

---

### 2 · NEW FILE: `tests/dssme/tatkalikaMaitri.test.ts`

Create this file at `tests/dssme/tatkalikaMaitri.test.ts` with the following content
(403 lines, 28 test cases — 7 sections):

```typescript
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
      Sun:     { sign: "Leo",      degree: 15.0, dignity: "Own",     dispositor: "Sun",     house: 5 },
      Moon:    { sign: "Cancer",   degree: 10.0, dignity: "Exalted", dispositor: "Moon",    house: 4 },
      Mars:    { sign: "Aries",    degree: 20.0, dignity: "Own",     dispositor: "Mars",    house: 1 },
      Mercury: { sign: "Virgo",    degree: 5.0,  dignity: "Exalted", dispositor: "Mercury", house: 6 },
      Jupiter: { sign: "Cancer",   degree: 25.0, dignity: "Exalted", dispositor: "Moon",    house: 4 },
      Venus:   { sign: "Libra",    degree: 12.0, dignity: "Own",     dispositor: "Venus",   house: 7 },
      Saturn:  { sign: "Aquarius", degree: 8.0,  dignity: "Own",     dispositor: "Saturn",  house: 11 },
      Rahu:    { sign: "Pisces",   degree: 15.0, dignity: "Neutral", dispositor: "Jupiter", house: 12 },
      Ketu:    { sign: "Virgo",    degree: 15.0, dignity: "Neutral", dispositor: "Mercury", house: 6 },
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

const CTX_OPEN = {
  zw_state: "OPEN" as const,
  z3AmplifierCount: 0,
  z3Amplifiers: [],
  tithiIndex: 3,
  paksha: "Shukla",
  weekdayLord: "Sun" as const,
  moonNakshatra: "Rohini",
  horaLord: "Sun" as const,
};

export function runTatkalikaMaitriTests(): void {
  console.log("\n=== Tatkalika Maitri & DRF §22.2.4 Fix Tests ===\n");
  let passed = 0; let failed = 0;
  function assert(condition: boolean, msg: string): void {
    if (condition) { console.log(`  ✓ ${msg}`); passed++; }
    else { console.error(`  ✗ FAIL: ${msg}`); failed++; }
  }

  // ── Section 1: getTemporaryFriendship() ──────────────────────────────────
  console.log("Section 1: getTemporaryFriendship() — BPHS house offset rule");
  const FRIEND_OFFSETS = [2, 3, 4, 10, 11, 12];
  const ENEMY_OFFSETS  = [1, 5, 6, 7, 8, 9];
  let allFriendOk = true;
  for (const offset of FRIEND_OFFSETS) {
    const c = makeChart({ Sun: { house: 1, type: "Angular" }, Moon: { house: offset, type: "Succedent" } }, "Mars", "Saturn");
    if (getTemporaryFriendship("Sun", "Moon", c) !== "Friend") { allFriendOk = false; console.error(`  ✗ offset ${offset}: expected Friend`); failed++; }
  }
  if (allFriendOk) { console.log(`  ✓ All 6 Tatkalika friend offsets {2,3,4,10,11,12} → "Friend"`); passed++; }
  let allEnemyOk = true;
  for (const offset of ENEMY_OFFSETS) {
    const c = makeChart({ Sun: { house: 1, type: "Angular" }, Moon: { house: offset, type: "Succedent" } }, "Mars", "Saturn");
    if (getTemporaryFriendship("Sun", "Moon", c) !== "Enemy") { allEnemyOk = false; console.error(`  ✗ offset ${offset}: expected Enemy`); failed++; }
  }
  if (allEnemyOk) { console.log(`  ✓ All 6 Tatkalika enemy offsets {1,5,6,7,8,9} → "Enemy"`); passed++; }
  { const c = makeChart({ Jupiter: { house: 3, type: "Cadent" }, Saturn: { house: 12, type: "Cadent" } }, "Mars", "Moon");
    assert(getTemporaryFriendship("Jupiter", "Saturn", c) === "Friend", "Jupiter(H3)→Saturn(H12): offset=10 → Temporary Friend (wrap-around)"); }
  { const c = makeChart({ Venus: { house: 8, type: "Succedent" }, Mercury: { house: 2, type: "Succedent" } }, "Sun", "Moon");
    assert(getTemporaryFriendship("Venus", "Mercury", c) === "Enemy", "Venus(H8)→Mercury(H2): offset=7 → Temporary Enemy (wrap-around)"); }
  { const c = makeChart({}, "Mars", "Saturn");
    (c.HOUSE_POSITIONS as any)["Jupiter"] = undefined;
    assert(getTemporaryFriendship("Jupiter", "Mars", c) === "Neutral", "Missing HOUSE_POSITIONS → Neutral (conservative fallback)"); }

  // ── Section 2: compoundFriendship() ──────────────────────────────────────
  console.log("\nSection 2: compoundFriendship() — Panchadha Maitri table (6 cells + identity)");
  assert(compoundFriendship("Friend",  "Friend") === "Grt.Friend", "Friend  + Friend = Grt.Friend");
  assert(compoundFriendship("Friend",  "Enemy")  === "Neutral",    "Friend  + Enemy  = Neutral");
  assert(compoundFriendship("Neutral", "Friend") === "Friend",     "Neutral + Friend = Friend");
  assert(compoundFriendship("Neutral", "Enemy")  === "Enemy",      "Neutral + Enemy  = Enemy");
  assert(compoundFriendship("Enemy",   "Friend") === "Neutral",    "Enemy   + Friend = Neutral");
  assert(compoundFriendship("Enemy",   "Enemy")  === "Grt.Enemy",  "Enemy   + Enemy  = Grt.Enemy");
  assert(compoundFriendship("Friend",  "Neutral") === "Friend",    "Friend  + Neutral(absent) = Friend  (identity)");
  assert(compoundFriendship("Enemy",   "Neutral") === "Enemy",     "Enemy   + Neutral(absent) = Enemy   (identity)");
  assert(compoundFriendship("Neutral", "Neutral") === "Neutral",   "Neutral + Neutral(absent) = Neutral (identity)");

  // ── Section 3: getCompoundFriendLevel() ──────────────────────────────────
  console.log("\nSection 3: getCompoundFriendLevel() — end-to-end");
  { const c = makeChart({ Sun: { house: 1, type: "Angular" }, Moon: { house: 2, type: "Succedent" } }, "Mars", "Saturn");
    assert(getCompoundFriendLevel("Sun", "Moon", c) === "Grt.Friend", "Sun(H1)→Moon(H2): Natural=Friend + Temp=Friend → Grt.Friend"); }
  { const c = makeChart({ Sun: { house: 1, type: "Angular" }, Saturn: { house: 6, type: "Cadent" } }, "Mars", "Venus");
    assert(getCompoundFriendLevel("Sun", "Saturn", c) === "Grt.Enemy", "Sun(H1)→Saturn(H6): Natural=Enemy + Temp=Enemy(offset=6) → Grt.Enemy"); }
  { const c = makeChart({ Sun: { house: 1, type: "Angular" }, Venus: { house: 3, type: "Cadent" } }, "Moon", "Jupiter");
    assert(getCompoundFriendLevel("Sun", "Venus", c) === "Neutral", "Sun(H1)→Venus(H3): Natural=Enemy + Temp=Friend(offset=3) → Neutral"); }
  { const c = makeChart({ Moon: { house: 4, type: "Angular" }, Mercury: { house: 6, type: "Cadent" } }, "Jupiter", "Saturn");
    assert(getCompoundFriendLevel("Moon", "Mercury", c) === "Grt.Friend", "Moon(H4)→Mercury(H6): Natural=Friend + Temp=Friend(offset=3) → Grt.Friend"); }
  { const c = makeChart({ Jupiter: { house: 1, type: "Angular" }, Mercury: { house: 7, type: "Angular" } }, "Sun", "Saturn");
    assert(getCompoundFriendLevel("Jupiter", "Mercury", c) === "Grt.Enemy", "Jupiter(H1)→Mercury(H7): Natural=Enemy + Temp=Enemy(offset=7) → Grt.Enemy"); }

  // ── Section 4: DRF range verification ────────────────────────────────────
  console.log("\nSection 4: DRF range — §22.2.4 fix verification");
  // Case A: Grt.Friend tier (drfBase=1.04)
  { const c = makeChart({ Sun: { house: 1, type: "Angular" }, Moon: { house: 2, type: "Succedent" }, Saturn: { house: 5, type: "Succedent" } }, "Moon", "Saturn");
    const cps = computeAllCPS(c, ["Sun"], CTX_OPEN);
    const drf = cps[0]!.DRF;
    const expected = Math.min(Math.max(1.04 * 0.98, 0.88), 1.08);
    assert(Math.abs(drf - expected) < 1e-9, `DRF Grt.Friend: Sun DRF=${drf.toFixed(6)} ≈ ${expected.toFixed(6)} (drfBase=1.04×adMod=0.98)`);
    assert(drf > 1.00, `DRF Grt.Friend > 1.00 (Grt.Friend tier=1.04, net 1.0192 after adMod=0.98): ${drf.toFixed(6)} ✓`); }
  // Case B: Grt.Enemy tier (drfBase=0.88)
  { const c = makeChart({ Sun: { house: 1, type: "Angular" }, Venus: { house: 6, type: "Cadent" }, Jupiter: { house: 4, type: "Angular" } }, "Venus", "Jupiter");
    const cps = computeAllCPS(c, ["Sun"], CTX_OPEN);
    const drf = cps[0]!.DRF;
    const expected = Math.min(Math.max(0.88 * 1.01, 0.88), 1.08);
    assert(Math.abs(drf - expected) < 1e-9, `DRF Grt.Enemy: Sun DRF=${drf.toFixed(6)} ≈ ${expected.toFixed(6)} (drfBase=0.88×adMod=1.01)`);
    assert(drf < 0.94, `DRF Grt.Enemy < 0.94 (previously dead-code floor): ${drf.toFixed(6)} < 0.94 ✓`); }
  // Case C: Neutral tier
  { const c = makeChart({ Sun: { house: 1, type: "Angular" }, Moon: { house: 5, type: "Succedent" }, Mars: { house: 3, type: "Cadent" } }, "Moon", "Mars");
    const cps = computeAllCPS(c, ["Sun"], CTX_OPEN);
    const drf = cps[0]!.DRF;
    assert(Math.abs(drf - Math.min(Math.max(1.00 * 1.01, 0.88), 1.08)) < 1e-9, `DRF Friend+Enemy=Neutral: Sun DRF=${drf.toFixed(6)} ≈ 1.01`); }

  // ── Section 5: DRF identity guards ───────────────────────────────────────
  console.log("\nSection 5: DRF identity guards — unchanged by Tatkalika");
  { const c = makeChart({ Sun: { house: 1, type: "Angular" }, Moon: { house: 2, type: "Succedent" } }, "Sun", "Moon");
    const cps = computeAllCPS(c, ["Sun"], CTX_OPEN);
    assert(cps[0]!.DRF === 1.08, "DRF Step 1: p=Sun == MD=Sun → 1.08 (identity, no compound lookup)"); }
  { const c = makeChart({ Sun: { house: 1, type: "Angular" }, Mars: { house: 3, type: "Cadent" } }, "Mars", "Sun");
    const cps = computeAllCPS(c, ["Sun"], CTX_OPEN);
    assert(cps[0]!.DRF === 1.05, "DRF Step 2: p=Sun == AD=Sun, MD=Mars → 1.05 (identity, no compound lookup)"); }

  // ── Section 6: TM_v3 unchanged ───────────────────────────────────────────
  console.log("\nSection 6: TM_v3 — natural friendship only (Tatkalika has no effect)");
  { const c1 = makeChart({ Moon: { house: 4, type: "Angular" } }, "Jupiter", "Saturn");
    const c2 = makeChart({ Moon: { house: 2, type: "Succedent" } }, "Jupiter", "Saturn");
    const tm1 = computeAllCPS(c1, ["Moon"], CTX_OPEN)[0]!.TM_v3;
    const tm2 = computeAllCPS(c2, ["Moon"], CTX_OPEN)[0]!.TM_v3;
    assert(Math.abs(tm1 - tm2) < 1e-9, `TM_v3 unchanged by house position: ${tm1.toFixed(6)} == ${tm2.toFixed(6)} (natural only)`); }

  // ── Section 7: getFriendLevel natural-only ────────────────────────────────
  console.log("\nSection 7: getFriendLevel() — natural-table values only");
  const planets = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"] as const;
  const naturalLevels: string[] = [];
  for (const a of planets) { for (const b of planets) { naturalLevels.push(getFriendLevel(a, b)); } }
  assert(naturalLevels.every(l => ["Friend","Neutral","Enemy"].includes(l)),
    "getFriendLevel() returns only Friend/Neutral/Enemy (never Grt.Friend or Grt.Enemy)");

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
```

---

### 3 · `tests/run_all_tests.ts` — Two-line addition

#### Step A — Add import (after line 30, `runDssmePipelineTests` import)

**FIND (exact):**
```typescript
import { runDssmePipelineTests } from "./dssme/dssmePipeline.test.ts";
```

**REPLACE WITH:**
```typescript
import { runDssmePipelineTests } from "./dssme/dssmePipeline.test.ts";
import { runTatkalikaMaitriTests } from "./dssme/tatkalikaMaitri.test.ts";
```

#### Step B — Register suite (after `runDssmePipelineTests` entry)

**FIND (exact):**
```typescript
  { name: "DSSME S0→S15 Pipeline Unit Tests", run: runDssmePipelineTests },
```

**REPLACE WITH:**
```typescript
  { name: "DSSME S0→S15 Pipeline Unit Tests", run: runDssmePipelineTests },
  { name: "DSSME Tatkalika Maitri & DRF §22.2.4 Fix", run: runTatkalikaMaitriTests },
```

---

## Verification Commands

After applying all changes, run in this order:

```powershell
# Step 1 — TypeScript type-check (must be 0 errors)
Set-Location "f:\dssme-event-calculation-engine"
npm run lint

# Step 2 — Standalone run (Finding #1 isDirectRun block enables this)
npx bun run .\tests\dssme\tatkalikaMaitri.test.ts
# Expected output: "✓ TATKALIKA MAITRI & DRF §22.2.4 FIX — All Passed!" (28/28)

# Step 3 — Full suite (25 suites, exit code 0 = all pass)
npx bun run .\tests\run_all_tests.ts
# Expected final line: ALL DSSME DETERMINISTIC TESTS PASSED SUCCESSFULLY (25/25)
```

> [!NOTE]
> **Finding #2 — Existing test suites unaffected:**
> `acceptance.test.ts`, `cpsAcceptanceA1ToA13.test.ts`, and `dssmePipeline.test.ts` only
> use DRF range-checks (`[0.88, 1.08]`) and `Number.isFinite(DRF)` guards — they do **not**
> assert exact DRF values that would be affected by the Tatkalika compound upgrade.
> `conformance_vectors.test.ts` uses `md_tier_value` injection for CPS-sensitive vectors,
> so conformance vectors are also unaffected. All 25 suites pass without modification.

> [!NOTE]
> **Finding #4 — HOUSE_POSITIONS data source is correct:**
> `getTemporaryFriendship()` reads `HOUSE_POSITIONS[p].house` (1..12 Whole-Sign house numbers).
> `shadbala.ts::getTatkalikaMaitri()` uses rasi index (0..11). In DSSME Whole-Sign system,
> house distance = rasi distance (no offset), so both approaches are equivalent. No conflict.

---

## What Changed: Before vs After

| Aspect | Before | After |
|---|---|---|
| DRF Step 3 effective range | `[0.94, 1.02]` (dead-code tiers) | `[0.88, 1.04]` (full declared range) |
| `Grt.Friend → 1.04` reachable? | ❌ Never | ✅ When compound friendship qualifies |
| `Grt.Enemy → 0.88` reachable? | ❌ Never | ✅ When compound friendship qualifies |
| `getFriendLevel()` output | `Friend/Neutral/Enemy` only | Unchanged (still natural only) |
| `TM_v3` (DLR/NF/HP) | Natural friendship | Unchanged (still natural only) |
| DRF Step 1/2 identity guards | `1.08` / `1.05` | Unchanged |
| `HOUSE_POSITIONS` usage in DRF | None | Step 3 only (Tatkalika source) |
| Missing house data fallback | N/A | Returns `"Neutral"` → no change to natural |

## Key Design Decisions

> [!NOTE]
> **Why only Step 3, not Step 4?**
> Step 4 (AD-secondary modifier) uses `Friend → ×1.01`, `Enemy → ×0.98`. Compound
> friendship would collapse `Grt.Friend` and `Grt.Enemy` into the same ×1.01 / ×0.98
> multiplier, making the compound step redundant. §10 only specifies Friend/Enemy/Neutral
> for TM-family factors. Natural friendship is correct for Step 4.

> [!NOTE]
> **Conservative fallback for missing data**
> If `HOUSE_POSITIONS[p]` or `HOUSE_POSITIONS[other]` is absent, `getTemporaryFriendship`
> returns `"Neutral"` → `compoundFriendship` preserves the natural level unchanged.
> This ensures graceful degradation without introducing phantom upgrades or penalties.

> [!IMPORTANT]
> **§22.2.4 closed.** This implementation resolves the open item in
> `DSSME_MASTER_CONTRACT_v1.6.md §22.2 item 4`. The v1.7 contract update should
> remove item 4 from the Known Open Items list and add a note in §9.2 Step 3:
> *"Uses Panchadha Maitri (compound friendship) combining Naisargika (§9.2 table)
> and Tatkalika Maitri (HOUSE_POSITIONS offset rule, BPHS) to enable all five tiers."*

---

*End of install prompt — DSSME_DRF_TATKALIKA_MAITRI_UPGRADE_2026_1030.md*
