# Phase 1 — Final Integration + Dependency Correction Gate

**Date:** 2026-09-27
**Scope:** Verify the two Phase 1 correction patches, run a full dependency audit, resolve the broken clean-install path, and issue a go/no-go verdict before Phase 2 (Panchanga) begins.
**Verdict:** `PHASE_1_CONDITIONAL_FOR_GOOGLE_AI_STUDIO`

---

## 1. Patch Integration Verification

Confirmed present in the working tree, matching what was reported as implemented:

| File | Change |
|---|---|
| `src/engine/astronomy/timezone.ts` | +15/-0 — calendar round-trip validation |
| `src/engine/astronomy/ephemeris.ts` | +16/-0 — `logEphemerisFallback()` wired into all 3 fallback sites |
| `server.ts` | +32/-7 — `/api/health` now probes Swiss Ephemeris |
| `tests/astronomy/timezone.test.ts` | +23/-0 — regression tests for invalid/leap dates |

`git diff --stat` on these four files: `4 files changed, 79 insertions(+), 7 deletions(-)`. No drift from what was delivered.

## 2. Functional Verification

All of the following were re-run from source in this session, not assumed from the prior report.

| Check | Result | Evidence |
|---|---|---|
| Invalid calendar dates rejected | **PASS** | `2024-02-30`, `2023-04-31`, `2023-02-29` (non-leap) all throw `INVALID_INPUT: ... is not a valid calendar date` |
| Leap dates still accepted | **PASS** | `2024-02-29` → `localIso: 2024-02-29T10:00:00+00:00` |
| Ephemeris fallback never silent | **PASS (empirically forced)** | See §3 |
| `/api/health` reports real readiness | **PASS (empirically forced)** | See §3 |
| Existing test suite | **PASS — 7/7** | Timezone, Julian Day, Ayanamsa, Planetary Positions, Ascendant & Houses, CanonicalChart Determinism, PyJHora Differential |
| Typecheck | **PASS** | `tsc --noEmit` → exit 0, no diagnostics |
| Lint | **PASS** | `"lint": "tsc --noEmit"` in `package.json` — there is no separate linter (no ESLint/Biome config in the repo); lint and typecheck are the same command here. Reported once, not double-counted. |
| Production build | **PASS** | `vite build` → exit 0, `dist/` produced (see §7) |

## 3. Ephemeris Fallback: Machine-Readability Determination

**`EPHEMERIS_FALLBACK_STATUS = LOGGED_ONLY`**

What exists today:
- `console.warn` fires in `ephemeris.ts` at all three fallback sites (ayanamsa, body position, ascendant).
- `/api/health` independently probes `getSwissEphemeris()` and reports `status`/`ephemeris` honestly.

What does **not** exist: per-request provenance. Nothing in `CanonicalChart` says whether *that specific chart* was computed by Swiss Ephemeris WASM or by the pure-math/`astronomy-engine` fallback. `/api/health` is a separate, point-in-time probe — it can be green a second before or after an individual request silently used the fallback.

> **Revision note (2026-09-28):** the original wording of this paragraph said the `/api/canonical-chart` response body carried no engine information at all. That was incomplete. Every successful response includes `meta.ephemeris: "SwissEphemeris-WASM-2.10.03"` — a **hardcoded static string in `server.ts`**, emitted regardless of which engine actually ran. It is not provenance and would read identically for a fallback-computed chart. The conclusion and the status (`LOGGED_ONLY`) are unchanged; see `reports/PHASE_1_CONDITIONAL_DECISIONS.md` §A.

The fallback and health behavior was proven, not inferred:

