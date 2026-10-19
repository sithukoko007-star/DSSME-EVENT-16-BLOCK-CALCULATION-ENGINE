/**
 * BLOCK_11/12 — ASPECTS_PLANETS and ASPECTS_BHAVAS
 *
 * Vedic (Parashari) aspects:
 *   All planets: 7th house (full, 4/4 = 1.0 = 60 score)
 *   Mars:    4th and 8th additional (full, 4/4)
 *   Jupiter: 5th and 9th additional (full, 4/4)
 *   Saturn:  3rd and 10th additional (full, 4/4)
 *   Rahu:    5th and 9th (same as Jupiter rule for nodes)
 *   Ketu:    5th and 9th (same rule)
 *
 * Score scale: 0–60 (60 = full 4/4 aspect, 45 = 3/4, 30 = 2/4, 15 = 1/4)
 *
 * ASPECTS_PLANETS: from/to planet pairs (p aspects q if p's aspect hits q's house)
 * ASPECTS_BHAVAS:  aspect strength on each of 12 houses
 */

import type {
  AspectsBhavasBlock,
  AspectsPlanetsBlock,
  BhavaAspectDetail,
  BhavaAspectEntry,
  HouseKey,
  NineBody,
  PlanetAspect,
} from "../../types/dssme-canonical-types.ts";
import type { BlockContext } from "../blocks/blockTypes.ts";
import { HOUSE_KEYS } from "../blocks/blockResult.ts";
import { NINE_BODIES_ORDER } from "../astronomy/planetaryPositions.ts";

// Additional aspects per planet (beyond the universal 7th)
// Value = fraction as number (1.0 = full, 0.75 = 3/4, etc.)
const SPECIAL_ASPECTS: Partial<Record<NineBody, Array<{ offset: number; fraction: number }>>> = {
  Mars:    [{ offset: 4, fraction: 1.0 }, { offset: 8, fraction: 1.0 }],
  Jupiter: [{ offset: 5, fraction: 1.0 }, { offset: 9, fraction: 1.0 }],
  Saturn:  [{ offset: 3, fraction: 1.0 }, { offset: 10, fraction: 1.0 }],
  Rahu:    [{ offset: 5, fraction: 1.0 }, { offset: 9, fraction: 1.0 }],
  Ketu:    [{ offset: 5, fraction: 1.0 }, { offset: 9, fraction: 1.0 }],
};

function fractionToStr(f: number): string {
  if (f >= 1.0) return "4/4";
  if (f >= 0.75) return "3/4";
  if (f >= 0.5) return "2/4";
  return "1/4";
}

function fractionToScore(f: number): number {
  return Math.round(f * 60);
}

/**
 * Compute all planet-to-planet and planet-to-bhava aspects.
 * Uses whole-sign house system: aspecting house = (aspector_house + offset - 1) % 12 + 1
 */
export function computeAspects(ctx: BlockContext): {
  ASPECTS_PLANETS: AspectsPlanetsBlock;
  ASPECTS_BHAVAS: AspectsBhavasBlock;
} {
  const { chart } = ctx;

  const planetAspects: PlanetAspect[] = [];

  // Map house number → occupants
  const houseOccupants: Record<number, NineBody[]> = {};
  for (const body of NINE_BODIES_ORDER) {
    const h = chart.planets[body].house;
    if (!houseOccupants[h]) houseOccupants[h] = [];
    houseOccupants[h]!.push(body);
  }

  // Aspect accumulator for bhavas
  const bhavaAspectMap: Record<number, Record<NineBody, BhavaAspectDetail>> = {};
  for (let h = 1; h <= 12; h++) bhavaAspectMap[h] = {} as Record<NineBody, BhavaAspectDetail>;

  for (const aspector of NINE_BODIES_ORDER) {
    const aspectorHouse = chart.planets[aspector].house;

    // Build list of aspects from this planet
    const aspects: Array<{ offset: number; fraction: number }> = [
      { offset: 7, fraction: 1.0 }, // universal 7th aspect
    ];
    const special = SPECIAL_ASPECTS[aspector] ?? [];
    aspects.push(...special);

    for (const asp of aspects) {
      const targetHouse = ((aspectorHouse + asp.offset - 2) % 12) + 1;
      const score = fractionToScore(asp.fraction);
      const fractionStr = fractionToStr(asp.fraction);

      // Record planet-to-bhava aspect
      bhavaAspectMap[targetHouse]![aspector] = { score, fraction: fractionStr };

      // Record planet-to-planet aspects (for occupants of the target house)
      const targetOccupants = houseOccupants[targetHouse] ?? [];
      for (const target of targetOccupants) {
        if (target === aspector) continue; // no self-aspect
        planetAspects.push({
          from: aspector,
          to: target,
          fraction: fractionStr,
          score,
        });
      }
    }
  }

  // Build ASPECTS_BHAVAS
  const ASPECTS_BHAVAS: AspectsBhavasBlock = {} as AspectsBhavasBlock;
  for (const key of HOUSE_KEYS) {
    const n = parseInt(key, 10);
    const houseSign = chart.houses[key]!.sign;
    // bhava cusp = midpoint of house sign (15° into sign)
    const lagnaSignIdx = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"].indexOf(chart.lagna.sign);
    const bhavaDeg = ((lagnaSignIdx + n - 1) % 12) * 30 + 15;

    const entry: BhavaAspectEntry = {
      degree: parseFloat(bhavaDeg.toFixed(2)),
      aspects: bhavaAspectMap[n] ?? {},
    };
    ASPECTS_BHAVAS[key] = entry;
  }

  return { ASPECTS_PLANETS: planetAspects, ASPECTS_BHAVAS };
}
