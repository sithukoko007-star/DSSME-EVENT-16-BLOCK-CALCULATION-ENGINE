---
name: dssme-universal-master-prompt
version: Universal-1.5
title: DSSME Production Architectural Specification & Master Contract
document_type: Technical Architecture Contract
authority_model: "DSSME Native Engine = Primary Authority; PDF Extraction = Optional Non-Authoritative Validation"
architecture_invariants:
  discontinuities: 2 (S11 Core Survival Gate, S15 Final Authorization)
  mathematical_nature: "Continuous, multiplicative, non-eliminative, deterministic, non-adaptive, acyclic"
  active_blocks: 16 (Block 17 Retired)
  geometries: ["ordered_2_digit", "ordered_3_digit"]
---

# DSSME Production Architectural Specification & Master Contract
## Deterministic Structural Speculative Modeling Engine — V1.5 Specification

---

## 1. SYSTEM IDENTITY, PURPOSE & AXIOMATIC FOUNDATION

### 1.1 Scope and Objective
The Deterministic Structural Speculative Modeling Engine (DSSME) maps an astronomical and Vedic astrological state (Parashara system, Lahiri / Chitra Paksha Ayanamsa) to a forward-only, deterministic probability distribution over discrete speculative number spaces:
- **2-Digit Ordered Pairs (`ordered_2_digit`):** 100 discrete states (`00` to `99`).
- **3-Digit Ordered Triplets (`ordered_3_digit`):** 1,000 discrete states (`000` to `999`).

### 1.2 Core Axiomatic Principles
1. **Structural Flow:** Planets exert structural pressure → Digits express pressure → Pairs/Triplets distribute pressure → Survival gates eliminate illusion.
2. **Strict Non-Adaptivity:** The engine never ingests, stores, parses, or conditions upon past outcomes or winning numbers. No feedback loop exists between results and weights.
3. **Acyclic Forward Execution:** State progression is strictly monotonic and acyclic ($S0 \to S15$).
4. **Pre-Declared Thresholds:** All survival thresholds ($\theta_s$) and selection caps ($k_{max}$) are declared *before* the numerical values they govern are evaluated.
5. **Legitimacy of Silence:** A closed field or non-surviving state produces an empty output. Halting or outputting zero candidates is a fully valid, successful analytical outcome.
6. **Exactly Two Discontinuities:** Across all versions and geometries, exactly two discontinuous, eliminative operations are permitted:
   - **Discontinuity #1:** Step $S11$ (Core Survival Gate $\theta_s$).
   - **Discontinuity #2:** Step $S15$ (Final Top-$k$ Authorization).
   All intermediate transformations ($S5$ through $S10d$, Step $K$, Step $L$) must remain strictly continuous, multiplicative, and non-eliminative.

---

## 2. DUAL-LAYER SEPARATION & VALIDATION CONTRACT (V1.5)

```
┌────────────────────────────────────────────────────────┐
│             DSSME Native Event Engine V1.0             │
│   PRIMARY CALCULATION AUTHORITY (Pure TypeScript/WASM) │
│           Input State ──► Deterministic Result         │
└──────────────────────────┬─────────────────────────────┘
                           │
           Independent Cross-Check Comparison
                           ▼
┌────────────────────────────────────────────────────────┐
│     Optional PDF Extraction Layer (Printed Data Only)  │
│  STRICTLY NON-AUTHORITATIVE / VALIDATION & AUDIT ONLY  │
│  - No parameter tuning                                 │
│  - No auto-replacement of engine results               │
│  - No third-party library fabrication of missing text  │
└────────────────────────────────────────────────────────┘
```

1. **Autonomous Execution:** The DSSME primary calculation engine operates independently. It must never require a PDF extraction artifact to compute its outputs.
2. **Strict Read-Only Reference:** When available, PDF extraction serves solely as a secondary audit layer.
3. **No Synthetic Fill:** Missing PDF values must be flagged as `NOT_FOUND`. An extraction agent must never use third-party libraries (e.g. PyJHora, Swiss Ephemeris) to generate missing printed figures inside an extraction file.
4. **Validation Mismatch Protocol:** If the native engine result deviates from printed PDF data, the system records `VALIDATION_MISMATCH` with diagnostic telemetry. The engine output must not be automatically overwritten or force-fitted.
5. **One-Way Barrier:** Data and outcomes from the validation layer never feed back into algorithm constants, role biases, or threshold configurations.

---

## 3. INPUT SPECIFICATION CONTRACT

An execution run requires the following immutable input vector:

