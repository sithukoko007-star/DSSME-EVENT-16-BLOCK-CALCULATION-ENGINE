/**
 * BLOCK_13 — DIGNITY
 * Classical Parashari dignity for all 9 bodies.
 * Rahu and Ketu return "—" (no classical dignity).
 *
 * Dignity lookup order: Exalted → Own/Moolatrikona → Debilitated → Friendship
 * Per §3.3 gotchas:
 *   - Moon in Cancer = Own (NOT Exalted); Exalted = Taurus only
 *   - Mercury in Gemini = Own (NOT Exalted); Exalted = Virgo only
 *   - Jupiter in Cancer = Exalted
 *   - Saturn in Pisces = Neutral (Parashara compound-friendship, NOT Enemy)
 */

import type {
  ClassicalPlanet,
  Dignity,
  DignityBlock,
  NineBody,
  ZodiacSign,
} from "../../types/dssme-canonical-types.ts";
import type { BlockContext, BlockResult } from "../blocks/blockTypes.ts";
import { finalizeBlock, mapNineBodies } from "../blocks/blockResult.ts";

// Exaltation signs
const EXALTATION: Partial<Record<ClassicalPlanet, ZodiacSign>> = {
  Sun: "Aries",
  Moon: "Taurus",
  Mars: "Capricorn",
  Mercury: "Virgo",
  Jupiter: "Cancer",
  Venus: "Pisces",
  Saturn: "Libra",
};

// Debilitation signs (opposite of exaltation)
const DEBILITATION: Partial<Record<ClassicalPlanet, ZodiacSign>> = {
  Sun: "Libra",
  Moon: "Scorpio",
  Mars: "Cancer",
  Mercury: "Pisces",
  Jupiter: "Capricorn",
  Venus: "Virgo",
  Saturn: "Aries",
};

// Own signs (each planet rules 1–2 signs)
const OWN_SIGNS: Partial<Record<ClassicalPlanet, ZodiacSign[]>> = {
  Sun: ["Leo"],
  Moon: ["Cancer"],
  Mars: ["Aries", "Scorpio"],
  Mercury: ["Gemini", "Virgo"],
  Jupiter: ["Sagittarius", "Pisces"],
  Venus: ["Taurus", "Libra"],
  Saturn: ["Capricorn", "Aquarius"],
};

// Moolatrikona signs (subset of own, primary sign; takes priority over plain Own)
// Moolatrikona degrees: Sun 0-20 Leo, Moon 4-20 Taurus, Mars 0-12 Aries,
// Mercury 15-20 Virgo, Jupiter 0-10 Sagittarius, Venus 0-15 Libra, Saturn 0-20 Aquarius
const MOOLATRIKONA_SIGN: Partial<Record<ClassicalPlanet, ZodiacSign>> = {
  Sun: "Leo",
  Moon: "Taurus",
  Mars: "Aries",
  Mercury: "Virgo",
  Jupiter: "Sagittarius",
  Venus: "Libra",
  Saturn: "Aquarius",
};
const MOOLATRIKONA_RANGE: Partial<Record<ClassicalPlanet, [number, number]>> = {
  Sun: [0, 20],
  Moon: [4, 20],
  Mars: [0, 12],
  Mercury: [15, 20],
  Jupiter: [0, 10],
  Venus: [0, 15],
  Saturn: [0, 20],
};

// Natural friendship table (Parashari)
// Great Friends / Friends / Neutral / Enemies / Great Enemies
// For dignity: Friend sign = Grt.Friend or Friend, Neutral = Neutral, Enemy = Enemy or Grt.Enemy
type FriendLevel = "Grt.Friend" | "Friend" | "Neutral" | "Enemy" | "Grt.Enemy";

const NATURAL_FRIENDSHIP: Record<ClassicalPlanet, Partial<Record<ClassicalPlanet, FriendLevel>>> = {
  Sun: {
    Moon: "Friend", Mars: "Friend", Jupiter: "Friend",
    Mercury: "Neutral",
    Venus: "Enemy", Saturn: "Enemy",
  },
  Moon: {
    Sun: "Friend", Mercury: "Friend",
    Mars: "Neutral", Jupiter: "Neutral", Venus: "Neutral", Saturn: "Neutral",
  },
  Mars: {
    Sun: "Friend", Moon: "Friend", Jupiter: "Friend",
    Venus: "Neutral", Saturn: "Neutral",
    Mercury: "Enemy",
  },
  Mercury: {
    Sun: "Friend", Venus: "Friend",
    Mars: "Neutral", Jupiter: "Neutral", Saturn: "Neutral",
    Moon: "Enemy",
  },
  Jupiter: {
    Sun: "Friend", Moon: "Friend", Mars: "Friend",
    Saturn: "Neutral",
    Mercury: "Enemy", Venus: "Enemy",
  },
  Venus: {
    Mercury: "Friend", Saturn: "Friend",
    Mars: "Neutral", Jupiter: "Neutral",
    Sun: "Enemy", Moon: "Enemy",
  },
  Saturn: {
    Mercury: "Friend", Venus: "Friend",
    Jupiter: "Neutral",
    Sun: "Enemy", Moon: "Enemy", Mars: "Enemy",
  },
};

/**
 * Get classical dignity for a classical planet in a given sign.
 * Returns the most specific category that applies.
 */
export function getClassicalDignity(
  planet: ClassicalPlanet,
  sign: ZodiacSign,
  signDegree?: number
): Dignity {
  // Exalted (highest priority)
  if (EXALTATION[planet] === sign) return "Exalted";

  // Debilitated
  if (DEBILITATION[planet] === sign) return "Debilitated";

  // Moolatrikona — check sign and degree range
  const mooSign = MOOLATRIKONA_SIGN[planet];
  const mooRange = MOOLATRIKONA_RANGE[planet];
  if (mooSign === sign && mooRange) {
    const deg = signDegree ?? 0;
    if (deg >= mooRange[0] && deg < mooRange[1]) return "Moolatrikona";
  }

  // Own sign
  const ownSigns = OWN_SIGNS[planet] ?? [];
  if (ownSigns.includes(sign)) return "Own";

  // Friendship-based (from sign lord)
  // Sign lord is the planet that rules that sign
  const SIGN_LORDS: Record<ZodiacSign, ClassicalPlanet> = {
    Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon",
    Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Mars",
    Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter",
  };
  const signLord = SIGN_LORDS[sign];

  // Planet in its own sign (already handled above)
  if (signLord === planet) return "Own";

  const friendshipRow = NATURAL_FRIENDSHIP[planet];
  const friendLevel = friendshipRow?.[signLord];

  switch (friendLevel) {
    case "Grt.Friend": return "Grt.Friend";
    case "Friend": return "Friend";
    case "Neutral": return "Neutral";
    case "Enemy": return "Enemy";
    case "Grt.Enemy": return "Grt.Enemy";
    default: return "Neutral"; // no entry = Neutral
  }
}

export function buildDignityBlock(ctx: BlockContext): BlockResult<DignityBlock> {
  const { chart } = ctx;

  const value: DignityBlock = mapNineBodies((body: NineBody): Dignity => {
    if (body === "Rahu" || body === "Ketu") return "—";
    const planet = body as ClassicalPlanet;
    const position = chart.planets[planet];
    return getClassicalDignity(planet, position.sign, position.signDegree);
  });

  return finalizeBlock({
    blockId: "DIGNITY",
    ctx,
    inputs: ["CanonicalChart"],
    value,
    issues: [],
  });
}