```
$ (both local swisseph.wasm copies temporarily hidden, forcing WASM init to fail)
wasm streaming compile failed: TypeError: fetch failed
Aborted(both async and sync fetching of the wasm failed)
[DSSME ephemeris] FALLBACK ENGINE ACTIVE for calculateLahiriAyanamsa — Swiss Ephemeris WASM failed: Aborted(...)
[DSSME ephemeris] FALLBACK ENGINE ACTIVE for calculateAscendant — Swiss Ephemeris WASM failed: Aborted(...)
[DSSME ephemeris] FALLBACK ENGINE ACTIVE for calculateBodyPosition(Sun) — Swiss Ephemeris WASM failed: Aborted(...)
Ayanamsa still returned a value via fallback: 23.85709222
```
and, hitting the live endpoint under the same forced condition:
```
GET /api/health → {"status":"degraded","phase":"PHASE_1_FOUNDATION","ephemeris":"fallback",
                    "ephemerisError":"Aborted(both async and sync fetching...)","ayanamsa":"Lahiri", ...}
```
Both mechanisms work exactly as designed. Neither one is attached to the chart data itself.

**Per instruction: the schema has not been touched.** `CanonicalChart` is documented in `dssme-canonical-types.ts` as an imported, unaltered canonical contract, and `Dssme16BlockResult` downstream depends on that stability — this is not mine to redesign unilaterally.

**Minimum safe change (recommended, not implemented):** add one field to `server.ts`'s response `meta` object — which is already a hand-built object, not a field of the frozen `CanonicalChart`/`DssmeApiResponseSuccess` type — e.g. `meta.ephemerisEngine: "swisseph-wasm" | "fallback"`. That requires `generateCanonicalChart` to report whether any fallback fired during that specific call (smallest version: a per-call counter reset at the start of the function and read at the end, returned alongside the chart rather than merged into it). When that field is added, the static `meta.ephemeris` label must be derived from the same signal or removed, so the two cannot contradict each other. This is a real, if small, architectural decision — how the pipeline threads that flag back to `server.ts` — so it's flagged here for a decision, not implemented in this gate.

## 4. Dependency Audit

Every package below was checked with a quote-agnostic, repo-wide grep (`from ['"]pkg` / `require\(['"]pkg`) across all `.ts`/`.tsx` files, plus config files (`vite.config.ts`) and CSS (`index.css`) for non-JS references. This is the "affected files" evidence the cleanup in §5 is based on.

| Package | Type | Status | Evidence |
|---|---|---|---|
| `@swisseph/browser` | prod | **actively used** | `src/engine/astronomy/ephemeris.ts` (primary ephemeris engine) |
| `astronomy-engine` | prod | **actively used** | `src/engine/astronomy/ephemeris.ts` (fallback engine) |
| `express` | prod | **actively used** | `server.ts` |
| `react`, `react-dom` | prod | **actively used** | `src/App.tsx`, `src/main.tsx` |
| `lucide-react` | prod | **actively used** | `src/App.tsx` |
| `vite`, `@tailwindcss/vite`, `@vitejs/plugin-react` | prod | **actively used** | `vite.config.ts` |
| `tailwindcss` | dev | **actively used** | `src/index.css` (`@import "tailwindcss"`, v4-style — no `postcss.config.*` exists, confirming the old PostCSS pipeline isn't in play) |
| `swisseph-v2` | prod | **unused — 0 references anywhere in source** | Native node-gyp binding; duplicates `@swisseph/browser`'s job |
| `@fusionstrings/swiss-eph` | prod | **unused — 0 references anywhere in source** | Alternate WASM binding; duplicates `@swisseph/browser`'s job |
| `esbuild` | dev | **unused — 0 direct references; only present as a version pin** | Vite lists it as an *optional* peer (`peerDependenciesMeta.esbuild.optional = true`); nothing in this repo imports it directly |
| `@google/genai` | prod | **not currently imported** | `metadata.json` declares `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` as a stated future capability — reads as reserved scaffolding, not dead code. **Not removed.** |
| `dotenv` | prod | **not currently imported** | No `import "dotenv/config"`, no `--env-file` flag in any script. Genuinely unused today, but outside what this gate was asked to touch. **Not removed — flagged for your call.** |
| `motion` | prod | **not currently imported** | Same as above. **Not removed.** |
| `autoprefixer` | dev | **likely redundant** | Tailwind v4 + `@tailwindcss/vite` (Lightning CSS) does its own vendor-prefixing; no postcss config references it. Zero risk either way since it's dev-only — **not removed this gate**, safe to drop whenever convenient. |

**Duplicated capability:** three separate Swiss Ephemeris bindings were present (`@swisseph/browser`, `@fusionstrings/swiss-eph`, `swisseph-v2`) for the same job; only one was ever wired in.

**Why a clean `npm install` failed — two independent causes, confirmed by reproducing each in isolation:**

1. **`esbuild` version pin vs. Vite's peer requirement.** Plain `npm install` (no flags) fails immediately with `ERESOLVE`:
   ```
   npm error Found: esbuild@0.25.12 (dev esbuild@"^0.25.0" from the root project)
   npm error peerOptional esbuild@"^0.27.0 || ^0.28.0" from vite@8.3.1
   ```
   This has nothing to do with `swisseph-v2` — it blocks the install before npm even reaches it.

2. **`swisseph-v2` native compilation.** After bypassing #1, install proceeds until `swisseph-v2`'s `postinstall` runs `node-gyp rebuild`, which needs to download Node headers:
   ```
   npm error gyp http GET https://nodejs.org/download/release/v22.22.2/node-v22.22.2-headers.tar.gz
   npm error gyp http 403 ...
   npm error gyp ERR! stack Error: 403 response downloading ...
   ```
   The `403` here is specific to this sandbox's network allowlist (`nodejs.org` isn't reachable from it) — I can't certify that exact status code reproduces on an unrestricted machine. What isn't sandbox-specific: `swisseph-v2` requires a working C/C++ toolchain, Python, and network access to compile at install time, purely to provide a capability the code never calls. That's a real fragility for CI and serverless build environments generally, independent of this sandbox's specific restriction.