```typescript
interface DssmeExecutionInput {
  // Astronomical & Temporal Coordinates
  date: string;               // ISO format "YYYY-MM-DD"
  time: string;               // Local civil "HH:MM:SS"
  timezone: string;           // Standard IANA string (e.g., "Asia/Tokyo", "Asia/Yangon")
  timezoneOffset: number;     // Decimal hours from UTC (e.g., +9.0, +6.5, -5.0)
  latitude: number;           // Decimal degrees [-90.0, +90.0]
  longitude: number;          // Decimal degrees [-180.0, +180.0]
  ayanamsa: "Lahiri";         // Strictly Chitra Paksha / Lahiri

  // Execution Configuration
  bodyMode: "7-body" | "9-body";
  objective: string;          // Single explicit intent (e.g., "short-cycle speculative extraction")
  risk: "LOW" | "MEDIUM" | "HIGH" | "OBSERVE";
  geometry: "ordered_2_digit" | "ordered_3_digit";
  
  // Astrological & Environmental Context
  lagnaType: "Movable" | "Fixed" | "Dual";
  volatilityFlags: {
    eclipseProximity: boolean; // Within 14 days of solar/lunar eclipse
    gandantaActive: boolean;   // Moon or Lagna in 3°20' junction of water/fire signs
    ingressStacking: boolean;  // ≥2 planetary ingresses within 24h
    amavasyaZone: boolean;     // Krishna 15 / Amavasya ±1 tithi
    purnimaZone: boolean;      // Shukla 15 / Purnima ±1 tithi
  };
  phaseStress: {
    newMoonProximityHrs: number;
    fullMoonProximityHrs: number;
    ingressWithin24h: string[];
    signBoundaryPlanets: string[];
    stressLevel: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  };
  ashtakavarga: {
    bavCurrentSign: Record<string, number>;
    savValues: number[];       // 12 signs, Aries-first [0..11]
    savH2: number;
    savH5: number;
    savH8: number;
    savH11: number;
  };
}
```

---

## 4. PHASE 0 — CONSTITUTION LAYER ($S0$–$S4$)

### Step S0: State Lock
All coordinates, parameters, and environmental flags are cryptographically or logically frozen into immutable state $S0$. No downstream modifier may alter $S0$.

### Step S1: Environmental Gate & Regime Determination
Evaluates calendar, solar-lunar topology, and volatility flags without reference to individual planetary strengths:

1. **Active Volatility Load:**
   - 0 flags: Low resistance.
   - 1 flag: Moderate resistance (DAMPED bias).
   - 2 flags: Enforced `DAMPED`.
   - $\ge 3$ flags: Immediate `CLOSED` (run terminates).
2. **Structural Coherence:**
   - High: Shukla Paksha, Tithi 2–12, stable Nakshatra, Movable Lagna.
   - Low: Krishna Paksha, Tithi 1/14/15, Gandanta Nakshatra, Fixed Lagna.
3. **Speculative Pressure ($SAV_{spec}$):**
   $$SAV_{spec} = SAV_{H5} + SAV_{H11}$$
   - $SAV_{spec} < 48 \implies$ Bias toward `DAMPED`.
   - $48 \le SAV_{spec} \le 58 \implies$ Neutral.
   - $SAV_{spec} > 58 \implies$ Bias toward `OPEN`.
4. **Final Regime Synthesis:**
   $$\text{Regime} \in \{\text{OPEN}, \text{DAMPED}, \text{CLOSED}\}$$
   *Rule:* If $\text{Regime} = \text{CLOSED}$, terminate execution immediately with empty output.

### Step S2: Intent Lock
Freezes intent vector $\mathbf{O} = (\text{Objective}, \text{Risk}, \text{Geometry})$. Only speculative houses (2nd, 5th, 8th, 11th) are evaluated.

### Step S3: Mode & Policy Selection
Maps Regime and Risk posture to operating Mode:

| Regime | Risk Posture | Selected Mode | $k_{max}$ (2D) | $k_{max}$ (3D) | Pre-Declared $\theta_s$ |
|:---|:---|:---|:---:|:---:|:---:|
| **OPEN** | HIGH | PRECISION | 3–8 (def 5) | 3–6 (def 4) | 0.55 |
| **OPEN** | MEDIUM | ACCUMULATION | 8–15 (def 10) | 6–12 (def 8) | 0.45 |
| **OPEN** | LOW | ACCUMULATION | 8–15 (def 10) | 6–12 (def 8) | 0.45 |
| **OPEN** | OBSERVE | OBSERVATION | 15–25 (def 20) | 12–20 (def 15) | 0.35 |
| **DAMPED** | HIGH | PRECISION | 3–8 (def 5) | 3–6 (def 4) | 0.60 |
| **DAMPED** | MEDIUM | ACCUMULATION | 8–15 (def 10) | 6–12 (def 8) | 0.55 |
| **DAMPED** | LOW | OBSERVATION | 15–25 (def 20) | 12–20 (def 15) | 0.45 |
| **DAMPED** | OBSERVE | OBSERVATION | 15–25 (def 20) | 12–20 (def 15) | 0.45 |
| **CLOSED** | ANY | ABORT | 0 | 0 | — |

### Step S4: Eligibility Filter
Constructs eligible planetary set $P_E$:
- 7-body: $\{\text{Sun}, \text{Moon}, \text{Mars}, \text{Mercury}, \text{Jupiter}, \text{Venus}, \text{Saturn}\}$.
- 9-body: Adds $\{\text{Rahu}, \text{Ketu}\}$.
*Condition:* If $|P_E| = 0$, abort execution.

---

## 5. ZERO-WAVE SAFETY GATE ($Z1$–$Z4$)

