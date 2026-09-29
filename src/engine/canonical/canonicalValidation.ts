/**
 * Canonical Validation Module
 * Two-layer validation for DSSME Canonical Architecture:
 * Layer A: Structural Schema Validation (validateCanonicalChart)
 * Layer B: Astronomical Mathematical Consistency Validation (validateAstronomicalConsistency)
 */

import {
  CanonicalChart,
  DssmeCalculationInput,
  HouseKey,
  NineBody,
  ZODIAC_SIGNS_ARIES_FIRST,
} from "../../types/dssme-canonical-types.ts";
import { getNakshatraInfo } from "../astronomy/ascendant.ts";
import { NINE_BODIES_ORDER } from "../astronomy/planetaryPositions.ts";
import { deriveTimezoneOffset, isValidIanaTimezone } from "../../utils/timezoneHelper.ts";

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

/**
 * Validates DssmeCalculationInput.
 * Enforces server-side timezone integrity and numerical boundaries.
 * Throws explicit errors with canonical error codes.
 */
export function validateCalculationInput(input: unknown): DssmeCalculationInput {
  if (!input || typeof input !== "object") {
    throw new Error("INVALID_INPUT: Input must be a valid JSON object");
  }

  const obj = input as Partial<DssmeCalculationInput>;

  if (typeof obj.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(obj.date.trim())) {
    throw new Error(`INVALID_INPUT: "date" must be a string in YYYY-MM-DD format, received: ${obj.date}`);
  }

  if (typeof obj.time !== "string" || !/^\d{1,2}:\d{2}(?::\d{2})?$/.test(obj.time.trim())) {
    throw new Error(`INVALID_INPUT: "time" must be a string in HH:MM:SS format, received: ${obj.time}`);
  }

  if (typeof obj.latitude !== "number" || isNaN(obj.latitude) || obj.latitude < -90 || obj.latitude > 90) {
    throw new Error(`INVALID_INPUT: "latitude" must be a number between -90 and +90, received: ${obj.latitude}`);
  }

  if (typeof obj.longitude !== "number" || isNaN(obj.longitude) || obj.longitude < -180 || obj.longitude > 180) {
    throw new Error(`INVALID_INPUT: "longitude" must be a number between -180 and +180, received: ${obj.longitude}`);
  }

  if (
    typeof obj.timezoneOffset !== "number" ||
    isNaN(obj.timezoneOffset) ||
    obj.timezoneOffset < -14 ||
    obj.timezoneOffset > 14
  ) {
    throw new Error(
      `TIMEZONE_ERROR: "timezoneOffset" must be a number between -14 and +14, received: ${obj.timezoneOffset}`
    );
  }

  if (typeof obj.timezone !== "string" || !obj.timezone.trim()) {
    throw new Error(`TIMEZONE_ERROR: "timezone" must be a non-empty string, received: ${obj.timezone}`);
  }

  // Server-side Timezone Integrity Enforcement:
  // If an IANA timezone is provided, verify caller-supplied timezoneOffset against astronomical IANA rules
  const trimmedTz = obj.timezone.trim();
  if (isValidIanaTimezone(trimmedTz)) {
    const derived = deriveTimezoneOffset(trimmedTz, obj.date.trim(), obj.time.trim());
    if (derived.valid && derived.offsetHours !== undefined) {
      // Allow minor tolerance of 0.05 hours (3 mins) for fractional precision
      if (Math.abs(obj.timezoneOffset - derived.offsetHours) > 0.05) {
        throw new Error(
          `TIMEZONE_ERROR: Inconsistent timezone: supplied timezoneOffset (${obj.timezoneOffset}h) does not match IANA timezone "${trimmedTz}" at date/time ${obj.date.trim()} ${obj.time.trim()} (expected: ${derived.offsetHours}h).`
        );
      }
    }
  }

  if (obj.ayanamsa !== "Lahiri") {
    throw new Error(`INVALID_INPUT: "ayanamsa" must be "Lahiri", received: ${obj.ayanamsa}`);
  }

  return {
    date: obj.date.trim(),
    time: obj.time.trim(),
    latitude: obj.latitude,
    longitude: obj.longitude,
    timezone: trimmedTz,
    timezoneOffset: obj.timezoneOffset,
    ayanamsa: "Lahiri",
    chartMode: obj.chartMode,
    bodyMode: obj.bodyMode,
    objective: obj.objective,
    risk: obj.risk,
    geometry: obj.geometry,
  };
}

/**
 * Layer A: Structural Schema Validation.
 * Validates that a CanonicalChart object conforms structurally to the TypeScript contract.
 */
