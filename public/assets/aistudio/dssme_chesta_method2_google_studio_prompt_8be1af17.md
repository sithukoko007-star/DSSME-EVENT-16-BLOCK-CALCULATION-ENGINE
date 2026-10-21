# Google Studio Prompt: Chesta Bala Method 2 (Speed & Retrograde BPHS) Update

Google Studio (AI Studio) တွင် **Chesta Bala (Motional Strength) Method 2 — Speed & Retrograde (BPHS Classical)** ကို အောင်မြင်စွာ တပ်ဆင် update ပြုလုပ်ရန် အောက်ပါ Prompt ကို အပြည့်အစုံ copy ကူးယူ၍ အသုံးပြုနိုင်ပါသည်။

---

## 📋 Google Studio သို့ ပေးပို့ရမည့် Prompt

```markdown
Please update Chesta Bala (Motional Strength) in the DSSME Event Calculation Engine to **Method 2 — Speed & Retrograde (BPHS Classical)**.

### 1. Overview & Algorithm (Method 2)
- **Sun (Ayana Model)**: Declination model via Lagrange 7-point Surya-Siddhanta table:
  `tropical = (sidereal + ayanamsa) % 360`
  `decl = Lagrange(tropical reduced to bhuja 0-90°)`
  `val = round((24 + decl) * 1.25, 2) * 2` (range 0–120 virupas)
- **Moon (Paksha Model)**: Elongation model:
  `elongation = |moon_lon - sun_lon|`
  `val = round(elongation / 3, 2)` (range 0–60 virupas)
- **Outer 5 Planets (Mars, Mercury, Jupiter, Venus, Saturn)**:
  - **Retrograde (speedLongitude < 0)**: `60.00` virupas (full maximum strength)
  - **Stationary (|speedLongitude| < meanSpeed * 0.05)**: `0.00` virupas
  - **Direct (speedLongitude > 0)**: `min(round((|speed| / meanSpeed) * 60, 2), 60)` virupas
- **Mean Daily Motions**:
  Mars: `0.524`, Mercury: `4.0923`, Jupiter: `0.0831`, Venus: `1.60215`, Saturn: `0.033439` (deg/day)
- **Hard Cap**: All outer planets capped at `60.00` virupas.

---

### 2. Cleanup Legacy Epoch-Table Files
Please remove all deprecated epoch-table scripts and data fixtures if they exist:
```bash
rm -f tests/phase8/chesta.run.ts tests/phase8/chesta.random.ts tests/phase8/gen_chesta_gt.ts tests/phase8/gen_chesta_gt_classical.ts
rm -f tests/phase8/data/chesta_gt.json tests/phase8/data/chesta_gt_classical.json tests/phase8/data/chesta_random.json tests/phase8/data/chesta_tables.json tests/phase8/data/year_pairs.json
```

---

### 3. Target Files & Implementations

Please extract or update the following 3 files (from `dssme_chesta_method2_3files.zip` or write them directly):

#### File 1: `src/engine/strength/chestaBala.ts`
```typescript
/**
 * DSSME EVENT ENGINE V1.0 - CHESTA BALA (MOTIONAL STRENGTH) -- METHOD 2: SPEED & RETROGRADE
 * Source of truth: Brihat Parashara Hora Shastra (BPHS) Ch.27
 */

import { PlanetState } from '../types.js';
import { SHADBALA_PLANETS } from './shadbalaConstants.js';

// ── Planet index constants ────────────────────────────────────────────────────
const SUN = 0, MOON = 1;

// ── Mean daily motions (degrees/day) — Surya-Siddhanta / BPHS ───────────────
export const MEAN_DAILY_MOTION: Record<string, number> = {
  Mars:    0.524,
  Mercury: 4.0923,
  Jupiter: 0.0831,
  Venus:   1.60215,
  Saturn:  0.033439,
};

/** Fraction of mean motion below which a planet is considered stationary. */
export const STATIONARY_THRESHOLD = 0.05;

