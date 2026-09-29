import { norm360, segmentIndex } from './angles.ts';
import type { SiderealLongitudes, TithiResult } from './panchangaTypes.ts';

export const TITHI_SPAN = 12;

const NAMES = [
  'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami',
  'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi',
];

/** Elongation of Moon from Sun. Ayanamsa cancels, so sidereal or tropical both work. */
export const elongation = (l: SiderealLongitudes) => norm360(l.moon - l.sun);

export function computeTithi(l: SiderealLongitudes): TithiResult {
  const e = elongation(l);
  const i0 = segmentIndex(e, TITHI_SPAN, 30);      // 0..29
  const shukla = i0 < 15;
  const n = (i0 % 15) + 1;                          // 1..15
  const name = n === 15 ? (shukla ? 'Purnima' : 'Amavasya') : NAMES[n - 1];
  return {
    index: i0 + 1,
    paksha: shukla ? 'shukla' : 'krishna',
    numberInPaksha: n,
    name,
    elongationDeg: e,
    fractionElapsed: (e - i0 * TITHI_SPAN) / TITHI_SPAN,
  };
}
