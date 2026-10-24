/**
 * BLOCK_16 — YOGA_LIST
 *
 * Detects major yogas from chart data for the YIF (Yoga Integrity Factor) in S6.
 *
 * YIF yoga types per §8 S6:
 * Spec-positive (attenuation-neutral, small credit):
 *   Dhana Yoga     (2nd/11th lord connection)         +0.03
 *   Lakshmi Yoga   (9th lord in own/exalt in kendra)  +0.02
 *   Adhi Yoga      (benefics in H6/H7/H8)             +0.02
 *   Raja Yoga      (kendra + trikona lord link)        +0.02
 *   Gaja Kesari    (Jupiter/Moon in kendra)            +0.01
 * Spec-negative (attenuation):
 *   Daridra Yoga   (6th/8th/12th lord link)           -0.04
 *   Graha Yuddha   (planetary war — loser)            -0.04
 *   Shakata Yoga   (Jupiter/Moon on 6-8 axis)         -0.03
 *   Kemadruma      (Moon, no flanking planets)        -0.03
 *   Paapa Kartari  (planet hemmed by malefics)        -0.03
 */

import type {
  ClassicalPlanet,
  NineBody,
  YogaEntry,
  YogaListBlock,
  YogaType,
  ZodiacSign,
} from "../../types/dssme-canonical-types.ts";
import type { BlockContext, BlockResult } from "../blocks/blockTypes.ts";
import { finalizeBlock } from "../blocks/blockResult.ts";
import { NINE_BODIES_ORDER, SIGN_LORDS } from "../astronomy/planetaryPositions.ts";
import { ZODIAC_SIGNS_ARIES_FIRST } from "../../types/dssme-canonical-types.ts";

// House lord lookup: get the lord of a specific house number (whole-sign)
function houseLord(lagnaSignIdx: number, houseNum: number): ClassicalPlanet {
  const signIdx = (lagnaSignIdx + houseNum - 1) % 12;
  const sign = ZODIAC_SIGNS_ARIES_FIRST[signIdx]!;
  return SIGN_LORDS[sign];
}

// Check if a planet is in a specific house number
function planetInHouse(ctx: BlockContext, planet: NineBody, house: number): boolean {
  return ctx.chart.planets[planet].house === house;
}

// Check if a planet is in an angular house (1,4,7,10)
function inAngular(house: number): boolean {
  return [1, 4, 7, 10].includes(house);
}

// Check if a planet is in a trikona (1,5,9)
function inTrikona(house: number): boolean {
  return [1, 5, 9].includes(house);
}

// Check if a planet is a benefic (natural)
const NATURAL_BENEFICS: NineBody[] = ["Jupiter", "Venus", "Moon", "Mercury"];
const NATURAL_MALEFICS: NineBody[] = ["Sun", "Mars", "Saturn", "Rahu", "Ketu"];

function isBenefic(p: NineBody): boolean {
  return NATURAL_BENEFICS.includes(p);
}
function isMalefic(p: NineBody): boolean {
  return NATURAL_MALEFICS.includes(p);
}