Evaluated prior to CPS computation using global planetary configuration:

- **Z-1 Entropy Factor:** Occupied house count $h$ by classical 7 planets:
  - $h \le 3$: Hyper-compressed $\implies$ `DAMPED`/`CLOSED` pressure.
  - $4 \le h \le 6$: Optimal dispersion $\implies$ `OPEN`.
  - $h \ge 7$: Hyper-scattered $\implies$ `DAMPED` pressure.
- **Z-2 Lunar Environment Stability:** Evaluates Moon condition:
  - Moon combust, OR aspected by $\ge 2$ malefics (score $\ge 40$), OR dignity $\in \{\text{Enemy}, \text{Debilitated}\} \implies$ `DAMPED` pressure.
  - Otherwise $\implies$ `OPEN`.
- **Z-3 Volatility Load:** Evaluates dynamic amplifiers:
  - Mars ignition (Aries/Scorpio or conj. Rahu/Ketu within 5°).
  - Rahu activation (angular house with $\ge 2$ planets within 10°).
  - Ketu fragmentation (conj. Sun/Moon within 8°).
  $$\text{Amplifier Count} = 0 \implies \text{Calm}; \quad 1 \implies \text{Manageable}; \quad 2 \implies \text{DAMPED}; \quad \ge 3 \implies \text{CLOSED}.$$
- **Z-4 Phase Stress:** New moon proximity $< 24\text{h}$ or Full moon proximity $< 24\text{h} \implies$ High stress.

### Regime & ZW_STATE Reconciliation Law
$$\text{Effective Regime} = \min(\text{Regime}_{S1}, ZW\_STATE)$$
where order of restriction is $\text{OPEN} < \text{DAMPED} < \text{CLOSED}$. If $ZW\_STATE$ is more restrictive than $S1$, re-key Mode, $k_{max}$, and $\theta_s$ to the more restrictive state.

---

## 6. COMPREHENSIVE PLANETARY STRENGTH (CPS) PIPELINE

### 6.1 Master CPS Equation
For each eligible planet $p \in P_E$:
$$\mathbf{CPS_{pre\_v3}}(p) = S(p) \times SIF_{v3}(p) \times T_{v3}(p) \times RB(p) \times PAS_{v3}(p) \times TM_{v3}(p) \times BHF(p) \times DRF(p) \times VGF(p)$$

```
                                  CPS_pre_v3 Multiplier Pipeline
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│  S(p)   │──►│ SIF_v3  │──►│  T_v3   │──►│  RB(p)  │──►│ PAS_v3  │──►│  TM_v3  │──►│ BHF(p)  │──►│ DRF(p)  │──►│ VGF(p)  │
│  (0, 1] │   │[0.82, 1]│   │[0.58, 1]│   │[0.8,1.2]│   │[0.58,1.14]│ │[0.9,1.05]│  │[0.88,1.05│  │[0.88,1.08│  │[0.93,1.06│
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
```

---

### 6.2 Step S5: Normalized Shadbala $S(p)$
$$RS(p) = \text{Sthana} + \text{Dig} + \text{Kaala} + \text{Chesta} + \text{Naisargika} + \text{Drig}$$
$$S(p) = \frac{RS(p)}{\max_{q \in P_E} RS(q)} \quad \in (0, 1]$$
*Axiom:* Bhava Bala must never enter $RS(p)$.

---

### 6.3 Step S6: Structural Integrity Filter ($SIF_{v3}$)
$$SIF_{v3}(p) = \text{clamp}_{[0.82, 1.00]} \left( \min(KIF(p), DIF(p), AIF(p), CIF(p), YIF(p)) \right)$$

1. **Kaala Inflation Factor ($KIF$):**
   $$ratio = \frac{\text{Kaala\_pct}}{\text{mean}(\text{Sthana\_pct}, \text{Dig\_pct}, \text{Chesta\_pct}, \text{Drig\_pct})}$$
   - $ratio \le 1.5 \implies 1.00$; $\quad 1.5 < ratio \le 2.5 \implies 0.95$; $\quad ratio > 2.5 \implies 0.85$.
2. **Drig Imbalance Factor ($DIF$):**
   - $\text{Drig\_Bala} \ge 0 \implies 1.00$; $\quad -20 \le \text{Drig\_Bala} < 0 \implies 0.95$; $\quad \text{Drig\_Bala} < -20 \implies 0.85$.
3. **Axis Dominance Factor ($AIF$):**
   $$max\_share = \frac{\max(\text{Components})}{RS(p)}$$
   - $max\_share \le 0.45 \implies 1.00$; $\quad 0.45 < max\_share \le 0.60 \implies 0.95$; $\quad max\_share > 0.60 \implies 0.88$.
4. **Cluster Echo Factor ($CIF$):**
   - $\ge 3$ planets in sign: $SAV \ge 30 \implies 0.97$; $25–29 \implies 0.93$; $< 25 \implies 0.88$.
   - 2 planets in sign: $SAV \ge 28 \implies 0.98$; $< 28 \implies 0.95$.
   - No cluster: $1.00$.
