/**
 * Lahiri Ayanamsa Calculation Module
 * Standard Indian Astronomical Ephemeris / Chitra Paksha standard
 */

import { calculateLahiriAyanamsa } from "./ephemeris.ts";

/**
 * Returns the Lahiri ayanamsa value in decimal degrees for a Julian Day UT.
 */
export async function getLahiriAyanamsa(julianDayUt: number): Promise<number> {
  return calculateLahiriAyanamsa(julianDayUt);
}

/**
 * Formats a decimal degree value into standard DMS string: "XX°XX'XX\""
 */
export function formatDms(degrees: number): string {
  const totalSeconds = Math.round(degrees * 3600);
  const d = Math.floor(totalSeconds / 3600);
  const remSec = totalSeconds % 3600;
  const m = Math.floor(remSec / 60);
  const s = remSec % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d)}°${pad(m)}'${pad(s)}"`;
}
