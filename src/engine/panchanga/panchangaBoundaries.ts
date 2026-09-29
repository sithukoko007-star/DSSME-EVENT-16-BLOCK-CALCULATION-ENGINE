import { jdToLocalString, jdToUtcIso, norm360, wrapSigned } from './angles.ts';
import type {
  Degrees, JulianDayUT, LongitudeProvider, TransitionWindow,
} from './panchangaTypes.ts';
import { elongation, TITHI_SPAN } from './tithi.ts';
import { NAKSHATRA_SPAN } from './nakshatra.ts';
import { YOGA_SPAN, yogaSum } from './yoga.ts';
import { KARANA_SPAN } from './karana.ts';

export interface BoundarySearch {
  /** Monotonically increasing angle (mod 360) whose segment edges are boundaries. */
  angleAt: (jd: JulianDayUT) => Degrees;
  spanDeg: Degrees;
  fromJd: JulianDayUT;
  direction: 'next' | 'previous';
  stepDays?: number;       // default 0.05 (~1.2h); Moon <= ~15°/day so < 1 span per step
  maxDays?: number;        // default 3
  toleranceDays?: number;  // default 1e-9 (~86 µs)
}

/**
 * Finds the JD where `angleAt` crosses the next/previous multiple of `spanDeg`.
 * Assumes the angle only increases (true for Moon, elongation, Sun+Moon, sidereal).
 * NOTE: this calls `angleAt` at instants other than the chart JD. That is an
 * AUXILIARY calculation and must use the same ephemeris/flags/ayanamsa as Phase 1.
 */
export function findBoundary(o: BoundarySearch): JulianDayUT {
  const step = o.stepDays ?? 0.05;
  const maxDays = o.maxDays ?? 3;
  const tol = o.toleranceDays ?? 1e-9;
  const a0 = o.angleAt(o.fromJd);
  const k = Math.floor(a0 / o.spanDeg);
  const target = norm360((o.direction === 'next' ? k + 1 : k) * o.spanDeg);
  const g = (jd: JulianDayUT) => wrapSigned(o.angleAt(jd) - target);   // <0 before, >=0 after

  let lo: JulianDayUT, hi: JulianDayUT;
  if (o.direction === 'next') {
    lo = o.fromJd; hi = lo + step;
    while (g(hi) < 0) {
      lo = hi; hi += step;
      if (hi - o.fromJd > maxDays) throw new Error('findBoundary: no crossing within maxDays');
    }
  } else {
    hi = o.fromJd; lo = hi - step;
    while (g(lo) >= 0) {
      hi = lo; lo -= step;
      if (o.fromJd - lo > maxDays) throw new Error('findBoundary: no crossing within maxDays');
    }
  }
  while (hi - lo > tol) {
    const mid = (lo + hi) / 2;
    if (g(mid) < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function windowFor(
  angleAt: (jd: JulianDayUT) => Degrees, span: Degrees, jd: JulianDayUT, tz: string,
): TransitionWindow {
  const start = findBoundary({ angleAt, spanDeg: span, fromJd: jd, direction: 'previous' });
  const end = findBoundary({ angleAt, spanDeg: span, fromJd: jd, direction: 'next' });
  return {
    startJdUT: start, endJdUT: end,
    startUtcIso: jdToUtcIso(start), endUtcIso: jdToUtcIso(end),
    startLocal: jdToLocalString(start, tz), endLocal: jdToLocalString(end, tz),
  };
}

export function boundaryWindows(p: LongitudeProvider, jd: JulianDayUT, tz: string) {
  return {
    tithi:     windowFor(t => elongation(p(t)),      TITHI_SPAN,     jd, tz),
    karana:    windowFor(t => elongation(p(t)),      KARANA_SPAN,    jd, tz),
    nakshatra: windowFor(t => p(t).moon,             NAKSHATRA_SPAN, jd, tz),
    yoga:      windowFor(t => yogaSum(p(t)),         YOGA_SPAN,      jd, tz),
  };
}