5. **Yoga Integrity Factor ($YIF$):**
   $$YIF = \text{clamp}_{[0.88, 1.00]} \left( 1.00 + \sum \Delta_{yoga} \right)$$
   - Positive Yogas (Dhana $+0.03$, Lakshmi $+0.02$, Adhi $+0.02$, Raja $+0.02$, Gaja Kesari $+0.01$).
   - Negative Yogas (Daridra $-0.04$, Graha Yuddha loser $-0.04$, Shakata $-0.03$, Kemadruma $-0.03$, Paapa Kartari $-0.03$).
   *Firewall:* $YIF \le 1.00$ always (attenuation relief only; cannot boost CPS beyond parity).

---

### 6.4 Step S7: Durability & Support ($T_{v3}$)
$$T_{v3}(p) = \text{clamp}_{[0.58, 1.00]} \left( ZC(p) \times PC \times VR(p) \times SS_{v3}(p) \right)$$
$$SS_{v3}(p) = SS_{dignity}(p) \times SS_{house}(p) \times SS_{bav}(p) \times SS_{nav}(p)$$

- **Zero-Wave Compatibility ($ZC$):**
  - $ZW\_STATE = \text{OPEN}$: Volatile planet (Rahu, Ketu, Mars) $\implies 0.97$; Stable $\implies 1.00$.
  - $ZW\_STATE = \text{DAMPED}$: Volatile planet $\implies 0.85$; Stable $\implies 0.95$.
- **Phase Compatibility ($PC$):**
  - Shukla 2–12 $\implies 1.02$; Shukla 1/13–15 $\implies 0.98$.
  - Krishna 2–12 $\implies 0.94$; Krishna 1/13–15 $\implies 0.88$.
- **Volatility Resistance ($VR$):**
  - Amplifiers $= 0 \implies 1.00$.
  - Amplifiers $= 1$: If $p$ is the amplifier $\implies 0.85$, else $0.95$.
  - Amplifiers $\ge 2$: If $p \in \{\text{Rahu}, \text{Mars}, \text{Ketu}\} \implies 0.80$, else $0.90$.
- **Structural Support ($SS$ Components):**
  - $SS_{dignity}$: Exalted/Own $1.00$, Moolatrikona $0.98$, Grt.Friend $0.97$, Friend $0.96$, Neutral $0.95$, Enemy $0.90$, Grt.Enemy $0.88$, Debilitated $0.75$.
  - $SS_{house}$: Angular $1.00$, Succedent $0.98$, Cadent $0.95$.
  - $SS_{bav}$ (from $BAV_{CURRENT\_SIGN}$): Bindu $7–8 \implies 1.00$; $6 \implies 0.99$; $5 \implies 0.97$; $4 \implies 0.95$; $3 \implies 0.92$; $2 \implies 0.89$; $1 \implies 0.87$; $0 \implies 0.85$.
  - $SS_{nav}$ (Navamsha): Vargottama $1.04$, Pushkara $1.03$, Exalted $1.02$, Own/Moolatrikona $1.01$, Friend $1.00$, Neutral $0.98$, Enemy $0.95$, Debilitated $0.91$.

---

### 6.5 Step S8: Role Bias ($RB$)
Static, objective-locked multipliers (Range $[0.80, 1.20]$):
- Jupiter: $1.15$
- Venus: $1.15$
- Mercury: $1.10$
- Rahu: $1.10$
- Mars: $1.05$
- Moon: $0.95$
- Sun: $0.95$
- Ketu: $0.90$
- Saturn: $0.85$

---

### 6.6 Step S9: Activation & Interaction ($PAS_{v3}$)
$$PAS_{v3}(p) = \text{clamp}_{[0.58, 1.14]} \left( D(p) \times C(p) \times R(p) \times I_{aspect}(p) \times H(p) \times DCF(p) \right)$$

- **Dignity ($D$):** Exalted $1.05$, Own/MT $1.03$, Grt.Friend $1.02$, Friend $1.01$, Neutral $1.00$, Enemy $0.96$, Grt.Enemy $0.93$, Debilitated $0.92$.
- **Combustion ($C$):** Not combust $1.00$, Mild (outer 50%) $0.95$, Severe (inner 50%) $0.85$.
- **Retrograde ($R$):** Direct $1.00$, Retrograde $0.97$.
- **Aspect Interaction ($I_{aspect}$):** Clean $1.00$, Mild hostile $0.97$, Severe hostile $0.88$, Benefic support $1.02$.
- **House Type ($H$):** Angular $1.03$, Succedent $1.00$, Cadent $0.95$.
- **Dispositor Chain Factor ($DCF$):**
  - If self-disposited (Own/Exalted sign): $DCF = 1.03$.
  - Otherwise, evaluate dispositor $q = \text{disp}(p)$ normalized strength $S(q)$:
    - $S(q) \ge 0.85 \implies 1.03$; $0.70–0.84 \implies 1.01$; $0.50–0.69 \implies 1.00$; $0.35–0.49 \implies 0.97$; $< 0.35 \implies 0.94$.
    - Modified by dispositor dignity (Debilitated $\times 0.95$, Exalted/Own $\times 1.01$).
    - $DCF = \text{clamp}_{[0.92, 1.03]}(DCF_{base} \times \text{modifier})$.

