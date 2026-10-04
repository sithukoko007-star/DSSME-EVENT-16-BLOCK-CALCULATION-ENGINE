# PHASE 3 — GATE RESOLUTION & PYJHORA EVIDENCE AUDIT

**Document status:** AUDIT & EVIDENCE REPORT ONLY  
**Date:** 2026-10-03  
**Implementation phase:** Checkpoint 1 Accepted · Checkpoint 2 NOT AUTHORIZED (Frozen)  
**Governing Architecture:** `PHASE_3_ARCHITECTURE_DESIGN.md` (998 lines)

---

## A. Governance State

* **Governing Architecture:** `PHASE_3_ARCHITECTURE_DESIGN.md` (998 lines), verified and present in project root. The historical 728-line draft (`d344312`) is retired, obsolete, and non-governing.
* **Repository Baseline HEAD:** `5b79ecef114672753947ae1f842344f11c5cc08e` (main)
* **Checkpoint 1 Patch Artifact:** `phase3-checkpoint-1.patch` (commit `e621790ee7974469898b92c70099f10a6b523141`)
* **Checkpoint 1 Acceptance Status:** ACCEPTED
  * P3-0 (BlockResult contract, typed context, provenance propagation, test harness): COMPLETE
  * P3-1 (HOUSES, HOUSE_POSITIONS, RETROGRADE pure projections): COMPLETE
  * Deferred: IDENTITY (deferred pending resolution of Gate S-08)
* **Checkpoint 2 Authorization Status:** **NOT AUTHORIZED (HARD FREEZE)**
  * Implementation of Level 2 blocks (`IDENTITY`, `DIGNITY`, `NAVAMSHA`, `COMBUST`, `PANCHANGA` state flags) is strictly prohibited until Gates S-08, S-01, S-02, and T-09 are formally resolved.

---

## B. S-08 Evidence — Contract & String Literal Audit

### 1. Source References & Conflicting Literals

| Field / Attribute | Governing Spec (`PHASE_3_ARCHITECTURE_DESIGN.md` §2.3 C-12 / §16 S-08) | Canonical Contract (`docs/contracts/DSSME_MASTER_CONTRACT_v1.6.md` §2.2) | TypeScript Types (`src/types/dssme-canonical-types.ts`) | Reference JSON (`DSSME_CHART_2026-09-16_Chofu.json`) |
|---|---|---|---|---|
| `engine_version` | `"V3.0"` | `"V3.0"` | `string` | `"DSSME-Universal-1.4"` |
| `body_mode` | `"9-body"` | `"9-body"` | `string` (`bodyMode` in `DssmeCalculationInput`) | `"9-body"` (JSON) / `"Full"` (App preset) |
| `latitude` string format | `"XX.XXN"` / `"XX.XXS"` | `"XX.XXN"` | `string` | `"35.6528° N"` |
| `longitude` string format | `"XX.XXE"` / `"XX.XXW"` | `"XX.XXE"` | `string` | `"139.5442° E"` |
| `ayanamsa_value` string format | `"-XX.XXXX"` | `"-XX.XXXX"` | `string` | `"-24.2389"` |
| `lagna_degree` format | `"XX°XX'XX\""` | `"XX°XX'XX\""` | `string` | `"25°09'03\""` |
| `upcoming_ad` date format | `"DD-MM-YYYY"` | `"DD-MM-YYYY"` | `"DD-MM-YYYY"` (DashaEntry.start/end comment) | ISO 8601 (`"2026-09-16"`) |
| Panchanga Name Spelling | `Shashthi`, `Vishkambha` (native engine) | Parashara's Light variants `Shashti`, `Vishkumbha` | `string` | `"Shashti"`, `"Vishkumbha"` |

### 2. Analysis & Recommendations

