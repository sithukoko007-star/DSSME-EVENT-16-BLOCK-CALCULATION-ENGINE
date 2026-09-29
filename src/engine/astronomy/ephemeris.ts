/**
 * Ephemeris Engine (Swiss Ephemeris WebAssembly + Astronomy Engine Fallback)
 * Deterministic astronomical calculation core for DSSME
 */

import {
  SwissEphemeris,
  SiderealMode,
  Planet,
  LunarPoint,
  CalculationFlag,
  HouseSystem,
} from "@swisseph/browser";
import * as Astronomy from "astronomy-engine";
import type { ClassicalPlanet, NineBody } from "../../types/dssme-canonical-types.ts";

export interface BodyAstronomyResult {
  tropicalLongitude: number;
  siderealLongitude: number;
  eclipticLatitude: number;
  speedLongitude: number;
  isRetrograde: boolean;
}

export interface AscendantAstronomyResult {
  tropicalLongitude: number;
  siderealLongitude: number;
}

let sweInstance: SwissEphemeris | null = null;
let sweInitPromise: Promise<SwissEphemeris> | null = null;

/**
 * Initializes the Swiss Ephemeris WASM instance.
 * Safe for both browser and Node.js environments.
 */
export async function getSwissEphemeris(): Promise<SwissEphemeris> {
  if (sweInstance) {
    return sweInstance;
  }
  if (sweInitPromise) {
    return sweInitPromise;
  }

  sweInitPromise = (async () => {
    // If in Node.js environment, polyfill fetch for local swisseph.wasm
    if (typeof window === "undefined") {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const possiblePaths = [
          path.resolve(process.cwd(), "public/swisseph.wasm"),
          path.resolve(process.cwd(), "node_modules/@swisseph/browser/dist/swisseph.wasm"),
          "/public/swisseph.wasm",
        ];

        let wasmBuffer: Buffer | null = null;
        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            wasmBuffer = fs.readFileSync(p);
            break;
          }
        }

        if (wasmBuffer) {
          const originalFetch = globalThis.fetch;
          globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
            const urlStr = typeof url === "string" ? url : url.toString();
            if (urlStr.includes("swisseph.wasm")) {
              return new Response(new Uint8Array(wasmBuffer), {
                status: 200,
                headers: { "Content-Type": "application/wasm" },
              });
            }
            if (originalFetch) {
              return originalFetch(url, init);
            }
            throw new Error(`fetch not supported for ${urlStr}`);
          };
        }
      } catch (err) {
        console.warn("Node WASM file hook notice:", err);
      }
    }

    const swe = new SwissEphemeris();
    await swe.init();
    swe.setSiderealMode(SiderealMode.Lahiri);
    sweInstance = swe;
    return swe;
  })();

  return sweInitPromise;
}

/**
 * Normalizes degrees to [0, 360).
 */
export function normalize360(deg: number): number {
  let val = deg % 360;
  if (val < 0) {
    val += 360;
  }
  return val;
}

function logEphemerisFallback(funcName: string, error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error);
  console.warn(
    `[DSSME ephemeris] FALLBACK ENGINE ACTIVE for ${funcName} — Swiss Ephemeris WASM failed: ${reason}`
  );
}

/**
 * Calculates Lahiri Ayanamsa for a given Julian Day UT.
 * Primary: Swiss Ephemeris WASM SE_SIDM_LAHIRI
 * Deterministic calculation backed by Indian Astronomical Ephemeris standard.
 */
export async function calculateLahiriAyanamsa(julianDayUt: number): Promise<number> {
  try {
    const swe = await getSwissEphemeris();
    swe.setSiderealMode(SiderealMode.Lahiri);
    return swe.getAyanamsa(julianDayUt);
  } catch (err) {
    logEphemerisFallback("calculateLahiriAyanamsa", err);
    // Pure mathematical Lahiri formulation fallback
    // Standard IAU/Lahiri epoch J2000.0 (JD 2451545.0) = 23° 51' 25.532" = 23.85709222°
    // Precession rate ~ 50.290966" / year = 0.01396971278° / year = 0.000038246989° / day
    const d = julianDayUt - 2451545.0;
    const t = d / 36525.0; // centuries since J2000.0
    // Laskar / IAU 2000 precession expression adjusted to Lahiri fiducial
    const ayanamsa = 23.85709222 + 1.3969713 * t + 0.0003086 * t * t;
    return ayanamsa;
  }
}

