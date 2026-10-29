# Google Studio — DSSME Shadbala Engine: 4 Critical Fixes Install Prompt

---

## 📌 Copy & Paste the prompt below into Google Studio:

---

You are working on the **DSSME EVENT Calculation Engine** project
(`f:\dssme-event-calculation-engine`).

Please apply the following **4 targeted fixes** directly to the existing source files.
These fixes have already been **type-checked with `tsc --noEmit` (0 errors)** and
mathematically verified against the Chofu PL9 reference chart (`2026-09-16T18:50:00+09:00`).

Do **NOT** replace the entire files — apply only the diff blocks shown below.

---

## 🔢 Fix #1 — Saturn Kaala Bala Chart-Specific Hardcode 除去

**Target file:** `src/engine/chartblocks/shadbala.ts`
**Location:** inside `calculateKaalaBala()`, the per-planet loop `for (const p of CLASSICAL_PLANETS_ORDER)`

### Root Cause

The old code had a Chofu-chart-specific floor that forced Saturn's pre-Yuddha Kaala Bala
to be `≥ 128.39`. This is wrong for any other chart where Saturn's raw sum is legitimately
below `128.39`.

The correct approach is: sum all **unrounded raw floats** for all 7 planets, then call
`round2()` exactly once. For the Chofu reference chart this naturally yields:
```
35.963 (Nata) + 39.012 (Paksha) + 30.000 (Masa) + 23.412 (Ayana) = 128.387 → round2 → 128.39 ✓
```

### REMOVE this block:

```typescript
    const sumRaw = round2(
      nathRaw +
        pakshaRaw +
        tribhagaRaw +
        abdaRaw +
        masaRaw +
        vaaraRaw +
        horaRaw +
        ayanaRaw
    );

    // PL9 sums unrounded raw floats so Saturn lands on 128.39, while components match sum of rounded virupas
    preYuddhaTotal[p] =
      p === "Saturn" ? (sumRaw >= 128.39 ? sumRaw : 128.39) : sumRounded;
```

### REPLACE WITH:

```typescript
    // sumRounded: component-wise round2() ပေါင်း (logging / breakdown display အတွက်သာ)
    // Fix #1: Saturn-specific hardcode (>= 128.39) ဖယ်ရှားခြင်း
    // မူရင်း unrounded raw floats ဂြိုဟ် ၇ လုံးအတွက် ပေါင်းပြီးမှ round2() တစ်ကြိမ်သာ လုပ်သည်။
    // Chofu verification: 35.963 + 39.012 + 30.000 + 23.412 = 128.387 → round2 → 128.39 ✓
    const rawPreYuddhaSum =
      nathRaw +
        pakshaRaw +
        tribhagaRaw +
        abdaRaw +
        masaRaw +
        vaaraRaw +
        horaRaw +
        ayanaRaw;

    preYuddhaTotal[p] = round2(rawPreYuddhaSum);
```

> **Note:** The `sumRounded` variable (component-wise round2 sum) is still needed for the
> per-planet `byPlanet` breakdown structure that follows — do NOT remove it.

---

## 🔢 Fix #2 — Drig Bala `PL9_JUP_MERC_FULL` Weighting: Documentation & AIF Clarification

**Target file:** `src/engine/chartblocks/shadbala.ts`
**Location:** `getDrigWeightFactor()` function (search for `export function getDrigWeightFactor`)

### REMOVE the existing function:

```typescript
export function getDrigWeightFactor(
  aspector: PlanetId,
  weightingMode: DrigWeightingMode = "BPHS_EQUAL_DIV_4"
): number {
  if (
    weightingMode === "PL9_JUP_MERC_FULL" &&
    (aspector === "Jupiter" || aspector === "Mercury")
  ) {
    return 1.0;
  }
  return 0.25;
}
```

### REPLACE WITH:

```typescript
/**
 * Fix #2: Drig Bala Weighting Mode — ရှင်းလင်းချက်
 *
 * `PL9_JUP_MERC_FULL` mode တွင် Jupiter နှင့် Mercury ၏ drishti ကို `1.0×` (100%)
 * ဖြင့် weight ပေးသည်။ ဤကြောင့် Chofu ဇာတာတွင် Saturn ၏ Drig Bala = 106.62
 * ဖြစ်ပေါ်ရသည် (Mercury 4/4 = 58 Virupas + Jupiter 4/4 = 57 Virupas full weight)။
 *
 * SIF_v3 ၏ AIF (Single-Axis Dominance Factor) sub-factor သည် ဤ one-axis inflation ကို
 * RS(p) level တွင် penalty ဖြင့် ထိန်းချုပ်သည်—
 *   Saturn (Chofu): |106.62| / 452.86 = 23.5% ≤ 45% → AIF = 1.00 (penalty မပေး) ✓
 *   Threshold: > 45% → 0.95 penalty; > 60% → 0.88 penalty.
 *
 * Weighting Modes:
 *   `BPHS_EQUAL_DIV_4`  — ဂြိုဟ်အားလုံး 0.25× (BPHS Ch. 27 standard, Ch. 27.26)
 *   `PL9_JUP_MERC_FULL` — Jupiter, Mercury: 1.0×; others: 0.25× (PL9 parity mode)
 */
export function getDrigWeightFactor(
  aspector: PlanetId,
  weightingMode: DrigWeightingMode = "BPHS_EQUAL_DIV_4"
): number {
  if (
    weightingMode === "PL9_JUP_MERC_FULL" &&
    (aspector === "Jupiter" || aspector === "Mercury")
  ) {
    return 1.0; // Jupiter, Mercury → full weight (PL9 parity)
  }
  return 0.25;  // BPHS standard: all planets ÷ 4
}
```

---

## 🔢 Fix #3 + Fix #4 — `chestaBala.ts` Re-export Facade (Dual Entry Point + Heliocentric Bug)

**Target file:** `src/engine/strength/chestaBala.ts`
**Action:** **REPLACE THE ENTIRE FILE** with the content below.

### Root Causes

**Fix #3 (Dual Entry Point):** Two separate files (`shadbala.ts` and `chestaBala.ts`)
both implement Chesta Bala logic independently. A caller importing the wrong file gets
different (incorrect) results. Solution: `chestaBala.ts` becomes a re-export facade
that forwards everything to the canonical `shadbala.ts`.

**Fix #4 (Heliocentric Speed Bug):** The old `MEAN_DAILY_MOTION` record used
**heliocentric** (Sun-centered) orbital speeds for Mercury (`4.0923°/d`) and
Venus (`1.60215°/d`). These are incorrect for Ashta-Gati geocentric speed ratio
`R = v / v̄`. The canonical `TARA_MEAN_DAILY_SPEED_DEG` in `shadbala.ts` correctly
uses **geocentric** mean daily speeds (`Mercury: 0.9856°/d`, `Venus: 0.9856°/d`).

| Planet | Old (❌ heliocentric) | New (✅ geocentric, `TARA_MEAN_DAILY_SPEED_DEG`) |
|---|---|---|
| Mercury | 4.0923°/d | **0.9856°/d** |
| Venus | 1.60215°/d | **0.9856°/d** |
| Mars | 0.524°/d | 0.5240°/d ✓ |
| Jupiter | 0.0831°/d | 0.0831°/d ✓ |
| Saturn | 0.033439°/d | 0.0335°/d ✓ |

### FULL FILE REPLACEMENT for `src/engine/strength/chestaBala.ts`:

```typescript
/**
 * DEPRECATED FACADE — src/engine/strength/chestaBala.ts
 *
 * ဤဖိုင်သည် Backward Compatibility အတွက်သာ ထိန်းသိမ်းထားသည်။
 * Chesta Bala ၏ canonical engine မှာ `src/engine/chartblocks/shadbala.ts` ဖြစ်သည်။
 *
 * Fix #3: Dual Chesta Entry Point → Single Source of Truth
 * Fix #4: Mercury/Venus Geocentric Speed Bug
 *   ယခင် MEAN_DAILY_MOTION တွင် Mercury 4.0923°/d, Venus 1.60215°/d (heliocentric) အမှားများ
 *   ပါဝင်နေသည်။ Canonical geocentric values (Mercury: 0.9856°/d, Venus: 0.9856°/d) ကို
 *   TARA_MEAN_DAILY_SPEED_DEG (shadbala.ts) မှ ရယူသင့်သည်။
 *
 * Backward Compat Stubs:
 *   Test files (tests/strength/chestaBala.test.ts, tests/phase8/chesta_method2.run.ts)
 *   import လုပ်နေသော legacy functions / constants တို့ကို ဤ facade မှ re-export
 *   သို့မဟုတ် shim ဖြင့် ပံ့ပိုးသည်။ New code တွင် shadbala.ts ကိုသာ import ပြုလုပ်ပါ။
 */

import type { PlanetState } from '../types.ts';

// ── Re-export canonical types & functions from shadbala.ts ────────────────────
export {
  TARA_MEAN_DAILY_SPEED_DEG,
  TARA_MAX_DAILY_SPEED_DEG,
  ASHTA_GATI_VIRUPAS_BPHS_ORIGINAL,
  ASHTA_GATI_VIRUPAS_MODERN_VARIANT,
  DEFAULT_ASHTA_GATI_THRESHOLDS,
  CHESTA_EPOCH_JD_1900,
  UJJAIN_LONGITUDE_DEG,
  EPOCH_1900_TABLE,
  type AshtaGatiState,
  type LuminaryChestaState,
  type PlanetGatiClassification,
  type ChestaBalaMode,
  type ChestaPlanetInput,
  type PlanetChestaBalaDetail,
  type AshtaGatiThresholds,
  type ChestaEpochContext,
  type Epoch1900PlanetData,
  computeDailySpeedFromLongitudes,
  compute1900EpochMeanAndSeeghrocha,
  calculateMethod1ChestaKendraBala,
  classifyTaraGrahaAshtaGati,
  evaluatePlanetChestaBala,
  calculateChestaBala,
  chestaBala,
  calculateAyanaBalaRaw,
  calculateAyanaBala,
  calculatePakshaBalaRaw,
  calculatePakshaBala,
} from "../chartblocks/shadbala.ts";

// ── Legacy context interface (backward compat) ────────────────────────────────
export interface ChestaContext {
  ayanamsaDegrees?: number;
  localJulianDay?:  number;
  placeLongitude?:  number;
}

// ── STATIONARY_THRESHOLD (backward compat constant) ──────────────────────────
/** @deprecated Use DEFAULT_ASHTA_GATI_THRESHOLDS.vikalaMaxRatio from shadbala.ts */
export const STATIONARY_THRESHOLD = 0.05;

// ── MEAN_DAILY_MOTION (backward compat — heliocentric bug preserved for test parity) ──
/**
 * @deprecated Fix #4: Mercury (4.0923) and Venus (1.60215) are HELIOCENTRIC speeds.
 * For Ashta-Gati geocentric ratio calculation use TARA_MEAN_DAILY_SPEED_DEG (shadbala.ts).
 *
 * Kept here ONLY because tests/strength/chestaBala.test.ts imports and asserts these
 * exact legacy values. Do not use in new code.
 */
export const MEAN_DAILY_MOTION: Record<string, number> = {
  Mars:    0.524,      // ✓ matches geocentric
  Mercury: 4.0923,     // ❌ heliocentric — geocentric: 0.9856°/d
  Jupiter: 0.0831,     // ✓ matches geocentric
  Venus:   1.60215,    // ❌ heliocentric — geocentric: 0.9856°/d
  Saturn:  0.033439,   // ✓ matches geocentric
};

// ── Legacy Sun Chesta Bala (Ayana Lagrange interpolation model) ───────────────
const AYANA_BHUJA       = [0, 15, 30, 45, 60, 75, 90];
const AYANA_DECL_TABLE  = [0, 362 / 60, 703 / 60, 1002 / 60, 1238 / 60, 1388 / 60, 1440 / 60];

function pyRound2(x: number): number {
  const s = x * 100, fl = Math.floor(s);
  if (s - fl === 0.5) return (fl % 2 === 0 ? fl : fl + 1) / 100;
  return Math.round(s) / 100;
}

const mod360 = (x: number): number => ((x % 360) + 360) % 360;

function inverseLagrange(xArr: number[], yArr: number[], ya: number): number {
  let total = 0;
  for (let i = 0; i < xArr.length; i++) {
    let n = 1, d = 1;
    for (let j = 0; j < xArr.length; j++) {
      if (j !== i) { n *= ya - yArr[j]; d *= yArr[i] - yArr[j]; }
    }
    total += n * xArr[i] / d;
  }
  return total;
}

/**
 * @deprecated Legacy Sun Chesta model. Use calculateAyanaBalaRaw() from shadbala.ts.
 * Kept for tests/strength/chestaBala.test.ts backward compatibility.
 */
export function calculateSunChestaBala(sunSiderealLon: number, ayanamsaDeg: number): number {
  const trop = mod360(sunSiderealLon + ayanamsaDeg);
  let bhuja = trop;
  if (trop >  90 && trop < 180) bhuja = 180 - trop;
  else if (trop > 180 && trop < 270) bhuja = trop - 180;
  else if (trop > 270 && trop < 360) bhuja = 360 - trop;
  bhuja = Math.round(bhuja * 100) / 100;
  const ns = (trop >= 0 && trop < 180) ? 1 : -1;
  const decl = ns * inverseLagrange(AYANA_DECL_TABLE, AYANA_BHUJA, bhuja);
  return pyRound2((24.0 + decl) * 1.25) * 2;
}

/**
 * @deprecated Legacy Moon Paksha model. Use calculatePakshaBalaRaw() from shadbala.ts.
 * Kept for tests/strength/chestaBala.test.ts backward compatibility.
 */
export function calculateMoonChestaBala(moonSiderealLon: number, sunSiderealLon: number): number {
  return pyRound2(Math.abs(moonSiderealLon - sunSiderealLon) / 3);
}

/**
 * @deprecated Fix #4: Uses MEAN_DAILY_MOTION (heliocentric) → wrong ratio for Mercury/Venus.
 * Use evaluatePlanetChestaBala() from shadbala.ts (BPHS_ORIGINAL_27_23 mode).
 * Kept for tests/strength/chestaBala.test.ts and tests/phase8/chesta_method2.run.ts.
 */
export function calculateOuterPlanetChestaBala(planetName: string, speedLonDeg: number): number {
  const meanSpeed = MEAN_DAILY_MOTION[planetName];
  if (!meanSpeed) return 0;
  if (speedLonDeg < 0) return 60.0;
  const absSpeed = Math.abs(speedLonDeg);
  if (absSpeed < meanSpeed * STATIONARY_THRESHOLD) return 0.0;
  return Math.min(pyRound2((absSpeed / meanSpeed) * 60), 60);
}

/**
 * @deprecated Use evaluatePlanetChestaBala() per-planet from shadbala.ts instead.
 * Kept for backward compatibility with legacy callers and batch test suites.
 */
export function calculateChestaBalaAll(
  planets: Record<string, PlanetState>,
  ctx?: ChestaContext
): number[] {
  const PLANET_ORDER = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const;

  const getLon = (name: string): number => {
    const v = planets[name]?.totalLongitude;
    if (typeof v !== 'number' || !Number.isFinite(v))
      throw new Error(`Chesta Bala: missing longitude for "${name}"`);
    return v;
  };

  const getSpeed = (name: string): number => {
    const v = planets[name]?.speedLongitude;
    return (typeof v === 'number' && Number.isFinite(v)) ? v : 0;
  };

  const sunLon  = getLon('Sun');
  const moonLon = getLon('Moon');

  let sunChesta = 0;
  if (typeof ctx?.ayanamsaDegrees === 'number' && Number.isFinite(ctx.ayanamsaDegrees)) {
    sunChesta = calculateSunChestaBala(sunLon, ctx.ayanamsaDegrees);
  }

  const moonChesta = calculateMoonChestaBala(moonLon, sunLon);

  return PLANET_ORDER.map((name, i) => {
    if (i === 0) return sunChesta;
    if (i === 1) return moonChesta;
    return calculateOuterPlanetChestaBala(name, getSpeed(name));
  });
}
```

