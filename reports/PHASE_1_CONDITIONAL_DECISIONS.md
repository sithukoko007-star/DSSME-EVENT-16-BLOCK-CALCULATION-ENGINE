# Phase 1 — Conditional Decisions

**Status:** `PHASE_1_CONDITIONAL_FOR_GOOGLE_AI_STUDIO`
**Date:** 2026-09-28
**Purpose:** Record the three conditions carried forward by the Phase 1 gate as deliberate, tracked decisions — not silently resolved, and not silently forgotten.
**Evidence:** `reports/PHASE_1_AUDIT_AND_CORRECTION_GATE.md` (and `.json`).

None of the three items changes a Phase 1 calculation result. None is implemented by this document. None blocks Phase 2 calculation-block development.

| | Item | Status | Blocks Phase 2 calc work | Needs a decision before |
|---|---|---|---|---|
| A | Ephemeris fallback provenance | `EPHEMERIS_FALLBACK_STATUS = LOGGED_ONLY` | No | Any consumer relying on per-chart provenance |
| B | Ephemeris licensing | **Open — decision required** | No | Commercial production distribution |
| C | Vercel entrypoint | `NOT YET VERCEL-SERVERLESS-SHAPED` | No | Any Vercel deployment |

---

## A. Ephemeris fallback provenance — `EPHEMERIS_FALLBACK_STATUS = LOGGED_ONLY`

### Current behavior (verified)

1. **Fallback is logged.** `logEphemerisFallback()` in `src/engine/astronomy/ephemeris.ts` emits
   `[DSSME ephemeris] FALLBACK ENGINE ACTIVE for <function> — Swiss Ephemeris WASM failed: <reason>`
   via `console.warn` at each of the three fallback sites: `calculateLahiriAyanamsa`, `calculateBodyPosition`, `calculateAscendant`.
2. **`/api/health` detects fallback.** It probes `getSwissEphemeris()` and returns HTTP 200 with either
   `status: "ok"`, `ephemeris: "swisseph-wasm"` or `status: "degraded"`, `ephemeris: "fallback"`, `ephemerisError: <reason>`.
   Both outcomes were exercised by forcing WASM initialization to fail.
3. **An individual `CanonicalChart` does not contain per-request ephemeris provenance.** Nothing in the chart says which engine computed it.

### Three properties that are easy to miss

- **Static label.** Every successful `/api/canonical-chart` response includes `meta.ephemeris: "SwissEphemeris-WASM-2.10.03"`. This is a hardcoded string in `server.ts`, not derived from what actually ran — it would read identically for a chart computed by the fallback. It must not be read as provenance. *(This refines the wording of gate report §3, which said the response body carried no engine information at all; that paragraph has been corrected. The status is unchanged.)*
- **Per-call granularity.** Each of the three functions has its own `try/catch`, so fallback is decided per call, not per chart. If WASM initialization itself fails, every call falls back; if a failure were intermittent, one chart could in principle combine both engines.
- **Sticky initialization failure.** `getSwissEphemeris()` caches its initialization promise and never resets it after a rejection (by code inspection). A process that fails to initialize WASM stays degraded until it is restarted, and `/api/health` will keep reporting `degraded` accordingly.

### Recommended future minimum (NOT implemented)

Add **`meta.ephemerisEngine`** to the hand-built `meta` object in `server.ts`'s success response — not to `CanonicalChart`, and not to the typed `DssmeApiResponseSuccess`. This requires `generateCanonicalChart` to report, per call, whether any fallback fired, returned alongside the chart rather than merged into it.

Two design points for whoever implements it:

1. The value set must account for per-call granularity (a "mixed" case, not only `swisseph-wasm | fallback`).
2. The static `meta.ephemeris` label must be derived from the same signal or removed, so the two fields cannot contradict each other.

### Decision

**Deferred.** Not required for the Google AI Studio handoff. Phase 2 blocks must not depend on `meta.ephemerisEngine` existing, and must not change `CanonicalChart` to add it without explicit approval.

---

## B. Ephemeris licensing

### Facts (verified)

- **Package:** `@swisseph/browser` 1.3.1
- **Declared license:** `AGPL-3.0` (package metadata)
- **Role:** the primary ephemeris engine — every Phase 1 astronomical result comes from it
- **Distribution:** **currently bundled client-side.** The production build emits `dist/assets/swisseph-*.wasm` (~412 kB) and `dist/assets/swisseph-*.js` into the browser bundle; the engine is also used server-side.
- **Upstream:** the Swiss Ephemeris publisher documents its own licensing terms, which are theirs to state and are not summarized here.
- **Related:** PyJHora, the reference oracle, is also published under AGPL-3.0. It is used for reference values only and is not part of the runtime or the bundle.

### Nature of this item

This is a **licensing / architecture decision, not a calculation defect.** This document makes no legal determination and gives no legal advice.

**A deliberate decision is required before commercial production distribution.** The decision belongs to the project owner. Inputs it will need: the intended distribution model (open or closed source; hosted or downloadable), where the engine runs (server only, or also in the browser), and the licensing terms the owner chooses to operate under.

### Constraints in force until that decision is made

- The ephemeris is **not silently replaced** — not by Phase 2, and not as a side effect of any other change.
- No second ephemeris or astronomy package is added.
- Changing what is bundled client-side is a separate architecture decision, not a Phase 2 task.

**Status: OPEN.**

---

## C. Vercel entrypoint

### Current (verified in `server.ts`)

- Express app with `express.json()`.
- Non-production: mounts Vite in middleware mode.
- Production: serves `dist/` via `express.static` with a `*` catch-all that returns `index.html`.
- Then unconditionally calls **`app.listen(PORT, "0.0.0.0", …)`**.
- No `vercel.json` exists in the repository, and there is no `/api` route-handler layout.

### Status

**`NOT YET VERCEL-SERVERLESS-SHAPED`.** A persistent `app.listen()` server does not map onto Vercel's serverless function model as-is.

This is a **deployment architecture item, not a calculation defect.** `server.ts` is **not** rewritten in this Phase 1 task.

### What is already in good shape

- The dependency graph has no native / `node-gyp` binaries (removed in the gate).
- Nothing under `src/engine/` imports Express, so restructuring the HTTP layer does not need to touch calculation code.

### Guidance for Phase 2

Keep calculation blocks free of HTTP concerns — pure modules that return typed results. If Phase 2 needs to expose blocks over HTTP, add thin wrapper handlers that can later be lifted into serverless route files, rather than deepening the coupling to `server.ts`.

### Decision

**Deferred** to a dedicated deployment task.

---

## Cross-references

- Full evidence for all three items: `reports/PHASE_1_AUDIT_AND_CORRECTION_GATE.md` / `.json`
- Handoff to Google AI Studio: `reports/GOOGLE_AI_STUDIO_PHASE_1_HANDOFF.md`
