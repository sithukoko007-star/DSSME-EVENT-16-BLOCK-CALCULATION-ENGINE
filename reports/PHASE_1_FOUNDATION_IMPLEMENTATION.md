# DSSME Native 16-Block Calculation Engine — Phase 1 Implementation Report

## Executive Summary

Phase 1 establishes the deterministic, high-precision astronomical and geometric calculation foundation for the DSSME Native 16-Block Calculation Engine. The calculation pipeline replaces the retired legacy workflow (PDF → OCR → LLM interpretation → JSON) with a native, pure, serverless/Vercel-compatible calculation engine built directly on the Swiss Ephemeris WebAssembly core, adhering strictly to the canonical type contracts in `dssme-canonical-types.ts`.

---

## 1. Files Created, Modified, and Reused

### Files Created
* `src/types/dssme-canonical-types.ts` — Canonical type contract imported without schema alteration, preserving all types, unions, casing, and structures.
* `src/engine/astronomy/timezone.ts` — Timezone validation, local ISO formatting, and UTC resolution engine.
* `src/engine/astronomy/julianDay.ts` — High-precision astronomical Julian Day UT calculation engine.
* `src/engine/astronomy/ephemeris.ts` — Swiss Ephemeris WebAssembly integration with dual-runtime loader (Node.js buffer & browser WASM fetch) and astronomical fallback.
* `src/engine/astronomy/ayanamsa.ts` — Lahiri Ayanamsa calculation and DMS degree formatting.
* `src/engine/astronomy/planetaryPositions.ts` — 9-body sidereal positions engine (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu).
* `src/engine/astronomy/ascendant.ts` — Ascendant (Lagna) calculation, Nakshatra & Pada determination, LagnaType categorization.
* `src/engine/astronomy/houses.ts` — 12 Whole-Sign Canonical Bhavas builder with sign lords, cusps, and occupant assignments.
* `src/engine/canonical/canonicalValidation.ts` — Strict schema and parameter validation with canonical error codes.
* `src/engine/canonical/canonicalChart.ts` — Authoritative builder of `CanonicalChart`, the Single Source of Truth for all downstream modules.
* `server.ts` — Full-stack Express server mounting `/api/canonical-chart`, `/api/health`, and Vite dev middlewares.
* `tests/astronomy/timezone.test.ts` — Deterministic test suite for timezone & UTC resolution.
* `tests/astronomy/julianDay.test.ts` — Deterministic test suite for Julian Day calculations against standard epochs (J2000.0, Unix epoch).
* `tests/astronomy/ayanamsa.test.ts` — Deterministic test suite for Lahiri Ayanamsa values and DMS formatting.
* `tests/astronomy/planetaryPositions.test.ts` — Deterministic test suite for planetary positions, speeds, and retrograde states.
* `tests/astronomy/ascendant.test.ts` — Deterministic test suite for Lagna, Nakshatras, and House assignments.
* `tests/canonical/canonicalChart.test.ts` — Determinism and repeat-run verification test suite.
* `tests/differential/pyjhoraDifferential.test.ts` — Differential tests against independent PyJHora / Jagannatha Hora reference fixtures.
* `tests/run_all_tests.ts` — Master test runner executing all 7 suites.
* `public/swisseph.wasm` — Swiss Ephemeris 2.10.03 WebAssembly binary asset.

### Files Modified
* `package.json` — Added scripts (`dev`, `build`, `start`, `test`, `lint`) and registered dependencies.
* `metadata.json` — Populated app name and description per first turn guidelines.
* `index.html` — Updated title and meta tags in sync with `metadata.json`.
* `src/App.tsx` — Built minimal, professional Phase 1 verification interface.

---

## 2. Architecture & Calculation Flow

