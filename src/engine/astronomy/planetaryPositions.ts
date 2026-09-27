/**
 * Planetary Positions Engine
 * High-precision sidereal positions with Lahiri ayanamsa
 * Conforms to DSSME Canonical Architecture
 */

import {
  CanonicalBodyPosition,
  ClassicalPlanet,
  NineBody,
  ZODIAC_SIGNS_ARIES_FIRST,
  ZodiacSign,
} from "../../types/dssme-canonical-types.ts";
import { getNakshatraInfo } from "./ascendant.ts";
import { calculateBodyPosition } from "./ephemeris.ts";

export const SIGN_LORDS: Record<ZodiacSign, ClassicalPlanet> = {
  Aries: "Mars",
  Taurus: "Venus",
  Gemini: "Mercury",
  Cancer: "Moon",
  Leo: "Sun",
  Virgo: "Mercury",
  Libra: "Venus",
  Scorpio: "Mars",
  Sagittarius: "Jupiter",
  Capricorn: "Saturn",
  Aquarius: "Saturn",
  Pisces: "Jupiter",
};

export const NINE_BODIES_ORDER: readonly NineBody[] = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
] as const;

/**
 * Calculates CanonicalBodyPosition for a specific body.
 */
export async function calculateCanonicalBody(
  julianDayUt: number,
  body: NineBody,
  ayanamsa: number,
  lagnaSign: ZodiacSign
): Promise<CanonicalBodyPosition> {
  const raw = await calculateBodyPosition(julianDayUt, body, ayanamsa);
  const siderealLon = raw.siderealLongitude;
  const signIndex = Math.floor(siderealLon / 30.0);
  const sign = ZODIAC_SIGNS_ARIES_FIRST[signIndex];
  const signDegree = siderealLon - signIndex * 30.0;
  const nakInfo = getNakshatraInfo(siderealLon);

  // House assignment (Whole Sign: 1 to 12)
  const lagnaIndex = ZODIAC_SIGNS_ARIES_FIRST.indexOf(lagnaSign);
  const houseNumber = ((signIndex - lagnaIndex + 12) % 12) + 1;

  return {
    body,
    siderealLongitude: siderealLon,
    tropicalLongitude: raw.tropicalLongitude,
    eclipticLatitude: raw.eclipticLatitude,
    speedLongitude: raw.speedLongitude,
    isRetrograde: raw.isRetrograde,
    sign,
    signDegree,
    nakshatra: nakInfo.nakshatra,
    nakshatraPada: nakInfo.pada,
    house: houseNumber,
  };
}

/**
 * Calculates all 9 planetary bodies in canonical order.
 */
export async function calculateAllCanonicalBodies(
  julianDayUt: number,
  ayanamsa: number,
  lagnaSign: ZodiacSign
): Promise<Record<NineBody, CanonicalBodyPosition>> {
  const result: Partial<Record<NineBody, CanonicalBodyPosition>> = {};

  for (const body of NINE_BODIES_ORDER) {
    result[body] = await calculateCanonicalBody(julianDayUt, body, ayanamsa, lagnaSign);
  }

  return result as Record<NineBody, CanonicalBodyPosition>;
}