Both are now fixed by removing the unused packages (§5) — no network-dependent native compilation remains in the dependency tree at all.

**Licensing — surfaced during this audit, not asked for, but material:** `@swisseph/browser` (the engine actually in use) is licensed **AGPL-3.0**. This is expected — Astrodienst, the author of the underlying Swiss Ephemeris library, dual-licenses it: free under AGPL-3.0, or under a paid commercial license for closed-source use. This isn't a hypothetical "if you run it as a network service" concern — the production build (§7) already embeds the AGPL-licensed WASM binary and JS wrapper directly into the **client-side browser bundle** (`dist/assets/swisseph-*.wasm`, `dist/assets/swisseph-*.js`), which is a distribution event under any reading of the license, today, in Phase 1. If DSSME is headed toward a closed-source commercial product, this needs a real look — either compliance with AGPL's source-availability terms or a commercial license from Astrodienst. I'm not a lawyer and this isn't legal advice; it's a factual flag worth a deliberate decision rather than an accident of which ephemeris package got picked first. (The now-removed `@fusionstrings/swiss-eph` was AGPL-3.0 too, for what it's worth — swapping ephemeris providers wouldn't have avoided this.)

## 5. Dependency Cleanup Performed

Removed `swisseph-v2` and `@fusionstrings/swiss-eph` (dependencies) and `esbuild` (devDependency) from `package.json`. For each:

- **Imports searched:** `grep -rnE "(from|require\() ?['\"]<pkg>(/|['\"])" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules .` (repo root, both quote styles)
- **Affected files:** none — zero matches for all three, repo-wide
- **Lockfile:** `bun.lock` regenerated via `bun install` (this project's actual package manager, per the existing `bun.lock`) — bun's own diff confirms `Removed: 3`, matching exactly
- **Clean install:** re-run from a fully removed `node_modules` — see §7
- **Typecheck, tests, build:** all re-run and passing after removal — see §7

## 6. Audit Findings

**Before cleanup:** `npm install` reported **5 vulnerabilities (4 high, 1 critical)**, traced to `swisseph-v2`'s `node-gyp` toolchain pulling deprecated transitive packages (`tar@6.2.1`, `glob@10.5.0` — both flagged by npm at install time as carrying publicized CVEs in old versions).

**After cleanup:** both audits, independently, on the two package managers:
```
npm install  → "found 0 vulnerabilities"
bun audit    → "No vulnerabilities found (checked 262 packages)"
```

**No `npm audit fix` or `bun audit fix` was run.** The vulnerabilities disappeared as a side effect of removing dead weight that happened to drag in an old native-build toolchain — not from forcing version upgrades. Categorization buckets (A: prod / B: dev / C: transitive / D: fixable without breaking / E: needs major upgrade / F: not safely fixable) are **not applicable — zero findings remain** to sort into them.

## 7. Final Clean-Install Chain — Verified on Both Toolchains

**npm** (plain, no flags):
```
$ rm -rf node_modules package-lock.json && npm install
added 183 packages, and audited 184 packages in 9s
found 0 vulnerabilities

$ npm run lint   → tsc --noEmit, exit 0
$ npm test       → 7/7 PASSED
$ npm run build  → vite build, exit 0
  dist/index.html                        0.91 kB
  dist/assets/swisseph-*.wasm          411.87 kB (gzip 203.23 kB)
  dist/assets/index-*.css               25.67 kB
  dist/assets/swisseph-*.js             39.86 kB
  dist/assets/index-*.js                315.86 kB
```

**bun** (the project's actual package manager, per `bun.lock`):
```
$ rm -rf node_modules && bun install
188 packages installed [3.26s]   Removed: 3

$ bunx tsc --noEmit → exit 0
$ bun run test      → 7/7 PASSED
$ bun run build     → vite build, exit 0 (built in 578ms)
$ bun audit          → 0 vulnerabilities, 262 packages
```

Caveat: `bun` isn't part of this sandbox's default toolchain — it was obtained via `npm install -g bun` for this verification. The result is genuine (it's the real `bun` binary running the project's real `bun.lock`), but treat this as strong evidence rather than a substitute for you running `bun install` once in your own environment as final confirmation.

Both toolchains: clean install → typecheck → tests → build, zero flags, zero errors, zero vulnerabilities.

## 8. Vercel Compatibility Re-Check

- **Dependency graph: improved.** No native/`node-gyp` binaries remain anywhere in the tree. `@swisseph/browser` (WASM) and `astronomy-engine` (pure JS) are both portable, filesystem-independent at runtime.
- **Entrypoint architecture: not yet serverless-shaped.** `server.ts` calls `app.listen(PORT, "0.0.0.0", ...)` unconditionally — a traditional persistent server. Vercel's serverless model doesn't run that as-is; shipping there would need restructuring into `/api` route handlers (or a specific Vercel Node server preset) that doesn't call `.listen()`. This is a pre-existing gap, not something this gate introduced — flagged because §8 was explicitly asked for.
- **No `vercel.json`** exists in the repo — there's no current deployment config to test against, so this is a structural read of the code, not a live deployment test.
- The AGPL-3.0 finding in §4 applies to any deployment target, Vercel included.

## 9. Outstanding Items Carried Forward (none block starting Phase 2 code)

1. `EPHEMERIS_FALLBACK_STATUS = LOGGED_ONLY` — minimum safe fix recommended in §3, not implemented.
2. `@swisseph/browser` is AGPL-3.0 and already shipped client-side — recommend a deliberate decision (commercial license vs. AGPL compliance vs. accept for now) before much more is built on top of it.
3. `server.ts` needs restructuring before an actual Vercel deployment.
4. `@google/genai`, `dotenv`, `motion` — declared, currently unused, not removed (first two plausibly reserved for later phases; `dotenv` genuinely looks dead but wasn't in this gate's scope).
5. `autoprefixer` — likely safe to drop, low priority, not urgent.
6. Cosmetic: `package.json` `"name"` is still `"react-example"` (template default).
7. Cosmetic: Vite warns that `vite.config.ts`'s use of `__dirname` will need `import.meta.dirname` in a future Vite major version — not breaking today.

## Verdict Rationale

**`PHASE_1_CONDITIONAL_FOR_GOOGLE_AI_STUDIO`** — not `BLOCKED`: the calculation core is correct, tested on two independent toolchains, and the install/build chain is genuinely clean. Not unconditional `READY`: items 1–3 above are real and worth a conscious decision, not silent carry-forward, before compounding fifteen more blocks on top of this foundation. None of them require stopping Phase 2 work — they require someone to have looked at them on purpose, which this report is for.
