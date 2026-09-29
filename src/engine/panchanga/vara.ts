import type {
  CivilDate, JulianDayUT, PanchangaSource, SunriseProvider, VaraMode, VaraResult,
} from './panchangaTypes.ts';
import { jdToDate } from './angles.ts';
import { NotImplementedError } from './panchangaTypes.ts';

const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Local civil date of an instant in an IANA timezone (DST-safe via Intl). */
export function localCivilDate(jd: JulianDayUT, timezone: string): CivilDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(jdToDate(jd));
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function previousDay(d: CivilDate): CivilDate {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day - 1));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

export function weekdayOf(d: CivilDate): number {
  return new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();   // 0 = Sunday
}

export function computeVara(
  src: Pick<PanchangaSource, 'julianDayUT' | 'timezone' | 'location'>,
  mode: VaraMode,
  sunrise?: SunriseProvider,
): VaraResult {
  let date = localCivilDate(src.julianDayUT, src.timezone);

  if (mode === 'civil') {
    const w = weekdayOf(date);
    return { weekday: w, name: NAMES[w], mode, civilDate: date };
  }

  if (!sunrise) throw new NotImplementedError('SunriseProvider required for varaMode "sunrise"');
  const sr = sunrise(date, src.location, src.timezone);
  if (src.julianDayUT < sr) date = previousDay(date);   // before sunrise -> previous Vara
  const w = weekdayOf(date);
  return { weekday: w, name: NAMES[w], mode, civilDate: date, sunriseJdUT: sr };
}