*Axiom (v1.3 Patch):* $I_{v2} = I_{aspect}$. $I_{bav}$ is permanently removed to eliminate BAV double-counting.

---

### 6.7 Step S10: Temporal Modulation ($TM_{v3}$)
$$TM_{v3}(p) = \text{clamp}_{[0.90, 1.05]} \left( DLR(p) \times TF \times NF(p) \times HP(p) \right)$$
*(Gochara / Transit Factor GTF is permanently retired in v1.4).*

1. **Day Lord Resonance ($DLR$):** Ruler = Weekday Lord:
   - $p = \text{Lord} \implies 1.03$; Friend $\implies 1.01$; Neutral $\implies 1.00$; Enemy $\implies 0.98$.
2. **Tithi Factor ($TF$):** Based on Tithi index modulo 5 (Five-fold Tithi Cycle):
   - Nanda (1) $\implies 1.02$; Bhadra (2) $\implies 1.01$; Jaya (3) $\implies 1.03$; Rikta (4) $\implies 0.98$; Purna (0) $\implies 1.00$.
3. **Nakshatra Factor ($NF$):** Ruler = Vimshottari Lord of Moon's current Nakshatra:
   - $p = \text{Lord} \implies 1.03$; Friend $\implies 1.01$; Neutral $\implies 1.00$; Enemy $\implies 0.97$.
4. **Hora Position ($HP$):** Ruler = Active Hora Lord:
   - $p = \text{Lord} \implies 1.03$; Friend $\implies 1.01$; Neutral $\implies 1.00$; Enemy $\implies 0.97$.

---

### 6.8 Steps S10b–S10d: Top-Level V3 Extension Factors

#### S10b: Bhava Bala House Factor ($BHF$)
$$BB_{norm}(h) = \frac{\text{BHAVA\_BALA}[h][\text{total}]}{\text{mean}(\text{BHAVA\_BALA}[1..12][\text{total}])}$$
- $BB_{norm} \ge 1.30 \implies 1.05$; $1.15–1.29 \implies 1.03$; $1.00–1.14 \implies 1.01$; $0.85–0.99 \implies 1.00$; $0.70–0.84 \implies 0.96$; $0.55–0.69 \implies 0.92$; $< 0.55 \implies 0.88$.
- Speculative bonus: If $p$ resides in H2, H5, H8, or H11 with $BB_{norm} \ge 1.00 \implies BHF = \min(1.05, BHF \times 1.01)$.

#### S10c: Dasha Resonance Factor ($DRF$)
- If $p = \text{Mahadasha (MD) Lord} \implies DRF = 1.08$ (Immediate Halt).
- If $p = \text{Antardasha (AD) Lord} \implies DRF = 1.05$ (Immediate Halt).
- Otherwise, based on natural friendship with MD Lord:
  - Great Friend $\implies 1.04$; Friend $\implies 1.02$; Neutral $\implies 1.00$; Enemy $\implies 0.94$; Great Enemy $\implies 0.88$.
  - Secondary AD modifier: Friend of AD $\times 1.01$; Enemy of AD $\times 0.98$.
  - $DRF = \text{clamp}_{[0.88, 1.08]}(\text{Result})$.
- **DASHA_DIVERGENCE:** If the MD Lord fails $S11$ survival, emit diagnostic flag: `DASHA_DIVERGENCE = true`.

#### S10d: Vargottama & Navamsha Factor ($VGF$)
- If $\text{Sign}_{D1}(p) = \text{Sign}_{D9}(p)$ (Vargottama) $\implies VGF = 1.06$ (Immediate Halt).
- Else if $p$ in Pushkara Navamsha zone $\implies VGF_{pushkara} = 1.04$, else $1.00$.
- D-9 Dignity: Exalted $1.02$, Own/MT $1.01$, Friend $1.00$, Neutral $0.99$, Enemy $0.97$, Debilitated $0.93$.
- $VGF = \text{clamp}_{[0.93, 1.06]}(VGF_{pushkara} \times \text{DignityModifier})$.

---

## 7. STEP S11: CORE SURVIVAL GATE (DISCONTINUITY #1)

The first eliminative barrier evaluates all eligible planets against the pre-declared threshold $\theta_s$:

$$P_S = \{ p \in P_E \mid \mathbf{CPS_{pre\_v3}}(p) \ge \theta_s \}$$

### Operational Laws of S11
1. **Immutable Threshold:** $\theta_s$ is declared at $S3$ and cannot be altered after computing CPS.
2. **Zero Survivors:** If $|P_S| = 0$, abort the run immediately. Silence is the correct result.
3. **Irreversible Exclusion:** Planets falling below $\theta_s$ are discarded permanently.

---

## 8. STEP S12: FIELD TOPOLOGY & CLASSIFICATION

Computes descriptive topological metrics over surviving set $P_S$:
- Cardinality: $n = |P_S|$.
- Dominance Ratio: $D = \frac{\max_{p \in P_S} CPS(p)}{\sum_{q \in P_S} CPS(q)}$.
- Durability Density: $\bar{T} = \text{mean}_{p \in P_S}(T_{v3}(p))$.

