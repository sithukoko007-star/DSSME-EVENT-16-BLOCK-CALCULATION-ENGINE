import { norm360, segmentIndex } from './angles.ts';
import type { NakshatraResult, SiderealLongitudes } from './panchangaTypes.ts';

export const NAKSHATRA_SPAN = 360 / 27;   // 13°20'
export const PADA_SPAN = NAKSHATRA_SPAN / 4;

const NAMES = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya',
  'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati',
  'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana',
  'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

export function computeNakshatra(l: SiderealLongitudes): NakshatraResult {
  const m = norm360(l.moon);
  const i0 = segmentIndex(m, NAKSHATRA_SPAN, 27);
  const within = m - i0 * NAKSHATRA_SPAN;
  return {
    index: i0 + 1,
    name: NAMES[i0],
    pada: Math.min(4, Math.floor(within / PADA_SPAN) + 1),
    moonLongitudeDeg: m,
    fractionElapsed: within / NAKSHATRA_SPAN,
  };
}
