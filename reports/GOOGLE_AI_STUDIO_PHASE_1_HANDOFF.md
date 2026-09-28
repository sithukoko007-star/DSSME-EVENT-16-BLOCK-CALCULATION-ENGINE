# Google AI Studio — Phase 1 Handoff

| | |
|---|---|
| **Repository** | https://github.com/sithukoko007-star/DSSME-EVENT-16-BLOCK-CALCULATION-ENGINE |
| **Branch** | `main` |
| **Phase 1 status** | `PHASE_1_CONDITIONAL_FOR_GOOGLE_AI_STUDIO` |
| **Next phase** | `PHASE_2_PANCHANGA` — **not started** |
| **Date** | 2026-09-28 |
| **Read with** | `reports/PHASE_1_CONDITIONAL_DECISIONS.md` · `reports/PHASE_1_AUDIT_AND_CORRECTION_GATE.md` (+ `.json`) · `reports/PHASE_1_FOUNDATION_IMPLEMENTATION.md` |

Phase 1 — the astronomical foundation — is **verified and frozen**. Phase 2 calculation-block development may proceed under the boundaries in §12. **This handoff does not implement Panchanga, and the session receiving it should not treat Panchanga as started.**

---

## 0. Before writing any code: confirm `main` is the verified state

The gate's fixes were delivered as patches (`phase1-fixes.patch`, `phase1-dependency-cleanup.patch`). `main` must contain them. The gate inspected `main` @ `168b12b` with both patches applied. Verify with the repository's package manager (`bun`, per `bun.lock`):

```bash
bun install        # must succeed with no flags and no peer-dependency errors
bun run lint       # = tsc --noEmit; must exit 0
bun run test       # must end: ALL PHASE 1 DETERMINISTIC TESTS PASSED SUCCESSFULLY (7/7)
bun run build      # vite build; must exit 0
bun audit          # expected: no vulnerabilities

git grep -c "logEphemerisFallback" src/engine/astronomy/ephemeris.ts      # expect 4 (1 definition + 3 call sites)
git grep -n  "is not a valid calendar date" src/engine/astronomy/timezone.ts   # expect 1 match
git grep -nE "swisseph-v2|@fusionstrings|\"esbuild\"" package.json           # expect no output
```

**If any check fails, `main` is not the verified Phase 1 state. Stop and report; do not begin Phase 2.**

---

## 1. Verified Phase 1 architecture

```
DssmeCalculationInput                                   src/types/dssme-canonical-types.ts
   │  validateCalculationInput()                        src/engine/canonical/canonicalValidation.ts
   ▼
Validated input
   │  resolveDateTimeToUtc()                            src/engine/astronomy/timezone.ts
   ▼
Validated UTC time  (calendar validity enforced; UTC offset supplied by the caller)
   │  dateToJulianDayUt()                               src/engine/astronomy/julianDay.ts
   ▼
Julian Day UT
   │  getLahiriAyanamsa()                               src/engine/astronomy/ayanamsa.ts
   │  calculateCanonicalLagna()                         src/engine/astronomy/ascendant.ts
   │  calculateAllCanonicalBodies()                     src/engine/astronomy/planetaryPositions.ts
   │  buildCanonicalHouses()                            src/engine/astronomy/houses.ts
   │    all backed by Swiss Ephemeris WASM (Moshier), Lahiri   src/engine/astronomy/ephemeris.ts
   ▼
CanonicalChart          generateCanonicalChart()        src/engine/canonical/canonicalChart.ts
   │  validateCanonicalChart()  (called inside generateCanonicalChart)
   ▼
HTTP: POST /api/canonical-chart · GET /api/health       server.ts
```

**`generateCanonicalChart(rawInput)` is the single entry point Phase 2 consumes.**