### Priority Classification Table
| Priority | Trigger Condition | Assigned Field Type |
|:---:|:---|:---|
| **1** | $n \le 2$ | `COMPRESSED` |
| **2** | $n \le 4 \quad \text{AND} \quad D \ge 0.30$ | `STRIKE` |
| **3** | $\bar{T} < 0.70$ | `VOLATILE` |
| **4** | $n \ge 5 \quad \text{AND} \quad D < 0.20$ | `STABLE` |
| **5** | All other conditions | `FRAGMENTED` |

*SAV Triangle Enrichment:* Evaluates $SAV_{triangle} = SAV_{H5} + SAV_{H8} + SAV_{H11}$ to append descriptive modifiers (`STABLE_STRONG`, `STRIKE_GAIN`, etc.) without altering numeric distributions.

---

## 9. STEP K: DIGIT VECTOR FORMATION ($D_0 \dots D_9$)

Converts surviving planets $P_S$ into a unnormalized digit pressure vector $\mathbf{D} = [D_0, \dots, D_9]$.

### 9.1 Base Planet Digit Allocation (K.1)
- **Sun:** Primary `1`, Secondary `4`
- **Moon:** Timing anchor only — **Contributes NO digits, ever**
- **Mars:** Primary `9`, Secondary `3`
- **Mercury:** Primary `5`, Secondary `0, 2, 8`
- **Jupiter:** Primary `3`, Secondary `7`
- **Venus:** Primary `6`, Secondary `2, 9`
- **Saturn:** Primary `8`, Secondary `4`
- **Rahu:** Primary `4`, Secondary `0, 8`
- **Ketu:** Primary `7`, Secondary `2`

### 9.2 Overlay Layers (K.2–K.4)
- **Sign Overlays (K.2):** Aries (9,1), Taurus (6), Gemini (5), Cancer (2), Leo (1), Virgo (5,2), Libra (6), Scorpio (8), Sagittarius (3,9), Capricorn (8,4), Aquarius (4,7), Pisces (0).
- **Nakshatra Overlays (K.3):** 27 Nakshatras contribute designated primary and secondary digits.
- **House Overlays (K.4):** 5th (3,9), 11th (6,8), 9th (1,6), 2nd (4,1), 8th (7). 6th/12th attenuate weakest digit.

### 9.3 Emphasis Tiering & Aggregation (K.6–K.9)
Each digit assigned to planet $p$ receives emphasis weight $E(p, d)$:
- Base Primary: $1.00$
- Reinforced by Sign/Nakshatra: $0.85$
- Standard Secondary: $0.60$
- Minor/Echo Source: $0.40 / 0.20$
- Volatile Planet Modifier: $+10\%\dots+15\%$ to base digits for Rahu, Ketu, Mars.

$$Contribution(p, d) = \mathbf{CPS_{pre\_v3}}(p) \times E(p, d)$$
$$D_d = \sum_{p \in P_S} Contribution(p, d) \quad \text{for } d \in \{0, \dots, 9\}$$

*Axiom (K.5 Moon-Skip):* Moon contributes no digits to vector $\mathbf{D}$.

---

## 10. STEP L: GEOMETRY-DEPENDENT DISTRIBUTION

Evaluates either 2D or 3D geometry depending on $S0$:

### 10.1 2D Pair Bias Matrix (`ordered_2_digit`)
Evaluates the Cartesian space of 100 ordered pairs ($00$ to $99$):
$$W(XY) = D_X \times D_Y$$
$$S_{2D} = \sum_{X=0}^{9} \sum_{Y=0}^{9} W(XY)$$
$$P(XY) = \frac{W(XY)}{S_{2D}}$$
*Verification:* $\left| \sum P(XY) - 1.0000 \right| \le 1 \times 10^{-9}$.

- **Primary Pool:** Top pairs up to cumulative $P \ge 0.35$ or max 6 pairs.
- **Secondary Pool:** Next pairs up to cumulative $P \in [0.70, 0.85]$ or max 12 pairs.
- **Burst Pool:** Pairs with volatile digits $\{0, 4, 7, 9\}$ (6–10 pairs, time-gated).

### 10.2 3D Triple Bias Tensor (`ordered_3_digit`)
Evaluates the tensor space of 1,000 ordered triplets ($000$ to $999$):
$$W(XYZ) = D_X \times D_Y \times D_Z$$
$$S_{3D} = \sum_{X=0}^{9} \sum_{Y=0}^{9} \sum_{Z=0}^{9} W(XYZ)$$
$$P(XYZ) = \frac{W(XYZ)}{S_{3D}}$$
*Verification:* $\left| \sum P(XYZ) - 1.0000 \right| \le 1 \times 10^{-9}$.