* **`engine_version`**: Must be standardized to `"V3.0"`. The reference JSON's `"DSSME-Universal-1.4"` reflects an obsolete v1.4 export schema before v1.5/v1.6 canonicalization.
* **`body_mode`**: Standardize to `"9-body"`. The input parameter `bodyMode?: string` maps to `"9-body"`.
* **Coordinates & Angles**: `formatDms` exists in `src/engine/astronomy/ayanamsa.ts`. For `latitude`/`longitude` in `IdentityBlock`, use direction suffix format `"XX.XXN"` / `"XX.XXE"` (e.g. `35.65N`, `139.54E`). For degrees, use `formatDms` (`"XX°XX'XX\""`).
* **Dasha Dates**: Master Contract v1.6 and TypeScript types specify `"DD-MM-YYYY"`. The builder must format dasha transition boundaries into `"DD-MM-YYYY"`.
* **Panchanga Names**: The Phase 2 frozen Panchanga engine uses standard Sanskrit transliterations (`Shashthi`, `Vishkambha`). These must be preserved to prevent regressions in Phase 2 tests.

### 3. Closure Recommendation for S-08
**RECOMMENDATION:** Adopt Canonical Contract v1.6 / TypeScript specification literals (`"V3.0"`, `"9-body"`, `"DD-MM-YYYY"`). Operator approval required to mark Gate S-08 **CLOSED**.

---

## C. S-01 Evidence — Dignity / Friendship Model Audit

### 1. PyJHora Source Code Inspection

Files inspected in PyJHora at pinned commit `48e57d29b47a3143519910a24866758116467485`:
* `src/jhora/const.py` (lines 441–510)
* `src/jhora/horoscope/chart/house.py` (lines 860–940)
* `src/jhora/horoscope/chart/charts.py` (lines 1890–1935)

### 2. Findings on Friendship & Dignity Computation

1. **Natural Friendship Table** (`const.planet_relations`, `const.friendly_planets`, `const.neutral_planets`, `const.enemy_planets`):
   * Identical to the classical Parashara table defined in DSSME Master Contract §9.2.
2. **Temporary Friendship (Tatkalika Mitra)** (`const.temporary_friend_raasi_positions = [1,2,3,9,10,11]`):
   * Planets in the 2nd, 3rd, 4th, 10th, 11th, and 12th houses/signs from a planet are temporary friends (offsets 1, 2, 3, 9, 10, 11).
   * Planets in the 1st, 5th, 6th, 7th, 8th, 9th (offsets 0, 4, 5, 6, 7, 8) are temporary enemies.
3. **Five-fold Compound Relationships (Panchadha Maitri)** (`house._get_compound_relationships_of_planets`):
   * Combines Natural + Temporary:
     * Natural Friend + Temp Friend = **Adhi Mitra (Great Friend)** (score 4 / 5)
     * Natural Friend + Temp Enemy = **Neutral (Sama)** (score 2 / 3)
     * Natural Neutral + Temp Friend = **Mitra (Friend)** (score 3 / 4)
     * Natural Neutral + Temp Enemy = **Satru (Enemy)** (score 1 / 2)
     * Natural Enemy + Temp Enemy = **Adhi Satru (Great Enemy)** (score 0 / 1)
4. **Resolution of Chofu Reference Dignity Observation**:
   * In the Chofu reference chart, Saturn is in Pisces. The sign lord of Pisces is Jupiter.
   * Natural relationship: Saturn to Jupiter is **Neutral**.
   * Chart positions: Saturn is in Pisces (House 1); Jupiter is in Cancer (House 5, an offset of 4 signs).
   * Temporary relationship: Offset 4 is in `temporary_enemy_raasi_positions` `[0,4,5,6,7,8]`. Thus, Jupiter is a **Temporary Enemy** to Saturn.
   * Compound calculation: Natural Neutral + Temporary Enemy = **Enemy** (`"Enemy"`).
   * **Conclusion:** The reference JSON's assignment of `"Enemy"` to Saturn in Pisces is **proven** to result from five-fold compound friendship (Panchadha Maitri), NOT simple natural friendship.

