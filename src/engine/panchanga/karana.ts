import { segmentIndex } from './angles.ts';
import { elongation } from './tithi.ts';
import type { KaranaResult, SiderealLongitudes } from './panchangaTypes.ts';

export const KARANA_SPAN = 6;   // half a tithi

const MOVABLE = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti'];

/**
 * 60 half-tithis per lunar month:
 *   k=0        Kimstughna (fixed)
 *   k=1..56    7 movable Karanas repeating 8 times
 *   k=57,58,59 Shakuni, Chatushpada, Naga (fixed)
 */
export function karanaNameAt(k: number): { name: string; kind: 'fixed' | 'movable' } {
  if (k === 0) return { name: 'Kimstughna', kind: 'fixed' };
  if (k === 57) return { name: 'Shakuni', kind: 'fixed' };
  if (k === 58) return { name: 'Chatushpada', kind: 'fixed' };
  if (k === 59) return { name: 'Naga', kind: 'fixed' };
  return { name: MOVABLE[(k - 1) % 7], kind: 'movable' };
}

export function computeKarana(l: SiderealLongitudes): KaranaResult {
  const k = segmentIndex(elongation(l), KARANA_SPAN, 60);
  const { name, kind } = karanaNameAt(k);
  return { halfTithiIndex: k + 1, name, kind };
}
