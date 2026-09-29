import type {
  LongitudeProvider, PanchangaResult, PanchangaSource,
} from './panchangaTypes.ts';

export interface ValidationIssue { gate: string; message: string }

const EPS_DEG = 1e-9;

/** Structural + parity validation. Empty array means pass. */
export function validatePanchanga(
  r: PanchangaResult,
  src: PanchangaSource,
  provider?: LongitudeProvider,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const bad = (gate: string, message: string) => issues.push({ gate, message });
  const inRange = (n: number, lo: number, hi: number) => Number.isInteger(n) && n >= lo && n <= hi;

  // A. Tithi
  if (!inRange(r.tithi.index, 1, 30)) bad('A.tithi', `index ${r.tithi.index} out of 1..30`);
  if ((r.tithi.index <= 15) !== (r.tithi.paksha === 'shukla')) bad('A.tithi', 'paksha inconsistent with index');
  // B. Nakshatra
  if (!inRange(r.nakshatra.index, 1, 27)) bad('B.nakshatra', 'index out of 1..27');
  if (!inRange(r.nakshatra.pada, 1, 4)) bad('B.nakshatra', 'pada out of 1..4');
  // C. Yoga
  if (!inRange(r.yoga.index, 1, 27)) bad('C.yoga', 'index out of 1..27');
  // D. Karana
  if (!inRange(r.karana.halfTithiIndex, 1, 60)) bad('D.karana', 'half-tithi index out of 1..60');
  if (r.karana.halfTithiIndex !== Math.floor((r.tithi.elongationDeg) / 6) + 1) {
    bad('D.karana', 'karana not consistent with tithi elongation');
  }
  // E. Vara
  if (!inRange(r.vara.weekday, 0, 6)) bad('E.vara', 'weekday out of 0..6');
  // F. Boundaries
  for (const [k, w] of Object.entries({
    tithi: r.tithi.window, nakshatra: r.nakshatra.window, yoga: r.yoga.window,
  })) {
    if (w?.startJdUT != null && w.endJdUT != null) {
      if (!(w.startJdUT <= src.julianDayUT && src.julianDayUT <= w.endJdUT)) {
        bad('F.boundary', `${k} window does not contain the chart instant`);
      }
    }
  }
  // G. Provenance + parity with canonical state
  if (r.provenance.julianDayUT !== src.julianDayUT) bad('G.provenance', 'JD mismatch');
  if (r.provenance.positionSource !== src.positionSource) bad('G.provenance', 'positionSource mismatch');
  if (provider) {
    const aux = provider(src.julianDayUT);
    if (Math.abs(aux.sun - src.longitudes.sun) > EPS_DEG || Math.abs(aux.moon - src.longitudes.moon) > EPS_DEG) {
      bad('G.parity', 'auxiliary provider diverges from CanonicalChart at chart JD');
    }
  }
  return issues;
}
