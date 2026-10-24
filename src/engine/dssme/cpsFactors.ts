/**
 * CPS Construction: S5–S10d
 *
 * Computes the 9-factor CPS_pre_v3 for each eligible planet.
 * All stages are: continuous · multiplicative · non-eliminative.
 *
 * Master equation (V3):
 *   CPS_pre_v3(p) = S(p) × SIF_v3(p) × T_v3(p) × RB(p) × PAS_v3(p)
 *                   × TM_v3(p) × BHF(p) × DRF(p) × VGF(p)
 *
 * Hard Rules enforced:
 *   - BAV enters CPS exactly once via SS_bav in T_v3 (NOT in PAS_v3) [Rule 22]
 *   - BHF speculative-house bonus applied exactly once [Rule 27]
 *   - DRF AD-secondary modifier applied exactly once [Rule 27]
 *   - RB is a contractual constant — never modified [Rule 24]
 *   - Rahu uses Saturn's dignity/friendship; Ketu uses Mars's [§9.3 convention]
 *   - Moon can have CPS but contributes zero digits at Step K [Rule 25]
 */

import type {
  ClassicalPlanet,
  Dignity,
  Dssme16BlockResult,
  NineBody,
} from "../../types/dssme-canonical-types.ts";
import type { PlanetCpsFactors, Regime, ZwState } from "./types.ts";

// ============================================================================
// S8 — Role Bias (RB): fixed contractual constants
// ============================================================================

export const RB: Record<NineBody, number> = {
  Jupiter: 1.15,
  Venus: 1.15,
  Mercury: 1.10,
  Rahu: 1.10,
  Mars: 1.05,
  Moon: 0.95,
  Sun: 0.95,
  Ketu: 0.90,
  Saturn: 0.85,
};

// ============================================================================
// Natural Planetary Friendship Table (§9.2)
// Used by DRF, DLR, NF, HP.
// Rahu → use Saturn's row; Ketu → use Mars's row.
// ============================================================================

type FriendLevel = "Grt.Friend" | "Friend" | "Neutral" | "Enemy" | "Grt.Enemy";

const FRIENDSHIP: Record<ClassicalPlanet, Partial<Record<ClassicalPlanet, FriendLevel>>> = {
  Sun:     { Moon: "Friend", Mars: "Friend", Jupiter: "Friend", Mercury: "Neutral", Venus: "Enemy", Saturn: "Enemy" },
  Moon:    { Sun: "Friend", Mercury: "Friend", Mars: "Neutral", Jupiter: "Neutral", Venus: "Neutral", Saturn: "Neutral" },
  Mars:    { Sun: "Friend", Moon: "Friend", Jupiter: "Friend", Venus: "Neutral", Saturn: "Neutral", Mercury: "Enemy" },
  Mercury: { Sun: "Friend", Venus: "Friend", Mars: "Neutral", Jupiter: "Neutral", Saturn: "Neutral", Moon: "Enemy" },
  Jupiter: { Sun: "Friend", Moon: "Friend", Mars: "Friend", Saturn: "Neutral", Mercury: "Enemy", Venus: "Enemy" },
  Venus:   { Mercury: "Friend", Saturn: "Friend", Mars: "Neutral", Jupiter: "Neutral", Sun: "Enemy", Moon: "Enemy" },
  Saturn:  { Mercury: "Friend", Venus: "Friend", Jupiter: "Neutral", Sun: "Enemy", Moon: "Enemy", Mars: "Enemy" },
};

// Rahu/Ketu proxy planets for dignity/friendship lookups
function proxyPlanet(p: NineBody): ClassicalPlanet {
  if (p === "Rahu") return "Saturn";
  if (p === "Ketu") return "Mars";
  return p as ClassicalPlanet;
}

export function getFriendLevel(p: NineBody, other: NineBody): FriendLevel {
  const pProxy = proxyPlanet(p);
  const otherProxy = proxyPlanet(other);
  if (pProxy === otherProxy) return "Friend"; // same planet = friendly
  return FRIENDSHIP[pProxy]?.[otherProxy] ?? "Neutral";
}

