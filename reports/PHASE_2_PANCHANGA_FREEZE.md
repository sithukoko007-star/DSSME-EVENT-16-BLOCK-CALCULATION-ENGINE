# DSSME Phase 2: Panchanga Engine Freeze & Audit Document

**Gate Status**: 🟢 **PHASE 2 FROZEN (READY FOR PHASE 3)**  
**Date**: 2026-09-29  
**Engine**: DSSME Native Calculation Engine (Phases 1 & 2)

---

## 1. Executive Summary & Verification Matrix

All 7 core validation gates (A through G) plus architectural contracts have been verified via 11 deterministic test suites.

| Gate / Component | Status | Empirical Verification / Target |
| :--- | :--- | :--- |
| **Gate A — Tithi** | 🟢 PASS | 1..30 range, Paksha consistency, Shukla 15 = Purnima, Krishna 15 = Amavasya |
| **Gate B — Nakshatra** | 🟢 PASS | 1..27 range, Pada 1..4, $\epsilon_{\text{pada}} = 10^{-12}$ guard against IEEE-754 underflow; 756-point regression audit across all 108 boundaries |
| **Gate C — Yoga** | 🟢 PASS | 1..27 range, wrap-around at 360°/0°, ±1 arcsecond boundary precision |
| **Gate D — Karana** | 🟢 PASS | 1..60 half-tithis: Kimstughna (1), 7 repeating movables (2..57), Shakuni (58), Chatushpada (59), Naga (60) |
| **Gate E — Vara** | 🟢 PASS | Both 'sunrise' and 'civil' modes, pre-sunrise instants shift to preceding weekday; polar 6 AM local fallback |
| **Gate F — Boundaries** | 🟢 PASS | Numerical bisection to $86.4\ \mu\text{s}$ ($10^{-9}\text{ day}$); windows strictly contain chart instant |
| **Gate G — Provider Parity** | 🟢 PASS | $\Delta\text{Sun} = 0.0^\circ$, $\Delta\text{Moon} = 0.0^\circ$ (Tolerance: $1.0\times 10^{-9\circ}$) |
| **CanonicalChart Contract** | 🟢 PASS | `fromCanonicalChart` takes canonical Sun/Moon without recomputation; mandatory `CanonicalBodyPosition.provenance` |
| **Fail-Closed Provider** | 🟢 PASS | `createCanonicalLongitudeProvider` throws `DegradedEphemerisError` on fallback/mixed charts |
| **Tithi-Karana Identity** | 🟢 PASS | Single angular-separation source `elongation(p(t))` ($\Delta t_{\text{start}} = 0.0\text{ s}$) |
| **Timezone Contract** | 🟢 PASS | DST-safe rendering via `Intl` and IANA timezone ID |
| **API Endpoint** | 🟢 PASS | `POST /api/panchanga` live on Express server |
| **TypeScript / Build** | 🟢 PASS | `tsc --noEmit` 0 errors; `vite build` clean |
| **Security Audit** | 🟢 PASS | `npm audit = 0 vulnerabilities` |
| **Deterministic Tests** | 🟢 PASS | 11/11 suites passing cleanly |

---

## 2. Core Precision Freeze Verifications

### 2.1 Nakshatra Pada Boundary Precision & Exhaustive 756-Point Audit
In pure arithmetic, each of the 108 Padas spans $3^\circ 20' = 3.3333333333333335^\circ$. At exact rational degree boundaries (e.g., $20.0^\circ, 30.0^\circ, 60.0^\circ$), IEEE-754 subtraction `within = m - i0 * NAKSHATRA_SPAN` produces values like $1.9999999999999998$, which under raw `Math.floor` erroneously yielded Pada 2 instead of Pada 3.

To eliminate this while preventing false promotion of points below the boundary:
- **Numerical Guard**: `EPS_PADA = 1e-12` ratio units ($\approx 3.33 \times 10^{-12\circ}$).
- **Safety Margin**: $10^{-12} \gg 2.3 \times 10^{-14}$ (maximum machine float noise), but $10^{-12} \ll 10^{-10\circ}$ (algorithmic perturbation limit).
- **Exhaustive Regression Suite**:
  Every single one of the 108 Pada boundaries was tested across 7 distinct perturbation points:
  1. $\text{boundary} - 1''$ (arcsecond) $\to$ lower Pada
  2. $\text{boundary} - 1.0\times 10^{-9\circ} \to$ lower Pada
  3. $\text{boundary} - 1.0\times 10^{-10\circ} \to$ lower Pada
  4. $\text{boundary} \text{ (exact)} \to$ current Pada (e.g. $20^\circ \to$ Bharani-3, $30^\circ \to$ Krittika-2)
  5. $\text{boundary} + 1.0\times 10^{-10\circ} \to$ current Pada
  6. $\text{boundary} + 1.0\times 10^{-9\circ} \to$ current Pada
  7. $\text{boundary} + 1''$ (arcsecond) $\to$ current Pada
  **Result**: 756 / 756 assertions passed with 100% mathematical consistency.

---

### 2.2 Yoga Boundary & Wrap-around Verification (±1 arcsec)
Yoga sum is defined as $\text{norm360}(\lambda_{\text{Sun}} + \lambda_{\text{Moon}})$, segmented into 27 divisions of $\frac{360^\circ}{27} = 13^\circ 20' = 13.333333^\circ$.

