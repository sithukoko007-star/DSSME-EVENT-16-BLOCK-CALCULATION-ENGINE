/**
 * Phase 3, Level 1 — PyJHora SOURCE-LEVEL alignment checks.
 *
 * What this is:   constants and rules READ from the pinned PyJHora source and compared with DSSME.
 * What this is NOT: PyJHora execution. No PyJHora code is run and no numerical output is compared.
 *                 Status: "PyJHora source-level alignment verified; numerical parity not yet executed."
 *
 * Pinned reference: naturalstupid/PyJHora @ 48e57d29b47a3143519910a24866758116467485 (40 chars)
 * Source read:
 *   src/jhora/const.py:   SUN_ID=0 MOON_ID=1 MARS_ID=2 MERCURY_ID=3 JUPITER_ID=4 VENUS_ID=5 SATURN_ID=6
 *                         RAHU_ID=7 KETU_ID=8
 *   src/jhora/const.py:527  _house_owners_list = [2,5,3,1,0,3,5,2,4,6,6,4]     (index = sign, Aries=0)
 *   src/jhora/panchanga/drik.py:339  planets_in_retrograde(): Sun/Moon excluded; Ketu uses Rahu's speed;
 *                         a planet is retrograde iff swe speed (longi[3]) < 0; docstring: Mean nodes
 *                         always retrograde. (A second, position-based retrograde function exists in
 *                         jhora.horoscope.chart.charts and was NOT inspected.)
 */

import assert from "node:assert/strict";
import { ZODIAC_SIGNS_ARIES_FIRST, type ClassicalPlanet } from "../../src/types/dssme-canonical-types.ts";
import { SIGN_LORDS } from "../../src/engine/astronomy/planetaryPositions.ts";
import { buildRetrogradeBlock, createBlockContext } from "../../src/engine/blocks/index.ts";
import { makeHandChart } from "./fixtures/handChart.ts";

/** PyJHora planet id -> DSSME name, from const.py (SUN_ID..SATURN_ID). */
const PYJHORA_CLASSICAL_BY_ID: readonly ClassicalPlanet[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
const PYJHORA_HOUSE_OWNERS: readonly number[] = [2, 5, 3, 1, 0, 3, 5, 2, 4, 6, 6, 4];

export function runPyjhoraSourceAlignmentTests(): void {
  console.log("Running Phase 3 PyJHora Source-Level Alignment Tests (Level 1)...");

  // 1. Sign lords: DSSME SIGN_LORDS == PyJHora _house_owners_list, sign by sign.
  assert.equal(PYJHORA_HOUSE_OWNERS.length, 12);
  ZODIAC_SIGNS_ARIES_FIRST.forEach((sign, index) => {
    const ownerId = PYJHORA_HOUSE_OWNERS[index];
    assert.ok(ownerId !== undefined, `PyJHora owner for ${sign}`);
    const pyjhoraOwner = PYJHORA_CLASSICAL_BY_ID[ownerId];
    assert.ok(pyjhoraOwner !== undefined, `PyJHora planet id ${ownerId}`);
    assert.equal(SIGN_LORDS[sign], pyjhoraOwner, `${sign} lord: DSSME ${SIGN_LORDS[sign]} vs PyJHora ${pyjhoraOwner}`);
  });

  // 2. Planet order in DSSME outputs is the PyJHora id order for the seven classical planets.
  const block = buildRetrogradeBlock(createBlockContext(makeHandChart()));
  assert.deepEqual(Object.keys(block.value ?? {}).slice(0, 7), [...PYJHORA_CLASSICAL_BY_ID]);
  assert.deepEqual(Object.keys(block.value ?? {}).slice(7), ["Rahu", "Ketu"], "RAHU_ID=7, KETU_ID=8");

  // 3. Retrograde rule alignment with drik.planets_in_retrograde (Swiss speed < 0):
  //    Sun/Moon excluded; Mean Rahu/Ketu always retrograde; others retrograde iff speed < 0.
  const chart = makeHandChart();
  chart.planets.Mercury.speedLongitude = -0.4;
  chart.planets.Mercury.isRetrograde = true;
  const r = buildRetrogradeBlock(createBlockContext(chart)).value;
  assert.equal(r?.Mercury, true);
  assert.equal(r?.Sun, false);
  assert.equal(r?.Moon, false);
  assert.equal(r?.Rahu, true);
  assert.equal(r?.Ketu, true);

  console.log("✓ Phase 3 PyJHora Source-Level Alignment Passed (source-level only; numerical parity not executed)!");
}
