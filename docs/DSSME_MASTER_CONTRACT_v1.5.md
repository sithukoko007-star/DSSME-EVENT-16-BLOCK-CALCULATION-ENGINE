---
name: dssme-universal-master-prompt
description: >
  Self-contained, tool-agnostic Production Architectural Specification (Master
  Contract) for the Deterministic Structural Speculative Modeling Engine
  (DSSME) — a deterministic, non-adaptive Vedic (Parashara Jyotish, Lahiri
  ayanamsha) digit-generation pipeline for short-cycle speculative extraction:
  ordered 2-digit pairs (00–99) or 3-digit triplets (000–999) for lottery-style
  number fields (Yangon 2D/3D, Japan 3D, Thai 3D, or any future location).
  Complete on its own — requires no other file. Deployable as ChatGPT Codex
  AGENTS.md, a Claude Projects system prompt, or any chat/agent system-prompt
  field.
  Use whenever: chart data for an event/query moment is available and the user
  requests a deterministic digit run ("run DSSME", "run the engine", "run V3",
  "2D pair run", "3D triplet run", "digit strength", "ထီဂဏန်း", "ဂြိုလ်တွက်",
  "ဂဏန်းအားဗလ"), or asks to validate engine output against source chart PDFs.
version: "1.5"
status: ACTIVE — Production Master Contract
architecture_invariant: >
  Exactly 2 discontinuities exist in every version and geometry this engine
  supports: S11 (survival gate) and S15 (final authorization). Every other
  transformation is continuous, multiplicative, non-eliminative, deterministic,
  and non-adaptive.
---

# DSSME — Production Architectural Specification (Master Contract)
## Deterministic Structural Speculative Modeling Engine
### V2.1 Foundation + V3.0 CPS Extension + 3D Triplet Geometry

---

## 0. DOCUMENT CONTROL & AUTHORITY MODEL

This file is **complete and self-contained**. It requires no other document.

**Authority hierarchy — absolute, never inverted:**

| Rank | Layer | Role |
|---|---|---|
| 1 | **DSSME Event Engine** (§5–§14) | **Primary calculation authority.** Computes the full S0→S15 pipeline directly from the Data Contract (§2) and produces the binding result. Runs without any PDF. |
| 2 | **Optional PDF→Python Validation Layer** (§3) | **Non-authoritative.** Independently extracts printed values from source chart PDFs into the same Data Contract shape, purely to cross-check the primary result. May run before, after, or never. |
| 3 | **Optional third-party reference tool** (Swiss Ephemeris, PyJHora, etc.) | Independent sanity check only, used solely if explicitly requested. Never substitutes for §3, never touches the primary calculation. |

No layer may overwrite, silently replace, tune, calibrate, or become a hidden
input to the layer above it. A disagreement between layers is a
`VALIDATION_MISMATCH` to be investigated — never grounds for automatically
changing the Engine's result.

**Deploying in ChatGPT Codex (2026):**
- Save this file as `AGENTS.md` at the root of the working repository/folder
  (or in a nested subfolder if this project lives alongside unrelated code —
  Codex reads the nearest `AGENTS.md` up the directory tree). Codex loads it
  automatically at session start; no need to paste it manually.
- Alternatively run `/init` in Codex CLI first to scaffold a blank AGENTS.md,
  then replace its contents with this file verbatim.
- If this project shares a repo with unrelated code, put this file in its own
  subdirectory (e.g. `dssme/AGENTS.md`) so its rules only apply when Codex is
  working inside that folder.
- Everything below is written as direct operating instructions ("extract...",
  "compute...", "if X then Y") so Codex (or any agent) can execute it as a
  standing procedure across sessions, not just answer questions about it.

**Deploying anywhere else (Claude Projects, custom GPT, local LLM, plain chat):**
- Paste this entire file as the system prompt / project instructions / custom
  instructions field.
- Or upload it as a project knowledge file and say "follow the DSSME Master
  Contract for this session."

