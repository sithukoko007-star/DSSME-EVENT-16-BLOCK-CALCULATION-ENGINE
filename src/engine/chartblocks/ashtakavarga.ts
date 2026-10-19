/**
 * BLOCK_8/9/10 — ASHTAKAVARGA (BAV, SAV, BAV_CURRENT_SIGN)
 *
 * BAV (Bhinna Ashtakavarga):
 *   - 7 planets + Lagna, each row = 12 bindu counts (Aries-first)
 *   - Standard Parashari contribution tables
 *
 * SAV (Sarvashtakavarga):
 *   - Sum of 7 planet BAV rows per sign (Lagna excluded per §3.1 Rule 4)
 *   - spec_houses: H2, H5, H8, H11
 *   - spec_sum = SAV_H5 + SAV_H11
 *   - spec_triangle = SAV_H5 + SAV_H8 + SAV_H11
 *
 * BAV_CURRENT_SIGN:
 *   - Each planet's BAV bindu in its own current sign
 *   - Rahu → uses Saturn's BAV row; Ketu → uses Mars's BAV row (§2.2 BLOCK_10)
 *
 * §3.1 Rule 3: BAV stored Aries-first (reordered from planet's own sign if needed).
 */

import type {
  BavBlock,
  BavCurrentSignBlock,
  BavCurrentSignEntry,
  ClassicalPlanet,
  HouseKey,
  NineBody,
  SavBlock,
  SavSpecHouse,
  ZodiacSign,
} from "../../types/dssme-canonical-types.ts";
import { ZODIAC_SIGNS_ARIES_FIRST } from "../../types/dssme-canonical-types.ts";
import type { BlockContext } from "../blocks/blockTypes.ts";

// ---------------------------------------------------------------------------
// Parashari Ashtakavarga contribution tables.
// Each entry is the list of sign indices (Aries=0..Pisces=11) from which the
// contributing planet receives a bindu, relative to a given reference planet's
// sign. In standard Parashari BAV, for each reference planet P in sign S,
// the contributing planets give bindus to specific signs relative to S.
//
// We encode: for each (contributor, receiver), which relative house offsets
// (0=same sign, 1=next, ..., 11=previous) give a bindu.
// Source: classical Parashari Ashtakavarga tables.
// ---------------------------------------------------------------------------

type ContributorTable = Record<ClassicalPlanet | "Lagna", number[]>;

// BAV contribution tables: from "contributor" → benefic positions relative to "receiver"
// Positions are offsets (0=receiver's sign, 1=next sign, etc.)
// These encode the classic Parashari BAV tables.
const BAV_TABLES: Record<ClassicalPlanet | "Lagna", ContributorTable> = {
  Sun: {
    Sun:     [1, 2, 4, 7, 8, 9, 10, 11],
    Moon:    [3, 6, 10, 11],
    Mars:    [1, 2, 4, 7, 8, 9, 10, 11],
    Mercury: [3, 5, 6, 9, 10, 11, 12],
    Jupiter: [5, 6, 9, 11],
    Venus:   [6, 7, 12],
    Saturn:  [1, 2, 4, 7, 8, 9, 10, 11],
    Lagna:   [3, 4, 6, 10, 11, 12],
  },
  Moon: {
    Sun:     [3, 6, 7, 8, 10, 11],
    Moon:    [1, 3, 6, 7, 10, 11],
    Mars:    [2, 3, 5, 6, 9, 10, 11],
    Mercury: [1, 3, 4, 5, 7, 8, 10, 11],
    Jupiter: [1, 4, 7, 8, 10, 11, 12],
    Venus:   [3, 4, 5, 7, 9, 10, 11],
    Saturn:  [3, 5, 6, 11],
    Lagna:   [3, 6, 10, 11],
  },
  Mars: {
    Sun:     [3, 5, 6, 10, 11],
    Moon:    [3, 6, 11],
    Mars:    [1, 2, 4, 7, 8, 10, 11],
    Mercury: [3, 5, 6, 11],
    Jupiter: [6, 10, 11, 12],
    Venus:   [6, 8, 11, 12],
    Saturn:  [1, 4, 7, 8, 9, 10, 11],
    Lagna:   [1, 3, 6, 10, 11],
  },
  Mercury: {
    Sun:     [5, 6, 9, 11, 12],
    Moon:    [2, 4, 6, 8, 10, 11],
    Mars:    [1, 2, 4, 7, 8, 9, 10, 11],
    Mercury: [1, 3, 5, 6, 9, 10, 11, 12],
    Jupiter: [6, 8, 11, 12],
    Venus:   [1, 2, 3, 4, 5, 8, 9, 11],
    Saturn:  [1, 2, 4, 7, 8, 9, 10, 11],
    Lagna:   [1, 2, 4, 6, 8, 10, 11],
  },
  Jupiter: {
    Sun:     [1, 2, 3, 4, 7, 8, 9, 10, 11],
    Moon:    [2, 5, 7, 9, 11],
    Mars:    [1, 2, 4, 7, 8, 10, 11],
    Mercury: [1, 2, 4, 5, 6, 9, 10, 11],
    Jupiter: [1, 2, 3, 4, 7, 8, 10, 11],
    Venus:   [2, 5, 6, 9, 10, 11],
    Saturn:  [3, 5, 6, 12],
    Lagna:   [1, 2, 4, 5, 6, 7, 9, 10, 11],
  },
  Venus: {
    Sun:     [8, 11, 12],
    Moon:    [1, 2, 3, 4, 5, 8, 9, 11, 12],
    Mars:    [3, 4, 6, 9, 11, 12],
    Mercury: [3, 5, 6, 9, 11],
    Jupiter: [5, 8, 9, 10, 11],
    Venus:   [1, 2, 3, 4, 5, 8, 9, 10, 11],
    Saturn:  [3, 4, 5, 8, 9, 10, 11],
    Lagna:   [1, 2, 3, 4, 5, 8, 9, 11],
  },
  Saturn: {
    Sun:     [1, 2, 4, 7, 8, 10, 11],
    Moon:    [3, 6, 11],
    Mars:    [3, 5, 6, 10, 11, 12],
    Mercury: [6, 8, 9, 10, 11, 12],
    Jupiter: [5, 6, 11, 12],
    Venus:   [6, 11, 12],
    Saturn:  [3, 5, 6, 11],
    Lagna:   [1, 3, 4, 6, 10, 11],
  },
  Lagna: {
    Sun:     [3, 4, 6, 10, 11, 12],
    Moon:    [3, 6, 10, 11],
    Mars:    [1, 3, 6, 10, 11],
    Mercury: [1, 2, 4, 6, 8, 10, 11],
    Jupiter: [1, 2, 4, 5, 6, 7, 9, 10, 11],
    Venus:   [1, 2, 3, 4, 5, 8, 9, 11],
    Saturn:  [1, 3, 4, 6, 10, 11],
    Lagna:   [3, 6, 10, 11],
  },
};

