# DSSME Phase 3 — BUILD Checkpoint 1 (Level 1, partial)

**Scope delivered:** BlockResult contract + HOUSES, HOUSE_POSITIONS, RETROGRADE.
**Not delivered (blocked by an open Decision Gate):** IDENTITY (gate S-08).
**Base commit (GitHub `main` HEAD at inspection):** `5b79ecef114672753947ae1f842344f11c5cc08e`
**Package manager / lockfile of record:** npm 10.8.2 / `package-lock.json` (`bun.lock` was removed upstream in `3d76d10`).
**Installed:** `@swisseph/browser` 1.4.0 (`@swisseph/core` 1.4.0), `astronomy-engine` 2.1.19, `typescript` 7.0.2, Node v22.22.2.

Governing design: `PHASE_3_ARCHITECTURE_DESIGN.md` §5 (BlockResult), §8 (dependency graph), §21 (P3-0/P3-1). The design file is **not present at `main` HEAD** (see "Known discrepancies").

## Baseline before any change (verified at HEAD)
`tsc --noEmit` exit 0 · 11/11 existing suites pass · `vite build` succeeds.

## After this checkpoint
| Check | Result |
|---|---|
| `tsc --noEmit` | exit 0 |
| `npm run lint:phase3` (strict + `noUncheckedIndexedAccess`, gated on Phase 3 paths only) | 0 diagnostics in Phase 3 files; 25 informational strict diagnostics inside imported FROZEN files (not modified) |
| `npm test` | **17/17** suites pass (11 existing + 6 new) |
| `vite build` | succeeds (same pre-existing Swiss-module warning as baseline) |
| Mutation sanity | 3 deliberate breakages (ignore house mismatch; accept retrograde Sun; error no longer fails block) each failed the tests; sources restored byte-identical |
| Frozen files | `git diff HEAD` on `src/types`, `src/engine/{astronomy,canonical,panchanga}`, `src/utils`, `src/components`, `App.tsx`, `main.tsx`, `server.ts`, `tsconfig.json`, `vite.config.ts`, `package-lock.json`, and all existing test files: **empty** |

## Files
**Created:** `src/engine/blocks/{blockTypes,blockResult,houses,housePositions,retrograde,index}.ts`; `tests/blocks/{blockContract,housesBlock,housePositionsBlock,retrogradeBlock,pyjhoraSourceAlignment,level1Integration}.test.ts`; `tests/blocks/fixtures/handChart.ts`; `tests/blocks/strictCheck.sh`; `tsconfig.phase3.json`; this report.
**Modified (additive only):** `tests/run_all_tests.ts` (6 imports, 6 registrations, banner "PHASES 1 & 2" → "PHASES 1-3"); `package.json` (one script `lint:phase3`).

## Contract as implemented
`BlockResult<T> = { blockId, status: OK | DEFAULTED | FAILED_CLOSED, value: T | null, instantJdUt, provenance, issues }`.
Status is decided in one function (`finalizeBlock`): any `error` issue ⇒ `FAILED_CLOSED` and `value = null`; else spec-default flag ⇒ `DEFAULTED`; else `OK`. `instantJdUt` is always `chart.time.julianDayUt`. No wall-clock or duration field exists. A chart without valid provenance is a precondition failure (`PROVENANCE_ERROR`, same family as frozen `canonicalChart.ts`), never defaulted. A degraded chart (`fallback` / `mixed`) is accepted by state blocks and its three-valued provenance is copied verbatim.

## DSSME ↔ PyJHora mapping (source-level; PyJHora NOT executed)
Pinned reference `naturalstupid/PyJHora @ 48e57d29b47a3143519910a24866758116467485` (40 chars).

| DSSME | PyJHora source read | Result |
|---|---|---|
| `SIGN_LORDS` (HOUSES lord) | `const.py:527` `_house_owners_list = [2,5,3,1,0,3,5,2,4,6,6,4]`, ids `const.py:126-146` (Sun 0 … Saturn 6, Rahu 7, Ketu 8) | MATCH, all 12 signs (asserted in `pyjhoraSourceAlignment.test.ts`) |
| Planet output order | same id constants | MATCH (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu) |
| RETROGRADE rule | `drik.py:339` `planets_in_retrograde`: Sun/Moon excluded; Ketu uses Rahu's speed; retrograde iff `longi[3] < 0`; docstring: Mean nodes always retrograde | MATCH for the Swiss-speed function. A second, position-based function in `jhora.horoscope.chart.charts` exists and was **not inspected** (UNKNOWN) |
| House type (Angular/Succedent/Cadent) | not mapped | DSSME spec Rule 6 + frozen `getHouseType`; no PyJHora source consulted for this classification |

**Status: PyJHora source-level alignment verified; numerical parity not yet executed.**

## Decision Gates
Closed by this checkpoint: **none** (the repository records no gate decisions). None of the built blocks needed one.
Still open: all 20 in design §16. Needed next: **S-08** (IDENTITY), **S-01** (DIGNITY), **S-02** (COMBUST), **T-09** (panchanga state flags), plus **T-01** / **T-10** before any degree-level golden.

## Known discrepancies (do not silently reconcile)
1. **Design document is absent at `main` HEAD.** `docs/PHASE_3_ARCHITECTURE_DESIGN.md` was added in `d344312` (728 lines) and deleted in `5b79ece` ("sanitize nomenclature"). A different 987-line version exists outside the repository. They share §1–§8 (incl. the BlockResult contract this checkpoint implements) and diverge from §9 (different gate sets: repo draft T-01…T-10 + S-01…S-10; the other T-01…T-10 + A-01, A-02 + S-01…S-08). **Which governs must be stated before Checkpoint 2.**
2. Design C-04 and C-07 are stale at HEAD: `bun.lock` removed and `packageManager` is npm; personal nomenclature removed from fixtures/App.
3. Design findings still true at HEAD: C-03 (`panchangaProviders.ts` imports both ephemeris packages), C-06 (`/api/panchanga` filters on a non-existent `severity`), C-14, C-15 (no `strict`), C-05 (runner collects all failures).
4. Strict-mode diagnostics exist inside frozen files `astronomy/ascendant.ts`, `astronomy/houses.ts`, `astronomy/planetaryPositions.ts` (array indexing under `noUncheckedIndexedAccess`); reported, not changed.
5. Chofu reference JSON degree discrepancy (design C-09) is unchanged and unresolved; it was **not** used as a numeric golden. Integration assertions are sign-level only.

## Remaining risks
Hand-built fixture is synthetic (valid under the frozen validators, asserted in tests) and is not an ephemeris golden. `lint:phase3` needs `bash`. Swiss-version-dependent numerics are not yet used by any Phase 3 assertion.

## Exact next action
Name the governing design document and close S-08, S-01, S-02 (and T-09 for the panchanga flags). Then Checkpoint 2: inspect PyJHora source for dignity/combustion (`const.py` friendship tables, combustion lists and how they are indexed) before writing DIGNITY, COMBUST, NAVAMSHA and the PANCHANGA mapping.
