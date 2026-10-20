/**
 * BLOCK_1 — IDENTITY
 * Projects CanonicalChart + session parameters into IdentityBlock.
 * Derives lagna_type from lagna sign per §3.1 Rule 7.
 */

import type {
  IdentityBlock,
  LagnaType,
  ZodiacSign,
} from "../../types/dssme-canonical-types.ts";
import type { BlockContext, BlockResult } from "../blocks/blockTypes.ts";
import { errorIssue, finalizeBlock } from "../blocks/blockResult.ts";

/** §3.1 Rule 7: lagna_type derived from lagna sign. */
export function getLagnaType(sign: ZodiacSign): LagnaType {
  const movable: ZodiacSign[] = ["Aries", "Cancer", "Libra", "Capricorn"];
  const fixed: ZodiacSign[] = ["Taurus", "Leo", "Scorpio", "Aquarius"];
  if (movable.includes(sign)) return "Movable";
  if (fixed.includes(sign)) return "Fixed";
  return "Dual";
}

/** Format decimal degrees as "DD°MM'SS\"" string. */
function formatDegree(deg: number): string {
  const total = Math.abs(deg);
  const d = Math.floor(total);
  const mFrac = (total - d) * 60;
  const m = Math.floor(mFrac);
  const s = Math.round((mFrac - m) * 60);
  return `${d}°${m.toString().padStart(2, "0")}'${s.toString().padStart(2, "0")}"`;
}

/** Format lat/lon decimal as "XX.XXN" / "XX.XXE" style. */
function formatLatitude(lat: number): string {
  return `${Math.abs(lat).toFixed(4)}${lat >= 0 ? "N" : "S"}`;
}
function formatLongitude(lon: number): string {
  return `${Math.abs(lon).toFixed(4)}${lon >= 0 ? "E" : "W"}`;
}

/** Format UTC offset hours as "UTC+HH:MM" */
function formatTimezone(offsetHours: number): string {
  const sign = offsetHours >= 0 ? "+" : "-";
  const abs = Math.abs(offsetHours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `UTC${sign}${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export interface IdentitySessionParams {
  bodyMode?: string;
  objective?: string;
  risk?: string;
  geometry?: string;
}

export function buildIdentityBlock(
  ctx: BlockContext,
  sessionParams: IdentitySessionParams = {}
): BlockResult<IdentityBlock> {
  const { chart } = ctx;
  const issues = [];

  const lagnaSign = chart.lagna.sign;
  if (!lagnaSign) {
    issues.push(errorIssue("lagna.sign", "Lagna sign is missing"));
  }

  // Derive weekday from localIso date component without involving new Date().getDay()
  // (which would interpret in machine timezone, not chart timezone).
  // localIso is already in the chart's local timezone by construction from Phase 1.
  const localIso = chart.time.localIso;
  const dateStr = localIso.split("T")[0] ?? "";
  const [yr, mo, dy] = dateStr.split("-").map(Number) as [number, number, number];
  // Use UTC date to get day-of-week from the local date components (no DST shift).
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = weekdays[new Date(Date.UTC(yr, mo - 1, dy)).getUTCDay()] ?? "Unknown";

  const ayanamsaValue = chart.ayanamsa.value;
  // S-08: format as "24.2300" (no sign prefix, no degree symbol)
  const ayanamsaStr = `${ayanamsaValue.toFixed(4)}`;

  const lagnaType = lagnaSign ? getLagnaType(lagnaSign) : "Movable";
  const lagnaDegStr = `${lagnaSign ?? "?"} ${formatDegree(chart.lagna.signDegree)}`;

  const value: IdentityBlock = {
    date: dateStr,
    day: dayName,
    time: chart.time.localIso.split("T")[1]?.substring(0, 8) ?? "00:00:00",
    timezone: formatTimezone(chart.time.timezoneOffsetHours),
    location_city: chart.location.city ?? "Unknown",
    location_country: chart.location.country ?? "Unknown",
    latitude: formatLatitude(chart.location.latitude),
    longitude: formatLongitude(chart.location.longitude),
    ayanamsa_name: "Lahiri",
    ayanamsa_value: ayanamsaStr,
    lagna_sign: lagnaSign,
    lagna_degree: lagnaDegStr,
    lagna_type: lagnaType,
    body_mode: sessionParams.bodyMode ?? "9-body",
    objective: sessionParams.objective ?? "short-cycle speculative extraction",
    risk: sessionParams.risk ?? "OBSERVE",
    geometry: sessionParams.geometry ?? "ordered_2_digit",
    engine_version: "V3.0",
  };

  return finalizeBlock({
    blockId: "IDENTITY",
    ctx,
    inputs: ["CanonicalChart"],
    value,
    issues,
  });
}