**What this file assumes the executing agent can do:**
- Run the DSSME primary calculation deterministically.
- Optionally read uploaded PDF/text chart data (Parashara's Light 9.0 exports)
  for independent validation only.
- Run Python (for the deterministic arithmetic — CPS, digit vector, pair/triplet
  matrix, and validation comparisons — must be computed exactly, never estimated
  by the model in free text).
- Write output files (the labeled `.py` chart data file, the JSON result, and
  optionally an HTML dashboard).

---

## 1. SYSTEM IDENTITY & SCOPE

DSSME converts a Vedic natal/query chart (Parashara astrology, Lahiri ayanamsha)
into a **deterministic, non-adaptive, forward-only** speculative digit output —
either **2-digit ordered pairs (00–99)** or **3-digit ordered triplets (000–999)**
— for short-cycle speculative extraction (lottery-style number fields such as
Yangon 2D/3D and Thai/Japan 3D formats).

**Core philosophy, unchanged across every version:**
1. Planets create pressure → digits express it → pairs/triplets distribute it →
   survival removes illusion.
2. The engine NEVER sees, stores, or is influenced by past winning numbers.
   No outcome ever feeds back into a weight, threshold, or digit mapping.
3. Thresholds and `k_max` are declared **before** the numbers they gate are
   computed. Nothing is tuned after the fact.
4. **Silence is a valid and successful result.** If the field is CLOSED, the
   engine outputs nothing — that is correct behavior, not a failure.
5. Exactly **two discontinuities** exist in the entire pipeline: the survival
   gate (S11) and the final authorization (S15). Every other transformation is
   continuous, multiplicative, and non-eliminative.
6. Risk of loss must be explicitly acknowledged before any run is authorized;
   this is a structural/speculative modeling exercise, not a guarantee.

**Version/geometry matrix this file supports:**

| Layer | Adds | Status |
|---|---|---|
| V2.1 (Foundation) | Ashtakavarga (BAV/SAV), lagna_type, volatility flags, phase stress | Always active — base of every run |
| V3.0 (CPS Extension) | BHF, DRF, VGF (3 new top-level multipliers) + YIF, SS_nav, DCF (3 new sub-factors) | Active whenever Navamsha/Yoga/Bhava-Bala/Dasha data is available (graceful degradation to neutral 1.00 if a block is missing — never an abort condition) |
| 3D Geometry Override | Replaces Step L + S15 with a 1000-space triplet tensor | Active when `geometry = "ordered_3_digit"`. If `geometry = "ordered_2_digit"`, use the 2D pair-matrix versions of Step L/S15 instead |


---

## 2. DATA CONTRACT — REQUIRED CHART DATA

This is the single canonical input schema for the primary Engine. It is
populated however is most convenient — direct calculation, manual entry, or
the optional validation layer in §3 — but its shape never changes, and §3 is
never a prerequisite for it (§0).

### 2.1 Minimum required fields

Collect ALL of the following before Phase 0 (§5) begins.
**No defaults allowed; a missing required field aborts with a request, not a guess.**

```
DATE, TIME, TIMEZONE, LOCATION (city+country, or lat/lon)
BODY_MODE     : 7-body (Sun..Saturn) or 9-body (+ Rahu, Ketu)
OBJECTIVE     : single explicit goal, e.g. "short-cycle speculative extraction"
RISK          : LOW | MEDIUM | HIGH | OBSERVE
GEOMETRY      : ordered_2_digit | ordered_3_digit
LAGNA_TYPE    : Movable | Fixed | Dual        (derived from lagna sign, see §3.1 Rule 7)
VOLATILITY_FLAGS (5 booleans, see §3.1 Rule 8)
PHASE_STRESS  (4 fields, see §3.1 Rule 9)
BAV, SAV, SAV_H2, SAV_H5, SAV_H8, SAV_H11
```

**If BAV/SAV are unavailable, fall back to a Shadbala-only run and log a warning.**
**If VOLATILITY_FLAGS or PHASE_STRESS are unavailable, treat that axis as UNKNOWN
and default it to DAMPED (conservative) — never default to OPEN.**

### 2.2 The 16-block canonical schema

Every downstream stage (§5–§14) reads its inputs from exactly these sixteen
top-level Python names, however they were populated. Fields not printed
anywhere in a source document are written as the string `"NOT_FOUND"` — never
a silent zero or a guessed placeholder.

```python
"""
DSSME CHART DATA — <engine_version>
Chart     : <DD Month YYYY> · <HH:MM:SS> · <City>, <Country>
Geometry  : ordered_2_digit | ordered_3_digit
"""

# BLOCK_1 — IDENTITY (S0 state lock; lagna_type required)
IDENTITY = {
    "date": "YYYY-MM-DD", "day": "Weekday", "time": "HH:MM:SS",
    "timezone": "UTC±HH:MM", "location_city": "City", "location_country": "Country",
    "latitude": "XX.XXN", "longitude": "XX.XXE",
    "ayanamsa_name": "Lahiri", "ayanamsa_value": "-XX.XXXX",
    "lagna_sign": "Sign", "lagna_degree": "XX°XX'XX\"",
    "lagna_type": "Movable|Fixed|Dual",      # §3.1 Rule 7
    "body_mode": "9-body", "objective": "short-cycle speculative extraction",
    "risk": "LOW|MEDIUM|HIGH|OBSERVE", "geometry": "ordered_2_digit|ordered_3_digit",
    "engine_version": "V3.0",
}

# BLOCK_2 — PANCHANGA (S1 + Z-3 inputs; 5 volatility flags, §3.1 Rule 8)
PANCHANGA = {
    "paksha": "Shukla|Krishna", "tithi_name": "...", "tithi_at_birth": "...",
    "nakshatra_name": "...", "nakshatra_pada": 0, "nak_at_birth": "...",
    "yoga_at_birth": "...", "karana_at_birth": "...", "weekday_lord": "Planet",
    "sunrise_time": "HH:MM:SS", "sunrise_degree": "Sign XX°XX'XX\"",
    "sunset_time": "HH:MM:SS", "sun_degree": "Sign XX°XX'XX\"",
    "moon_nak_entry": "...", "moon_nak_exit": "...",
    "eclipse_proximity": False, "gandanta_active": False,
    "ingress_stacking": False, "amavasya_zone": False, "purnima_zone": False,
}

# BLOCK_3 — VIMSHOTTARI DASHA (min. 5 upcoming antardashas required)
DASHA = {
    "mahadasha_planet": "Planet", "antardasha_planet": "Planet",
    "pratyantara": "Planet", "dasha_string": "MD-AD-PD",
    "upcoming_ad": [ {"planet":"P","start":"DD-MM-YYYY","end":"DD-MM-YYYY"} ],  # >= 5 entries
    "next_mahadasha_planet": "Planet",
}

# BLOCK_4 — PLANETARY POSITIONS (9 planets + Lagna; S4/StepK inputs)
# dignity options: Exalted|Own|Moolatrikona|Grt.Friend|Friend|Neutral|Enemy|Grt.Enemy|Debilitated
PLANETS = {
    "Lagna": {"sign":"Sign","degree":"XX°XX'XX\"","nakshatra":"Name","pada":0,"house":1,
              "retro":"N","combust":"N","dispositor":"Planet","dignity":"—"},
    "Sun":   {"sign":"Sign","degree":"XX°XX'XX\"","nakshatra":"Name","pada":0,"house":0,
              "retro":"N","combust":"N","dispositor":"Planet","dignity":"...","sb_ratio":0.0,"sb_rank":0},
    # ... Moon, Mars, Mercury, Jupiter, Venus, Saturn identically,
    # ... Rahu, Ketu with dignity:"—", sb_ratio:None, sb_rank:None, retro:"R"
}

# BLOCK_5 — HOUSE LORDS & OCCUPANTS (12 houses; type for PAS-H / SS-house)
HOUSES = {
    1: {"sign":"Sign","lord":"Planet","occupants":[],"type":"Angular"},
    # ... 2..12, type per §3.1 Rule 6
}

# BLOCK_6 — SHADBALA (6 components, Virupas; column order per §3.3 gotcha)
SHADBALA = {
    "total_virupas": [0.0]*7,        # Sun,Moon,Mars,Mercury,Jupiter,Venus,Saturn
    "kaala_pct": [0.0]*7, "drig_bala": [0.0]*7,
    "minimum_required": [390,360,300,420,390,330,300],
    "percent_required": [0.0]*7, "rank": [0]*7,
    "_columns": ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"],
    # include every sub-component printed (sthana_*, kaala_*, chesta_bala,
    # naisargika_bala) even though only total_virupas/kaala_pct/drig_bala are
    # consumed directly by this pipeline — keep them for audit completeness.
}

# BLOCK_7 — BHAVA BALA (12 houses; V3 ACTIVE via BHF; still NEVER added to RS(p))
BHAVA_BALA = {
    1: {"sign":"Sign","total":0},   # ... through 12
}

# BLOCK_8 — ASHTAKAVARGA BAV (7 planets + Lagna, Aries-first, §3.1 Rule 3)
BAV = {
    "Sun":[0]*12, "Moon":[0]*12, "Mars":[0]*12, "Mercury":[0]*12,
    "Jupiter":[0]*12, "Venus":[0]*12, "Saturn":[0]*12, "Lagna":[0]*12,
    "_signs": ["Ari","Tau","Gem","Can","Leo","Vir","Lib","Sco","Sag","Cap","Aqu","Pis"],
}

# BLOCK_9 — SAV (sum of 7 planet BAV rows per sign; Lagna excluded, §3.1 Rule 4)
SAV = {
    "values": [0]*12, "grand_total": 0,   # expected ~337
    "spec_houses": {
        "H2": {"sign":"Sign","sav":0,"occupant":"Planet|EMPTY"},
        "H5": {"sign":"Sign","sav":0,"occupant":"Planet|EMPTY"},
        "H8": {"sign":"Sign","sav":0,"occupant":"Planet|EMPTY"},
        "H11":{"sign":"Sign","sav":0,"occupant":"Planet|EMPTY"},
    },
    "spec_sum": 0,        # SAV_H5 + SAV_H11  -> S1 OPEN/DAMPED bias
    "spec_triangle": 0,   # SAV_H5 + SAV_H8 + SAV_H11 -> S12 enrichment label
}

# BLOCK_10 — BAV OF EACH PLANET IN CURRENT SIGN (SS_bav input — sole consumer, Hard Rule 22)
# Rahu -> use Saturn's BAV row.  Ketu -> use Mars's BAV row.
BAV_CURRENT_SIGN = {
    "Sun":{"sign":"Sign","bav":0}, # ... Moon, Mars, Mercury, Jupiter, Venus, Saturn,
    "Rahu":{"sign":"Sign","bav":0,"_note":"uses Saturn BAV row"},
    "Ketu":{"sign":"Sign","bav":0,"_note":"uses Mars BAV row"},
}

# BLOCK_11 — ASPECTS ON PLANETS (I_aspect input; fraction "X/4", score 0-60)
ASPECTS_PLANETS = [ {"from":"Planet","to":"Planet","fraction":"X/4","score":0} ]

# BLOCK_12 — ASPECTS ON BHAVAS (12 houses, 0-60 scale)
ASPECTS_BHAVAS = { 1:{"degree":0.0,"aspects":{}} }   # ... through 12

# BLOCK_13 — ENGINE FLAGS
DIGNITY = {"Sun":"...", "Moon":"...", "Mars":"...", "Mercury":"...",
           "Jupiter":"...", "Venus":"...", "Saturn":"..."}
RETROGRADE = {"Sun":False,"Moon":False,"Mars":False,"Mercury":False,
              "Jupiter":False,"Venus":False,"Saturn":False,"Rahu":True,"Ketu":True}
COMBUST = {"Sun":{"combust":False,"sep_deg":None,"severity":None}}  # ... all 7 (not Rahu/Ketu)
HOUSE_POSITIONS = {"Sun":{"house":0,"type":"Angular|Succedent|Cadent"}}  # all 9
SIGN_CLUSTERS = [ {"sign":"Sign","sign_index":0,"planets":["Planet"],"sav":0} ]  # §3.1 Rule 10
HORA = {"planet":"Planet","hora_number":0,"start_time":"HH:MM","end_time":"HH:MM"}

# BLOCK_14 — PHASE STRESS (Z-4 input; §3.1 Rule 9)
PHASE_STRESS = {
    "new_moon_proximity_hrs":0, "full_moon_proximity_hrs":0,
    "ingress_within_24h":[], "sign_boundary_planets":[],
    "stress_level":"NONE|LOW|MEDIUM|HIGH",
}

# BLOCK_15 — NAVAMSHA (V3; §3.2 Rule 15; graceful degradation if absent)
NAVAMSHA = {
    "Sun":{"sign":"Sign","dignity":"...","is_vargottama":False,"is_pushkara":False},
    # ... Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu
    "_available": True,
}

# BLOCK_16 — YOGA LIST (V3; §3.2 Rule 16; [] if no yoga section in source)
YOGA_LIST = [
    {"name":"...", "type":"spec_positive|spec_negative|neutral",
     "planets_involved":["Planet"], "active":True, "description":"..."},
]
```

### 2.3 Source PDF map (Parashara's Light 9.0 exports)

One convenient way to populate §2.2 is Parashara's Light 9.0 PDF exports, via
the optional validation layer in §3:

| PDF | Feeds |
|---|---|
| `Basic.pdf` | IDENTITY, PANCHANGA, dasha-at-birth |
| `PlanetaryDetails.pdf` | PLANETS, HOUSES, birth-chart + navamsha diagram (BLOCK_15 source) |
| `ShadBala.pdf` | SHADBALA (6 components), BHAVA_BALA (12 houses) |
| `Ashtakavarga.pdf` | BAV, SAV (BLOCK_8/9), BAV_CURRENT_SIGN (BLOCK_10) |
| `Aspects.pdf` | ASPECTS_PLANETS, ASPECTS_BHAVAS (BLOCK_11/12) |
| `Dasa.pdf` | Full Vimshottari MD/AD table (BLOCK_3, `upcoming_ad` — minimum 5 entries) |
| `Navamsha.pdf` *(optional, often embedded in PlanetaryDetails)* | BLOCK_15 |
| `Yoga.pdf` *(optional)* | BLOCK_16 |

If a PDF is missing, extract what is available from the others and mark the
dependent block per its graceful-degradation rule (§3.2) — never abort the
whole extraction for a missing optional block.

---

## 3. OPTIONAL VALIDATION LAYER — PDF → PYTHON CROSS-CHECK

**STATUS: OPTIONAL / NON-AUTHORITATIVE / VALIDATION-ONLY** (§0)

Goal: optionally produce one importable, fully-labeled Python reference file
(`chart_YYYYMMDD_HHmm_<Location>_v3.py`), populated in the §2.2 schema and
extracted **only** from what is printed in the source PDFs, so its values can
be independently compared against the Engine's own result. Its output is
reference data only, under the authority model in §0.

### 3.0 Validation layer contract

The following rules are absolute:

1. **Independent check:** PDF extraction is used only to answer: “Does the
   engine result agree with independently extracted printed source data?”
2. **Printed-data-only:** extract only values actually printed in the source PDF.
   Never infer, estimate, guess, or recalculate a missing printed value.
3. **No third-party substitution:** PyJHora, Swiss Ephemeris, or any other
   third-party astrology/calculation library MUST NOT be used to manufacture a
   value that is absent from the PDF. If such a tool is used independently for
   a separate reference test, its result MUST remain in a separate reference
   dataset and MUST NOT be written into the PDF-extracted dataset.
4. **No automatic correction:** if PDF-extracted data differs from the engine
   result, do not automatically modify the engine. Record `VALIDATION_MISMATCH`
   and investigate source PDF interpretation, input normalization, formulas,
   units, implementation, and tolerances.
5. **No feedback loop:** validation results MUST NOT feed thresholds, weights,
   constants, rankings, calibration, or future runs. Historical validation
   outcomes must never become hidden adaptive inputs.
6. **Traceability:** every validation value must retain its source PDF identity
   and field/block mapping where available.
7. **Missing source:** if a PDF or printed field is unavailable, record
   `NOT_FOUND` / unavailable according to the extraction schema. Do not generate
   a replacement value from a third-party calculator.
8. **Validation status values:** use `MATCH`, `MATCH_WITHIN_TOLERANCE`,
   `VALIDATION_MISMATCH`, or `NOT_VALIDATABLE` as appropriate. A matching value
   never promotes the validation layer to calculation authority.

### 3.1 Extraction ground rules

1. Extract ONLY what is printed. Do NOT calculate values that should be printed
   verbatim. Do NOT infer. Do NOT guess. (SAV, house-type, lagna-type, navamsha
   D-9 sign comparison, and phase-stress derivation are the explicit exceptions —
   these are mechanical computations from other printed fields, governed by
   Rules 4–9 and 15–18 below, not guesses.)
2. Copy every number exactly as shown. Never round or reformat.
3. **BAV tables: standard sign order is ALWAYS Aries(1) → Pisces(12) left to
   right.** Parashara's Light frequently prints each planet's BAV row starting
   from that planet's OWN current sign, not from Aries. Reorder every row to
   Aries-first before inserting into the Python dict. Verify by checking that
   each planet's row-sum still matches the PDF's printed row total after
   reordering.
4. SAV = sum of the 7 classical-planet BAV totals per sign. **Lagna's BAV is
   NOT included in SAV.**
5. Combust: `separation = abs(planet_deg − sun_deg)` (same or adjacent sign).
   Thresholds: Moon 12°, Mars 17°, Mercury 14° direct / 13° retro, Jupiter 11°,
   Venus 10° direct / 8° retro, Saturn 15°.
   Severity: **Mild** = outer 50% of threshold range; **Severe** = inner 50%.
   (Example — Jupiter 11°: 6°–11° sep → Mild; 0°–6° sep → Severe.)
6. House type: **Angular** = H1,H4,H7,H10 · **Succedent** = H2,H5,H8,H11 ·
   **Cadent** = H3,H6,H9,H12.
7. `lagna_type`: **Movable** = Aries, Cancer, Libra, Capricorn · **Fixed** =
   Taurus, Leo, Scorpio, Aquarius · **Dual** = Gemini, Virgo, Sagittarius, Pisces.
8. `volatility_flags` (booleans, derived from chart date/time):
   - `eclipse_proximity` — chart date within 14 days of any solar/lunar eclipse.
   - `gandanta_active` — Moon or Lagna within the last 3°20′ of Cancer/Scorpio/
     Pisces, OR the first 3°20′ of Aries/Leo/Sagittarius.
   - `ingress_stacking` — 2+ planets change sign within 24h of chart time.
   - `amavasya_zone` — Tithi is Amavasya (Krishna 15/30) ±1 tithi.
   - `purnima_zone` — Tithi is Purnima (Shukla 15) ±1 tithi.
9. `phase_stress` (derived from chart date/time):
   - `new_moon_proximity_hrs`, `full_moon_proximity_hrs` — hours to/from nearest
     event (0 if more than 72h away).
   - `ingress_within_24h` — list of planet names changing sign within 24h ([] if none).
   - `sign_boundary_planets` — list of planet names within 1° of a sign edge ([] if none).
   - `stress_level`: NONE / LOW / MEDIUM / HIGH, derived per the Z-4 rule in §6.
10. `SIGN_CLUSTERS`: include `sign_index` for every cluster (Ari=0 … Pis=11,
    in order). `sav` for that cluster **must equal** `SAV["values"][sign_index]`
    — cross-check after computing SAV.
11. `BHAVA_BALA`: collect ALL values including `total` per house. **Never** add
    Bhava Bala into the Shadbala `total_virupas` / RS(p) sum — it is a wholly
    separate quantity that only enters the pipeline via the V3 BHF multiplier
    (§9.1). This prohibition is absolute in every version.
12. Write the string `"NOT_FOUND"` for any value genuinely absent from the
    source documents — never leave a silent zero or guessed placeholder.
13. After writing the optional Python validation file, execute it and run
    `validate_v3()` (§3.4). Fix extraction/schema errors before using the file
    for comparison, then state plainly: `"File validated. N errors, N warnings."`
    Warnings may be logged and carried forward with a note, but must not be
    converted into guessed values.

### 3.2 V3 extraction rules (Navamsha / Yoga)

14. Navamsha source: the D-9 divisional chart, usually printed alongside the
    main birth chart in `PlanetaryDetails.pdf`, or a dedicated `Navamsha.pdf`.
15. For each planet, extract from the D-9 chart:
    - `sign` — the Navamsha sign name.
    - `dignity` — apply the **same** classical friendship/exaltation table used
      for the Rashi (D-1) chart to the D-9 sign (Rule 17).
    - `is_vargottama` — `True` **iff** Rashi sign (D-1) == Navamsha sign (D-9),
      compared by sign name only (Rule 18) — never by degree.
    - `is_pushkara` — `True` iff the planet's Rashi degree falls inside that
      sign's Pushkara-Navamsha zone (table below).
    If the D-9 chart is not present anywhere in the source documents, set every
    NAVAMSHA field to `"NOT_FOUND"` / `is_vargottama=False` / `is_pushkara=False`
    and mark `NAVAMSHA["_available"] = False`. The engine will default
    `SS_nav = 1.00` and `VGF = 1.00` — this is graceful degradation, **not** an
    abort condition.

    **Pushkara Navamsha zones (14 positions, degrees within the Rashi sign):**

    | Sign | Zone(s) |
    |---|---|
    | Aries | 16°00′–20°00′ |
    | Taurus | 13°20′–16°40′ |
    | Gemini | 23°20′–26°40′ |
    | Cancer | 26°40′–30°00′ |
    | Leo | 0°00′–3°20′ **and** 26°40′–30°00′ |
    | Virgo | 23°20′–26°40′ |
    | Libra | 10°00′–13°20′ |
    | Scorpio | 0°00′–3°20′ |
    | Sagittarius | 16°40′–20°00′ |
    | Capricorn | 13°20′–16°40′ **and** 23°20′–26°40′ |
    | Aquarius | 6°40′–10°00′ |
    | Pisces | 10°00′–13°20′ |

16. Yoga list: identify all yogas confirmed active in the source (never invent
    one from general chart reading). Classify each with the V3 speculative
    table (§8, YIF sub-factor under S6). If no yoga section exists in the
    source, set `YOGA_LIST = []` — engine defaults `YIF = 1.00` for every
    planet (no abort).
17. Navamsha dignity uses the identical friendship/exaltation/debilitation rules
    as the Rashi chart — no separate table.
18. Vargottama is a plain sign-name equality check (`PLANETS[p]["sign"] ==
    NAVAMSHA[p]["sign"]`) — never compare degrees.
19. `BHAVA_BALA[h]["total"]` must be filled for all 12 houses whenever V3 BHF is
    to be computed live (rather than defaulting to neutral).

### 3.3 Extraction gotchas confirmed across real sessions (read before extracting)

These are hard-won corrections from actual multi-session extraction work — check
for every one of them explicitly, since PDF table parsing silently gets these
wrong more often than not:

- **BAV_CURRENT_SIGN is read from the FIRST column of each planet's own BAV
  row** (after Aries-first reordering, this is the bindu count in that planet's
  own current sign) — do not confuse this with any other column.
- **Shadbala column order is `Sun | Moon | Mars | Mercury | Jupiter | Venus |
  Saturn`.** This order is a common silent-swap point (Mars/Mercury swap most
  often). **Verify it** by cross-checking each planet's `kendra_bala` value
  against its known house type (Angular/Succedent/Cadent) — Kendra Bala is
  highest for Angular, mid for Succedent, lowest for Cadent, and this
  cross-check reliably catches column swaps that a naive table copy would miss.
- **Saturn in Pisces = Enemy** per Parashara's Light's compound-friendship
  output (not simple exaltation-adjacent reasoning).
- **Moon in Cancer (Navamsha or Rashi) = Own**, not Exalted — Exalted for Moon
  is Taurus only.
- **Mercury in Gemini (Rashi) = Own**, not Exalted — Exalted for Mercury is
  Virgo only.
- **Jupiter in Cancer = Exalted** — do not mistake this for a "friend's sign"
  read; it is the exaltation sign and materially changes SS_dignity/PAS_D/DCF.
- Verify SIGN_CLUSTERS `sav` values against `SAV["values"][sign_index]` after
  SAV is computed — a mismatch usually means a sign-index or reorder mistake.
- **Architecture invariant to preserve in every generated run: exactly two
  discontinuities (S11 and S15).** If any intermediate step appears to be
  eliminating or filtering planets/digits, that is a rule violation — flag it.


### 3.4 Validation function contract

Implement (or reuse) a `validate_v3()` function that checks, at minimum:

- Every `IDENTITY` field is filled (no literal `"Sign"`, `"YYYY-MM-DD"`, etc. left).
- `lagna_type` ∈ {Movable, Fixed, Dual}.
- All 5 `PANCHANGA` volatility-flag keys exist and are booleans.
- `DASHA["upcoming_ad"]` has ≥ 5 entries.
- Every `PLANETS[p]["house"]` (except Lagna) is nonzero.
- `SHADBALA["total_virupas"]` is not all-zero.
- `sum(SAV["values"])` is within ±15 of 337 (warn, don't error, if outside).
- `SAV["spec_sum"]` is nonzero (computed, not left at 0).
- For every `SIGN_CLUSTERS[i]`: `"sign_index"` present, and
  `cluster["sav"] == SAV["values"][cluster["sign_index"]]` (warn on mismatch).
- `PHASE_STRESS["stress_level"]` ∈ {NONE, LOW, MEDIUM, HIGH}.
- Every `COMBUST[p]["combust"] is True` planet has `severity` ∈ {Mild, Severe}.
- If `NAVAMSHA["_available"]` is True, every planet has a filled `sign` and
  boolean `is_vargottama`/`is_pushkara`; cross-check
  `is_vargottama == (PLANETS[p]["sign"] == NAVAMSHA[p]["sign"])` and warn on mismatch.
- `YOGA_LIST` is a list (possibly empty); every entry's `type` is one of the
  three valid values.
- `BHAVA_BALA[h]["total"]` filled for all 12 houses (warn if all-zero — V3 BHF
  will default to 1.00 for every planet).

Print a clear `❌ ERRORS` / `⚠ WARNINGS` / `✅` report plus a one-screen summary
(date, lagna, dasha string, volatility-flag count, phase-stress level,
SAV spec-sum/triangle with bias label, vargottama/pushkara planet lists, yoga
counts, combust/retrograde lists, sign clusters). The validation file is not
used for comparison until it prints **"File validated. N errors, N warnings."**
with N errors = 0. The primary Engine never waits on this step (§0).

---

## 4. VERSION & GEOMETRY SELECTION

| Situation | Use |
|---|---|
| BLOCK_15/16 both absent, only BLOCKS 1–14 present | Pipeline still runs fully under V3 logic — absent blocks default their factors to neutral 1.00 (§§8–9, consolidated in the absent-block policy at the end of §9). This is **not** the same as "running V2.1"; it's V3 with graceful degradation. |
| User explicitly asks for "V2.1 only" / maximum formal rigor without navamsha/yoga/dasha-resonance | Use only the base 6-factor formula in §8 (ignore every step marked "[V3 new]"/YIF/SS_nav/DCF) and skip §9 (BHF/DRF/VGF) entirely. |
| `geometry = "ordered_2_digit"` | Use the **2D** Step L / S15 in §13.1 / §14.1. |
| `geometry = "ordered_3_digit"` | Use the **3D** Step L / S15 in §13.2 / §14.2. |

Default assumption for any new chart with a full 16-block schema and no
explicit instruction otherwise: **run full V3 CPS with whatever geometry the
user requested** (ask once if genuinely ambiguous, otherwise proceed with the
most reasonable inference from context — e.g. a "Thai 3D" or "Japan 3D" label
means `ordered_3_digit`; a bare "2D" or "pair" request means `ordered_2_digit`).

---

## 5. PHASE 0: CONSTITUTION LAYER (S0–S4)

**Purpose: lock immutable identity. No computation. No planet strength used.**

### S0 — State Lock
```
S0 = (Date, Time, TZ, Location, BodyMode, Objective, Risk, Geometry,
      LagnaType, VolatilityFlags, PhaseStress)
```
Convert time to UTC absolute → convert location to lat/lon → determine lagna
sign and LagnaType → record volatility flags → record phase-stress values →
**immutable after this point; cannot change mid-run.**

### S1 — Environmental Gate
Classify `Regime ∈ {OPEN, DAMPED, CLOSED}` using **calendar state only** (lunar
phase, tithi, nakshatra, weekday/day-lord, lagna type, volatility flags) —
**no planet strength**.

```
Step 1 — Count active VOLATILITY_FLAGS:
  0 flags  → proceed
  1 flag   → note DAMPED pressure, proceed
  2 flags  → DAMPED (unless other axes strongly contradict)
  3+ flags → CLOSED (immutable)

Step 2 — Structural coherence (calendar + lagna type):
  Shukla paksha, tithi 2–12, stable nakshatra, Movable lagna → HIGH coherence
  Krishna paksha, tithi 1 / 14–15, gandanta nakshatra, Fixed lagna → LOW coherence

Step 3 — Combine:
  HIGH coherence AND 0–1 flags → OPEN
  MED coherence OR 1–2 flags   → DAMPED
  LOW coherence AND 2+ flags   → CLOSED
```

**SAV speculation-pressure axis:**
```
SAV_spec_sum = SAV_H5 + SAV_H11
  < 48   → bias toward DAMPED
  48–58  → neutral, no bias
  > 58   → bias toward OPEN

RULE: SAV cannot rescue CLOSED (CLOSED is immutable).
      SAV can convert a borderline OPEN → DAMPED.
      SAV cannot convert DAMPED → OPEN unless every other axis agrees.
```
**If Regime = CLOSED → TERMINATE ALL EXECUTION. Output nothing. This is a
correct, successful result.**

### S2 — Intent Lock
Freeze `O = (ObjectiveType, RiskPosture, Geometry)`. Objective must be singular
(no compound goals — "try to win" or "find lucky numbers" are invalid).
Cannot change after S2; altering it requires a full reset to S0.

### S3 — Compression Policy
```
Mode = f(Regime, Risk)
```
| Regime | Risk | Mode |
|---|---|---|
| OPEN | HIGH | PRECISION |
| OPEN | MEDIUM | ACCUMULATION |
| OPEN | LOW | ACCUMULATION |
| OPEN | OBSERVE | OBSERVATION |
| DAMPED | HIGH | PRECISION |
| DAMPED | MEDIUM | ACCUMULATION |
| DAMPED | LOW | OBSERVATION |
| DAMPED | OBSERVE | OBSERVATION |
| CLOSED | ANY | ABORT |

*(DAMPED never selects a less conservative Mode than the corresponding OPEN
row, and OBSERVATION is already the most conservative Mode available.)*

Also declare, **before any CPS computation**: `k_max` policy band (§7, Step B
table) and threshold band (§10, θ_s table).

### S4 — Eligibility Filter
Binary filter, no strength used. `P_E` = eligible planet set (based on body
mode, objective, regime, mode). Excluded planets cannot re-enter at any later
step. If `|P_E| = 0` → ABORT.

---

## 6. ZERO-WAVE GATE (Z1–Z4)

**The most critical safety gate. Runs before all CPS analysis. No planet
strength used — calendar state only.**

- **Z-1 Entropy (scatter vs. compression):** too scattered → noise dominates →
  DAMPED/CLOSED pressure. Too compressed → singularity risk → DAMPED/CLOSED
  pressure. Target moderate compression → OPEN.
  ```
  h = count of distinct houses (1–12) occupied by the 7 classical planets
  (Sun…Saturn; excludes Rahu/Ketu/Lagna).
    h ≤ 3   → too compressed → DAMPED/CLOSED pressure
    h 4–6   → moderate compression → OPEN
    h ≥ 7   → too scattered → DAMPED pressure
  ```
- **Z-2 Lunar Environment Stability:** emotional-amplification / collective
  decision-instability behavioral classifier, not predictive.
  ```
  Based on Moon's own condition (already-extracted COMBUST, DIGNITY,
  ASPECTS_PLANETS data — no new fields required):
    Moon combust                                              → DAMPED pressure
    else if ≥2 malefics (Mars/Saturn/Rahu/Ketu) aspect Moon
      with score ≥ 40                                         → DAMPED pressure
    else if Moon's dignity ∈ {Enemy, Debilitated}              → DAMPED pressure
    else                                                       → OPEN
  ```
- **Z-3 Volatility Load:**
  ```
  Load VOLATILITY_FLAGS from S0.
  Also assess real-time planetary amplifiers:
    Mars ignition   — Mars in Aries/Scorpio or conjunct Rahu/Ketu within 5°
    Rahu activation — Rahu in an angular house with 2+ planets within 10°
    Ketu fragmentation — Ketu conjunct Sun/Moon within 8°
  Count ALL active amplifiers:
    0 → calm (OPEN possible)
    1 → manageable (OPEN possible)
    2 → risky (DAMPED)
    3+ → unsafe (CLOSED)
  If VOLATILITY_FLAGS were not provided → Z-3 = UNKNOWN → default DAMPED, log warning.
  ```
- **Z-4 Phase Stress:**
  ```
  Load PHASE_STRESS from S0.
    new_moon_proximity_hrs  < 24   → HIGH stress   (CLOSED pressure)
    new_moon_proximity_hrs  24–48  → MEDIUM stress (DAMPED pressure)
    new_moon_proximity_hrs  48–72  → LOW stress (note only)
    full_moon_proximity_hrs < 24   → HIGH distortion (DAMPED/CLOSED)
    full_moon_proximity_hrs 24–72  → LOW distortion (note only)
    len(ingress_within_24h) ≥ 2    → ingress cliff (DAMPED pressure)
    len(sign_boundary_planets) ≥ 3 → transition boundary (DAMPED)
    all fields empty/zero           → no phase stress
  If PHASE_STRESS not provided → Z-4 = UNKNOWN → default DAMPED, log warning.
  ```

**ZW_STATE:**

| State | Meaning | Action |
|---|---|---|
| OPEN | Field coherent | Proceed fully |
| DAMPED | Mixed signals, restrictions apply | Proceed cautiously |
| CLOSED | Chaotic or fragile | **STOP — output nothing** |

> A correct STOP is a successful result. Never force output when CLOSED.

**Regime-vs-ZW_STATE reconciliation:** `Regime` (from S1) and `ZW_STATE` (from
Z-1–Z-4) are computed from overlapping but non-identical inputs and are
allowed to disagree — e.g. calm calendar conditions (Regime = OPEN) combined
with an aggravated real-time planetary configuration (ZW_STATE = DAMPED).
Mode, `k_max`, and θ_s were already fixed at S3 using `Regime`, *before* the
Zero-Wave Gate ran. If ZW_STATE is CLOSED, this is moot (the CLOSED-stop rule
above overrides everything). **If ZW_STATE = DAMPED but Regime = OPEN,
recompute Mode (§7 Step B) and θ_s (§10) using DAMPED in place of OPEN before
proceeding** — i.e. treat the *more restrictive* of (Regime, ZW_STATE) as the
effective regime for every downstream Regime-keyed lookup (S3's Mode table,
S11's θ_s table). Mode/θ_s are simply re-selected from the same tables using
the corrected regime value whenever the Zero-Wave Gate concludes something
more restrictive than S1 did. If ZW_STATE is OPEN or DAMPED and matches
Regime exactly, nothing changes.

---

## 7. STEPS A–C: OBJECTIVE, MODE, ELIGIBILITY

### Step A — Objective Lock
Freeze 5 components permanently:
1. **Objective Type** — single, explicit (valid: "short-cycle speculative
   extraction", "lottery 2D/3D"; invalid: compound or vague goals).
2. **Time Horizon** — single session only, no rolling windows.
3. **Output Scope** — exactly 2-digit ordered pairs (00–99) or 3-digit ordered
   triplets (000–999), per declared geometry.
4. **Domain Inclusion/Exclusion** — included: 5th (speculation), 11th (gain),
   2nd (holding), 8th (sudden) houses. Explicitly excluded: career, health,
   marriage, long-term investing, life-path.
5. **Risk Posture** — must explicitly accept that loss is possible.

After Step A, objective/risk/geometry cannot change; altering any requires a
reset to Phase 0 / S0.

### Step B — Mode Selection
Reads Regime, Risk, Objective only (no strength).

| Mode | Description | k_max (2D) | k_max (3D) |
|---|---|---|---|
| PRECISION | Aggressive compression, small output | 3–8 (def 5) | 3–6 (def 4) |
| ACCUMULATION | Moderate compression, balanced | 8–15 (def 10) | 6–12 (def 8) |
| OBSERVATION | Minimal compression, data-gathering | 15–25 (def 20) | 12–20 (def 15) |
| ABORT | Full stop, no output | — | — |

Mode cannot change during a run.

### Step C — Eligibility Filter
Binary/tri-state gate deciding who may participate (structural only, not strength):
- 🟢 **ELIGIBLE** — may proceed to amplitude evaluation.
- 🟡 **CONDITIONAL** — may proceed, flagged for stricter survival scrutiny.
- 🔴 **EXCLUDED** — removed permanently; cannot be revived by strength, cannot
  influence digits indirectly via pairing, cannot be justified by outcomes.


---

## 8. CPS CONSTRUCTION (S5–S10)

**All states S5–S10 are: continuous · multiplicative · non-eliminative.**
No planet is removed here — only S11 and S15 may eliminate (architecture
invariant).

### Master CPS equation (V3, full — this is the formula to use by default)
```
CPS_pre_v3(p) = S(p) × SIF_v3(p) × T_v3(p) × RB(p) × PAS_v3(p) × TM_v3(p)
                × BHF(p) × DRF(p) × VGF(p)
```
9 factors. If running V2.1-only (no navamsha/yoga/dasha-resonance layer, §4),
drop BHF/DRF/VGF and use `SIF`,`T`,`PAS`,`TM` without their V3 sub-factors
(YIF, SS_nav, DCF) — i.e. the 6-factor V1.1/V2.1 formula.

### S5 — Raw Shadbala Extraction
```
RS(p) = Sthana Bala + Dig Bala + Kaala Bala + Chesta Bala + Naisargika Bala + Drig Bala
S(p)  = RS(p) / max(RS)     range: (0, 1]
```
All 6 components required (from `SHADBALA["total_virupas"]`). No ranking
language, no bias applied — scale-invariant, order-preserving.
**Bhava Bala is never part of RS(p)** (§3.1 Rule 11 / Hard Rule 10, §16).

### S6 — Structural Integrity Audit → SIF_v3
```
ES(p)     = S(p) × SIF(p)
SIF_v3(p) = clamp( min(KIF, DIF, AIF, CIF, YIF), 0.82, 1.00 )   ← V3 floor (V2.1-only floor = 0.85)
```
Four base sub-factors (attenuation only, never boosting):

| Sub-factor | Checks |
|---|---|
| KIF | Kaala Bala inflation (temporal dominance) |
| DIF | Drig Bala imbalance (aspect distortion) |
| AIF | Single-axis dominance |
| CIF | Cluster echo (multiple planets in same sign) — **SAV-informed** |

**KIF, DIF, AIF** — all three use fields already present in `SHADBALA`, no new
extraction required:
```
KIF — compares kaala_pct against this planet's other four _pct components
  (sthana_pct, dig_pct, chesta_pct, drig_pct — "% of minimum" fields already
  in SHADBALA):
    ratio = kaala_pct / mean(sthana_pct, dig_pct, chesta_pct, drig_pct)
    ratio ≤ 1.5          → KIF = 1.00  (balanced — no temporal inflation)
    1.5 < ratio ≤ 2.5     → KIF = 0.95  (mild inflation)
    ratio > 2.5           → KIF = 0.85  (severe — score mostly time-driven)

DIF — directly from the raw drig_bala value (already computable negative):
    drig_bala ≥ 0          → DIF = 1.00  (net supportive/neutral aspects)
    -20 ≤ drig_bala < 0     → DIF = 0.95  (mild hostile-aspect burden)
    drig_bala < -20         → DIF = 0.85  (severe hostile-aspect burden)

AIF — largest single Shadbala component's share of this planet's total RS(p):
    max_share = max(sthana_total, dig_bala, kaala_total, chesta_bala,
                     naisargika_bala, |drig_bala|) / RS(p)
    max_share ≤ 0.45        → AIF = 1.00  (balanced across components)
    0.45 < max_share ≤ 0.60 → AIF = 0.95
    max_share > 0.60        → AIF = 0.88  (one component dominates)
```

**CIF (SAV-informed cluster factor):**
```
For each cluster sign, retrieve SAV_sign = SAV["values"][sign_index].
3+ planets in same sign:
  SAV_sign ≥ 30 → CIF = 0.97   25–29 → CIF = 0.93   < 25 → CIF = 0.88
2 planets in same sign:
  SAV_sign ≥ 28 → CIF = 0.98   < 28 → CIF = 0.95
No cluster: CIF = 1.00
```

**YIF — Yoga Integrity Factor [V3, new 5th sub-factor]:**
```
Identify all yogas planet p participates in from YOGA_LIST.
Speculative-positive (attenuation-neutral, small credit):
  Dhana Yoga      (2nd/11th lord connection)     +0.03
  Lakshmi Yoga    (9th lord own/exalt kendra)     +0.02
  Adhi Yoga       (benefics in H6/H7/H8)          +0.02
  Raja Yoga       (kendra + trikona lord link)    +0.02
  Gaja Kesari     (Jupiter/Moon in kendra)        +0.01
Speculative-negative (attenuation):
  Daridra Yoga    (6th/8th/12th lord link)        −0.04
  Graha Yuddha    (planetary war — loser)         −0.04
  Shakata Yoga    (Jupiter/Moon on 6–8 axis)      −0.03
  Kemadruma       (Moon, no flanking planets)     −0.03
  Paapa Kartari   (planet hemmed by malefics)     −0.03

raw_yoga_delta = Σ(positive scores) + Σ(negative scores)   [per planet]
YIF = 1.00 + raw_yoga_delta
YIF = max(0.88, min(1.00, YIF))     ← attenuation only; hard cap at 1.00

No yoga participation, or YOGA_LIST absent → YIF = 1.00 (neutral).
```
**Firewall: YIF can never exceed 1.00 — positive yoga participation only
softens an attenuation, it cannot itself boost CPS.**

### S7 — Stability/Decay → T_v3
```
A(p)     = ES(p) × T(p)
SS_v3(p) = SS_dignity × SS_house × SS_bav × SS_nav
T_v3(p)  = clamp( ZC × PC × VR × SS_v3(p), 0.58, 1.00 )   (V2.1-only floor = 0.60, no SS_nav)
```
| Sub-factor | Meaning | Bounds |
|---|---|---|
| ZC | Zero-Wave compatibility | 0.85–1.00 |
| PC | Phase (Shukla/Krishna) compatibility | 0.88–1.02 |
| VR | Volatility resistance | 0.80–1.00 |
| SS_dignity | Dignity component of structural support | 0.75–1.00 |
| SS_house | House-type component | 0.95–1.00 |
| SS_bav | Ashtakavarga-bindu component | 0.85–1.00 |
| SS_nav | **[V3 new]** Navamsha-dignity component | 0.91–1.04 |

**ZC, PC, VR formulas:**
```
ZC — this planet's compatibility with the already-determined ZW_STATE,
  keyed on whether the planet is one of the three volatile bodies (Rahu,
  Mars, Ketu — the same classification K.6 already uses):
    ZW_STATE = OPEN:    volatile planet → ZC = 0.97   stable planet → ZC = 1.00
    ZW_STATE = DAMPED:  volatile planet → ZC = 0.85   stable planet → ZC = 0.95
  (ZW_STATE = CLOSED never reaches this stage — the run has already stopped.)

PC — uniform across all planets for a given chart (a session-level timing
  factor, not planet-specific — deliberately distinct from Kaala Bala's own
  per-planet paksha sub-score, to avoid re-deriving the same signal twice):
  based on paksha + tithi position, reflecting Shukla's classical
  favorability for initiating action (this system's whole objective is
  "short-cycle speculative extraction" — an initiating act):
    Shukla paksha, tithi 2–12    → PC = 1.02  (ceiling)
    Shukla paksha, tithi 1/13–15 → PC = 0.98
    Krishna paksha, tithi 2–12   → PC = 0.94
    Krishna paksha, tithi 1/13–15 (near Amavasya) → PC = 0.88  (floor)

VR — resistance to the specific volatility mechanism Z-3 already identified,
  keyed on whether this planet IS the amplifying body:
    Z-3 amplifier count = 0                      → VR = 1.00 (all planets)
    Z-3 amplifier count = 1, planet IS the amplifier (e.g. Mars if "Mars
      ignition" fired)                           → VR = 0.85
    Z-3 amplifier count = 1, planet is not the amplifier → VR = 0.95
    Z-3 amplifier count ≥ 2, planet ∈ {Rahu, Mars, Ketu} → VR = 0.80 (floor)
    Z-3 amplifier count ≥ 2, other planets              → VR = 0.90
```

**SS_dignity:** Exalted 1.00 · Own 1.00 · Moolatrikona 0.98 · Grt.Friend 0.97 ·
Friend 0.96 · Neutral 0.95 · Enemy 0.90 · Grt.Enemy 0.88 · Debilitated 0.75

**SS_house:** Angular 1.00 · Succedent 0.98 · Cadent 0.95

**SS_bav (by BAV bindu, from BAV_CURRENT_SIGN):**
BAV 7–8→1.00 · 6→0.99 · 5→0.97 · 4→0.95 · 3→0.92 · 2→0.89 · 1→0.87 · 0→0.85
(BAV = 4 is the neutral point; average ≈ 4.8 bindus/sign across 12 signs.)
This is the sole channel through which a planet's own-sign BAV bindu count
affects CPS_pre_v3 — see Hard Rule 22 (§16).

**SS_nav — Navamsha Dignity Component [V3, new]:**
```
Vargottama (rashi sign == navamsha sign) → SS_nav = 1.04  (priority over all else)
Pushkara Navamsha                        → SS_nav = 1.03
Exalted in Navamsha                      → SS_nav = 1.02
Own / Moolatrikona in Navamsha           → SS_nav = 1.01
Friend in Navamsha                       → SS_nav = 1.00
Neutral in Navamsha                      → SS_nav = 0.98
Enemy in Navamsha                        → SS_nav = 0.95
Debilitated in Navamsha                  → SS_nav = 0.91
NAVAMSHA data absent → SS_nav = 1.00 (neutral, log warning)
```

### S8 — Role Bias → RB
```
PP(p) = A(p) × RB(p)     0.80 ≤ RB ≤ 1.20, predefined per objective, never dynamic
```
**Speculative-objective RB defaults:**
Jupiter 1.15 · Venus 1.15 · Mercury 1.10 · Rahu 1.10 (9-body only) · Mars 1.05 ·
Moon 0.95 · Sun 0.95 · Ketu 0.90 (9-body only) · Saturn 0.85

### S9 — Activation & Interaction → PAS_v3
```
I(p)      = PP(p) × PAS(p)
PAS_v3(p) = clamp( D × C × R × I_v2 × H × DCF, 0.58, 1.14 )   (V2.1-only range 0.60–1.15, no DCF)
```
*(Clamp bounds are a provisional product-of-extremes estimate, pending formal
re-derivation — see §21 Known Open Items.)*

| Sub-factor | Condition | Value |
|---|---|---|
| D (dignity) | Exalted | 1.05 |
| | Own / Moolatrikona | 1.03 |
| | Grt.Friend | 1.02 |
| | Friend | 1.01 |
| | Neutral | 1.00 |
| | Enemy | 0.96 |
| | Grt.Enemy | 0.93 |
| | Debilitated | 0.92 |
| C (combustion) | Not combust | 1.00 |
| | Mild (outer 50% of threshold) | 0.95 |
| | Severe (inner 50% of threshold) | 0.85 |
| R (retrograde) | Direct | 1.00 |
| | Retrograde | 0.97 |
| I_aspect | Clean (no/neutral aspect) | 1.00 |
| | Mild hostile aspect | 0.97 |
| | Severe hostile aspect | 0.88 |
| | Benefic support aspect | 1.02 |
| H (house) | Angular | 1.03 |
| | Succedent | 1.00 |
| | Cadent | 0.95 |

**I_v2 — Aspect Factor:**
```
I_v2 = I_aspect
```
BAV-bindu strength enters CPS_pre_v3 exactly once, via SS_bav in T_v3 (§7) —
the natural home for a static, positional Ashtakavarga reading, alongside
SS_dignity/SS_house/SS_nav. See Hard Rule 22 (§16).

**DCF — Dispositor Chain Factor [V3, new]:**
```
Step 1 — disp(p) = PLANETS[p]["dispositor"]
Step 2 — Self-disposited exception:
  If p is in its Own or Exalted sign → DCF = 1.03 → STOP (skip steps 3–5)
Step 3 — Dispositor normalized Shadbala: S_disp = RS(disp)/max(RS)
Step 4 — DCF_base by S_disp:
  ≥0.85 → 1.03 (strong)   0.70–0.84 → 1.01 (moderate)   0.50–0.69 → 1.00 (neutral)
  0.35–0.49 → 0.97 (weak) < 0.35 → 0.94 (very weak)
Step 5 — Dignity modifier: Debilitated dispositor ×0.95; Exalted/Own dispositor ×1.01; else ×1.00
Step 6 — DCF(p) = clamp( DCF_base × dignity_modifier, 0.92, 1.03 )
```
Design note: DCF's narrow range is deliberate — chain *transmission*, not
amplification.

### S10 — Temporal Modulation → TM_v3
```
CPS_pre(p) = I(p) × TM_v3(p)
TM_v3(p)   = clamp( DLR × TF × NF × HP, 0.90, 1.05 )
```
TM_v3 is identical in V2.1 and V3.

| Component | Meaning | Bounds |
|---|---|---|
| DLR | Day Lord Resonance (weekday ruler) | 0.98–1.03 |
| TF | Tithi Factor (lunar day polarity) | 0.98–1.03 |
| NF | Nakshatra Factor | 0.97–1.03 |
| HP | Hora Position (current hora ruler) | 0.97–1.03 |

**DLR, TF, NF, HP formulas** — DLR, NF, and HP all use the same
mechanism: identify today's ruling planet for that axis, then look up planet
`p`'s relationship to it via §9.2's Natural Friendship Table (the same table
DRF already uses) — three parallel "resonance with the moment's ruling
influence" checks, reusing one lookup table instead of inventing three:
```
DLR — ruler = PANCHANGA["weekday_lord"]:
    p == weekday_lord        → DLR = 1.03
    p is Friend of weekday_lord   → DLR = 1.01
    p is Neutral to weekday_lord  → DLR = 1.00
    p is Enemy of weekday_lord    → DLR = 0.98

NF — ruler = the classical Vimshottari lord of Moon's current nakshatra
  (PANCHANGA["nakshatra_name"], via the fixed 27-nakshatra lord sequence:
  Ketu-Venus-Sun-Moon-Mars-Rahu-Jupiter-Saturn-Mercury, repeating 3× from
  Ashwini through Revati — deliberately keyed to the *query-moment* Moon
  nakshatra, not each planet's own natal nakshatra, since the latter is
  already fully used by Step K.3's nakshatra digit overlay and re-deriving
  it here would repeat that signal):
    p == nakshatra lord        → NF = 1.03
    p is Friend of nakshatra lord   → NF = 1.01
    p is Neutral to nakshatra lord  → NF = 1.00
    p is Enemy of nakshatra lord    → NF = 0.97

HP — ruler = HORA["planet"] (the current hora lord):
    p == hora ruler          → HP = 1.03
    p is Friend of hora ruler     → HP = 1.01
    p is Neutral to hora ruler     → HP = 1.00
    p is Enemy of hora ruler       → HP = 0.97

TF — from the classical five-fold tithi cycle (Nanda / Bhadra / Jaya /
  Rikta / Purna), computed from the tithi's position in the full 1–30
  lunar-month count (Shukla tithis = 1–15 as printed; Krishna tithis =
  15 + the printed Krishna tithi number, e.g. "Krishna Tritiya" = 15+3 = 18):
    tithi_1_30 mod 5 = 1 (Nanda)  → TF = 1.02
    tithi_1_30 mod 5 = 2 (Bhadra) → TF = 1.01
    tithi_1_30 mod 5 = 3 (Jaya)   → TF = 1.03  (ceiling)
    tithi_1_30 mod 5 = 4 (Rikta)  → TF = 0.98  (floor)
    tithi_1_30 mod 5 = 0 (Purna)  → TF = 1.00
  (Uniform across all planets for a given chart, like PC — this is a
  session-level timing factor, not planet-specific.)
```

---

## 9. V3 NEW TOP-LEVEL CPS FACTORS (BHF, DRF, VGF)

These three multiply directly onto the 6-factor product (they are not nested
inside SIF/T/PAS/TM). They were introduced in V3 specifically because Bhava
Bala, Dasha resonance, and Vargottama/Navamsha status carry activation
information that raw Shadbala alone does not capture.

### 9.1 BHF — Bhava Bala House Factor
```
BHF(p) range: [0.88, 1.05]
Step 1 — h = house occupied by p
Step 2 — BB_total = BHAVA_BALA[h]["total"]
Step 3 — BB_mean = mean(BHAVA_BALA[1..12]["total"]);  BB_norm = BB_total / BB_mean
Step 4 — map:
  BB_norm ≥ 1.30    → 1.05 (very strong house)
  1.15–1.29         → 1.03
  1.00–1.14         → 1.01
  0.85–0.99         → 1.00 (neutral zone)
  0.70–0.84         → 0.96
  0.55–0.69         → 0.92
  < 0.55            → 0.88 (very weak house — floor)
Step 5 — speculative-house bonus: if p is in H2/H5/H8/H11 AND BB_norm ≥ 1.00:
  BHF = min(1.05, BHF × 1.01)
BLOCK_7 absent or all-zero → BHF = 1.00 (neutral, log warning)
```
**Rule: BHF uses Bhava Bala TOTALS only. Never any individual component
(lord_contrib, drishti, etc.) directly, and Bhava Bala is still never added
into Shadbala RS(p) — BHF is a wholly separate multiplier.**

### 9.2 DRF — Dasha Resonance Factor
The single most significant V3 addition: the current dasha lord carries
activation energy beyond raw Shadbala.
```
DRF(p) range: [0.88, 1.08]
Step 1 — MD = DASHA["mahadasha_planet"], AD = DASHA["antardasha_planet"]
Step 2 — Identity check (full priority):
  p == MD (regardless of AD) → DRF = 1.08 → STOP
  p == AD only               → DRF = 1.05 → STOP
Step 3 — Relationship to MD lord (natural friendship table below):
  Great Friend → 1.04   Friend → 1.02   Neutral → 1.00   Enemy → 0.94   Great Enemy → 0.88
Step 4 — AD-lord secondary modifier: friend-of-AD ×1.01; enemy-of-AD ×0.98; neutral no change
Step 5 — DRF = result of steps 3–4, clamp [0.88, 1.08]
```
**Natural Planetary Friendship Table:**

| Planet | Friends | Neutral | Enemies |
|---|---|---|---|
| Sun | Moon, Mars, Jupiter | Mercury | Venus, Saturn |
| Moon | Sun, Mercury | Mars, Jupiter, Venus, Saturn | — |
| Mars | Sun, Moon, Jupiter | Venus, Saturn | Mercury |
| Mercury | Sun, Venus | Mars, Jupiter, Saturn | Moon |
| Jupiter | Sun, Moon, Mars | Saturn | Mercury, Venus |
| Venus | Mercury, Saturn | Mars, Jupiter | Sun, Moon |
| Saturn | Mercury, Venus | Jupiter | Sun, Moon, Mars |

**DASHA_DIVERGENCE flag:** if the MD lord's own `CPS_pre_v3` falls below θ_s
(i.e. the MD lord does not survive S11), annotate the output explicitly:
`"DASHA_DIVERGENCE — MD lord eliminated at survival gate."` This is a
structural flag, not an error — it means the currently-running life period's
ruling planet is not driving this particular field, which is meaningful context
for interpretation. Apply the same check/flag independently to the AD lord.

### 9.3 VGF — Vargottama & Navamsha Factor
Vargottama (same sign in D-1 and D-9) is one of the most potent positional
strengths in classical Jyotish.
```
VGF(p) range: [0.93, 1.06]
Step 1 — Vargottama check (highest priority):
  if PLANETS[p]["sign"] == NAVAMSHA[p]["sign"] → VGF = 1.06 → STOP
Step 2 — Pushkara check: is_pushkara → VGF_pushkara = 1.04, else 1.00
Step 3 — Navamsha-dignity modifier:
  Exalted 1.02 · Own/Moolatrikona 1.01 · Friend 1.00 · Neutral 0.99 · Enemy 0.97 · Debilitated 0.93
Step 4 — VGF = VGF_pushkara × nav_dignity_modifier, clamp [0.93, 1.06]
NAVAMSHA data absent → VGF = 1.00 (neutral, log warning)
```

**V3 factor-range summary:**

| Factor | Stage | Range | Notes |
|---|---|---|---|
| S(p) | S5 | (0, 1] | unchanged from V1.1 |
| SIF_v3 | S6 | [0.82, 1.00] | + YIF sub-factor |
| T_v3 | S7 | [0.58, 1.00] | + SS_nav sub-factor |
| RB | S8 | [0.80, 1.20] | unchanged |
| PAS_v3 | S9 | [0.58, 1.14] | + DCF sub-factor (provisional clamp — §21) |
| TM_v3 | S10 | [0.90, 1.05] | unchanged from V1.1 |
| **BHF** | S10b | [0.88, 1.05] | new top-level |
| **DRF** | S10c | [0.88, 1.08] | new top-level |
| **VGF** | S10d | [0.93, 1.06] | new top-level |

**Absent-block policy (critical): missing BLOCK_15/16 or all-zero
BHAVA_BALA never triggers DAMPED/CLOSED and never aborts.** They are
enhancement layers; the affected factor(s) simply default to neutral 1.00.
Only Z-3/Z-4 (missing volatility flags / phase stress) default to DAMPED —
that is a *safety* gate, unlike the V3 enhancement factors.

**Rahu/Ketu dignity-lookup convention:** Rahu and Ketu have no
classical dignity of their own (`dignity: "—"` in the data template) — but
four separate lookup tables in this pipeline are keyed on the 8-way classical
dignity scale and need *some* value for every one of the 9 bodies: §8's
`SS_dignity` (T_v3), §8's `D`-factor (PAS_v3), this section's `VGF` navamsha-
dignity modifier (Step 3 above), and §9.2's `DRF` Natural Friendship Table.
**Rule:** wherever any of these four tables needs a dignity or friendship
value for Rahu, use Saturn's row; for Ketu, use Mars's row. This mirrors the
convention the extraction rules already state explicitly for Ashtakavarga
(`BAV_CURRENT_SIGN`: "Rahu → uses Saturn's BAV row, Ketu → uses Mars's BAV
row") — the same shadow-planet pairing, extended to dignity-keyed lookups.

---

## 10. S11: CORE SURVIVAL GATE (DISCONTINUITY #1)

**First and only-so-far irreversible binary elimination.**

**Pre-declaration (MANDATORY, before inspecting any CPS value):**
```
θ_s = f(Regime, Mode)
```
| Regime | Mode | θ_s |
|---|---|---|
| OPEN | ACCUMULATION | 0.45 |
| OPEN | PRECISION | 0.55 |
| OPEN | OBSERVATION | 0.35 |
| DAMPED | ACCUMULATION | 0.55 |
| DAMPED | PRECISION | 0.60 |
| DAMPED | OBSERVATION | 0.45 |
| CLOSED | ANY | ABORT |

```
Survive(p) = 1  if CPS_pre_v3(p) ≥ θ_s,  else 0
P_S = { p ∈ P_E | CPS_pre_v3(p) ≥ θ_s }
```
Rules: θ_s declared **before** seeing the CPS distribution · uniform across all
planets (no planet-specific thresholds) · cannot be adjusted after seeing
results · eliminated planets cannot re-enter · **if `|P_S| = 0` → ABORT.**

---

## 11. S12: FIELD CLASSIFICATION

**Entropy-neutral topology labeling. No amplitude modification — this step
only classifies, it never eliminates or reweights.**

Compute 4 metrics over survivors `P_S`:
1. **Cardinality:** `n = |P_S|`
2. **Dominance Ratio:** `D = max(CPS_pre_v3) / Σ CPS_pre_v3`
3. **Durability Density:** `T̄ = mean(T_v3(p))` over survivors
4. **Archetype Composition:** expansion / trigger / contraction / neutral counts

**Classification (strict priority order — first match wins):**

| Priority | Condition | FieldType |
|---|---|---|
| 1 | n ≤ 2 | COMPRESSED |
| 2 | n ≤ 4 AND D ≥ 0.30 | STRIKE |
| 3 | T̄ < 0.70 | VOLATILE |
| 4 | n ≥ 5 AND D < 0.20 | STABLE |
| 5 | else | FRAGMENTED |

**SAV enrichment label (does NOT change downstream pair/triplet logic):**
```
SAV_spec_triangle = SAV_H5 + SAV_H8 + SAV_H11
STABLE     + triangle ≥ 88  → STABLE_STRONG
STABLE     + triangle < 75  → STABLE_WEAK
STRIKE     + SAV_H11 ≥ 30  → STRIKE_GAIN
STRIKE     + SAV_H11 < 26  → STRIKE_BLIND
FRAGMENTED + triangle < 72  → FRAGMENTED_LOW
All others: retain primary label
```

---

## 12. STEP K: DIGIT VECTOR FORMATION

**Converts surviving planets → digit-strength vector D₀…D₉.** Identical for
2D and 3D geometries — the geometry override only changes what happens *after*
this vector exists.

### K.1 — Base Planet Digit Families (IMMUTABLE)

| Planet | Primary | Secondary | Nature |
|---|---|---|---|
| Sun | 1 | 4 | Identity |
| Moon | — | — | **Timing only — contributes NO digits, ever** |
| Mars | 9 | 3 | Attack |
| Mercury | 5 | 0, 2, 8 | Numbers |
| Jupiter | 3 | 7 | Expansion |
| Venus | 6 | 2, 9 | Gains |
| Saturn | 8 | 4 | Structure |
| Rahu | 4 | 0, 8 | Volatility |
| Ketu | 7 | 2 | Fragment |

### K.2 — Sign Overlay Digits
Aries 9,1 · Taurus 6 · Gemini 5 · Cancer 2 · Leo 1 · Virgo 5,2 · Libra 6 ·
Scorpio 8 · Sagittarius 3,9 · Capricorn 8,4 · Aquarius 4,7 · Pisces 0
(Add to the planet's digit list; boost if own/exalted, reduce if debilitated.)

### K.3 — Nakshatra Digit Overlay (all 27, primary/secondary)

| # | Nakshatra | Pri | Sec | # | Nakshatra | Pri | Sec |
|---|---|---|---|---|---|---|---|
| 1 | Ashwini | 3 | 1,— | 15 | Swati | 4 | 8,6 |
| 2 | Bharani | 9 | 1,6 | 16 | Vishakha | 8 | 2,6 |
| 3 | Krittika | 1 | 3,6 | 17 | Anuradha | 8 | 2,9 |
| 4 | Rohini | 6 | 2,— | 18 | Jyeshtha | 3 | 8,1 |
| 5 | Mrigashira | 5 | 2,3 | 19 | Mula | 7 | 3,9 |
| 6 | Ardra | 8 | 4,5 | 20 | Purva Ashadha | 9 | 4,3 |
| 7 | Punarvasu | 7 | 1,2 | 21 | Uttara Ashadha | 1 | 8,6 |
| 8 | Pushya | 8 | 2,6 | 22 | Shravana | 8 | 4,1 |
| 9 | Aslesha | 4 | 2,7 | 23 | Dhanishta | 8 | 7,4 |
| 10 | Magha | 1 | 9,— | 24 | Shatabhisha | 4 | 8,0 |
| 11 | Purva Phalguni | 6 | 1,9 | 25 | Purva Bhadrapada | 7 | 1,0 |
| 12 | Uttara Phalguni | 6 | 5,1 | 26 | Uttara Bhadrapada | 7 | 0,2 |
| 13 | Hasta | 5 | 2,1 | 27 | Revati | 5 | 0,2 |
| 14 | Chitra | 3 | 6,5 | | | | |

### K.4 — House Overlay
5th → 3,9 · 11th → 6,8 (strong) · 9th → 1,6 · 2nd → 4,1 · 8th → 7 ·
6th/12th → weaken the weakest digit

### K.5 — Combine per planet
**Moon: skip this entire procedure — contributes the empty set, full stop.**
Moon's sign, nakshatra, and house overlays are never applied either; the skip
is the literal first step, not a check performed after the fact.
For every other planet: start with base digits → add sign digits → add
nakshatra digits → add house digits → add dispositor sign digits (soft echo
only) → remove duplicates → final per-planet digit list.

### K.6 — Internal Emphasis Values

| Tier | Emphasis | Condition |
|---|---|---|
| Strong | 1.00 | Base planet digit |
| Semi-strong | 0.85 | Reinforced by sign or nakshatra |
| Medium | 0.60 | Normal secondary source |
| Weak-medium | 0.50 | Weak secondary |
| Weak | 0.40 | Minor source |
| Echo | 0.20 | Dispositor only |

Modifiers: Volatile planet (Rahu/Mars/Ketu) → **+10–15%** to base-digit
emphasis · Debilitated → **−20%** to weakest-digit emphasis · Exalted (or Own,
by extension of house-lord practice) → **+10%** to strongest-digit emphasis.

### K.7–K.9 — Weight Multiplication & Global Vector
```
Contribution(P, d) = W_P × E(P, d)          [W_P = surviving planet's CPS_pre_v3]
D_d = Σ over all surviving planets P of Contribution(P, d),  for d = 0…9
```
Output: raw digit-strength vector D₀…D₉ (non-negative, **not normalized** here
— normalization happens inside Step L).

### K.10 — Rank Digits & Identify Clusters
Sort D₀…D₉ descending.
- **Primary Cluster:** top 3–4 digits
- **Secondary Cluster:** positions 5–7
- **Volatile Digits:** the subset of {0, 4, 7, 9} present among survivors'
  contributions (these four are structurally tagged volatile regardless of rank)
- **Shadow/Noise:** strength < 0.08 × max(D)

---

## 13. STEP L: GEOMETRY-DEPENDENT PAIR/TRIPLET OUTPUT

Choose **one** of the two sub-sections below based on `IDENTITY["geometry"]`.
Everything upstream (S0–S12, Step K) is identical regardless of geometry.

### 13.1 — 2D: Pair Bias Matrix (`ordered_2_digit`)

**Core formula (LOCKED):**
```
W(XY) = D_X × D_Y                     (raw pair weight, ordered pairs)
S      = Σ W(ij)  for i,j ∈ {0..9}    (100-term normalization sum)
P(XY)  = W(XY) / S
Verify: Σ P(XY) = 1.0000  (±1e-9 tolerance)
```
All 100 ordered pairs generated — no filtering, no pruning before
normalization. Double-precision internally; round to 4dp for display only.

**Categorization:**
- **Primary (core):** top pairs until cumulative P ≥ 0.35 OR 6 pairs. Exclude
  purely volatile pairs if stable pairs are available.
- **Secondary (support):** continue to cumulative P 0.70–0.85 OR 10–12 pairs.
  Prefer pairs bridging primary→secondary digits.
- **Burst/Jackpot (volatile overlay):** pairs containing volatile digits
  (0,4,7,9); 6–10 pairs; time-gated to Rahu/Mars/Moon hora windows only.
- **Shadow/Backdoor (micro-cover):** 4–8 low-probability tail pairs, under-
  covered digits, micro-stakes only.
- **Compact-4** (top 4 stable) / **Compact-6** (= Primary set, top 6).

**Volatility warning:** if volatile-digit mass > 25–30% of total digit mass →
issue a warning and suggest shifting 5–10% of stake from Primary to Burst.

### 13.2 — 3D: Triple Bias Tensor (`ordered_3_digit`)

**Overrides Step L only** (and S15, §14.2). S0–S12 and Step K are unchanged.
Space is 000–999 (1,000 ordered triplets); mean P per triplet = 0.0010.
Digit repetition is structurally permitted and cannot be excluded (000, 111,
552, 525, 255 are all valid).

**Core formula (LOCKED):**
```
W(XYZ) = D_X × D_Y × D_Z              (raw triplet weight, ordered 3-tuples)
S       = Σ W(ijk)  for i,j,k ∈ {0..9}  (1000-term normalization sum)
P(XYZ)  = W(XYZ) / S
Verify: Σ P(XYZ) = 1.0000  (±1e-9 tolerance)
```
Round to 6dp for display. If `S = 0` → ABORT, require re-run of Step K.

**Tensor construction:** verify ≥3 non-zero digits in D₀…D₉ → compute W(XYZ)
for all 1000 triplets → compute S → normalize → checksum → rank descending.

**Categorization (3D-recalibrated — lower thresholds than 2D due to 10× dilution):**
- **Primary:** top triplets until cumulative P ≥ **0.12** OR **5 triplets**.
  Exclude purely volatile triplets if stable ones are available.
- **Secondary:** continue to cumulative P **0.35–0.45** OR **12–18 triplets**.
- **Burst/Jackpot:** triplets with ≥2 of 3 positions containing volatile digits
  {0,4,7,9}; **8–15 triplets**; time-gated to Rahu/Mars/Moon hora windows only.
- **Shadow/Backdoor:** 4–8 low-probability tail triplets, ≤2% allocation.
- **Compact-3** (top 3) / **Compact-5** (= Primary, top 5) / **Compact-10**
  (Primary + early Secondary, top 10).

**Volatile-mass warning (3D-adjusted — thresholds raised because 3-position
multiplication amplifies volatile digits more aggressively than 2D):**
```
volatile_mass = Σ D_d for d∈{0,4,7,9} / Σ D_d for d∈{0..9}
> 0.35 → WARNING: Burst-window restriction required
> 0.50 → WARNING: Primary compressed to Compact-3 only, full Burst restriction
```

**Digit Vector Graph is MANDATORY 3D output** (not optional even in DAMPED or
sparse-survivor runs — only a CLOSED regime produces no output at all). At
minimum, report as text/ASCII bars if an HTML/graphical surface isn't
available: digit 0–9, bar length ∝ normalized D_d, color/tag as
volatile(⚡)/primary/secondary/noise, rank label, and (if space allows) the
contributing-planet breakdown per digit. See §18 for the full dashboard spec
if a rendered artifact is requested.

**Tensor is symmetric across the 3 positions** (W(XYZ)=D_X×D_Y×D_Z is
commutative in the sense that digit strength doesn't depend on hundreds/tens/
units placement) — do not introduce positional weighting; real-world
positional draw asymmetry is a separate domain this engine does not model.


---

## 14. S15: FINAL AUTHORIZATION (DISCONTINUITY #2)

**Second and final discontinuity — top-k selection.** Choose the sub-section
matching the declared geometry.

### 14.1 — 2D Final Authorization

**Pre-declared policy (from S3 — cannot change):** k_max bands per §7 Step B
table (2D column).

**Algorithm:**
1. Sort pairs by descending `W_pair`.
2. Diversity cap: no single digit may appear in > 40% of the `k_max` pairs.
3. Core participation: ≥ 60% of selected pairs must include a Core/Primary-
   tier digit.
4. Select top `k_max` pairs satisfying both constraints. **If fewer than
   `k_max` pairs satisfy both simultaneously:** relax the diversity cap first (drop it entirely if needed,
   since core participation is the more important of the two constraints),
   then re-select; if still short of `k_max` after fully relaxing the
   diversity cap, output fewer than `k_max` pairs with an explicit
   `"under_filled": true` flag in the audit output — never relax core
   participation, and never fabricate additional pairs to reach `k_max`.
5. Deterministic tie-break: lexicographic by pair code.

**Default stake allocation:** Primary 65% (Conservative 75% / Aggressive 55%)
· Secondary 25% (20% / 20%) · Burst 8% (4% / 20%) · Shadow 2% (1% / 5%).
Per-pair: `Stake(p_i) = Pool_C × P(p_i) / Σ P(p ∈ C)`.

**Time-gating:** volatile-digit pairs execute only in Rahu/Mars/Moon hora
windows; Primary/Secondary prefer Moon-favorable windows.

**Pre-execution checks:** total stake ≈ bankroll · Primary cumulative P ≥ 0.30
· no single pair > 12% of Primary pool · time gate present for every Burst
pair · audit fields complete for all pairs.

**Fallback modes:** top pair P < 0.015 → mark diffuse, reduce stakes 50%,
Compact-4 only · volatile mass > 30% → reduce Primary 5–10%, shift to Burst ·
`S = 0` → full abort, re-run Step K · all digits zero → full abort ·
**top-10 cumulative P < 0.25 → Soft Mode: 50% exposure reduction.**

### 14.2 — 3D Final Authorization

**Pre-declared k_max (3D bands — do NOT carry over 2D/V3 bands):**
PRECISION 3–6 (def 4) · ACCUMULATION 6–12 (def 8) · OBSERVATION 12–20 (def 15).

**Algorithm:**
1. Sort triplets by descending `W(XYZ) = D_X × D_Y × D_Z`.
2. Diversity cap: no single digit may appear in > 50% of `k_max` triplets in
   the **hundreds** position **OR** > 50% in the **tens** position (prevents
   runaway single-digit dominance across positions). The cap is `OR`, not
   `AND`: a digit that fully dominates either position alone is blocked.
3. Core participation: ≥ 60% of triplets include a Core-tier digit in at least
   one of the three positions.
4. Select top `k_max` triplets satisfying all constraints. **If fewer than
   `k_max` triplets satisfy all constraints simultaneously:** relax the diversity cap first, then re-select; if
   still short of `k_max`, output fewer than `k_max` triplets with an
   explicit `"under_filled": true` flag — never relax core participation,
   never relax the all-volatile-triplets Burst-hora-only restriction, and
   never fabricate additional triplets to reach `k_max`.
5. Deterministic tie-break: lexicographic ascending by triplet code (000–999).

**Default stake allocation:** Primary 60% (Conservative 70% / Aggressive 50%)
· Secondary 28% (22% / 25%) · Burst 9% (6% / 20%) · Shadow 3% (2% / 5%).
Per-triplet: `Stake(t_i) = Pool_C × P(t_i) / Σ P(t ∈ C)`.

**Time-gating:** ≥2-volatile-position triplets execute only in Rahu/Mars/Moon
hora windows; Primary/Secondary prefer Moon-favorable windows; **all-3-
volatile-position triplets execute in Burst hora ONLY — never in open
execution.**

**Pre-execution checks:** total stake ≈ bankroll · Primary cumulative P ≥ 0.08
(3D-adjusted) · no single triplet > 15% of Primary pool · time gate present
for every Burst triplet · audit fields complete · Digit Vector Graph generated
and reviewed.

**Fallback modes (3D-adjusted):** top triplet P < 0.004 → mark diffuse, reduce
stakes 50%, Compact-3 only · volatile mass > 50% → reduce Primary to
Compact-3, full Burst restriction · `S = 0` → full abort, re-run Step K · all
digits zero → full abort · **top-20 cumulative P < 0.15 → Soft Mode: 50%
exposure reduction** (note: 3D uses **top-20**, not top-10, and **15%**, not
25% — do not reuse the 2D thresholds) · only 1 non-zero digit → collapse
warning, triplet-space singularity → **ABORT**.

---

## 15. REFERENCE APPENDIX

*(The survival-threshold θ_s table has a single canonical location: §10.)*

### 15.1 Full Dignity Value Reference
| Dignity | SS_dignity (S7) | PAS_D (S9) |
|---|---|---|
| Exalted | 1.00 | 1.05 |
| Own | 1.00 | 1.03 |
| Moolatrikona | 0.98 | 1.03 |
| Grt.Friend | 0.97 | 1.02 |
| Friend | 0.96 | 1.01 |
| Neutral | 0.95 | 1.00 |
| Enemy | 0.90 | 0.96 |
| Grt.Enemy | 0.88 | 0.93 |
| Debilitated | 0.75 | 0.92 |

### 15.2 Volatile Digit Tags
| Digit | Planet source | Nature |
|---|---|---|
| 0 | Rahu / Mercury / Pisces | Void, chaos, boundary |
| 4 | Rahu / Capricorn / Aquarius | Disruption, volatility |
| 7 | Ketu / Jupiter | Occult, fragmentation |
| 9 | Mars / Aries / Sagittarius | Attack, rupture, surge |
Digits 1, 2, 3, 5, 6, 8 are generally stable.

### 15.3 Gandanta Zone Reference (for the `gandanta_active` flag, §3.1 Rule 8)
| Zone | Degree range |
|---|---|
| Cancer end / Leo start | 26°40′ Can – 3°20′ Leo |
| Scorpio end / Sag start | 26°40′ Sco – 3°20′ Sag |
| Pisces end / Aries start | 26°40′ Pis – 3°20′ Ari |
Moon or Lagna within any of these zones → `gandanta_active = True`.

### 15.4 Weekday Hora Sequences (for HORA block / TM's HP factor)
```
Sun:  Sun-Ven-Mer-Mon-Sat-Jup-Mar-Sun...
Mon:  Mon-Sat-Jup-Mar-Sun-Ven-Mer-Mon...
Tue:  Mar-Sun-Ven-Mer-Mon-Sat-Jup-Mar...
Wed:  Mer-Mon-Sat-Jup-Mar-Sun-Ven-Mer...
Thu:  Jup-Mar-Sun-Ven-Mer-Mon-Sat-Jup...
Fri:  Ven-Mer-Mon-Sat-Jup-Mar-Sun-Ven...
Sat:  Sat-Jup-Mar-Sun-Ven-Mer-Mon-Sat...
```
Day horas run sunrise→sunset in the sequence above (each ≈ day-length/12);
night horas continue the same rotation from sunset→next sunrise.

### 15.5 sign_index reference (used throughout: SAV lookups, SIGN_CLUSTERS, BAV rows)
`Ari=0, Tau=1, Gem=2, Can=3, Leo=4, Vir=5, Lib=6, Sco=7, Sag=8, Cap=9, Aqu=10, Pis=11`


---

## 16. HARD RULES & FIREWALLS (consolidated, every version)

### Non-negotiable laws (engine level)
1. Planets create pressure → digits express it → pairs/triplets distribute it
   → survival removes illusion.
2. **ZW_STATE = CLOSED → output nothing, terminate immediately.**
3. θ_s must be declared **before** inspecting CPS values.
4. `k_max` must be declared **before** ranking pairs/triplets.
5. **Only S11 and S15 may eliminate entities.** All other transformations must
   be continuous and non-eliminative.
6. No adaptive thresholds — same input → same output, always.
7. No feedback from outcomes to digit weights, ever.
8. No past winning numbers may influence any current run.
9. **Silence (no output) is a valid and successful result.**
10. Bhava Bala must **never** enter the Shadbala RS(p) sum, in any version.
11. Missing `VOLATILITY_FLAGS` → Z-3 = UNKNOWN → default DAMPED.
12. Missing `PHASE_STRESS` → Z-4 = UNKNOWN → default DAMPED.
13. BHF uses Bhava Bala **totals only** — never an individual sub-component.
14. DRF ceiling = 1.08 — no compound identity/condition may exceed it.
15. YIF is attenuation-only inside SIF — positive yoga participation cannot
    push YIF above 1.00, and cannot itself boost CPS.
16. VGF ceiling = 1.06 — Vargottama is the maximum grade; Pushkara+Exalted
    navamsha combinations cannot exceed the ceiling.
17. DCF range is [0.92, 1.03] — the dispositor chain cannot amplify CPS by
    more than 3%.
18. Absent V3 blocks (BLOCK_15/16, or all-zero BHAVA_BALA) → neutral
    default (1.00), **not** DAMPED. These are enhancement layers, not safety
    gates — their absence never triggers Soft Mode or an abort by itself.
19. In 3D mode: `W(XYZ) = D_X × D_Y × D_Z` with no exceptions and no
    positional weighting; the normalization sum `S` covers exactly 1000
    triplets (never a filtered subset, never pre-pruned); digit repetition
    (000, 111, …) is structurally permitted and cannot be excluded.
20. In 3D mode: Soft-Mode trigger is **top-20 cumulative P < 15%** (not the 2D
    top-10 < 25%); volatile-mass warning threshold is **35%** / full-restrict
    **50%** (not the 2D 25–30%); k_max must use the 3D bands, never the 2D or
    plain-V3 bands.
21. The Digit Vector Graph is mandatory 3D output and cannot be omitted even
    when DAMPED or the survivor pool is sparse.
22. BAV-bindu strength (`BAV_CURRENT_SIGN`) enters `CPS_pre_v3` exactly once,
    via `SS_bav` (§7/T_v3). It must never be re-applied as a second
    multiplicative factor anywhere else in the pipeline; `I_v2` (§9) is
    `I_aspect` only.
23. No Gochara/transit factor exists in this engine. It extracts a chart for
    the event/query moment being evaluated, never a natal chart with a
    separate ongoing transit relationship, so there is no second fixed
    reference point for a transit-vs-natal factor to read against.
    `TM_v3 = DLR × TF × NF × HP`, full stop; the schema (§2.2) has no
    transit block.

### The engine must NEVER:
See or be shown winning numbers · learn from past outcomes · override timing
gates · modify CPS retroactively · invent digits outside the canonical K.1–K.4
mapping · collapse to "lucky numbers" reasoning · adjust thresholds after
seeing the CPS distribution · use Bhava Bala as a Shadbala component.

### Architecture invariants (all versions, all geometries)
Exactly **2 discontinuities**: S11 and S15 only. All other transformations are
continuous and multiplicative. No loops, no recursion, no backward
dependencies. Forward-only, acyclic execution.

---

## 17. OUTPUT JSON SCHEMA

### 17.1 — 2D minimum output
```json
{
  "version": "V3.0", "geometry": "ordered_2_digit",
  "regime": "OPEN|DAMPED|CLOSED", "zw_state": "OPEN|DAMPED|CLOSED",
  "mode": "ACCUMULATION|PRECISION|OBSERVATION", "threshold": 0.45,
  "lagna_type": "Movable|Fixed|Dual", "volatility_flag_count": 0,
  "phase_stress_level": "NONE|LOW|MEDIUM|HIGH",
  "survivors": ["Planet", "..."], "dasha_divergence": false,
  "field_type": "STABLE|STRIKE|VOLATILE|COMPRESSED|FRAGMENTED",
  "field_type_enriched": "STABLE_STRONG",
  "digit_vector": {"0":0.0,"1":0.0,"2":0.0,"3":0.0,"4":0.0,"5":0.0,"6":0.0,"7":0.0,"8":0.0,"9":0.0},
  "primary_cluster": [], "volatile_digits": [],
  "authorized_pairs": [], "compact_4": [], "compact_6": [],
  "k_max": 10, "soft_mode_active": false, "warnings": []
}
```
Per-pair audit: `{"pair":"XY","P_raw":0.0,"W_raw":0.0,"D_X":0.0,"D_Y":0.0,
"top_planets_X":[],"top_planets_Y":[],"category":"Primary|Secondary|Burst|Shadow",
"time_gate":null,"notes":"...","audit_line":"..."}`.

### 17.2 — 3D minimum output
```json
{
  "version": "V3.0-3D", "geometry": "ordered_3_digit",
  "regime": "OPEN|DAMPED|CLOSED", "zw_state": "OPEN|DAMPED|CLOSED",
  "mode": "ACCUMULATION|PRECISION|OBSERVATION", "threshold": 0.45,
  "lagna_type": "Movable|Fixed|Dual", "volatility_flag_count": 0,
  "phase_stress_level": "NONE|LOW|MEDIUM|HIGH",
  "survivors": ["Planet", "..."], "dasha_divergence": false,
  "field_type": "STABLE|STRIKE|VOLATILE|COMPRESSED|FRAGMENTED",
  "field_type_enriched": "STRIKE_GAIN",
  "digit_vector_raw": {"0":0.0, "...":0.0, "9":0.0},
  "digit_vector_normalized": {"0":0.0, "...":0.0, "9":0.0},
  "primary_cluster": [], "secondary_cluster": [], "volatile_digits": [],
  "volatile_mass_pct": 0.0, "triplet_normalization_sum": 0.0,
  "authorized_triplets": [], "compact_3": [], "compact_5": [], "compact_10": [],
  "k_max": 8, "soft_mode_active": false, "warnings": [],
  "digit_graph_html": "<!-- optional embedded widget -->"
}
```
Per-triplet audit: `{"triplet":"XYZ","P_raw":0.0,"W_raw":0.0,"D_X":0.0,"D_Y":0.0,
"D_Z":0.0,"top_planets_X":[],"top_planets_Y":[],"top_planets_Z":[],
"category":"Primary|Secondary|Burst|Shadow","volatile_positions":0,
"time_gate":null,"notes":"...","audit_line":"..."}`.

Also include per-planet V3 factor audit when BHF/DRF/VGF/YIF/DCF/SS_nav are
live: `{"planet":"...","cps":0.0,"factors":{"BHF":0.0,"DRF":0.0,"VGF":0.0,
"YIF":0.0,"DCF":0.0,"SS_nav":0.0},"sources":{...},"warnings":[]}`
plus a run header noting which V3 blocks were present vs. defaulted, any
vargottama/pushkara planets, dasha-resonance peak, and active yoga count.

---

## 18. OPTIONAL DASHBOARD DELIVERABLE (condensed spec)

If an interactive/visual artifact is requested in addition to the JSON, build
a single self-contained HTML file (inline CSS + vanilla JS, no required
external dependencies) containing:
1. **Header** — date/weekday/time/location, lagna+type, dasha string, regime/
   ZW-state/mode/geometry badges, Soft-Mode and volatile-mass-restriction
   badges when active.
2. **Digit Strength Vector panel** — one bar per digit 0–9, length ∝
   normalized D_d, color-coded (volatile digits amber, primary/secondary teal
   at full/muted opacity, noise gray), rank badge, cluster badge, hover/inline
   contributing-planet breakdown.
3. **Authorized pairs/triplets table** — rank, code, P(%), raw W, digit
   composition, category badge, time-gate column; visually flag the top-3 as
   the Compact set; render Compact-3/4/5/6/10 as click-to-copy chips.
4. **Burst set panel** (when volatile mass exceeds the applicable threshold) —
   explicit hora-window restriction note.
5. **Hora schedule** — full day+night hora list for the chart's weekday,
   flagging which windows are open for survivor-driven Primary/Secondary
   execution vs. Burst-only.
6. **CPS factor audit table** — one row per planet (survivor and eliminated),
   all 9 V3 factors + final CPS + survive/eliminate status.
7. **Engine status flags panel** — regime, ZW state, field type, Soft Mode,
   volatile mass, DASHA_DIVERGENCE (if any), any structurally notable
   Vargottama/Pushkara/exaltation/Bhava-Bala-extreme calls out.
Dark theme is conventional for this project (slate/near-black background,
teal=stable/primary, amber=volatile, gray=noise, gold=top-rank accent) but is
a style preference, not a pipeline rule — follow the user's house style if one
is already established for their project.

---

## 19. UNIFIED OPERATOR CHECKLIST (single pass, any version/geometry)

**Pre-run:** date/time/timezone/location exact · body mode declared ·
objective singular · risk posture declared · lagna_type declared ·
5 volatility flags collected · 4 phase-stress fields collected · geometry
declared · no past winning numbers or outcome expectations anywhere in context.

**Data contract (§2):** all 16 blocks populated (or explicitly `"NOT_FOUND"` /
graceful-degradation default per §3.2) · BAV stored Aries-first · Shadbala
column order verified against kendra_bala/house-type (§3.3) · SIGN_CLUSTERS
`sav` values cross-checked against `SAV["values"][sign_index]`.
**Optional validation layer (§3), only if run:** `validate_v3()` reports 0
errors · every comparison recorded as `MATCH`, `MATCH_WITHIN_TOLERANCE`,
`VALIDATION_MISMATCH`, or `NOT_VALIDATABLE` · no engine value altered as a
result.

**Phase 0 / ZW Gate:** S0 identity locked · S1 regime classified, **STOP now**
if CLOSED · S2 intent frozen · S3 mode + both k_max and θ_s bands declared
**before** any CPS math · S4 eligible set nonempty · Z-1…Z-4 computed · ZW
state determined, **STOP** if CLOSED, note restrictions if DAMPED.

**CPS construction:** all 6 Shadbala components present per planet · Bhava
Bala confirmed absent from RS(p) · S(p) computed · SIF_v3 (incl. YIF) computed,
floor respected · T_v3 (incl. SS_nav) computed, floor respected · RB from the
fixed objective table (never dynamic) · PAS_v3 (incl. DCF) computed · TM_v3
computed · BHF/DRF/VGF computed with their priority-ordered logic
(self-disposited check, MD/AD identity check, Vargottama check each evaluated
*first* within their factor) · no planet eliminated anywhere in S5–S10d.

**Survival / classification:** θ_s declared before inspecting CPS, uniform,
never adjusted after the fact · `|P_S| = 0` → ABORT · S12 metrics (n, D, T̄,
archetype) computed · field type assigned by the strict-priority rule tree ·
SAV enrichment label appended.

**Digit vector:** confirmed Moon contributed zero digits · K.1 base table
applied exactly · all 27 nakshatra overlays correctly matched · house overlay
applied · emphasis tiers + volatile/debilitated/exalted modifiers applied ·
D_d computed for all 10 digits · Primary/Secondary/Volatile/Shadow clusters
identified.

**Pair/triplet matrix:** correct geometry formula used (`D_X×D_Y` vs.
`D_X×D_Y×D_Z`) · normalization sum covers the full 100 or 1000 space with no
pre-filtering · `ΣP = 1.0000` checksum passes · category thresholds match the
declared geometry (2D vs. 3D-recalibrated) · volatile-mass warning uses the
correct threshold for the geometry (25–30% for 2D, 35%/50% for 3D).

**Final authorization:** `k_max` applied from the geometry-correct band ·
diversity cap enforced · core participation ≥ 60% · every Burst
(and, in 3D, every all-volatile) entry time-gated · Soft-Mode trigger uses the
geometry-correct rule (top-10<25% for 2D, **top-20<15%** for 3D) · audit
fields complete for every authorized entry · output JSON matches §17's schema
for the declared geometry.

**Hard-stop conditions (any = abort immediately, regardless of how far along
the run is):** ZW_STATE = CLOSED · Regime = CLOSED · `|P_E| = 0` ·
`|P_S| = 0` · `S = 0` (all digit weights zero) · θ_s adjusted after seeing CPS
values · past winning numbers detected anywhere in inputs · Bhava Bala found
inside the Shadbala RS(p) sum · (3D only) only 1 non-zero digit.

---

## 20. QUICK-REFERENCE EXECUTION SEQUENCE

```
DATA CONTRACT CHECK (§2: 16 blocks; incl. lagna_type, volatility_flags,
                     phase_stress, navamsha/yoga presence flags)
      ↓
PHASE 0 :  S0 (State Lock) → S1 (Regime) → S2 (Intent) → S3 (Mode + θ_s/k_max
           bands declared) → S4 (Eligibility)
      ↓
ZERO-WAVE GATE :  Z-1 → Z-2 → Z-3 (volatility flags) → Z-4 (phase stress)
[STOP — output nothing — if ZW_STATE = CLOSED]
      ↓
CPS CONSTRUCTION (each stage clamped as specified in §8):
   S5  S(p)=RS/max(RS)
   S6  SIF_v3 = min(KIF,DIF,AIF,CIF,YIF)
   S7  T_v3   = ZC·PC·VR·(SS_dignity·SS_house·SS_bav·SS_nav)
   S8  RB     (fixed objective table)
   S9  PAS_v3 = D·C·R·I_v2·H·DCF
   S10 TM_v3  = DLR·TF·NF·HP
   S10b BHF  = f(BhavaBala_normalized[house])
   S10c DRF  = f(MD/AD-lord relationship)
   S10d VGF  = f(Vargottama / Pushkara / Navamsha dignity)
   CPS_pre_v3(p) = S × SIF_v3 × T_v3 × RB × PAS_v3 × TM_v3 × BHF × DRF × VGF
      ↓
S11 : CORE SURVIVAL GATE  ← DISCONTINUITY #1  (θ_s pre-declared, uniform)
      ↓
S12 : FIELD CLASSIFICATION  (+ SAV enrichment label)
      ↓
STEP K : DIGIT VECTOR  D₀…D₉  (K.1 → K.10; Moon = 0 digits always)
      ↓
   [3D only] DIGIT VECTOR GRAPH — mandatory rendered/ASCII output
      ↓
STEP L : GEOMETRY OUTPUT
   2D → Pair Bias Matrix   W(XY)=D_X×D_Y,  100-space
   3D → Triple Bias Tensor W(XYZ)=D_X×D_Y×D_Z, 1000-space
      ↓
S15 : FINAL AUTHORIZATION  ← DISCONTINUITY #2  (k_max pre-declared, geometry-
      correct bands; diversity cap; core participation; time-gating; Soft-Mode
      check using the geometry-correct trigger)
      ↓
OUTPUT :  JSON (per §17) [+ optional HTML dashboard per §18]
          [+ optional validation report per §3]
```

**Total named states:** S0–S15 (+ S10b/c/d when V3 factors are live) = up to 19
states · **Discontinuities:** exactly 2 (S11, S15) · **Architecture:**
deterministic · forward-only · acyclic · non-adaptive — in every version and
every geometry this file supports.

---

## 21. REVISION HISTORY, KNOWN OPEN ITEMS & PROVENANCE

### 21.1 Revision history

| Version | Change |
|---|---|
| **1.5** | PDF→Python extraction reclassified as an optional, non-authoritative validation layer; authority model added (§0); chart-data schema consolidated into one canonical Data Contract (§2). Document rewritten as a clean Master Contract: inline patch annotations, retired-block markers, duplicate tables, and narrative validation asides removed; multiplicative stages now state their enforced clamp explicitly. No formula, threshold, or rule value was changed; the one stale figure in the §9 factor-range summary (PAS_v3) was aligned with the S9 clamp it already contradicted. |
| 1.4 | Gochara/transit removed entirely (BLOCK_17, its extraction rule, the GTF sub-factor). `TM_v3 = clamp(DLR × TF × NF × HP, 0.90, 1.05)`. |
| 1.3 | `I_bav` removed from S9 so BAV-bindu strength enters CPS exactly once (via `SS_bav`); PAS_v3 clamp re-estimated as [0.58, 1.14] (provisional). |
| 1.2 | Explicit formulas added for the twelve previously formula-less factors (Z-1, Z-2, KIF, DIF, AIF, ZC, PC, VR, DLR, TF, NF, HP); checked against a real production chart (3 June 2026, Japan). |
| 1.1 | Ten audit fixes: DAMPED×OBSERVE mode cell; Z-3 zero-amplifier row; Z-4 new-moon 48–72 h band; Regime-vs-ZW_STATE reconciliation; Rahu/Ketu dignity-lookup convention; explicit Moon skip in K.5; checksum tolerances (±1e-9); 3D diversity cap `AND`→`OR`; S15 `under_filled` fallback. |
| 1.0 | Initial consolidation of V2.1, V3.0, and 3D-v1.0 into one self-contained file. |

### 21.2 Known open items

These are carried forward from the architecture audit. They are documented
design questions, not defects introduced by any revision, and no value in this
contract has been changed to resolve them.

1. **Clamp recalibration.** The declared clamps for `SIF_v3`, `T_v3`, and
   `TM_v3` were never re-derived from their sub-factor bounds. The raw
   product of the stated component bounds spans roughly `T_v3` [0.33, 1.06]
   and `TM_v3` [0.90, 1.13], so the clamps [0.58, 1.00] and [0.90, 1.05] bind
   frequently rather than acting as rare safety rails. The `SIF_v3` floor of
   0.82 is unreachable, since every sub-factor floor is ≥ 0.85. The `PAS_v3`
   clamp [0.58, 1.14] matches its raw product but remains a provisional
   estimate.
2. **Dual reading of dignity and house type.** Dignity enters via `SS_dignity`
   (S7) and `D` (S9); house type via `SS_house` (S7) and `H` (S9), alongside
   BHF (S10b). Whether this is an intentional durability-vs-activation split
   or redundancy is undecided.
3. **Moon in S12 statistics.** Moon can survive S11 and count toward `n` and
   `D` in field classification although it contributes no digits at Step K.
4. **S1 combination table.** "LOW coherence with 0–1 flags" has no matching
   branch in Step 3, and the SAV rule's "unless every other axis agrees" has
   no defined axes at S1.
5. **Step K modifiers.** The volatile-planet emphasis modifier (+10–15%) is a
   range with no selection rule, and the 6th/12th "weaken the weakest digit"
   rule has no stated magnitude or stacking rule against the debilitation
   modifier.
6. **3D volatile-mass warning.** `volatile_mass` is computed from the digit
   vector, which is identical in 2D and 3D, so it cannot detect the
   triplet-level concentration its 35%/50% thresholds were tuned for.

### 21.3 Provenance

This file consolidates, without changing any numeric constant, threshold, or
formula:
- `SKILL_5_v2_1.md` — v2.1, Gap-Patched Ashtakavarga Edition
- `SKILL_5_v3.md` — v3.0, House-Weighted · Dasha-Resonant · Navamsha-Extended
- `SKILL_5_3D_v3.md` — 3D-v1.0, Triple-Geometry · Digit-Graph Edition
- `extraction_prompt_v2_1` / `extraction_prompt_v3.md` — PDF→Python extraction rulebooks
- `DSSME_PDF_TO_PYTHON_V3_EXTRACTION.md` — block-by-block certification spec
- Extraction gotchas (§3.3), drawn from confirmed corrections across live
  multi-session pipeline runs (Yangon 2D/3D, Japan 3D, Thai 3D).

If the source skill files are later revised, re-derive this file from them
rather than hand-patching it.

*End of DSSME Master Contract — v1.5*