// ── Ayana declination table (7-point, Surya-Siddhanta) ───────────────────────
const AYANA_BHUJA      = [0, 15, 30, 45, 60, 75, 90];
const AYANA_DECL_TABLE = [0, 362 / 60, 703 / 60, 1002 / 60, 1238 / 60, 1388 / 60, 1440 / 60];

// ── Pure math helpers ────────────────────────────────────────────────────────

/** Python-compatible round(x, 2): exact 0.5 ties → nearest even digit. */
function pyRound2(x: number): number {
  const s = x * 100, fl = Math.floor(s);
  if (s - fl === 0.5) return (fl % 2 === 0 ? fl : fl + 1) / 100;
  return Math.round(s) / 100;
}

const mod360 = (x: number): number => ((x % 360) + 360) % 360;

/** Lagrange inverse interpolation (7-point table). */
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

// ── Sun Chesta Bala (Ayana model) ─────────────────────────────────────────────
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

// ── Moon Chesta Bala (Paksha model) ──────────────────────────────────────────
export function calculateMoonChestaBala(moonSiderealLon: number, sunSiderealLon: number): number {
  return pyRound2(Math.abs(moonSiderealLon - sunSiderealLon) / 3);
}

// ── Outer planet Chesta Bala (Speed & Retrograde — BPHS Method 2) ────────────
export function calculateOuterPlanetChestaBala(planetName: string, speedLonDeg: number): number {
  const meanSpeed = MEAN_DAILY_MOTION[planetName];
  if (!meanSpeed) return 0;

  // Retrograde motion → full 60 virupas
  if (speedLonDeg < 0) return 60.0;

  const absSpeed = Math.abs(speedLonDeg);

  // Stationary (speed < 5% of mean) → 0 virupas
  if (absSpeed < meanSpeed * STATIONARY_THRESHOLD) return 0.0;

  // Direct motion → proportional, capped at 60
  return Math.min(pyRound2((absSpeed / meanSpeed) * 60), 60);
}

// ── Context interface ─────────────────────────────────────────────────────────
export interface ChestaContext {
  ayanamsaDegrees?: number;
  localJulianDay?:  number;
  placeLongitude?:  number;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function calculateChestaBalaAll(
  planets: Record<string, PlanetState>,
  ctx?: ChestaContext
): number[] {
  const getLon = (name: string): number => {
    const v = planets[name]?.totalLongitude;
    if (typeof v !== 'number' || !Number.isFinite(v))
      throw new Error(`Chesta Bala: missing longitude for "${name}"`);
    return v;
  };

  const getSpeed = (name: string): number => {
    const v = planets[name]?.speedLongitude;
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return 0;
    }
    return v;
  };

  const sunLon  = getLon('Sun');
  const moonLon = getLon('Moon');

  // ── Sun (Ayana model) ──
  let sunChesta = 0;
  if (typeof ctx?.ayanamsaDegrees === 'number' && Number.isFinite(ctx.ayanamsaDegrees)) {
    sunChesta = calculateSunChestaBala(sunLon, ctx.ayanamsaDegrees);
  }

  // ── Moon (Paksha model) ──
  const moonChesta = calculateMoonChestaBala(moonLon, sunLon);

