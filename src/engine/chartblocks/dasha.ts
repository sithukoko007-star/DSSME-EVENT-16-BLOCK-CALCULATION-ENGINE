/**
 * BLOCK_3 — DASHA (Vimshottari Dasha)
 *
 * Vimshottari Dasha system:
 *   - Based on Moon's nakshatra at birth
 *   - Total cycle = 120 years
 *   - Nakshatra lord sequence (9 lords × 3 cycles = 27 nakshatras):
 *     Ketu-Venus-Sun-Moon-Mars-Rahu-Jupiter-Saturn-Mercury
 *   - Dasha years: Ketu 7, Venus 20, Sun 6, Moon 10, Mars 7, Rahu 18, Jupiter 16, Saturn 19, Mercury 17
 *
 * Algorithm:
 *   1. Find Moon's nakshatra and pada at chart instant
 *   2. The current Mahadasha lord = nakshatra lord
 *   3. Fraction elapsed = Moon's position within nakshatra
 *   4. Remaining years in current MD = (1 - fraction) × MD years
 *   5. Compute MD/AD/PD from there
 */

import type {
  DashaBlock,
  DashaEntry,
  NineBody,
} from "../../types/dssme-canonical-types.ts";
import type { BlockContext, BlockResult } from "../blocks/blockTypes.ts";
import { errorIssue, finalizeBlock, warningIssue } from "../blocks/blockResult.ts";

// Vimshottari sequence: 9 lords
export const VIMSHOTTARI_LORDS: NineBody[] = [
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
];

// Dasha years in the Vimshottari sequence
export const VIMSHOTTARI_YEARS: Record<string, number> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};

// Total Vimshottari cycle = 120 years
const TOTAL_YEARS = 120;

// Nakshatra lord (1..27 → one of 9 lords)
// Nakshatras 1-3 → Ketu, 4-6 → Venus, 7-9 → Sun, 10-12 → Moon, 13-15 → Mars,
// 16-18 → Rahu, 19-21 → Jupiter, 22-24 → Saturn, 25-27 → Mercury
export function nakshatraLord(nakshatraIndex1to27: number): NineBody {
  const lordIdx = ((nakshatraIndex1to27 - 1) % 9);
  return VIMSHOTTARI_LORDS[lordIdx]!;
}

// 27 Nakshatra names in order
const NAKSHATRA_NAMES: string[] = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Aslesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
  "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta",
  "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];

/** Get nakshatra index (0-based) from sidereal longitude. */
function getNakshatraIdx0(moonLon: number): number {
  return Math.floor((moonLon % 360) / (360 / 27));
}

/** Fraction elapsed in current nakshatra (0..1). */
function getNakshatraFraction(moonLon: number): number {
  const nakshatraLen = 360 / 27; // ~13.333°
  const posInNakshatra = moonLon % nakshatraLen;
  return posInNakshatra / nakshatraLen;
}