- **Primary Pool:** Top triplets up to cumulative $P \ge 0.12$ or max 5 triplets.
- **Secondary Pool:** Next triplets up to cumulative $P \in [0.35, 0.45]$ or max 18 triplets.
- **Burst Pool:** Triplets containing $\ge 2$ volatile digits $\{0, 4, 7, 9\}$.
- **Volatile Mass Thresholds:**
  $$VM = \frac{\sum_{d \in \{0,4,7,9\}} D_d}{\sum_{d=0}^{9} D_d}$$
  - $VM > 0.35 \implies$ Enforce Burst window restriction.
  - $VM > 0.50 \implies$ Compress Primary to Compact-3 only; full Burst restriction.

---

## 11. STEP S15: FINAL AUTHORIZATION (DISCONTINUITY #2)

Selects candidate pairs or triplets up to pre-declared $k_{max}$.

```
┌────────────────────────────────────────────────────────┐
│   Unconstrained Ranked Pool (Sorted by W descending)   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
           Enforce Diversity & Core Constraints
           - 2D: No digit > 40% of k_max
           - 3D: No digit > 50% in pos 1 OR pos 2
           - Core participation ≥ 60%
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
   Constraints Met                      Short of k_max
        │                                     │
        ▼                                     ▼
Top-k Authorized                     Relax Diversity Cap
                                     (Never relax Core)
```

1. **Diversity Cap Constraint:**
   - 2D: No single digit may exceed $40\%$ frequency across selected $k_{max}$ pairs.
   - 3D: No single digit may exceed $50\%$ frequency in the hundreds position **OR** $50\%$ in the tens position.
2. **Core Participation Constraint:** At least $60\%$ of authorized entities must contain a Core-tier digit.
3. **Under-Filled Fallback Rule:** If constraints cannot be satisfied simultaneously, relax the diversity cap first. If still short, emit fewer candidates with `"under_filled": true`. Never fabricate synthetic candidates.
4. **Soft Mode Triggers (Exposure Reduction 50%):**
   - 2D: Top-10 cumulative $P < 0.25$.
   - 3D: Top-20 cumulative $P < 0.15$.
5. **Deterministic Tie-Break:** Ascending lexicographical order (`00` $\to$ `99` or `000` $\to$ `999`).

---

## 12. OPTIONAL PRINTED-PDF EXTRACTION DATA BLOCKS

When executing the non-authoritative PDF audit extraction, the 16 active blocks must be structured as follows:

```
BLOCK_1:  IDENTITY           (Date, time, coordinates, Lagna, LagnaType, geometry)
BLOCK_2:  PANCHANGA          (Tithi, Nakshatra, Yoga, Weekday Lord, 5 volatility flags)
BLOCK_3:  DASHA              (Vimshottari MD, AD, PD, min. 5 upcoming ADs)
BLOCK_4:  PLANETS            (Longitudes, Nakshatras, houses, combust/retrograde flags)
BLOCK_5:  HOUSES             (12 houses: signs, lords, occupants, Angular/Succedent/Cadent)
BLOCK_6:  SHADBALA           (Total virupas, 6 components, columns Sun..Saturn)
BLOCK_7:  BHAVA_BALA         (12 house totals; NEVER added to Shadbala RS)
BLOCK_8:  BAV                (7 planets + Lagna, strictly reordered Aries-first)
BLOCK_9:  SAV                (12 signs, grand total ~337, H2/H5/H8/H11 values)
BLOCK_10: BAV_CURRENT_SIGN   (Planet own-sign bindus; Rahu->Saturn row, Ketu->Mars row)
BLOCK_11: ASPECTS_PLANETS    (Planet-to-planet aspects and virupa scores)
BLOCK_12: ASPECTS_BHAVAS     (Aspects on 12 bhava cusps)
BLOCK_13: ENGINE_FLAGS       (Dignity, retrograde, combustion, sign clusters)
BLOCK_14: PHASE_STRESS       (Lunar proximity hours, ingresses, stress level)
BLOCK_15: NAVAMSHA           (D-9 signs, dignities, Vargottama, Pushkara flags)
BLOCK_16: YOGA_LIST          (Identified yogas classified into spec_positive/negative)
BLOCK_17: RETIRED            (Gochara/Transit permanently removed in v1.4)
```

---

## 13. CANONICAL OUTPUT JSON CONTRACT

```json
{
  "version": "V1.5",
  "geometry": "ordered_2_digit",
  "regime": "OPEN",
  "zw_state": "OPEN",
  "mode": "ACCUMULATION",
  "threshold": 0.45,
  "lagna_type": "Movable",
  "volatility_flag_count": 0,
  "phase_stress_level": "NONE",
  "survivors": ["Sun", "Mars", "Jupiter", "Venus"],
  "dasha_divergence": false,
  "field_type": "STABLE",
  "field_type_enriched": "STABLE_STRONG",
  "digit_vector_normalized": {
    "0": 0.0521, "1": 0.1834, "2": 0.0712, "3": 0.1645, "4": 0.0431,
    "5": 0.0812, "6": 0.1945, "7": 0.0612, "8": 0.0521, "9": 0.0967
  },
  "primary_cluster": ["6", "1", "3"],
  "volatile_digits": ["4", "7", "9"],
  "volatile_mass_pct": 0.2010,
  "authorized_candidates": [
    {
      "code": "61",
      "p_raw": 0.0356,
      "category": "Primary",
      "time_gate": null,
      "composition": {"d1": "6", "d2": "1"}
    }
  ],
  "compact_set": ["61", "16", "63", "36"],
  "k_max": 10,
  "soft_mode_active": false,
  "under_filled": false,
  "warnings": []
}
```