function friendLevelToDRF(level: FriendLevel): number {
  switch (level) {
    case "Grt.Friend": return 1.04;
    case "Friend":     return 1.02;
    case "Neutral":    return 1.00;
    case "Enemy":      return 0.94;
    case "Grt.Enemy":  return 0.88;
  }
}

function friendLevelToTM(level: FriendLevel): number {
  switch (level) {
    case "Grt.Friend":
    case "Friend":  return 1.01;  // resonant
    case "Neutral": return 1.00;
    case "Enemy":
    case "Grt.Enemy": return -1;  // sentinel: use axis-specific floor
  }
}

// ============================================================================
// S5 — Raw Shadbala Extraction
// ============================================================================

export function computeS(totalVirupas: number[]): { RS: number[]; S: number[] } {
  const max = Math.max(...totalVirupas);
  const S = max > 0 ? totalVirupas.map(v => v / max) : totalVirupas.map(() => 0);
  return { RS: totalVirupas, S };
}

// ============================================================================
// S6 — SIF_v3 sub-factors
// ============================================================================

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function computeKIF(
  kaala_pct: number,
  sthana_pct: number,
  dig_pct: number,
  chesta_pct: number,
  drig_pct: number
): number {
  const others = [sthana_pct, dig_pct, chesta_pct, drig_pct];
  const meanOthers = others.reduce((a, b) => a + b, 0) / others.length;
  if (meanOthers <= 0) return 1.00;
  const ratio = kaala_pct / meanOthers;
  if (ratio <= 1.5) return 1.00;
  if (ratio <= 2.5) return 0.95;
  return 0.85;
}

function computeDIF(drig_bala: number): number {
  if (drig_bala >= 0) return 1.00;
  if (drig_bala >= -20) return 0.95;
  return 0.85;
}

function computeAIF(shadbala: Dssme16BlockResult["SHADBALA"], idx: number): number {
  const rs = shadbala.total_virupas[idx] ?? 1;
  const comps = [
    shadbala.sthana_total[idx] ?? 0,
    shadbala.dig_bala[idx] ?? 0,
    shadbala.kaala_total[idx] ?? 0,
    shadbala.chesta_bala[idx] ?? 0,
    shadbala.naisargika_bala[idx] ?? 0,
    Math.abs(shadbala.drig_bala[idx] ?? 0),
  ];
  const maxComp = Math.max(...comps);
  const maxShare = rs > 0 ? maxComp / rs : 0;
  if (maxShare <= 0.45) return 1.00;
  if (maxShare <= 0.60) return 0.95;
  return 0.88;
}

function computeCIF(chart: Dssme16BlockResult, planetSign: string): number {
  // Count planets in same sign
  const clusters = chart.SIGN_CLUSTERS ?? [];
  const cluster = clusters.find(c => c.sign === planetSign);
  if (!cluster) return 1.00;
  const count = cluster.planets.length;
  const sav = cluster.sav;
  if (count >= 3) {
    if (sav >= 30) return 0.97;
    if (sav >= 25) return 0.93;
    return 0.88;
  }
  if (count === 2) {
    if (sav >= 28) return 0.98;
    return 0.95;
  }
  return 1.00;
}

function computeYIF(chart: Dssme16BlockResult, planet: NineBody): number {
  const yogas = chart.YOGA_LIST ?? [];
  const yogaDeltas: Record<string, number> = {
    "Dhana Yoga": 0.03,
    "Lakshmi Yoga": 0.02,
    "Adhi Yoga": 0.02,
    "Raja Yoga": 0.02,
    "Gaja Kesari": 0.01,
    "Daridra Yoga": -0.04,
    "Graha Yuddha": -0.04,
    "Shakata Yoga": -0.03,
    "Kemadruma Yoga": -0.03,
    "Paapa Kartari Yoga": -0.03,
  };

  let rawDelta = 0;
  for (const yoga of yogas) {
    if (!yoga.active) continue;
    if (yoga.planets_involved.includes(planet)) {
      rawDelta += yogaDeltas[yoga.name] ?? 0;
    }
  }
  // YIF attenuation-only; cap at 1.00 (cannot boost CPS)
  return clamp(1.00 + rawDelta, 0.88, 1.00);
}