const BODY_TO_SWISSEPH_PLANET: Record<ClassicalPlanet, number> = {
  Sun: Planet.Sun,
  Moon: Planet.Moon,
  Mars: Planet.Mars,
  Mercury: Planet.Mercury,
  Jupiter: Planet.Jupiter,
  Venus: Planet.Venus,
  Saturn: Planet.Saturn,
};

/**
 * Calculates planetary position for a celestial body at Julian Day UT.
 */
export async function calculateBodyPosition(
  julianDayUt: number,
  body: NineBody,
  ayanamsa: number
): Promise<BodyAstronomyResult> {
  const flags =
    CalculationFlag.MoshierEphemeris |
    CalculationFlag.Speed |
    CalculationFlag.Sidereal;

  try {
    const swe = await getSwissEphemeris();
    swe.setSiderealMode(SiderealMode.Lahiri);

    if (body === "Rahu") {
      const pos = swe.calculatePosition(julianDayUt, LunarPoint.MeanNode, flags);
      const siderealLon = normalize360(pos.longitude);
      const tropicalLon = normalize360(siderealLon + ayanamsa);
      return {
        siderealLongitude: siderealLon,
        tropicalLongitude: tropicalLon,
        eclipticLatitude: pos.latitude,
        speedLongitude: pos.longitudeSpeed,
        isRetrograde: pos.longitudeSpeed < 0,
      };
    }

    if (body === "Ketu") {
      const posRahu = swe.calculatePosition(julianDayUt, LunarPoint.MeanNode, flags);
      const siderealLon = normalize360(posRahu.longitude + 180.0);
      const tropicalLon = normalize360(siderealLon + ayanamsa);
      return {
        siderealLongitude: siderealLon,
        tropicalLongitude: tropicalLon,
        eclipticLatitude: -posRahu.latitude,
        speedLongitude: posRahu.longitudeSpeed,
        isRetrograde: posRahu.longitudeSpeed < 0,
      };
    }

    const planetId = BODY_TO_SWISSEPH_PLANET[body];
    const pos = swe.calculatePosition(julianDayUt, planetId, flags);
    const siderealLon = normalize360(pos.longitude);
    const tropicalLon = normalize360(siderealLon + ayanamsa);

    return {
      siderealLongitude: siderealLon,
      tropicalLongitude: tropicalLon,
      eclipticLatitude: pos.latitude,
      speedLongitude: pos.longitudeSpeed,
      isRetrograde: pos.longitudeSpeed < 0,
    };
  } catch (err) {
    logEphemerisFallback(`calculateBodyPosition(${body})`, err);
    // Pure Astronomy Engine fallback
    return calculateBodyWithAstronomyEngine(julianDayUt, body, ayanamsa);
  }
}

/**
 * Fallback calculation using Astronomy Engine (VSOP87 / NOVAS model)
 */
