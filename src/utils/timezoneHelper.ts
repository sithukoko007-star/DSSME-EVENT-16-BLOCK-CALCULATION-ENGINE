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
  const totalSeconds = Math.round(Math.abs(offsetHours) * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const base = `UTC${sign}${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  return s > 0 ? `${base}:${s.toString().padStart(2, "0")}` : base;
}

/**
 * Automatically derives the UTC offset (in decimal hours) for a specific civil date and time in an IANA timezone.
 * Accounts for historical Local Mean Time (LMT), Daylight Saving Time (DST), second-precision offsets,
 * and regional timezone adjustments at that exact civil moment.
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
      timeZoneName: "longOffset",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });

    const parseGmtOffset = (tzName: string): number | null => {
      const m = /^GMT([+-])(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?$/.exec(tzName?.trim() || "");
      if (!m) {
        if (tzName === "GMT" || tzName === "UTC") return 0;
        return null;
      }
      const sign = m[1] === "-" ? -1 : 1;
      const h = parseInt(m[2], 10);
      const min = m[3] ? parseInt(m[3], 10) : 0;
      const sec = m[4] ? parseInt(m[4], 10) : 0;
      return sign * (h + min / 60 + sec / 3600);
    };

    const getParts = (utcMs: number) => {
      const parts = dtf.formatToParts(new Date(utcMs));
      const p: Record<string, string> = {};
      for (const part of parts) {
        if (part.type !== "literal") p[part.type] = part.value;
      }
      let fh = parseInt(p.hour, 10);
      if (fh === 24) fh = 0;
      const fy = parseInt(p.year, 10);
      const fm = parseInt(p.month, 10);
      const fd = parseInt(p.day, 10);
      const fmin = parseInt(p.minute, 10);
      const fs = parseInt(p.second || "0", 10);
      let off = parseGmtOffset(p.timeZoneName || "");
      if (off === null) {
        const localMs = Date.UTC(fy, fm - 1, fd, fh, fmin, fs);
        off = (localMs - utcMs) / 3600000.0;
      }
      return {
        year: fy,
        month: fm,
        day: fd,
        hour: fh,
        minute: fmin,
        second: fs,
        offset: off,
      };
    };

    const formatsToTarget = (testUtcMs: number): boolean => {
      const p = getParts(testUtcMs);
      return (
        p.year === year &&
        p.month === month &&
        p.day === day &&
        p.hour === hour &&
        p.minute === minute &&
        p.second === second
      );
    };

    const targetCivilUtcGuess = Date.UTC(year, month - 1, day, hour, minute, second);

    // Collect candidate offsets around this civil date by sampling across +/- 36 hours
    const candidateOffsets = new Set<number>();
    const noonGuess = Date.UTC(year, month - 1, day, 12, 0, 0);
    for (const deltaH of [-36, -24, -18, -12, -6, 0, 6, 12, 18, 24, 36]) {
      const p = getParts(noonGuess + deltaH * 3600000);
      if (p.offset !== null) {
        candidateOffsets.add(p.offset);
      }
    }

    // Also include standard 15-minute intervals around the probed base offset
    // to comprehensively catch standard 30-min, 45-min, 1-hr, or 2-hr DST shifts
    const baseOffset = candidateOffsets.values().next().value ?? 0;
    for (let step = -12; step <= 12; step++) {
      candidateOffsets.add(baseOffset + step * 0.25);
    }

    const matchingOffsets: number[] = [];
    for (const cand of candidateOffsets) {
      const testUtcMs = targetCivilUtcGuess - cand * 3600000;
      if (formatsToTarget(testUtcMs)) {
        if (!matchingOffsets.some((o) => Math.abs(o - cand) < 0.0001)) {
          matchingOffsets.push(cand);
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