// ============================================================================
// S7 — T_v3 sub-factors
// ============================================================================

function computeZC(p: NineBody, zw_state: ZwState): number {
  const volatilePlanets: NineBody[] = ["Rahu", "Mars", "Ketu"];
  const isVolatile = volatilePlanets.includes(p);
  if (zw_state === "OPEN") return isVolatile ? 0.97 : 1.00;
  if (zw_state === "DAMPED") return isVolatile ? 0.85 : 0.95;
  return 1.00; // CLOSED never reaches here
}

function computePC(tithiIndex: number, paksha: string): number {
  const isShukla = paksha === "Shukla" || paksha === "shukla";
  if (isShukla && tithiIndex >= 2 && tithiIndex <= 12) return 1.02;
  if (isShukla) return 0.98;
  if (tithiIndex >= 2 && tithiIndex <= 12) return 0.94;
  return 0.88; // near Amavasya
}

function computeVR(p: NineBody, z3AmplifierCount: number, z3Amplifiers: string[]): number {
  const volatilePlanets: NineBody[] = ["Rahu", "Mars", "Ketu"];
  const isVolatile = volatilePlanets.includes(p);

  if (z3AmplifierCount === 0) return 1.00;

  // Check if this planet IS the amplifier
  const isPlanetAmplifier =
    (p === "Mars" && z3Amplifiers.some(a => a.includes("Mars"))) ||
    (p === "Rahu" && z3Amplifiers.some(a => a.includes("Rahu"))) ||
    (p === "Ketu" && z3Amplifiers.some(a => a.includes("Ketu")));

  if (z3AmplifierCount === 1) {
    if (isPlanetAmplifier) return 0.85;
    return 0.95;
  }
  // z3AmplifierCount >= 2
  if (isVolatile) return 0.80;
  return 0.90;
}

const SS_DIGNITY_MAP: Record<Dignity, number> = {
  Exalted: 1.00, Own: 1.00, Moolatrikona: 0.98,
  "Grt.Friend": 0.97, Friend: 0.96, Neutral: 0.95,
  Enemy: 0.90, "Grt.Enemy": 0.88, Debilitated: 0.75, "—": 0.95,
};

function computeSSHouse(houseType: string): number {
  if (houseType === "Angular") return 1.00;
  if (houseType === "Succedent") return 0.98;
  return 0.95; // Cadent
}

function computeSSBav(bav: number): number {
  if (bav >= 7) return 1.00;
  if (bav === 6) return 0.99;
  if (bav === 5) return 0.97;
  if (bav === 4) return 0.95;
  if (bav === 3) return 0.92;
  if (bav === 2) return 0.89;
  if (bav === 1) return 0.87;
  return 0.85; // 0 bindus
}

function computeSSNav(chart: Dssme16BlockResult, p: NineBody): number {
  const nav = chart.NAVAMSHA;
  if (!nav || !nav._available) return 1.00;
  const entry = nav[p as keyof typeof nav];
  if (!entry || typeof entry !== "object" || !("is_vargottama" in entry)) return 1.00;
  if (entry.is_vargottama) return 1.04;
  if (entry.is_pushkara) return 1.03;
  const dig = (entry as { dignity: Dignity }).dignity;
  const navDignityMap: Record<string, number> = {
    Exalted: 1.02, Own: 1.01, Moolatrikona: 1.01, Friend: 1.00,
    "Grt.Friend": 1.00, Neutral: 0.98, Enemy: 0.95, "Grt.Enemy": 0.95,
    Debilitated: 0.91, "—": 1.00,
  };
  return navDignityMap[dig] ?? 0.98;
}

// ============================================================================
// S9 — PAS_v3 sub-factors
// ============================================================================

const PAS_D_MAP: Record<Dignity, number> = {
  Exalted: 1.05, Own: 1.03, Moolatrikona: 1.03,
  "Grt.Friend": 1.02, Friend: 1.01, Neutral: 1.00,
  Enemy: 0.96, "Grt.Enemy": 0.93, Debilitated: 0.92, "—": 1.00,
};

