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
  const { chart, panchanga } = ctx;
  const offsetHours = chart.time.timezoneOffsetHours;
  const chartJd = chart.time.julianDayUt;
  const issues = [];

  // Panchanga မှ တွက်ချက်ပြီးသား sunriseJdUT ရှိပါက အလိုအလျောက် ရယူသုံးစွဲမည်
  const effectiveSunriseJd = sunriseJdUt ?? panchanga?.vara.sunriseJdUT;

  // Local civil date မှ Civil Weekday ကို ရှာခြင်း (Machine timezone မသုံးပါ)
  const localIso = chart.time.localIso;
  const datePart = localIso.split("T")[0] ?? "1970-01-01";
  const [yr, mo, dy] = datePart.split("-").map(Number) as [number, number, number];
  const civilWeekday = new Date(Date.UTC(yr, mo - 1, dy)).getUTCDay(); // 0=Sun..6=Sat

  let horaIndex = 0;
  let horaStartJd = 0;
  let horaEndJd = 0;
  let defaulted = false;
  let vedicWeekday = panchanga?.vara.weekday ?? civilWeekday;

  if (effectiveSunriseJd !== undefined) {
    const dayLengthJd =
      sunsetJdUt !== undefined &&
      sunsetJdUt > effectiveSunriseJd &&
      sunsetJdUt - effectiveSunriseJd < 0.95
        ? sunsetJdUt - effectiveSunriseJd
        : 12.0 / 24.0;
    const nightLengthJd = 1.0 - dayLengthJd;
    const dayHoraLen = dayLengthJd / 12.0;
    const nightHoraLen = nightLengthJd / 12.0;
    const sunsetJd = effectiveSunriseJd + dayLengthJd;

    if (chartJd >= effectiveSunriseJd && chartJd < sunsetJd) {
      // နေ့ဟောရာ (0..11)
      const elapsed = chartJd - effectiveSunriseJd;
      horaIndex = Math.min(11, Math.floor(elapsed / dayHoraLen));
      horaStartJd = effectiveSunriseJd + horaIndex * dayHoraLen;
      horaEndJd = horaStartJd + dayHoraLen;
    } else if (chartJd >= sunsetJd) {
      // ညဟောရာ — နေဝင်ပြီးနောက် သန်းခေါင်မတိုင်မီ (12..23)
      const elapsed = chartJd - sunsetJd;
      const nightHoraIdx = Math.min(11, Math.floor(elapsed / nightHoraLen));
      horaIndex = 12 + nightHoraIdx;
      horaStartJd = sunsetJd + nightHoraIdx * nightHoraLen;
      horaEndJd = horaStartJd + nightHoraLen;
    } else {
      // ညဟောရာ — သန်းခေါင်ကျော် နေမထွက်မီ (ယခင်နေ့ နေဝင်ချိန်မှ စတင်တွက်ချက်သည်)
      if (panchanga?.vara.weekday === undefined) {
        vedicWeekday = (civilWeekday + 6) % 7;
      }
      const prevSunsetJd = sunsetJd - 1.0;
      const elapsed = Math.max(0, chartJd - prevSunsetJd);
      const nightHoraIdx = Math.min(11, Math.floor(elapsed / nightHoraLen));
      horaIndex = 12 + nightHoraIdx;
      horaStartJd = prevSunsetJd + nightHoraIdx * nightHoraLen;
      horaEndJd = horaStartJd + nightHoraLen;
    }
  } else {
    issues.push(warningIssue("HORA.sunrise", "Sunrise not provided; estimating hora from civil time"));
    defaulted = true;

    const utcMs = (chartJd - 2440587.5) * 86400000;
    const localMs = utcMs + offsetHours * 3600000;
    const localMidnight = Math.floor(localMs / 86400000) * 86400000;
    const estimatedSunriseMs = localMidnight + 6 * 3600000;
    const estimatedSunriseJd = 2440587.5 + (estimatedSunriseMs - offsetHours * 3600000) / 86400000;

    const horaLen = (1.0 / 24.0);
    if (chartJd >= estimatedSunriseJd) {
      horaIndex = Math.min(23, Math.floor((chartJd - estimatedSunriseJd) / horaLen));
      horaStartJd = estimatedSunriseJd + horaIndex * horaLen;
    } else {
      if (panchanga?.vara.weekday === undefined) {
        vedicWeekday = (civilWeekday + 6) % 7;
      }
      const prevSunriseJd = estimatedSunriseJd - 1.0;
      horaIndex = Math.min(23, Math.max(0, Math.floor((chartJd - prevSunriseJd) / horaLen)));
      horaStartJd = prevSunriseJd + horaIndex * horaLen;
    }
    horaEndJd = horaStartJd + horaLen;
  }

  const sequence = HORA_SEQUENCES[vedicWeekday] ?? HORA_SEQUENCES[0]!;
  const lord = sequence[horaIndex % 7]!;

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
