/**
 * IANA Timezone Helper & Automatic Offset Derivation
 * Provides lightweight, zero-dependency IANA validation, search, and historical offset resolution.
 */

export interface TimezoneOffsetResult {
  valid: boolean;
  offsetHours?: number;
  formattedOffset?: string;
  isDstGap?: boolean;
  isDstOverlap?: boolean;
  validOffsets?: number[];
  error?: string;
}

/**
 * Curated fallback list of major international IANA timezones
 * Used if Intl.supportedValuesOf("timeZone") is unavailable.
 */
export const FALLBACK_IANA_TIMEZONES: readonly string[] = [
  "Africa/Cairo",
  "Africa/Casablanca",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "America/Anchorage",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Caracas",
  "America/Chicago",
  "America/Denver",
  "America/Halifax",
  "America/Havana",
  "America/Lima",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Phoenix",
  "America/Santiago",
  "America/Sao_Paulo",
  "America/St_Johns",
  "America/Toronto",
  "America/Vancouver",
  "Asia/Almaty",
  "Asia/Amman",
  "Asia/Baghdad",
  "Asia/Baku",
  "Asia/Bangkok",
  "Asia/Beirut",
  "Asia/Colombo",
  "Asia/Dhaka",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Jerusalem",
  "Asia/Kabul",
  "Asia/Karachi",
  "Asia/Kathmandu",
  "Asia/Kolkata",
  "Asia/Kuala_Lumpur",
  "Asia/Kuwait",
  "Asia/Manila",
  "Asia/Muscat",
  "Asia/Riyadh",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Taipei",
  "Asia/Tashkent",
  "Asia/Tehran",
  "Asia/Tokyo",
  "Asia/Ulaanbaatar",
  "Asia/Yangon",
  "Atlantic/Azores",
  "Atlantic/Reykjavik",
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Darwin",
  "Australia/Hobart",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Athens",
  "Europe/Belgrade",
  "Europe/Berlin",
  "Europe/Brussels",
  "Europe/Bucharest",
  "Europe/Budapest",
  "Europe/Copenhagen",
  "Europe/Dublin",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Europe/Kiev",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Oslo",
  "Europe/Paris",
  "Europe/Prague",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Vienna",
  "Europe/Warsaw",
  "Europe/Zurich",
  "Pacific/Auckland",
  "Pacific/Chatham",
  "Pacific/Fiji",
  "Pacific/Guam",
  "Pacific/Honolulu",
  "Pacific/Port_Moresby",
  "Pacific/Tongatapu",
  "UTC",
] as const;

/**
 * Common modern / recognized IANA aliases to ensure present in autocomplete
 * (e.g. Asia/Yangon vs historical Asia/Rangoon).
 */
export const COMMON_MODERN_ALIASES: readonly string[] = [
  "Asia/Yangon",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Ho_Chi_Minh",
  "America/Argentina/Buenos_Aires",
  "UTC",
] as const;

/**
 * Returns all available IANA timezones supported by the environment,
 * enriched with modern aliases.
 */