function computeDCF(chart: Dssme16BlockResult, p: NineBody, shadbala: Dssme16BlockResult["SHADBALA"]): number {
  const CLASSICAL: ClassicalPlanet[] = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];
  const pPlanet = chart.PLANETS[p as keyof typeof chart.PLANETS] as { dispositor?: ClassicalPlanet; sign?: string; dignity?: string } | undefined;
  if (!pPlanet || !pPlanet.dispositor) return 1.00;

  const disp = pPlanet.dispositor;
  const pDignity = pPlanet.dignity as Dignity;

  // Self-disposited exception (Own or Exalted)
  if (pDignity === "Own" || pDignity === "Exalted" || pDignity === "Moolatrikona") return 1.03;

  // Dispositor Shadbala (normalized)
  const dispIdx = CLASSICAL.indexOf(disp);
  const maxRS = Math.max(...(shadbala.total_virupas));
  const S_disp = dispIdx >= 0 && maxRS > 0
    ? (shadbala.total_virupas[dispIdx] ?? 0) / maxRS
    : 0;

  let dcf_base: number;
  if (S_disp >= 0.85) dcf_base = 1.03;
  else if (S_disp >= 0.70) dcf_base = 1.01;
  else if (S_disp >= 0.50) dcf_base = 1.00;
  else if (S_disp >= 0.35) dcf_base = 0.97;
  else dcf_base = 0.94;

  // Dignity modifier for dispositor
  const dispDignity = chart.DIGNITY[disp as NineBody] as Dignity | undefined;
  let dignityMod = 1.00;
  if (dispDignity === "Debilitated") dignityMod = 0.95;
  else if (dispDignity === "Exalted" || dispDignity === "Own") dignityMod = 1.01;

  return clamp(dcf_base * dignityMod, 0.92, 1.03);
}

function computeIAspect(chart: Dssme16BlockResult, p: NineBody): number {
  const MALEFICS: NineBody[] = ["Sun", "Mars", "Saturn", "Rahu", "Ketu"];
  const BENEFICS: NineBody[] = ["Jupiter", "Venus", "Moon", "Mercury"];

  const aspects = chart.ASPECTS_PLANETS?.filter(a => a.to === p) ?? [];
  let hasBeneficAspect = false;
  let hasMildHostile = false;
  let hasSevereHostile = false;

  for (const asp of aspects) {
    if (BENEFICS.includes(asp.from) && asp.score >= 45) hasBeneficAspect = true;
    if (MALEFICS.includes(asp.from)) {
      if (asp.score >= 45) hasSevereHostile = true;
      else if (asp.score >= 30) hasMildHostile = true;
    }
  }

  if (hasSevereHostile) return 0.88;
  if (hasMildHostile) return 0.97;
  if (hasBeneficAspect) return 1.02;
  return 1.00;
}

// ============================================================================
// S10 — TM_v3 sub-factors
// ============================================================================

// 27 Nakshatra lords (sequence repeats 3×)
const NAKSHATRA_LORDS: ClassicalPlanet[] = [
  "Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury",
  "Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury",
  "Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury",
] as ClassicalPlanet[]; // Rahu treated as ClassicalPlanet here for lookup

function getNakshatraLord(nakshatraName: string): NineBody {
  const ALL_NAKSHATRAS = [
    "Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra",
    "Punarvasu","Pushya","Aslesha","Magha","Purva Phalguni","Uttara Phalguni",
    "Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha",
    "Mula","Purva Ashadha","Uttara Ashadha","Shravana","Dhanishta",
    "Shatabhisha","Purva Bhadrapada","Uttara Bhadrapada","Revati",
  ];
  const idx = ALL_NAKSHATRAS.indexOf(nakshatraName);
  const lords: NineBody[] = ["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury",
                              "Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury",
                              "Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"];
  return idx >= 0 ? (lords[idx] ?? "Sun") : "Sun";
}

function friendLevelToTMValue(p: NineBody, ruler: NineBody): number {
  const level = getFriendLevel(p, ruler);
  if (level === "Grt.Friend" || level === "Friend") return 1.01;
  if (level === "Neutral") return 1.00;
  return 0.97; // Enemy or Grt.Enemy
}

