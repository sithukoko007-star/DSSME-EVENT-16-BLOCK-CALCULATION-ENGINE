/**
 * Hand-built CanonicalChart fixture for Phase 3 block tests.
 *
 * SYNTHETIC. Not an ephemeris result and NOT a golden numerical fixture. The sign layout
 * deliberately resembles the project's Chofu preset so structure is easy to read, but every
 * degree below is a round number chosen by hand. No ephemeris is called to build it.
 *
 * Expected houses are written out by hand (independent of the frozen buildCanonicalHouses),
 * so block tests are not tautological.
 */

import {
  ZODIAC_SIGNS_ARIES_FIRST,
  type CanonicalBodyPosition,
  type CanonicalChart,
  type CanonicalHouse,
  type ChartBody,
  type ClassicalPlanet,
  type HouseKey,
  type HouseType,
  type NineBody,
  type ZodiacSign,
} from "../../../src/types/dssme-canonical-types.ts";
import { getNakshatraInfo } from "../../../src/engine/astronomy/ascendant.ts";

export const HAND_JD_UT = 2461299.909722222;
const AYANAMSA = 24.23;

interface BodySpec {
  readonly sign: ZodiacSign;
  readonly deg: number;
  readonly speed: number;
  readonly retro: boolean;
  readonly house: number;
}

/** Hand-written, whole-sign, Lagna = Pisces. */
export const HAND_BODY_SPECS: Readonly<Record<NineBody, BodySpec>> = {
  Sun: { sign: "Leo", deg: 28, speed: 0.97, retro: false, house: 6 },
  Moon: { sign: "Scorpio", deg: 2, speed: 12.2, retro: false, house: 9 },
  Mars: { sign: "Gemini", deg: 28, speed: 0.61, retro: false, house: 4 },
  Mercury: { sign: "Virgo", deg: 14, speed: 1.59, retro: false, house: 7 },
  Jupiter: { sign: "Cancer", deg: 22, speed: 0.2, retro: false, house: 5 },
  Venus: { sign: "Libra", deg: 9, speed: 0.53, retro: false, house: 8 },
  Saturn: { sign: "Pisces", deg: 17, speed: -0.07, retro: true, house: 1 },
  Rahu: { sign: "Aquarius", deg: 4, speed: -0.053, retro: true, house: 12 },
  Ketu: { sign: "Leo", deg: 4, speed: -0.053, retro: true, house: 6 },
};

export const HAND_LAGNA_SIGN: ZodiacSign = "Pisces";
const HAND_LAGNA_DEG = 25;

export interface ExpectedHouse {
  readonly sign: ZodiacSign;
  readonly lord: ClassicalPlanet;
  readonly occupants: readonly NineBody[];
  readonly type: HouseType;
}

/** Expected HOUSES, written by hand. */
export const HAND_HOUSES_EXPECTED: Readonly<Record<HouseKey, ExpectedHouse>> = {
  "1": { sign: "Pisces", lord: "Jupiter", occupants: ["Saturn"], type: "Angular" },
  "2": { sign: "Aries", lord: "Mars", occupants: [], type: "Succedent" },
  "3": { sign: "Taurus", lord: "Venus", occupants: [], type: "Cadent" },
  "4": { sign: "Gemini", lord: "Mercury", occupants: ["Mars"], type: "Angular" },
  "5": { sign: "Cancer", lord: "Moon", occupants: ["Jupiter"], type: "Succedent" },
  "6": { sign: "Leo", lord: "Sun", occupants: ["Sun", "Ketu"], type: "Cadent" },
  "7": { sign: "Virgo", lord: "Mercury", occupants: ["Mercury"], type: "Angular" },
  "8": { sign: "Libra", lord: "Venus", occupants: ["Venus"], type: "Succedent" },
  "9": { sign: "Scorpio", lord: "Mars", occupants: ["Moon"], type: "Cadent" },
  "10": { sign: "Sagittarius", lord: "Jupiter", occupants: [], type: "Angular" },
  "11": { sign: "Capricorn", lord: "Saturn", occupants: [], type: "Succedent" },
  "12": { sign: "Aquarius", lord: "Saturn", occupants: ["Rahu"], type: "Cadent" },
};