| File | Responsibility | Key exports |
|---|---|---|
| `src/types/dssme-canonical-types.ts` | Canonical type contract — the only type authority | `DssmeCalculationInput`, `CanonicalChart`, `Dssme16BlockResult`, all block interfaces |
| `src/engine/astronomy/timezone.ts` | Local civil date/time + numeric UTC offset → UTC; calendar validity | `resolveDateTimeToUtc` |
| `src/engine/astronomy/julianDay.ts` | Julian Day UT (Meeus algorithm) | `calculateJulianDayUt`, `dateToJulianDayUt`, `julianDayUtToDate` |
| `src/engine/astronomy/ephemeris.ts` | **The only module that talks to ephemeris packages.** Primary engine, fallback, fallback logging | `getSwissEphemeris`, `calculateLahiriAyanamsa`, `calculateBodyPosition`, `calculateAscendant`, `normalize360` |
| `src/engine/astronomy/ayanamsa.ts` | Lahiri wrapper, DMS formatting | `getLahiriAyanamsa`, `formatDms` |
| `src/engine/astronomy/planetaryPositions.ts` | Nine bodies → canonical entries | `calculateAllCanonicalBodies`, `calculateCanonicalBody`, `NINE_BODIES_ORDER`, `SIGN_LORDS` |
| `src/engine/astronomy/ascendant.ts` | Lagna, nakshatra/pada, lagna type | `calculateCanonicalLagna`, `getNakshatraInfo`, `getLagnaType`, `NAKSHATRA_NAMES` |
| `src/engine/astronomy/houses.ts` | Whole-sign houses | `buildCanonicalHouses`, `getHouseType` |
| `src/engine/canonical/canonicalChart.ts` | Assembles `CanonicalChart` | `generateCanonicalChart` |
| `src/engine/canonical/canonicalValidation.ts` | Input and chart validation | `validateCalculationInput`, `validateCanonicalChart` |
| `server.ts` | Express API plus static/dev serving | `/api/canonical-chart`, `/api/health` |

All of the above is **FROZEN**: timezone handling, Julian Day, Swiss Ephemeris integration, Lahiri, planetary positions, ascendant, whole-sign houses, `CanonicalChart`, the existing deterministic tests, the existing PyJHora differential architecture, and the dependency cleanup. **Do not refactor these merely for style.** A genuine defect in a frozen component is a separate, explicitly scoped change: record it with a failing test or fixture and get approval — don't fold it into block work.

---

## 2. Canonical type contract

**`src/types/dssme-canonical-types.ts` is the only type system.** Its header reconciles four sources:

- `DSSME_Extraction_Prompt_JSON_v1_4.md` §11 — the original v1.4 output schema
- `DSSME_CHART_2026-09-16_Chofu.json` — a real chart under that schema
- "DSSME NATIVE 16-BLOCK CALCULATION ENGINE" — the architecture spec
- `naturalstupid/PyJHora` @ the pinned commit (§7)

> **None of the first three documents is tracked in this repository.** Block semantics — including how every `PanchangaBlock` field is defined and formatted — live in them, not in the type file. **Supply them to the Phase 2 session before Panchanga work starts.**

**Two different things — don't conflate them:**

- **`CanonicalChart`** — Phase 1's output: the astronomical substrate. It is the *input* to every block; it is not itself one of the blocks.
- **`Dssme16BlockResult`** — the eventual full output: 21 named top-level block keys plus `_meta`. The name says "16" because the v1.4 spec has 16 blocks, and its Block 13 carries six composite attributes emitted as six separate keys (15 + 6 = 21). Do not renumber or regroup blocks.

Output keys are `UPPER_SNAKE_CASE` per v1.4. Do not "normalize" to camelCase.

**`DssmeCalculationInput`** (fields as in the type file):

| Field | Type | Notes |
|---|---|---|
| `date`, `time` | `"YYYY-MM-DD"`, `"HH:MM:SS"` | Local civil date/time |
| `latitude`, `longitude` | number | Decimal degrees; +N/−S, +E/−W |
| `timezone` | string | IANA name "where available"; used for display only |
| `timezoneOffset` | number | "UTC offset in hours at this date/time" — **supplied by the caller** |
| `ayanamsa` | `"Lahiri"` | The only value |
| `chartMode?`, `bodyMode?`, `objective?`, `risk?`, `geometry?` | string | Session parameters, passed through, never calculated |

**`CanonicalChart`** (exact shape):

| Field | Contents |
|---|---|
| `input` | The validated `DssmeCalculationInput` |
| `time` | `{ localIso, utcIso, julianDayUt, timezoneOffsetHours }` |
| `location` | `{ latitude, longitude, city?, country? }` |
| `ayanamsa` | `{ name: "Lahiri", value }` |
| `lagna` | `CanonicalBodyPosition` |
| `planets` | `Record<NineBody, CanonicalBodyPosition>` |
| `houses` | `Record<HouseKey, CanonicalHouse>` |

