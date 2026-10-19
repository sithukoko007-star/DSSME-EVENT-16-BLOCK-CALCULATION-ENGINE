/**
 * Zero-Wave Gate (Z1–Z4)
 *
 * The most critical safety gate. Runs BEFORE all CPS analysis.
 * Uses calendar state only — no planet strength.
 *
 * Z1 — Entropy (scatter vs. compression): count of distinct houses
 * Z2 — Lunar Environment Stability
 * Z3 — Volatility Load (real-time planetary amplifiers)
 * Z4 — Phase Stress
 *
 * ZW_STATE: OPEN | DAMPED | CLOSED
 * CLOSED → STOP immediately.
 *
 * §6 CONTRACT: ZW_STATE = CLOSED → output nothing, terminate.
 * If ZW_STATE more restrictive than Regime → use ZW_STATE as effective regime.
 */

import type { Dssme16BlockResult, NineBody } from "../../types/dssme-canonical-types.ts";
import type { Regime, ZwState } from "./types.ts";

// ============================================================================
// Z1 — Entropy (scatter vs. compression)
// ============================================================================

export interface Z1Result {
  distinctHouses: number;
  z1State: ZwState;
  note: string;
}

export function computeZ1(chart: Dssme16BlockResult): Z1Result {
  // Count distinct houses for 7 classical planets (Sun..Saturn; excludes Rahu/Ketu/Lagna)
  const classicalPlanets: NineBody[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  const houses = new Set<number>();

  for (const p of classicalPlanets) {
    const entry = chart.HOUSE_POSITIONS[p];
    if (entry) houses.add(entry.house);
  }

  const h = houses.size;
  let z1State: ZwState;
  let note: string;

  if (h <= 3) {
    z1State = "DAMPED"; // too compressed
    note = `Z1: h=${h} ≤ 3 → too compressed → DAMPED pressure`;
  } else if (h >= 7) {
    z1State = "DAMPED"; // too scattered
    note = `Z1: h=${h} ≥ 7 → too scattered → DAMPED pressure`;
  } else {
    z1State = "OPEN"; // moderate compression
    note = `Z1: h=${h} (4–6) → moderate compression → OPEN`;
  }

  return { distinctHouses: h, z1State, note };
}

// ============================================================================
// Z2 — Lunar Environment Stability
// ============================================================================

export interface Z2Result {
  z2State: ZwState;
  note: string;
}

export function computeZ2(chart: Dssme16BlockResult): Z2Result {
  const moonCombust = chart.COMBUST?.Moon?.combust === true;
  const moonDignity = chart.DIGNITY?.Moon;

  // Check if Moon is afflicted by malefics with score ≥ 40
  const malefics: NineBody[] = ["Mars", "Saturn", "Rahu", "Ketu"];
  const moonHouse = chart.HOUSE_POSITIONS?.Moon?.house ?? 0;

  let maleficAspectCount = 0;
  for (const p of malefics) {
    const aspects = chart.ASPECTS_PLANETS?.filter(a => a.from === p && a.to === "Moon") ?? [];
    const hasHeavyAspect = aspects.some(a => a.score >= 40);
    if (hasHeavyAspect) maleficAspectCount++;
  }

  if (moonCombust) {
    return { z2State: "DAMPED", note: "Z2: Moon combust → DAMPED pressure" };
  }
  if (maleficAspectCount >= 2) {
    return {
      z2State: "DAMPED",
      note: `Z2: ${maleficAspectCount} malefics aspect Moon with score ≥ 40 → DAMPED pressure`,
    };
  }
  if (moonDignity === "Enemy" || moonDignity === "Debilitated") {
    return {
      z2State: "DAMPED",
      note: `Z2: Moon dignity ${moonDignity} → DAMPED pressure`,
    };
  }

  return { z2State: "OPEN", note: "Z2: Moon stable → OPEN" };
}

// ============================================================================
// Z3 — Volatility Load
// ============================================================================

export interface Z3Result {
  amplifierCount: number;
  amplifiers: string[];
  z3State: ZwState;
  note: string;
}

export function computeZ3(chart: Dssme16BlockResult): Z3Result {
  const amplifiers: string[] = [];

  // 1. Mars ignition: Mars in Aries/Scorpio or conjunct Rahu/Ketu within 5°
  const marsPlanet = chart.PLANETS?.Mars;
  if (marsPlanet) {
    if (marsPlanet.sign === "Aries" || marsPlanet.sign === "Scorpio") {
      amplifiers.push("Mars ignition (own sign)");
    } else {
      // Check Mars conjunct Rahu/Ketu within 5°
      const marsHouse = chart.HOUSE_POSITIONS?.Mars?.house;
      const rahuHouse = chart.HOUSE_POSITIONS?.Rahu?.house;
      const ketuHouse = chart.HOUSE_POSITIONS?.Ketu?.house;
      if (marsHouse === rahuHouse || marsHouse === ketuHouse) {
        // Check degree separation from planet positions
        const marsSign = marsPlanet.sign;
        const rahuSign = chart.PLANETS?.Rahu?.sign;
        const ketuSign = chart.PLANETS?.Ketu?.sign;
        if (marsSign === rahuSign || marsSign === ketuSign) {
          amplifiers.push("Mars ignition (conjunct node)");
        }
      }
    }
  }

  // 2. Rahu activation: Rahu in angular house with 2+ planets within 10° (same sign)
  const rahuHousePos = chart.HOUSE_POSITIONS?.Rahu;
  if (rahuHousePos && [1, 4, 7, 10].includes(rahuHousePos.house)) {
    const rahuSign = chart.PLANETS?.Rahu?.sign;
    let closePlanets = 0;
    for (const p of ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"] as NineBody[]) {
      if (chart.PLANETS?.[p]?.sign === rahuSign) closePlanets++;
    }
    if (closePlanets >= 2) {
      amplifiers.push("Rahu activation (angular + clustered)");
    }
  }

  // 3. Ketu fragmentation: Ketu conjunct Sun/Moon within 8°
  const ketuSign = chart.PLANETS?.Ketu?.sign;
  const sunSign = chart.PLANETS?.Sun?.sign;
  const moonSign = chart.PLANETS?.Moon?.sign;
  if (ketuSign === sunSign || ketuSign === moonSign) {
    amplifiers.push("Ketu fragmentation (conjunct Sun/Moon)");
  }

  const count = amplifiers.length;
  let z3State: ZwState;
  let note: string;

  if (count === 0) {
    z3State = "OPEN";
    note = "Z3: 0 amplifiers → calm → OPEN";
  } else if (count === 1) {
    z3State = "OPEN"; // manageable
    note = `Z3: 1 amplifier (${amplifiers[0]}) → manageable → OPEN possible`;
  } else if (count === 2) {
    z3State = "DAMPED";
    note = `Z3: 2 amplifiers → risky → DAMPED`;
  } else {
    z3State = "CLOSED";
    note = `Z3: ${count} amplifiers → unsafe → CLOSED`;
  }

  return { amplifierCount: count, amplifiers, z3State, note };
}

// ============================================================================
// Z4 — Phase Stress
// ============================================================================

export interface Z4Result {
  z4State: ZwState;
  stressLevel: string;
  note: string;
}

export function computeZ4(chart: Dssme16BlockResult): Z4Result {
  const ps = chart.PHASE_STRESS;

  if (!ps) {
    return {
      z4State: "DAMPED",
      stressLevel: "UNKNOWN",
      note: "Z4: PHASE_STRESS not provided → UNKNOWN → default DAMPED",
    };
  }

  const newMoon = ps.new_moon_proximity_hrs;
  const fullMoon = ps.full_moon_proximity_hrs;
  const ingressCount = ps.ingress_within_24h.length;
  const boundaryCount = ps.sign_boundary_planets.length;

  if ((newMoon > 0 && newMoon < 24)) {
    return { z4State: "CLOSED", stressLevel: "HIGH", note: `Z4: New moon < 24h (${newMoon}h) → HIGH stress → CLOSED pressure` };
  }
  if (fullMoon > 0 && fullMoon < 24) {
    return { z4State: "DAMPED", stressLevel: "HIGH", note: `Z4: Full moon < 24h (${fullMoon}h) → HIGH distortion → DAMPED/CLOSED` };
  }
  if (newMoon >= 24 && newMoon <= 48) {
    return { z4State: "DAMPED", stressLevel: "MEDIUM", note: `Z4: New moon 24-48h (${newMoon}h) → MEDIUM stress → DAMPED pressure` };
  }
  if (ingressCount >= 2) {
    return { z4State: "DAMPED", stressLevel: "MEDIUM", note: `Z4: ${ingressCount} ingresses within 24h → ingress cliff → DAMPED` };
  }
  if (boundaryCount >= 3) {
    return { z4State: "DAMPED", stressLevel: "MEDIUM", note: `Z4: ${boundaryCount} planets near sign boundary → transition boundary → DAMPED` };
  }

  return {
    z4State: "OPEN",
    stressLevel: ps.stress_level,
    note: `Z4: No significant phase stress → OPEN (stress=${ps.stress_level})`,
  };
}

// ============================================================================
// Zero-Wave Gate: combine Z1–Z4
// ============================================================================

export interface ZeroWaveResult {
  z1: Z1Result;
  z2: Z2Result;
  z3: Z3Result;
  z4: Z4Result;
  zw_state: ZwState;
  notes: string[];
  amplifiers: string[]; // Z3 amplifiers list (used in VR computation)
}

export function computeZeroWaveGate(chart: Dssme16BlockResult): ZeroWaveResult {
  const z1 = computeZ1(chart);
  const z2 = computeZ2(chart);
  const z3 = computeZ3(chart);
  const z4 = computeZ4(chart);

  const notes = [z1.note, z2.note, z3.note, z4.note];

  // CLOSED if any gate returns CLOSED
  const states = [z1.z1State, z2.z2State, z3.z3State, z4.z4State];
  let zw_state: ZwState;

  if (states.includes("CLOSED")) {
    zw_state = "CLOSED";
    notes.push("ZW_STATE = CLOSED — one or more gates closed");
  } else if (states.includes("DAMPED")) {
    zw_state = "DAMPED";
    notes.push("ZW_STATE = DAMPED — one or more gates damped");
  } else {
    zw_state = "OPEN";
    notes.push("ZW_STATE = OPEN — all gates clear");
  }

  return {
    z1, z2, z3, z4,
    zw_state,
    notes,
    amplifiers: z3.amplifiers,
  };
}

/**
 * Reconcile Regime vs ZW_STATE.
 * Returns the more restrictive of the two as effective regime.
 * §6: If ZW_STATE = DAMPED but Regime = OPEN → use DAMPED as effective regime.
 */
export function reconcileRegime(regime: Regime, zw_state: ZwState): Regime {
  const order: Record<string, number> = { OPEN: 0, DAMPED: 1, CLOSED: 2 };
  const regimeLevel = order[regime] ?? 0;
  const zwLevel = order[zw_state] ?? 0;
  if (zwLevel > regimeLevel) return zw_state as Regime;
  return regime;
}