### 3. Closure Recommendation for S-01
**RECOMMENDATION:** 
* `DIGNITY` (Block 13 / Block 4) must use **five-fold compound friendship (Panchadha Maitri)** when calculating planetary dignity in Rashi and Navamsha signs (Exalted, Own, Moolatrikona, Grt.Friend, Friend, Neutral, Enemy, Grt.Enemy, Debilitated).
* Note: Top-level `DRF` in CPS (§9.2) evaluates primary MD/AD relationships using the **Natural Friendship Table** as explicitly specified in contract §9.2.
* Gate S-01 is ready for formal operator sign-off to mark **CLOSED**.

---

## D. S-02 Evidence — Combustion Indexing Audit

### 1. PyJHora Source Code Inspection

Files inspected in PyJHora at pinned commit `48e57d29b47a3143519910a24866758116467485`:
* `src/jhora/const.py` (lines 635–636)
* `src/jhora/horoscope/chart/charts.py` (lines 1801–1818, function `planets_in_combustion`)

### 2. Source Code Evidence

In `const.py:635-636`:
```python
combustion_range_of_planets_from_sun = [12,17,14,10,11,15] #moon,mars,mercury,jupiter,venus,saturn
combustion_range_of_planets_from_sun_while_in_retrogade = [12,8,12,11,8,16] # [12,17,12,8,11,15] #moon,mars,mercury,jupiter,venus,saturn
```

In `charts.py:1801-1818`:
```python
def planets_in_combustion(planet_positions,use_absolute_longitude=True):
    retrograde_planets = planets_in_retrograde(planet_positions) 
    sun_long = planet_positions[1][1][0]*30+planet_positions[1][1][1] if use_absolute_longitude else planet_positions[1][1][1]
    combustion_planets = []
    for p,(h,h_long) in planet_positions[const.MOON_ID+1:const._pp_count_upto_saturn]: # Exclude Lagna, Sun, Rahu and Ketu
        p_long = h*30+h_long if use_absolute_longitude else h_long
        combustion_range = const.combustion_range_of_planets_from_sun
        if p in retrograde_planets: 
            combustion_range = const.combustion_range_of_planets_from_sun_while_in_retrogade
        if p_long >= sun_long-combustion_range[p-2] and p_long <= sun_long+combustion_range[p-2]:
            combustion_planets.append(p)
    return combustion_planets
```

### 3. Detailed Indexing & Offset Mapping

1. **Loop bounds:**
   `planet_positions[const.MOON_ID+1 : const._pp_count_upto_saturn]`
   * `const.MOON_ID = 1`. Thus `const.MOON_ID + 1 = 2`.
   * `const._pp_count_upto_saturn = 8`.
   * Range of `p`: `2, 3, 4, 5, 6, 7` (PyJHora IDs for Mars=2, Mercury=3, Jupiter=4, Venus=5, Saturn=6).
   * Note: The loop comment `# Exclude Lagna, Sun, Rahu and Ketu` is accurate, but it **also excludes Moon** (Moon ID is 1; slicing starts at index 2 = Mars). Moon is NOT checked for combustion in `planets_in_combustion`!
2. **Array index used:** `combustion_range[p - 2]`
   * For Mars (`p = 2`): index is `2 - 2 = 0`.
   * For Mercury (`p = 3`): index is `3 - 2 = 1`.
   * For Jupiter (`p = 4`): index is `4 - 2 = 2`.
   * For Venus (`p = 5`): index is `5 - 2 = 3`.
   * For Saturn (`p = 6`): index is `6 - 2 = 4`.

### 4. Critical Defect Discovered in PyJHora Implementation

Examining the array indexing against the array definition reveals a fatal indexing bug in PyJHora:
* The array in `const.py:635` has 6 elements:
  `[12, 17, 14, 10, 11, 15]` with comment `#moon,mars,mercury,jupiter,venus,saturn`.