  // ── Outer 5 (Speed & Retrograde method) ──
  return SHADBALA_PLANETS.map((name, i) => {
    if (i === SUN)  return sunChesta;
    if (i === MOON) return moonChesta;
    return calculateOuterPlanetChestaBala(name, getSpeed(name));
  });
}
```

#### File 2: `src/engine/chartblocks/shadbala.ts`
Import `calculateChestaBalaAll` and `calculateOuterPlanetChestaBala`:
```typescript
import {
  calculateChestaBalaAll,
  calculateOuterPlanetChestaBala,
} from "../strength/chestaBala.ts";
```
And replace the internal `chestaBala()` function (around lines 555-600) with:
```typescript
/**
 * Chesta Bala — motional strength (Method 2: Speed & Retrograde BPHS Classical).
 *
 * Sun  → Sun Chesta Bala = Ayana Bala (BPHS Ch.27)
 * Moon → Moon Chesta Bala = Paksha Bala (BPHS Ch.27)
 * Mars, Mercury, Jupiter, Venus, Saturn → Delegated to calculateOuterPlanetChestaBala:
 *   - Retrograde (speed < 0) → 60 virupas (full max)
 *   - Stationary (|speed| < mean * 0.05) → 0 virupas
 *   - Direct (speed > 0) → min(round(|speed| / mean * 60, 2), 60)
 */
function chestaBala(
  planet: ClassicalPlanet,
  speedLon: number,
  sunAyanaBala: number,   // pre-computed Sun Ayana Bala (for Sun's Chesta slot)
  moonPakshaBala: number, // pre-computed Moon Paksha Bala (for Moon's Chesta slot)
): number {
  if (planet === "Sun")  return sunAyanaBala;
  if (planet === "Moon") return moonPakshaBala;
  return calculateOuterPlanetChestaBala(planet, speedLon);
}
```

#### File 3: `tests/phase8/chesta_method2.run.ts`
```typescript
/**
 * DSSME Phase 8 — Chesta Bala Method 2: Speed & Retrograde Verification
 * Tests:  retrograde → 60, stationary → 0, direct → proportional, Sun/Moon models
 */

import { calculateChestaBalaAll, calculateSunChestaBala, calculateMoonChestaBala, calculateOuterPlanetChestaBala } from '../../src/engine/strength/chestaBala.js';

let pass = 0, fail = 0;
function check(label: string, got: number, expected: number, tol = 0.01) {
  if (Math.abs(got - expected) <= tol) {
    console.log(`  ✅ ${label}: ${got.toFixed(2)} (expected ${expected})`);
    pass++;
  } else {
    console.error(`  ❌ ${label}: got ${got.toFixed(4)}, expected ${expected}`);
    fail++;
  }
}

// ─── 1. Retrograde planets → 60 virupas ─────────────────────────────────────
console.log('\n[1] Retrograde → 60 virupas');
check('Mars  retrograde', calculateOuterPlanetChestaBala('Mars',    -0.3),   60);
check('Mercury retrograde', calculateOuterPlanetChestaBala('Mercury', -1.2),  60);
check('Jupiter retrograde', calculateOuterPlanetChestaBala('Jupiter', -0.04), 60);
check('Venus retrograde',   calculateOuterPlanetChestaBala('Venus',   -0.8),  60);
check('Saturn retrograde',  calculateOuterPlanetChestaBala('Saturn',  -0.01), 60);

// ─── 2. Stationary planets → 0 virupas ──────────────────────────────────────
console.log('\n[2] Stationary (|speed| < 5% of mean) → 0 virupas');
check('Mars  stationary', calculateOuterPlanetChestaBala('Mars',    0.025),  0);
check('Saturn stationary', calculateOuterPlanetChestaBala('Saturn', 0.001),  0);
check('Mercury stationary', calculateOuterPlanetChestaBala('Mercury', 0.15), 0);

// ─── 3. Direct motion → proportional (capped at 60) ─────────────────────────
console.log('\n[3] Direct motion → proportional (capped at 60)');
check('Mars at mean speed',   calculateOuterPlanetChestaBala('Mars',    0.524),   60);
check('Mars at half speed',   calculateOuterPlanetChestaBala('Mars',    0.262),   30);
check('Jupiter at mean speed',calculateOuterPlanetChestaBala('Jupiter', 0.0831),  60);
check('Saturn at mean speed', calculateOuterPlanetChestaBala('Saturn',  0.033439),60);
check('Venus above mean → 60',calculateOuterPlanetChestaBala('Venus',   3.2),     60);