/** Format Julian Day UT → "DD-MM-YYYY" string. */
function jdToDateStr(jdUt: number): string {
  const utcMs = (jdUt - 2440587.5) * 86400000;
  const d = new Date(utcMs);
  const day = d.getUTCDate().toString().padStart(2, "0");
  const month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

/** Years to Julian days. */
function yearsToDays(years: number): number {
  return years * 365.25;
}

/** Julian days to years. */
function daysToYears(days: number): number {
  return days / 365.25;
}

/** Find lord index in VIMSHOTTARI_LORDS. */
function lordIndex(lord: NineBody): number {
  return VIMSHOTTARI_LORDS.indexOf(lord);
}

/**
 * Compute Vimshottari Dasha from Moon's nakshatra at chart instant.
 * Returns: MD, AD, PD lords + 5 upcoming ADs.
 */
export function buildDashaBlock(ctx: BlockContext): BlockResult<DashaBlock> {
  const { chart } = ctx;
  const issues = [];

  const moonLon = chart.planets.Moon.siderealLongitude;
  const chartJd = chart.time.julianDayUt;

  // Nakshatra info
  const nakIdx0 = getNakshatraIdx0(moonLon);
  const nakFraction = getNakshatraFraction(moonLon);
  const nakLord = nakshatraLord(nakIdx0 + 1); // 1-based
  const nakName = NAKSHATRA_NAMES[nakIdx0] ?? "Unknown";

  // Current MD
  const mdYears = VIMSHOTTARI_YEARS[nakLord]!;
  const mdRemaining = (1 - nakFraction) * mdYears; // years remaining in this MD

  // Absolute JD at start of current MD (approximate)
  const mdStartJd = chartJd - nakFraction * yearsToDays(mdYears);

  // Compute ADs within this MD and the next MD
  const upcomingADs: DashaEntry[] = [];
  let mdIdx = lordIndex(nakLord);

  // How much of the current MD has elapsed in terms of AD
  const mdElapsedYears = nakFraction * mdYears;
  let adElapsedYears = 0;
  let adIdx = lordIndex(nakLord); // ADs start with same lord as MD
  let adJdStart = mdStartJd;
  let currentMdJdStart = mdStartJd;
  let currentMdYears = mdYears;

  // Find current AD by iterating through ADs within current MD
  let adFound = false;
  let currentAd: NineBody = nakLord;
  let currentPd: NineBody = nakLord;

  // Iterate through current MD's ADs
  for (let adi = 0; adi < 9; adi++) {
    const adLord = VIMSHOTTARI_LORDS[(adIdx + adi) % 9]!;
    const adYears = (VIMSHOTTARI_YEARS[adLord]! / TOTAL_YEARS) * currentMdYears;
    const adJdEnd = adJdStart + yearsToDays(adYears);

    if (!adFound && adJdEnd > chartJd) {
      // This is the current AD
      currentAd = adLord;
      adFound = true;

      // Find current PD within this AD
      let pdJdStart = adJdStart;
      for (let pdi = 0; pdi < 9; pdi++) {
        const pdLord = VIMSHOTTARI_LORDS[(adIdx + adi + pdi) % 9]!;
        const pdYears = (VIMSHOTTARI_YEARS[pdLord]! / TOTAL_YEARS) * adYears;
        const pdJdEnd = pdJdStart + yearsToDays(pdYears);
        if (pdJdEnd > chartJd) {
          currentPd = pdLord;
          break;
        }
        pdJdStart = pdJdEnd;
      }
    }

    // Collect upcoming ADs (from current position forward)
    if (adJdEnd >= chartJd) {
      upcomingADs.push({
        planet: adLord,
        start: jdToDateStr(adJdStart),
        end: jdToDateStr(adJdEnd),
      });
    }

    adJdStart = adJdEnd;

    if (upcomingADs.length >= 5 && adFound) {
      // Check if we need to go into the next MD
      if (upcomingADs.length >= 5) break;
    }
  }

  // If we don't have 5 upcoming ADs, continue into next MD
  if (upcomingADs.length < 5) {
    const nextMdIdx = (mdIdx + 1) % 9;
    const nextMdLord = VIMSHOTTARI_LORDS[nextMdIdx]!;
    const nextMdYears = VIMSHOTTARI_YEARS[nextMdLord]!;
    let nextAdJdStart = currentMdJdStart + yearsToDays(currentMdYears);

    for (let adi = 0; adi < 9 && upcomingADs.length < 5; adi++) {
      const adLord = VIMSHOTTARI_LORDS[(nextMdIdx + adi) % 9]!;
      const adYears = (VIMSHOTTARI_YEARS[adLord]! / TOTAL_YEARS) * nextMdYears;
      const adJdEnd = nextAdJdStart + yearsToDays(adYears);
      upcomingADs.push({
        planet: adLord,
        start: jdToDateStr(nextAdJdStart),
        end: jdToDateStr(adJdEnd),
      });
      nextAdJdStart = adJdEnd;
    }
  }

  if (upcomingADs.length < 5) {
    issues.push(warningIssue("DASHA.upcoming_ad", `Only ${upcomingADs.length} upcoming antardashas computed (minimum 5 required)`));
  }

  // Next mahadasha
  const nextMdLord = VIMSHOTTARI_LORDS[(mdIdx + 1) % 9]!;

  const dashaString = `${nakLord}-${currentAd}-${currentPd}`;

  const value: DashaBlock = {
    mahadasha_planet: nakLord,
    antardasha_planet: currentAd,
    pratyantara: currentPd,
    dasha_string: dashaString,
    upcoming_ad: upcomingADs,
    next_mahadasha_planet: nextMdLord,
  };

  return finalizeBlock({
    blockId: "DASHA",
    ctx,
    inputs: ["CanonicalChart"],
    value,
    issues,
  });
}