function computeDLR(p: NineBody, weekdayLord: NineBody): number {
  if (p === weekdayLord) return 1.03;
  return friendLevelToTMValue(p, weekdayLord);
}

function computeNF(p: NineBody, moonNakshatra: string): number {
  const nakshatraLord = getNakshatraLord(moonNakshatra);
  if (p === nakshatraLord) return 1.03;
  return friendLevelToTMValue(p, nakshatraLord);
}

function computeHP(p: NineBody, horaLord: NineBody): number {
  if (p === horaLord) return 1.03;
  return friendLevelToTMValue(p, horaLord);
}

function computeTF(tithiIndex: number): number {
  // tithi_1_30 mod 5: 1=Nanda, 2=Bhadra, 3=Jaya, 4=Rikta, 0=Purna
  const mod = tithiIndex % 5;
  if (mod === 1) return 1.02; // Nanda
  if (mod === 2) return 1.01; // Bhadra
  if (mod === 3) return 1.03; // Jaya (ceiling)
  if (mod === 4) return 0.98; // Rikta (floor)
  return 1.00; // Purna
}

// ============================================================================
// S10b — BHF (Bhava Bala House Factor)
// ============================================================================

function computeBHF(chart: Dssme16BlockResult, p: NineBody): number {
  const bhavaBala = chart.BHAVA_BALA;
  const housePos = chart.HOUSE_POSITIONS[p];
  if (!housePos) return 1.00;
  const houseNum = housePos.house;
  const houseKey = houseNum.toString() as keyof typeof bhavaBala;
  const entry = bhavaBala[houseKey];
  if (!entry) return 1.00;

  // BB_mean over all 12 houses
  const houseKeys = ["1","2","3","4","5","6","7","8","9","10","11","12"] as const;
  const allTotals = houseKeys.map(k => bhavaBala[k]?.total ?? 0);
  const bbMean = allTotals.reduce((a, b) => a + b, 0) / 12;
  if (bbMean === 0) return 1.00; // BLOCK_7 all-zero → neutral

  const bbNorm = entry.total / bbMean;
  let bhf: number;
  if (bbNorm >= 1.30) bhf = 1.05;
  else if (bbNorm >= 1.15) bhf = 1.03;
  else if (bbNorm >= 1.00) bhf = 1.01;
  else if (bbNorm >= 0.85) bhf = 1.00;
  else if (bbNorm >= 0.70) bhf = 0.96;
  else if (bbNorm >= 0.55) bhf = 0.92;
  else bhf = 0.88;

  // Speculative-house bonus: H2/H5/H8/H11 AND BB_norm ≥ 1.00 — applied ONCE
  const specHouses = [2, 5, 8, 11];
  if (specHouses.includes(houseNum) && bbNorm >= 1.00) {
    bhf = Math.min(1.05, bhf * 1.01);
  }

  return bhf;
}

// ============================================================================
// S10c — DRF (Dasha Resonance Factor)
// ============================================================================

function computeDRF(chart: Dssme16BlockResult, p: NineBody): number {
  const md = chart.DASHA.mahadasha_planet as NineBody;
  const ad = chart.DASHA.antardasha_planet as NineBody;

  // Step 1: MD-lord identity
  if (p === md) return 1.08;

  // Step 2: AD-lord identity (p ≠ MD)
  if (p === ad) return 1.05;

  // Step 3: Primary MD relationship tier
  const mdLevel = getFriendLevel(p, md);
  const drfBase = friendLevelToDRF(mdLevel);

  // Step 4: AD-secondary modifier (applied exactly once)
  const adLevel = getFriendLevel(p, ad);
  let adMod = 1.00;
  if (adLevel === "Friend" || adLevel === "Grt.Friend") adMod = 1.01;
  else if (adLevel === "Enemy" || adLevel === "Grt.Enemy") adMod = 0.98;

  return clamp(drfBase * adMod, 0.88, 1.08);
}

// ============================================================================
// S10d — VGF (Vargottama & Navamsha Factor)
// ============================================================================

