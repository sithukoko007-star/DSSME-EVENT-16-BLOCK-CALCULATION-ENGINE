// Small angle/time helpers shared by Panchanga modules (pure, no ephemeris access).
import type { Degrees, JulianDayUT } from './panchangaTypes.ts';

export const JD_UNIX_EPOCH = 2440587.5;

/** Normalize to [0, 360). */
export function norm360(deg: number): Degrees {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

/** Signed smallest difference in (-180, 180]. */
export function wrapSigned(deg: number): number {
  const r = norm360(deg);
  return r > 180 ? r - 360 : r;
}

/**
 * floor(angle / span) clamped to [0, count-1]. Guards the case where
 * floating-point rounding yields exactly `count` for angles just below 360.
 */
export function segmentIndex(angle: Degrees, span: Degrees, count: number): number {
  const i = Math.floor(norm360(angle) / span);
  return Math.min(Math.max(i, 0), count - 1);
}

export function jdToDate(jd: JulianDayUT): Date {
  return new Date((jd - JD_UNIX_EPOCH) * 86_400_000);
}

export function jdToUtcIso(jd: JulianDayUT): string {
  return jdToDate(jd).toISOString();
}

/** DST-safe local rendering via Intl (no manual offset arithmetic). */
export function jdToLocalString(jd: JulianDayUT, timezone: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).format(jdToDate(jd));
}