// ─── 4. Sun Chesta Bala (Ayana model) ────────────────────────────────────────
console.log('\n[4] Sun Chesta Bala — Ayana model');
const sunAtEquinox = calculateSunChestaBala(0, 0);
check('Sun at vernal equinox (trop=0)', sunAtEquinox, 60.0, 0.5);
const sunAtSolstice = calculateSunChestaBala(90, 0);
check('Sun at summer solstice (trop=90)', sunAtSolstice, 120.0, 0.5);

// ─── 5. Moon Chesta Bala (Paksha model) ──────────────────────────────────────
console.log('\n[5] Moon Chesta Bala — Paksha model');
check('Moon full moon (elong=180)', calculateMoonChestaBala(180, 0),   60.0);
check('Moon new moon  (elong=0)',   calculateMoonChestaBala(0,   0),    0.0);
check('Moon quarter   (elong=90)',  calculateMoonChestaBala(90,  0),   30.0);

// ─── 6. Full array (7 planets) ───────────────────────────────────────────────
console.log('\n[6] calculateChestaBalaAll — 7-planet array');
const planets = {
  Sun:     { name: 'Sun',     totalLongitude: 300, speedLongitude:  0.98 },
  Moon:    { name: 'Moon',    totalLongitude:  60, speedLongitude: 13.10 },
  Mars:    { name: 'Mars',    totalLongitude: 210, speedLongitude: -0.30 },
  Mercury: { name: 'Mercury', totalLongitude: 285, speedLongitude:  2.00 },
  Jupiter: { name: 'Jupiter', totalLongitude: 150, speedLongitude:  0.04 },
  Venus:   { name: 'Venus',   totalLongitude:  20, speedLongitude:  0.024 },
  Saturn:  { name: 'Saturn',  totalLongitude: 330, speedLongitude: -0.01 },
};
const result = calculateChestaBalaAll(planets, { ayanamsaDegrees: 23.15 });
check('Mars  is 60 (retrograde)',    result[2]!, 60.0);
check('Saturn is 60 (retrograde)',   result[6]!, 60.0);
check('Venus  is 0 (stationary)',    result[5]!, 0.0);

console.log(`\n${'─'.repeat(60)}`);
console.log(`  Result: ${pass} passed, ${fail} failed`);
if (fail === 0) console.log('  ✅ ALL CHESTA METHOD 2 TESTS PASSED');
else { console.error('  ❌ SOME TESTS FAILED'); process.exit(1); }
```

---

### 4. Verification Commands to Execute
After applying the 3 files, run these verification commands:
1. `npx tsc --noEmit` (Should report 0 errors)
2. `npx tsx tests/phase8/chesta_method2.run.ts` (All 21 unit tests must pass)
3. `npm test` or `npx tsx tests/run_all_tests.ts` (All 20 deterministic suites + 240 conformance vectors must pass)
```

---

## 📦 Zip Archive Information

Zip file ကို အောက်ပါနေရာ (၂) ခုလုံးတွင် ဖန်တီးသိမ်းဆည်းပေးထားပါသည်-
1. **Workspace Root:** `f:\dssme-event-calculation-engine\dssme_chesta_method2_3files.zip`
2. **Artifacts Directory:** `C:\Users\SiThuKoKo\.gemini\antigravity\brain\adec6b2c-9942-476a-8708-18347d90ce26\dssme_chesta_method2_3files.zip`

### Zip File အတွင်း ပါဝင်သော ဖိုင်များ
```text
src/engine/strength/chestaBala.ts       (9,619 bytes)
src/engine/chartblocks/shadbala.ts     (31,866 bytes)
tests/phase8/chesta_method2.run.ts      (6,244 bytes)
```
> [!TIP]
> Google Studio terminal တွင် zip file ကို တိုက်ရိုက် extract လုပ်လိုပါက:
> `unzip -o dssme_chesta_method2_3files.zip` ကို အသုံးပြုနိုင်ပါသည်။