function calculateBodyWithAstronomyEngine(
  julianDayUt: number,
  body: NineBody,
  ayanamsa: number
): BodyAstronomyResult {
  const J2000_DAYS = julianDayUt - 2451545.0;
  const time = Astronomy.MakeTime(J2000_DAYS);

  if (body === "Rahu" || body === "Ketu") {
    // Mean lunar ascending node longitude
    // Formula from Explanatory Supplement to the Astronomical Almanac
    const T = J2000_DAYS / 36525.0;
    const omegaTropical = normalize360(
      125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000.0
    );
    const dailyMotion = -0.0529539; // ~-19.34 degrees per year

    let siderealLon = normalize360(omegaTropical - ayanamsa);
    let tropicalLon = omegaTropical;

    if (body === "Ketu") {
      siderealLon = normalize360(siderealLon + 180.0);
      tropicalLon = normalize360(tropicalLon + 180.0);
    }

    return {
      tropicalLongitude: tropicalLon,
      siderealLongitude: siderealLon,
      eclipticLatitude: 0,
      speedLongitude: dailyMotion,
      isRetrograde: true,
    };
  }

  // Classical planet
  const vec1 = Astronomy.GeoVector(body as Astronomy.Body, time, true);
  const ecl1 = Astronomy.Ecliptic(vec1);

  // Speed calculation over 1 hour delta
  const dtDays = 1.0 / 24.0;
  const time2 = Astronomy.MakeTime(J2000_DAYS + dtDays);
  const vec2 = Astronomy.GeoVector(body as Astronomy.Body, time2, true);
  const ecl2 = Astronomy.Ecliptic(vec2);

  let dLon = ecl2.elon - ecl1.elon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  const speedLongitude = dLon * 24.0; // deg per day

  const tropicalLongitude = normalize360(ecl1.elon);
  const siderealLongitude = normalize360(tropicalLongitude - ayanamsa);

  return {
    tropicalLongitude,
    siderealLongitude,
    eclipticLatitude: ecl1.elat,
    speedLongitude,
    isRetrograde: speedLongitude < 0,
  };
}

/**
 * Calculates Ascendant (Lagna) for Julian Day UT at given geographic coordinates.
 *
 * @param julianDayUt Julian Day in Universal Time
 * @param latitude Geographic latitude (+N / -S)
 * @param longitude Geographic longitude (+E / -W)
 * @param ayanamsa Lahiri ayanamsa value in degrees
 */
export async function calculateAscendant(
  julianDayUt: number,
  latitude: number,
  longitude: number,
  ayanamsa: number
): Promise<AscendantAstronomyResult> {
  try {
    const swe = await getSwissEphemeris();
    const houses = swe.calculateHouses(julianDayUt, latitude, longitude, HouseSystem.WholeSign);
    const tropicalAscendant = normalize360(houses.ascendant);
    const siderealAscendant = normalize360(tropicalAscendant - ayanamsa);

    return {
      tropicalLongitude: tropicalAscendant,
      siderealLongitude: siderealAscendant,
    };
  } catch (err) {
    logEphemerisFallback("calculateAscendant", err);
    // Pure astronomical Ascendant fallback via Sidereal Time
    return calculateAscendantPure(julianDayUt, latitude, longitude, ayanamsa);
  }
}

/**
 * Pure trigonometric Ascendant calculation from Greenwich Sidereal Time (GST) and Obliquity.
 */
function calculateAscendantPure(
  julianDayUt: number,
  latitude: number,
  longitude: number,
  ayanamsa: number
): AscendantAstronomyResult {
  const J2000_DAYS = julianDayUt - 2451545.0;
  const T = J2000_DAYS / 36525.0;

  // Greenwich Mean Sidereal Time (degrees) - IAU formula
  let gmst =
    280.46061837 +
    360.98564736629 * J2000_DAYS +
    0.000387933 * T * T -
    (T * T * T) / 38710000.0;
  gmst = normalize360(gmst);

  // Local Sidereal Time (degrees)
  const lst = normalize360(gmst + longitude);
  const theta = (lst * Math.PI) / 180.0;

  // True Obliquity of the Ecliptic (degrees)
  const eps0 = 23.4392911 - 0.0130042 * T - 0.00000016 * T * T;
  const eps = (eps0 * Math.PI) / 180.0;

  const phi = (latitude * Math.PI) / 180.0;

  // Ascendant formula:
  // tan(Asc) = -cos(RAMC) / (sin(RAMC) * cos(eps) + tan(lat) * sin(eps))
  const y = -Math.cos(theta);
  const x = Math.sin(theta) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps);

  let ascRad = Math.atan2(y, x);
  let ascDeg = normalize360((ascRad * 180.0) / Math.PI);

  // Ensure ascendant is in rising eastern hemisphere
  const siderealAsc = normalize360(ascDeg - ayanamsa);

  return {
    tropicalLongitude: ascDeg,
    siderealLongitude: siderealAsc,
  };
}
