import { computeKarana } from './karana.ts';
import { computeNakshatra } from './nakshatra.ts';
import { computeTithi } from './tithi.ts';
import { computeVara } from './vara.ts';
import { computeYoga } from './yoga.ts';
import { boundaryWindows } from './panchangaBoundaries.ts';
import { NotImplementedError } from './panchangaTypes.ts';
import type {
  PanchangaDeps, PanchangaOptions, PanchangaResult, PanchangaSource,
} from './panchangaTypes.ts';
import type { CanonicalChart } from '../../types/dssme-canonical-types.ts';

/**
 * Adapter: CanonicalChart -> PanchangaSource.
 * Extracts the canonical Sun and Moon sidereal longitudes, time, location,
 * and provenance from the Phase 1 CanonicalChart.
 */
export function fromCanonicalChart(chart: CanonicalChart): PanchangaSource {
  if (!chart || !chart.planets || !chart.planets.Sun || !chart.planets.Moon) {
    throw new Error('fromCanonicalChart: Invalid or missing CanonicalChart');
  }

  const isSwiss = chart.provenance?.ephemeris === 'swisseph-wasm';

  return {
    julianDayUT: chart.time.julianDayUt,
    timezone: chart.input.timezone,
    utcOffsetMinutes: Math.round(chart.time.timezoneOffsetHours * 60),
    location: {
      latitude: chart.location.latitude,
      longitude: chart.location.longitude,
      altitudeM: 0,
    },
    ayanamsa: {
      name: chart.ayanamsa.name,
      valueDeg: chart.ayanamsa.value,
    },
    longitudes: {
      sun: chart.planets.Sun.siderealLongitude,
      moon: chart.planets.Moon.siderealLongitude,
    },
    positionSource: isSwiss ? 'swiss' : 'fallback',
    chartProvenance: (chart.provenance || {}) as unknown as Record<string, unknown>,
  };
}

export function computePanchanga(
  src: PanchangaSource,
  deps: PanchangaDeps = {},
  opts: PanchangaOptions = {},
): PanchangaResult {
  const varaMode = opts.varaMode ?? 'sunrise';
  const L = src.longitudes;   // canonical Sun/Moon: never recomputed here

  const result: PanchangaResult = {
    tithi: computeTithi(L),
    nakshatra: computeNakshatra(L),
    yoga: computeYoga(L),
    karana: computeKarana(L),
    vara: computeVara(src, varaMode, deps.sunrise),
    provenance: {
      julianDayUT: src.julianDayUT,
      timezone: src.timezone,
      utcOffsetMinutes: src.utcOffsetMinutes,
      ayanamsa: src.ayanamsa,
      sunLongitudeDeg: L.sun,
      moonLongitudeDeg: L.moon,
      positionSource: src.positionSource,
      varaMode,
      boundaryProvider: opts.includeBoundaries ? 'canonical-equivalent' : 'none',
      chartProvenance: src.chartProvenance,
    },
  };

  if (opts.includeBoundaries) {
    if (!deps.provider) throw new NotImplementedError('LongitudeProvider required for boundaries');
    const w = boundaryWindows(deps.provider, src.julianDayUT, src.timezone);
    result.tithi.window = w.tithi;
    result.nakshatra.window = w.nakshatra;
    result.yoga.window = w.yoga;
    result.karana.window = w.karana;
  }
  return result;
}
