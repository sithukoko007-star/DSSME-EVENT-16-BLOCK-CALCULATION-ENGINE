# DSSME Master Contract v1.5 → v1.6 — Change Log, Conflict Audit, Implementation Audit, Open Items

## 0. Inspection gate — what was and was not available

| Required input | Status | Consequence |
|---|---|---|
| `DSSME_MASTER_CONTRACT_v1.5.md` | Read in full (it is the file produced in this project; v1.6 was built from it). | — |
| `Jyotish_Chart_Engine_Master_Contract_v4.md` | **Not present in this environment. Not read.** | Nothing in v1.6 states or depends on v4's content beyond what the task prompt itself says (upstream provider; optional Gochara). Every v4-specific cross-check is `NOT_VALIDATABLE`. |
| `CLAUDE.md`, `AI_STUDIO_GITHUB_REFERENCE.md`, repository | **Not present.** No git repository was found. | No repo-declared authority documents could be consulted. |
| Source implementation | Only `/mnt/project/dssme_engine.py` exists. It labels itself **DSSME-1.2**, i.e. it predates v1.3 and v1.4. | The audit below is against that file. It is the only implementation available, not necessarily the repository's current one. |

No source code was modified. Conformance was checked by reading the code and by running
`dssme_v16_conformance_probe.py`, which calls the real engine functions with small synthetic
inputs (probes, not production fixtures).

---

## B. Change log (v1.5 → v1.6)

Actual changes only. Sections 0, 3, 5, 6, 7, 10, 12, 13, 14, 15, 17, 18 are **byte-identical** to v1.5
(verified by script), which covers Z-1..Z-4, Regime/Mode, k_max bands, S11 thresholds, Step K mappings,
Step L formulas, S15 rules, diversity caps, soft-mode and volatile-mass thresholds, checksum tolerances,
and the Rahu/Ketu conventions.

| Section | Change |
|---|---|
| Frontmatter / end marker | Version 1.6; description names the contract as the single canonical Event-mode spec. |
| §1.1 (new) | Upstream-engine → canonical chart data → DSSME → S0–S15 → geometry → authorization diagram; DSSME-owned authorities listed. |
| §1.2 (new) | **Event-chart reference model**: the single central statement of no natal-vs-transit layer, no Gochara, no GTF, no transit BAV, no transit Vedha. |
| §1.3 (new) | **Canonical factor lock table** (14 rows, with the section defining each) and the channel-separation invariant (`SS_house ≠ H ≠ BHF`, `SS_nav ≠ VGF`) with semantics. |
| §2.2 | One sentence: Gochara is not part of the Event schema; absence is never a zero-valued placeholder block. |
| §2.4 (new) | Upstream interface: no silent mutation, 16-block schema boundary, extra blocks ignored, DSSME-owned inputs, authority split, conflict handling. |
| §4 | The "V2.1 only" row became the **legacy V2.1-compatibility mode, explicitly non-canonical**, carrying the old 0.85 / 0.60 / 0.60–1.15 bounds unchanged. |
| §8 intro, S6 | V2.1 note reworded; SIF formula annotated "canonical Event floor = 0.82". |
| §8 S7 | T_v3 written as one flat product of the seven required channels; `SS_house` and `SS_nav` declared mandatory when source data exists; semantics added; SS_nav↔VGF relationship stated. |
| §8 S8 | RB shown as a fixed-weight table; explicit prohibition list (CPS distribution, survivor count, FieldType, Regime, Zero-Wave, outcomes, heuristics, post-result tuning); no neutral fallback. |
| §8 S9 | Formula uses `I_aspect` (alias `I_v2` retired, identical value); `H` declared mandatory; "no BAV term" statement. Legacy range parenthetical removed. |
| §8 S10 | Note that no transit/Gochara/Vedha factor enters TM_v3. |
| §9.1 | BHF declared an independent channel; spec-house bonus stated as applied exactly once. |
| §9.2 | DRF restated in the required 5-step order; AD-secondary modifier stated as applied exactly once and never duplicated in DLR/NF/HP. |
| §9.3 | VGF semantics; computed once, independent of SS_nav; both neutral (1.00) when Navamsha is absent. |
| §11 | **S12 Moon exclusion**: `P_digit`, `n = |P_digit|`, `D` over `P_digit`; empty-`P_digit` edge case resolved using existing COMPRESSED / `S = 0` rules. |
| §16 | Rule 22 reworded; rule 23 rewritten to point at §1.2; **new rules 24–28** (RB constant; Moon S12/Step K; channel separation; once-only bonuses; locked formulas). |
| §19, §20 | Checklist and sequence wording aligned (SIF clamp, SS_house/SS_nav, H, no transit term, Moon in S12). |
| §21 (new) | **Cross-contract acceptance test**: procedure, assertions A1–A13, fixture coverage. The old §21 became §22; every cross-reference was updated. |
| §22 | Revision row 1.6 added; open items rewritten; provenance lists the upstream contract as interface-only. |

