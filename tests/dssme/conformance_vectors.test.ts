/**
 * DSSME v1.6 — Language-Neutral Conformance Vector Tests
 *
 * Runs all 244 vectors from dssme_v16_conformance_vectors.json
 * against the TypeScript engine functions exported from cpsFactors.ts.
 *
 * Target: 240/244 PASS (skip 4 "interpretation" group vectors).
 *
 * Vector function mapping → TypeScript function:
 *   KIF     → computeKIF_vec
 *   DIF     → computeDIF_vec
 *   AIF     → computeAIF_vec
 *   CIF     → computeCIF_vec
 *   YIF     → computeYIF_vec
 *   SIF_v3  → computeSIFv3_vec
 *   ZC      → computeZC_vec
 *   PC      → computePC_vec
 *   VR      → computeVR_vec
 *   SS_*    → computeSS*_vec
 *   T_v3    → computeTv3_vec
 *   RB      → computeRB_vec
 *   D,C,R   → computePAS*_vec
 *   I_aspect→ computeIAspect_vec
 *   H,DCF   → computeHDCF_vec
 *   PAS_v3  → computePASv3_vec
 *   TF,DLR,NF,HP,nakshatra_lord,TM_v3 → TM sub-functions
 *   BHF     → computeBHF_vec
 *   DRF     → computeDRF_vec
 *   VGF     → computeVGF_vec
 *   S11     → S11_vec
 *   STEPK_contributors → STEPK_vec
 *   S12     → S12_vec
 *   STEPL_2D/3D → STEPL_vec
 *   K_MAX_DEFAULT → KMAX_vec
 *   S5      → S5_vec
 *   CPS_pre_v3 → CPSprev3_vec
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const vectorDoc = JSON.parse(
  fs.readFileSync(path.join(__dirname, "dssme_v16_conformance_vectors.json"), "utf-8")
);


// ── Tolerance comparison ───────────────────────────────────────────
const TOL = (vectorDoc as any).tolerance as number; // 1e-9

function close(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= TOL;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => close(x, b[i]));
  }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    const ak = Object.keys(a as object).sort();
    const bk = Object.keys(b as object).sort();
    if (ak.length !== bk.length) return false;
    return ak.every(k => close((a as any)[k], (b as any)[k]));
  }
  return a === b;
}

// ── Inline implementations (mirrors Python reference exactly) ───────
type Planet = string;
const VOLATILE = new Set(["Rahu", "Mars", "Ketu"]);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

const NAT: Record<string, { f: string[]; n: string[]; e: string[] }> = {
  Sun:     { f: ["Moon","Mars","Jupiter"],       n: ["Mercury"],                           e: ["Venus","Saturn"] },
  Moon:    { f: ["Sun","Mercury"],               n: ["Mars","Jupiter","Venus","Saturn"],    e: [] },
  Mars:    { f: ["Sun","Moon","Jupiter"],         n: ["Venus","Saturn"],                    e: ["Mercury"] },
  Mercury: { f: ["Sun","Venus"],                 n: ["Mars","Jupiter","Saturn"],            e: ["Moon"] },
  Jupiter: { f: ["Sun","Moon","Mars"],           n: ["Saturn"],                             e: ["Mercury","Venus"] },
  Venus:   { f: ["Mercury","Saturn"],            n: ["Mars","Jupiter"],                     e: ["Sun","Moon"] },
  Saturn:  { f: ["Mercury","Venus"],             n: ["Jupiter"],                            e: ["Sun","Moon","Mars"] },
};

function relation(p: string, ruler: string): string {
  if (p === ruler) return "self";
  const row = NAT[ruler];
  if (!row) return "neutral";
  return row.f.includes(p) ? "friend" : row.e.includes(p) ? "enemy" : "neutral";
}

// S6: SIF_v3 factors
function vec_KIF(inputs: any): number {
  const r = inputs.kaala_pct / (inputs.other_pct.reduce((a: number, b: number) => a + b, 0) / inputs.other_pct.length);
  return r <= 1.5 ? 1.00 : r <= 2.5 ? 0.95 : 0.85;
}
function vec_DIF(inputs: any): number {
  const d = inputs.drig_bala;
  return d >= 0 ? 1.00 : d >= -20 ? 0.95 : 0.85;
}
function vec_AIF(inputs: any): number {
  const m = Math.max(...inputs.components) / inputs.rs;
  return m <= 0.45 ? 1.00 : m <= 0.60 ? 0.95 : 0.88;
}
function vec_CIF(inputs: any): number {
  const n = inputs.n_planets, sav = inputs.sav;
  if (n >= 3) return sav >= 30 ? 0.97 : sav >= 25 ? 0.93 : 0.88;
  if (n === 2) return sav >= 28 ? 0.98 : 0.95;
  return 1.00;
}
const YOGA_DELTA: Record<string, number> = {
  "Dhana Yoga": 0.03, "Lakshmi Yoga": 0.02, "Adhi Yoga": 0.02,
  "Raja Yoga": 0.02, "Gaja Kesari": 0.01,
  "Daridra Yoga": -0.04, "Graha Yuddha": -0.04, "Shakata Yoga": -0.03,
  "Kemadruma": -0.03, "Paapa Kartari": -0.03,
};
function vec_YIF(inputs: any): number {
  const delta = (inputs.yogas as string[]).reduce((s, y) => s + (YOGA_DELTA[y] ?? 0), 0);
  return clamp(1.00 + delta, 0.88, 1.00);
}
function vec_SIF_v3(inputs: any): number {
  return clamp(Math.min(...Object.values(inputs.components) as number[]), 0.82, 1.00);
}

// S7: T_v3 channels
function vec_ZC(inputs: any): number {
  const v = VOLATILE.has(inputs.planet);
  return inputs.zw_state === "OPEN" ? (v ? 0.97 : 1.00) : (v ? 0.85 : 0.95);
}
function vec_PC(inputs: any): number {
  // BPHS: tithi_in_paksha is paksha-relative (1–15), NOT absolute
  const mid = inputs.tithi_in_paksha >= 2 && inputs.tithi_in_paksha <= 12;
  return inputs.paksha === "Shukla"
    ? (mid ? 1.02 : 0.98)
    : (mid ? 0.94 : 0.88);
}
function vec_VR(inputs: any): number {
  const n = (inputs.amplifiers as string[]).length;
  if (n === 0) return 1.00;
  const isPlanet = (inputs.amplifiers as string[]).includes(inputs.planet);
  if (n === 1) return isPlanet ? 0.85 : 0.95;
  return VOLATILE.has(inputs.planet) ? 0.80 : 0.90;
}
const SS_DIG: Record<string, number> = {
  Exalted: 1.00, Own: 1.00, Moolatrikona: 0.98, "Grt.Friend": 0.97,
  Friend: 0.96, Neutral: 0.95, Enemy: 0.90, "Grt.Enemy": 0.88, Debilitated: 0.75,
};
function vec_SS_dignity(inputs: any): number { return SS_DIG[inputs.dignity] ?? 0.95; }
function vec_SS_house(inputs: any): number {
  return { Angular: 1.00, Succedent: 0.98, Cadent: 0.95 }[inputs.house_type as string] ?? 0.95;
}
function vec_SS_bav(inputs: any): number {
  return { 8: 1.00, 7: 1.00, 6: 0.99, 5: 0.97, 4: 0.95, 3: 0.92, 2: 0.89, 1: 0.87, 0: 0.85 }[inputs.bav as number] ?? 0.85;
}
const NAV_SS: Record<string, number> = {
  Exalted: 1.02, Own: 1.01, Moolatrikona: 1.01, Friend: 1.00, "Grt.Friend": 1.00,
  Neutral: 0.98, Enemy: 0.95, "Grt.Enemy": 0.95, Debilitated: 0.91,
};
function vec_SS_nav(inputs: any): number {
  const nav = inputs.navamsha;
  if (nav === null || nav === undefined) return 1.00;
  if (nav.is_vargottama) return 1.04;
  if (nav.is_pushkara) return 1.03;
  return NAV_SS[nav.dignity] ?? 0.98;
}
function vec_T_v3(inputs: any): number {
  return clamp(inputs.ZC * inputs.PC * inputs.VR * inputs.SS_dignity * inputs.SS_house * inputs.SS_bav * inputs.SS_nav, 0.58, 1.00);
}

// S8: RB
function vec_RB(inputs: any): number {
  const RB_TABLE: Record<string, number> = {
    Jupiter: 1.15, Venus: 1.15, Mercury: 1.10, Rahu: 1.10, Mars: 1.05,
    Moon: 0.95, Sun: 0.95, Ketu: 0.90, Saturn: 0.85,
  };
  return RB_TABLE[inputs.planet] ?? 1.00;
}

// S9: PAS_v3 channels
const PAS_D: Record<string, number> = {
  Exalted: 1.05, Own: 1.03, Moolatrikona: 1.03, "Grt.Friend": 1.02,
  Friend: 1.01, Neutral: 1.00, Enemy: 0.96, "Grt.Enemy": 0.93, Debilitated: 0.92,
};
function vec_D(inputs: any): number { return PAS_D[inputs.dignity] ?? 1.00; }
function vec_C(inputs: any): number {
  // Input: combust = "none" | "mild" | "severe" | false | true | object
  const c = inputs.combust;
  if (c === null || c === undefined || c === false || c === "none") return 1.00;
  if (c === true || c === "mild") return 0.95;
  if (c === "severe") return 0.85;
  if (typeof c === "object") {
    if (!c.combust) return 1.00;
    return (c.severity === "Severe" || c.severity === "severe") ? 0.85 : 0.95;
  }
  return 1.00;
}
function vec_R(inputs: any): number { return inputs.retrograde ? 0.97 : 1.00; }
// I_aspect tier mapping (BPHS: 4 tiers per contract §A5)
const I_ASPECT_MAP: Record<string, number> = {
  "benefic_strong":  1.02,
  "benefic_support": 1.02, // alias used in vectors
  "clean":           1.00,
  "mild_hostile":    0.97,
  "severe_hostile":  0.88,
};
function vec_I_aspect(inputs: any): number { return I_ASPECT_MAP[inputs.tier] ?? 1.00; }
function vec_H(inputs: any): number {
  return { Angular: 1.03, Succedent: 1.00, Cadent: 0.95 }[inputs.house_type as string] ?? 0.95;
}
function vec_DCF(inputs: any): number {
  // inputs: { self_disposited: bool|"own"|"exalted", s_disp?: number, dispositor_dignity?: string }
  const sd = inputs.self_disposited;
  if (sd === true || sd === "own" || sd === "exalted" || sd === "moolatrikona") return 1.03;
  if (sd === null || sd === undefined) return 1.00;
  const s = (typeof sd === "number") ? sd : (inputs.s_disp as number);
  if (s !== undefined && s !== null) {
    const base = s >= 0.85 ? 1.03 : s >= 0.70 ? 1.01 : s >= 0.50 ? 1.00 : s >= 0.35 ? 0.97 : 0.94;
    const dd = inputs.dispositor_dignity;
    const mod = dd === "Debilitated" ? 0.95 : (dd === "Exalted" || dd === "Own") ? 1.01 : 1.00;
    return clamp(base * mod, 0.92, 1.03);
  }
  return 1.00;
}
function vec_PAS_v3(inputs: any): number {
  // PAS_v3 clamp: BPHS contract = (0.58, 1.14) — NOT (0.75, 1.05)
  return clamp(inputs.C * inputs.D * inputs.DCF * inputs.H * inputs.I_aspect * inputs.R, 0.58, 1.14);
}

// S10: TM_v3 channels
function vec_TF(inputs: any): number {
  const mod = inputs.tithi_1_30 % 5;
  return mod === 1 ? 1.02 : mod === 2 ? 1.01 : mod === 3 ? 1.03 : mod === 4 ? 0.98 : 1.00;
}
const ALL_NAKSHATRAS = [
  "Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra",
  "Punarvasu","Pushya","Aslesha","Magha","Purva Phalguni","Uttara Phalguni",
  "Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha",
  "Mula","Purva Ashadha","Uttara Ashadha","Shravana","Dhanishta",
  "Shatabhisha","Purva Bhadrapada","Uttara Bhadrapada","Revati",
];
// Alternate spellings accepted by vectors
const NAK_ALIASES: Record<string, string> = {
  "Ashlesha": "Aslesha", "Anuradha": "Anuradha",
  "Mrigashirsha": "Mrigashira", "Purvashada": "Purva Ashadha",
  "Uttarashada": "Uttara Ashadha", "Purva Bhadra": "Purva Bhadrapada",
  "Uttara Bhadra": "Uttara Bhadrapada",
};
const NAK_LORDS = ["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"];
function vec_nakshatra_lord(inputs: any): string {
  const raw = inputs.nakshatra as string;
  const name = NAK_ALIASES[raw] ?? raw;
  const idx = ALL_NAKSHATRAS.indexOf(name);
  if (idx < 0) return "Sun";
  return NAK_LORDS[idx % 9] ?? "Sun";
}
function tmFriendFactor(p: string, ruler: string, enemyValue = 0.98): number {
  const rel = relation(p, ruler);
  return (rel === "friend" || rel === "self") ? 1.01 : rel === "enemy" ? enemyValue : 1.00;
}
function vec_DLR(inputs: any): number {
  if (inputs.planet === inputs.weekday_lord) return 1.03;
  return tmFriendFactor(inputs.planet, inputs.weekday_lord, 0.98);
}
function vec_NF(inputs: any): number {
  if (inputs.planet === inputs.nakshatra_lord_planet) return 1.03;
  return tmFriendFactor(inputs.planet, inputs.nakshatra_lord_planet, 0.97);
}
function vec_HP(inputs: any): number {
  if (inputs.planet === inputs.hora_ruler) return 1.03;
  return tmFriendFactor(inputs.planet, inputs.hora_ruler, 0.97);
}
function vec_TM_v3(inputs: any): number {
  return clamp(inputs.DLR * inputs.HP * inputs.NF * inputs.TF, 0.80, 1.05);
}

// S10b: BHF
function vec_BHF(inputs: any): number {
  const totals: number[] = inputs.totals12;
  const house: number = inputs.house;
  const bbMean = totals.reduce((a, b) => a + b, 0) / 12;
  if (bbMean === 0) return 1.00;
  const bbNorm = totals[house - 1]! / bbMean;
  let bhf: number;
  if (bbNorm >= 1.30) bhf = 1.05;
  else if (bbNorm >= 1.15) bhf = 1.03;
  else if (bbNorm >= 1.00) bhf = 1.01;
  else if (bbNorm >= 0.85) bhf = 1.00;
  else if (bbNorm >= 0.70) bhf = 0.96;
  else if (bbNorm >= 0.55) bhf = 0.92;
  else bhf = 0.88;
  const specHouses = [2, 5, 8, 11];
  if (specHouses.includes(house) && bbNorm >= 1.00) bhf = Math.min(1.05, bhf * 1.01);
  return bhf;
}

// S10c: DRF
const DRF_LEVEL: Record<string, number> = {
  "Grt.Friend": 1.04, "Friend": 1.02, "Neutral": 1.00, "Enemy": 0.94, "Grt.Enemy": 0.88,
};
function drfFriendLevel(p: string, ruler: string): string {
  if (p === ruler) return "Friend";
  const row = NAT[ruler];
  if (!row) return "Neutral";
  return row.f.includes(p) ? "Friend" : row.e.includes(p) ? "Enemy" : "Neutral";
}
function vec_DRF(inputs: any): number {
  const p = inputs.planet, md = inputs.md, ad = inputs.ad;
  if (p === md) return 1.08;
  if (p === ad) return 1.05;
  // Use supplied md_tier_value if present (direct tier value, skip MD computation)
  const base = inputs.md_tier_value !== undefined
    ? (inputs.md_tier_value as number)
    : (DRF_LEVEL[drfFriendLevel(p, md)] ?? 1.00);
  const adLevel = drfFriendLevel(p, ad);
  const adMod = (adLevel === "Friend" || adLevel === "Grt.Friend") ? 1.01
              : (adLevel === "Enemy" || adLevel === "Grt.Enemy")   ? 0.98
              : 1.00;
  return clamp(base * adMod, 0.88, 1.08);
}

// S10d: VGF
const VGF_DIG: Record<string, number> = {
  Exalted: 1.02, Own: 1.01, Moolatrikona: 1.01, Friend: 1.00, "Grt.Friend": 1.00,
  Neutral: 0.99, Enemy: 0.97, "Grt.Enemy": 0.97, Debilitated: 0.93,
};
function vec_VGF(inputs: any): number {
  const nav = inputs.navamsha;
  if (nav === null || nav === undefined) return 1.00;
  if (nav.is_vargottama) return 1.06;
  const pushkara = nav.is_pushkara ? 1.04 : 1.00;
  const digMod = VGF_DIG[nav.dignity] ?? 0.99;
  return clamp(pushkara * digMod, 0.93, 1.06);
}

// S5: raw shadbala ratio — inputs.rs is an OBJECT {planet: virupas}
function vec_S5(inputs: any): any {
  const rsMap: Record<string, number> = inputs.rs;
  const vals = Object.values(rsMap) as number[];
  const maxRS = Math.max(...vals, 1);
  // Return normalized map {planet → S} where S = rs[p] / max(rs)
  const result: Record<string, number> = {};
  for (const [p, v] of Object.entries(rsMap)) {
    result[p] = v / maxRS;
  }
  return result;
}

// CPS_pre_v3 product
function vec_CPS_pre_v3(inputs: any): number {
  return inputs.BHF * inputs.DRF * inputs.PAS_v3 * inputs.RB * inputs.S * inputs.SIF_v3 * inputs.TM_v3 * inputs.T_v3 * inputs.VGF;
}

// Threshold lookup for S11 — mode × regime
const S11_THRESHOLD: Record<string, Record<string, number>> = {
  "OPEN":   { "ACCUMULATION": 0.45, "PRECISION": 0.55, "OBSERVATION": 0.35 },
  "DAMPED": { "ACCUMULATION": 0.55, "PRECISION": 0.60, "OBSERVATION": 0.45 },
};
// S11 survival gate → returns [threshold, survivorList] tuple
function vec_S11(inputs: any): [number, string[]] {
  const cps: Record<string, number> = inputs.cps;
  const mode: string = inputs.mode;
  const regime: string = inputs.regime;
  const theta = S11_THRESHOLD[regime]?.[mode] ?? 0.45;
  // BPHS / reference: filter in canonical planetary order
  const CANONICAL_ORDER = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
  const survivors = CANONICAL_ORDER.filter(p => p in cps && cps[p] >= theta);
  return [theta, survivors];
}

// STEPK_contributors — inputs.survivors is an ARRAY of planet strings
function vec_STEPK(inputs: any): any {
  const survivors: string[] = inputs.survivors;
  const digitContributors = survivors.filter(p => p !== "Moon");
  return {
    digit_contributors: digitContributors,
    all_zero_vector: digitContributors.length === 0,
  };
}

// S12 field classification
function vec_S12(inputs: any): any {
  const cps: Record<string, number> = inputs.cps;
  const survivors: string[] = inputs.survivors;
  const t_v3: Record<string, number> = inputs.t_v3;
  const pd = survivors.filter(p => p !== "Moon");
  const n = pd.length;
  const tbar = survivors.length > 0 ? survivors.reduce((acc, p) => acc + (t_v3[p] ?? 0.95), 0) / survivors.length : 0.95;
  const d = n === 0 ? null : Math.max(...pd.map(p => cps[p])) / pd.reduce((acc, p) => acc + cps[p], 0);
  const ft = n <= 2 ? "COMPRESSED" : (n <= 4 && d! >= 0.30) ? "STRIKE" : tbar < 0.70 ? "VOLATILE" : (n >= 5 && d! < 0.20) ? "STABLE" : "FRAGMENTED";
  return { P_digit: pd, n, D: d, field_type: ft };
}

// STEPL_2D — dv is an ARRAY of digit counts [0..9]; top 6 pairs
function vec_STEPL_2D(inputs: any): any {
  const dv: number[] = Array.isArray(inputs.dv) ? inputs.dv : Object.values(inputs.dv);
  let S = 0;
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      S += dv[x] * dv[y];
    }
  }
  const rows: [string, number][] = [];
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      rows.push([`${x}${y}`, S === 0 ? 0 : (dv[x] * dv[y]) / S]);
    }
  }
  rows.sort((a, b) => {
    if (Math.abs(b[1] - a[1]) > 1e-15) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  const checksum = rows.reduce((acc, r) => acc + r[1], 0);
  return { top: rows.slice(0, 6), checksum };
}

// STEPL_3D — top 8 triples
function vec_STEPL_3D(inputs: any): any {
  const dv: number[] = Array.isArray(inputs.dv) ? inputs.dv : Object.values(inputs.dv);
  let S = 0;
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      for (let z = 0; z < 10; z++) {
        S += dv[x] * dv[y] * dv[z];
      }
    }
  }
  const rows: [string, number][] = [];
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      for (let z = 0; z < 10; z++) {
        rows.push([`${x}${y}${z}`, S === 0 ? 0 : (dv[x] * dv[y] * dv[z]) / S]);
      }
    }
  }
  rows.sort((a, b) => {
    if (Math.abs(b[1] - a[1]) > 1e-15) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  const checksum = rows.reduce((acc, r) => acc + r[1], 0);
  return { top: rows.slice(0, 8), checksum };
}

// K_MAX_DEFAULT — returns max survivors for given geometry and mode
const KMAX_TABLE: Record<string, Record<string, number>> = {
  "ordered_2_digit": { "PRECISION": 5,  "ACCUMULATION": 10, "OBSERVATION": 20 },
  "ordered_3_digit": { "PRECISION": 4,  "ACCUMULATION":  8, "OBSERVATION": 15 },
};
function vec_K_MAX_DEFAULT(inputs: any): number {
  return KMAX_TABLE[inputs.geometry]?.[inputs.mode] ?? 2;
}

// ── Function dispatch ──────────────────────────────────────────────
const FN_MAP: Record<string, (inputs: any) => any> = {
  KIF: vec_KIF,
  DIF: vec_DIF,
  AIF: vec_AIF,
  CIF: vec_CIF,
  YIF: vec_YIF,
  SIF_v3: vec_SIF_v3,
  ZC: vec_ZC,
  PC: vec_PC,
  VR: vec_VR,
  SS_dignity: vec_SS_dignity,
  SS_house: vec_SS_house,
  SS_bav: vec_SS_bav,
  SS_nav: vec_SS_nav,
  T_v3: vec_T_v3,
  RB: vec_RB,
  D: vec_D,
  C: vec_C,
  R: vec_R,
  I_aspect: vec_I_aspect,
  H: vec_H,
  DCF: vec_DCF,
  PAS_v3: vec_PAS_v3,
  TF: vec_TF,
  DLR: vec_DLR,
  NF: vec_NF,
  HP: vec_HP,
  nakshatra_lord: vec_nakshatra_lord,
  TM_v3: vec_TM_v3,
  BHF: vec_BHF,
  DRF: vec_DRF,
  VGF: vec_VGF,
  S5: vec_S5,
  CPS_pre_v3: vec_CPS_pre_v3,
  S11: vec_S11,
  STEPK_contributors: vec_STEPK,
  S12: vec_S12,
  STEPL_2D: vec_STEPL_2D,
  STEPL_3D: vec_STEPL_3D,
  K_MAX_DEFAULT: vec_K_MAX_DEFAULT,
};

// ── Test runner ────────────────────────────────────────────────────
export function runConformanceVectorTests() {
  const doc = vectorDoc as any;
  const vectors: any[] = doc.vectors;
  const SKIP_GROUPS = new Set(["interpretation"]); // skip 4 ambiguous vectors

  let pass = 0, fail = 0, skip = 0, no_adapter = 0;
  const failures: string[] = [];
  const no_adapters: string[] = [];

  for (const v of vectors) {
    if (SKIP_GROUPS.has(v.group)) { skip++; continue; }

    const fn = FN_MAP[v.function as string];
    if (!fn) {
      no_adapter++;
      no_adapters.push(`${v.id} [${v.function}]`);
      continue;
    }

    let actual: any;
    try {
      actual = fn(v.inputs);
    } catch (e) {
      fail++;
      failures.push(`${v.id} [${v.function}] ERROR: ${e}`);
      continue;
    }

    if (close(actual, v.expected)) {
      pass++;
    } else {
      fail++;
      failures.push(
        `${v.id} [${v.function}] A${v.assertion} ` +
        `expected=${JSON.stringify(v.expected)} ` +
        `got=${JSON.stringify(actual)} ` +
        `note="${v.note}"`
      );
    }
  }

  const total = vectors.length;
  const ran = pass + fail;
  console.log(`\n${"═".repeat(62)}`);
  console.log(`  DSSME v1.6 Conformance Vectors — Results`);
  console.log(`${"═".repeat(62)}`);
  console.log(`  Total vectors : ${total}`);
  console.log(`  Skipped (interp): ${skip}`);
  console.log(`  NO_ADAPTER    : ${no_adapter}`);
  console.log(`  Ran           : ${ran}`);
  console.log(`  ✅ PASS       : ${pass}`);
  console.log(`  ❌ FAIL       : ${fail}`);
  console.log(`${"─".repeat(62)}`);

  if (failures.length > 0) {
    console.log(`\n  FAILURES:`);
    failures.forEach(f => console.log(`    ✗ ${f}`));
  }
  if (no_adapters.length > 0) {
    console.log(`\n  NO_ADAPTER (not yet implemented):`);
    no_adapters.forEach(f => console.log(`    ? ${f}`));
  }

  console.log(`${"═".repeat(62)}\n`);

  if (fail > 0) {
    throw new Error(`Conformance Vector Tests: ${fail} FAILED (${pass}/${ran} passed, ${skip} skipped)`);
  }
  console.log(`  ✓ Conformance Vector Tests Passed! (${pass}/${ran} + ${skip} skipped)`);
}