function detectYogas(ctx: BlockContext): YogaEntry[] {
  const { chart } = ctx;
  const lagnaSignIdx = ZODIAC_SIGNS_ARIES_FIRST.indexOf(chart.lagna.sign);
  const yogas: YogaEntry[] = [];

  const lord = (houseNum: number): ClassicalPlanet => houseLord(lagnaSignIdx, houseNum);

  // -----------------------------------------------------------------------
  // SPEC-POSITIVE YOGAS
  // -----------------------------------------------------------------------

  // 1. Dhana Yoga: 2nd or 11th lord in angular/trikona, or conjunct each other
  {
    const lord2 = lord(2);
    const lord11 = lord(11);
    const lord2House = chart.planets[lord2].house;
    const lord11House = chart.planets[lord11].house;

    // Lords conjunct (same house), or lord2 in angular/trikona
    if (
      lord2House === lord11House ||
      (inAngular(lord2House) && inTrikona(lord11House)) ||
      (inTrikona(lord2House) && inAngular(lord11House))
    ) {
      yogas.push({
        name: "Dhana Yoga",
        type: "spec_positive",
        planets_involved: [lord2, lord11],
        active: true,
        description: "2nd/11th lord connection — wealth and gains alignment",
      });
    }
  }

  // 2. Lakshmi Yoga: 9th lord in own/exalted sign AND in kendra
  {
    const lord9 = lord(9);
    const lord9Pos = chart.planets[lord9];
    const ownOrExalted = lord9Pos.sign === ZODIAC_SIGNS_ARIES_FIRST[(lagnaSignIdx + 8) % 12] ||
      inAngular(lord9Pos.house);
    const inKendra = inAngular(lord9Pos.house);

    // Simplified: 9th lord in kendra = active
    if (inKendra) {
      yogas.push({
        name: "Lakshmi Yoga",
        type: "spec_positive",
        planets_involved: [lord9],
        active: true,
        description: "9th lord in kendra — fortune and prosperity channel",
      });
    }
  }

  // 3. Adhi Yoga: natural benefics (Jupiter, Venus, Mercury) in H6, H7, H8
  {
    const beneficsInSpecHouses: NineBody[] = [];
    for (const p of (["Jupiter", "Venus", "Mercury"] as NineBody[])) {
      const h = chart.planets[p].house;
      if ([6, 7, 8].includes(h)) beneficsInSpecHouses.push(p);
    }
    if (beneficsInSpecHouses.length >= 2) {
      yogas.push({
        name: "Adhi Yoga",
        type: "spec_positive",
        planets_involved: beneficsInSpecHouses,
        active: true,
        description: "Natural benefics in H6/H7/H8 — commanding position",
      });
    }
  }

  // 4. Raja Yoga: kendra lord + trikona lord in conjunction or mutual aspect
  {
    const kendraLords = [1, 4, 7, 10].map(lord);
    const trikonaLords = [1, 5, 9].map(lord);
    const rajaYogaPlanets: ClassicalPlanet[] = [];

    for (const kl of kendraLords) {
      for (const tl of trikonaLords) {
        if (kl === tl) continue;
        const klHouse = chart.planets[kl].house;
        const tlHouse = chart.planets[tl].house;
        // Conjunction or 7th from each other (mutual opposition)
        if (klHouse === tlHouse || Math.abs(klHouse - tlHouse) === 6) {
          if (!rajaYogaPlanets.includes(kl)) rajaYogaPlanets.push(kl);
          if (!rajaYogaPlanets.includes(tl)) rajaYogaPlanets.push(tl);
        }
      }
    }

    if (rajaYogaPlanets.length >= 2) {
      yogas.push({
        name: "Raja Yoga",
        type: "spec_positive",
        planets_involved: rajaYogaPlanets.slice(0, 2),
        active: true,
        description: "Kendra+trikona lord link — authority and success",
      });
    }
  }

  // 5. Gaja Kesari: Jupiter and Moon both in angular houses
  {
    const jupHouse = chart.planets.Jupiter.house;
    const moonHouse = chart.planets.Moon.house;
    // Moon in kendra from Jupiter
    const diff = ((jupHouse - moonHouse + 12) % 12);
    const moonInKendraFromJup = [0, 3, 6, 9].includes(diff);

    if (moonInKendraFromJup && (inAngular(jupHouse) || inAngular(moonHouse))) {
      yogas.push({
        name: "Gaja Kesari",
        type: "spec_positive",
        planets_involved: ["Jupiter", "Moon"],
        active: true,
        description: "Jupiter/Moon in kendra — elephant-lion power",
      });
    }
  }

  // -----------------------------------------------------------------------
  // SPEC-NEGATIVE YOGAS
  // -----------------------------------------------------------------------

  // 6. Daridra Yoga: 6th/8th/12th lord in angular or mutual connection
  {
    const lord6 = lord(6);
    const lord8 = lord(8);
    const lord12 = lord(12);
    const dusthanaLords = [lord6, lord8, lord12];

    for (const l of dusthanaLords) {
      if (inAngular(chart.planets[l].house)) {
        yogas.push({
          name: "Daridra Yoga",
          type: "spec_negative",
          planets_involved: [l],
          active: true,
          description: "Dusthana lord in kendra — adversity channel active",
        });
        break; // One instance is enough
      }
    }
  }

  // 7. Graha Yuddha: two Tara Grahas within 1° (planetary war — loser only receives -0.04 YIF)
  {
    const taraPlanets: ClassicalPlanet[] = ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
    for (let i = 0; i < taraPlanets.length; i++) {
      for (let j = i + 1; j < taraPlanets.length; j++) {
        const p1 = taraPlanets[i]!;
        const p2 = taraPlanets[j]!;
        const pos1 = chart.planets[p1];
        const pos2 = chart.planets[p2];
        const rawDiff = Math.abs(pos1.siderealLongitude - pos2.siderealLongitude) % 360;
        const sep = rawDiff > 180 ? 360 - rawDiff : rawDiff;
        if (sep < 1.0) {
          const lat1 = pos1.eclipticLatitude ?? 0;
          const lat2 = pos2.eclipticLatitude ?? 0;
          const loser =
            Math.abs(lat1 - lat2) > 1e-6
              ? (lat1 < lat2 ? p1 : p2)
              : (pos1.siderealLongitude > pos2.siderealLongitude ? p2 : p1);
          const winner = loser === p1 ? p2 : p1;
          yogas.push({
            name: "Graha Yuddha",
            type: "spec_negative",
            planets_involved: [loser], // Master Contract §8 S6: "Graha Yuddha (planetary war — loser) -0.04"
            active: true,
            description: `Planetary war: ${winner} defeats ${loser} (sep=${sep.toFixed(2)}°) — loser attenuated`,
          });
        }
      }
    }
  }

  // 8. Shakata Yoga: Jupiter and Moon on 6-8 axis (Moon in 6th or 8th FROM Jupiter)
  // Moon in 6th from Jupiter → diff = 5 (0-indexed houses: 6-1=5)
  // Moon in 8th from Jupiter → diff = 7
  {
    const jupHouse = chart.planets.Jupiter.house;
    const moonHouse = chart.planets.Moon.house;
    const diff = ((moonHouse - jupHouse + 12) % 12);
    if (diff === 5 || diff === 7) {
      yogas.push({
        name: "Shakata Yoga",
        type: "spec_negative",
        planets_involved: ["Jupiter", "Moon"],
        active: true,
        description: "Jupiter/Moon on 6-8 axis — wheel of fortune adversity",
      });
    }
  }

  // 9. Kemadruma Yoga: Moon with no planets in adjacent houses (2nd and 12th from Moon)
  {
    const moonHouse = chart.planets.Moon.house;
    const prevHouse = ((moonHouse - 2 + 12) % 12) + 1;
    const nextHouse = (moonHouse % 12) + 1;

    const hasAdjacentPlanet = NINE_BODIES_ORDER.some(p => {
      if (p === "Moon") return false;
      const h = chart.planets[p].house;
      return h === prevHouse || h === nextHouse;
    });

    if (!hasAdjacentPlanet) {
      yogas.push({
        name: "Kemadruma Yoga",
        type: "spec_negative",
        planets_involved: ["Moon"],
        active: true,
        description: "Moon isolated with no planets in adjacent houses — emotional instability",
      });
    }
  }

  // 10. Paapa Kartari Yoga: a planet hemmed between malefics on both sides
  {
    for (const planet of (["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as NineBody[])) {
      const planetHouse = chart.planets[planet].house;
      const prevHouse = ((planetHouse - 2 + 12) % 12) + 1;
      const nextHouse = (planetHouse % 12) + 1;

      const maleficBefore = NINE_BODIES_ORDER.some(p => {
        if (p === planet) return false;
        return isMalefic(p) && chart.planets[p].house === prevHouse;
      });
      const maleficAfter = NINE_BODIES_ORDER.some(p => {
        if (p === planet) return false;
        return isMalefic(p) && chart.planets[p].house === nextHouse;
      });

      if (maleficBefore && maleficAfter) {
        yogas.push({
          name: "Paapa Kartari Yoga",
          type: "spec_negative",
          planets_involved: [planet],
          active: true,
          description: `${planet} hemmed between malefics — affliction scissors`,
        });
      }
    }
  }

  return yogas;
}

export function buildYogaListBlock(ctx: BlockContext): BlockResult<YogaListBlock> {
  const yogas = detectYogas(ctx);

  return finalizeBlock({
    blockId: "YOGA_LIST",
    ctx,
    inputs: ["CanonicalChart"],
    value: yogas,
    issues: [],
  });
}
