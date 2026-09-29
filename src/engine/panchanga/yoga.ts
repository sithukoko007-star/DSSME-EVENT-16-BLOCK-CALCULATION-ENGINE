import { norm360, segmentIndex } from './angles.ts';
import type { SiderealLongitudes, YogaResult } from './panchangaTypes.ts';

export const YOGA_SPAN = 360 / 27;

const NAMES = [
  'Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti',
  'Shula', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata',
  'Variyan', 'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra',
  'Vaidhriti',
];

/** Sum of SIDEREAL Sun + Moon; ayanamsa does not cancel here. */
export const yogaSum = (l: SiderealLongitudes) => norm360(l.sun + l.moon);

export function computeYoga(l: SiderealLongitudes): YogaResult {
  const s = yogaSum(l);
  const i0 = segmentIndex(s, YOGA_SPAN, 27);
  return {
    index: i0 + 1,
    name: NAMES[i0],
    sumDeg: s,
    fractionElapsed: (s - i0 * YOGA_SPAN) / YOGA_SPAN,
  };
}