type ReceiverKey = ClassicalPlanet | "Lagna";

/**
 * Compute BAV row for a single receiver planet (12 bindu values, Aries-first).
 *
 * For each sign S (Aries=0..Pisces=11):
 *   For each contributor C (7 planets + Lagna):
 *     Find the sign offset from receiver's current sign to S.
 *     If that offset appears in BAV_TABLES[receiver][C], add 1 bindu.
 */
function computeBavRow(
  receiver: ReceiverKey,
  receiverSignIdx: number,   // 0=Aries..11=Pisces (current sign of receiver)
  contributorSignIndices: Record<ClassicalPlanet | "Lagna", number>
): number[] {
  const table = BAV_TABLES[receiver];
  const row = new Array<number>(12).fill(0);

  for (let signIdx = 0; signIdx < 12; signIdx++) {
    let bindus = 0;
    for (const contributor of Object.keys(table) as (ClassicalPlanet | "Lagna")[]) {
      const contributorIdx = contributorSignIndices[contributor];
      // Offset from contributor's sign to target sign (how many signs ahead)
      const offset = ((signIdx - contributorIdx + 12) % 12) + 1; // 1..12
      const beneficOffsets = table[contributor] ?? [];
      if (beneficOffsets.includes(offset)) {
        bindus++;
      }
    }
    row[signIdx] = bindus;
  }

  return row;
}

// Sign index lookup
function signIndex(sign: ZodiacSign): number {
  return ZODIAC_SIGNS_ARIES_FIRST.indexOf(sign);
}

export interface AshtakavargaResult {
  BAV: BavBlock;
  SAV: SavBlock;
  BAV_CURRENT_SIGN: BavCurrentSignBlock;
}

