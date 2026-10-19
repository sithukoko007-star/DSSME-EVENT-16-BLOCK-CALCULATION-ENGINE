/**
 * BLOCK_13 — HORA
 * Current hora lord at the chart instant.
 *
 * §15.4 Weekday hora sequences:
 *   Sun:  Sun-Ven-Mer-Mon-Sat-Jup-Mar...
 *   Mon:  Mon-Sat-Jup-Mar-Sun-Ven-Mer...
 *   Tue:  Mar-Sun-Ven-Mer-Mon-Sat-Jup...
 *   Wed:  Mer-Mon-Sat-Jup-Mar-Sun-Ven...
 *   Thu:  Jup-Mar-Sun-Ven-Mer-Mon-Sat...
 *   Fri:  Ven-Mer-Mon-Sat-Jup-Mar-Sun...
 *   Sat:  Sat-Jup-Mar-Sun-Ven-Mer-Mon...
 *
 * Day horas: sunrise → sunset in sequence (each = day_length/12)
 * Night horas: sunset → next sunrise in continued sequence.
 *
 * PanchangaResult must be available (for sunrise/sunset data).
 * If unavailable, defaults to Sun hora with a warning.
 */

import type { ClassicalPlanet, HoraBlock } from "../../types/dssme-canonical-types.ts";
import type { BlockContext, BlockResult } from "../blocks/blockTypes.ts";
import { finalizeBlock, warningIssue } from "../blocks/blockResult.ts";

// §15.4 Hora sequences: day 0 (Sun) .. day 6 (Sat)
// Indexed by JS weekday: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const HORA_SEQUENCES: ClassicalPlanet[][] = [
  ["Sun", "Venus", "Mercury", "Moon", "Saturn", "Jupiter", "Mars"],    // Sun
  ["Moon", "Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury"],    // Mon
  ["Mars", "Sun", "Venus", "Mercury", "Moon", "Saturn", "Jupiter"],    // Tue
  ["Mercury", "Moon", "Saturn", "Jupiter", "Mars", "Sun", "Venus"],    // Wed
  ["Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon", "Saturn"],    // Thu
  ["Venus", "Mercury", "Moon", "Saturn", "Jupiter", "Mars", "Sun"],    // Fri
  ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"],    // Sat
];