```
User Calculation Input (DssmeCalculationInput)
       │
       ▼
Input Validation (canonicalValidation.ts)
       │
       ▼
Timezone & UTC Resolution (timezone.ts)
       │
       ▼
Julian Day UT Calculation (julianDay.ts)
       │
       ▼
Swiss Ephemeris WASM Core (ephemeris.ts)
       │
       ├─► Lahiri Ayanamsa (ayanamsa.ts)
       │
       ├─► Ascendant / Lagna (ascendant.ts)
       │
       ├─► Planetary Sidereal Positions (planetaryPositions.ts)
       │     (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu)
       │
       └─► 12 Whole-Sign Canonical Bhavas (houses.ts)
       │
       ▼
Canonical Schema Validation (canonicalValidation.ts)
       │
       ▼
CanonicalChart (Single Source of Truth)
       │
       ├─► Express API Response (/api/canonical-chart)
       └─► DSSME UI Verification Surface
```

Downstream calculation modules (Panchanga, Dasha, Shadbala, Bhava Bala, Ashtakavarga, Aspects, Navamsha, Yogas) will consume `CanonicalChart` directly without re-deriving planetary longitudes.

---

## 3. Ephemeris & Astronomy Engine Details

### Swiss Ephemeris WebAssembly Integration
* Engine: Swiss Ephemeris v2.10.03 compiled to WebAssembly (`@swisseph/browser`).
* Asset: `public/swisseph.wasm` (411 KB, zero external runtime binaries, zero Python or C compiler requirement).
* Runtime Compatibility: Operates identically in Node.js server environments and browser clients.
* Fallback: Pure TypeScript VSOP87 / IAU astronomical calculation engine for edge environments.

### Timezone & UTC Resolution
* Accepts civil date (`YYYY-MM-DD`), civil time (`HH:MM:SS`), and timezone offset in decimal hours (`timezoneOffset`).
* Computes local civil ISO 8601 string with explicit offset.
* Derives UTC epoch milliseconds and standard UTC ISO 8601 string.
* Resolves fractional decimal UT hours within the UTC day.

### Julian Day UT Calculation
* Algorithm: Astronomical Gregorian reform formula (Meeus / IAU).
* Precision: Sub-millisecond astronomical accuracy.
* Verified against standard epochs:
  * J2000.0 (2000-01-01 12:00:00 UT) = `2451545.0`
  * Unix Epoch (1970-01-01 00:00:00 UT) = `2440587.5`
  * Chofu Benchmark (2026-09-16 05:30:00 UT) = `2461299.7291666665`

