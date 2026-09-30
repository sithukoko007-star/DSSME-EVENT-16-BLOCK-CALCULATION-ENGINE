import { CalculationFlag, Planet, SiderealMode } from '@swisseph/browser';
import * as Astronomy from 'astronomy-engine';
import { getSwissEphemeris, normalize360 } from '../astronomy/ephemeris.ts';
import { dateToJulianDayUt } from '../astronomy/julianDay.ts';
import { deriveTimezoneOffset } from '../../utils/timezoneHelper.ts';
import type { CanonicalChart } from '../../types/dssme-canonical-types.ts';
import type { LongitudeProvider, SiderealLongitudes, SunriseProvider } from './panchangaTypes.ts';

/**
 * Creates a LongitudeProvider wrapping Swiss Ephemeris WASM.
 * Must be initialized after `await getSwissEphemeris()` has resolved.
 */
export async function createSwissLongitudeProvider(): Promise<LongitudeProvider> {
  const swe = await getSwissEphemeris();
  swe.setSiderealMode(SiderealMode.Lahiri);
  const flags = CalculationFlag.MoshierEphemeris | CalculationFlag.Speed | CalculationFlag.Sidereal;

  return (jdUT: number): SiderealLongitudes => {
    const s = swe.calculatePosition(jdUT, Planet.Sun, flags);
    const m = swe.calculatePosition(jdUT, Planet.Moon, flags);
    return {
      sun: normalize360(s.longitude),
      moon: normalize360(m.longitude),
    };
  };
}

/**
 * Creates a SunriseProvider using astronomy-engine for high-precision local topocentric sunrise.
 * Follows traditional Drik / Jagannatha Hora topocentric geometric solar horizon definition.
 */
export function createSunriseProvider(): SunriseProvider {
  return (date, location, timezone) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${date.year}-${pad(date.month)}-${pad(date.day)}`;
    const offsetRes = deriveTimezoneOffset(timezone, dateStr, '06:00:00');
    const offsetHours = offsetRes.valid && offsetRes.offsetHours !== undefined ? offsetRes.offsetHours : 0;

    const approxMidnightUtcMs = Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0) - offsetHours * 3600000;
    const observer = new Astronomy.Observer(location.latitude, location.longitude, location.altitudeM || 0);
    const rise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, new Date(approxMidnightUtcMs), 1.0);

    if (!rise) {
      // In polar regions (midnight sun or polar night), default to 6 AM local
      const sixAmUtcMs = approxMidnightUtcMs + 6 * 3600000;
      return dateToJulianDayUt(new Date(sixAmUtcMs));
    }

    return dateToJulianDayUt(rise.date);
  };
}

export class DegradedEphemerisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DegradedEphemerisError';
  }
}

/**
 * Creates an auxiliary provider matched to the chart's provenance state.
 * Enforces strict fail-closed contract: only 'swisseph-wasm' canonical charts
 * can instantiate a Swiss auxiliary longitude provider for boundary searches.
 * Degraded ('fallback' or 'mixed') charts fail closed to prevent cross-source corruption.
 */
export async function createCanonicalLongitudeProvider(
  chart: CanonicalChart
): Promise<LongitudeProvider> {
  const ephemeris = chart?.provenance?.ephemeris;
  if (ephemeris !== 'swisseph-wasm') {
    throw new DegradedEphemerisError(
      `Cannot create auxiliary LongitudeProvider: CanonicalChart has degraded provenance "${ephemeris}". ` +
      `Auxiliary boundary search requires an active Swiss Ephemeris WASM engine to prevent cross-source boundary corruption.`
    );
  }
  return createSwissLongitudeProvider();
}