* The author placed Moon at index 0 (`12°`), Mars at index 1 (`17°`), Mercury at index 2 (`14°`), Jupiter at index 3 (`10°`), Venus at index 4 (`11°`), Saturn at index 5 (`15°`).
* **However**, the consumer code in `charts.py:1815` accesses `combustion_range[p - 2]`:
  * Mars (`p=2`) accesses index 0 → gets `12` (the Moon's value)!
  * Mercury (`p=3`) accesses index 1 → gets `17` (Mars's value)!
  * Jupiter (`p=4`) accesses index 2 → gets `14` (Mercury's value)!
  * Venus (`p=5`) accesses index 3 → gets `10` (Jupiter's value)!
  * Saturn (`p=6`) accesses index 4 → gets `11` (Venus's value)!
  * Index 5 (`15`, intended for Saturn) is **never accessed**!

### 5. DSSME Canonical Specification Comparison

DSSME Contract v1.6 (§3.1 Rule 5) explicitly specifies:
* **Moon:** 12°
* **Mars:** 17°
* **Mercury:** 14° direct / 13° retrograde
* **Jupiter:** 11°
* **Venus:** 10° direct / 8° retrograde
* **Saturn:** 15°
* **Severity classification:**
  * Outer 50% of threshold = Mild
  * Inner 50% of threshold = Severe
* **Angular separation formula:**
  * Must be geodesic angular separation: `abs(wrapSigned(planet_lon - sun_lon))` (circular-safe).

### 6. Closure Recommendation for S-02
**RECOMMENDATION:**
* Do **NOT** copy PyJHora's broken off-by-one consumer indexing (`p - 2`).
* Strictly enforce the **DSSME Master Contract §3.1 Rule 5** classical combustion limits:
  * Moon: 12°
  * Mars: 17° (direct & retro)
  * Mercury: 14° direct / 13° retro
  * Jupiter: 11° (direct & retro)
  * Venus: 10° direct / 8° retro
  * Saturn: 15° (direct & retro)
* Use circular-safe distance: `sep = abs(wrapSigned(planet_lon - sun_lon))`.
* Gate S-02 is ready for formal operator sign-off to mark **CLOSED**.

---

## E. T-09 Evidence — Panchanga Flag Semantics (`±1 tithi`)

### 1. Specification Wording
* Contract v1.6 (§3.1 Rule 8):
  * `amavasya_zone` — Tithi is Amavasya (Krishna 15/30) ±1 tithi.
  * `purnima_zone` — Tithi is Purnima (Shukla 15) ±1 tithi.

### 2. Candidate Interpretations

* **Candidate A (Discrete Tithi Indices, 1-indexed 1..30):**
  * Tithi index `30` is Amavasya. `30 ± 1` ⇒ Tithis **29** (Krishna Chaturdashi), **30** (Amavasya), and **1** (Shukla Pratipada).
  * Tithi index `15` is Purnima. `15 ± 1` ⇒ Tithis **14** (Shukla Chaturdashi), **15** (Purnima), and **16** (Krishna Pratipada).
* **Candidate B (Continuous Elongation Angle Bracket):**
  * Each tithi is exactly 12° elongation.
  * `amavasya_zone`: Elongation within `[348°, 360°)` or `[0°, 12°]` (i.e. distance to 0°/360° ≤ 12°).
  * `purnima_zone`: Elongation within `[168°, 192°]` (i.e. distance to 180° ≤ 12°).

### 3. Consistency Analysis
* Notice that Candidate A and Candidate B are **mathematically equivalent**:
  * Tithi 29 starts at 336° elongation; Tithi 30 runs 348°–360°; Tithi 1 runs 0°–12°.
  * Tithi 14 runs 156°–168°; Tithi 15 runs 168°–180°; Tithi 16 runs 180°–192°.
* Evaluating via `tithi.index` (from Phase 2 `computeTithi`):
  * `amavasya_zone = (tithiIndex === 29 || tithiIndex === 30 || tithiIndex === 1)`
  * `purnima_zone = (tithiIndex === 14 || tithiIndex === 15 || tithiIndex === 16)`
* This discrete evaluation directly reuses the frozen Phase 2 `PanchangaResult.tithi.index` without redundant angle re-derivation.

### 4. Closure Recommendation for T-09
**RECOMMENDATION:**
* Define `amavasya_zone` as `tithiIndex ∈ {29, 30, 1}`.
* Define `purnima_zone` as `tithiIndex ∈ {14, 15, 16}`.
* Gate T-09 is ready for formal operator sign-off to mark **CLOSED**.

---

## F. Unresolved PyJHora Items (Preserved Audit Log)

The following items remain unresolved and are explicitly barred from being used as golden references:
1. **Live Numerical Parity:** No live runtime execution of PyJHora has been performed or benchmarked.
2. **Chofu Reference JSON Planetary Longitudes:**
   * Discrepancies of +0.26° to +0.50° on 6 classical planets (Sun, Mars, Mercury, Jupiter, Venus, Saturn) vs Swiss Ephemeris Moshier Lahiri at identical JD `2461299.909722222`.
   * Must remain classified as structural-only reference; never a numerical golden.
3. **Ashtakavarga / SAV Lagna Row:**
   * The Chofu reference JSON records a non-integer Lagna BAV row sum (`48.2`). Standard Parashara Ashtakavarga uses integer bindu matrices.
4. **Shadbala Minimums:**
   * Classical DSSME specifies Sun minimum 390 virupas (6.5 rupas); PyJHora `const.py:1379` specifies 300 virupas (5 rupas).

---

## G. Governance Invariant: PyJHora Oracle vs Contract Authority

The following architectural governance rule is permanently frozen for Phase 3 and all subsequent phases:

> **PyJHora Oracle Authority Invariant:**  
> PyJHora source code serves as an authoritative technical reference for algorithms, classical mapping rules, and structural behaviors, but is **NOT an unconditional implementation oracle**.  
> When a verified source-level PyJHora defect or indexing bug (such as the `combustion_range[p - 2]` off-by-one error identified in §D) conflicts with an explicit, classical requirement of the **DSSME Master Contract**, the **DSSME Master Contract strictly governs**.  
> The divergence must be recorded in this audit log and preserved as an explicit **PyJHora Compatibility Exception** in engine test suites and documentation.

---

## H. Operator Sign-Off Decision Package

The four gates are structured for formal operator sign-off:

| Gate | Scope | Concrete Governance Decision | Sign-off Status |
|---|---|---|---|
| **S-08** | Identity & Contract Literals | Standardize to `"V3.0"`, `"9-body"`, `"DD-MM-YYYY"`, coordinate format `"XX.XXN"` / `"XX.XXE"`, and degree `formatDms` (`"XX°XX'XX\""`). | `[AWAITING SIGN-OFF]` |
| **S-01** | Planetary Dignity Model | Use **Panchadha Maitri (5-fold compound friendship)** for Rashi and Navamsha dignity calculation (`Exalted`, `Own`, `Moolatrikona`, `Grt.Friend`, `Friend`, `Neutral`, `Enemy`, `Grt.Enemy`, `Debilitated`), matching Parashara rules and Chofu reference evidence. Top-level `DRF` (§9.2) retains the classical Natural Friendship table. | `[AWAITING SIGN-OFF]` |
| **S-02** | Combustion Calculation | Reject PyJHora off-by-one consumer indexing defect. Strictly implement **DSSME Master Contract §3.1 Rule 5** thresholds (Moon: 12°, Mars: 17°, Mercury: 14° dir / 13° retro, Jupiter: 11°, Venus: 10° dir / 8° retro, Saturn: 15°) with geodesic circular-safe angular separation (`abs(wrapSigned(lon_diff))`). | `[AWAITING SIGN-OFF]` |
| **T-09** | Panchanga Zone Flags | Define `amavasya_zone` as discrete tithi indices `{29, 30, 1}` and `purnima_zone` as `{14, 15, 16}` based on Phase 2 `PanchangaResult.tithi.index`. | `[AWAITING SIGN-OFF]` |

---

## I. Checkpoint 2 Readiness Determination

```text
STATUS: NOT READY — AWAITING OPERATOR GATE SIGN-OFF
```

**Reason:**  
Evidence and technical resolutions for all four gates (**S-08, S-01, S-02, T-09**) are established and packaged above. In strict compliance with governance rules:
- No Phase 3 Checkpoint 2 production code has been authored or altered.
- Checkpoint 1 remains accepted in its partial Level 1 scope.
- Checkpoint 2 authorization remains **HELD** until the operator explicitly returns the 4-gate approval.