---

## C. Conflict audit — v1.5 statements that contradicted a v1.6 rule

| # | v1.5 statement | Conflict | Resolution |
|---|---|---|---|
| 1 | §11: `n = |P_S|`, `D` over all survivors | Counts Moon. | `n`, `D` over `P_digit` (Moon excluded). |
| 2 | §21.2 item 3: Moon in S12 listed as open | Decision now made. | Item removed. |
| 3 | §21.2 item 2: house-type double reading "undecided" | House channels now defined as distinct. | House half removed; dignity half kept (item 2). |
| 4 | S6 `(V2.1-only floor = 0.85)` | 0.85 as a DSSME floor. | Removed from canonical formula; kept only in the labeled legacy row. |
| 5 | S7 `(V2.1-only floor = 0.60, no SS_nav)` | Implies SS_nav optional. | Same treatment. |
| 6 | S9 `(V2.1-only range 0.60–1.15, no DCF)` | Legacy bound beside canonical clamp. | Same treatment. |
| 7 | §4: V2.1-only mode says "ignore SS_nav" | Contradicts "SS_nav mandatory". | Mode relabeled non-canonical and not v1.6-conformant. |
| 8 | §8 intro: V2.1-only drops sub-factors | Same. | Reworded to point at §4. |
| 9 | S9 / rule 22 used the alias `I_v2` | Prompt specifies `I_aspect`. | Alias retired; value identical. |
| 10 | §22.2 item 1: SIF floor 0.82 "unreachable" framed as a defect | Floor is now locked. | Reframed: locked, currently non-binding. |
| 11 | DRF Steps 1–5 merged both identity checks and phrased the AD modifier loosely | Prompt fixes the 5-step order and "exactly once". | Restructured; no value changed. |
| 12 | No statement that `SS_house ≠ H ≠ BHF`, `SS_nav ≠ VGF` | Gap, not a contradiction. | Added in §1.3 and rule 26. |
| 13 | Prescribed revision text "H added to PAS_v3" | H was **already** in PAS_v3 in v1.5; the instruction forbids claiming unmade changes. | Worded "H locked as a mandatory PAS_v3 factor (already present in v1.5)". |

Quality-gate search: `0.85` (15 hits), `GTF` (7), `Gochara` (12), `BLOCK_17` (1), `RB = 1.00` (0), `VGF-only` (0),
Moon-in-S12 (0), `H excluded from PAS` (0), `SS_nav`/`SS_house` missing (0), AD modifier absent (0).
**No hit is a stale canonical rule.** Every `0.85` is a sub-factor or table value except line 628, the labeled legacy row
(a legacy-mode reference, not a revision-history entry). Every GTF/Gochara/BLOCK_17 hit is a negation, a lock-table
entry, an acceptance assertion, or a revision-history row. The only `I_v2` is the revision-history note.

Invariants verified by script: fences balanced; §0–§22 sequential; no dangling § references; exactly 16 schema blocks;
lock table equals the detailed S6/S7/S9/S10 formulas and the §9 range table; RB table equals the specified weights;
S12 Moon invariant, two-discontinuity statement, forward-only/non-adaptive, rules 24–28 and A1–A13 all present.