### Lahiri Ayanamsa Implementation
* Mode: `swe.setSiderealMode(SiderealMode.Lahiri)` (Chitra Paksha standard).
* Fiducial point: Star Spica (α Virginis) set to exactly 180° sidereal longitude.
* Epoch value: J2000.0 = `23.857092°` (23° 51' 25.532").
* Chofu Benchmark value (2026-09-16): `24.230181°` (24° 13' 49").

### Planetary Positions & Retrograde Status
* Planetary Order: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn (Classical 7) followed by Rahu and Ketu.
* Coordinates: Tropical Longitude, Sidereal Longitude (Lahiri), Ecliptic Latitude, Longitude Speed (deg/day).
* Retrograde Detection: Derived from `speedLongitude < 0`. Saturn, Rahu, and Ketu correctly flagged as RETROGRADE for the Chofu test chart.
* Lunar Nodes:
  * Rahu: Mean Ascending Lunar Node (SE_MEAN_NODE = 10), motion is continuously retrograde.
  * Ketu: Computed as `(Rahu.siderealLongitude + 180.0) % 360.0`, speed matches Rahu, motion is retrograde.

### Ascendant (Lagna) & House System
* Ascendant calculated via Swiss Ephemeris topocentric horizon intersection.
* Lagna sign, degree within sign (0-30°), Nakshatra (1-27), Pada (1-4), and LagnaType (Movable, Fixed, Dual) computed deterministically.
* House System: Vedic Whole-Sign Bhavas (Bhaava Madhya method 5 in PyJHora):
  * House 1 sign is Lagna sign.
  * Houses 2 through 12 follow zodiacal sequence.
  * House types: Angular (1, 4, 7, 10), Succedent (2, 5, 8, 11), Cadent (3, 6, 9, 12).
  * Planetary bodies assigned to houses strictly from their sidereal sign relative to Lagna sign.

---

## 4. PyJHora Reference Inspection & Source Traceability

Inspected repository: `https://github.com/naturalstupid/PyJHora` at pinned commit `48e57d29b47a3143519910a24866758116467485`.

Inspected source files:
1. `src/jhora/const.py`:
   * Verified `SUN_ID = 0` through `SATURN_ID = 6` order (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn).
   * Verified `_house_owners_list = [2, 5, 3, 1, 0, 3, 5, 2, 4, 6, 6, 4]`.
   * Verified `movable_signs = [0, 3, 6, 9]`, `fixed_signs = [1, 4, 7, 10]`, `dual_signs = [2, 5, 8, 11]`.
   * Verified `combustion_range_of_planets_from_sun = [12, 17, 14, 10, 11, 15]`.
   * Verified `shad_bala_factors` Sun minimum requirement discrepancy: 300 virupas in PyJHora vs 390 virupas in canonical contract.
2. `src/jhora/panchanga/drik.py`:
   * Verified `ascendant(jd, place)` calculation and `swe.houses_ex` call.
   * Verified `nakshatra_pada(longitude)` division (`one_star = 360/27`, `one_pada = 360/108`).
   * Verified `_bhaava_madhya_new` house assignment logic.
3. `src/jhora/horoscope/chart/strength.py`:
   * Verified `_cheshta_bala_new(..., use_epoch_table=True)` requirement.
   * Verified Kaala Bala call graph: `_abdadhipathi()`, `_masadhipathi()`, `_vaaradhipathi()`.

---

## 5. Verification & Test Execution Results

All 7 test suites executed and passed deterministically:

```
============================================================
DSSME NATIVE ENGINE PHASE 1 — FOUNDATION TEST SUITE
============================================================

Running Timezone & UTC Resolution Tests...
✓ Timezone & UTC Resolution Tests Passed!
Running Julian Day UT Tests...
✓ Julian Day UT Tests Passed!
Running Lahiri Ayanamsa Tests...
Swiss Ephemeris WASM initialized: 2.10.03
✓ Lahiri Ayanamsa Tests Passed!
Running Planetary Positions Tests...
✓ Planetary Positions Tests Passed!
Running Ascendant & Houses Tests...
✓ Ascendant & Houses Tests Passed!
Running CanonicalChart Builder & Determinism Tests...
✓ CanonicalChart Builder & Determinism Tests Passed!
Running PyJHora Differential Tests...
✓ PyJHora Differential Tests Passed!

============================================================
ALL PHASE 1 DETERMINISTIC TESTS PASSED SUCCESSFULLY (7/7)
============================================================
```

### Compiler, Linter, and Build Status
* `tsc --noEmit` (Linter): PASSED (0 errors).
* `compile_applet`: PASSED.
* `npm run build`: PASSED (Vite client build produced in 646ms).

---

## 6. Known Limitations & Open Architecture Decisions

1. **Pending Open Decision — Sun Minimum Required Virupas in Shadbala**:
   * DSSME Canonical Type Contract specifies Sun = 390 virupas (6.5 rupas).
   * PyJHora `const.py:1379` specifies Sun = 300 virupas (5.0 rupas).
   * Status: Per instructions (§21), this discrepancy is preserved as an explicit pending architectural decision and not unilaterally overwritten.

2. **Phase Boundary Enforcement**:
   * Blocks 02 through 16 (Panchanga, Dasha, Shadbala, Bhava Bala, Ashtakavarga, Aspects, Navamsha, Yogas) are decoupled and ready for sequential Phase 2+ implementation without modifying `CanonicalChart`.

---

## Final Status

**PHASE_1_FOUNDATION_READY**
