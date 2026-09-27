/**
 * Julian Day Calculation Engine (Universal Time)
 * High-precision astronomical algorithm conforming to Swiss Ephemeris and IAU standards.
 */

/**
 * Calculates Julian Day Number for Universal Time (UT).
 *
 * @param year Calendar year (Gregorian)
 * @param month Calendar month (1-12)
 * @param day Calendar day of month (1-31)
 * @param utHours Universal Time in decimal hours (0.0 - 24.0)
 * @returns Julian Day in UT
 */
export function calculateJulianDayUt(
  year: number,
  month: number,
  day: number,
  utHours: number
): number {
  let y = year;
  let m = month;

  // If January or February, treat as months 13 and 14 of previous year
  if (m <= 2) {
    y -= 1;
    m += 12;
  }

  // Gregorian calendar reform adjustment
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);

  // Standard astronomical formula
  const jd0 =
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    b -
    1524.5;

  const jd = jd0 + utHours / 24.0;
  return jd;
}

/**
 * Calculates Julian Day UT directly from a JavaScript Date object (interpreted in UTC).
 */
export function dateToJulianDayUt(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const hours =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600 +
    date.getUTCMilliseconds() / 3600000;

  return calculateJulianDayUt(y, m, d, hours);
}

/**
 * Converts Julian Day UT back to a UTC Date object.
 */
export function julianDayUtToDate(jd: number): Date {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;

  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }

  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);

  const day = b - d - Math.floor(30.6001 * e) + f;
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;

  const dayInt = Math.floor(day);
  const dayFrac = day - dayInt;
  const totalSeconds = Math.round(dayFrac * 86400 * 1000) / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);

  return new Date(Date.UTC(year, month - 1, dayInt, hours, minutes, seconds, milliseconds));
}
