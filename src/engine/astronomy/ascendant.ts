/**
 * Ascendant (Lagna) Engine
 * Conforms to DSSME Canonical Architecture
 */

import {
  CanonicalBodyPosition,
  LagnaType,
  ZODIAC_SIGNS_ARIES_FIRST,
  ZodiacSign,
} from "../../types/dssme-canonical-types.ts";
import { calculateAscendant, normalize360 } from "./ephemeris.ts";

export const NAKSHATRA_NAMES: readonly string[] = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
] as const;

export function getNakshatraInfo(longitude: number): {
  nakshatra: string;
  nakshatraNumber: number; // 1-27
  pada: 1 | 2 | 3 | 4;
} {
  const norm = normalize360(longitude);
  const oneStar = 360.0 / 27.0; // 13°20' = 13.333333333333334°
  const onePada = 360.0 / 108.0; // 3°20' = 3.3333333333333335°

  const nakIndex = Math.min(26, Math.floor(norm / oneStar));
  const remainder = norm % oneStar;
  const padaIndex = Math.min(3, Math.floor(remainder / onePada));

  return {
    nakshatra: NAKSHATRA_NAMES[nakIndex],
    nakshatraNumber: nakIndex + 1,
    pada: (padaIndex + 1) as 1 | 2 | 3 | 4,
  };
}

export function getLagnaType(sign: ZodiacSign): LagnaType {
  switch (sign) {
    case "Aries":
    case "Cancer":
    case "Libra":
    case "Capricorn":
      return "Movable";
    case "Taurus":
    case "Leo":
    case "Scorpio":
    case "Aquarius":
      return "Fixed";
    case "Gemini":
    case "Virgo":
    case "Sagittarius":
    case "Pisces":
      return "Dual";
  }
}

/**
 * Calculates Canonical Lagna position.
 */
export async function calculateCanonicalLagna(
  julianDayUt: number,
  latitude: number,
  longitude: number,
  ayanamsa: number
): Promise<CanonicalBodyPosition> {
  const ascResult = await calculateAscendant(julianDayUt, latitude, longitude, ayanamsa);
  const siderealLon = ascResult.siderealLongitude;
  const signIndex = Math.floor(siderealLon / 30.0);
  const sign = ZODIAC_SIGNS_ARIES_FIRST[signIndex];
  const signDegree = siderealLon - signIndex * 30.0;
  const nakInfo = getNakshatraInfo(siderealLon);

  return {
    body: "Lagna",
    siderealLongitude: siderealLon,
    tropicalLongitude: ascResult.tropicalLongitude,
    eclipticLatitude: 0,
    speedLongitude: 0,
    isRetrograde: false,
    sign,
    signDegree,
    nakshatra: nakInfo.nakshatra,
    nakshatraPada: nakInfo.pada,
    house: 1,
  };
}