export function getAllIanaTimezones(): string[] {
  const set = new Set<string>();

  try {
    if (typeof Intl !== "undefined" && typeof (Intl as any).supportedValuesOf === "function") {
      const list = (Intl as any).supportedValuesOf("timeZone");
      if (Array.isArray(list)) {
        for (const tz of list) {
          set.add(tz);
        }
      }
    }
  } catch {
    // Ignore and fallback
  }

  // Ensure fallbacks and common modern aliases are present if valid
  const fallbacks = set.size === 0 ? FALLBACK_IANA_TIMEZONES : COMMON_MODERN_ALIASES;
  for (const tz of fallbacks) {
    if (isValidIanaTimezone(tz)) {
      set.add(tz);
    }
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Validates whether a given string is a recognized IANA timezone identifier.
 */
export function isValidIanaTimezone(tz: string): boolean {
  if (!tz || typeof tz !== "string" || !tz.trim()) {
    return false;
  }
  const trimmed = tz.trim();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats decimal offset hours into standard UTC representation (e.g. UTC+09:00, UTC-05:00, UTC+06:30)
 */
export function formatOffsetDisplay(offsetHours: number): string {
  const sign = offsetHours >= 0 ? "+" : "-";
  const abs = Math.abs(offsetHours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `UTC${sign}${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Automatically derives the UTC offset (in decimal hours) for a specific civil date and time in an IANA timezone.
 * Accounts for historical Daylight Saving Time (DST) and regional timezone adjustments at that exact civil moment.
 */
export function deriveTimezoneOffset(
  tz: string,
  dateStr: string,
  timeStr: string = "12:00:00"
): TimezoneOffsetResult {
  const trimmedTz = tz?.trim();
  if (!trimmedTz) {
    return { valid: false, error: "Timezone name is required" };
  }

  if (!isValidIanaTimezone(trimmedTz)) {
    return {
      valid: false,
      error: `"${trimmedTz}" is not a recognized IANA timezone identifier`,
    };
  }

  // Validate date format YYYY-MM-DD
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr?.trim() || "");
  if (!dateMatch) {
    return { valid: false, error: "Valid YYYY-MM-DD date required" };
  }

  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const day = parseInt(dateMatch[3], 10);

  // Validate time format HH:MM:SS or HH:MM
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeStr?.trim() || "");
  const hour = timeMatch ? parseInt(timeMatch[1], 10) : 12;
  const minute = timeMatch ? parseInt(timeMatch[2], 10) : 0;
  const second = timeMatch && timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;

  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: trimmedTz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });

    const formatsToTarget = (testUtcMs: number): boolean => {
      const parts = dtf.formatToParts(new Date(testUtcMs));
      const p: Record<string, string> = {};
      for (const part of parts) {
        if (part.type !== "literal") {
          p[part.type] = part.value;
        }
      }
      const fy = parseInt(p.year, 10);
      const fm = parseInt(p.month, 10);
      const fd = parseInt(p.day, 10);
      let fh = parseInt(p.hour, 10);
      if (fh === 24) fh = 0;
      const fmin = parseInt(p.minute, 10);
      const fs = parseInt(p.second || "0", 10);

      return (
        fy === year &&
        fm === month &&
        fd === day &&
        fh === hour &&
        fmin === minute &&
        fs === second
      );
    };

    // Find base offset around noon UTC for that civil date
    const noonUtc = Date.UTC(year, month - 1, day, 12, 0, 0);
    const partsNoon = dtf.formatToParts(new Date(noonUtc));
    const pNoon: Record<string, string> = {};
    for (const part of partsNoon) {
      if (part.type !== "literal") pNoon[part.type] = part.value;
    }
    let fhNoon = parseInt(pNoon.hour, 10);
    if (fhNoon === 24) fhNoon = 0;
    const noonLocalMs = Date.UTC(
      parseInt(pNoon.year, 10),
      parseInt(pNoon.month, 10) - 1,
      parseInt(pNoon.day, 10),
      fhNoon,
      parseInt(pNoon.minute, 10),
      0
    );
    const baseOffsetHours = (noonLocalMs - noonUtc) / 3600000.0;

    // Test candidate offsets around baseOffset (within +/- 3 hours, in 15-minute steps)
    const matchingOffsets: number[] = [];
    const targetCivilUtcGuess = Date.UTC(year, month - 1, day, hour, minute, second);

    for (let step = -16; step <= 16; step++) {
      const candidateOffset = baseOffsetHours + step * 0.25;
      const candidateUtcMs = targetCivilUtcGuess - candidateOffset * 3600000;
      if (formatsToTarget(candidateUtcMs)) {
        if (!matchingOffsets.some((o) => Math.abs(o - candidateOffset) < 0.001)) {
          matchingOffsets.push(candidateOffset);
        }
      }
    }

    matchingOffsets.sort((a, b) => a - b);

    // 1. Spring-Forward Gap (non-existent local civil time)
    if (matchingOffsets.length === 0) {
      return {
        valid: false,
        isDstGap: true,
        validOffsets: [],
        error: `Non-existent local time: "${dateStr} ${timeStr}" falls within a daylight saving spring-forward gap in timezone "${trimmedTz}". This civil instant does not exist.`,
      };
    }

    // 2. Fall-Back Overlap (ambiguous local civil time with 2 occurrences)
    if (matchingOffsets.length > 1) {
      return {
        valid: true,
        isDstOverlap: true,
        offsetHours: matchingOffsets[0],
        validOffsets: matchingOffsets,
        formattedOffset: formatOffsetDisplay(matchingOffsets[0]),
      };
    }

    // 3. Unambiguous local civil time
    const resolvedOffset = matchingOffsets[0];
    if (resolvedOffset < -14 || resolvedOffset > 14) {
      return {
        valid: false,
        error: `Resolved offset (${resolvedOffset}h) is outside valid range [-14, +14]`,
      };
    }

    return {
      valid: true,
      isDstGap: false,
      isDstOverlap: false,
      offsetHours: resolvedOffset,
      validOffsets: matchingOffsets,
      formattedOffset: formatOffsetDisplay(resolvedOffset),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Failed to resolve offset: ${msg}` };
  }
}
