/**
 * Canonical House System Engine
 * Generates the 12 canonical houses based on Lagna sign
 * Conforms to DSSME Canonical Architecture
 */

import {
  CanonicalBodyPosition,
  CanonicalHouse,
  HouseKey,
  HouseType,
  NineBody,
  ZODIAC_SIGNS_ARIES_FIRST,
  ZodiacSign,
} from "../../types/dssme-canonical-types.ts";
import { SIGN_LORDS } from "./planetaryPositions.ts";

export function getHouseType(houseNumber: number): HouseType {
  switch (houseNumber) {
    case 1:
    case 4:
    case 7:
    case 10:
      return "Angular";
    case 2:
    case 5:
    case 8:
    case 11:
      return "Succedent";
    case 3:
    case 6:
    case 9:
    case 12:
    default:
      return "Cadent";
  }
}

/**
 * Builds the 12 Canonical Houses.
 *
 * @param lagnaPosition Canonical position of Lagna
 * @param planets All 9 canonical planetary positions
 */
export function buildCanonicalHouses(
  lagnaPosition: CanonicalBodyPosition,
  planets: Record<NineBody, CanonicalBodyPosition>
): Record<HouseKey, CanonicalHouse> {
  const lagnaSignIndex = ZODIAC_SIGNS_ARIES_FIRST.indexOf(lagnaPosition.sign);
  const houses: Partial<Record<HouseKey, CanonicalHouse>> = {};

  for (let h = 1; h <= 12; h++) {
    const key = h.toString() as HouseKey;
    const signIndex = (lagnaSignIndex + h - 1) % 12;
    const sign = ZODIAC_SIGNS_ARIES_FIRST[signIndex];
    const lord = SIGN_LORDS[sign];
    const type = getHouseType(h);

    // Find occupants for this house
    const occupants: NineBody[] = [];
    for (const [bodyName, pos] of Object.entries(planets)) {
      if (pos.house === h) {
        occupants.push(bodyName as NineBody);
      }
    }

    // Bhava madhya (cusp longitude): Lagna degree within sign + sign start
    const cuspLongitude = (signIndex * 30.0 + lagnaPosition.signDegree) % 360.0;

    houses[key] = {
      houseNumber: h,
      sign,
      lord,
      cuspLongitude,
      occupants,
      type,
    };
  }

  return houses as Record<HouseKey, CanonicalHouse>;
}