function position(
  body: ChartBody,
  sign: ZodiacSign,
  deg: number,
  speed: number,
  retro: boolean,
  house: number,
): CanonicalBodyPosition {
  const sidereal = ZODIAC_SIGNS_ARIES_FIRST.indexOf(sign) * 30 + deg;
  const nak = getNakshatraInfo(sidereal);
  return {
    body,
    siderealLongitude: sidereal,
    tropicalLongitude: (sidereal + AYANAMSA) % 360,
    eclipticLatitude: 0,
    speedLongitude: speed,
    isRetrograde: retro,
    sign,
    signDegree: deg,
    nakshatra: nak.nakshatra,
    nakshatraPada: nak.pada,
    house,
    provenance: "swisseph-wasm",
  };
}

function bodyPosition(body: NineBody): CanonicalBodyPosition {
  const s = HAND_BODY_SPECS[body];
  return position(body, s.sign, s.deg, s.speed, s.retro, s.house);
}

function houseFor(key: HouseKey): CanonicalHouse {
  const e = HAND_HOUSES_EXPECTED[key];
  return {
    houseNumber: Number(key),
    sign: e.sign,
    lord: e.lord,
    cuspLongitude: ZODIAC_SIGNS_ARIES_FIRST.indexOf(e.sign) * 30 + HAND_LAGNA_DEG,
    occupants: [...e.occupants],
    type: e.type,
  };
}

/** Fresh object on every call, so tests may mutate freely. */
export function makeHandChart(ephemeris: "swisseph-wasm" | "fallback" | "mixed" = "swisseph-wasm"): CanonicalChart {
  const degraded = ephemeris !== "swisseph-wasm";
  const src = degraded ? "fallback" : "swisseph-wasm";
  return {
    input: {
      date: "2026-09-16",
      time: "18:50:00",
      latitude: 35.65,
      longitude: 139.54,
      timezone: "Asia/Tokyo",
      timezoneOffset: 9,
      ayanamsa: "Lahiri",
    },
    time: {
      localIso: "2026-09-16T18:50:00+09:00",
      utcIso: "2026-09-16T09:50:00.000Z",
      julianDayUt: HAND_JD_UT,
      timezoneOffsetHours: 9,
    },
    location: { latitude: 35.65, longitude: 139.54 },
    ayanamsa: { name: "Lahiri", value: AYANAMSA },
    lagna: position("Lagna", HAND_LAGNA_SIGN, HAND_LAGNA_DEG, 0, false, 1),
    planets: {
      Sun: bodyPosition("Sun"),
      Moon: bodyPosition("Moon"),
      Mars: bodyPosition("Mars"),
      Mercury: bodyPosition("Mercury"),
      Jupiter: bodyPosition("Jupiter"),
      Venus: bodyPosition("Venus"),
      Saturn: bodyPosition("Saturn"),
      Rahu: bodyPosition("Rahu"),
      Ketu: bodyPosition("Ketu"),
    },
    houses: {
      "1": houseFor("1"),
      "2": houseFor("2"),
      "3": houseFor("3"),
      "4": houseFor("4"),
      "5": houseFor("5"),
      "6": houseFor("6"),
      "7": houseFor("7"),
      "8": houseFor("8"),
      "9": houseFor("9"),
      "10": houseFor("10"),
      "11": houseFor("11"),
      "12": houseFor("12"),
    },
    provenance: {
      ephemeris,
      isDegraded: degraded,
      sources: {
        ayanamsa: src,
        lagna: src,
        planets: {
          Sun: src,
          Moon: src,
          Mars: src,
          Mercury: src,
          Jupiter: src,
          Venus: src,
          Saturn: src,
          Rahu: src,
          Ketu: src,
        },
      },
      runtime: { node: "hand-built", platform: "hand-built" },
    },
  };
}

/**
 * Deliberately INVALID input for negative tests (missing provenance, wrong types, ...).
 * This is the only cast in the Phase 3 test code; it is confined to this helper.
 */
export function corruptChart(mutate: (draft: Record<string, unknown>) => void): CanonicalChart {
  const draft: Record<string, unknown> = JSON.parse(JSON.stringify(makeHandChart()));
  mutate(draft);
  return draft as unknown as CanonicalChart;
}