export function validateCanonicalChart(chart: CanonicalChart): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!chart.time || typeof chart.time.julianDayUt !== "number" || chart.time.julianDayUt <= 0) {
    issues.push({ field: "time.julianDayUt", message: "Invalid Julian Day UT" });
  }

  if (!chart.ayanamsa || chart.ayanamsa.name !== "Lahiri" || typeof chart.ayanamsa.value !== "number") {
    issues.push({ field: "ayanamsa", message: "Invalid Lahiri ayanamsa" });
  }

  // Lagna validation
  if (!chart.lagna || chart.lagna.body !== "Lagna") {
    issues.push({ field: "lagna", message: "Missing or invalid Lagna position" });
  } else {
    if (chart.lagna.siderealLongitude < 0 || chart.lagna.siderealLongitude >= 360) {
      issues.push({ field: "lagna.siderealLongitude", message: "Lagna longitude outside [0, 360)" });
    }
    if (!ZODIAC_SIGNS_ARIES_FIRST.includes(chart.lagna.sign)) {
      issues.push({ field: "lagna.sign", message: "Invalid Lagna zodiac sign" });
    }
    if (chart.lagna.house !== 1) {
      issues.push({ field: "lagna.house", message: "Lagna house must be 1" });
    }
  }

  // Planets validation
  if (!chart.planets) {
    issues.push({ field: "planets", message: "Missing planets collection" });
  } else {
    for (const body of NINE_BODIES_ORDER) {
      const p = chart.planets[body];
      if (!p) {
        issues.push({ field: `planets.${body}`, message: `Missing planet ${body}` });
      } else {
        if (p.siderealLongitude < 0 || p.siderealLongitude >= 360) {
          issues.push({ field: `planets.${body}.siderealLongitude`, message: "Longitude outside [0, 360)" });
        }
        if (p.house < 1 || p.house > 12) {
          issues.push({ field: `planets.${body}.house`, message: "House must be 1-12" });
        }
      }
    }
  }

  // Houses validation
  if (!chart.houses) {
    issues.push({ field: "houses", message: "Missing houses collection" });
  } else {
    for (let h = 1; h <= 12; h++) {
      const key = h.toString() as HouseKey;
      const house = chart.houses[key];
      if (!house) {
        issues.push({ field: `houses.${key}`, message: `Missing house ${key}` });
      } else {
        if (house.houseNumber !== h) {
          issues.push({ field: `houses.${key}.houseNumber`, message: "House number mismatch" });
        }
        if (!ZODIAC_SIGNS_ARIES_FIRST.includes(house.sign)) {
          issues.push({ field: `houses.${key}.sign`, message: "Invalid house sign" });
        }
      }
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Layer B: Astronomical Mathematical Consistency Validation.
 * Validates cross-field internal consistency of astronomical positions:
 * - longitude ↔ sign derivation
 * - longitude ↔ nakshatra derivation
 * - nakshatra ↔ pada derivation
 * - Rahu ↔ Ketu exact 180° opposition
 * - speed ↔ retrograde flag logic
 * - Lagna longitude ↔ Lagna sign
 * - Whole-sign house sequence continuity
 * - Planet ↔ house mapping
 * - House occupants bi-directional coherence
 */
export function validateAstronomicalConsistency(chart: CanonicalChart): ValidationResult {
  const issues: ValidationIssue[] = [];

  const checkBodyConsistency = (
    name: string,
    p: {
      siderealLongitude: number;
      sign: string;
      signDegree: number;
      nakshatra: string;
      nakshatraPada: number;
      speedLongitude: number;
      isRetrograde: boolean;
      house: number;
    }
  ) => {
    // 1. Longitude ↔ Sign derivation
    const expectedSignIndex = Math.floor(p.siderealLongitude / 30.0);
    const expectedSign = ZODIAC_SIGNS_ARIES_FIRST[expectedSignIndex];
    if (p.sign !== expectedSign) {
      issues.push({
        field: `${name}.sign`,
        message: `Sign mismatch: longitude ${p.siderealLongitude.toFixed(4)}° maps to ${expectedSign}, but recorded as ${p.sign}`,
      });
    }

    // 2. Sign degree derivation
    const expectedDegree = p.siderealLongitude - expectedSignIndex * 30.0;
    if (Math.abs(p.signDegree - expectedDegree) > 0.0001) {
      issues.push({
        field: `${name}.signDegree`,
        message: `Sign degree mismatch: expected ${expectedDegree.toFixed(4)}°, but recorded as ${p.signDegree.toFixed(4)}°`,
      });
    }

    // 3. Longitude ↔ Nakshatra & Pada derivation
    const nakInfo = getNakshatraInfo(p.siderealLongitude);
    if (p.nakshatra !== nakInfo.nakshatra) {
      issues.push({
        field: `${name}.nakshatra`,
        message: `Nakshatra mismatch: longitude ${p.siderealLongitude.toFixed(4)}° is in ${nakInfo.nakshatra}, but recorded as ${p.nakshatra}`,
      });
    }
    if (p.nakshatraPada !== nakInfo.pada) {
      issues.push({
        field: `${name}.nakshatraPada`,
        message: `Pada mismatch: longitude ${p.siderealLongitude.toFixed(4)}° is pada ${nakInfo.pada}, but recorded as ${p.nakshatraPada}`,
      });
    }
  };

  // Check Lagna consistency
  if (chart.lagna) {
    checkBodyConsistency("lagna", chart.lagna);
    if (chart.lagna.house !== 1) {
      issues.push({ field: "lagna.house", message: `Lagna house must be 1, found ${chart.lagna.house}` });
    }
  }

  // Check all 9 Planets consistency
  if (chart.planets) {
    for (const body of NINE_BODIES_ORDER) {
      const p = chart.planets[body];
      if (p) {
        checkBodyConsistency(`planets.${body}`, p);

        // Speed ↔ Retrograde flag
        if (body === "Sun" || body === "Moon") {
          if (p.isRetrograde) {
            issues.push({ field: `planets.${body}.isRetrograde`, message: `${body} can never be retrograde` });
          }
        } else if (body === "Rahu" || body === "Ketu") {
          if (!p.isRetrograde) {
            issues.push({ field: `planets.${body}.isRetrograde`, message: `${body} (mean node) must always be retrograde` });
          }
        } else {
          // Classical planets
          const expectedRetro = p.speedLongitude < 0;
          if (p.isRetrograde !== expectedRetro) {
            issues.push({
              field: `planets.${body}.isRetrograde`,
              message: `Retrograde flag (${p.isRetrograde}) contradicts speedLongitude (${p.speedLongitude})`,
            });
          }
        }
      }
    }

    // 4. Rahu ↔ Ketu exact 180° opposition
    if (chart.planets.Rahu && chart.planets.Ketu) {
      let diff = Math.abs(chart.planets.Rahu.siderealLongitude - chart.planets.Ketu.siderealLongitude);
      if (diff > 180.0) diff = Math.abs(diff - 360.0);
      if (Math.abs(diff - 180.0) > 0.001) {
        issues.push({
          field: "planets.Rahu_Ketu_opposition",
          message: `Rahu (${chart.planets.Rahu.siderealLongitude.toFixed(4)}°) and Ketu (${chart.planets.Ketu.siderealLongitude.toFixed(4)}°) must be exactly 180° apart, difference is ${diff.toFixed(4)}°`,
        });
      }
    }
  }

  // 5. Whole-sign House Sequence & House Occupants Consistency
  if (chart.lagna && chart.houses && chart.planets) {
    const lagnaSignIndex = ZODIAC_SIGNS_ARIES_FIRST.indexOf(chart.lagna.sign);

    for (let h = 1; h <= 12; h++) {
      const key = h.toString() as HouseKey;
      const house = chart.houses[key];
      if (house) {
        // Sign continuity
        const expectedSignIndex = (lagnaSignIndex + h - 1) % 12;
        const expectedSign = ZODIAC_SIGNS_ARIES_FIRST[expectedSignIndex];
        if (house.sign !== expectedSign) {
          issues.push({
            field: `houses.${key}.sign`,
            message: `House ${h} sign mismatch: expected ${expectedSign} (Lagna + ${h - 1}), but recorded as ${house.sign}`,
          });
        }

        // Occupant check: each listed occupant must actually belong to this house
        for (const occupant of house.occupants) {
          const planet = chart.planets[occupant];
          if (planet && planet.house !== h) {
            issues.push({
              field: `houses.${key}.occupants`,
              message: `Occupant ${occupant} is listed in House ${h}, but planet.house is ${planet.house}`,
            });
          }
        }
      }
    }

    // Bi-directional check: each planet must appear in its assigned house occupants list
    for (const body of NINE_BODIES_ORDER) {
      const p = chart.planets[body];
      if (p) {
        const planetSignIndex = ZODIAC_SIGNS_ARIES_FIRST.indexOf(p.sign);
        const expectedHouse = ((planetSignIndex - lagnaSignIndex + 12) % 12) + 1;
        if (p.house !== expectedHouse) {
          issues.push({
            field: `planets.${body}.house`,
            message: `${body} house mismatch: sign ${p.sign} relative to Lagna ${chart.lagna.sign} must be House ${expectedHouse}, but recorded as ${p.house}`,
          });
        }

        const houseObj = chart.houses[p.house.toString() as HouseKey];
        if (houseObj && !houseObj.occupants.includes(body)) {
          issues.push({
            field: `houses.${p.house}.occupants`,
            message: `${body} is in House ${p.house}, but not listed in House ${p.house}.occupants`,
          });
        }
      }
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