function computeVGF(chart: Dssme16BlockResult, p: NineBody): number {
  const nav = chart.NAVAMSHA;
  if (!nav || !nav._available) return 1.00;

  const entry = nav[p as keyof typeof nav];
  if (!entry || typeof entry !== "object" || !("is_vargottama" in entry)) return 1.00;

  // Step 1: Vargottama (highest priority)
  if (entry.is_vargottama) return 1.06;

  // Step 2: Pushkara
  const vgfPushkara = entry.is_pushkara ? 1.04 : 1.00;

  // Step 3: Navamsha dignity modifier
  const navDig = (entry as { dignity: Dignity }).dignity;
  const navDignityMod: Record<string, number> = {
    Exalted: 1.02, Own: 1.01, Moolatrikona: 1.01, Friend: 1.00,
    "Grt.Friend": 1.00, Neutral: 0.99, Enemy: 0.97, "Grt.Enemy": 0.97,
    Debilitated: 0.93, "—": 1.00,
  };
  const navMod = navDignityMod[navDig] ?? 0.99;

  // Step 4: VGF = pushkara × navDignityMod
  return clamp(vgfPushkara * navMod, 0.93, 1.06);
}

// ============================================================================
// Main CPS computation: compute all 9 factors for one planet
// ============================================================================

export interface CpsInputContext {
  zw_state: ZwState;
  z3AmplifierCount: number;
  z3Amplifiers: string[];
  tithiIndex: number;
  paksha: string;
  weekdayLord: NineBody;
  moonNakshatra: string;
  horaLord: NineBody;
}