/** Julian Day UT → wall-clock HH:MM local string (approximate) */
function jdToLocalTimeStr(jdUt: number, offsetHours: number): string {
  const utcMs = (jdUt - 2440587.5) * 86400000;
  const localMs = utcMs + offsetHours * 3600000;
  const d = new Date(localMs);
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Build the HORA block.
 * Requires sunrise/sunset info from panchanga or sunrise providers.
 * For now, if panchanga is available and contains sunrise data, we use it.
 * Otherwise we estimate based on civil noon ±6h.
 *
 * @param sunriseJdUt Julian Day UT of sunrise
 * @param sunsetJdUt  Julian Day UT of sunset (optional estimate if not given)
 */
export function buildHoraBlock(
  ctx: BlockContext,
  sunriseJdUt?: number,
  sunsetJdUt?: number
): BlockResult<HoraBlock> {
  const { chart } = ctx;
  const offsetHours = chart.time.timezoneOffsetHours;
  const chartJd = chart.time.julianDayUt;
  const issues = [];

  // Determine weekday from local ISO string
  const localIso = chart.time.localIso;
  const localDate = new Date(localIso);
  const weekday = localDate.getDay(); // 0=Sun..6=Sat

  const sequence = HORA_SEQUENCES[weekday] ?? HORA_SEQUENCES[0]!;

  let horaIndex = 0;
  let horaStartJd = 0;
  let horaEndJd = 0;
  let defaulted = false;

  if (sunriseJdUt !== undefined) {
    // Use provided sunrise; estimate sunset if not given
    const dayLengthJd = sunsetJdUt !== undefined
      ? sunsetJdUt - sunriseJdUt
      : 12.0 / 24.0; // default 12h day

    const nightLengthJd = (sunsetJdUt !== undefined && sunriseJdUt !== undefined)
      ? (1.0 - dayLengthJd)   // remainder of 24h
      : 12.0 / 24.0;

    const dayHoraLen = dayLengthJd / 12;
    const nightHoraLen = nightLengthJd / 12;

    const sunsetJd = sunriseJdUt + dayLengthJd;
    const nextSunriseJd = sunsetJd + nightLengthJd;

    if (chartJd >= sunriseJdUt && chartJd < sunsetJd) {
      // Day hora
      const elapsed = chartJd - sunriseJdUt;
      horaIndex = Math.min(11, Math.floor(elapsed / dayHoraLen));
      horaStartJd = sunriseJdUt + horaIndex * dayHoraLen;
      horaEndJd = horaStartJd + dayHoraLen;
    } else {
      // Night hora (index 12–23)
      const nightStart = sunsetJd;
      const elapsed = chartJd >= sunsetJd
        ? chartJd - nightStart
        : (chartJd + (nextSunriseJd - sunriseJdUt - dayLengthJd)); // pre-sunrise next day wrapping
      const nightHoraIdx = Math.min(11, Math.floor(elapsed / nightHoraLen));
      horaIndex = 12 + nightHoraIdx;
      horaStartJd = nightStart + nightHoraIdx * nightHoraLen;
      horaEndJd = horaStartJd + nightHoraLen;
    }
  } else {
    // Fallback: estimate using noon ±6h (civil day)
    issues.push(warningIssue("HORA.sunrise", "Sunrise not provided; estimating hora from civil time"));
    defaulted = true;

    // Approximate sunrise as chartDate 06:00 local
    const utcMs = (chartJd - 2440587.5) * 86400000;
    const localMs = utcMs + offsetHours * 3600000;
    const localMidnight = Math.floor(localMs / 86400000) * 86400000;
    const estimatedSunriseMs = localMidnight + 6 * 3600000;
    const estimatedSunriseJd = 2440587.5 + (estimatedSunriseMs - offsetHours * 3600000) / 86400000;

    const dayHoraLen = (12.0 / 24.0) / 12; // 1h each
    const elapsed = chartJd - estimatedSunriseJd;
    if (elapsed >= 0) {
      horaIndex = Math.min(23, Math.floor(elapsed / dayHoraLen));
    } else {
      horaIndex = Math.min(23, Math.max(0, Math.floor((elapsed + 1.0) / dayHoraLen)));
    }
    horaStartJd = estimatedSunriseJd + horaIndex * dayHoraLen;
    horaEndJd = horaStartJd + dayHoraLen;
  }

  // Get hora lord: sequence repeats every 7, horaIndex mod 7
  const lordsInOrder = horaIndex < 12
    ? sequence
    : sequence; // same sequence continues for night

  const lord = lordsInOrder[horaIndex % 7]!;

  const value: HoraBlock = {
    planet: lord,
    hora_number: horaIndex + 1,
    start_time: jdToLocalTimeStr(horaStartJd, offsetHours),
    end_time: jdToLocalTimeStr(horaEndJd, offsetHours),
  };

  return finalizeBlock({
    blockId: "HORA",
    ctx,
    inputs: ["CanonicalChart"],
    value,
    issues,
    defaulted,
  });
}

/** Compute the full day hora schedule (24 horas) for display purposes. */
export function getFullHoraSchedule(
  weekday: number,
  sunriseJdUt: number,
  dayLengthJd: number,
  offsetHours: number
): Array<{ hora_number: number; planet: ClassicalPlanet; start_time: string; end_time: string }> {
  const sequence = HORA_SEQUENCES[weekday] ?? HORA_SEQUENCES[0]!;
  const nightLengthJd = 1.0 - dayLengthJd;
  const dayHoraLen = dayLengthJd / 12;
  const nightHoraLen = nightLengthJd / 12;
  const sunsetJd = sunriseJdUt + dayLengthJd;

  const result = [];
  for (let i = 0; i < 24; i++) {
    const isDay = i < 12;
    const horaLen = isDay ? dayHoraLen : nightHoraLen;
    const baseJd = isDay ? sunriseJdUt : sunsetJd;
    const idx = isDay ? i : i - 12;
    const startJd = baseJd + idx * horaLen;
    const endJd = startJd + horaLen;
    result.push({
      hora_number: i + 1,
      planet: sequence[i % 7]!,
      start_time: jdToLocalTimeStr(startJd, offsetHours),
      end_time: jdToLocalTimeStr(endJd, offsetHours),
    });
  }
  return result;
}