---

## D. Implementation audit — `/mnt/project/dssme_engine.py` (self-labelled DSSME-1.2)

| Component | Contract v1.6 | Current implementation (line) | Status |
|---|---|---|---|
| SIF_v3 | floor 0.82 | `max(0.82, min(1.00, sif))` (537) | **MATCH** |
| T_v3 | includes SS_house | `ss_house` in product (604) | **MATCH** |
| T_v3 | includes SS_nav | `ss_nav` in product (604) | **MATCH** |
| T_v3 | clamp 0.58–1.00 | `max(0.58, min(1.00, …))` (605) | **MATCH** |
| SS_nav | Pushkara tier 1.03 (v1.5 §8 S7 table) | `compute_ss_nav` (573–585) never reads `is_pushkara`; Neutral nav returns 0.98 | **MISMATCH** |
| RB | fixed weights | `RB_TABLE` (130) equals the specified table; applied at 825; no dynamic modification anywhere in the file | **MATCH** |
| PAS_v3 | includes H | `h_val` in product (670) | **MATCH** |
| PAS_v3 | no BAV term | `i_v2 = … i_aspect * i_bav` (663); `I_BAV[8]` = 1.03 applied to a clean-aspect planet | **MISMATCH** |
| PAS_v3 | clamp 0.58–1.14 | coded `(0.57, 1.18)` (670) | **MISMATCH** |
| TM_v3 | no GTF | `gtf = compute_gtf` in product (728–729); supplying a GOCHARA entry moved Mars 1.0612 → 1.0800 | **MISMATCH** |
| TM_v3 | clamp 0.90–1.05 | coded `(0.88, 1.08)` (729) | **MISMATCH** |
| Gochara | absent | `compute_gtf` reads `chart["GOCHARA"]` (703–717) | **MISMATCH** |
| BHF bonus | H2/H5/H8/H11, once | `spec_houses` (745); `min(1.05, base*1.01)` (756–758) | **MATCH** |
| BHF band | `BB_norm < 0.55` → 0.88 | final `else 0.92` (755); returns 0.92 for every value below 0.70 | **MISMATCH** |
| DRF | AD-secondary ×1.01 / ×0.98, once | lines 776–780; probe: 1.04 × 0.98 = 1.0192 | **MATCH** |
| DRF | MD tiers Friend 1.02 / Enemy 0.94 | `friend 1.04`, `enemy 0.88` (774); probe: Friend → 1.04, Enemy → 0.88 | **MISMATCH** |
| VGF | separate from SS_nav | `compute_vgf` (785) and `compute_ss_nav` (573) are separate; Vargottama Sun: 1.04 vs 1.06 | **MATCH** |
| S12 | Moon excluded from `n`, `D` | `n = len(survivors)` (855), `D` over all survivors (859) | **MISMATCH** |
| Step K | Moon zero digits | `if p == "Moon": continue` (885) | **MATCH** |
| Upstream interface, no-mutation ingestion (§2.4) | — | No upstream engine or fixtures in this environment | **NOT_VALIDATABLE** |
| Acceptance A1–A13 end to end | — | No fixture chart files exist, so the pipeline was not run end to end | **NOT_VALIDATABLE** |
| Determinism (static) | identical input → identical output | Imports are `importlib.util, json, sys, argparse, statistics`; no random, time, uuid, environment, network, or extra file I/O | Supported statically, not verified end to end |

Weight of the S12 mismatch: in the probe, the same five survivors classify as **FRAGMENTED** (n = 5, D = 0.257) with Moon
counted and **STRIKE** (n = 4, D = 0.333) without it. The engine's current behavior can change the field type.

S11, Step L and S15 were read but not probed. v1.6 does not change them, so no conformance claim is made.

### Probe output (verbatim)

