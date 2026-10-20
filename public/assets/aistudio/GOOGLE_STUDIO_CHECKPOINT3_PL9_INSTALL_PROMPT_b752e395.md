# Google Studio — DSSME Checkpoint 3 & PL9 Standard Shadbala Install Prompt

---

## 📌 Copy & Paste the prompt below into Google Studio:

---

You are working on the **DSSME EVENT Calculation Engine** project.

Please install the updated files from the ZIP archive: **`dssme_checkpoint3_pl9_shadbala_fixed.zip`**

This update incorporates:
1. **Checkpoint 3 Closed-Gate Bug Fixes** (Timezone determinism, S-02c Combust boundary, D-9 Dignity degree fix, Yoga corrections, Amavasya zone fix).
2. **Parashara's Light 9 (PL9) Classical Shadbala Standard (Phase A)**:
   - **Moon Paksha Bala**: Calculated via true Moon-Sun angular elongation formula without artificial 2× inflation.
   - **Sun Ayana Bala**: Calculated via true declination (Kranti) without artificial 2× inflation.
   - **Nathonnatha Bala**: Calculated using True Apparent Midnight (Local IC transit with Equation of Time adjustment) instead of simplistic sunrise/sunset averages.
   - **Chesta Bala (dviguṇa role)**: For Sun and Moon, the Chesta slot is accurately filled by Ayana Bala and Paksha Bala respectively per BPHS Ch. 27.

---

## 📦 File Installation Map

| File in ZIP | Target Project Path | Action |
|---|---|---|
| `src/engine/chartblocks/combust.ts` | `src/engine/chartblocks/combust.ts` | **Replace** |
| `src/engine/chartblocks/dignity.ts` | `src/engine/chartblocks/dignity.ts` | **Replace** |
| `src/engine/chartblocks/hora.ts` | `src/engine/chartblocks/hora.ts` | **Replace** |
| `src/engine/chartblocks/identity.ts` | `src/engine/chartblocks/identity.ts` | **Replace** |
| `src/engine/chartblocks/index.ts` | `src/engine/chartblocks/index.ts` | **Replace** |
| `src/engine/chartblocks/navamsha.ts` | `src/engine/chartblocks/navamsha.ts` | **Replace** |
| `src/engine/chartblocks/shadbala.ts` | `src/engine/chartblocks/shadbala.ts` | **Replace** |
| `src/engine/chartblocks/yoga.ts` | `src/engine/chartblocks/yoga.ts` | **Replace** |
| `scripts/debug_shadbala.ts` | `scripts/debug_shadbala.ts` | **Replace** |
| `scripts/debug_shadbala_deep.ts` | `scripts/debug_shadbala_deep.ts` | **Replace** |
| `scripts/debug_shadbala_v2.ts` | `scripts/debug_shadbala_v2.ts` | **Replace** |

---

## 🔧 Summary of Key Upgrades & Fixes

### 1. Parashara's Light 9 (PL9) Shadbala Standard (`shadbala.ts`)
- **No Artificial 2× Inflation**: Moon's Paksha Bala (20.99 Virupas for Chofu preset) and Sun's Ayana Bala (33.36 Virupas) strictly follow the 60-Virupa maximum classical scale.
- **Sun & Moon Chesta Bala**: BPHS "dviguṇa" specifies that non-retrograde luminaries have their Chesta slots filled by their respective primary strengths (Sun Chesta = Ayana Bala; Moon Chesta = Paksha Bala).
- **True Apparent Midnight**: Local apparent solar midnight is accurately derived by applying the Equation of Time (EoT) and meridian longitude offset, providing spherical-astronomy precision for Nathonnatha Ghatis.
- **Per-Planet Declination (Kranti)**: Ayana Bala for all classical planets is derived using exact spherical coordinate conversion from Lahiri sidereal longitudes.

### 2. Timezone & Civil Calendar Safety (`index.ts`, `identity.ts`, `hora.ts`)
- Fixed machine-timezone leakage by parsing date components directly from the ISO string and computing weekdays via `Date.UTC()` rather than host-local `Date.getDay()`.
- `amavasya_zone` now correctly checks `{29, 30, 1}` per Contract T-09.

### 3. Closed-Gate Parashari Logic Fixes
- **`combust.ts` (S-02c)**: `sep > threshold` is non-combust; `sep === threshold` falls into Mild combustion. Separation degrees are retained raw without premature rounding.
- **`navamsha.ts`**: `getClassicalDignity` now receives the actual D-9 degree (`d9Lon % 30`) to avoid false Moolatrikona assignments.
- **`yoga.ts`**: Shakata Yoga axis check updated to 6th/8th house difference (`diff === 5 || diff === 7`), and duplicate Raja Yoga logic removed.
- **`dignity.ts`**: Clarified Parashari compound friendship comments (Saturn in Pisces = Neutral).

---

## 🔍 Verification Commands

Please run these commands sequentially to verify clean integration:

```bash
# 1. Typecheck (must return exit code 0)
npx tsc --noEmit

# 2. Deterministic Engine & Conformance Vectors Test Suite
npm test
# Expected: 20/20 Test Suites Passed (100%)
# Expected: 240/240 Conformance Vectors Passed (0 failures)

# 3. Shadbala Verification Output
npx tsx scripts/debug_shadbala.ts
# Expected: Clean table output with Sun Chesta ~33.3 Virupas and Moon Chesta ~21.0 Virupas

# 4. Production Build
npm run build
# Expected: ✓ built in < 1s
```