---

## 14. THE 23 NON-NEGOTIABLE SYSTEM LAWS

1. **Law of Invariant Discontinuities:** Exactly two discontinuities ($S11$ and $S15$) exist across all versions and geometries.
2. **Law of Absolute Halting:** If $ZW\_STATE = \text{CLOSED}$ or $\text{Regime} = \text{CLOSED}$, output nothing immediately.
3. **Law of Pre-Declared Survival:** $\theta_s$ must be pre-declared at $S3$; it cannot be tuned post-CPS evaluation.
4. **Law of Pre-Declared Top-K:** $k_{max}$ must be fixed at $S3$ prior to ranking.
5. **Law of Non-Elimination in Pipeline:** Steps $S5$ through $S10d$ are strictly non-eliminative.
6. **Law of Determinism:** Identical input vectors must produce identical bit-level output.
7. **Law of Zero Historical Feedback:** Historical winning outcomes must never feed back into weights, biases, or thresholds.
8. **Law of Outcome Agnosticism:** Past winning draws must never be supplied to the engine context.
9. **Law of Valid Silence:** An empty output is a successful, valid system execution.
10. **Law of Bhava Bala Isolation:** Bhava Bala must never be summed into Shadbala $RS(p)$.
11. **Law of Unknown Flag Safety:** Missing volatility flags default $Z-3$ to `DAMPED`.
12. **Law of Unknown Stress Safety:** Missing phase stress data defaults $Z-4$ to `DAMPED`.
13. **Law of Bhava Total Exclusivity:** $BHF$ consumes Bhava Bala house totals only.
14. **Law of DRF Ceiling:** $DRF \le 1.08$ strictly.
15. **Law of YIF Attenuation Cap:** $YIF \le 1.00$ strictly (yoga cannot boost overall CPS beyond base).
16. **Law of VGF Ceiling:** $VGF \le 1.06$ strictly.
17. **Law of DCF Range:** $DCF \in [0.92, 1.03]$.
18. **Law of Graceful Block Degradation:** Missing V3 enhancement blocks ($15, 16$) default to $1.00$ and do not abort.
19. **Law of 3D Commutative Weighting:** $W(XYZ) = D_X \times D_Y \times D_Z$ without positional bias.
20. **Law of 3D Soft-Mode Bounds:** 3D Soft Mode triggers at top-20 cumulative $P < 0.15$.
21. **Law of Mandatory Vector Graph:** The Digit Vector Graph is mandatory in 3D execution.
22. **Law of BAV Single Count (v1.3):** BAV bindu count enters CPS exactly once through $SS_{bav}$ in $T_{v3}$.
23. **Law of Transit Retirement (v1.4):** Gochara/Transit (Block 17 and GTF) is permanently retired.

---

## 15. MASTER OPERATIONAL EXECUTION CHECKLIST

```
[ ] S0: Verify all temporal, geographic, and astrological inputs are locked.
[ ] S1: Determine Regime (OPEN, DAMPED, CLOSED). If CLOSED -> Terminate.
[ ] S2: Lock single objective and geometry (2D or 3D).
[ ] S3: Pre-declare Mode, k_max, and theta_s before evaluating CPS.
[ ] S4: Verify non-empty eligible planet set P_E.
[ ] Z-Gate: Evaluate Z1, Z2, Z3, Z4. Reconcile effective regime. If CLOSED -> Terminate.
[ ] S5: Compute RS(p) and S(p). Verify Bhava Bala is excluded.
[ ] S6: Compute SIF_v3 (KIF, DIF, AIF, CIF, YIF). Floor >= 0.82.
[ ] S7: Compute T_v3 (ZC, PC, VR, SS_v3). Floor >= 0.58.
[ ] S8: Apply static Role Bias RB(p).
[ ] S9: Compute PAS_v3 with DCF. Verify I_bav is absent. Range [0.58, 1.14].
[ ] S10: Compute TM_v3 (DLR, TF, NF, HP). Range [0.90, 1.05]. Verify GTF is absent.
[ ] S10b-d: Compute BHF, DRF, VGF. Check DASHA_DIVERGENCE.
[ ] S11: Apply Core Survival Gate with pre-declared theta_s. If |P_S| == 0 -> Terminate.
[ ] S12: Classify field topology and append SAV enrichment tags.
[ ] Step K: Form unnormalized digit vector D_0..D_9. Verify Moon contributes 0 digits.
[ ] Step L: Compute 2D Pair Matrix or 3D Triple Tensor. Checksum sum(P) == 1.0000.
[ ] S15: Select top-k using pre-declared k_max. Enforce diversity cap and core participation.
[ ] Validation: If optional PDF data is provided, cross-check and log any discrepancies.
```

---
*End of Master Contract — DSSME Universal Specification v1.5*