export function computeAshtakavarga(ctx: BlockContext): AshtakavargaResult {
  const { chart } = ctx;

  // Sign indices for all contributors (7 planets + Lagna)
  const contributorSignIndices: Record<ClassicalPlanet | "Lagna", number> = {
    Sun: signIndex(chart.planets.Sun.sign),
    Moon: signIndex(chart.planets.Moon.sign),
    Mars: signIndex(chart.planets.Mars.sign),
    Mercury: signIndex(chart.planets.Mercury.sign),
    Jupiter: signIndex(chart.planets.Jupiter.sign),
    Venus: signIndex(chart.planets.Venus.sign),
    Saturn: signIndex(chart.planets.Saturn.sign),
    Lagna: signIndex(chart.lagna.sign),
  };

  // Compute BAV rows for 7 planets + Lagna
  const sunRow    = computeBavRow("Sun",     contributorSignIndices.Sun,     contributorSignIndices);
  const moonRow   = computeBavRow("Moon",    contributorSignIndices.Moon,    contributorSignIndices);
  const marsRow   = computeBavRow("Mars",    contributorSignIndices.Mars,    contributorSignIndices);
  const mercRow   = computeBavRow("Mercury", contributorSignIndices.Mercury, contributorSignIndices);
  const jupRow    = computeBavRow("Jupiter", contributorSignIndices.Jupiter, contributorSignIndices);
  const venRow    = computeBavRow("Venus",   contributorSignIndices.Venus,   contributorSignIndices);
  const satRow    = computeBavRow("Saturn",  contributorSignIndices.Saturn,  contributorSignIndices);
  const lagnaRow  = computeBavRow("Lagna",   signIndex(chart.lagna.sign),    contributorSignIndices);

  // BAV block
  const BAV: BavBlock = {
    Sun: sunRow,
    Moon: moonRow,
    Mars: marsRow,
    Mercury: mercRow,
    Jupiter: jupRow,
    Venus: venRow,
    Saturn: satRow,
    Lagna: lagnaRow,
    _signs: [...ZODIAC_SIGNS_ARIES_FIRST],
  };

  // SAV = sum of 7 planet rows (Lagna excluded per §3.1 Rule 4)
  const savValues: number[] = new Array<number>(12).fill(0);
  const planetRows = [sunRow, moonRow, marsRow, mercRow, jupRow, venRow, satRow];
  for (const row of planetRows) {
    for (let i = 0; i < 12; i++) {
      savValues[i]! += row[i]!;
    }
  }

  const grandTotal = savValues.reduce((a, b) => a + b, 0);

  // Spec houses: H2, H5, H8, H11 (house number = lagna sign + house - 1, mod 12)
  const lagnaIdx = signIndex(chart.lagna.sign);
  function houseSign(houseNum: number): ZodiacSign {
    return ZODIAC_SIGNS_ARIES_FIRST[((lagnaIdx + houseNum - 1) % 12)]!;
  }
  function houseSignIdx(houseNum: number): number {
    return (lagnaIdx + houseNum - 1) % 12;
  }
  function houseOccupant(houseNum: number): NineBody | "None" {
    const houseKey = houseNum.toString() as HouseKey;
    const occ = chart.houses[houseKey]?.occupants ?? [];
    return occ.length > 0 ? (occ[0] as NineBody) : "None";
  }

  const h2SignIdx = houseSignIdx(2);
  const h5SignIdx = houseSignIdx(5);
  const h8SignIdx = houseSignIdx(8);
  const h11SignIdx = houseSignIdx(11);

  const specH2: SavSpecHouse = { sign: houseSign(2), sav: savValues[h2SignIdx]!, occupant: houseOccupant(2) };
  const specH5: SavSpecHouse = { sign: houseSign(5), sav: savValues[h5SignIdx]!, occupant: houseOccupant(5) };
  const specH8: SavSpecHouse = { sign: houseSign(8), sav: savValues[h8SignIdx]!, occupant: houseOccupant(8) };
  const specH11: SavSpecHouse = { sign: houseSign(11), sav: savValues[h11SignIdx]!, occupant: houseOccupant(11) };

  const SAV: SavBlock = {
    values: savValues,
    grand_total: grandTotal,
    spec_houses: { H2: specH2, H5: specH5, H8: specH8, H11: specH11 },
    spec_sum: specH5.sav + specH11.sav,
    spec_triangle: specH5.sav + specH8.sav + specH11.sav,
  };

  // BAV_CURRENT_SIGN: each planet's BAV bindu in its own current sign
  // Rahu → Saturn's BAV row; Ketu → Mars's BAV row (§2.2 BLOCK_10)
  function bavInCurrentSign(planet: NineBody): BavCurrentSignEntry {
    let row: number[];
    let note: string | undefined;

    if (planet === "Rahu") {
      row = satRow;
      note = "uses Saturn BAV row";
    } else if (planet === "Ketu") {
      row = marsRow;
      note = "uses Mars BAV row";
    } else {
      const bavRows: Record<ClassicalPlanet, number[]> = {
        Sun: sunRow, Moon: moonRow, Mars: marsRow, Mercury: mercRow,
        Jupiter: jupRow, Venus: venRow, Saturn: satRow,
      };
      row = bavRows[planet as ClassicalPlanet];
    }

    const planetSign = chart.planets[planet].sign;
    const planetSignIdx = signIndex(planetSign);
    const bav = row[planetSignIdx] ?? 0;

    return note
      ? { sign: planetSign, bav, _note: note }
      : { sign: planetSign, bav };
  }

  const BAV_CURRENT_SIGN: BavCurrentSignBlock = {
    Sun: bavInCurrentSign("Sun"),
    Moon: bavInCurrentSign("Moon"),
    Mars: bavInCurrentSign("Mars"),
    Mercury: bavInCurrentSign("Mercury"),
    Jupiter: bavInCurrentSign("Jupiter"),
    Venus: bavInCurrentSign("Venus"),
    Saturn: bavInCurrentSign("Saturn"),
    Rahu: bavInCurrentSign("Rahu"),
    Ketu: bavInCurrentSign("Ketu"),
  };

  return { BAV, SAV, BAV_CURRENT_SIGN };
}
