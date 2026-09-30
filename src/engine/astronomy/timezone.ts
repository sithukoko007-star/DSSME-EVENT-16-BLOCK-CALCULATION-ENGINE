/**
 * Timezone and UTC Resolution Engine
 * Conforms to DSSME Canonical Architecture
 */

export interface TimeResolutionResult {
  localIso: string;
  utcIso: string;
  utcDate: Date;
  decimalUtHours: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Validates and resolves local civil date, time, and timezone offset to UTC.
 *
 * @param dateStr "YYYY-MM-DD" local civil date
 * @param timeStr "HH:MM:SS" or "HH:MM" local civil time
 * @param timezoneOffsetHours UTC offset in decimal hours (e.g., +9 for Asia/Tokyo, -5 for EST)
 */
export function resolveDateTimeToUtc(
  dateStr: string,
  timeStr: string,
  timezoneOffsetHours: number
): TimeResolutionResult {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!dateMatch) {
    throw new Error(`INVALID_INPUT: Date must be in YYYY-MM-DD format, received: "${dateStr}"`);
  }

  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeStr.trim());
  if (!timeMatch) {
    throw new Error(`INVALID_INPUT: Time must be in HH:MM:SS format, received: "${timeStr}"`);
  }

  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const day = parseInt(dateMatch[3], 10);

  const hour = parseInt(timeMatch[1], 10);
  const minute = parseInt(timeMatch[2], 10);
  const second = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;

  if (month < 1 || month > 12) {
    throw new Error(`INVALID_INPUT: Month must be 1-12, received: ${month}`);
  }
  if (day < 1 || day > 31) {
    throw new Error(`INVALID_INPUT: Day must be 1-31, received: ${day}`);
  }

  // Round-trip calendar validation to reject non-existent calendar dates (e.g. Feb 30, Apr 31)
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() + 1 !== month ||
    calendarCheck.getUTCDate() !== day
  ) {
    throw new Error(`INVALID_INPUT: "${dateStr}" is not a valid calendar date`);
  }
  if (hour < 0 || hour > 23) {
    throw new Error(`INVALID_INPUT: Hour must be 0-23, received: ${hour}`);
  }
  if (minute < 0 || minute > 59) {
    throw new Error(`INVALID_INPUT: Minute must be 0-59, received: ${minute}`);
  }
  if (second < 0 || second > 59) {
    throw new Error(`INVALID_INPUT: Second must be 0-59, received: ${second}`);
  }
  if (timezoneOffsetHours < -14 || timezoneOffsetHours > 14) {
    throw new Error(
      `TIMEZONE_ERROR: Timezone offset hours must be between -14 and +14, received: ${timezoneOffsetHours}`
    );
  }

  // Format local ISO string: "YYYY-MM-DDTHH:MM:SS" + offset (including seconds if non-zero)
  const pad2 = (n: number) => n.toString().padStart(2, "0");
  const sign = timezoneOffsetHours >= 0 ? "+" : "-";
  const absOffset = Math.abs(timezoneOffsetHours);
  const totalOffsetSec = Math.round(absOffset * 3600);
  const offsetH = Math.floor(totalOffsetSec / 3600);
  const offsetM = Math.floor((totalOffsetSec % 3600) / 60);
  const offsetS = totalOffsetSec % 60;
  const offsetStr = offsetS > 0
    ? `${sign}${pad2(offsetH)}:${pad2(offsetM)}:${pad2(offsetS)}`
    : `${sign}${pad2(offsetH)}:${pad2(offsetM)}`;

  const localIso = `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}${offsetStr}`;

  // Calculate UTC timestamp in milliseconds
  // Date.UTC treats the provided numbers as UTC.
  // To get UTC from local time with offset:
  // utcTimestamp = localTimestampAsUTC - (offsetHours * 3600000)
  const localEpoch = Date.UTC(year, month - 1, day, hour, minute, second);
  const utcEpoch = localEpoch - Math.round(timezoneOffsetHours * 3600000);
  const utcDate = new Date(utcEpoch);
  const utcIso = utcDate.toISOString();

  // Decimal UT hours within the UTC day
  const utHours = utcDate.getUTCHours();
  const utMinutes = utcDate.getUTCMinutes();
  const utSeconds = utcDate.getUTCSeconds();
  const utMillis = utcDate.getUTCMilliseconds();
  const decimalUtHours = utHours + utMinutes / 60 + utSeconds / 3600 + utMillis / 3600000;

  return {
    localIso,
    utcIso,
    utcDate,
    decimalUtHours,
    year,
    month,
    day,
    hour,
    minute,
    second,
  };
}
