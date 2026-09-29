// Phase 2 contract types. Nothing here recalculates astronomy.

export type Degrees = number;        // normalized to [0, 360) unless stated
export type JulianDayUT = number;
export type PositionSource = 'swiss' | 'fallback';

export interface SiderealLongitudes {
  sun: Degrees;
  moon: Degrees;
}

/**
 * The ONLY astronomical input Panchanga accepts. Build it from CanonicalChart
 * via `fromCanonicalChart`.
 */
export interface PanchangaSource {
  julianDayUT: JulianDayUT;
  timezone: string;                 // validated IANA id from Phase 1
  utcOffsetMinutes: number;         // resolved offset at this instant (post DST handling)
  location: { latitude: number; longitude: number; altitudeM?: number };
  ayanamsa: { name: string; valueDeg: number };   // e.g. Lahiri
  longitudes: SiderealLongitudes;   // canonical Sun/Moon, sidereal
  positionSource: PositionSource;
  chartProvenance: Readonly<Record<string, unknown>>;
}

/**
 * Auxiliary evaluator used ONLY for boundary search and parity checks.
 * Must wrap the same ephemeris call, flags and ayanamsa as Phase 1.
 */
export type LongitudeProvider = (jdUT: JulianDayUT) => SiderealLongitudes;

export interface CivilDate { year: number; month: number; day: number }

/** Returns sunrise as JD UT for the given local civil date and location. */
export type SunriseProvider = (
  date: CivilDate,
  location: PanchangaSource['location'],
  timezone: string,
) => JulianDayUT;

export interface TransitionWindow {
  startJdUT: JulianDayUT | null;    // null if not computed
  endJdUT: JulianDayUT | null;
  startUtcIso?: string;
  endUtcIso?: string;
  startLocal?: string;
  endLocal?: string;
}

export interface TithiResult {
  index: number;                    // 1..30
  paksha: 'shukla' | 'krishna';
  numberInPaksha: number;           // 1..15
  name: string;
  elongationDeg: Degrees;           // moon - sun, [0,360)
  fractionElapsed: number;          // 0..1
  window?: TransitionWindow;
}

export interface NakshatraResult {
  index: number;                    // 1..27
  name: string;
  pada: number;                     // 1..4
  moonLongitudeDeg: Degrees;
  fractionElapsed: number;
  window?: TransitionWindow;
}

export interface YogaResult {
  index: number;                    // 1..27
  name: string;
  sumDeg: Degrees;                  // (sun + moon) mod 360, sidereal
  fractionElapsed: number;
  window?: TransitionWindow;
}

export interface KaranaResult {
  halfTithiIndex: number;           // 1..60
  name: string;
  kind: 'fixed' | 'movable';
  window?: TransitionWindow;
}

export type VaraMode = 'sunrise' | 'civil';

export interface VaraResult {
  weekday: number;                  // 0 = Sunday .. 6 = Saturday
  name: string;
  mode: VaraMode;
  civilDate: CivilDate;             // date whose weekday was used
  sunriseJdUT?: JulianDayUT;
}

export interface PanchangaProvenance {
  julianDayUT: JulianDayUT;
  timezone: string;
  utcOffsetMinutes: number;
  ayanamsa: PanchangaSource['ayanamsa'];
  sunLongitudeDeg: Degrees;
  moonLongitudeDeg: Degrees;
  positionSource: PositionSource;
  varaMode: VaraMode;
  boundaryProvider: 'none' | 'canonical-equivalent';
  chartProvenance: Readonly<Record<string, unknown>>;
}

export interface PanchangaResult {
  tithi: TithiResult;
  nakshatra: NakshatraResult;
  yoga: YogaResult;
  karana: KaranaResult;
  vara: VaraResult;
  provenance: PanchangaProvenance;
}

export interface PanchangaOptions {
  varaMode?: VaraMode;              // default 'sunrise'
  includeBoundaries?: boolean;      // default false; needs provider
}

export interface PanchangaDeps {
  provider?: LongitudeProvider;     // required if includeBoundaries
  sunrise?: SunriseProvider;        // required if varaMode === 'sunrise'
}

export class NotImplementedError extends Error {
  constructor(what: string) { super(`Not implemented: ${what}`); this.name = 'NotImplementedError'; }
}