Empirical unit tests verify:
- **Wrap-around Pre-boundary** ($359^\circ 59' 59'' = 359.9997222^\circ$):  
  $\to$ **Yoga 27 (Vaidhriti)**, `fractionElapsed = 0.999979`
- **Exact Wrap-around Boundary** ($360^\circ 00' 00'' = 0.0000000^\circ$):  
  $\to$ **Yoga 1 (Vishkambha)**, `fractionElapsed = 0.000000`
- **Wrap-around Post-boundary** ($360^\circ 00' 01'' = 0.0002778^\circ$):  
  $\to$ **Yoga 1 (Vishkambha)**, `fractionElapsed = 0.000021`
- **Segment 1 $\to$ 2 Transition Boundary** ($13^\circ 20' 00'' = 13.3333333^\circ$):
  - $13^\circ 19' 59''$ ($13.333056^\circ$): Yoga 1 (Vishkambha)
  - $13^\circ 20' 00''$ ($13.333333^\circ$): Yoga 2 (Priti)
  - $13^\circ 20' 01''$ ($13.333611^\circ$): Yoga 2 (Priti)

---

### 2.3 Tithi / Karana Shared Angular Separation & Boundary Identity
Tithi ($12^\circ$ span) and Karana ($6^\circ$ span) boundaries are not computed independently. Both call `windowFor` on the identical lambda function:
```ts
t => elongation(p(t))
```
Where $\text{elongation} = \text{norm360}(\lambda_{\text{Moon}} - \lambda_{\text{Sun}})$.

Because a Tithi contains exactly two Karanas (half-tithis $2k-1$ and $2k$):
- For any chart instant in the first half of a Tithi (odd half-tithi index, e.g., Kaulava 11 in Shashthi 6):
  $$\text{karana.window.startJdUT} \equiv \text{tithi.window.startJdUT}$$
  **Measured Delta**: $\mathbf{0.0000000000\text{ days}} = \mathbf{0.0\text{ seconds}}$
- For any chart instant in the second half of a Tithi (even half-tithi index):
  $$\text{karana.window.endJdUT} \equiv \text{tithi.window.endJdUT}$$
  **Measured Delta**: $\mathbf{0.0000000000\text{ days}} = \mathbf{0.0\text{ seconds}}$

---

### 2.4 Fail-Closed Auxiliary Provider & Provenance Hardening
The auxiliary longitude provider contract enforces strict provenance isolation:
1. **Mandatory Provenance**: `CanonicalBodyPosition.provenance` is mandatory (`"swisseph-wasm" | "fallback"`). Silent defaults to `"swisseph-wasm"` have been excised from `canonicalChart.ts`.
2. **Fail-Closed Auxiliary Provider**: `createCanonicalLongitudeProvider(chart)` verifies `chart.provenance.ephemeris === 'swisseph-wasm'`. If the chart has degraded provenance (`"fallback"` or `"mixed"`), it throws `DegradedEphemerisError`, preventing cross-source corruption.

---

### 2.5 Explicit Gate G Provider Parity Report (Live Verified Coordinates)

The parity check between `CanonicalChart` (Phase 1 primary output) and `SwissLongitudeProvider` (Phase 2 auxiliary evaluator) was empirically measured across all golden test fixtures:

```text
======================================================================
GATE G PARITY REPORT — CANONICAL STATE vs AUXILIARY PROVIDER
======================================================================
Test Fixture 1: Chofu, Tokyo (2026-09-16 14:30:00 JST, JD 2461299.7291666665)
  CanonicalChart Sun Longitude:       149.1514743753°
  Swiss Provider Sun Longitude:       149.1514743753°
  Absolute Error (Sun):               0.0000000000°

  CanonicalChart Moon Longitude:      210.0908293268°
  Swiss Provider Moon Longitude:      210.0908293268°
  Absolute Error (Moon):              0.0000000000°

Test Fixture 2: PVR Narasimha Rao (1970-04-04 17:47:00 IST, JD 2440681.0118055553)
  CanonicalChart Sun Longitude:       350.8695646912°
  Swiss Provider Sun Longitude:       350.8695646912°
  Absolute Error (Sun):               0.0000000000°

  CanonicalChart Moon Longitude:      328.5540456555°
  Swiss Provider Moon Longitude:      328.5540456555°
  Absolute Error (Moon):              0.0000000000°

SUMMARY:
  Maximum Absolute Error:             0.0000000000° (0.0°)
  Specified Tolerance:                1.0000000000e-9° (0.000000001°)
  Safety Margin:                      > 9 orders of magnitude below tolerance
  Parity Status:                      PASS (Exact numerical equality at IEEE-754 precision)
======================================================================
```

---

## 3. Empirical Performance Profile

Measured in Node.js v22.23.2 on Linux x86_64 using `node:perf_hooks` high-resolution timer:

| Execution Profile | Iterations | Median Latency | Mean Latency | p95 Latency | p99 Latency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pure Panchanga Algebra** (with `Intl` Vara formatting) | 10,000 | **0.332 ms** | 0.386 ms | 0.628 ms | 1.092 ms |
| **Panchanga + Full Windows** (8 Swiss WASM Bisections to $86.4\ \mu\text{s}$) | 200 | **8.277 ms** | 8.427 ms | 9.692 ms | 13.097 ms |

---

## 4. Phase 3 Scope Boundaries

1. **Downstream Readiness**:
   - `CanonicalChart` is the immutable single source of truth for planetary bodies, houses, and Lagna.
   - `PanchangaResult` is the immutable single source of truth for Tithi, Nakshatra, Yoga, Karana, Vara, and exact boundary windows.
2. **Boundary Solver Architectural Limitation**:
   - The bracket-and-bisect solver in `panchangaBoundaries.ts` assumes $\dot{\theta}(t) > 0$ (monotonic angle increase), which is mathematically guaranteed for Moon, Sun, elongation, and sum.
   - **For Phase 3**: Planetary events involving retrograde stations ($\dot{\lambda} \le 0$) or applying/separating aspect extrema cannot reuse this monotonic solver without a generalized root solver.
