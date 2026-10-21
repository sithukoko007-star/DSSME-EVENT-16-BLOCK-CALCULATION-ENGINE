/**
 * DSSME Phase 8 — Chesta Bala Method 2: Speed & Retrograde Verification
 * Tests:  retrograde → 60, stationary → 0, direct → proportional, Sun/Moon models
 */

import { calculateChestaBalaAll, calculateSunChestaBala, calculateMoonChestaBala, calculateOuterPlanetChestaBala } from '../../src/engine/strength/chestaBala.js';

let pass = 0, fail = 0;
function check(label: string, got: number, expected: number, tol = 0.01) {
  if (Math.abs(got - expected) <= tol) {
    console.log(`  ✅ ${label}: ${got.toFixed(2)} (expected ${expected})`);
    pass++;
  } else {
    console.error(`  ❌ ${label}: got ${got.toFixed(4)}, expected ${expected}`);
    fail++;
  }
}

// ─── 1. Retrograde planets → 60 virupas ─────────────────────────────────────
console.log('\n[1] Retrograde → 60 virupas');
check('Mars  retrograde', calculateOuterPlanetChestaBala('Mars',    -0.3),   60);
check('Mercury retrograde', calculateOuterPlanetChestaBala('Mercury', -1.2),  60);
check('Jupiter retrograde', calculateOuterPlanetChestaBala('Jupiter', -0.04), 60);
check('Venus retrograde',   calculateOuterPlanetChestaBala('Venus',   -0.8),  60);
check('Saturn retrograde',  calculateOuterPlanetChestaBala('Saturn',  -0.01), 60);

// ─── 2. Stationary planets → 0 virupas ──────────────────────────────────────
console.log('\n[2] Stationary (|speed| < 5% of mean) → 0 virupas');
check('Mars  stationary', calculateOuterPlanetChestaBala('Mars',    0.025),  0);
check('Saturn stationary', calculateOuterPlanetChestaBala('Saturn', 0.001),  0);
check('Mercury stationary', calculateOuterPlanetChestaBala('Mercury', 0.15), 0);

// ─── 3. Direct motion → proportional (capped at 60) ─────────────────────────
console.log('\n[3] Direct motion → proportional (capped at 60)');
check('Mars at mean speed',   calculateOuterPlanetChestaBala('Mars',    0.524),   60);
check('Mars at half speed',   calculateOuterPlanetChestaBala('Mars',    0.262),   30);
check('Jupiter at mean speed',calculateOuterPlanetChestaBala('Jupiter', 0.0831),  60);
check('Saturn at mean speed', calculateOuterPlanetChestaBala('Saturn',  0.033439),60);
check('Venus above mean → 60',calculateOuterPlanetChestaBala('Venus',   3.2),     60);

// ─── 4. Sun Chesta Bala (Ayana model) ────────────────────────────────────────
console.log('\n[4] Sun Chesta Bala — Ayana model');
const sunAtEquinox = calculateSunChestaBala(0, 0);
check('Sun at vernal equinox (trop=0)', sunAtEquinox, 60.0, 0.5);
const sunAtSolstice = calculateSunChestaBala(90, 0);
check('Sun at summer solstice (trop=90)', sunAtSolstice, 120.0, 0.5);

// ─── 5. Moon Chesta Bala (Paksha model) ──────────────────────────────────────
console.log('\n[5] Moon Chesta Bala — Paksha model');
check('Moon full moon (elong=180)', calculateMoonChestaBala(180, 0),   60.0);
check('Moon new moon  (elong=0)',   calculateMoonChestaBala(0,   0),    0.0);
check('Moon quarter   (elong=90)',  calculateMoonChestaBala(90,  0),   30.0);

// ─── 6. Full array (7 planets) ───────────────────────────────────────────────
console.log('\n[6] calculateChestaBalaAll — 7-planet array');
const planets = {
  Sun:     { name: 'Sun',     totalLongitude: 300, speedLongitude:  0.98 },
  Moon:    { name: 'Moon',    totalLongitude:  60, speedLongitude: 13.10 },
  Mars:    { name: 'Mars',    totalLongitude: 210, speedLongitude: -0.30 },
  Mercury: { name: 'Mercury', totalLongitude: 285, speedLongitude:  2.00 },
  Jupiter: { name: 'Jupiter', totalLongitude: 150, speedLongitude:  0.04 },
  Venus:   { name: 'Venus',   totalLongitude:  20, speedLongitude:  0.024 },
  Saturn:  { name: 'Saturn',  totalLongitude: 330, speedLongitude: -0.01 },
};
const result = calculateChestaBalaAll(planets, { ayanamsaDegrees: 23.15 });
check('Mars  is 60 (retrograde)',    result[2]!, 60.0);
check('Saturn is 60 (retrograde)',   result[6]!, 60.0);
check('Venus  is 0 (stationary)',    result[5]!, 0.0);

console.log(`\n${'─'.repeat(60)}`);
console.log(`  Result: ${pass} passed, ${fail} failed`);
if (fail === 0) console.log('  ✅ ALL CHESTA METHOD 2 TESTS PASSED');
else { console.error('  ❌ SOME TESTS FAILED'); process.exit(1); }
