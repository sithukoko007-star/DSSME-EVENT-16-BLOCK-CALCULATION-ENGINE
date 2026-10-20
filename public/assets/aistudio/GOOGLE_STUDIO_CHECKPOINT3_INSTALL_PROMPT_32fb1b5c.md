# Google Studio — DSSME Checkpoint 3 Chartblocks Install Prompt

---

## Paste this prompt into Google Studio:

---

You are working in the **DSSME EVENT Calculation Engine** project.

I am providing you with a ZIP file: **`dssme_checkpoint3_chartblocks_fixed.zip`**

This ZIP contains **Checkpoint 3 closed-gate bug fixes** for the chartblocks layer. Please extract and install all files exactly as follows.

---

## 📦 File Installation Map

| File in ZIP | Target Project Path | Description |
|---|---|---|
| `src/engine/chartblocks/combust.ts` | `src/engine/chartblocks/combust.ts` | **Replace** |
| `src/engine/chartblocks/dignity.ts` | `src/engine/chartblocks/dignity.ts` | **Replace** |
| `src/engine/chartblocks/hora.ts` | `src/engine/chartblocks/hora.ts` | **Replace** |
| `src/engine/chartblocks/identity.ts` | `src/engine/chartblocks/identity.ts` | **Replace** |
| `src/engine/chartblocks/index.ts` | `src/engine/chartblocks/index.ts` | **Replace** |
| `src/engine/chartblocks/navamsha.ts` | `src/engine/chartblocks/navamsha.ts` | **Replace** |
| `src/engine/chartblocks/yoga.ts` | `src/engine/chartblocks/yoga.ts` | **Replace** |

---

## 🔧 What Was Fixed (Checkpoint 3 — Closed-Gate Bugs)

### Priority 1 — Fabricated Panchanga & Timezone Safety
- **`index.ts`** — Weekday derivation now parses `localIso` date string directly using `Date.UTC()` instead of `new Date(localIso).getDay()` (which used machine timezone). Panchanga vara weekday is authoritative when available. Night/day detection uses JD comparison when sunrise/sunset JD are provided; otherwise parses hour from `localIso` string (not `new Date().getHours()`).
- **`index.ts`** — `amavasya_zone` now correctly includes tithi **29, 30, 1** per T-09 (was missing tithi 29).
- **`identity.ts`** — Weekday derivation fixed: uses `Date.UTC(yr, mo-1, dy).getUTCDay()` from parsed localIso date string — machine-timezone-safe.
- **`identity.ts`** — `ayanamsa_value` format fixed per S-08: now `"24.2300"` (no `+` prefix, no `°` suffix).
- **`hora.ts`** — Weekday derivation fixed: same machine-timezone-safe approach, parses date components from `localIso` string.

### Priority 2 — Closed-Gate Logic Bugs
- **`combust.ts`** — Boundary fix per S-02c: `sep > threshold` = not combust; `sep === threshold` = Mild (was `>=` which incorrectly excluded the threshold itself). `sep_deg` is now raw (unrounded) per decision.
- **`navamsha.ts`** — `getClassicalDignity()` now receives the actual D-9 sign-degree (`d9Lon % 30`) instead of defaulting to `0`. Prevents Moolatrikona false-positives for planets in their MT sign in D-9.
- **`yoga.ts`** — **Shakata Yoga** diff fixed: Moon in 6th from Jupiter = diff 5; Moon in 8th from Jupiter = diff 7 (was incorrectly 6 and 8, i.e. one house off).
- **`yoga.ts`** — **Raja Yoga** duplicate `=== 6` clause removed (was `klHouse === tlHouse || diff===6 || diff===6`).
- **`dignity.ts`** — Header comment corrected: Saturn in Pisces = **Neutral** (code was already correct; only comment was wrong saying "Enemy").

---

## ✅ Verification Steps

After installing, please run these commands and confirm all pass:

```bash
# 1. TypeScript type check (must exit 0 with no errors)
npx tsc --noEmit

# 2. Full deterministic test suite
npm test
# Expected: 20/20 Test Suites Passed
# Expected: 240/240 Conformance Vectors PASS

# 3. Production build
npm run build
# Expected: ✓ built — exit code 0
```

---

## 📋 Expected Verification Results

| Check | Expected Result |
|---|---|
| `npx tsc --noEmit` | Exit 0, zero type errors |
| `npm test` | **20/20 Test Suites Passed** |
| Conformance Vectors | **240/240 PASS (0 failures)** |
| `npm run build` | `✓ built` — Exit 0 |

---

## ⚠️ Do NOT Modify

The following files were intentionally **not changed** because their bugs are in **open-gate blocks** (S-03, S-05, S-06, S-07, T-02..T-08) awaiting future gate decisions:
- `shadbala.ts` — Saptavargaja, Chesta, Ayana approximations (S-06 open)
- `bhavaBala.ts` — lord_contrib scale (S-06 open)
- `dasha.ts` — 365.25-day year (S-05 open)
- `aspects.ts` — binary I_aspect, 15° degree (S-03 open)
- `phaseStress.ts` — chart-only temporal approximation (T-02..T-08 open)

These are tracked for the next gate-close iteration.
