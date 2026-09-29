/**
 * IANA Timezone Helper & Automatic Offset Derivation
 * Provides lightweight, zero-dependency IANA validation, search, and historical offset resolution.
 */

export interface TimezoneOffsetResult {
  valid: boolean;
  offsetHours?: number;
  formattedOffset?: string;
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
    // Initial guess treating civil time directly as UTC epoch
    const guessUtc = Date.UTC(year, month - 1, day, hour, minute, second);

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

    const getTzUtcMs = (utcMs: number): number => {
      const parts = dtf.formatToParts(new Date(utcMs));
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
      if (fh === 24) fh = 0; // Standard midnight normalization
      const fmin = parseInt(p.minute, 10);
      const fs = parseInt(p.second, 10);
      return Date.UTC(fy, fm - 1, fd, fh, fmin, fs);
    };

    // First approximation of local civil instant in target timezone
    const localAtGuess = getTzUtcMs(guessUtc);
    const offsetMs1 = localAtGuess - guessUtc;

    // Refine once around DST boundaries
    const refinedUtc = guessUtc - offsetMs1;
    const localAtRefined = getTzUtcMs(refinedUtc);
    const offsetMs2 = localAtRefined - refinedUtc;

    const offsetHours = offsetMs2 / (1000 * 60 * 60);

    // Enforce legal range [-14, +14] per DSSME timezone specifications
    if (offsetHours < -14 || offsetHours > 14) {
      return {
        valid: false,
        error: `Resolved offset (${offsetHours}h) is outside valid range [-14, +14]`,
      };
    }

    const formattedOffset = formatOffsetDisplay(offsetHours);
    return {
      valid: true,
      offsetHours,
      formattedOffset,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Failed to resolve offset: ${msg}` };
  }
}
