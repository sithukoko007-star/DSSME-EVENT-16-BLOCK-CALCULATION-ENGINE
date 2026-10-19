/**
 * BLOCK_15 — NAVAMSHA (D-9 Divisional Chart)
 *
 * Navamsha computation:
 *   D-9 sign index = (rashi_sign_index * 9 + floor(signDegree / 3.333...)) mod 12
 *   Equivalently: D9_longitude = siderealLongitude * 9 mod 360 → sign = floor / 30
 *
 * For each planet:
 *   - sign: Navamsha sign
 *   - dignity: same classical rules as D-1 (no separate table)
 *   - is_vargottama: D-1 sign == D-9 sign (name equality only, §3.2 Rule 18)
 *   - is_pushkara: signDegree (in D-1) falls in Pushkara Navamsha zone (§3.2 Rule 15)
 *
 * §3.2 Rule 15 — Pushkara zones (degrees within Rashi sign):
 *   Aries 16–20°, Taurus 13.33–16.67°, Gemini 23.33–26.67°,
 *   Cancer 26.67–30°, Leo 0–3.33° and 26.67–30°, Virgo 23.33–26.67°,
 *   Libra 10–13.33°, Scorpio 0–3.33°, Sagittarius 16.67–20°,
 *   Capricorn 13.33–16.67° and 23.33–26.67°, Aquarius 6.67–10°,
 *   Pisces 10–13.33°
 *
 * If Navamsha data unavailable: _available=false, all SS_nav=1.00, VGF=1.00 (graceful degradation).
 */

import type {
  ClassicalPlanet,
  Dignity,
  NavamshaBlock,
  NavamshaEntry,
  NineBody,
  ZodiacSign,
} from "../../types/dssme-canonical-types.ts";
import { ZODIAC_SIGNS_ARIES_FIRST } from "../../types/dssme-canonical-types.ts";
import type { BlockContext, BlockResult } from "../blocks/blockTypes.ts";
import { finalizeBlock } from "../blocks/blockResult.ts";
import { NINE_BODIES_ORDER } from "../astronomy/planetaryPositions.ts";
import { getClassicalDignity } from "./dignity.ts";

// Pushkara Navamsha zones per sign (start°, end° within Rashi sign)
// Values in decimal degrees within sign (0–30)
const PUSHKARA_ZONES: Record<ZodiacSign, Array<[number, number]>> = {
  Aries:       [[16.0, 20.0]],
  Taurus:      [[13.333, 16.667]],
  Gemini:      [[23.333, 26.667]],
  Cancer:      [[26.667, 30.0]],
  Leo:         [[0.0, 3.333], [26.667, 30.0]],
  Virgo:       [[23.333, 26.667]],
  Libra:       [[10.0, 13.333]],
  Scorpio:     [[0.0, 3.333]],
  Sagittarius: [[16.667, 20.0]],
  Capricorn:   [[13.333, 16.667], [23.333, 26.667]],
  Aquarius:    [[6.667, 10.0]],
  Pisces:      [[10.0, 13.333]],
};

function isPushkara(sign: ZodiacSign, signDegree: number): boolean {
  const zones = PUSHKARA_ZONES[sign] ?? [];
  return zones.some(([start, end]) => signDegree >= start && signDegree < end);
}

/** Compute D-9 sign from D-1 sidereal longitude. */
function navamshaSign(siderealLon: number): ZodiacSign {
  const d9Lon = (siderealLon * 9) % 360;
  const signIdx = Math.floor(d9Lon / 30);
  return ZODIAC_SIGNS_ARIES_FIRST[signIdx]!;
}

function navamshaEntryForPlanet(
  planet: NineBody,
  siderealLon: number,
  rashiSign: ZodiacSign,
  signDegree: number
): NavamshaEntry {
  const d9Sign = navamshaSign(siderealLon);
  const isVargottama = rashiSign === d9Sign;
  const pushkara = isPushkara(rashiSign, signDegree);

  let dignity: Dignity = "—";
  if (planet !== "Rahu" && planet !== "Ketu") {
    dignity = getClassicalDignity(planet as ClassicalPlanet, d9Sign);
  }

  return {
    sign: d9Sign,
    dignity,
    is_vargottama: isVargottama,
    is_pushkara: pushkara,
  };
}

export function buildNavamshaBlock(ctx: BlockContext): BlockResult<NavamshaBlock> {
  const { chart } = ctx;

  const entries: Record<NineBody, NavamshaEntry> = {} as Record<NineBody, NavamshaEntry>;

  for (const body of NINE_BODIES_ORDER) {
    const pos = chart.planets[body];
    entries[body] = navamshaEntryForPlanet(
      body,
      pos.siderealLongitude,
      pos.sign,
      pos.signDegree
    );
  }

  const value: NavamshaBlock = {
    _available: true,
    Sun: entries.Sun,
    Moon: entries.Moon,
    Mars: entries.Mars,
    Mercury: entries.Mercury,
    Jupiter: entries.Jupiter,
    Venus: entries.Venus,
    Saturn: entries.Saturn,
    Rahu: entries.Rahu,
    Ketu: entries.Ketu,
  };

  return finalizeBlock({
    blockId: "NAVAMSHA",
    ctx,
    inputs: ["CanonicalChart"],
    value,
    issues: [],
  });
}
