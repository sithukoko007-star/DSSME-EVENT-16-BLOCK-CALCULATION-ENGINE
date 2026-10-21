# DSSME Phase 8.5 — Chesta Bala Full Rewrite (3 Files) — Google Studio Install Prompt

---

## 📦 ZIP Contents

| File in ZIP | Install Path in Repo |
|---|---|
| `src/engine/strength/chestaBala.ts` | `src/engine/strength/chestaBala.ts` (**REPLACE existing**) |
| `tests/phase8/chesta.run.ts` | `tests/phase8/chesta.run.ts` (**REPLACE existing**) |
| `tests/phase8/gen_chesta_gt.ts` | `tests/phase8/gen_chesta_gt.ts` (**NEW file**) |

---

## 🤖 Google Studio Prompt (copy & paste as-is)

---

```
You are an expert TypeScript engineer working on the DSSME Event Calculation Engine
(repository: f:\dssme-event-calculation-engine).

I am providing a ZIP file containing 3 updated files from Phase 8.5 of the Shadbala
verification project. Please install them exactly as described below.

═══════════════════════════════════════════════════════════════
PHASE 8.5 — CHESTA BALA FULL REWRITE SUMMARY
═══════════════════════════════════════════════════════════════

What changed:
  The previous chestaBala.ts returned 0 for Sun and Moon.
  Phase 8.5 adds correct classical formulas for all 7 planets:

  • Sun  → Ayana / declination model (same as Ayana Bala in kaalaBala.ts)
            tropical = (sidereal + ayanamsa) % 360
            decl     = Lagrange interpolation from 7-point Surya-Siddhanta table
            val      = round((24 + decl) * 1.25, 2) * 2

  • Moon → Paksha / elongation model
            elongation = |moon_lon - sun_lon|  (no circular wrap)
            val        = round(elongation / 3, 2)

  • Mars, Mercury, Jupiter, Venus, Saturn → Epoch-table method (unchanged)

New exported functions in chestaBala.ts:
  - calculateSunChestaBala(sunSiderealLon, ayanamsaDegrees): number
  - calculateMoonChestaBala(moonSiderealLon, sunSiderealLon): number

Updated ChestaContext interface (BREAKING — callers must now pass ayanamsaDegrees):
  interface ChestaContext {
    localJulianDay:   number;   // existing
    placeLongitude:   number;   // existing
    ayanamsaDegrees?: number;   // NEW — required for Sun Chesta Bala
  }

═══════════════════════════════════════════════════════════════
INSTALL INSTRUCTIONS
═══════════════════════════════════════════════════════════════

Step 1 — Replace existing file:
  Extract src/engine/strength/chestaBala.ts from the ZIP and overwrite
  f:\dssme-event-calculation-engine\src\engine\strength\chestaBala.ts

Step 2 — Replace test file:
  Extract tests/phase8/chesta.run.ts from the ZIP and overwrite
  f:\dssme-event-calculation-engine\tests\phase8\chesta.run.ts

Step 3 — Add new generator:
  Extract tests/phase8/gen_chesta_gt.ts from the ZIP and place at
  f:\dssme-event-calculation-engine\tests\phase8\gen_chesta_gt.ts
  (this is a NEW file — does not replace anything)

Step 4 — Regenerate the ground-truth JSON:
  cd f:\dssme-event-calculation-engine
  npx tsx tests/phase8/gen_chesta_gt.ts
  ✅ Expected output: "chesta_gt.json updated ✅"
  This updates tests/phase8/data/chesta_gt.json with correct Sun/Moon values.

Step 5 — Run verification:
  npx tsx tests/phase8/chesta.run.ts
  ✅ Expected output (all lines):
    constants: epoch tables deep-equal to Python source          1/1
    constants: mean pos / speed / corrections / epoch            1/1
    gregorianYearFromJd vs swe.revjul (3000 random + boundaries) 3210/3210
    days-from-epoch                                              5/5
    Sun mean longitude                                           5/5
    epoch-table mean longitudes (5 planets x 5 fixtures)         25/25
    final: GEOMETRIC (+TRUEPOS) longitudes   within 0.05: 35/35 | bit-exact: 34/35 | max diff 0.02
    final: APPARENT longitudes (as ephemeris.ts) within 0.05: 35/35 | bit-exact: 33/35 | max diff 0.01
    Sun Chesta Bala (ayana model) matches GT                     5/5
    Moon Chesta Bala (paksha model) matches GT                   5/5
    guard ok  : no ctx
    guard ok  : NaN ctx

Step 6 — Random stress test:
  npx tsx tests/phase8/chesta.random.ts
  ✅ Expected: random dates: days 600/600 | ... | max circular diff ~1.5e-11 deg

Step 7 — Full regression:
  npm test
  ✅ Expected: ALL DSSME DETERMINISTIC TESTS PASSED SUCCESSFULLY (20/20)
              Conformance: 240/240

Step 8 — TypeScript compile check:
  npx tsc --noEmit
  ✅ Expected: 0 errors

═══════════════════════════════════════════════════════════════
CALLER UPDATE REQUIRED (if shadbala.ts passes ChestaContext)
═══════════════════════════════════════════════════════════════

Any call site that constructs a ChestaContext must now pass ayanamsaDegrees:

  BEFORE:
    calculateChestaBalaAll(planets, { localJulianDay: jd, placeLongitude: lon })

  AFTER:
    calculateChestaBalaAll(planets, {
      localJulianDay:  jd,
      placeLongitude:  lon,
      ayanamsaDegrees: chart.ayanamsa,   // e.g. 23.15 for Lahiri 2026
    })

  If ayanamsaDegrees is omitted, Sun Chesta Bala returns 0 with a console.warn.
  This is a soft warning, not a hard error, to preserve backward compatibility.

═══════════════════════════════════════════════════════════════
VERIFICATION PASS CRITERIA (Phase 8.5 exit gate)
═══════════════════════════════════════════════════════════════
  ✅ Sun  Chesta Bala: 5/5 fixtures correct (ayana model)
  ✅ Moon Chesta Bala: 5/5 fixtures correct (paksha model)
  ✅ Outer planets:    35/35 within 0.05 virupa tolerance
  ✅ Regression:       240/240 conformance vectors pass
  ✅ TypeScript:       0 compile errors
```

---

## 📂 ZIP File Locations

| Location | Path |
|---|---|
| **Primary** | `f:\dssme-event-calculation-engine\dssme_phase85_chesta_3files.zip` |
| **Backup** | `E:\_!Pc\Download2022_7\DSSME_Clude\AiSithu_20_Oct\dssme_phase85_chesta_3files.zip` |

---

## ✅ Pre-verified Results (run on 2026-10-20)

| Test | Result |
|---|---|
| `chesta.run.ts` GEOMETRIC bit-exact | 34/35 (1 case ±0.02 rounding) |
| `chesta.run.ts` APPARENT within 0.05 | 35/35 ✅ |
| `chesta.random.ts` 3000 samples | 3000/3000 ✅ |
| Sun Chesta Bala unit test | 5/5 ✅ |
| Moon Chesta Bala unit test | 5/5 ✅ |
| `npm test` full regression | 240/240 ✅ |
| `npx tsc --noEmit` | 0 errors ✅ |