`CanonicalBodyPosition` = `{ body, siderealLongitude, tropicalLongitude, eclipticLatitude?, speedLongitude, isRetrograde, sign, signDegree, nakshatra, nakshatraPada, house }`.
`CanonicalHouse` = `{ houseNumber, sign, lord, cuspLongitude?, occupants, type }`.

**Open questions recorded in the type file header remain open** (output casing/shape; `ASPECTS_BHAVAS` shape; Rahu/Ketu `sb_ratio`/`sb_rank` placeholders; the absent Shadbala `_pct` siblings; the Sun Shadbala minimum of 390 vs. PyJHora's 300 virupas; `SIGN_CLUSTERS` granularity). Do not resolve them silently — raise them when the affected block is reached.

---

## 3. Verified astronomy engine

Verified by the gate: timezone/UTC resolution, Julian Day UT, Swiss Ephemeris WASM integration, Lahiri ayanamsa, nine-body sidereal positions, ascendant, whole-sign houses, `CanonicalChart` assembly and validation.

Conventions in force (do not change silently):

- **Ayanamsa:** Lahiri (`SiderealMode.Lahiri`). No other value is accepted.
- **Nodes:** Rahu = mean lunar node (`LunarPoint.MeanNode`); Ketu = Rahu + 180°.
- **Signs / houses:** sign = `floor(siderealLongitude / 30)`; **whole-sign houses**, `house = ((planetSign − lagnaSign + 12) % 12) + 1`; each house's cusp carries the Lagna's degree-within-sign.
- **Nakshatra / pada:** 27 nakshatras of 13°20′, four padas of 3°20′ each.
- **Retrograde:** negative longitude speed (Rahu/Ketu are retrograde in the mean-node model).
- **Julian Day:** Meeus algorithm.
- **Time:** the validated local civil time and the caller-supplied UTC offset produce UTC; calendar-invalid dates (e.g. `2024-02-30`) are rejected with `INVALID_INPUT`; real leap days are accepted.

---

## 4. Verified tests

`tests/run_all_tests.ts` registers seven suites explicitly and runs them sequentially, fail-fast (first failure → exit code 1):

| # | Suite | File |
|---|---|---|
| 1 | Timezone & UTC Resolution | `tests/astronomy/timezone.test.ts` |
| 2 | Julian Day UT | `tests/astronomy/julianDay.test.ts` |
| 3 | Lahiri Ayanamsa | `tests/astronomy/ayanamsa.test.ts` |
| 4 | Planetary Positions | `tests/astronomy/planetaryPositions.test.ts` |
| 5 | Ascendant & Houses | `tests/astronomy/ascendant.test.ts` |
| 6 | CanonicalChart Builder & Determinism | `tests/canonical/canonicalChart.test.ts` |
| 7 | PyJHora Differential | `tests/differential/pyjhoraDifferential.test.ts` |

Result: **7/7 pass on both npm and bun**, `tsc --noEmit` clean, `vite build` succeeds. The gate added regression cases to suite 1: `2024-02-30`, `2023-04-31` and `2023-02-29` are rejected; `2024-02-29` is accepted.

Rules for Phase 2:

- **Do not remove, weaken, or reorder the existing suites.**
- Add new suites **additively** in `tests/run_all_tests.ts`. Note the runner prints a hard-coded `(7/7)` and a "PHASE 1" banner — update them deliberately when suites are added; do not leave them stale.
- Keep tests deterministic (same input → same output; no clock, randomness, or network).
- The PyJHora differential suite compares against **hard-coded fixtures** (a PVR Narasimha Rao chart and the Chofu 2026-09-16 chart) with source comments. **PyJHora is not executed during tests.**

---

## 5. Dependency cleanup

Removed (each with **zero** import references anywhere in the repository, verified with a quote-agnostic repo-wide grep):

| Removed | Why |
|---|---|
| `swisseph-v2` | Native `node-gyp` binding; duplicated `@swisseph/browser`; broke clean installs |
| `@fusionstrings/swiss-eph` | Alternate Swiss Ephemeris binding; duplicated `@swisseph/browser` |
| `esbuild` (dev) | Unused directly; its `^0.25.0` pin conflicted with Vite 8's optional peer range and blocked `npm install` |

Result: plain `npm install` and `bun install` succeed with no flags; vulnerabilities went from 5 (4 high, 1 critical) to **0** (npm install summary; `bun audit`: 262 packages) — as a side effect of removing the native build toolchain, not from `audit fix`. `bun.lock` was regenerated.

Rules for Phase 2:

- **Do not add a second ephemeris or astronomy package.**
- Do not add native (`node-gyp`) dependencies.
- After any dependency change, re-run the §0 verification (clean install → lint → test → build → audit).

Declared but currently unused, deliberately **not** removed: `@google/genai` (the AI Studio `metadata.json` declares a server-side Gemini capability), `dotenv`, `motion`, `autoprefixer` (dev).

---

## 6. Current ephemeris architecture

- **Primary:** `@swisseph/browser` (Swiss Ephemeris WASM, 2.10.03 as reported at initialization), Moshier ephemeris flag, sidereal mode Lahiri.
- **Node loading:** looks for `public/swisseph.wasm`, then `node_modules/@swisseph/browser/dist/swisseph.wasm`, and patches `globalThis.fetch` process-wide so URLs containing `swisseph.wasm` are served from disk. (Keep this in mind when mocking `fetch` in tests.)
- **Browser build:** the engine and WASM (~412 kB) are bundled client-side.
- **Fallback:** per-call `try/catch` → `astronomy-engine` positions, a pure-math ascendant, and a pure-math Lahiri approximation. Every fallback logs `[DSSME ephemeris] FALLBACK ENGINE ACTIVE for <function> — Swiss Ephemeris WASM failed: <reason>` via `console.warn`.
- **Init failure is sticky:** the initialization promise is cached and never reset after a rejection, so a failed init persists until the process restarts.
- **Health:** `GET /api/health` probes initialization — `status: "ok"` / `ephemeris: "swisseph-wasm"`, or `status: "degraded"` / `ephemeris: "fallback"` with `ephemerisError` (HTTP 200 both ways).
- **Precision:** Moshier is slightly lower precision than file-based Swiss Ephemeris data. It was verified adequate against the PyJHora fixtures at the tolerances used.

Only `ephemeris.ts` imports these packages. That must stay true.

---

## 7. PyJHora reference

| | |
|---|---|
| **Repository** | https://github.com/naturalstupid/PyJHora |
| **Pinned commit** | `48e57d29b47a3143519910a24866758116467485` (commit message "V4.9.3"; there is **no** git tag of that name — pin by SHA, not by tag) |
| **Role** | **REFERENCE / ORACLE ONLY** |

PyJHora must **not** become the production runtime, must not be added as a dependency, and its references in comments, tests and reports must not be removed.

- **Licensing:** PyJHora is published under AGPL-3.0 (per its repository page). Do not copy or port its source into this repository; use it as a reference for expected values and semantics only.
- **Fixtures, not execution:** expected values live as fixtures in `tests/differential/pyjhoraDifferential.test.ts` with source comments. Each new Phase 2 fixture should record its source (PyJHora function and arguments), the commit SHA, the configuration used, the input, and the date generated.
- **Configure the oracle to be comparable.** PyJHora's README says its defaults moved to true nodes and a `TRUE_PUSHYA` ayanamsa in the 4.6–4.7 line, and that its own tests assume `LAHIRI`. This engine uses **Lahiri and mean nodes**, so set both explicitly when generating reference values (the README names `drik.set_planet_list(set_rahu_ketu_as_true_nodes=False)`). The README describes the repository's current state — confirm against `const.py` / `drik.py` at the pinned commit.
- **Known oracle differences to account for:**
  - PyJHora derives DST/offset from its place database; this engine takes the caller's offset. Pass the same offset in fixtures.
  - PyJHora uses file-based Swiss Ephemeris data; this engine uses Moshier. Expect small numeric differences, and choose tolerances explicitly. Quantities near a boundary (a tithi, nakshatra, yoga or karana change) are the most sensitive.
  - PyJHora sets its sunrise/sunset flags via `utils.set_flags_for_rise_set` (its README mentions `swe.BIT_HINDU_RISING`). Read the flags at the pinned commit and record the convention you match.

---

## 8. Known limitations

| # | Limitation | Impact on Phase 2 |
|---|---|---|
| 1 | Fallback provenance is `LOGGED_ONLY` (§11) | Blocks must not assume per-chart provenance exists |
| 2 | Licensing decision open (§9) | Do not swap or add ephemeris packages |
| 3 | Not Vercel-serverless-shaped (§10) | Keep blocks free of HTTP concerns |
| 4 | **UTC offset is caller-supplied, by contract.** `timezone` (IANA name) is only required non-empty and used to derive a display `city`; the engine does no tz-database or DST resolution | Panchanga's civil-day and sunrise logic depend on a correct offset. Do not change without approval |
| 5 | **`CanonicalChart` holds birth-instant positions only** — no sunrise/sunset, no positions at other instants, no event times | Panchanga needs more than it provides (§14) |
| 6 | Moshier ephemeris precision (§6) | Matters for boundary-sensitive quantities |
| 7 | Sun Shadbala minimum: 390 virupas (canonical contract) vs 300 (PyJHora) — and the other open questions in the type header | Unresolved by design; decide when Shadbala is reached |
| 8 | Julian Day applies the Gregorian correction to all dates (no Julian-calendar branch before 1582) | Irrelevant for modern births |
| 9 | `lint` is `tsc --noEmit`; no ESLint/Biome is configured | Lint and typecheck are the same check |
| 10 | Declared-but-unused dependencies (§5) | None |

Minor / cosmetic: `package.json` `"name"` is still the template's `react-example`; Vite warns that `vite.config.ts`'s use of `__dirname` will need `import.meta.dirname` in a future major version; `vite.config.ts` contains AI Studio–specific HMR/watch settings marked "do not modify" — leave them.

---

## 9. Licensing decision required

`@swisseph/browser` (1.3.1) is declared **AGPL-3.0** and is **bundled client-side** in the production build. This is a **licensing / architecture decision, not a calculation defect.** No legal advice is given here.

**A deliberate decision is required before commercial production distribution.** Until it is made, the ephemeris is **not** replaced, swapped, or supplemented — by Phase 2 or as a side effect of anything else. Details: `reports/PHASE_1_CONDITIONAL_DECISIONS.md` §B.

## 10. Vercel deployment work remaining

`server.ts` calls `app.listen()` unconditionally (Express, Vite middleware in dev, static `dist/` plus a `*` catch-all in production). Status: **`NOT YET VERCEL-SERVERLESS-SHAPED`.** No `vercel.json` exists. `server.ts` is **not** rewritten in Phase 1.

Remaining, as a dedicated deployment task:

- Restructure the HTTP layer into serverless-shaped handlers (or a Vercel Node server preset) that do not call `.listen()`.
- Add the deployment configuration.
- Confirm the WASM asset is included and resolvable in the serverless runtime — the Node loader looks under `process.cwd()`.
- Confirm bundle-size limits.

The dependency graph is already serverless-friendly (no native binaries), and nothing in `src/engine/` imports Express.

## 11. Fallback provenance limitation

**`EPHEMERIS_FALLBACK_STATUS = LOGGED_ONLY`.** Fallback is logged and `/api/health` detects it, but an individual `CanonicalChart` carries no per-request ephemeris provenance. Three easy-to-miss properties:

- `meta.ephemeris: "SwissEphemeris-WASM-2.10.03"` in every `/api/canonical-chart` response is a **hardcoded label**, not provenance.
- Fallback is decided **per call**, so a chart could in principle mix engines.
- A failed initialization is **sticky** until restart.

Recommended future minimum (**not implemented; do not implement unless approved**): `meta.ephemerisEngine` in `server.ts`'s hand-built response `meta`, reconciled with the static label. Details: `reports/PHASE_1_CONDITIONAL_DECISIONS.md` §A.

---

## 12. Google AI Studio development boundary

Google AI Studio **may proceed with Phase 2 calculation-block development.**

However it **MUST NOT**:

- replace the astronomy engine
- replace Swiss Ephemeris
- introduce another astronomy engine
- duplicate `CanonicalChart`
- create another canonical type system
- change the existing output schema without explicit approval
- remove the existing tests
- remove PyJHora references
- silently change Lahiri
- silently change house semantics
- implement a second Julian Day engine

**Phase 2 must consume `CanonicalChart`.**

---

## 13. Phase 2 architecture

```
DssmeCalculationInput
        ↓
Validated Time
        ↓
Julian Day UT
        ↓
Swiss Ephemeris / current astronomy engine
        ↓
CanonicalChart
        ↓
Phase 2 Calculation Blocks
```

Rules:

1. **Do not recalculate astronomical positions inside individual blocks.** Panchanga and all later blocks consume the canonical astronomical context.
2. **No block imports `@swisseph/browser` or `astronomy-engine`.** Only `src/engine/astronomy/ephemeris.ts` does.
3. If a block needs an astronomical quantity that is not in `CanonicalChart`, add it as an **additive** function in the astronomy layer — a new module under `src/engine/astronomy/` that imports the existing `getSwissEphemeris()` / `normalize360`, follows the same primary/fallback/`logEphemerisFallback` pattern, and leaves existing functions untouched. It must not create a second engine. **If the addition would change `CanonicalChart`'s shape or any existing output schema, get explicit approval first.**
4. Block outputs use the existing interfaces in `dssme-canonical-types.ts`. No parallel types.
5. Blocks are pure and deterministic: same input → same output.

Suggested layout (non-binding): `src/engine/blocks/<block>.ts` exporting a pure function from a `CanonicalChart` to that block's interface; `tests/blocks/<block>.test.ts`; fixtures following the existing differential pattern; suites registered additively in `tests/run_all_tests.ts`.

---

## 14. Next development target — Block 2: PANCHANGA (not implemented here)

**Do not implement Panchanga in this task. This section only prepares the handoff.**

Panchanga must later consume the following. Nothing may be duplicated:

| Panchanga needs | In `CanonicalChart` today? | Where |
|---|---|---|
| Julian Day UT | Yes | `chart.time.julianDayUt` |
| Local civil time | Yes | `chart.time.localIso` (and `chart.input.date` / `.time`) |
| Timezone | Yes — offset and name | `chart.time.timezoneOffsetHours`, `chart.input.timezone` |
| Sun longitude | Yes | `chart.planets.Sun.siderealLongitude` (`.tropicalLongitude` also present) |
| Moon longitude | Yes | `chart.planets.Moon.siderealLongitude` |
| Sidereal context / Lahiri ayanamsa | Yes | `chart.ayanamsa.value` (`name: "Lahiri"`) |
| Latitude / longitude (needed for sunrise/sunset) | Yes | `chart.location` |
| **Sunrise** | **No** | must be added — see below |
| **Sunset** | **No** | must be added — see below |

**Sunrise and sunset do not exist anywhere in the engine today** — only the output fields `sunrise_time`, `sunrise_degree`, `sunset_time` appear, in `PanchangaBlock`. They cannot be "consumed"; they must first be produced, in the astronomy layer (§13 rule 3), before or as part of the Panchanga work.

Other `PanchangaBlock` fields that need more than birth-instant longitudes:

- `moon_nak_entry`, `moon_nak_exit` — Moon longitude over time (additional ephemeris evaluations at other Julian Days).
- `weekday_lord` — PyJHora's README states the Hindu day starts and ends with sunrise, so a birth before sunrise would belong to the previous weekday. Confirm the behavior against the oracle.
- `eclipse_proximity`, `ingress_stacking`, `gandanta_active`, `amavasya_zone`, `purnima_zone`, and the exact string format of `tithi_at_birth`, `nak_at_birth`, `yoga_at_birth`, `karana_at_birth` — **defined by the external spec documents (§2), not by the type file.**

Which tithi, nakshatra, yoga and karana is running follows from the Sun and Moon longitudes already in `CanonicalChart`; whether the string fields also carry end times or other detail is a question for the spec and the Chofu sample.

**Design decision for Phase 2 to make and record** (not decided here): how to supply time-based astronomical quantities without duplicating calculations or altering `CanonicalChart`:

- pass additional astronomical context **alongside** the chart as a separate typed argument (no schema change), or
- extend `CanonicalChart` (a schema change — **explicit approval required**).

**Sunrise convention:** limb definition and atmospheric refraction shift sunrise by minutes. Match the oracle's convention (§7) and record it.

---

## 15. Final handoff status

PHASE_1_CONDITIONAL_FOR_GOOGLE_AI_STUDIO

NEXT_PHASE:

PHASE_2_PANCHANGA

PHASE_2_PREREQUISITES:

- consume CanonicalChart
- preserve current astronomy engine
- preserve canonical types
- preserve tests
- preserve PyJHora traceability
- do not silently alter ephemeris
- do not silently alter Lahiri
- do not silently alter house semantics