export function computePlanetCPS(
  p: NineBody,
  chart: Dssme16BlockResult,
  shadbalaIdx: number,  // index in SHADBALA._columns (0=Sun..6=Saturn, -1 for Rahu/Ketu)
  S_value: number,       // pre-computed S(p) = RS(p)/max(RS)
  ctx: CpsInputContext
): PlanetCpsFactors {
  const warnings: string[] = [];
  const planets = chart.PLANETS;
  const shadbala = chart.SHADBALA;
  const dignity = chart.DIGNITY[p] as Dignity;
  const houseType = chart.HOUSE_POSITIONS[p]?.type ?? "Cadent";
  const bavEntry = chart.BAV_CURRENT_SIGN[p as keyof typeof chart.BAV_CURRENT_SIGN];
  const bavCount = bavEntry?.bav ?? 4;
  const planetEntry = planets[p as keyof typeof planets] as { sign?: string } | undefined;
  const planetSign = planetEntry?.sign ?? "";

  // S5 is pre-computed
  const S = S_value;

  // S6 — SIF_v3
  const idx = shadbalaIdx;
  const kaala_pct = idx >= 0 ? (shadbala.kaala_pct?.[idx] ?? 0) : 0;
  const sthana_total = idx >= 0 ? (shadbala.sthana_total?.[idx] ?? 1) : 1;
  const dig_bala_val = idx >= 0 ? (shadbala.dig_bala?.[idx] ?? 0) : 0;
  const chesta_bala_val = idx >= 0 ? (shadbala.chesta_bala?.[idx] ?? 0) : 0;
  const drig_bala_val = idx >= 0 ? (shadbala.drig_bala?.[idx] ?? 0) : 0;
  const total_virupas = idx >= 0 ? (shadbala.total_virupas?.[idx] ?? 1) : 1;

  // compute % of minimum for each component
  const min_req = idx >= 0 ? ([390,360,300,420,390,330,300][idx] ?? 300) : 300;
  const sthana_pct = (sthana_total / min_req) * 100;
  const dig_pct = (Math.abs(dig_bala_val) / min_req) * 100;
  const chesta_pct = (chesta_bala_val / min_req) * 100;
  const drig_pct = (Math.abs(drig_bala_val) / min_req) * 100;

  let KIF = 1.00, DIF = 1.00, AIF = 1.00;
  if (idx >= 0) {
    KIF = computeKIF(kaala_pct, sthana_pct, dig_pct, chesta_pct, drig_pct);
    DIF = computeDIF(drig_bala_val);
    AIF = computeAIF(shadbala, idx);
  } else {
    warnings.push(`${p}: Rahu/Ketu have no Shadbala — KIF/DIF/AIF defaulted to 1.00`);
  }
  const CIF = computeCIF(chart, planetSign);
  const YIF = computeYIF(chart, p);
  const SIF_v3 = clamp(Math.min(KIF, DIF, AIF, CIF, YIF), 0.82, 1.00);

  // S7 — T_v3
  const ZC = computeZC(p, ctx.zw_state);
  const PC = computePC(ctx.tithiIndex, ctx.paksha);
  const VR = computeVR(p, ctx.z3AmplifierCount, ctx.z3Amplifiers);
  const SS_dignity = SS_DIGNITY_MAP[dignity] ?? 0.95;
  const SS_house = computeSSHouse(houseType);
  const SS_bav = computeSSBav(bavCount);
  const SS_nav = computeSSNav(chart, p);
  const T_v3 = clamp(ZC * PC * VR * SS_dignity * SS_house * SS_bav * SS_nav, 0.58, 1.00);

  // S8 — RB (contractual constant)
  const rb = RB[p];

  // S9 — PAS_v3
  const PAS_D = PAS_D_MAP[dignity] ?? 1.00;
  const combustEntry = chart.COMBUST[p as keyof typeof chart.COMBUST] as { combust?: boolean; severity?: string } | undefined;
  const isRetrograde = chart.RETROGRADE[p] === true;
  const C = combustEntry?.combust
    ? (combustEntry.severity === "Severe" ? 0.85 : 0.95)
    : 1.00;
  const R = isRetrograde ? 0.97 : 1.00;
  const I_aspect = computeIAspect(chart, p);
  const H = houseType === "Angular" ? 1.03 : houseType === "Succedent" ? 1.00 : 0.95;
  const DCF = computeDCF(chart, p, shadbala);
  const PAS_v3 = clamp(PAS_D * C * R * I_aspect * H * DCF, 0.58, 1.14);

  // S10 — TM_v3
  const DLR = computeDLR(p, ctx.weekdayLord);
  const TF = computeTF(ctx.tithiIndex);
  const NF = computeNF(p, ctx.moonNakshatra);
  const HP = computeHP(p, ctx.horaLord);
  const TM_v3 = clamp(DLR * TF * NF * HP, 0.90, 1.05);

  // S10b — BHF
  const BHF = computeBHF(chart, p);

  // S10c — DRF
  const DRF = computeDRF(chart, p);

  // S10d — VGF
  const VGF = computeVGF(chart, p);

  // Master equation
  const CPS_pre_v3 = S * SIF_v3 * T_v3 * rb * PAS_v3 * TM_v3 * BHF * DRF * VGF;

  return {
    planet: p,
    RS: idx >= 0 ? (shadbala.total_virupas[idx] ?? 0) : 0,
    S,
    KIF, DIF, AIF, CIF, YIF, SIF_v3,
    ZC, PC, VR, SS_dignity, SS_house, SS_bav, SS_nav, T_v3,
    RB: rb,
    D: PAS_D, C, R, I_aspect, H, DCF, PAS_v3,
    DLR, TF, NF, HP, TM_v3,
    BHF, DRF, VGF,
    CPS_pre_v3,
    survived: false, // set by S11
    warnings,
  };
}

// ============================================================================
// Compute CPS for all eligible planets
// ============================================================================

const CLASSICAL_ORDER: ClassicalPlanet[] = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];

export function computeAllCPS(
  chart: Dssme16BlockResult,
  eligiblePlanets: NineBody[],
  ctx: CpsInputContext
): PlanetCpsFactors[] {
  // Compute S(p) for all 7 classical planets first
  const virupas = chart.SHADBALA.total_virupas; // length 7
  const maxRS = Math.max(...virupas, 1);

  const results: PlanetCpsFactors[] = [];

  for (const p of eligiblePlanets) {
    const classicalIdx = CLASSICAL_ORDER.indexOf(p as ClassicalPlanet);
    const S_value = classicalIdx >= 0
      ? (virupas[classicalIdx] ?? 0) / maxRS
      : 0.50; // Rahu/Ketu: use 0.50 as neutral S (no Shadbala)

    results.push(computePlanetCPS(p, chart, classicalIdx, S_value, ctx));
  }

  return results;
}