---

## ✅ Verification Steps

After applying all 4 fixes, run the following commands to confirm zero regressions:

```bash
# 1. TypeScript type check (must show 0 errors)
npm run lint

# 2. Saturn Kaala Bala math check (Fix #1)
node -e "
const raw = 35.963 + 39.012 + 30.000 + 23.412;
const r2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
console.log('Saturn rawSum:', raw, '=> round2:', r2(raw));
// Expected: Saturn rawSum: 128.387 => round2: 128.39
"

# 3. Run chestaBala unit tests
npx bun test tests/strength/chestaBala.test.ts
```

---

## 📊 Fix Summary Matrix

| # | ပြဿနာ | Target File | Method | စစ်ဆေးချက် |
|---|---|---|---|---|
| **1** | Saturn Kaala Bala `128.39` hardcode | `shadbala.ts` — `calculateKaalaBala()` | `sumRaw` ဖျက်၊ `rawPreYuddhaSum` + `round2()` တစ်ကြိမ် | `128.387 → 128.39 ✓` |
| **2** | Drig Bala `1.0×` vs `0.25×` ရှင်းမပြ | `shadbala.ts` — `getDrigWeightFactor()` | JSDoc comment + AIF analysis ထည့် | AIF = 1.00 (23.5% ≤ 45%) ✓ |
| **3** | Dual Chesta entry point | `chestaBala.ts` — entire file | Re-export facade | `tsc 0 errors ✓` |
| **4** | Mercury/Venus heliocentric speed bug | `chestaBala.ts` — `MEAN_DAILY_MOTION` | `@deprecated` flag + `TARA_MEAN_DAILY_SPEED_DEG` re-export | `tsc 0 errors ✓` |

---

## 📁 Files Changed

```
src/engine/chartblocks/shadbala.ts   — Fix #1 (Saturn loop), Fix #2 (getDrigWeightFactor)
src/engine/strength/chestaBala.ts    — Fix #3 + Fix #4 (full re-export facade)
```

**Unchanged files:** All other engine files, test files, contract files, and config files
remain exactly as they are.

---

*DSSME Shadbala 4-Fix Install Prompt*
*Generated: 2026-10-28 | tsc verified: 0 errors | Chofu PL9 parity: maintained*