```text
[MATCH          ] RB fixed weights: RB_TABLE == contract table: True
[MATCH          ] SIF_v3 floor: worst-case SIF = 0.85 (clamp literal max(0.82, ...) at engine line 537)
[MATCH          ] T_v3 has SS_house: detail keys=['PC', 'SS_bav', 'SS_dignity', 'SS_house', 'SS_nav', 'VR', 'ZC']
[MATCH          ] T_v3 has SS_nav: SS_nav(Sun, neutral nav)=0.98
[MISMATCH       ] SS_nav Pushkara tier (v1.5 table = 1.03): engine returns 0.98 (nav_dignity=Neutral); is_pushkara is never read by compute_ss_nav
[MATCH          ] PAS_v3 includes H: H(Angular)=1.03
[MISMATCH       ] PAS_v3 has no I_bav (clean aspect, BAV=8): I_v2=1.03 with no aspects (contract: I_aspect = 1.00); I_BAV[8]=1.03 is applied
[MISMATCH       ] PAS_v3 clamp [0.58,1.14]: engine achieves min=0.570 max=1.147; coded clamp is (0.57, 1.18) at line 670
[MISMATCH       ] TM_v3 has no GTF: TM(Mars) 1.0612 -> 1.0800 when a GOCHARA entry is supplied; changed=True
[MISMATCH       ] Gochara absent from engine input: engine reads chart['GOCHARA'] (compute_gtf, line 703-717); TM clamp coded (0.88, 1.08) at line 729
[MATCH          ] BHF spec-house bonus once: H5 norm~1.04 -> 1.0201; H3 same norm -> 1.01; H5 strong -> 1.05
[MISMATCH       ] BHF band BB_norm < 0.55 (contract 0.88): engine returns 0.92 (final else-branch at line 755 is 0.92)
[MATCH          ] DRF AD-secondary applied once: Moon: MD-friend tier x AD-enemy 0.98 -> 1.0192
[MISMATCH       ] DRF MD tier Friend = 1.02 (v1.5 §9.2): Moon (Friend of Sun MD) -> 1.04
[MISMATCH       ] DRF MD tier Enemy = 0.94 (v1.5 §9.2): Venus (Enemy of Sun MD) -> 0.88
[MATCH          ] VGF separate from SS_nav: Vargottama Sun: SS_nav=1.04 (inside T_v3), VGF=1.06 (top-level); two functions, two tables
[MISMATCH       ] S12 excludes Moon from n and D: with Moon: type=FRAGMENTED n=5 D=0.257; digit-bearing only: type=STRIKE n=4 D=0.333
```

---

## E. Open items

**Contract (§22.2)** — genuinely unresolved, nothing resolved by editing a value:
1. Clamp recalibration for T_v3 / TM_v3; PAS_v3 clamp provisional; SIF 0.82 locked but non-binding.
2. Dual reading of dignity (`SS_dignity` S7 vs `D` S9).
3. **Overlap between SS_nav and VGF** — separate by definition, but both reward Vargottama / Pushkara / Navamsha dignity.
4. **DRF Great Friend / Great Enemy tiers** cannot be derived from the Natural Friendship Table.
5. **S12 populations for T̄ and archetype composition** — the Moon decision specifies `n` and `D` only.
6. S1 combination table gap and the undefined "other axes" in the SAV rule.
7. Step K modifier ranges (volatile +10–15%; 6th/12th magnitude and stacking).
8. 3D volatile-mass metric cannot detect triplet-level concentration.
9. Legacy V2.1-compatibility mode not re-derived after `I_bav` removal.

**Implementation work implied by v1.6** (no engine edits were made): remove `GTF`/`GOCHARA` and the 0.88–1.08 TM clamp;
remove `I_bav` and set the PAS clamp to 0.58–1.14; compute S12 `n`/`D` over `P_digit`; fix the BHF `< 0.55` band;
add the SS_nav Pushkara tier; decide the DRF MD-tier mapping (item 4). The reference files in `/mnt/project`
(`SKILL.md`, `pipeline-cps.md`, `extraction.md`, `geometry-*.md`, …) still carry v1.2-era text (17 blocks, GTF, `I_bav`) and
will contradict v1.6 until regenerated.
